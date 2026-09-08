import test from 'node:test';
import assert from 'node:assert/strict';
import { Workspace } from '../lib/workspace.ts';
import { Runner } from '../lib/runner.ts';
import { example, blank } from '../lib/roster.ts';
import { schedule } from '../lib/scheduler.ts';
import { registerTools } from '../lib/browser-tools.ts';
const worker = () => ({
  onmessage: null,
  onerror: null,
  terminated: false,
  postMessage() {},
  terminate() {
    this.terminated = true;
  },
});
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((a, b) => {
    resolve = a;
    reject = b;
  });
  return { promise, resolve, reject };
};
test('new role prefilled in a later block stays clean until edited', () => {
  const w = new Workspace();
  w.begin('shift', null, 'finish');
  assert.equal(w.getSnapshot().draft.fields.blockId, 'finish');
  w.closeDraft();
  assert.equal(w.getSnapshot().draft, null);
  assert.equal(w.getSnapshot().pending, null);
});
test('roster revisions and draft saves are atomic and require explicit replacement', () => {
  const w = new Workspace();
  assert.throws(() => w.replace(JSON.stringify(blank()), undefined, true));
  assert.throws(() => w.replace(JSON.stringify(blank()), 0, false));
  w.begin('person', 'ari');
  w.field('limit', '999');
  assert.throws(() => w.saveDraft());
  assert.equal(w.getSnapshot().revision, 0);
  assert.throws(() => w.replace(JSON.stringify(blank()), 0, true));
  w.closeDraft();
  assert.equal(w.getSnapshot().pending.kind, 'discard');
  w.dismiss();
  assert.ok(w.getSnapshot().draft);
  w.closeDraft();
  w.confirm();
  w.replace(JSON.stringify(blank()), 0, true);
  assert.equal(w.getSnapshot().revision, 1);
  assert.throws(() => w.replace(JSON.stringify(blank()), 0, true));
});
test('adding blocks defaults everyone to unavailable; deletion cascades are confirmed', () => {
  const w = new Workspace();
  w.begin('block');
  w.field('label', 'Later');
  w.field('start', '12:00');
  w.saveDraft();
  assert.ok(
    w
      .getSnapshot()
      .roster.people.every((p) => p.availability.at(-1).status === 'no'),
  );
  w.lock({ personId: 'ari', shiftId: 'setup-repair' });
  w.requestDelete('block', 'setup');
  assert.equal(w.getSnapshot().roster.blocks.length, 4);
  w.confirm();
  const r = w.getSnapshot().roster;
  assert.equal(r.locks.length, 0);
  assert.ok(r.shifts.every((s) => s.blockId !== 'setup'));
  assert.ok(
    r.people.every((p) => p.availability.every((a) => a.blockId !== 'setup')),
  );
  assert.throws(() => w.requestDelete('skill', 'repair'), /in use/);
});
test('unchanged large JSON draft can be saved through compact fallback', () => {
  const w = new Workspace(),
    r = blank();
  r.notes = '漢'.repeat(2000);
  r.blocks = Array.from({ length: 12 }, (_, i) => ({
    id: 'b' + String(i).padStart(22, '0'),
    label: '漢'.repeat(60),
    start: i * 60,
  }));
  r.skills = Array.from({ length: 16 }, (_, i) => ({
    id: 'k' + String(i).padStart(22, '0'),
    label: '漢'.repeat(60),
  }));
  r.people = Array.from({ length: 32 }, (_, i) => ({
    id: 'p' + String(i).padStart(22, '0'),
    name: '漢'.repeat(60),
    limit: 12,
    skills: r.skills.map((k) => k.id),
    availability: r.blocks.map((b) => ({ blockId: b.id, status: 'preferred' })),
  }));
  r.shifts = Array.from({ length: 48 }, (_, i) => ({
    id: 's' + String(i).padStart(22, '0'),
    label: '漢'.repeat(60),
    needed: 1,
    blockId: r.blocks[i % 12].id,
    skills: r.skills.map((k) => k.id),
  }));
  w.replace(JSON.stringify(r), 0, true);
  w.begin('json');
  assert.ok(Buffer.byteLength(w.getSnapshot().draft.fields.json) <= 131072);
  w.saveDraft();
  w.confirm();
  assert.deepEqual(w.getSnapshot().roster, r);
});
test('cancelled file imports cannot replace newer state or clear a newer error', async () => {
  const w = new Workspace(),
    d = deferred();
  const old = w.importFile({ size: 10, text: () => d.promise });
  assert.equal(w.getSnapshot().busy, 'file');
  w.cancel();
  w.replace(JSON.stringify(blank()), 0, true);
  w.error(new Error('new error'));
  d.reject(new Error('old error'));
  await old;
  assert.equal(w.getSnapshot().revision, 1);
  assert.equal(w.getSnapshot().error, 'new error');
  assert.equal(w.getSnapshot().pending, null);
  await assert.rejects(
    w.importFile({ size: 131073, text: () => Promise.resolve('') }),
  );
});
test('worker result, progress, cancellation and stale callbacks have operation ownership', async () => {
  let workerInstance;
  const runner = new Runner(() => (workerInstance = worker())),
    r = example(),
    p = schedule(r),
    seen = [];
  const pending = runner.run(r, (a, b) => seen.push([a, b]));
  const callback = workerInstance.onmessage;
  callback({ data: { type: 'progress', filled: 3, total: 8 } });
  assert.deepEqual(seen, [[3, 8]]);
  await assert.rejects(runner.run(r, () => {}));
  runner.cancel();
  await assert.rejects(pending, /cancelled/);
  assert.ok(workerInstance.terminated);
  const next = runner.run(r, () => {});
  callback({ data: { type: 'result', result: p } });
  assert.ok(runner.busy);
  workerInstance.onmessage({ data: { type: 'result', result: p } });
  assert.deepEqual(await next, p);
  runner.dispose();
  await assert.rejects(runner.run(r, () => {}));
});
test('workspace plans update once; cancelled stale workers cannot clear a new run', async () => {
  let current;
  const w = new Workspace(),
    cleanup = w.attach(() => (current = worker()));
  const first = w.plan(),
    old = current.onmessage;
  assert.throws(() => w.begin('roster'));
  w.cancel();
  await assert.rejects(first);
  const second = w.plan();
  old({ data: { type: 'result', result: schedule(example()) } });
  assert.equal(w.getSnapshot().busy, 'plan');
  current.onmessage({ data: { type: 'result', result: schedule(example()) } });
  await second;
  assert.equal(w.getSnapshot().result.covered, 8);
  assert.equal(w.getSnapshot().busy, null);
  cleanup();
});
test('browser tools register exact guards, update shared state and unregister', async () => {
  const saved = globalThis.document,
    registered = [],
    w = new Workspace();
  globalThis.document = {
    modelContext: {
      registerTool(tool, options) {
        registered.push({ tool, signal: options.signal });
      },
    },
  };
  try {
    const cleanup = registerTools(w);
    assert.equal(registered.length, 4);
    const byName = Object.fromEntries(
      registered.map((v) => [v.tool.name, v.tool]),
    );
    for (const { tool } of registered)
      assert.equal(tool.annotations.untrustedContentHint, true);
    assert.throws(() => byName.read_community_rota.execute({ extra: 1 }));
    assert.equal(byName.read_community_rota.execute({}).revision, 0);
    assert.throws(() =>
      byName.replace_community_roster.execute({
        expectedRevision: undefined,
        discardCurrent: true,
        rosterJson: JSON.stringify(blank()),
      }),
    );
    assert.equal(
      byName.inspect_community_role.execute({
        expectedRevision: 0,
        shiftId: 'setup-repair',
      }).selectedShift,
      'setup-repair',
    );
    assert.throws(() =>
      byName.inspect_community_role.execute({
        expectedRevision: 0,
        shiftId: 'missing',
      }),
    );
    let current;
    w.attach(() => (current = worker()));
    const run = byName.plan_community_rota.execute({ expectedRevision: 0 });
    current.onmessage({
      data: { type: 'result', result: schedule(example()) },
    });
    assert.equal((await run).result.covered, 8);
    assert.equal(
      byName.replace_community_roster.execute({
        expectedRevision: 0,
        discardCurrent: true,
        rosterJson: JSON.stringify(blank()),
      }).revision,
      1,
    );
    await assert.rejects(
      byName.plan_community_rota.execute({ expectedRevision: 0 }),
    );
    cleanup();
    assert.ok(registered.every((v) => v.signal.aborted));
    globalThis.document = {};
    registerTools(w)();
  } finally {
    globalThis.document = saved;
  }
});
