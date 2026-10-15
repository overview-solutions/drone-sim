import type { Pose, Route, Waypoint } from "./types";
import { distance } from "./planning/geometry";
import { wrap } from "./planning/dubins";
/** Pure kinematic playback of sampled, curvature-bounded trajectories. No flight dynamics. */
export class Simulator {
  pose: Pose;
  running = false;
  index = 0;
  fraction = 0;
  traveled = 0;
  captured = new Set<string>();
  route: Extract<Route, { ok: true }> | undefined;
  constructor(home: Pose) {
    this.pose = { ...home };
  }
  reset(home: Pose) {
    this.pose = { ...home };
    this.running = false;
    this.index = 0;
    this.fraction = 0;
    this.traveled = 0;
    this.captured.clear();
    this.route = undefined;
  }
  setRoute(route: Extract<Route, { ok: true }>) {
    this.route = route;
    this.index = 0;
    this.fraction = 0;
    this.traveled = 0;
    this.pose = { ...route.points[0] };
  }
  step(dt: number, speed: number, waypoints: Waypoint[]) {
    if (!this.running || !this.route) return;
    let remaining = Math.min(dt, 0.1) * speed;
    const ps = this.route.points;
    while (remaining > 0 && this.index < ps.length - 1) {
      const a = ps[this.index],
        b = ps[this.index + 1],
        len = distance(a, b),
        left = len * (1 - this.fraction);
      if (remaining >= left) {
        remaining -= left;
        this.traveled += left;
        this.index++;
        this.fraction = 0;
        this.route.checkpoints.forEach((cp, i) => {
          if (cp === this.index && waypoints[i]?.kind === "photo")
            this.captured.add(waypoints[i].id);
        });
      } else {
        this.fraction += remaining / len;
        this.traveled += remaining;
        remaining = 0;
      }
    }
    if (this.index >= ps.length - 1) {
      this.pose = { ...ps.at(-1)! };
      this.running = false;
      return;
    }
    const a = ps[this.index],
      b = ps[this.index + 1],
      t = this.fraction;
    const dh = wrap(b.heading - a.heading + Math.PI) - Math.PI;
    this.pose = {
      x: a.x + (b.x - a.x) * t,
      y: a.y + (b.y - a.y) * t,
      heading: a.heading + dh * t,
      turning: b.turning,
      heightAboveLine:
        a.heightAboveLine === undefined || b.heightAboveLine === undefined
          ? undefined
          : a.heightAboveLine + (b.heightAboveLine - a.heightAboveLine) * t,
      altitude:
        a.altitude === undefined || b.altitude === undefined
          ? undefined
          : a.altitude + (b.altitude - a.altitude) * t,
    };
  }
}
