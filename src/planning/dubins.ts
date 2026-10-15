import type { Pose } from "../types";
const TAU = 2 * Math.PI;
export const wrap = (a: number) => ((a % TAU) + TAU) % TAU;
type Candidate = { turns: string; lengths: number[] };
/** Six analytic Dubins families, sampled at <= 6 m. Constant-radius planar approximation. */
export function dubins(
  start: Pose,
  end: Pose,
  r: number,
): { points: Pose[]; length: number }[] {
  const dx = (end.x - start.x) / r,
    dy = (end.y - start.y) / r,
    d = Math.hypot(dx, dy),
    theta = Math.atan2(dy, dx),
    a = wrap(start.heading - theta),
    b = wrap(end.heading - theta),
    sa = Math.sin(a),
    sb = Math.sin(b),
    ca = Math.cos(a),
    cb = Math.cos(b),
    cab = Math.cos(a - b);
  const candidates: Candidate[] = [];
  const add = (turns: string, t: number, p: number, q: number) => {
    if ([t, p, q].every(Number.isFinite))
      candidates.push({ turns, lengths: [wrap(t), p, wrap(q)] });
  };
  let p2 = 2 + d * d - 2 * cab + 2 * d * (sa - sb);
  if (p2 >= 0) {
    const t = Math.atan2(cb - ca, d + sa - sb);
    add("LSL", -a + t, Math.sqrt(p2), b - t);
  }
  p2 = 2 + d * d - 2 * cab + 2 * d * (sb - sa);
  if (p2 >= 0) {
    const t = Math.atan2(ca - cb, d - sa + sb);
    add("RSR", a - t, Math.sqrt(p2), -b + t);
  }
  p2 = -2 + d * d + 2 * cab + 2 * d * (sa + sb);
  if (p2 >= 0) {
    const p = Math.sqrt(p2),
      t = Math.atan2(-ca - cb, d + sa + sb) - Math.atan2(-2, p);
    add("LSR", -a + t, p, -b + t);
  }
  p2 = d * d - 2 + 2 * cab - 2 * d * (sa + sb);
  if (p2 >= 0) {
    const p = Math.sqrt(p2),
      t = Math.atan2(ca + cb, d - sa - sb) - Math.atan2(2, p);
    add("RSL", a - t, p, b - t);
  }
  let v = (6 - d * d + 2 * cab + 2 * d * (sa - sb)) / 8;
  if (Math.abs(v) <= 1) {
    const p = wrap(TAU - Math.acos(v)),
      t = wrap(a - Math.atan2(ca - cb, d - sa + sb) + p / 2);
    add("RLR", t, p, a - b - t + p);
  }
  v = (6 - d * d + 2 * cab + 2 * d * (-sa + sb)) / 8;
  if (Math.abs(v) <= 1) {
    const p = wrap(TAU - Math.acos(v)),
      t = wrap(-a - Math.atan2(ca - cb, d + sa - sb) + p / 2);
    add("LRL", t, p, b - a - t + p);
  }
  return candidates
    .sort(
      (u, v) =>
        u.lengths.reduce((a, b) => a + b, 0) -
        v.lengths.reduce((a, b) => a + b, 0),
    )
    .map((c) => {
      let pose = { ...start };
      const points: Pose[] = [pose];
      c.lengths.forEach((len, i) => {
        const n = Math.max(1, Math.ceil((len * r) / 6)),
          step = (len * r) / n,
          k = c.turns[i] === "L" ? 1 : c.turns[i] === "R" ? -1 : 0;
        for (let j = 0; j < n; j++) {
          if (step < 1e-9) continue;
          const h = pose.heading + (k * step) / r;
          pose = k
            ? {
                x: pose.x + (r / k) * (Math.sin(h) - Math.sin(pose.heading)),
                y: pose.y + (r / k) * (-Math.cos(h) + Math.cos(pose.heading)),
                heading: h,
                turning: true,
              }
            : {
                x: pose.x + step * Math.cos(h),
                y: pose.y + step * Math.sin(h),
                heading: h,
                turning: false,
              };
          points.push(pose);
        }
      });
      return { points, length: c.lengths.reduce((a, b) => a + b, 0) * r };
    })
    .filter(
      (c) =>
        Math.hypot(c.points.at(-1)!.x - end.x, c.points.at(-1)!.y - end.y) <
        0.01,
    );
}
