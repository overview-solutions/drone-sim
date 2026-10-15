import { LIMIT, type Point, type Zone } from "../types";
export const distance = (a: Point, b: Point) =>
  Math.hypot(a.x - b.x, a.y - b.y);
const cross = (a: Point, b: Point, c: Point) =>
  (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
export function pointSegment(p: Point, a: Point, b: Point): number {
  const d = (b.x - a.x) ** 2 + (b.y - a.y) ** 2;
  const t = d
    ? Math.max(
        0,
        Math.min(
          1,
          ((p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y)) / d,
        ),
      )
    : 0;
  return distance(p, { x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) });
}
export function intersects(a: Point, b: Point, c: Point, d: Point): boolean {
  if (
    Math.min(
      pointSegment(a, c, d),
      pointSegment(b, c, d),
      pointSegment(c, a, b),
      pointSegment(d, a, b),
    ) < 1e-7
  )
    return true;
  return (
    cross(a, b, c) * cross(a, b, d) < 0 && cross(c, d, a) * cross(c, d, b) < 0
  );
}
export function inside(p: Point, vs: Point[]): boolean {
  let yes = false;
  for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
    const a = vs[i],
      b = vs[j];
    if (pointSegment(p, a, b) < 1e-7) return true;
    if (
      a.y > p.y !== b.y > p.y &&
      p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x
    )
      yes = !yes;
  }
  return yes;
}
export function clearSegment(
  a: Point,
  b: Point,
  zones: Zone[],
  margin: number,
): boolean {
  if ([a, b].some((p) => Math.abs(p.x) > LIMIT || Math.abs(p.y) > LIMIT))
    return false;
  return zones.every(
    (z) =>
      !inside(a, z.vertices) &&
      !inside(b, z.vertices) &&
      z.vertices.every((c, i) => {
        const d = z.vertices[(i + 1) % z.vertices.length];
        return (
          !intersects(a, b, c, d) &&
          Math.min(
            pointSegment(a, c, d),
            pointSegment(b, c, d),
            pointSegment(c, a, b),
            pointSegment(d, a, b),
          ) > margin
        );
      }),
  );
}
export function validPolygon(v: Point[]): boolean {
  if (
    v.length < 3 ||
    v.some(
      (p) =>
        !Number.isFinite(p.x) ||
        !Number.isFinite(p.y) ||
        Math.abs(p.x) > LIMIT ||
        Math.abs(p.y) > LIMIT,
    )
  )
    return false;
  let area = 0;
  for (let i = 0; i < v.length; i++) {
    const a = v[i],
      b = v[(i + 1) % v.length];
    if (distance(a, b) < 5) return false;
    area += a.x * b.y - b.x * a.y;
    for (let j = i + 1; j < v.length; j++) {
      if (j === i + 1 || (i === 0 && j === v.length - 1)) continue;
      if (intersects(a, b, v[j], v[(j + 1) % v.length])) return false;
    }
  }
  return Math.abs(area) > 50;
}
