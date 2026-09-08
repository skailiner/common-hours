import { validate, status, eligible, time, type Roster } from './roster.ts';
import { verifySchedule, type Schedule } from './scheduler.ts';

export type GapReview = {
  shiftId: string;
  role: string;
  block: string;
  start: string;
  missing: number;
  eligiblePeople: number;
  unavailable: number;
  missingSkills: number;
  atLimit: number;
  occupied: number;
  nextStep: string;
};

export function personLabel(roster: Roster, personId: string) {
  const person = roster.people.find((p) => p.id === personId);
  if (!person) throw new Error('Unknown person.');
  // Every label ends with its unique ID, including names that look like labels.
  return `${person.name} [${person.id}]`;
}

/** Describe the verified draft, without claiming a unique cause or a safe fix. */
export function reviewPlan(input: Roster, plan: Schedule) {
  const r = validate(input);
  verifySchedule(r, plan);
  const gaps: GapReview[] = [];
  let fullyStaffed = 0;
  let partlyStaffed = 0;
  let emptyRoles = 0;
  for (const block of [...r.blocks].sort((a, b) => a.start - b.start)) {
    for (const role of r.shifts.filter((s) => s.blockId === block.id)) {
      const filled = plan.assignments.filter(
        (a) => a.shiftId === role.id,
      ).length;
      if (filled === role.needed) {
        fullyStaffed++;
        continue;
      }
      if (filled) partlyStaffed++;
      else emptyRoles++;
      const gap: GapReview = {
        shiftId: role.id,
        role: role.label,
        block: block.label,
        start: time(block.start),
        missing: role.needed - filled,
        eligiblePeople: r.people.filter((p) => eligible(p, role)).length,
        unavailable: 0,
        missingSkills: 0,
        atLimit: 0,
        occupied: 0,
        nextStep: '',
      };
      // Each unassigned person appears in one bucket. Order is explanatory,
      // not causal: a person can have more than one real-world constraint.
      for (const person of r.people) {
        if (
          plan.assignments.some(
            (a) => a.personId === person.id && a.shiftId === role.id,
          )
        )
          continue;
        if (status(person, block.id) === 'no') gap.unavailable++;
        else if (!eligible(person, role)) gap.missingSkills++;
        else if (
          plan.assignments.filter((a) => a.personId === person.id).length >=
          person.limit
        )
          gap.atLimit++;
        else if (
          plan.assignments.some(
            (a) =>
              a.personId === person.id &&
              r.shifts.find((s) => s.id === a.shiftId)!.blockId === block.id,
          )
        )
          gap.occupied++;
        else
          throw new Error(
            'A verified maximum-coverage draft has an unexplained directly fillable gap.',
          );
      }
      gap.nextStep =
        gap.eligiblePeople < role.needed
          ? 'Check the declared availability and required skills. If they are correct, discuss recruiting suitable people or reducing the activity; do not weaken a real requirement just to fill the rota.'
          : 'Suitable people exist, but their limits, simultaneous roles or fixed assignments compete. Inspect this role with the team; any agreed change needs a new plan and may move a gap elsewhere.';
      gaps.push(gap);
    }
  }
  const people = r.people.map((p) => {
    const assignments = plan.assignments.filter((a) => a.personId === p.id);
    return {
      id: p.id,
      name: personLabel(r, p.id),
      count: assignments.length,
      limit: p.limit,
      minutes: assignments.length * r.blockMinutes,
      nonpreferred: assignments.filter(
        (a) =>
          status(p, r.shifts.find((s) => s.id === a.shiftId)!.blockId) !==
          'preferred',
      ).length,
    };
  });
  return {
    fullyStaffed,
    partlyStaffed,
    emptyRoles,
    gaps,
    people,
    atLimit: people.filter((p) => p.count === p.limit).length,
    headline: !plan.required
      ? 'Add the work your event needs.'
      : plan.unfilled
        ? `${plan.unfilled} ${plan.unfilled === 1 ? 'position needs' : 'positions need'} a team decision.`
        : 'Every requested position has a draft assignment.',
  };
}

/** Plain text is portable and does not execute user-authored markup. */
export function teamBrief(input: Roster, plan: Schedule) {
  const r = validate(input);
  const review = reviewPlan(r, plan);
  const lines = [
    r.title,
    'COMMON HOURS | DRAFT FOR TEAM REVIEW',
    '',
    'Not a confirmed staffing agreement. Ask each person to confirm availability and suitability.',
    'Single local day; no calendar date or time zone is recorded. Add those details when sharing.',
    '',
    'AT A GLANCE',
    `${plan.covered} of ${plan.required} positions assigned; ${plan.unfilled} unfilled.`,
    `${review.fullyStaffed} fully staffed roles; ${review.partlyStaffed} partly staffed; ${review.emptyRoles} empty.`,
    'A partly staffed role may not be operational.',
    '',
    'ROTA',
  ];
  for (const block of [...r.blocks].sort((a, b) => a.start - b.start)) {
    lines.push(
      '',
      `${time(block.start)}-${time(block.start + r.blockMinutes)} | ${block.label}`,
    );
    for (const role of r.shifts.filter((s) => s.blockId === block.id)) {
      const assignments = plan.assignments.filter((a) => a.shiftId === role.id);
      lines.push(`  ${role.label} (${assignments.length}/${role.needed})`);
      for (const a of assignments) {
        const person = r.people.find((p) => p.id === a.personId)!;
        const fixed = r.locks.some(
          (l) => l.personId === a.personId && l.shiftId === a.shiftId,
        );
        lines.push(
          `    ${personLabel(r, person.id)}${fixed ? ' [fixed assignment, not confirmed consent]' : ' [draft]'}`,
        );
      }
      if (assignments.length < role.needed)
        lines.push(`    UNFILLED: ${role.needed - assignments.length}`);
    }
  }
  lines.push('', 'WORKLOAD TO DISCUSS');
  for (const p of review.people) {
    lines.push(
      `${p.name}: ${p.count}/${p.limit} assignments, ${p.minutes} minutes; ${p.nonpreferred} available-but-not-preferred assignments.`,
    );
  }
  if (review.gaps.length) {
    lines.push('', 'UNRESOLVED COVERAGE');
    for (const g of review.gaps)
      lines.push(
        `${g.start} ${g.block} / ${g.role}: ${g.missing} unfilled. ${g.nextStep}`,
      );
  }
  lines.push(
    '',
    'EVENT NOTES',
    r.notes || 'No event notes recorded.',
    '',
    'BEFORE USING THIS PLAN',
    'Confirm people, real qualifications and the full headcount needed for each activity.',
    'Check breaks, fatigue, supervision, travel and applicable requirements separately.',
    'Review available-but-not-preferred assignments. Do not pressure anyone to raise a limit.',
    'After changing the roster, create a new draft; this exported copy will not update.',
    'Share names and availability only with permission. Keep a roster JSON backup for editing.',
    '',
    'Created with Common Hours: https://skailiner-common-hours.static.hf.space/index.html',
  );
  return lines.join('\n') + '\n';
}
