'use client';
import {
  useState,
  useEffect,
  useSyncExternalStore,
  useRef,
  useMemo,
} from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  TableCaption,
} from '@/components/ui/table';
import { RosterEditor } from '@/components/roster-editor';
import {
  LockKeyhole,
  LockKeyholeOpen,
  Plus,
  ArrowRight,
  Download,
  Pencil,
} from 'lucide-react';
import { Workspace } from '@/lib/workspace';
import {
  blank,
  example,
  time,
  status,
  assignmentKey,
  type Assignment,
} from '@/lib/roster';
import { registerTools } from '@/lib/browser-tools';
import { download, rosterJSON, reportJSON, scheduleCSV } from '@/lib/files';
import { personLabel, reviewPlan, teamBrief } from '@/lib/brief';
// Vite supplies the default worker constructor for this query import.
// eslint-disable-next-line import/default
import PlannerWorker from '@/lib/planner.worker.ts?worker';

export default function CommonHours() {
  const [w] = useState(() => new Workspace()),
    s = useSyncExternalStore(w.subscribe, w.getSnapshot, w.getSnapshot),
    file = useRef<HTMLInputElement>(null);
  useEffect(() => w.attach(() => new PlannerWorker()), [w]);
  useEffect(() => registerTools(w), [w]);
  useEffect(() => {
    const protect = (e: BeforeUnloadEvent) => {
      const current = w.getSnapshot();
      if (current.revision > 0 || current.draft) {
        e.preventDefault();
      }
    };
    window.addEventListener('beforeunload', protect);
    return () => window.removeEventListener('beforeunload', protect);
  }, [w]);
  const r = s.roster,
    result = s.result,
    locked = new Set(r.locks.map(assignmentKey)),
    assigned = result?.assignments ?? r.locks,
    blocked = !!s.busy || !!s.draft || !!s.pending;
  const review = useMemo(
    () => (result ? reviewPlan(r, result) : null),
    [r, result],
  );
  const attempt = (fn: () => void) => {
    try {
      fn();
    } catch (e) {
      w.error(e);
    }
  };
  const start = () => {
    try {
      void w.plan().catch(() => {});
    } catch (e) {
      w.error(e);
    }
  };
  const label = (id: string) => r.skills.find((k) => k.id === id)!.label;
  const inspectRole = (id: string) =>
    attempt(() => {
      w.inspect(id);
      requestAnimationFrame(() => {
        const panel = document.getElementById('eligibility-details');
        panel?.focus({ preventScroll: true });
        panel?.scrollIntoView({ block: 'start' });
      });
    });
  const load = (id: string) => assigned.filter((a) => a.personId === id).length;
  const selected = r.shifts.find((v) => v.id === s.selectedShift);
  const required = r.shifts.reduce((n, v) => n + v.needed, 0);
  const act = (a: Assignment) =>
    attempt(() =>
      locked.has(assignmentKey(a)) ? w.requestUnlock(a) : w.lock(a),
    );
  return (
    <main>
      <header className="masthead">
        <a className="brand" href="#rota">
          common<span>hours</span>
          <i aria-hidden="true">↗</i>
        </a>
        <p>
          VOLUNTEER EVENT PLANNER
          <br />
          FREE · NO ACCOUNT
        </p>
        <span className="local-mark">TEMPORARY · BROWSER-LOCAL</span>
      </header>
      <section className="project-heading">
        <div>
          <p className="eyebrow">PUT THE RIGHT PEOPLE IN THE RIGHT HOURS</p>
          <h1>{r.title}</h1>
          <Button
            variant="ghost"
            disabled={blocked}
            onClick={() => attempt(() => w.begin('roster'))}
          >
            <Pencil size={15} /> Edit event details
          </Button>
        </div>
        <div className="project-action">
          <p>
            Turn your team’s skills and availability into a draft rota. See the
            gaps, check the workload and take a clear plan to your team.
          </p>
          <Button onClick={start} disabled={blocked}>
            Create draft plan <ArrowRight />
          </Button>
        </div>
      </section>
      <nav className="planning-steps" aria-label="Plan your event">
        <a href="#rota">
          <span>1</span> Set times and roles
        </a>
        <a href="#team">
          <span>2</span> Add your people
        </a>
        <a href={result ? '#plan-review' : '#rota'}>
          <span>3</span> Create, review and share
        </a>
        <p>
          Trying it out? The repair café is a fictional example. Your edits are
          not autosaved.
        </p>
      </nav>
      <div className="toolbar">
        <Button
          variant="outline"
          disabled={blocked}
          onClick={() => attempt(() => w.requestReplace(blank()))}
        >
          Start my event
        </Button>
        <Button
          variant="outline"
          disabled={blocked}
          onClick={() => attempt(() => w.requestReplace(example()))}
        >
          Try the example
        </Button>
        <Button
          variant="outline"
          disabled={blocked}
          onClick={() => file.current?.click()}
        >
          Open a saved roster
        </Button>
        <Button
          variant="outline"
          disabled={blocked}
          onClick={() => attempt(() => w.begin('json'))}
        >
          Advanced: edit JSON
        </Button>
        <Button
          variant="outline"
          disabled={blocked}
          onClick={() =>
            attempt(() =>
              download(
                'common-hours-roster.json',
                rosterJSON(r),
                'application/json',
              ),
            )
          }
        >
          <Download size={16} /> Save roster file
        </Button>
        <Input
          ref={file}
          className="hidden"
          type="file"
          accept=".json,application/json"
          aria-label="Import local roster JSON"
          onChange={(e) => {
            const selectedFile = e.target.files?.[0];
            e.target.value = '';
            if (selectedFile) {
              void w.importFile(selectedFile).catch((error) => w.error(error));
            }
          }}
        />
      </div>
      <div className="status-line">
        <output aria-live="polite">{s.busy ? s.progress : s.message}</output>
        {s.busy && (
          <Button variant="outline" onClick={() => w.cancel()}>
            Cancel operation
          </Button>
        )}
      </div>
      {s.error && !s.draft && !s.pending && (
        <p className="error page-error" role="alert">
          {s.error}
        </p>
      )}
      <div className="coverage-strip">
        <div>
          <strong>
            {assigned.length}
            <span> / {required}</span>
          </strong>
          <p>
            {result ? 'positions filled' : 'positions locked · not yet planned'}
          </p>
        </div>
        <div>
          <strong>{r.people.length}</strong>
          <p>people in the team</p>
        </div>
        <div>
          <strong>{r.blocks.length}</strong>
          <p>blocks of {r.blockMinutes} minutes</p>
        </div>
        <p className="scope-note">
          {result
            ? result.unfilled
              ? result.unfilled +
                ' positions cannot be filled together under these constraints and locks.'
              : 'Maximum eligible coverage reached. Confirm the arrangement with the team.'
            : 'One person can cover only one role in each block. No plan has been calculated for this revision.'}
        </p>
      </div>
      {result && review && (
        <section
          className="plan-review"
          id="plan-review"
          aria-labelledby="review-title"
        >
          <div className="review-heading">
            <div>
              <p className="eyebrow">YOUR DRAFT / NOT YET CONFIRMED</p>
              <h2 id="review-title">{review.headline}</h2>
            </div>
            <Button
              disabled={blocked}
              onClick={() =>
                attempt(() =>
                  download(
                    'common-hours-team-brief.txt',
                    teamBrief(r, result),
                    'text/plain;charset=utf-8',
                  ),
                )
              }
            >
              <Download size={16} /> Download team brief
            </Button>
          </div>
          <div className="review-metrics">
            <p>
              <strong>
                {review.fullyStaffed} / {r.shifts.length}
              </strong>{' '}
              roles fully staffed
            </p>
            <p>
              <strong>{review.atLimit}</strong> people at their stated limit
            </p>
            <p>
              <strong>{result.preferencePenalty}</strong> assignments outside
              preferred hours
            </p>
          </div>
          <p className="review-explainer">
            “Outside preferred” still means marked available. A full rota is a
            proposal, not proof of consent or safe staffing.{' '}
            {review.partlyStaffed > 0 &&
              `${review.partlyStaffed} partly staffed roles need particular attention.`}
          </p>
          {review.gaps.length > 0 && (
            <div className="gap-list">
              <h3>Where the team needs a decision</h3>
              {review.gaps.map((gap) => (
                <article key={gap.shiftId} className="gap-card">
                  <div>
                    <h4>
                      {gap.start} · {gap.role}
                    </h4>
                    <p>
                      {gap.block} · {gap.missing} unfilled
                    </p>
                  </div>
                  <p>{gap.nextStep}</p>
                  <details>
                    <summary>What this draft shows</summary>
                    <p>
                      {gap.eligiblePeople} people have the declared skills and
                      availability. Among people not assigned to this role:{' '}
                      {gap.unavailable} are unavailable; {gap.missingSkills} are
                      available but lack a required skill; {gap.atLimit}{' '}
                      eligible people are at their limit; {gap.occupied} other
                      eligible people are assigned elsewhere in this block.
                    </p>
                    <p>
                      Each person appears in the first matching group above.
                      These are observations of this draft, not a unique
                      explanation or a guarantee that changing one rule will
                      help.
                    </p>
                  </details>
                  <Button
                    variant="outline"
                    disabled={blocked}
                    onClick={() => inspectRole(gap.shiftId)}
                  >
                    Inspect people for this role
                  </Button>
                </article>
              ))}
            </div>
          )}
          <ol className="review-checklist">
            <li>Confirm each person’s hours, skills and willingness.</li>
            <li>
              Check full role headcounts, breaks and supervision separately.
            </li>
            <li>
              Make agreed edits, create a fresh draft and save a roster file.
            </li>
          </ol>
          <p className="hint">
            The team brief is a readable text file with the rota, gaps,
            workloads and discussion checklist. It includes names; share only
            with permission. It is not an editable backup.
          </p>
        </section>
      )}
      <section className="workspace" id="rota">
        <div className="rota-board">
          <div className="board-title">
            <h2>The rota</h2>
            <Button
              variant="outline"
              disabled={blocked || r.blocks.length >= 12}
              onClick={() => attempt(() => w.begin('block'))}
            >
              <Plus size={15} /> Time block
            </Button>
          </div>
          {!r.blocks.length && (
            <p className="empty-note">
              Start with a time block, add people and their availability, then
              add the roles you need to fill.
            </p>
          )}
          <div className="block-grid">
            {[...r.blocks]
              .sort((a, b) => a.start - b.start)
              .map((b, i) => (
                <section className="time-block" key={b.id}>
                  <header>
                    <span className="block-number">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <div>
                      <h3>{b.label}</h3>
                      <p>
                        {time(b.start)}–{time(b.start + r.blockMinutes)}
                      </p>
                    </div>
                  </header>
                  <div className="small-actions">
                    <Button
                      variant="ghost"
                      disabled={blocked}
                      onClick={() => attempt(() => w.begin('block', b.id))}
                    >
                      Edit block
                    </Button>
                    <Button
                      variant="ghost"
                      disabled={blocked}
                      onClick={() =>
                        attempt(() => w.requestDelete('block', b.id))
                      }
                    >
                      Delete block
                    </Button>
                  </div>
                  <div className="job-stack">
                    {r.shifts
                      .filter((v) => v.blockId === b.id)
                      .map((shift) => {
                        const aa = assigned.filter(
                          (a) => a.shiftId === shift.id,
                        );
                        return (
                          <article
                            className={
                              'job' +
                              (selected?.id === shift.id ? ' selected-job' : '')
                            }
                            key={shift.id}
                          >
                            <div className="job-heading">
                              <span className="skill">
                                {shift.skills.length
                                  ? shift.skills.map(label).join(' + ')
                                  : 'No skill restriction'}
                              </span>
                              <span className="need">
                                {aa.length} / {shift.needed} filled
                              </span>
                            </div>
                            <h4>{shift.label}</h4>
                            <div className="assignment-stack">
                              {Array.from(
                                { length: shift.needed },
                                (_, index) => {
                                  const a = aa[index],
                                    person = a
                                      ? r.people.find(
                                          (p) => p.id === a.personId,
                                        )
                                      : null;
                                  return (
                                    <div
                                      className={
                                        a ? 'assignment filled' : 'assignment'
                                      }
                                      key={
                                        a ? assignmentKey(a) : 'empty-' + index
                                      }
                                    >
                                      {a && person ? (
                                        <>
                                          <span className="person-dot">
                                            {person.name.slice(0, 1)}
                                          </span>
                                          <strong>
                                            {personLabel(r, person.id)}
                                          </strong>
                                          <Button
                                            size="icon"
                                            variant="ghost"
                                            disabled={blocked}
                                            aria-label={
                                              (locked.has(assignmentKey(a))
                                                ? 'Unlock '
                                                : 'Lock ') +
                                              personLabel(r, person.id) +
                                              ' at ' +
                                              shift.label +
                                              ' in ' +
                                              b.label
                                            }
                                            title={
                                              locked.has(assignmentKey(a))
                                                ? 'Unlock assignment'
                                                : 'Lock assignment; replan afterward'
                                            }
                                            onClick={() => act(a)}
                                          >
                                            {locked.has(assignmentKey(a)) ? (
                                              <LockKeyhole size={16} />
                                            ) : (
                                              <LockKeyholeOpen size={16} />
                                            )}
                                          </Button>
                                        </>
                                      ) : (
                                        <>
                                          <span
                                            className="empty-dot"
                                            aria-hidden="true"
                                          >
                                            +
                                          </span>
                                          <span>
                                            {result
                                              ? 'Unfilled position'
                                              : 'Not assigned'}
                                          </span>
                                        </>
                                      )}
                                    </div>
                                  );
                                },
                              )}
                            </div>
                            <div className="role-actions">
                              <Button
                                variant="outline"
                                disabled={blocked}
                                onClick={() => inspectRole(shift.id)}
                              >
                                Inspect eligibility
                              </Button>
                              <Button
                                variant="ghost"
                                disabled={blocked}
                                onClick={() =>
                                  attempt(() => w.begin('shift', shift.id))
                                }
                              >
                                Edit
                              </Button>
                              <Button
                                variant="ghost"
                                disabled={blocked || !r.people.length}
                                onClick={() =>
                                  attempt(() => w.begin('lock', shift.id))
                                }
                              >
                                Add lock
                              </Button>
                              <Button
                                variant="ghost"
                                disabled={blocked}
                                onClick={() =>
                                  attempt(() =>
                                    w.requestDelete('shift', shift.id),
                                  )
                                }
                              >
                                Delete
                              </Button>
                            </div>
                          </article>
                        );
                      })}
                    <Button
                      variant="outline"
                      disabled={blocked || r.shifts.length >= 48}
                      onClick={() =>
                        attempt(() => w.begin('shift', null, b.id))
                      }
                    >
                      <Plus size={15} /> Add role
                    </Button>
                  </div>
                </section>
              ))}
          </div>
        </div>
        <aside className="team-panel" id="team">
          <div className="board-title">
            <h2>The team</h2>
            <Button
              variant="outline"
              disabled={blocked || r.people.length >= 32}
              onClick={() => attempt(() => w.begin('person'))}
            >
              <Plus size={15} /> Person
            </Button>
          </div>
          {r.people.map((p) => (
            <div className="team-entry" key={p.id}>
              <div className="team-person">
                <span className="avatar" aria-hidden="true">
                  {p.name.slice(0, 2).toUpperCase()}
                </span>
                <div>
                  <h3>{personLabel(r, p.id)}</h3>
                  <p>
                    {p.skills.length
                      ? p.skills.map(label).join(' + ')
                      : 'No declared skills'}
                  </p>
                </div>
                <span
                  className="load"
                  aria-label={
                    load(p.id) + ' assignments out of a limit of ' + p.limit
                  }
                >
                  {load(p.id)}
                  <small>/ {p.limit}</small>
                </span>
              </div>
              <div className="small-actions">
                <Button
                  variant="ghost"
                  disabled={blocked}
                  onClick={() => attempt(() => w.begin('person', p.id))}
                >
                  Edit availability
                </Button>
                <Button
                  variant="ghost"
                  disabled={blocked}
                  onClick={() => attempt(() => w.requestDelete('person', p.id))}
                >
                  Delete
                </Button>
              </div>
            </div>
          ))}
          {!r.people.length && (
            <p className="empty-note">
              Add people with their skills, availability and assignment limits.
            </p>
          )}
          <p className="team-note">
            Counts show {result ? 'this draft plan' : 'fixed assignments only'}.
            A lock fixes an assignment; it does not confirm someone’s consent.
            Editing the roster clears the plan.
          </p>
        </aside>
      </section>
      {selected && (
        <section
          className="detail-panel"
          id="eligibility-details"
          tabIndex={-1}
          aria-labelledby="eligibility-title"
        >
          <div className="board-title">
            <h2 id="eligibility-title">{selected.label} · eligibility</h2>
            <span>
              {r.blocks.find((b) => b.id === selected.blockId)!.label}
            </span>
          </div>
          <p>
            Each person must have every required skill and be available. These
            checks do not guarantee a spare position: limits, locks and
            assignments elsewhere also matter.
          </p>
          <Table>
            <TableCaption>
              Declared eligibility and current {result ? 'draft' : 'locked'}{' '}
              workload
            </TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead>Person</TableHead>
                <TableHead>Availability</TableHead>
                <TableHead>Missing skills</TableHead>
                <TableHead>Current count / limit</TableHead>
                <TableHead>This block</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {r.people.map((p) => {
                const here = assigned.find(
                  (a) =>
                    a.personId === p.id &&
                    r.shifts.find((v) => v.id === a.shiftId)!.blockId ===
                      selected.blockId,
                );
                return (
                  <TableRow key={p.id}>
                    <TableCell>{personLabel(r, p.id)}</TableCell>
                    <TableCell>
                      {status(p, selected.blockId) === 'no'
                        ? 'Unavailable'
                        : status(p, selected.blockId) === 'preferred'
                          ? 'Preferred'
                          : 'Available'}
                    </TableCell>
                    <TableCell>
                      {selected.skills
                        .filter((k) => !p.skills.includes(k))
                        .map(label)
                        .join(', ') || 'None'}
                    </TableCell>
                    <TableCell>
                      {load(p.id)} / {p.limit}
                    </TableCell>
                    <TableCell>
                      {here
                        ? r.shifts.find((v) => v.id === here.shiftId)!.label
                        : 'No assignment'}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </section>
      )}
      <section className="detail-panel">
        <div className="board-title">
          <h2>Skill labels</h2>
          <Button
            variant="outline"
            disabled={blocked || r.skills.length >= 16}
            onClick={() => attempt(() => w.begin('skill'))}
          >
            <Plus size={15} /> Skill
          </Button>
        </div>
        <div className="skills-list">
          {r.skills.map((k) => (
            <div key={k.id}>
              <span className="skill">{k.label}</span>
              <Button
                variant="ghost"
                disabled={blocked}
                aria-label={'Edit skill ' + k.label}
                onClick={() => attempt(() => w.begin('skill', k.id))}
              >
                Edit
              </Button>
              <Button
                variant="ghost"
                disabled={blocked}
                aria-label={'Delete skill ' + k.label}
                onClick={() => attempt(() => w.requestDelete('skill', k.id))}
              >
                Delete
              </Button>
            </div>
          ))}
        </div>
        <p className="hint">
          Remove a skill from people and roles before deleting its label. This
          prevents accidentally widening eligibility.
        </p>
      </section>
      {result && (
        <section className="detail-panel result-panel">
          <div className="board-title">
            <h2>The reasoning behind this draft</h2>
            <span>REVISION {s.revision}</span>
          </div>
          <p>
            Optimal means only the best score under this roster’s declared
            rules. It is not proof of fairness, safe staffing or consent. Partly
            staffed roles may not be operational.
          </p>
          <div className="proof-grid">
            <div>
              <span>1 / COVERAGE</span>
              <strong>
                {result.covered} of {result.required}
              </strong>
              <p>
                {result.lockedCount} locked + at most{' '}
                {result.certificate.cutCapacity} additional positions. A network
                cut gives the same bound as the achieved plan.
              </p>
            </div>
            <div>
              <span>2 / ASSIGNMENT COUNTS</span>
              <strong>{result.loadSquare}</strong>
              <p>
                Sum of squared counts, including locks. Lower is preferred among
                equally complete plans, not a measure of personal wellbeing.
              </p>
            </div>
            <div>
              <span>3 / PREFERENCE</span>
              <strong>{result.preferencePenalty}</strong>
              <p>
                Assignments marked available rather than preferred. Minimized
                only after coverage and count balance.
              </p>
            </div>
          </div>
          <details>
            <summary>Inspect the certificate and its limits</summary>
            <p>
              The solver uses integer min-cost maximum flow. A separate pass
              rebuilds the flow from the assignments, checks every constraint,
              and verifies a maximum-flow cut and minimum-cost bound.
            </p>
            <p>
              For additional assignments, cost {result.certificate.cost} equals
              its independently recomputed lower bound{' '}
              {result.certificate.dualBound}. Every residual reduced cost is
              nonnegative. The balance weight is {result.weight}, larger than
              any possible total preference penalty. Locked contributions are
              fixed constants.
            </p>
            <p>
              This cut is one bottleneck certificate, not a unique explanation
              or a recommendation to change any particular person’s limits. Node
              IDs identify people, blocks and roles in the roster JSON.
            </p>
            <Table>
              <TableCaption>
                Original-capacity edges crossing the residual cut ·{' '}
                {result.certificate.cutCapacity} additional positions
              </TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead>Constraint</TableHead>
                  <TableHead>Key</TableHead>
                  <TableHead>Capacity</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.certificate.cutEdges.map((edge, i) => (
                  <TableRow key={i}>
                    <TableCell>{edge.kind}</TableCell>
                    <TableCell>{edge.key}</TableCell>
                    <TableCell>{edge.capacity}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </details>
          <div className="toolbar inline">
            <Button
              variant="outline"
              disabled={blocked}
              onClick={() =>
                attempt(() =>
                  download(
                    'common-hours-draft.csv',
                    scheduleCSV(r, result),
                    'text/csv;charset=utf-8',
                  ),
                )
              }
            >
              <Download size={16} /> Draft CSV
            </Button>
            <Button
              variant="outline"
              disabled={blocked}
              onClick={() =>
                attempt(() =>
                  download(
                    'common-hours-certificate.json',
                    reportJSON(r, result),
                    'application/json',
                  ),
                )
              }
            >
              <Download size={16} /> Full certificate + roster
            </Button>
          </div>
          <p className="hint">
            CSV has one row per needed position, including gaps. Formula-like
            text is prefixed with an apostrophe for spreadsheet safety; the
            roster JSON preserves exact text.
          </p>
        </section>
      )}
      <section className="priority-note">
        <span>THE PLANNING ORDER</span>
        <p>
          <strong>Cover the positions.</strong> Then balance assignment counts.
          Then favor preferred availability. Locks, skills, availability and
          hard limits always come first.
        </p>
      </section>
      <section className="detail-panel method-note">
        <h2>Before putting a rota into practice</h2>
        <p>{r.notes || 'No event notes yet.'}</p>
        <p>
          This is a single-day worksheet with equal, nonoverlapping blocks. It
          does not account for breaks, fatigue, travel, overnight work, time
          zones, supervision ratios or legal requirements. Check those needs
          separately with the team.
        </p>
        <p>
          No account or API key is needed. Rosters and calculations stay in this
          page’s memory; refreshing or closing loses them. Download a backup
          before leaving. Share exported names and availability only with
          permission.
        </p>
        <p>
          Method:{' '}
          <a
            href="https://courses.csail.mit.edu/6.854/16/Notes/n10-mincostflow.html"
            target="_blank"
            rel="noreferrer"
          >
            MIT’s min-cost flow notes
          </a>{' '}
          and{' '}
          <a
            href="https://ocw.mit.edu/courses/6-854j-advanced-algorithms-fall-2008/4064d889e5033a9915327a777d12b592_notes_flow.pdf"
            target="_blank"
            rel="noreferrer"
          >
            integer network-flow foundations
          </a>
          . The count-balance objective is a design choice, not a universal
          fairness rule.
        </p>
      </section>
      <footer>
        <span>SKAI-LINE / COMMON HOURS</span>
        <span>A PLANNING AID, NOT A CONFIRMED STAFFING AGREEMENT</span>
      </footer>
      <RosterEditor workspace={w} state={s} />
    </main>
  );
}
