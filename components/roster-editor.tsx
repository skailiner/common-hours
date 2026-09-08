'use client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog';
import { time, type Roster } from '@/lib/roster';
import type { Workspace, Snapshot, DraftKind, Pending } from '@/lib/workspace';
const titles: Record<DraftKind, string> = {
  roster: 'Event details',
  person: 'Team member',
  shift: 'Role & headcount',
  block: 'Time block',
  skill: 'Skill label',
  json: 'Roster JSON',
  lock: 'Lock an assignment',
};
function confirmation(p: Pending | null, r: Roster) {
  if (!p) return '';
  if (p.kind === 'discard')
    return 'Discard unsaved changes in this editor? The committed roster will stay unchanged.';
  if (p.kind === 'replace')
    return (
      'Replace the whole roster and clear its current plan? Download a roster backup first if you want to keep it. The new roster is “' +
      p.roster.title +
      '”.'
    );
  if (p.kind === 'unlock')
    return 'Release this fixed assignment and clear the current plan? The next plan may assign this person elsewhere.';
  if (p.entity === 'block') {
    const ids = new Set(
      r.shifts.filter((s) => s.blockId === p.id).map((s) => s.id),
    );
    return (
      'Delete this time block, its ' +
      ids.size +
      ' roles, everyone’s availability for it, and ' +
      r.locks.filter((a) => ids.has(a.shiftId)).length +
      ' associated locks? The current plan will be cleared.'
    );
  }
  const count =
    p.entity === 'person'
      ? r.locks.filter((a) => a.personId === p.id).length
      : p.entity === 'shift'
        ? r.locks.filter((a) => a.shiftId === p.id).length
        : 0;
  return (
    'Delete this ' +
    (p.entity === 'shift' ? 'role' : p.entity) +
    ' and ' +
    count +
    ' associated locks? The current plan will be cleared. This cannot be undone without a backup.'
  );
}
export function RosterEditor({
  workspace: w,
  state: s,
}: {
  workspace: Workspace;
  state: Snapshot;
}) {
  const d = s.draft,
    r = s.roster,
    disabled = !!s.busy || !!s.pending;
  const attempt = (fn: () => void) => {
    try {
      fn();
    } catch (e) {
      w.error(e);
    }
  };
  const input = (
    key: string,
    label: string,
    hint = '',
    maxLength = 60,
    type = 'text',
  ) => (
    <div className="field">
      <label htmlFor={'edit-' + key}>{label}</label>
      <Input
        id={'edit-' + key}
        type={type}
        maxLength={maxLength}
        value={d?.fields[key] ?? ''}
        onChange={(e) => w.field(key, e.target.value)}
        disabled={disabled}
      />
      {hint && <p className="hint">{hint}</p>}
    </div>
  );
  const choice = (
    key: string,
    label: string,
    items: { value: string; label: string }[],
  ) => (
    <div className="field">
      <label id={'label-' + key} htmlFor={'edit-' + key}>
        {label}
      </label>
      <Select
        value={d?.fields[key] || null}
        items={items}
        disabled={disabled}
        onValueChange={(v) => {
          if (typeof v === 'string') w.field(key, v);
        }}
      >
        <SelectTrigger
          id={'edit-' + key}
          aria-labelledby={'label-' + key}
          className="w-full"
        >
          <SelectValue placeholder="Choose…" />
        </SelectTrigger>
        <SelectContent>
          {items.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
  const skills = () => {
    const selected = JSON.parse(d?.fields.skills ?? '[]') as string[];
    return (
      <fieldset className="skill-picker" disabled={disabled}>
        <legend>
          {d?.kind === 'person'
            ? 'Declared skills'
            : 'Every assigned person must have all checked skills'}
        </legend>
        {r.skills.map((k) => (
          <label key={k.id}>
            <Checkbox
              checked={selected.includes(k.id)}
              disabled={disabled}
              onCheckedChange={(checked) =>
                w.field(
                  'skills',
                  JSON.stringify(
                    checked
                      ? [...selected, k.id]
                      : selected.filter((id) => id !== k.id),
                  ),
                )
              }
            />
            {k.label}
          </label>
        ))}
        {!r.skills.length && (
          <p className="hint">No skill labels yet. Add them below the rota.</p>
        )}
        <p className="hint">
          No checked skills means no skill restriction. Declarations are not
          verified qualifications.
        </p>
      </fieldset>
    );
  };
  return (
    <>
      <Sheet
        open={!!d}
        onOpenChange={(open) => {
          if (!open) w.closeDraft();
        }}
      >
        <SheetContent className="editor-sheet" showCloseButton={false}>
          <SheetHeader>
            <SheetTitle>{d ? titles[d.kind] : 'Edit roster'}</SheetTitle>
            <SheetDescription>
              Changes apply only after saving. Invalid changes leave the roster
              intact.
            </SheetDescription>
          </SheetHeader>
          {d && (
            <form
              className="editor-form"
              onSubmit={(e) => {
                e.preventDefault();
                attempt(() => w.saveDraft());
              }}
            >
              <fieldset disabled={disabled}>
                {d.kind === 'roster' && (
                  <>
                    {input('title', 'Event name', '', 100)}
                    {input(
                      'blockMinutes',
                      'Minutes per block',
                      '15–240 minutes; all blocks have equal duration. Changes must not create overlaps.',
                      3,
                    )}
                    <div className="field">
                      <label htmlFor="edit-notes">Notes</label>
                      <Textarea
                        id="edit-notes"
                        maxLength={2000}
                        value={d.fields.notes}
                        onChange={(e) => w.field('notes', e.target.value)}
                      />
                    </div>
                  </>
                )}
                {d.kind === 'person' && (
                  <>
                    {input('name', 'Name')}
                    {input(
                      'limit',
                      'Maximum assignments',
                      '0–12 across the whole event. Zero keeps this person unassigned.',
                      2,
                    )}
                    {skills()}
                    <h3>Availability</h3>
                    <p className="hint">
                      A new block starts as unavailable for everyone. Preferred
                      is a soft preference, not a guarantee.
                    </p>
                    {[...r.blocks]
                      .sort((a, b) => a.start - b.start)
                      .map((b) => (
                        <div key={b.id}>
                          {choice(
                            'availability:' + b.id,
                            b.label +
                              ' · ' +
                              time(b.start) +
                              '–' +
                              time(b.start + r.blockMinutes),
                            [
                              { value: 'no', label: 'Unavailable' },
                              { value: 'yes', label: 'Available' },
                              { value: 'preferred', label: 'Preferred' },
                            ],
                          )}
                        </div>
                      ))}
                  </>
                )}
                {d.kind === 'shift' && (
                  <>
                    {input('label', 'Role name')}
                    {choice(
                      'blockId',
                      'Time block',
                      r.blocks.map((b) => ({
                        value: b.id,
                        label: b.label + ' · ' + time(b.start),
                      })),
                    )}
                    {input(
                      'needed',
                      'People needed',
                      '1–32; no more than 128 positions across the event.',
                      2,
                    )}
                    {skills()}
                  </>
                )}
                {d.kind === 'block' && (
                  <>
                    {input('label', 'Block name')}
                    {input(
                      'start',
                      'Starts at',
                      '24-hour local time, HH:MM. Same-day blocks must not overlap.',
                      5,
                    )}
                    <p className="hint">
                      Each block lasts {r.blockMinutes} minutes. No overnight,
                      travel, breaks or time-zone adjustments are modeled.
                    </p>
                  </>
                )}
                {d.kind === 'skill' && (
                  <>
                    {input('label', 'Skill name')}
                    <p className="hint">
                      A skill is a declared eligibility label. It does not
                      certify training or safe supervision.
                    </p>
                  </>
                )}
                {d.kind === 'lock' && (
                  <>
                    {choice(
                      'personId',
                      'Person',
                      r.people.map((p) => ({ value: p.id, label: p.name })),
                    )}
                    {choice(
                      'shiftId',
                      'Role',
                      r.shifts.map((v) => ({
                        value: v.id,
                        label:
                          v.label +
                          ' · ' +
                          r.blocks.find((b) => b.id === v.blockId)!.label,
                      })),
                    )}
                    <p className="hint">
                      A lock fixes this assignment in every new plan. It must
                      satisfy skills, availability, headcount and workload
                      limits. Saving clears the old plan; create a new one
                      afterward.
                    </p>
                  </>
                )}
                {d.kind === 'json' && (
                  <div className="field">
                    <label htmlFor="edit-json">Complete version 1 roster</label>
                    <Textarea
                      id="edit-json"
                      className="json-editor"
                      spellCheck={false}
                      value={d.fields.json}
                      onChange={(e) => w.field('json', e.target.value)}
                    />
                    <p className="hint">
                      Maximum 128 KiB. Unknown fields, incomplete availability
                      and conflicting locks are rejected. Saving asks before
                      replacing the roster.
                    </p>
                  </div>
                )}
              </fieldset>
              {s.error && (
                <p className="error" role="alert">
                  {s.error}
                </p>
              )}
              <div className="form-actions">
                <Button type="submit" disabled={disabled}>
                  {d.kind === 'json'
                    ? 'Review replacement'
                    : d.kind === 'lock'
                      ? 'Save lock'
                      : 'Save changes'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={disabled}
                  onClick={() => w.closeDraft()}
                >
                  Cancel
                </Button>
              </div>
            </form>
          )}
        </SheetContent>
      </Sheet>
      <AlertDialog
        open={!!s.pending}
        onOpenChange={(open) => {
          if (!open) w.dismiss();
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {s.pending?.kind === 'discard'
                ? 'Discard edits?'
                : 'Confirm roster change'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmation(s.pending, r)}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {s.error && (
            <p className="error" role="alert">
              {s.error}
            </p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>Keep current</AlertDialogCancel>
            <AlertDialogAction onClick={() => attempt(() => w.confirm())}>
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
