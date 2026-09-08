# Scheduling method

## Model and ordering

Each role belongs to one equal-duration nonoverlapping time block and requests an integer headcount. A person can occupy at most one role per block and cannot exceed their event-wide assignment limit. They must be available and possess every declared required skill. Locks consume these capacities before optimization and cannot be reversed.

The objective is lexicographic:

1. Maximize the number of filled eligible positions.
2. Minimize the sum of squared assignment counts across people, including locks.
3. Minimize assignments marked available rather than preferred.

Let D be the total requested positions and B=D+1. Preference penalty lies between0 andD. For fixed coverage, minimizing B times squared counts plus preference penalty therefore implements priorities2 and3 exactly. All arithmetic stays within safe integer bounds for the published limits.

## Network

The source connects to each person with unit-capacity parallel arcs. If a person already has L locked assignments, the kth additional unit costs B times (2(L+k)−1). These increasing marginal costs sum to the increase in squared total workload.

A person connects to each available, unlocked person/block vertex with capacity1. That vertex connects to each eligible role in the block with capacity1 and cost0 for preferred availability or1 for available. Each role connects to the sink with capacity equal to its remaining headcount.

Locked person/block pairs are excluded from the additional-assignment network. Locked preferences and squared counts contribute fixed constants. A filled role may still be incomplete, so coverage is always reported as positions.

## Solution and certificate

Successive shortest augmenting paths use reduced costs and vertex potentials. Initial forward costs are nonnegative. The solver continues until no augmenting path remains, even when additional assignments have positive cost. Canonical ID ordering and strict distance improvements make equal-score results reproducible.

The verifier reconstructs the complete flow from the claimed assignments rather than trusting reported scores. It checks references, eligibility, locks, headcounts, workload, one-role-per-block, edge capacities, flow conservation and cost.

The source-reachable residual set defines a cut. Original capacities across that cut sum to the achieved additional flow, proving maximum additional coverage. The cut is not unique and does not establish blame or a unique practical remedy.

For cost optimality, Bellman–Ford begins every residual vertex at zero, equivalent to a zero-cost supersource. This checks disconnected components as well as the source component. A negative residual cycle rejects the result. Every positive-residual edge must have nonnegative reduced cost.

For original edge e=(u,v), let c be its cost, U its capacity and pi its potential. The lower bound is the sum of U times min(0,c+pi(u)−pi(v)), minus flow times (pi(source)−pi(sink)). It must equal the reconstructed cost exactly. Exported potentials, nodes and cut edges make these identities inspectable.

The verifier is independent of the solver's augmenting-path history, but shares the roster/network definition. Independent exhaustive scheduling and generic-flow oracles provide an additional test layer; this is not a formal machine-checked proof of the entire application.

## Limits and normative choices

Skills and availability are declarations, not verified qualifications or consent. Squared assignment counts are a chosen balance objective; they do not measure effort, fatigue, disadvantage or wellbeing. One equal block can still contain very different work.

The model omits breaks, travel, overnight work, time-zone transitions, supervision, minimum rest and legal requirements. Discuss and check these separately. Stable tie-breaking does not imply the lexicographically smallest assignment list or an ethically superior schedule.

## Primary references

- [MIT6.854 min-cost flow notes](https://courses.csail.mit.edu/6.854/16/Notes/n10-mincostflow.html): residual costs, shortest augmenting paths, potentials and negative-cycle optimality.
- [Michel Goemans, MIT network-flow notes](https://ocw.mit.edu/courses/6-854j-advanced-algorithms-fall-2008/4064d889e5033a9915327a777d12b592_notes_flow.pdf): network-flow integrality and optimality foundations.
- [Günter Rote and Martin Zachariasen, Matrix Scaling by Network Flows](https://page.mi.fu-berlin.de/rote/Papers/pdf/Matrix%2Bscaling%2Bby%2Bnetwork%2Bflows.pdf), section2: representing separable convex costs with increasing-cost parallel arcs.

These references support the algorithms, not the product's chosen definition of workload balance.
