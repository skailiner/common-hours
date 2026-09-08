import {
  example,
  validate,
  parse,
  time,
  parseTime,
  integer,
  LIMITS,
  assignmentKey,
  type Roster,
  type Assignment,
  type Person,
  type Shift,
  type Block,
} from './roster.ts';
import { Runner, type WorkerLike } from './runner.ts';
import type { Schedule } from './scheduler.ts';
export type DraftKind =
  | 'roster'
  | 'person'
  | 'shift'
  | 'block'
  | 'skill'
  | 'json'
  | 'lock';
export type Draft = {
  kind: DraftKind;
  original: string | null;
  fields: Record<string, string>;
  initial: string;
};
export type Pending =
  | { kind: 'replace'; roster: Roster }
  | { kind: 'discard' }
  | {
      kind: 'delete';
      entity: 'person' | 'shift' | 'block' | 'skill';
      id: string;
    }
  | { kind: 'unlock'; assignment: Assignment };
export type Snapshot = {
  roster: Roster;
  revision: number;
  result: Schedule | null;
  busy: 'plan' | 'file' | null;
  progress: string;
  draft: Draft | null;
  pending: Pending | null;
  error: string;
  message: string;
  selectedShift: string | null;
};
export class Workspace {
  private state: Snapshot = {
    roster: example(),
    revision: 0,
    result: null,
    busy: null,
    progress: '',
    draft: null,
    pending: null,
    error: '',
    message:
      'Fictional repair café loaded. Create a draft plan or edit the people, roles and blocks.',
    selectedShift: null,
  };
  private listeners = new Set<() => void>();
  private ticket = 0;
  private runner: Runner | null = null;
  getSnapshot = () => this.state;
  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  };
  private update(patch: Partial<Snapshot>) {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((fn) => fn());
  }
  error(e: unknown) {
    this.update({
      error:
        e instanceof Error
          ? e.message
          : 'The operation could not be completed.',
    });
  }
  attach(factory: () => WorkerLike) {
    const runner = new Runner(factory);
    this.runner = runner;
    return () => {
      runner.dispose();
      if (this.runner === runner) {
        this.runner = null;
        this.ticket++;
        this.update({ busy: null, progress: '' });
      }
    };
  }
  guard(revision?: number) {
    if (
      revision !== undefined &&
      (!Number.isSafeInteger(revision) || revision !== this.state.revision)
    )
      throw new Error(
        'The roster revision has changed. Read the workspace again.',
      );
    if (this.state.busy)
      throw new Error('Finish or cancel the current operation first.');
    if (this.state.draft || this.state.pending)
      throw new Error(
        'Finish or discard the open editor or confirmation first.',
      );
  }
  private commit(value: unknown) {
    const roster = validate(value);
    this.update({
      roster,
      revision: this.state.revision + 1,
      result: null,
      draft: null,
      pending: null,
      error: '',
      selectedShift: roster.shifts.some(
        (s) => s.id === this.state.selectedShift,
      )
        ? this.state.selectedShift
        : null,
      message:
        'Roster updated. Create a new draft plan for this revision. Locked assignments remain fixed.',
    });
  }
  replace(json: unknown, revision: number, discardCurrent: boolean) {
    if (!Number.isSafeInteger(revision))
      throw new Error('A current integer revision is required.');
    this.guard(revision);
    if (discardCurrent !== true)
      throw new Error(
        'Use discardCurrent:true only when replacing the current roster is intended.',
      );
    this.commit(parse(json));
  }
  requestReplace(input: unknown) {
    this.guard();
    this.update({
      pending: { kind: 'replace', roster: validate(input) },
      error: '',
    });
  }
  begin(kind: DraftKind, original: string | null = null, blockId?: string) {
    this.guard();
    const r = this.state.roster;
    let f: Record<string, string>;
    if (kind === 'roster')
      f = {
        title: r.title,
        notes: r.notes,
        blockMinutes: String(r.blockMinutes),
      };
    else if (kind === 'json') {
      const pretty = JSON.stringify(r, null, 2);
      f = {
        json:
          new TextEncoder().encode(pretty).length <= LIMITS.bytes
            ? pretty
            : JSON.stringify(r),
      };
    } else if (kind === 'person') {
      const p =
        original === null ? null : r.people.find((p) => p.id === original);
      if (original !== null && !p) throw new Error('Unknown person.');
      f = {
        name: p?.name ?? '',
        limit: String(p?.limit ?? Math.min(2, r.blocks.length)),
        skills: JSON.stringify(p?.skills ?? []),
      };
      for (const b of r.blocks)
        f['availability:' + b.id] =
          p?.availability.find((a) => a.blockId === b.id)?.status ?? 'no';
    } else if (kind === 'shift') {
      const s =
        original === null ? null : r.shifts.find((s) => s.id === original);
      if (original !== null && !s) throw new Error('Unknown shift.');
      if (blockId !== undefined && !r.blocks.some((b) => b.id === blockId))
        throw new Error('Unknown time block.');
      f = {
        label: s?.label ?? '',
        blockId: s?.blockId ?? blockId ?? r.blocks[0]?.id ?? '',
        needed: String(s?.needed ?? 1),
        skills: JSON.stringify(s?.skills ?? []),
      };
    } else if (kind === 'block') {
      const b =
        original === null ? null : r.blocks.find((b) => b.id === original);
      if (original !== null && !b) throw new Error('Unknown block.');
      const start =
        b?.start ??
        Math.max(540, ...r.blocks.map((b) => b.start + r.blockMinutes));
      f = {
        label: b?.label ?? '',
        start: start + r.blockMinutes <= 1440 ? time(start) : '',
      };
    } else if (kind === 'skill') {
      const s =
        original === null ? null : r.skills.find((s) => s.id === original);
      if (original !== null && !s) throw new Error('Unknown skill.');
      f = { label: s?.label ?? '' };
    } else
      f = {
        personId: r.people[0]?.id ?? '',
        shiftId: original ?? r.shifts[0]?.id ?? '',
      };
    this.update({
      draft: { kind, original, fields: f, initial: JSON.stringify(f) },
      error: '',
    });
  }
  field(key: string, value: string) {
    const d = this.state.draft;
    if (
      !d ||
      this.state.busy ||
      this.state.pending ||
      !Object.hasOwn(d.fields, key)
    )
      return;
    this.update({
      draft: { ...d, fields: { ...d.fields, [key]: value } },
      error: '',
    });
  }
  closeDraft() {
    const d = this.state.draft;
    if (!d || this.state.busy || this.state.pending) return;
    if (JSON.stringify(d.fields) !== d.initial)
      this.update({ pending: { kind: 'discard' } });
    else this.update({ draft: null, error: '' });
  }
  saveDraft() {
    const d = this.state.draft;
    if (!d || this.state.busy || this.state.pending)
      throw new Error('No editable draft is available.');
    const r = this.state.roster,
      f = d.fields,
      decimal = (v: string, min: number, max: number, label: string) => {
        if (!/^(0|[1-9][0-9]*)$/.test(v))
          throw new Error(label + ' needs a whole decimal number.');
        return integer(Number(v), min, max, label);
      };
    const nextId = (items: { id: string }[], prefix: string) => {
      let n = 1;
      while (items.some((x) => x.id === prefix + n)) n++;
      return prefix + n;
    };
    if (d.kind === 'json') {
      this.update({
        pending: { kind: 'replace', roster: parse(f.json) },
        error: '',
      });
      return;
    }
    if (d.kind === 'roster') {
      this.commit({
        ...r,
        title: f.title,
        notes: f.notes,
        blockMinutes: decimal(f.blockMinutes, 15, 240, 'Block length'),
      });
      return;
    }
    if (d.kind === 'lock') {
      this.commit({
        ...r,
        locks: [...r.locks, { personId: f.personId, shiftId: f.shiftId }],
      });
      return;
    }
    if (d.kind === 'person') {
      const p: Person = {
        id: d.original ?? nextId(r.people, 'p'),
        name: f.name,
        limit: decimal(f.limit, 0, 12, 'Assignment limit'),
        skills: JSON.parse(f.skills),
        availability: r.blocks.map((b) => ({
          blockId: b.id,
          status: f[
            'availability:' + b.id
          ] as Person['availability'][number]['status'],
        })),
      };
      this.commit({
        ...r,
        people:
          d.original === null
            ? [...r.people, p]
            : r.people.map((v) => (v.id === d.original ? p : v)),
      });
      return;
    }
    if (d.kind === 'shift') {
      const s: Shift = {
        id: d.original ?? nextId(r.shifts, 's'),
        label: f.label,
        blockId: f.blockId,
        needed: decimal(f.needed, 1, 32, 'Required headcount'),
        skills: JSON.parse(f.skills),
      };
      this.commit({
        ...r,
        shifts:
          d.original === null
            ? [...r.shifts, s]
            : r.shifts.map((v) => (v.id === d.original ? s : v)),
      });
      return;
    }
    if (d.kind === 'block') {
      const b: Block = {
        id: d.original ?? nextId(r.blocks, 'b'),
        label: f.label,
        start: parseTime(f.start),
      };
      this.commit({
        ...r,
        blocks:
          d.original === null
            ? [...r.blocks, b]
            : r.blocks.map((v) => (v.id === d.original ? b : v)),
        people:
          d.original === null
            ? r.people.map((p) => ({
                ...p,
                availability: [
                  ...p.availability,
                  { blockId: b.id, status: 'no' },
                ],
              }))
            : r.people,
      });
      return;
    }
    const s = { id: d.original ?? nextId(r.skills, 'k'), label: f.label };
    this.commit({
      ...r,
      skills:
        d.original === null
          ? [...r.skills, s]
          : r.skills.map((v) => (v.id === d.original ? s : v)),
    });
  }
  requestDelete(entity: 'person' | 'shift' | 'block' | 'skill', id: string) {
    this.guard();
    const r = this.state.roster,
      list =
        entity === 'person'
          ? r.people
          : entity === 'shift'
            ? r.shifts
            : entity === 'block'
              ? r.blocks
              : r.skills;
    if (!list.some((v) => v.id === id)) throw new Error('Unknown item.');
    if (
      entity === 'skill' &&
      (r.people.some((p) => p.skills.includes(id)) ||
        r.shifts.some((s) => s.skills.includes(id)))
    )
      throw new Error(
        'This skill is in use. Remove it from people and role requirements before deleting it.',
      );
    this.update({ pending: { kind: 'delete', entity, id }, error: '' });
  }
  dismiss() {
    this.update({ pending: null, error: '' });
  }
  confirm() {
    const p = this.state.pending,
      r = this.state.roster;
    if (!p || this.state.busy) throw new Error('No confirmation is pending.');
    if (p.kind === 'discard') {
      this.update({ draft: null, pending: null, error: '' });
      return;
    }
    if (p.kind === 'replace') {
      this.commit(p.roster);
      return;
    }
    if (p.kind === 'unlock') {
      this.commit({
        ...r,
        locks: r.locks.filter(
          (a) => assignmentKey(a) !== assignmentKey(p.assignment),
        ),
      });
      return;
    }
    if (p.entity === 'person') {
      this.commit({
        ...r,
        people: r.people.filter((v) => v.id !== p.id),
        locks: r.locks.filter((a) => a.personId !== p.id),
      });
      return;
    }
    if (p.entity === 'shift') {
      this.commit({
        ...r,
        shifts: r.shifts.filter((v) => v.id !== p.id),
        locks: r.locks.filter((a) => a.shiftId !== p.id),
      });
      return;
    }
    if (p.entity === 'skill') {
      this.commit({ ...r, skills: r.skills.filter((v) => v.id !== p.id) });
      return;
    }
    const removed = new Set(
      r.shifts.filter((s) => s.blockId === p.id).map((s) => s.id),
    );
    this.commit({
      ...r,
      blocks: r.blocks.filter((b) => b.id !== p.id),
      people: r.people.map((v) => ({
        ...v,
        availability: v.availability.filter((a) => a.blockId !== p.id),
      })),
      shifts: r.shifts.filter((s) => !removed.has(s.id)),
      locks: r.locks.filter((a) => !removed.has(a.shiftId)),
    });
  }
  lock(a: Assignment, revision?: number) {
    this.guard(revision);
    this.commit({
      ...this.state.roster,
      locks: [...this.state.roster.locks, a],
    });
  }
  requestUnlock(a: Assignment) {
    this.guard();
    if (
      !this.state.roster.locks.some(
        (v) => assignmentKey(v) === assignmentKey(a),
      )
    )
      throw new Error('This assignment is not locked.');
    this.update({ pending: { kind: 'unlock', assignment: a }, error: '' });
  }
  inspect(id: string, revision?: number) {
    this.guard(revision);
    if (!this.state.roster.shifts.some((s) => s.id === id))
      throw new Error('Unknown shift.');
    this.update({ selectedShift: id, error: '' });
  }
  async importFile(file: { size: number; text: () => Promise<string> }) {
    this.guard();
    if (
      !Number.isSafeInteger(file.size) ||
      file.size < 0 ||
      file.size > LIMITS.bytes
    )
      throw new Error('Choose roster JSON no larger than 128 KiB.');
    const ticket = ++this.ticket;
    this.update({ busy: 'file', progress: 'Reading local roster…', error: '' });
    try {
      const roster = parse(await file.text());
      if (ticket === this.ticket)
        this.update({ pending: { kind: 'replace', roster } });
    } catch (e) {
      if (ticket === this.ticket) this.error(e);
    } finally {
      if (ticket === this.ticket) this.update({ busy: null, progress: '' });
    }
  }
  async plan(revision?: number) {
    this.guard(revision);
    if (!this.runner)
      throw new Error('The workspace is still starting. Try again shortly.');
    const ticket = ++this.ticket;
    this.update({
      busy: 'plan',
      progress: 'Finding maximum eligible coverage…',
      error: '',
    });
    try {
      const result = await this.runner.run(
        this.state.roster,
        (filled, total) => {
          if (ticket === this.ticket)
            this.update({
              progress:
                filled +
                ' / ' +
                total +
                ' positions matched; balancing and certifying…',
            });
        },
      );
      if (ticket !== this.ticket)
        throw new Error('This planning operation was cancelled.');
      this.update({
        result,
        message:
          'Draft plan complete for revision ' +
          this.state.revision +
          '. ' +
          result.covered +
          ' of ' +
          result.required +
          ' positions filled. Review with the team before using it.',
      });
    } catch (e) {
      if (ticket === this.ticket) this.error(e);
      throw e;
    } finally {
      if (ticket === this.ticket) this.update({ busy: null, progress: '' });
    }
  }
  cancel() {
    this.ticket++;
    this.runner?.cancel();
    this.update({
      busy: null,
      progress: '',
      error: '',
      message: 'Operation cancelled. Previous roster and plan remain.',
    });
  }
  read() {
    const s = this.state,
      r = s.result;
    return {
      revision: s.revision,
      roster: s.roster,
      selectedShift: s.selectedShift,
      busy: s.busy,
      draftOpen: !!s.draft,
      confirmationOpen: !!s.pending,
      result: r
        ? {
            engine: r.engine,
            required: r.required,
            covered: r.covered,
            unfilled: r.unfilled,
            loadSquare: r.loadSquare,
            preferencePenalty: r.preferencePenalty,
            assignments: r.assignments,
            loads: r.loads,
            shiftCoverage: r.shiftCoverage,
            certificate: {
              lockedCount: r.lockedCount,
              cutCapacity: r.certificate.cutCapacity,
              cost: r.certificate.cost,
              dualBound: r.certificate.dualBound,
              minimumReducedCost: r.certificate.minimumReducedCost,
            },
          }
        : null,
      error: s.error,
      message: s.message,
    };
  }
}
