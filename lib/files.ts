import { validate, time, LIMITS, type Roster } from './roster.ts';
import { verifySchedule, type Schedule } from './scheduler.ts';
export function rosterJSON(input: Roster) {
  const text = JSON.stringify(validate(input));
  if (new TextEncoder().encode(text).length > LIMITS.bytes)
    throw new Error('Roster exceeds the backup size limit.');
  return text + '\n';
}
export function reportJSON(input: Roster, result: Schedule) {
  const roster = validate(input);
  verifySchedule(roster, result);
  return (
    JSON.stringify(
      {
        format: 'common-hours-certificate-v1',
        roster,
        result,
        notice:
          'Draft plan, not a confirmed staffing agreement. Optimal only under the stated constraints, locks and objective.',
      },
      null,
      2,
    ) + '\n'
  );
}
export function csvCell(value: string | number) {
  let text = String(value);
  if (/^[\s]*[=+\-@]/.test(text) || /^[\t\r\n]/.test(text)) text = "'" + text;
  return '"' + text.replaceAll('"', '""') + '"';
}
export function scheduleCSV(input: Roster, result: Schedule) {
  const r = validate(input);
  verifySchedule(r, result);
  const rows: (string | number)[][] = [
    [
      'block',
      'start',
      'end',
      'role',
      'person',
      'assignment',
      'availability',
      'filled',
      'needed',
    ],
  ];
  for (const block of [...r.blocks].sort((a, b) => a.start - b.start))
    for (const shift of r.shifts.filter((s) => s.blockId === block.id)) {
      const assigned = result.assignments.filter((a) => a.shiftId === shift.id);
      for (let i = 0; i < shift.needed; i++) {
        const a = assigned[i],
          p = a ? r.people.find((p) => p.id === a.personId)! : null;
        rows.push([
          block.label,
          time(block.start),
          time(block.start + r.blockMinutes),
          shift.label,
          p?.name ?? '',
          a
            ? r.locks.some(
                (l) => l.personId === a.personId && l.shiftId === a.shiftId,
              )
              ? 'locked'
              : 'draft'
            : 'unfilled',
          p?.availability.find((v) => v.blockId === block.id)?.status ?? '',
          assigned.length,
          shift.needed,
        ]);
      }
    }
  return rows.map((row) => row.map(csvCell).join(',')).join('\r\n') + '\r\n';
}
export function download(name: string, text: string, mime: string) {
  const url = URL.createObjectURL(new Blob([text], { type: mime }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
