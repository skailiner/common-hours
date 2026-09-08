export type Edge = {
  from: number;
  to: number;
  capacity: number;
  remaining: number;
  cost: number;
  reverse: number;
  kind: string;
  key: string;
};
export type Network = {
  nodes: string[];
  edges: Edge[];
  adj: number[][];
  source: number;
  sink: number;
};
export function network(): Network {
  return {
    nodes: ['source', 'sink'],
    edges: [],
    adj: [[], []],
    source: 0,
    sink: 1,
  };
}
export function node(g: Network, key: string) {
  g.nodes.push(key);
  g.adj.push([]);
  return g.nodes.length - 1;
}
export function edge(
  g: Network,
  from: number,
  to: number,
  capacity: number,
  cost: number,
  kind: string,
  key: string,
) {
  if (
    !Number.isSafeInteger(capacity) ||
    capacity < 0 ||
    !Number.isSafeInteger(cost)
  )
    throw new Error('Invalid integer flow edge.');
  const a = g.edges.length,
    b = a + 1;
  g.edges.push(
    { from, to, capacity, remaining: capacity, cost, reverse: b, kind, key },
    {
      from: to,
      to: from,
      capacity: 0,
      remaining: 0,
      cost: -cost,
      reverse: a,
      kind: 'reverse',
      key,
    },
  );
  g.adj[from].push(a);
  g.adj[to].push(b);
  return a;
}
export function minCostMaxFlow(
  g: Network,
  progress?: (filled: number) => void,
) {
  const n = g.nodes.length,
    pot = Array<number>(n).fill(0);
  let flow = 0,
    cost = 0;
  while (true) {
    const dist = Array<number>(n).fill(Infinity),
      parent = Array<number>(n).fill(-1),
      used = Array<boolean>(n).fill(false);
    dist[g.source] = 0;
    for (let k = 0; k < n; k++) {
      let u = -1;
      for (let v = 0; v < n; v++)
        if (!used[v] && (u === -1 || dist[v] < dist[u])) u = v;
      if (u < 0 || !Number.isFinite(dist[u])) break;
      used[u] = true;
      for (const i of g.adj[u]) {
        const e = g.edges[i];
        if (e.remaining <= 0) continue;
        const reduced = e.cost + pot[u] - pot[e.to];
        if (reduced < 0 || !Number.isSafeInteger(reduced))
          throw new Error('Reduced-cost invariant failed.');
        const candidate = dist[u] + reduced;
        if (candidate < dist[e.to]) {
          dist[e.to] = candidate;
          parent[e.to] = i;
        }
      }
    }
    if (!Number.isFinite(dist[g.sink])) break;
    for (let v = 0; v < n; v++) if (Number.isFinite(dist[v])) pot[v] += dist[v];
    let amount = Infinity,
      v = g.sink,
      steps = 0;
    while (v !== g.source) {
      if (parent[v] < 0 || ++steps > n)
        throw new Error('Invalid augmenting path.');
      const e = g.edges[parent[v]];
      amount = Math.min(amount, e.remaining);
      v = e.from;
    }
    v = g.sink;
    while (v !== g.source) {
      const e = g.edges[parent[v]];
      e.remaining -= amount;
      g.edges[e.reverse].remaining += amount;
      cost += amount * e.cost;
      v = e.from;
    }
    flow += amount;
    if (!Number.isSafeInteger(flow) || !Number.isSafeInteger(cost))
      throw new Error('Flow arithmetic exceeded exact integer limits.');
    progress?.(flow);
  }
  return { flow, cost };
}
export type Certificate = {
  nodes: string[];
  potentials: number[];
  sourceSide: string[];
  cutEdges: {
    from: string;
    to: string;
    capacity: number;
    kind: string;
    key: string;
  }[];
  cutCapacity: number;
  flow: number;
  cost: number;
  dualBound: number;
  minimumReducedCost: number;
  residualArcs: number;
};
export function certify(g: Network, flow: number, cost: number): Certificate {
  const n = g.nodes.length,
    balance = Array<number>(n).fill(0);
  let actualCost = 0;
  for (let i = 0; i < g.edges.length; i += 2) {
    const e = g.edges[i],
      f = e.capacity - e.remaining;
    if (
      !Number.isSafeInteger(f) ||
      f < 0 ||
      f > e.capacity ||
      g.edges[e.reverse].remaining !== f
    )
      throw new Error('Flow capacity certificate failed.');
    balance[e.from] += f;
    balance[e.to] -= f;
    actualCost += f * e.cost;
  }
  if (
    actualCost !== cost ||
    balance.some(
      (b, v) => b !== (v === g.source ? flow : v === g.sink ? -flow : 0),
    )
  )
    throw new Error('Flow conservation or cost certificate failed.');
  const reachable = new Set<number>([g.source]),
    queue = [g.source];
  for (let k = 0; k < queue.length; k++)
    for (const i of g.adj[queue[k]]) {
      const e = g.edges[i];
      if (e.remaining > 0 && !reachable.has(e.to)) {
        reachable.add(e.to);
        queue.push(e.to);
      }
    }
  if (reachable.has(g.sink))
    throw new Error('An augmenting path remains; coverage is not maximum.');
  const cutEdges = g.edges
    .filter(
      (e, i) =>
        i % 2 === 0 &&
        e.capacity > 0 &&
        reachable.has(e.from) &&
        !reachable.has(e.to),
    )
    .map((e) => ({
      from: g.nodes[e.from],
      to: g.nodes[e.to],
      capacity: e.capacity,
      kind: e.kind,
      key: e.key,
    }));
  const cutCapacity = cutEdges.reduce((s, e) => s + e.capacity, 0);
  if (cutCapacity !== flow)
    throw new Error('Maximum-flow/minimum-cut certificate failed.');
  // Implicit zero-cost supersource reaches EVERY residual vertex, not just those reachable from the flow source.
  const potentials = Array<number>(n).fill(0);
  for (let k = 0; k < n; k++) {
    let changed = false;
    for (const e of g.edges)
      if (e.remaining > 0 && potentials[e.to] > potentials[e.from] + e.cost) {
        potentials[e.to] = potentials[e.from] + e.cost;
        changed = true;
      }
    if (!changed) break;
    if (k === n - 1)
      throw new Error(
        'Negative residual cycle: the schedule is not minimum-cost.',
      );
  }
  let minimumReducedCost = Infinity,
    residualArcs = 0;
  for (const e of g.edges)
    if (e.remaining > 0) {
      const reduced = e.cost + potentials[e.from] - potentials[e.to];
      if (reduced < 0 || !Number.isSafeInteger(reduced))
        throw new Error('Optimal-cost certificate failed.');
      minimumReducedCost = Math.min(minimumReducedCost, reduced);
      residualArcs++;
    }
  const dualBound =
    g.edges.reduce(
      (s, e, i) =>
        s +
        (i % 2 === 0
          ? e.capacity *
            Math.min(0, e.cost + potentials[e.from] - potentials[e.to])
          : 0),
      0,
    ) -
    flow * (potentials[g.source] - potentials[g.sink]);
  if (dualBound !== cost) throw new Error('Primal and dual costs disagree.');
  return {
    nodes: [...g.nodes],
    potentials,
    sourceSide: [...reachable].map((i) => g.nodes[i]),
    cutEdges,
    cutCapacity,
    flow,
    cost,
    dualBound,
    minimumReducedCost: Number.isFinite(minimumReducedCost)
      ? minimumReducedCost
      : 0,
    residualArcs,
  };
}
