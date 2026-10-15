import {
  radius,
  CORRIDOR,
  LIMIT,
  type Mission,
  type Planner,
  type Point,
  type Pose,
  type Route,
  type Zone,
  type TransmissionLine,
} from "../types";
import { clearSegment, distance, validPolygon } from "./geometry";
import { dubins } from "./dubins";
import {
  constrainPath,
  corridorEndpoint,
  nearestLine,
  chordWithin,
} from "./corridor";
type Path = { points: Pose[]; length: number };
function connector(
  a: Pose,
  b: Pose,
  r: number,
  zones: Zone[],
  margin: number,
  mission: Mission,
): Path | undefined {
  // Extra 1 m covers the sagitta between arc samples (<=6 m, R>=20 m).
  return dubins(a, b, r).find(
    (p) =>
      constrainPath(p.points, a, b, mission) &&
      p.points.every((v, i) =>
        clearSegment(i ? p.points[i - 1] : v, v, zones, margin + 1),
      ),
  );
}
/** Visibility graph on conservative expanded bounding boxes. Search is deliberately bounded. */
function guide(
  a: Point,
  b: Point,
  zones: Zone[],
  padding: number,
  clearance: number,
  transmission?: TransmissionLine,
): Point[] | undefined {
  const boxes = zones.map((z) => {
    const xs = z.vertices.map((p) => p.x),
      ys = z.vertices.map((p) => p.y);
    const x0 = Math.min(...xs) - padding,
      x1 = Math.max(...xs) + padding,
      y0 = Math.min(...ys) - padding,
      y1 = Math.max(...ys) + padding;
    return {
      id: z.id,
      vertices: [
        { x: x0, y: y0 },
        { x: x1, y: y0 },
        { x: x1, y: y1 },
        { x: x0, y: y1 },
      ],
    };
  });
  // Offset graph vertices slightly outside the search boxes to avoid touching edges.
  const nodes = [
    a,
    b,
    ...(transmission?.enabled ? transmission.vertices : []),
    ...boxes.flatMap((z) => {
      const cx = (z.vertices[0].x + z.vertices[2].x) / 2,
        cy = (z.vertices[0].y + z.vertices[2].y) / 2;
      return z.vertices.map((p) => ({
        x: p.x + Math.sign(p.x - cx) * 2,
        y: p.y + Math.sign(p.y - cy) * 2,
      }));
    }),
  ];
  const costs = nodes.map(() => Infinity),
    prev = nodes.map(() => -1),
    seen = new Set<number>();
  costs[0] = 0;
  for (let k = 0; k < nodes.length; k++) {
    let u = -1;
    for (let i = 0; i < nodes.length; i++)
      if (!seen.has(i) && (u < 0 || costs[i] < costs[u])) u = i;
    if (u < 0 || !Number.isFinite(costs[u])) break;
    if (u === 1) {
      const out: Point[] = [];
      for (let p = 1; p >= 0; p = prev[p]) out.unshift(nodes[p]);
      return out;
    }
    seen.add(u);
    for (let v = 0; v < nodes.length; v++) {
      if (seen.has(v)) continue;
      // Boxes place detour candidates; they are not forbidden airspace.
      // Checking them here traps valid endpoints inside an oversized box.
      if (u === 0 && v === 1) continue; // Direct Dubins candidates already failed.
      if (!clearSegment(nodes[u], nodes[v], zones, clearance + 1)) continue;
      if (
        transmission?.enabled &&
        !chordWithin(nodes[u], nodes[v], CORRIDOR.straight - 0.01, transmission)
      )
        continue;
      const c = costs[u] + distance(nodes[u], nodes[v]);
      if (c < costs[v]) {
        costs[v] = c;
        prev[v] = u;
      }
    }
  }
  return undefined;
}
function leg(a: Pose, b: Pose, m: Mission): Path | undefined {
  const r = radius(m.settings),
    margin = m.settings.clearance,
    z = m.zones;
  const direct = connector(a, b, r, z, margin, m);
  if (direct) return direct;
  if (m.transmission?.enabled) {
    // A single Dubins curve may put its long straight leg outside the narrow
    // corridor. Try a line-aligned approach plus a curved heading change, or
    // the equivalent departure turn, without granting the straight leg 700 ft.
    let best: Path | undefined;
    for (let i = 0; i < 8; i++) {
      const heading = (i * Math.PI) / 4;
      for (const atEnd of [true, false]) {
        const pivot = { ...(atEnd ? b : a), heading };
        const first = connector(a, pivot, r, z, margin, m);
        if (!first) continue;
        const second = connector(pivot, b, r, z, margin, m);
        if (second && (!best || first.length + second.length < best.length))
          best = {
            points: [...first.points, ...second.points.slice(1)],
            length: first.length + second.length,
          };
      }
    }
    if (best) return best;
  }

  for (const factor of [1.5, 3, 5]) {
    const g = guide(a, b, z, margin + factor * r, margin, m.transmission);
    if (!g) continue;
    const layers: Pose[][] = g.map((p, i) => {
      if (i === 0) return [a];
      if (i === g.length - 1) return [b];
      const before = g[i - 1],
        after = g[i + 1];
      const h = Math.atan2(after.y - before.y, after.x - before.x);
      return [
        0,
        -Math.PI / 4,
        Math.PI / 4,
        -Math.PI / 2,
        Math.PI / 2,
        Math.atan2(p.y - before.y, p.x - before.x) - h,
        Math.atan2(after.y - p.y, after.x - p.x) - h,
      ].map((offset) => ({
        ...p,
        heading: h + offset,
        heightAboveLine: a.heightAboveLine,
      }));
    });
    let states: { pose: Pose; path: Path }[] = [
      { pose: a, path: { points: [a], length: 0 } },
    ];
    for (let i = 1; i < layers.length; i++) {
      const next: typeof states = [];
      for (const target of layers[i]) {
        let best: Path | undefined;
        for (const s of states) {
          let edge = connector(s.pose, target, r, z, margin, m);
          // Long winding returns also need a departure reversal before following
          // the corridor graph. Validate both parts with the same constraints.
          if (!edge && m.transmission?.enabled && i === 1) {
            const pivot = {
              ...s.pose,
              heading: Math.atan2(target.y - s.pose.y, target.x - s.pose.x),
            };
            const turn = connector(s.pose, pivot, r, z, margin, m);
            const onward = turn && connector(pivot, target, r, z, margin, m);
            if (turn && onward)
              edge = {
                points: [...turn.points, ...onward.points.slice(1)],
                length: turn.length + onward.length,
              };
          }
          if (edge && (!best || s.path.length + edge.length < best.length))
            best = {
              points: [...s.path.points, ...edge.points.slice(1)],
              length: s.path.length + edge.length,
            };
        }
        if (best) next.push({ pose: target, path: best });
      }
      states = next;
      if (!states.length) break;
    }
    if (states.length)
      return states.sort((x, y) => x.path.length - y.path.length)[0].path;
  }
  return undefined;
}
export function validate(m: Mission): string | undefined {
  if (
    m.version !== 1 ||
    !Array.isArray(m.waypoints) ||
    !Array.isArray(m.zones) ||
    !m.home ||
    !m.settings
  )
    return "Invalid mission format.";
  if (m.waypoints.length > 20 || m.zones.length > 8)
    return "Limit: 20 waypoints and 8 exclusion zones.";
  const { speed, bank, clearance } = m.settings;
  if (
    ![speed, bank, clearance].every(Number.isFinite) ||
    speed < 12 ||
    speed > 45 ||
    bank < 15 ||
    bank > 45 ||
    clearance < 10 ||
    clearance > 300
  )
    return "Settings outside supported range.";
  if (!Number.isFinite(m.home.heading)) return "Invalid home heading.";
  if (
    [m.home, ...m.waypoints].some(
      (p) =>
        !Number.isFinite(p.x) ||
        !Number.isFinite(p.y) ||
        Math.abs(p.x) > LIMIT ||
        Math.abs(p.y) > LIMIT,
    )
  )
    return "Keep home and waypoints inside the 7 × 7 km planning area.";
  if (m.transmission?.enabled) {
    const vertices = m.transmission.vertices;
    if (
      !Array.isArray(vertices) ||
      vertices.length < 2 ||
      vertices.length > 30 ||
      vertices.some(
        (v, i) =>
          ![v.x, v.y, v.elevation].every(Number.isFinite) ||
          Math.abs(v.x) > LIMIT ||
          Math.abs(v.y) > LIMIT ||
          Math.abs(v.elevation) > 10000 ||
          (i > 0 && distance(v, vertices[i - 1]) < 10),
      )
    )
      return "Transmission line needs 2–30 vertices, finite elevations, and segments at least 10 m long within the area.";
    const homeError = corridorEndpoint(
      m.home,
      m.home.heightAboveLine ?? NaN,
      m,
    );
    if (homeError) return `Home: ${homeError}`;
    for (let i = 0; i < m.waypoints.length; i++) {
      const error = corridorEndpoint(
        m.waypoints[i],
        m.waypoints[i].altitude,
        m,
      );
      if (error) return `Waypoint ${i + 1}: ${error}`;
    }
  }
  if (
    m.waypoints.some(
      (p) =>
        !["nav", "photo"].includes(p.kind) ||
        !Number.isFinite(p.altitude) ||
        p.altitude < (m.transmission?.enabled ? 0 : 30) ||
        p.altitude > (m.transmission?.enabled ? CORRIDOR.vertical : 300),
    )
  )
    return "Waypoint altitude must be 30–300 m.";
  if (
    m.zones.some(
      (z) =>
        !Array.isArray(z.vertices) ||
        z.vertices.length > 40 ||
        !validPolygon(z.vertices),
    )
  )
    return "Invalid exclusion polygon: needs 3–40 distinct vertices, nonzero area, and no crossing edges.";
  return undefined;
}
export const planner: Planner = {
  mission(m) {
    const error = validate(m);
    if (error) return { ok: false, reason: error };
    if (!m.waypoints.length)
      return { ok: false, reason: "Add at least one waypoint." };
    let pose = { ...m.home };
    if (m.transmission?.enabled)
      pose.altitude =
        nearestLine(pose, m.transmission).elevation + pose.heightAboveLine!;
    const points: Pose[] = [pose],
      checkpoints: number[] = [];
    let length = 0;
    for (let i = 0; i < m.waypoints.length; i++) {
      const w = m.waypoints[i],
        next = m.waypoints[i + 1] ?? m.home;
      const target = {
        x: w.x,
        y: w.y,
        heading: Math.atan2(next.y - w.y, next.x - w.x),
        heightAboveLine: m.transmission?.enabled ? w.altitude : undefined,
      };
      if (distance(pose, target) < 10)
        return {
          ok: false,
          reason: `Waypoint ${i + 1} is too close to the previous point (minimum 10 m).`,
        };
      const path = leg(pose, target, m);
      if (!path)
        return {
          ok: false,
          reason: `No feasible route to waypoint ${i + 1}. Move points/zones or adjust turn and clearance settings. ${m.transmission?.enabled ? "Corridor: 200 ft straight, 700 ft during turns, 0–200 ft above conductor. " : ""}Bounded search is not proof that no path exists.`,
        };
      points.push(...path.points.slice(1));
      length += path.length;
      checkpoints.push(points.length - 1);
      pose = target;
    }
    return { ok: true, points, length, checkpoints };
  },
  returnHome(pose, m): Route {
    const error = validate(m);
    if (error) return { ok: false, reason: error };
    if (![pose.x, pose.y, pose.heading].every(Number.isFinite))
      return { ok: false, reason: "Invalid aircraft pose." };
    if (
      m.transmission?.enabled &&
      (!Number.isFinite(pose.heightAboveLine) ||
        pose.heightAboveLine! < 0 ||
        pose.heightAboveLine! > CORRIDOR.vertical)
    )
      return {
        ok: false,
        reason:
          "Current aircraft height is outside 0–200 ft above the conductor.",
      };
    if (
      distance(pose, m.home) < 2 &&
      clearSegment(pose, pose, m.zones, m.settings.clearance + 1)
    )
      return { ok: true, points: [pose], length: 0, checkpoints: [] };
    // Prefer arrival opposite the launch heading for a winding corridor.
    // A checked candidate is sufficient; exhaustive arrival-heading search is
    // expensive for the local-file planner and does not prove global optimality.
    if (m.transmission?.enabled) {
      const candidate = leg(
        pose,
        { ...m.home, heading: m.home.heading + Math.PI },
        m,
      );
      if (candidate) return { ok: true, ...candidate, checkpoints: [] };
    }
    let best: Path | undefined;
    for (let i = 0; i < 8; i++) {
      const p = leg(pose, { ...m.home, heading: (i * Math.PI) / 4 }, m);
      if (p && (!best || p.length < best.length)) best = p;
    }
    return best
      ? { ok: true, ...best, checkpoints: [] }
      : {
          ok: false,
          reason:
            "No feasible return path found. Simulation paused. Move exclusions or reset. Search is bounded; no safety guarantee.",
        };
  },
};
