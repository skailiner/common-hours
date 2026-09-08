import test from 'node:test';
import assert from 'node:assert/strict';
import {
  blank,
  example,
  validate,
  parse,
  parseTime,
  time,
  checkAssignments,
  eligible,
  status,
} from '../lib/roster.ts';
import { schedule, verifySchedule } from '../lib/scheduler.ts';
import { network, node, edge, minCostMaxFlow, certify } from '../lib/flow.ts';
import { rosterJSON, reportJSON, scheduleCSV, csvCell } from '../lib/files.ts';
const copy = structuredClone;
function tiny(seed) {
  const r = blank();
  r.blocks = [
    { id: 'b0', label: 'First', start: 540 },
    { id: 'b1', label: 'Next', start: 600 },
  ];
  r.skills = [
    { id: 'x', label: 'X' },
    { id: 'y', label: 'Y' },
  ];
  r.people = Array.from({ length: 3 }, (_, i) => ({
    id: 'p' + i,
    name: 'Person ' + i,
    limit: (seed + i) % 3,
    skills: (seed >> (i + 2)) & 1 ? ['x', 'y'] : ['x'],
    availability: r.blocks.map((b, j) => ({
      blockId: b.id,
      status: ['no', 'yes', 'preferred'][(seed + i * 2 + j) % 3],
    })),
  }));
  r.shifts = Array.from({ length: 3 }, (_, i) => ({
    id: 's' + i,
    label: 'Role ' + i,
    blockId: r.blocks[i % 2].id,
    skills: [(seed >> i) & 1 ? 'x' : 'y'],
    needed: 1,
  }));
  return validate(r);
}
function oracle(r) {
  const possibilities = r.shifts
    .flatMap((s) =>
      r.people
        .filter((p) => eligible(p, s))
        .map((p) => ({ personId: p.id, shiftId: s.id })),
    )
    .filter(
      (a) =>
        !r.locks.some(
          (l) => l.personId === a.personId && l.shiftId === a.shiftId,
        ),
    );
  let best = null;
  function visit(i, a) {
    try {
      checkAssignments(r, a);
    } catch {
      return;
    }
    if (i === possibilities.length) {
      const loads = r.people.map(
          (p) => a.filter((v) => v.personId === p.id).length,
        ),
        penalty = a.reduce(
          (n, v) =>
            n +
            (status(
              r.people.find((p) => p.id === v.personId),
              r.shifts.find((s) => s.id === v.shiftId).blockId,
            ) === 'preferred'
              ? 0
              : 1),
          0,
        ),
        score = [-a.length, loads.reduce((n, v) => n + v * v, 0), penalty];
      if (
        !best ||
        score[0] < best[0] ||
        (score[0] === best[0] &&
          (score[1] < best[1] || (score[1] === best[1] && score[2] < best[2])))
      )
        best = score;
      return;
    }
    visit(i + 1, a);
    visit(i + 1, [...a, possibilities[i]]);
  }
  visit(0, r.locks);
  return best;
}
test('example has verified 8/8 coverage, square load12 and penalty2', () => {
  const r = example(),
    p = schedule(r);
  assert.deepEqual([p.covered, p.loadSquare, p.preferencePenalty], [8, 12, 2]);
  assert.equal(verifySchedule(r, p).dualBound, 110);
  assert.equal(p.certificate.cutCapacity, 8);
});
test('exhaustive feasible-assignment oracle, including locks, over 768 tiny rosters', () => {
  for (let i = 0; i < 384; i++) {
    const r = tiny(i),
      p = schedule(r);
    assert.deepEqual(
      [-p.covered, p.loadSquare, p.preferencePenalty],
      oracle(r),
    );
    verifySchedule(r, p);
    const locked = copy(r);
    if (p.assignments.length) locked.locks = [p.assignments[0]];
    const q = schedule(locked);
    assert.deepEqual(
      [-q.covered, q.loadSquare, q.preferencePenalty],
      oracle(locked),
    );
    verifySchedule(locked, q);
  }
});
test('input ordering does not change deterministic assignments or certificate', () => {
  for (let i = 0; i < 80; i++) {
    const r = tiny(i),
      p = schedule(r);
    r.people.reverse();
    r.blocks.reverse();
    r.shifts.reverse();
    r.skills.reverse();
    r.people.forEach((v) => {
      v.skills.reverse();
      v.availability.reverse();
    });
    const q = schedule(r);
    assert.deepEqual(q.assignments, p.assignments);
    assert.deepEqual(q.certificate, p.certificate);
  }
});
test('strict schema, time, Unicode, references and array boundaries', () => {
  const edits = [
    (r) => (r.version = 2),
    (r) => (r.extra = true),
    (r) => delete r.notes,
    (r) => (r.blockMinutes = 14),
    (r) => (r.blockMinutes = 241),
    (r) => (r.blocks[1].start = 599),
    (r) => (r.blocks[0].start = -1),
    (r) => (r.blocks[2].start = 1430),
    (r) => (r.people[0].limit = 1.2),
    (r) => (r.people[0].limit = 13),
    (r) => (r.people[0].name = ''),
    (r) => (r.people[0].name = '\ud800'),
    (r) => (r.people[0].name = 'bad\u0000'),
    (r) => r.people[0].availability.pop(),
    (r) => (r.people[0].availability[0].status = 'maybe'),
    (r) => (r.people[0].skills = ['unknown']),
    (r) => r.skills.push(r.skills[0]),
    (r) => (r.shifts[0].needed = 0),
    (r) => (r.shifts[0].blockId = 'missing'),
    (r) => delete r.people[1],
    (r) => (r.locks = [{ personId: 'missing', shiftId: 'open-welcome' }]),
  ];
  for (const edit of edits) {
    const r = example();
    edit(r);
    assert.throws(() => validate(r));
  }
  assert.equal(parseTime('23:59'), 1439);
  assert.equal(time(1440), '24:00');
  for (const text of ['24:00', '9:00', '12:60', ' 09:00'])
    assert.throws(() => parseTime(text));
  assert.throws(() => parse(' '.repeat(131073)));
  assert.throws(() => parse('{'));
  assert.deepEqual(parse(rosterJSON(example())), example());
});
test('lock conflicts are rejected atomically and skill requirements are not pooled', () => {
  const r = example();
  for (const locks of [
    [{ personId: 'ari', shiftId: 'finish-repair' }],
    [{ personId: 'dev', shiftId: 'setup-repair' }],
    [
      { personId: 'ari', shiftId: 'setup-repair' },
      { personId: 'ari', shiftId: 'setup-welcome' },
    ],
  ])
    assert.throws(() => validate({ ...r, locks }));
  const p = copy(r);
  p.shifts[0].skills = ['repair', 'textiles', 'welcome'];
  assert.equal(
    schedule(p).shiftCoverage.find((v) => v.shiftId === 'setup-welcome')
      .assigned,
    0,
  );
});
test('zero demand, no people and all-locked plans have valid certificates', () => {
  assert.equal(schedule(blank()).covered, 0);
  const r = example();
  r.people = [];
  assert.equal(schedule(r).covered, 0);
  const all = example();
  all.locks = schedule(all).assignments;
  const p = schedule(all);
  assert.equal(p.certificate.flow, 0);
  assert.equal(p.certificate.cost, 0);
  verifySchedule(all, p);
});
test('maximum 32 people,12 blocks,48 roles and128 positions', () => {
  const r = blank();
  r.blocks = Array.from({ length: 12 }, (_, i) => ({
    id: 'b' + i,
    label: 'Block ' + i,
    start: i * 60,
  }));
  r.people = Array.from({ length: 32 }, (_, i) => ({
    id: 'p' + i,
    name: 'Person ' + i,
    limit: 12,
    skills: [],
    availability: r.blocks.map((b) => ({ blockId: b.id, status: 'preferred' })),
  }));
  r.shifts = Array.from({ length: 48 }, (_, i) => ({
    id: 's' + i,
    label: 'Role ' + i,
    blockId: 'b' + (i % 12),
    skills: [],
    needed: i < 32 ? 3 : 2,
  }));
  const p = schedule(r);
  assert.equal(p.covered, 128);
  assert.equal(p.loadSquare, 512);
  verifySchedule(r, p);
  assert.deepEqual(parse(rosterJSON(r)), r);
});
test('certifier detects forged summaries, assignments and submaximum flow', () => {
  const r = example(),
    p = schedule(r);
  for (const key of [
    'covered',
    'required',
    'unfilled',
    'loadSquare',
    'preferencePenalty',
    'weightedObjective',
    'weight',
    'lockedCount',
  ]) {
    const q = copy(p);
    q[key]++;
    assert.throws(() => verifySchedule(r, q));
  }
  for (const key of [
    'cutCapacity',
    'flow',
    'cost',
    'dualBound',
    'minimumReducedCost',
    'residualArcs',
  ]) {
    const q = copy(p);
    q.certificate[key]++;
    assert.throws(() => verifySchedule(r, q));
  }
  const q = copy(p);
  q.assignments.pop();
  assert.throws(() => verifySchedule(r, q));
  q.assignments = p.assignments;
  q.loads[0].count++;
  assert.throws(() => verifySchedule(r, q));
});
test('parallel flow arcs, original-capacity cut and exact dual certificate', () => {
  const g = network(),
    a = node(g, 'a');
  edge(g, 0, a, 1, 3, 'capacity', 'a');
  edge(g, 0, a, 1, 7, 'capacity', 'a');
  edge(g, a, 1, 2, 1, 'demand', 'x');
  const solved = minCostMaxFlow(g);
  assert.deepEqual(solved, { flow: 2, cost: 12 });
  const p = certify(g, 2, 12);
  assert.equal(p.cutCapacity, 2);
  assert.equal(p.dualBound, 12);
  const bad = network(),
    u = node(bad, 'u'),
    v = node(bad, 'v');
  edge(bad, u, v, 1, -1, 'test', 'x');
  edge(bad, v, u, 1, 0, 'test', 'y');
  assert.throws(() => certify(bad, 0, 0), /Negative residual cycle/);
});
test('exports retain exact JSON, include gaps and neutralize spreadsheet formulas', () => {
  const r = example();
  r.people[0].name = '=1+1';
  r.people[1].name = 'Name "quoted", yes';
  const p = schedule(r),
    report = JSON.parse(reportJSON(r, p));
  assert.deepEqual(report.roster, r);
  verifySchedule(report.roster, report.result);
  assert.equal(csvCell(' =SUM(A1)'), '"\' =SUM(A1)"');
  assert.equal(csvCell('a"b'), '"a""b"');
  const csv = scheduleCSV(r, p);
  assert.ok(csv.includes("'=1+1"));
  assert.equal(csv.trim().split('\r\n').length, 9);
  r.people = [];
  assert.ok(scheduleCSV(r, schedule(r)).includes('unfilled'));
});
