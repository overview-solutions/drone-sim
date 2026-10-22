import { radius, type Mission, type Pose, type Route } from "../types";
import { dubins } from "./dubins";
import { clearSegment, distance } from "./geometry";
import { constrainPath } from "./corridor";
export type RecoveryStage =
  "normal" | "search" | "retrace" | "tight-turn" | "direct" | "unresolved";
export const RECOVERY_SECONDS = 8;
type GoodRoute = Extract<Route, { ok: true }>;
function checked(points: Pose[], m: Mission, corridor = true): boolean {
  if (!points.length) return false;
  return (
    (!corridor || constrainPath(points, points[0], points.at(-1)!, m)) &&
    points.every((p, i) =>
      clearSegment(i ? points[i - 1] : p, p, m.zones, m.settings.clearance + 1),
    )
  );
}
function route(points: Pose[]): GoodRoute {
  return {
    ok: true,
    points,
    length: points.reduce(
      (sum, p, i) => sum + (i ? distance(points[i - 1], p) : 0),
      0,
    ),
    checkpoints: [],
  };
}
/** Revalidate actual flown history in reverse, including a forward-flight entry turn. */
export function retrace(
  pose: Pose,
  history: Pose[],
  m: Mission,
  tight = false,
): GoodRoute | undefined {
  if (history.length < 2) return;
  const reversed = history
    .map((p) => ({ ...p, heading: p.heading + Math.PI }))
    .reverse();
  // At most 12 rejoin candidates, all on the most recent 600 m of flown history.
  let traveled = 0,
    tested = 0,
    lastTest = -Infinity;
  for (let i = 0; i < reversed.length; i++) {
    if (i) traveled += distance(reversed[i - 1], reversed[i]);
    if (traveled > 600 || tested >= 12) break;
    if (traveled - lastTest < 50) continue;
    lastTest = traveled;
    tested++;
    const tail = reversed
      .slice(i)
      .map((p, j) => ({
        ...p,
        turning: j > 0 ? reversed[i + j - 1].turning : p.turning,
      }));
    if (!checked(tail, m)) continue;
    for (const candidate of dubins(
      pose,
      tail[0],
      tight ? 10 : radius(m.settings),
    )) {
      candidate.points.forEach((p) => {
        p.heightAboveLine = pose.heightAboveLine;
        p.altitude = pose.altitude;
      });
      candidate.points.at(-1)!.heightAboveLine = tail[0].heightAboveLine;
      if (checked(candidate.points, m))
        return route([...candidate.points, ...tail.slice(1)]);
    }
  }
}
/** Final simulated emergency: straight chord, with an instantaneous heading change.
 * Radius and corridor are overridden, but exclusion + clearance remain mandatory.
 */
export function emergencyDirect(pose: Pose, m: Mission): GoodRoute | undefined {
  const length = distance(pose, m.home),
    n = Math.max(1, Math.ceil(length / 5));
  const heading = Math.atan2(m.home.y - pose.y, m.home.x - pose.x);
  const points = Array.from({ length: n + 1 }, (_, i) => {
    const t = i / n;
    return {
      x: pose.x + (m.home.x - pose.x) * t,
      y: pose.y + (m.home.y - pose.y) * t,
      heading: i === 0 ? pose.heading : heading,
      turning: false,
      heightAboveLine: pose.heightAboveLine,
      altitude: pose.altitude,
    };
  });
  return checked(points, m, false) ? route(points) : undefined;
}
export function fallback(
  pose: Pose,
  history: Pose[],
  m: Mission,
): { stage: RecoveryStage; route?: GoodRoute; attempts: RecoveryStage[] } {
  const attempts: RecoveryStage[] = [];
  for (const stage of ["retrace", "tight-turn", "direct"] as const) {
    attempts.push(stage);
    const result =
      stage === "direct"
        ? emergencyDirect(pose, m)
        : retrace(pose, history, m, stage === "tight-turn");
    if (result) return { stage, route: result, attempts };
  }
  return { stage: "unresolved", attempts };
}
