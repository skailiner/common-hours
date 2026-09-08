# Verification record

## Reproducible suite

18 automated groups cover:

- The fictional repair café:8/8 filled, squared loads12, preference penalty2, additional cost and dual bound110.
- Exhaustive feasible-assignment comparison for768 tiny rosters, including locked variants.
- Deterministic assignments and certificates under80 input-order permutations.
- Strict schema, Unicode, time, dense arrays, references, headcounts and import size.
- Lock conflicts, nonpooled skill requirements, zero demand, no people and all-locked plans.
- Maximum32 people,12 blocks,48 roles and128 positions.
- Forged scores, assignments and certificates.
- Parallel flow edges, original-capacity cuts and a disconnected negative residual cycle.
- Exact JSON round-trips, gap-preserving CSV and spreadsheet-formula neutralization.
- Clean prefilled editors, atomic revisions, confirmation/deletion cascades, compact JSON fallback.
- Cancelled imports, stale worker callbacks, operation ownership and browser-tool guards.

## Independent read-only audits

A separate mathematical audit of the actual source compared3,922 schedules, including194 locked cases, with exhaustive feasible-assignment oracles. It independently enumerated29,238 integer flow vectors across500 generic networks and1,817 cuts; exact BigInt dual calculations agreed.

It also rejected82 malformed inputs and29 forged or suboptimal reports; checked9 valid boundaries; exercised dense maximums,64/128 locks, bottlenecks and empty cases; and round-tripped a102,352-byte long-ID/Unicode roster. Maximum-case schedule plus verification took90.6ms in Node22.20.0 in that audit. This is not a phone or browser performance claim.

A separate workflow review passed13 groups covering revisions, atomic validation, drafts, locks, deletion cascades, cancellation, cleanup, worker failures and import limits. It found an unchanged large JSON draft could exceed the import cap when pretty-printed; the editor now falls back to compact JSON and has a regression test.

A follow-up review verified exports and browser guards and identified an untouched role editor being marked dirty by its default block selection. Initial block selection is now part of the clean draft, with a regression test.

## Browser and publication checks

Focused real-browser validation of all four intended browser tools and public production calculations passed. Anonymous HTML, entry scripts, stylesheet and worker matched the tested build. See RELEASE.md for exact fixtures and receipts. No broad visual, screenshot, mobile-device or assistive-technology testing has been claimed.

The source uses labeled controls, bundled accessible primitives, keyboard focus outlines, reduced-motion rules and responsive layouts. These implementation choices do not replace a full accessibility audit.

The lint command is scoped to authored files. Bundled unused UI and hook code is preserved. Dependency fixes were applied with the retained lockfile, without running a dependency audit; no audit-clean claim is made.
