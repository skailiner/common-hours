export type Named = { id: string; label: string };
export type Block = Named & { start: number };
export type Availability = {
  blockId: string;
  status: 'no' | 'yes' | 'preferred';
};
export type Person = {
  id: string;
  name: string;
  skills: string[];
  limit: number;
  availability: Availability[];
};
export type Shift = {
  id: string;
  label: string;
  blockId: string;
  skills: string[];
  needed: number;
};
export type Assignment = { personId: string; shiftId: string };
export type Roster = {
  version: 1;
  title: string;
  notes: string;
  blockMinutes: number;
  blocks: Block[];
  skills: Named[];
  people: Person[];
  shifts: Shift[];
  locks: Assignment[];
};
export const LIMITS = {
  bytes: 131072,
  people: 32,
  blocks: 12,
  shifts: 48,
  skills: 16,
  demand: 128,
};
export function object(
  input: unknown,
  keys: readonly string[],
  label = 'Input',
): Record<string, unknown> {
  if (
    !input ||
    typeof input !== 'object' ||
    Array.isArray(input) ||
    Object.keys(input).some((k) => !keys.includes(k)) ||
    keys.some((k) => !Object.hasOwn(input, k))
  )
    throw new Error(label + ' has missing or unknown fields.');
  return input as Record<string, unknown>;
}
export function integer(
  v: unknown,
  min: number,
  max: number,
  label: string,
): number {
  if (typeof v !== 'number' || !Number.isSafeInteger(v) || v < min || v > max)
    throw new Error(
      label + ' must be an integer from ' + min + ' to ' + max + '.',
    );
  return v;
}
export function text(
  v: unknown,
  max: number,
  label: string,
  blank = false,
): string {
  if (
    typeof v !== 'string' ||
    v.length > max ||
    (!blank && !v.trim()) ||
    // Control characters are deliberately rejected at the import boundary.
    // eslint-disable-next-line no-control-regex
    /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(v) ||
    (!blank && /[\r\n\t]/.test(v))
  )
    throw new Error(
      label +
        ' must be ' +
        (blank ? '' : 'nonempty ') +
        'text of at most ' +
        max +
        ' characters, without control characters.',
    );
  for (let i = 0; i < v.length; i++) {
    const c = v.charCodeAt(i);
    if (c >= 0xd800 && c <= 0xdbff) {
      const next = v.charCodeAt(++i);
      if (!(next >= 0xdc00 && next <= 0xdfff))
        throw new Error(label + ' contains invalid Unicode.');
    } else if (c >= 0xdc00 && c <= 0xdfff)
      throw new Error(label + ' contains invalid Unicode.');
  }
  return v;
}
export function id(v: unknown): string {
  if (typeof v !== 'string' || !/^[A-Za-z][A-Za-z0-9_-]{0,23}$/.test(v))
    throw new Error(
      'IDs need 1–24 ASCII letters, digits, underscores or hyphens, starting with a letter.',
    );
  return v;
}
function array(v: unknown, max: number, label: string): unknown[] {
  if (
    !Array.isArray(v) ||
    v.length > max ||
    Array.from({ length: v.length }, (_, i) => i).some(
      (i) => !Object.hasOwn(v, i),
    )
  )
    throw new Error(
      label + ' must be a dense array with at most ' + max + ' entries.',
    );
  return v;
}
function unique<T>(values: T[], key: (v: T) => string, label: string) {
  if (new Set(values.map(key)).size !== values.length)
    throw new Error(label + ' contains duplicates.');
  return values;
}
export function status(person: Person, blockId: string) {
  return person.availability.find((a) => a.blockId === blockId)!.status;
}
export function eligible(person: Person, shift: Shift) {
  return (
    status(person, shift.blockId) !== 'no' &&
    shift.skills.every((s) => person.skills.includes(s))
  );
}
export function assignmentKey(a: Assignment) {
  return a.personId + ':' + a.shiftId;
}
export function validate(input: unknown): Roster {
  const o = object(
    input,
    [
      'version',
      'title',
      'notes',
      'blockMinutes',
      'blocks',
      'skills',
      'people',
      'shifts',
      'locks',
    ],
    'Roster',
  );
  if (o.version !== 1)
    throw new Error('Only Common Hours roster version 1 is supported.');
  const named = (value: unknown, max: number, label: string) =>
    unique(
      array(value, max, label).map((v) => {
        const q = object(v, ['id', 'label'], label);
        return { id: id(q.id), label: text(q.label, 60, label + ' label') };
      }),
      (v) => v.id,
      label,
    );
  const blockMinutes = integer(
    o.blockMinutes,
    15,
    240,
    'Equal block length in minutes',
  );
  const blocks = unique(
    array(o.blocks, LIMITS.blocks, 'Blocks').map((v) => {
      const b = object(v, ['id', 'label', 'start'], 'Block');
      return {
        id: id(b.id),
        label: text(b.label, 60, 'Block label'),
        start: integer(b.start, 0, 1440 - blockMinutes, 'Block start minute'),
      };
    }),
    (b) => b.id,
    'Blocks',
  );
  const chronological = [...blocks].sort((a, b) => a.start - b.start);
  for (let i = 1; i < chronological.length; i++)
    if (chronological[i].start < chronological[i - 1].start + blockMinutes)
      throw new Error(
        'Blocks must not overlap. Adjacent blocks may meet at the same end/start time.',
      );
  const skills = named(o.skills, LIMITS.skills, 'Skills');
  const refs = (value: unknown, allowed: Named[], label: string) =>
    unique(
      array(value, allowed.length, label).map((v) => {
        const k = id(v);
        if (!allowed.some((a) => a.id === k))
          throw new Error(label + ' references an unknown ID.');
        return k;
      }),
      (v) => v,
      label,
    );
  const people = unique(
    array(o.people, LIMITS.people, 'People').map((v) => {
      const q = object(
        v,
        ['id', 'name', 'skills', 'limit', 'availability'],
        'Person',
      );
      const availability = unique(
        array(q.availability, blocks.length, 'Availability').map((a) => {
          const b = object(a, ['blockId', 'status'], 'Availability'),
            blockId = id(b.blockId);
          if (
            !blocks.some((k) => k.id === blockId) ||
            !['no', 'yes', 'preferred'].includes(b.status as string)
          )
            throw new Error(
              'Availability needs a known block and no, yes or preferred.',
            );
          return { blockId, status: b.status as Availability['status'] };
        }),
        (a) => a.blockId,
        'Availability',
      );
      if (availability.length !== blocks.length)
        throw new Error(
          'Each person needs an availability choice for every block.',
        );
      return {
        id: id(q.id),
        name: text(q.name, 60, 'Person name'),
        skills: refs(q.skills, skills, 'Person skills'),
        limit: integer(q.limit, 0, LIMITS.blocks, 'Person assignment limit'),
        availability,
      };
    }),
    (p) => p.id,
    'People',
  );
  const shifts = unique(
    array(o.shifts, LIMITS.shifts, 'Shifts').map((v) => {
      const q = object(
          v,
          ['id', 'label', 'blockId', 'skills', 'needed'],
          'Shift',
        ),
        blockId = id(q.blockId);
      if (!blocks.some((b) => b.id === blockId))
        throw new Error('Shift references an unknown block.');
      return {
        id: id(q.id),
        label: text(q.label, 60, 'Shift label'),
        blockId,
        skills: refs(q.skills, skills, 'Required skills'),
        needed: integer(q.needed, 1, 32, 'Shift headcount'),
      };
    }),
    (s) => s.id,
    'Shifts',
  );
  if (shifts.reduce((s, a) => s + a.needed, 0) > LIMITS.demand)
    throw new Error('The roster may require at most 128 positions.');
  const locks = unique(
    array(o.locks, LIMITS.demand, 'Locks').map((v) => {
      const q = object(v, ['personId', 'shiftId'], 'Lock');
      return { personId: id(q.personId), shiftId: id(q.shiftId) };
    }),
    assignmentKey,
    'Locks',
  );
  const roster: Roster = {
    version: 1,
    title: text(o.title, 100, 'Roster title'),
    notes: text(o.notes, 2000, 'Notes', true),
    blockMinutes,
    blocks,
    skills,
    people,
    shifts,
    locks,
  };
  checkAssignments(roster, locks);
  return roster;
}
export function checkAssignments(roster: Roster, assignments: Assignment[]) {
  unique(assignments, assignmentKey, 'Assignments');
  const loads = new Map<string, number>(),
    filled = new Map<string, number>(),
    occupied = new Set<string>();
  for (const a of assignments) {
    const p = roster.people.find((p) => p.id === a.personId),
      s = roster.shifts.find((s) => s.id === a.shiftId);
    if (!p || !s)
      throw new Error('Assignment references an unknown person or shift.');
    if (!eligible(p, s))
      throw new Error(
        p.name +
          ' is unavailable or lacks a required skill for ' +
          s.label +
          '.',
      );
    const key = p.id + ':' + s.blockId;
    if (occupied.has(key))
      throw new Error(p.name + ' has two assignments in one block.');
    occupied.add(key);
    const load = (loads.get(p.id) ?? 0) + 1;
    loads.set(p.id, load);
    if (load > p.limit)
      throw new Error(p.name + ' exceeds their assignment limit.');
    const count = (filled.get(s.id) ?? 0) + 1;
    filled.set(s.id, count);
    if (count > s.needed)
      throw new Error(s.label + ' exceeds its required headcount.');
  }
  return { loads, filled };
}
export function parse(value: unknown): Roster {
  if (
    typeof value !== 'string' ||
    new TextEncoder().encode(value).length > LIMITS.bytes
  )
    throw new Error('Choose roster JSON no larger than 128 KiB.');
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new Error('This is not valid JSON.');
  }
  return validate(parsed);
}
export function example(): Roster {
  const blocks = [
    { id: 'setup', label: 'Set up', start: 540 },
    { id: 'open', label: 'Open doors', start: 600 },
    { id: 'finish', label: 'Final hour', start: 660 },
  ];
  const skills = [
    { id: 'welcome', label: 'Welcome' },
    { id: 'repair', label: 'Repair' },
    { id: 'textiles', label: 'Textiles' },
  ];
  const p = (
    id: string,
    name: string,
    sk: string[],
    av: Availability['status'][],
  ): Person => ({
    id,
    name,
    skills: sk,
    limit: 2,
    availability: blocks.map((b, i) => ({ blockId: b.id, status: av[i] })),
  });
  const s = (
    id: string,
    label: string,
    blockId: string,
    skill: string,
    needed = 1,
  ): Shift => ({ id, label, blockId, skills: [skill], needed });
  return validate({
    version: 1,
    title: 'Repair café · Saturday',
    notes:
      'Fictional people and declared skills. Confirm availability and suitable supervision with the team before using a plan.',
    blockMinutes: 60,
    blocks,
    skills,
    people: [
      p('ari', 'Ari', ['repair', 'welcome'], ['preferred', 'yes', 'no']),
      p('bea', 'Bea', ['textiles', 'welcome'], ['yes', 'preferred', 'yes']),
      p('cam', 'Cam', ['repair'], ['no', 'preferred', 'yes']),
      p('dev', 'Dev', ['welcome'], ['preferred', 'yes', 'no']),
      p('eli', 'Eli', ['repair', 'textiles'], ['yes', 'preferred', 'yes']),
      p('fran', 'Fran', ['textiles', 'welcome'], ['no', 'yes', 'preferred']),
    ],
    shifts: [
      s('setup-welcome', 'Welcome desk', 'setup', 'welcome'),
      s('setup-repair', 'Repair bench', 'setup', 'repair'),
      s('open-welcome', 'Welcome desk', 'open', 'welcome'),
      s('open-repair', 'Repair bench', 'open', 'repair', 2),
      s('open-textiles', 'Textile table', 'open', 'textiles'),
      s('finish-repair', 'Repair bench', 'finish', 'repair'),
      s('finish-textiles', 'Textile table', 'finish', 'textiles'),
    ],
    locks: [],
  });
}
export function blank(): Roster {
  return {
    version: 1,
    title: 'Untitled community rota',
    notes: '',
    blockMinutes: 60,
    blocks: [],
    skills: [],
    people: [],
    shifts: [],
    locks: [],
  };
}
export function time(minutes: number) {
  return (
    String(Math.floor(minutes / 60)).padStart(2, '0') +
    ':' +
    String(minutes % 60).padStart(2, '0')
  );
}
export function parseTime(value: string) {
  if (!/^(?:[01][0-9]|2[0-3]):[0-5][0-9]$/.test(value))
    throw new Error('Enter a start time as HH:MM from 00:00 to 23:59.');
  return Number(value.slice(0, 2)) * 60 + Number(value.slice(3));
}
