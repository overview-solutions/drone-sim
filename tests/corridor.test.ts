import { test } from "node:test";
import assert from "node:assert/strict";
import {
  complexCorridorDemo,
  corridorDemo,
  CORRIDOR,
  FEET,
  type Pose,
} from "../src/types";
import { constrainPath, nearestLine } from "../src/planning/corridor";
import { planner } from "../src/planning/planner";
import { clearSegment } from "../src/planning/geometry";
function verify(points: Pose[], m: ReturnType<typeof corridorDemo>) {
  for (let i = 0; i < points.length; i++) {
    const p = points[i],
      line = nearestLine(p, m.transmission!);
    assert.ok(
      line.distance <= (p.turning ? CORRIDOR.turn : CORRIDOR.straight) + 1e-6,
    );
    assert.ok(
      p.heightAboveLine! >= 0 && p.heightAboveLine! <= CORRIDOR.vertical,
    );
    assert.ok(
      Math.abs(p.altitude! - line.elevation - p.heightAboveLine!) < 1e-7,
    );
    if (i)
      assert.ok(clearSegment(points[i - 1], p, m.zones, m.settings.clearance));
  }
}
test("corridor example respects height and distinct straight/turn limits", () => {
  const m = corridorDemo(),
    r = planner.mission(m);
  assert.ok(r.ok, r.ok ? "" : r.reason);
  if (!r.ok) return;
  verify(r.points, m);
  assert.ok(
    r.points.some(
      (p) =>
        p.turning &&
        nearestLine(p, m.transmission!).distance > CORRIDOR.straight,
    ),
  );
});
test("700 ft allowance never applies to a straight segment", () => {
  const m = corridorDemo(),
    a: Pose = { x: -100, y: 100, heading: 0, heightAboveLine: 30 },
    b = { ...a, x: 100 };
  assert.equal(
    constrainPath([{ ...a }, { ...b, turning: false }], a, b, m),
    false,
  );
  assert.equal(
    constrainPath([{ ...a }, { ...b, turning: true }], a, b, m),
    true,
  );
  const c = { ...a, y: 701 * FEET },
    d = { ...b, y: 701 * FEET };
  assert.equal(
    constrainPath([{ ...c }, { ...d, turning: true }], c, d, m),
    false,
  );
});
test("heights below conductor and above 200 ft are rejected", () => {
  for (const height of [-1, 201 * FEET]) {
    const m = corridorDemo();
    m.waypoints[0].altitude = height;
    const r = planner.mission(m);
    assert.equal(r.ok, false);
    if (!r.ok) assert.match(r.reason, /above the conductor/);
  }
});
test("RTH from straight and expanded turn region respects corridor", () => {
  const m = corridorDemo(),
    r = planner.mission(m);
  assert.ok(r.ok);
  if (!r.ok) return;
  const turn = r.points.find(
    (p) => p.turning && nearestLine(p, m.transmission!).distance > 80,
  )!;
  assert.ok(turn);
  for (const pose of [r.points[200], turn, r.points.at(-1)!]) {
    const home = planner.returnHome(pose, m);
    assert.ok(home.ok, home.ok ? "" : home.reason);
    if (home.ok) verify(home.points, m);
  }
});
test("exclusion spanning the entire turning corridor cannot be crossed", () => {
  const m = corridorDemo();
  m.zones = [
    {
      id: "wall",
      vertices: [
        { x: -80, y: -300 },
        { x: 80, y: -300 },
        { x: 80, y: 300 },
        { x: -80, y: 300 },
      ],
    },
  ];
  assert.equal(planner.mission(m).ok, false);
});
test("nearest conductor elevation interpolates along the line", () => {
  const m = corridorDemo();
  const p = nearestLine({ x: -900, y: 10 }, m.transmission!);
  assert.equal(p.distance, 10);
  assert.equal(p.elevation, 35);
});

test("search follows a bent transmission line rather than cutting across its corridor", () => {
  const m = corridorDemo();
  m.home.y = -600;
  m.waypoints[0].y = 600;
  m.waypoints[1].y = -600;
  m.transmission!.vertices = [
    { x: -1800, y: -600, elevation: 30 },
    { x: -600, y: -600, elevation: 40 },
    { x: 600, y: 600, elevation: 35 },
    { x: 1800, y: 600, elevation: 35 },
  ];
  const r = planner.mission(m);
  assert.ok(r.ok, r.ok ? "" : r.reason);
  if (r.ok) verify(r.points, m);
});
test("distinct home and waypoint heights remain within the vertical envelope", () => {
  const m = corridorDemo();
  m.home.heightAboveLine = 150 * FEET;
  m.waypoints[0].altitude = 80 * FEET;
  const r = planner.mission(m);
  assert.ok(r.ok);
  if (!r.ok) return;
  assert.equal(r.points[0].heightAboveLine, 150 * FEET);
  assert.ok(
    Math.abs(r.points[r.checkpoints[0]].heightAboveLine! - 80 * FEET) < 1e-7,
  );
  verify(r.points, m);
});

test("complex synthetic corridor mission and distributed returns remain feasible", () => {
  const m = complexCorridorDemo();
  const r = planner.mission(m);
  assert.ok(r.ok, r.ok ? "" : r.reason);
  if (!r.ok) return;
  verify(r.points, m);
  for (const fraction of [0.2, 0.4, 0.6, 0.8, 1]) {
    const home = planner.returnHome(
      r.points[Math.floor((r.points.length - 1) * fraction)],
      m,
    );
    assert.ok(home.ok, home.ok ? "" : `At ${fraction}: ${home.reason}`);
    if (home.ok) verify(home.points, m);
  }
});
