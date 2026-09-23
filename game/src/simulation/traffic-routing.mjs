import { splitRoadSegments, projectToSegment } from '../world/road-graph.mjs';
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const angle = (a, b) => Math.atan2(Math.sin(b - a), Math.cos(b - a));
const key = p => `${Math.round(p[0] * 1000)},${Math.round(p[1] * 1000)}`;

/** Build once; traffic must use the same split crossings as the GPS. */
export function createTrafficNetwork(source) {
  const segments = [], seen = new Map(), junctions = new Map();
  for (const road of splitRoadSegments(source)) {
    const a = key(road.a), b = key(road.b), id = [a, b].sort().join('|');
    if (seen.has(id)) {
      const old = segments[seen.get(id)];
      if (road.width > old.width) old.width = road.width;
      continue;
    }
    seen.set(id, segments.length); segments.push(road);
  }
  segments.forEach((s, segment) => {
    for (const [point, direction] of [[s.a, 1], [s.b, -1]]) {
      const id = key(point);
      if (!junctions.has(id)) junctions.set(id, []);
      junctions.get(id).push({ segment, direction });
    }
  });
  return { segments, junctions };
}

export function lanePoint(road, t, direction) {
  const k = clamp(t, 0, 1), offset = direction * road.width * 0.24;
  return { x: road.a[0] + (road.b[0] - road.a[0]) * k - Math.cos(road.yaw) * offset,
    z: road.a[1] + (road.b[1] - road.a[1]) * k + Math.sin(road.yaw) * offset };
}

export function outgoingRoads(network, route) {
  const road = network.segments[route.segment];
  if (!road) return [];
  const point = route.direction > 0 ? road.b : road.a;
  return (network.junctions.get(key(point)) ?? []).filter(next => next.segment !== route.segment);
}

export function chooseNextRoad(network, route, random) {
  const road = network.segments[route.segment];
  if (!road) return null;
  const choices = outgoingRoads(network, route);
  if (!choices.length) return { segment: route.segment, direction: -route.direction };
  const yaw = road.yaw + (route.direction < 0 ? Math.PI : 0);
  const weighted = choices.map(next => {
    const s = network.segments[next.segment], delta = Math.abs(angle(yaw, s.yaw + (next.direction < 0 ? Math.PI : 0)));
    return { next, weight: delta < 0.3 ? 3 : delta > 2.8 ? 0.1 : 1 };
  });
  let roll = clamp(Number.isFinite(random) ? random : 0.5, 0, 0.999999) * weighted.reduce((sum, e) => sum + e.weight, 0);
  for (const e of weighted) { roll -= e.weight; if (roll < 0) return { ...e.next }; }
  return { ...weighted[weighted.length - 1].next };
}

/** Speed-dependent look-ahead follows a lane, including a preview of the upcoming turn. */
export function trafficGuidance(network, route, next, position, speed) {
  const road = network.segments[route.segment];
  if (!road) return null;
  const hit = projectToSegment(position, { x: road.a[0], z: road.a[1] }, { x: road.b[0], z: road.b[1] });
  const remaining = (route.direction > 0 ? 1 - hit.t : hit.t) * road.length;
  const look = clamp(6 + Math.abs(speed) * 0.65, 6, 23);
  let target = lanePoint(road, hit.t + route.direction * look / road.length, route.direction);
  let turn = 0;
  if (next && network.segments[next.segment]) {
    const following = network.segments[next.segment];
    turn = Math.abs(angle(road.yaw + (route.direction < 0 ? Math.PI : 0), following.yaw + (next.direction < 0 ? Math.PI : 0)));
    if (remaining < look) {
      const fraction = Math.min(following.length * 0.45, look - remaining) / following.length;
      target = lanePoint(following, next.direction > 0 ? fraction : 1 - fraction, next.direction);
    }
  }
  const cruise = road.kind === 'highway' ? 24 : road.kind === 'urban' ? 12 : 17;
  const corner = turn > 0.4 ? clamp(10 / (1 + turn * 0.65), 3, 9) : cruise;
  const targetSpeed = Math.min(cruise, Math.sqrt(corner * corner + 2 * 3.5 * Math.max(0, remaining - 12)));
  return { ...target, remaining, targetSpeed,
    advance: remaining < Math.max(2.5, road.width * 0.38) && hit.distance < road.width + 4 };
}

/** Traffic brakes to a stop; it must not shift into reverse while queued. */
export function followControls(speed, targetSpeed, headingError) {
  const target = Math.max(0, Number.isFinite(targetSpeed) ? targetSpeed : 0);
  const velocity = Number.isFinite(speed) ? speed : 0;
  const hold = target < 0.2 && Math.abs(velocity) < 0.45;
  return {
    throttle: hold ? 0 : target < 0.2 && velocity <= 0 ? 0 : clamp((target - velocity) * 0.35, -1, 1),
    steering: clamp((Number.isFinite(headingError) ? headingError : 0) * 1.9, -1, 1),
    handbrake: hold || target < 0.2 && velocity <= 0,
  };
}
