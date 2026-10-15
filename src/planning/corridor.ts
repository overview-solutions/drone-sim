import {
  CORRIDOR,
  type Mission,
  type Point,
  type Pose,
  type TransmissionLine,
} from "../types";
import { distance } from "./geometry";
/** Horizontal nearest point, with conductor elevation interpolated on that segment. */
export function nearestLine(p: Point, line: TransmissionLine) {
  let best = { distance: Infinity, elevation: NaN, x: NaN, y: NaN };
  for (let i = 1; i < line.vertices.length; i++) {
    const a = line.vertices[i - 1],
      b = line.vertices[i];
    const length2 = (b.x - a.x) ** 2 + (b.y - a.y) ** 2;
    const t = length2
      ? Math.max(
          0,
          Math.min(
            1,
            ((p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y)) / length2,
          ),
        )
      : 0;
    const q = { x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) };
    const d = distance(p, q);
    if (d < best.distance)
      best = {
        ...q,
        distance: d,
        elevation: a.elevation + t * (b.elevation - a.elevation),
      };
  }
  return best;
}
export function corridorEndpoint(
  p: Point,
  height: number,
  m: Mission,
): string | undefined {
  if (!m.transmission?.enabled) return;
  if (!Number.isFinite(height) || height < 0 || height > CORRIDOR.vertical)
    return "Height must be 0–200 ft above the conductor.";
  if (nearestLine(p, m.transmission).distance > CORRIDOR.straight)
    return "Home and mission waypoints must lie within 200 ft laterally of the line.";
}
/** Check every chord continuously using the 1-Lipschitz distance bound, plus arc sagitta reserve. */
export function chordWithin(
  a: Point,
  b: Point,
  limit: number,
  line: TransmissionLine,
  depth = 0,
): boolean {
  const da = nearestLine(a, line).distance,
    db = nearestLine(b, line).distance;
  if (Math.max(da, db) > limit) return false;
  if (Math.max(da, db) + distance(a, b) / 2 <= limit) return true;
  if (depth >= 10) return false; // conservatively reject unresolved boundary contact
  const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  return (
    chordWithin(a, mid, limit, line, depth + 1) &&
    chordWithin(mid, b, limit, line, depth + 1)
  );
}
export function constrainPath(
  points: Pose[],
  start: Pose,
  end: Pose,
  m: Mission,
): boolean {
  const line = m.transmission;
  if (!line?.enabled) return true;
  const h0 = start.heightAboveLine,
    h1 = end.heightAboveLine;
  if (
    h0 === undefined ||
    h1 === undefined ||
    ![h0, h1].every(
      (h) => Number.isFinite(h) && h >= 0 && h <= CORRIDOR.vertical,
    )
  )
    return false;
  const total = points
    .slice(1)
    .reduce((sum, p, i) => sum + distance(points[i], p), 0);
  let walked = 0;
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    if (i) {
      const a = points[i - 1];
      walked += distance(a, p);
      const limit = p.turning ? CORRIDOR.turn - 0.25 : CORRIDOR.straight - 0.01;
      if (!chordWithin(a, p, limit, line)) return false;
    }
    p.heightAboveLine = h0 + (h1 - h0) * (total ? walked / total : 0);
    p.altitude = nearestLine(p, line).elevation + p.heightAboveLine;
  }
  return true;
}
