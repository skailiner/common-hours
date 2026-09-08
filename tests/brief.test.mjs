import test from 'node:test';
import assert from 'node:assert/strict';
import { blank, example, validate } from '../lib/roster.ts';
import { schedule } from '../lib/scheduler.ts';
import { personLabel, reviewPlan, teamBrief } from '../lib/brief.ts';

test('duplicate names stay distinguishable and zero assignment limits are counted consistently', () => {
  const r = example();
  r.people[0].name = 'Sam';
  r.people[1].name = 'sam';
  r.people[3].name = 'Sam [ari]';
  r.locks = [
    { personId: 'ari', shiftId: 'setup-repair' },
    { personId: 'bea', shiftId: 'setup-welcome' },
  ];
  r.people[2].limit = 0;
  const p = schedule(r),
    v = reviewPlan(r, p),
    text = teamBrief(r, p);
  assert.match(text, /Sam \[ari\] \[fixed assignment/);
  assert.match(text, /sam \[bea\] \[fixed assignment/);
  assert.match(text, /Sam \[ari\]:/);
  assert.match(text, /sam \[bea\]:/);
  assert.match(text, /Sam \[ari\] \[dev\]:/);
  assert.equal(
    new Set(r.people.map((person) => personLabel(r, person.id))).size,
    r.people.length,
  );
  assert.equal(
    v.atLimit,
    v.people.filter((person) => person.count === person.limit).length,
  );
  assert.ok(
    v.people.some((person) => person.count === 0 && person.limit === 0),
  );
});

test('consumer summary describes the verified repair cafe without a safety verdict', () => {
  const r = example(),
    p = schedule(r),
    v = reviewPlan(r, p);
  assert.equal(v.fullyStaffed, 7);
  assert.equal(v.partlyStaffed, 0);
  assert.equal(v.emptyRoles, 0);
  assert.deepEqual(v.gaps, []);
  assert.equal(
    v.people.reduce((n, a) => n + a.minutes, 0),
    480,
  );
  assert.equal(
    v.people.reduce((n, a) => n + a.nonpreferred, 0),
    p.preferencePenalty,
  );
  assert.equal(
    v.atLimit,
    v.people.filter((a) => a.limit > 0 && a.count === a.limit).length,
  );
  const text = teamBrief(r, p);
  assert.match(text, /DRAFT FOR TEAM REVIEW/);
  assert.match(text, /Not a confirmed staffing agreement/);
  assert.match(text, /no calendar date or time zone/);
  assert.match(text, /8 of 8 positions/);
});

test('gaps distinguish missing eligibility from competition, without proposing unsafe changes', () => {
  const r = blank();
  r.blocks = [{ id: 'a', label: 'Morning', start: 540 }];
  r.people = [
    {
      id: 'p',
      name: 'One person',
      skills: [],
      limit: 1,
      availability: [{ blockId: 'a', status: 'yes' }],
    },
  ];
  r.shifts = [
    { id: 'x', label: 'Welcome', blockId: 'a', skills: [], needed: 1 },
    { id: 'y', label: 'Setup', blockId: 'a', skills: [], needed: 1 },
  ];
  const p = schedule(r),
    v = reviewPlan(r, p);
  assert.equal(v.gaps.length, 1);
  assert.equal(v.gaps[0].eligiblePeople, 1);
  assert.equal(v.gaps[0].atLimit, 1);
  assert.match(v.gaps[0].nextStep, /may move a gap elsewhere/);
  r.people[0].limit = 2;
  const occupied = reviewPlan(r, schedule(r));
  assert.equal(occupied.gaps[0].occupied, 1);
  assert.equal(occupied.gaps[0].atLimit, 0);
  r.skills = [{ id: 'skill', label: 'Declared skill' }];
  r.shifts[1].skills = ['skill'];
  const skill = reviewPlan(r, schedule(r));
  assert.equal(skill.gaps[0].eligiblePeople, 0);
  assert.equal(skill.gaps[0].missingSkills, 1);
  assert.match(skill.gaps[0].nextStep, /do not weaken a real requirement/);
});

test('review counts partial roles, zero-demand and no-people cases correctly', () => {
  const r = example();
  r.people = [];
  const v = reviewPlan(r, schedule(r));
  assert.equal(v.emptyRoles, 7);
  assert.equal(
    v.gaps.reduce((n, g) => n + g.missing, 0),
    8,
  );
  assert.equal(
    reviewPlan(blank(), schedule(blank())).headline,
    'Add the work your event needs.',
  );
  const partial = example();
  partial.people = partial.people.filter((p) => p.id === 'cam');
  const q = reviewPlan(partial, schedule(partial));
  assert.equal(
    q.fullyStaffed + q.partlyStaffed + q.emptyRoles,
    partial.shifts.length,
  );
  assert.ok(q.partlyStaffed > 0);
  assert.match(teamBrief(r, schedule(r)), /UNFILLED: 2/);
});

test('descriptive buckets partition unassigned people over generated input changes', () => {
  for (let seed = 0; seed < 64; seed++) {
    const r = example();
    r.people.forEach((p, i) => {
      p.limit = (seed + i) % 4;
      p.availability.forEach((a, j) => {
        a.status = ['no', 'yes', 'preferred'][(seed + i + j) % 3];
      });
    });
    validate(r);
    const p = schedule(r),
      v = reviewPlan(r, p);
    for (const g of v.gaps) {
      const assigned = p.assignments.filter(
        (a) => a.shiftId === g.shiftId,
      ).length;
      assert.equal(
        g.unavailable + g.missingSkills + g.atLimit + g.occupied + assigned,
        r.people.length,
      );
    }
    assert.equal(
      v.gaps.reduce((n, g) => n + g.missing, 0),
      p.unfilled,
    );
    assert.equal(
      v.fullyStaffed + v.partlyStaffed + v.emptyRoles,
      r.shifts.length,
    );
  }
});

test('brief preserves exact text, fixed status and chronological order without mutating the roster', () => {
  const r = example();
  r.title = '<script>alert(1)</script>';
  r.notes = 'Keep exact <b>text</b> & notes.\nSecond line.';
  r.people[0].name = '=SUM(A1)';
  r.locks = [{ personId: 'ari', shiftId: 'setup-repair' }];
  r.blocks.reverse();
  const before = JSON.stringify(r),
    p = schedule(r),
    text = teamBrief(r, p);
  assert.equal(JSON.stringify(r), before);
  assert.ok(text.includes(r.notes));
  assert.match(
    text,
    /=SUM\(A1\) \[ari\] \[fixed assignment, not confirmed consent\]/,
  );
  assert.ok(text.indexOf('09:00-10:00') < text.indexOf('11:00-12:00'));
  assert.match(text, /exported copy will not update/);
});

test('summary and brief reject altered or stale results before exporting claims', () => {
  const r = example(),
    p = schedule(r);
  const bad = structuredClone(p);
  bad.covered++;
  assert.throws(() => reviewPlan(r, bad));
  assert.throws(() => teamBrief(r, bad));
  const stale = structuredClone(r);
  stale.shifts[0].needed++;
  assert.throws(() => reviewPlan(stale, p));
  assert.throws(() => teamBrief(stale, p));
});
