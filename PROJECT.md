# World Build013 — Common Hours

## Question

How can a small community team share necessary work without double-booking people or hiding the compromises inside a generated rota?

## Audience and activity

Volunteer coordinators and workshop organizers planning a bounded, single-day event. The activity is an editable rota, not a page advertising scheduling software.

## Product decisions

The working surface resembles a clear community noticeboard: chronological blocks, explicit roles and gaps, green assigned positions, gold skill requirements, and an adjacent team workload list. It is responsive without requiring a fixed-width desktop calendar.

People retain declared limits and availability. Locks express fixed assignments, not inferred consent. Invalid edits are atomic. Deletion and full-roster replacement require explicit confirmation. A new time block defaults everyone to unavailable.

No account, database or AI service is needed. The local-memory boundary is explicit and portable backups are available. This keeps the useful public version free without depending on a paid inference allowance.

## Technical progression

Common Hours moves from explanatory numerical models into constrained operational planning. It combines a min-cost maximum-flow engine, an exact integer lexicographic objective, a maximum-flow cut, a global residual-cost certificate, and independent reconstruction from the returned assignments. The certificate can be exported with the input roster.

The sophistication is in verifiable constraints and honest limits, not in treating a staffing decision as objective truth. The app optimizes positions, not the count of fully staffed roles.

## Non-goals

No real-time collaboration, persistent records, identity system, notifications, payroll, labor-law advice, overnight scheduling, safety certification or social posting. No paid services or new accounts requiring payment were introduced.

## Acceptance

A visitor can enter a complete roster, create a feasible draft, inspect eligibility and unmet positions, preserve locks, export reusable files, and understand what the result does and does not certify. Mathematical and workflow tests must pass before public publication.
