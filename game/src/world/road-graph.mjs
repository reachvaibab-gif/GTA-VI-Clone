// Pure road topology shared by GPS and traffic. Coordinates are metres, X/Z.
const EPSILON = 0.001;
const clamp01 = value => Math.max(0, Math.min(1, value));
const validPoint = point => point && Number.isFinite(point.x) && Number.isFinite(point.z);
const distance = (a, b) => Math.hypot(b.x - a.x, b.z - a.z);

export function projectToSegment(point, a, b) {
  const dx = b.x - a.x, dz = b.z - a.z, length2 = dx * dx + dz * dz;
  const t = length2 > 0 ? clamp01(((point.x - a.x) * dx + (point.z - a.z) * dz) / length2) : 0;
  const x = a.x + dx * t, z = a.z + dz * t;
  return { x, z, t, distance: Math.hypot(point.x - x, point.z - z) };
}

/** Split crossings, T-junctions and collinear overlaps without moving source coordinates. */
export function splitRoadSegments(segments) {
  const roads = segments.filter(s => Array.isArray(s.a) && Array.isArray(s.b)
    && [...s.a, ...s.b].every(Number.isFinite)
    && Math.hypot(s.b[0] - s.a[0], s.b[1] - s.a[1]) > EPSILON);
  const cuts = roads.map(() => [0, 1]);
  const point = p => ({ x: p[0], z: p[1] });
  for (let i = 0; i < roads.length; i++) {
    const a = roads[i], aa = point(a.a), ab = point(a.b);
    for (let j = i + 1; j < roads.length; j++) {
      const b = roads[j], ba = point(b.a), bb = point(b.b);
      const ax = ab.x - aa.x, az = ab.z - aa.z, bx = bb.x - ba.x, bz = bb.z - ba.z;
      const det = ax * bz - az * bx;
      if (Math.abs(det) > 1e-8) {
        const dx = ba.x - aa.x, dz = ba.z - aa.z;
        const t = (dx * bz - dz * bx) / det, u = (dx * az - dz * ax) / det;
        if (t >= 0 && t <= 1 && u >= 0 && u <= 1) { cuts[i].push(t); cuts[j].push(u); }
      }
      // Endpoint projections also handle parallel segments sharing only part of a road.
      for (const p of [ba, bb]) { const hit = projectToSegment(p, aa, ab); if (hit.distance <= EPSILON) cuts[i].push(hit.t); }
      for (const p of [aa, ab]) { const hit = projectToSegment(p, ba, bb); if (hit.distance <= EPSILON) cuts[j].push(hit.t); }
    }
  }
  return roads.flatMap((s, index) => {
    const length = Math.hypot(s.b[0] - s.a[0], s.b[1] - s.a[1]);
    const ts = cuts[index].sort((a, b) => a - b).filter((t, i, all) => !i || (t - all[i - 1]) * length > EPSILON);
    const pieces = [];
    for (let i = 1; i < ts.length; i++) {
      const a = [s.a[0] + (s.b[0] - s.a[0]) * ts[i - 1], s.a[1] + (s.b[1] - s.a[1]) * ts[i - 1]];
      const b = [s.a[0] + (s.b[0] - s.a[0]) * ts[i], s.a[1] + (s.b[1] - s.a[1]) * ts[i]];
      pieces.push({ ...s, id: `${s.id ?? index}@${i - 1}`, sourceId: s.id ?? String(index), a, b,
        length: Math.hypot(b[0] - a[0], b[1] - a[1]), yaw: Math.atan2(b[0] - a[0], b[1] - a[1]) });
    }
    return pieces;
  });
}

export function buildRoadGraph(segments) {
  const nodes = [], lookup = new Map();
  const node = (x, z) => {
    const key = `${Math.round(x / EPSILON)},${Math.round(z / EPSILON)}`;
    if (lookup.has(key)) return lookup.get(key);
    const id = nodes.length; nodes.push({ id, x, z, edges: [] }); lookup.set(key, id); return id;
  };
  for (const s of splitRoadSegments(segments)) {
    const a = node(...s.a), b = node(...s.b);
    if (a === b) continue;
    const cost = distance(nodes[a], nodes[b]);
    for (const [from, to] of [[a, b], [b, a]]) {
      // Overlapping road definitions must not multiply traffic choices or graph cost.
      if (!nodes[from].edges.some(edge => edge.to === to)) nodes[from].edges.push({ to, cost });
    }
  }
  return nodes;
}

export function nearestNode(x, z, nodes) {
  let best = -1, closest = Infinity;
  for (const n of nodes) { const d = Math.hypot(n.x - x, n.z - z); if (d < closest) { closest = d; best = n.id; } }
  return best;
}

export function nearestEdge(point, nodes) {
  let best = null;
  for (const a of nodes) for (const edge of a.edges) {
    if (edge.to <= a.id) continue;
    const b = nodes[edge.to];
    if (!b) continue;
    const hit = projectToSegment(point, a, b);
    if (!best || hit.distance < best.distance) best = { ...hit, a: a.id, b: b.id, length: distance(a, b) };
  }
  return best;
}

/** Attach both endpoints to the road surface, not the nearest intersection. */
export function routeBetween(start, end, nodes) {
  if (!validPoint(start) || !validPoint(end) || !nodes.length) return [];
  const source = nearestEdge(start, nodes), target = nearestEdge(end, nodes);
  if (!source || !target) return [];
  const costs = nodes.map(() => Infinity), previous = nodes.map(() => -1), visited = new Set();
  costs[source.a] = source.t * source.length;
  costs[source.b] = (1 - source.t) * source.length;
  for (let step = 0; step < nodes.length; step++) {
    let at = -1, best = Infinity;
    for (let i = 0; i < nodes.length; i++) if (!visited.has(i) && costs[i] < best) { at = i; best = costs[i]; }
    if (at < 0) break;
    visited.add(at);
    for (const edge of nodes[at].edges) {
      const cost = costs[at] + edge.cost;
      if (cost < costs[edge.to]) { costs[edge.to] = cost; previous[edge.to] = at; }
    }
  }
  let at = costs[target.a] + target.t * target.length <= costs[target.b] + (1 - target.t) * target.length ? target.a : target.b;
  const viaCost = costs[at] + (at === target.a ? target.t : 1 - target.t) * target.length;
  let path = [];
  if (source.a === target.a && source.b === target.b && Math.abs(source.t - target.t) * source.length <= viaCost) {
    path = [source, target];
  } else {
    if (!Number.isFinite(viaCost)) return [];
    for (let guard = 0; at >= 0 && guard < nodes.length; guard++, at = previous[at]) path.push(nodes[at]);
    path.reverse(); path = [source, ...path, target];
  }
  const result = [];
  for (const p of [start, ...path, end]) {
    if (!result.length || distance(result[result.length - 1], p) > EPSILON) result.push({ x: p.x, z: p.z });
  }
  return result;
}
