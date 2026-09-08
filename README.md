# Common Hours

A free, browser-local community rota planner. Match people to roles using declared skills, availability, workload limits and fixed assignments. A local integer-flow solver fills as many eligible positions as possible, then balances assignment counts, then favors preferred availability.

This is a draft planning aid, not a staffing agreement, qualification check or safety assessment.

## Use

1. Start with the fictional repair café or a blank roster.
2. Set the event name and equal block duration. Add nonoverlapping blocks within one local day.
3. Add skill labels and people. Set each person's availability and assignment limit.
4. Add roles, headcounts and required skills. Every assigned person must have every checked skill.
5. Create a draft plan. Inspect eligibility, workload and any gaps.
6. Lock agreed assignments if needed, then replan. Locks stay fixed and must satisfy all hard constraints.
7. Download the roster JSON before leaving. CSV lists every needed position, including gaps; the certificate JSON includes the roster and a checkable result.

Nothing is autosaved. Refreshing or closing the page loses changes. The application does not send roster data to a server or call an AI API. The hosting provider still receives ordinary page requests. Share exported personal information only with permission.

## Scope

- Up to32 people,12 time blocks,48 roles,16 skill labels and128 total positions.
- Equal blocks of15–240 minutes, nonoverlapping within one local day.
- At most one role per person per block; person limits0–12 assignments.
- Availability is unavailable, available or preferred.
- A maximum-coverage plan may contain partly staffed roles that are not operational.
- No overnight work, breaks, fatigue, travel, time zones, supervision ratios or legal compliance model.

The optimization order is a declared product choice. Equal assignment counts are not a universal measure of fairness or wellbeing. Deterministic tie-breaking makes results reproducible, not uniquely best.

## Development

Node22.13+ and npm are required. Install with npm ci, run npm run dev, and create a static production export with npm run build. No secrets or environment variables are needed.

Verification commands: npm test; npm run typecheck; npm run lint; npm run build; npm run check:release. Public snapshots also run node scripts/release-check.mjs --public.

The lint command covers authored product and test files; the bundled component catalog is preserved unchanged. The lockfile is retained. A dependency audit was not run; this is not an audit-clean claim.

## Structure

- lib/roster.ts — strict roster schema and hard constraints.
- lib/flow.ts — integer min-cost flow and residual certificates.
- lib/scheduler.ts — scheduling network, objective and independent reconstruction.
- lib/planner.worker.ts and runner.ts — cancellable local worker.
- lib/workspace.ts — revisions, atomic edits, confirmations and async ownership.
- lib/files.ts — lossless roster backup, safe CSV and checked certificate export.
- app/page.tsx and components/roster-editor.tsx — working rota and guarded editors.
- tests — reproducible mathematical and workflow checks.

See METHOD.md, TESTING.md, PROJECT.md and RELEASE.md for the reasoning, limits and release evidence.

No license grant has been selected. Public visibility alone does not grant reuse rights.
