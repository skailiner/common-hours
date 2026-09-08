import {
  validate,
  eligible,
  status,
  assignmentKey,
  checkAssignments,
  type Roster,
  type Assignment,
} from './roster.ts';
import {
  network,
  node,
  edge,
  minCostMaxFlow,
  certify,
  type Certificate,
} from './flow.ts';
const sorted = <T extends { id: string }>(values: T[]) =>
  [...values].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
export function buildNetwork(roster: Roster) {
  const g = network(),
    B = roster.shifts.reduce((s, v) => s + v.needed, 0) + 1,
    locked = checkAssignments(roster, roster.locks);
  const occupied = new Set(
    roster.locks.map(
      (a) =>
        a.personId +
        ':' +
        roster.shifts.find((s) => s.id === a.shiftId)!.blockId,
    ),
  );
  const personNodes = new Map<string, number>(),
    shiftNodes = new Map<string, number>(),
    assignmentEdges: { index: number; assignment: Assignment }[] = [];
  for (const p of sorted(roster.people)) {
    const v = node(g, 'person:' + p.id);
    personNodes.set(p.id, v);
    const count = locked.loads.get(p.id) ?? 0;
    for (let k = 1; k <= p.limit - count; k++)
      edge(g, g.source, v, 1, (2 * (count + k) - 1) * B, 'person-limit', p.id);
  }
  for (const s of sorted(roster.shifts)) {
    const v = node(g, 'shift:' + s.id);
    shiftNodes.set(s.id, v);
    edge(
      g,
      v,
      g.sink,
      s.needed - (locked.filled.get(s.id) ?? 0),
      0,
      'shift-demand',
      s.id,
    );
  }
  for (const p of sorted(roster.people))
    for (const b of sorted(roster.blocks)) {
      if (status(p, b.id) === 'no' || occupied.has(p.id + ':' + b.id)) continue;
      const v = node(g, 'block:' + p.id + ':' + b.id);
      edge(
        g,
        personNodes.get(p.id)!,
        v,
        1,
        0,
        'one-per-block',
        p.id + ':' + b.id,
      );
      for (const s of sorted(roster.shifts))
        if (s.blockId === b.id && eligible(p, s)) {
          const a = { personId: p.id, shiftId: s.id },
            index = edge(
              g,
              v,
              shiftNodes.get(s.id)!,
              1,
              status(p, b.id) === 'preferred' ? 0 : 1,
              'eligibility',
              assignmentKey(a),
            );
          assignmentEdges.push({ index, assignment: a });
        }
    }
  return { g, B, assignmentEdges, locked };
}
export type Schedule = {
  engine: 'common-hours-flow-v1';
  assignments: Assignment[];
  required: number;
  covered: number;
  unfilled: number;
  loadSquare: number;
  preferencePenalty: number;
  weightedObjective: number;
  loads: { personId: string; count: number; limit: number }[];
  shiftCoverage: { shiftId: string; assigned: number; needed: number }[];
  certificate: Certificate;
  weight: number;
  lockedCount: number;
};
export function evaluate(roster: Roster, assignments: Assignment[]) {
  const checked = checkAssignments(roster, assignments),
    keys = new Set(assignments.map(assignmentKey));
  if (roster.locks.some((a) => !keys.has(assignmentKey(a))))
    throw new Error('A locked assignment was removed.');
  const loadSquare = roster.people.reduce(
    (s, p) => s + (checked.loads.get(p.id) ?? 0) ** 2,
    0,
  );
  const preferencePenalty = assignments.reduce((sum, a) => {
    const p = roster.people.find((p) => p.id === a.personId)!,
      shift = roster.shifts.find((s) => s.id === a.shiftId)!;
    return sum + (status(p, shift.blockId) === 'preferred' ? 0 : 1);
  }, 0);
  return { ...checked, loadSquare, preferencePenalty };
}
export function schedule(
  input: unknown,
  progress?: (filled: number, total: number) => void,
): Schedule {
  const roster = validate(input),
    { g, B, assignmentEdges, locked } = buildNetwork(roster),
    required = B - 1;
  const solved = minCostMaxFlow(g, (flow) =>
    progress?.(flow + roster.locks.length, required),
  );
  const assignments = [
    ...roster.locks,
    ...assignmentEdges
      .filter((a) => g.edges[a.index].remaining === 0)
      .map((a) => a.assignment),
  ].sort((a, b) =>
    assignmentKey(a) < assignmentKey(b)
      ? -1
      : assignmentKey(a) > assignmentKey(b)
        ? 1
        : 0,
  );
  const scores = evaluate(roster, assignments),
    lockedPreference = evaluate(roster, roster.locks).preferencePenalty;
  const lockedSquare = roster.people.reduce(
    (s, p) => s + (locked.loads.get(p.id) ?? 0) ** 2,
    0,
  );
  if (
    assignments.length !== solved.flow + roster.locks.length ||
    B * (scores.loadSquare - lockedSquare) +
      scores.preferencePenalty -
      lockedPreference !==
      solved.cost
  )
    throw new Error('Assignment and flow objectives disagree.');
  const certificate = certify(g, solved.flow, solved.cost);
  const result: Schedule = {
    engine: 'common-hours-flow-v1',
    assignments,
    required,
    covered: assignments.length,
    unfilled: required - assignments.length,
    loadSquare: scores.loadSquare,
    preferencePenalty: scores.preferencePenalty,
    weightedObjective: B * scores.loadSquare + scores.preferencePenalty,
    loads: roster.people.map((p) => ({
      personId: p.id,
      count: scores.loads.get(p.id) ?? 0,
      limit: p.limit,
    })),
    shiftCoverage: roster.shifts.map((s) => ({
      shiftId: s.id,
      assigned: scores.filled.get(s.id) ?? 0,
      needed: s.needed,
    })),
    certificate,
    weight: B,
    lockedCount: roster.locks.length,
  };
  progress?.(result.covered, required);
  return result;
}
// Verify a purported plan independently of its claimed scores by reconstructing its complete residual network.
export function verifySchedule(input: unknown, result: Schedule) {
  const roster = validate(input),
    scores = evaluate(roster, result.assignments),
    { g, B, assignmentEdges, locked } = buildNetwork(roster),
    lockedKeys = new Set(roster.locks.map(assignmentKey)),
    keys = new Set(
      result.assignments
        .filter((a) => !lockedKeys.has(assignmentKey(a)))
        .map(assignmentKey),
    );
  const send = (index: number, amount: number) => {
    const e = g.edges[index];
    if (amount > e.capacity)
      throw new Error('Certificate flow exceeds capacity.');
    e.remaining -= amount;
    g.edges[e.reverse].remaining += amount;
  };
  const personExtra = new Map<string, number>(),
    blockExtra = new Map<string, number>(),
    shiftExtra = new Map<string, number>();
  for (const a of assignmentEdges)
    if (keys.has(assignmentKey(a.assignment))) {
      send(a.index, 1);
      const { personId, shiftId } = a.assignment,
        b = roster.shifts.find((s) => s.id === shiftId)!.blockId;
      personExtra.set(personId, (personExtra.get(personId) ?? 0) + 1);
      blockExtra.set(personId + ':' + b, 1);
      shiftExtra.set(shiftId, (shiftExtra.get(shiftId) ?? 0) + 1);
    }
  for (let i = 0; i < g.edges.length; i += 2) {
    const e = g.edges[i];
    if (e.kind === 'person-limit') {
      const remaining = personExtra.get(e.key) ?? 0;
      if (remaining > 0) {
        send(i, 1);
        personExtra.set(e.key, remaining - 1);
      }
    } else if (e.kind === 'one-per-block') send(i, blockExtra.get(e.key) ?? 0);
    else if (e.kind === 'shift-demand') send(i, shiftExtra.get(e.key) ?? 0);
  }
  const lockedSquare = roster.people.reduce(
      (s, p) => s + (locked.loads.get(p.id) ?? 0) ** 2,
      0,
    ),
    lockedPenalty = evaluate(roster, roster.locks).preferencePenalty;
  const cost =
      B * (scores.loadSquare - lockedSquare) +
      scores.preferencePenalty -
      lockedPenalty,
    flow = result.assignments.length - roster.locks.length;
  const proof = certify(g, flow, cost);
  if (
    result.engine !== 'common-hours-flow-v1' ||
    result.required !== B - 1 ||
    result.covered !== result.assignments.length ||
    result.unfilled !== B - 1 - result.covered ||
    result.loadSquare !== scores.loadSquare ||
    result.preferencePenalty !== scores.preferencePenalty ||
    result.weightedObjective !==
      B * scores.loadSquare + scores.preferencePenalty ||
    result.weight !== B ||
    result.lockedCount !== roster.locks.length
  )
    throw new Error('Reported schedule scores are inconsistent.');
  const loads = roster.people.map((p) => ({
      personId: p.id,
      count: scores.loads.get(p.id) ?? 0,
      limit: p.limit,
    })),
    coverage = roster.shifts.map((s) => ({
      shiftId: s.id,
      assigned: scores.filled.get(s.id) ?? 0,
      needed: s.needed,
    }));
  if (
    JSON.stringify(result.loads) !== JSON.stringify(loads) ||
    JSON.stringify(result.shiftCoverage) !== JSON.stringify(coverage) ||
    JSON.stringify(result.certificate) !== JSON.stringify(proof)
  )
    throw new Error(
      'Reported details or certificate do not match the reconstructed plan.',
    );
  return proof;
}
