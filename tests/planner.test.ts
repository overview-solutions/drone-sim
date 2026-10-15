import { test } from "node:test";
import assert from "node:assert/strict";
import { demo, radius, type Pose } from "../src/types";
import { planner, validate } from "../src/planning/planner";
import { clearSegment, distance, validPolygon } from "../src/planning/geometry";
import { dubins, wrap } from "../src/planning/dubins";
import { Simulator } from "../src/simulator";

test("Dubins endpoints and curvature across varied start/end poses", () => {
  for (let i = 0; i < 30; i++) {
    const start: Pose = { x: 0, y: 0, heading: i * 0.47 },
      end: Pose = {
        x: 100 + Math.sin(i) * 900,
        y: Math.cos(i * 0.7) * 800,
        heading: i * 0.91,
      };
    const paths = dubins(start, end, 100);
    assert.ok(paths.length > 0);
    for (const p of paths) {
      assert.ok(distance(p.points.at(-1)!, end) < 0.01);
      assert.ok(
        Math.abs(
          wrap(p.points.at(-1)!.heading - end.heading + Math.PI) - Math.PI,
        ) < 1e-6,
      );
      for (let j = 1; j < p.points.length; j++) {
        const a = p.points[j - 1],
          b = p.points[j],
          d = distance(a, b);
        if (d > 1e-6)
          assert.ok(
            Math.abs(wrap(b.heading - a.heading + Math.PI) - Math.PI) / d <=
              0.01001,
          );
      }
    }
  }
});
test("example routes around exclusion and reaches each waypoint", () => {
  const m = demo(),
    r = planner.mission(m);
  assert.ok(r.ok, r.ok ? "" : r.reason);
  if (!r.ok) return;
  assert.equal(r.checkpoints.length, 3);
  r.checkpoints.forEach((cp, i) =>
    assert.ok(distance(r.points[cp], m.waypoints[i]) < 0.01),
  );
  for (let i = 1; i < r.points.length; i++)
    assert.ok(
      clearSegment(r.points[i - 1], r.points[i], m.zones, m.settings.clearance),
    );
  assert.ok(r.length > 4000);
});
test("return paths from representative mission positions preserve heading", () => {
  const m = demo(),
    r = planner.mission(m);
  assert.ok(r.ok);
  if (!r.ok) return;
  for (const t of [0.1, 0.3, 0.5, 0.8, 1]) {
    const p: Pose = r.points[Math.floor((r.points.length - 1) * t)];
    const home = planner.returnHome(p, m);
    assert.ok(home.ok, home.ok ? "" : home.reason);
    if (!home.ok) continue;
    assert.equal(home.points[0].heading, p.heading);
    assert.ok(distance(home.points.at(-1)!, m.home) < 0.01);
    assert.ok(
      home.points.every((v, i) =>
        clearSegment(
          i ? home.points[i - 1] : v,
          v,
          m.zones,
          m.settings.clearance,
        ),
      ),
    );
  }
});
test("home enclosed by exclusion yields explicit no route", () => {
  const m = demo(),
    h = m.home;
  m.zones.push({
    id: "blocked",
    vertices: [
      { x: h.x - 200, y: h.y - 200 },
      { x: h.x + 200, y: h.y - 200 },
      { x: h.x + 200, y: h.y + 200 },
      { x: h.x - 200, y: h.y + 200 },
    ],
  });
  assert.equal(planner.mission(m).ok, false);
  assert.equal(planner.returnHome({ ...h, x: h.x + 700 }, m).ok, false);
  assert.equal(planner.returnHome(h, m).ok, false);
});
test("invalid and degenerate geometry rejected", () => {
  assert.equal(
    validPolygon([
      { x: 0, y: 0 },
      { x: 100, y: 100 },
      { x: 0, y: 100 },
      { x: 100, y: 0 },
    ]),
    false,
  );
  assert.equal(
    validPolygon([
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 20, y: 0 },
    ]),
    false,
  );
  const m = demo();
  m.settings.speed = NaN;
  assert.ok(validate(m));
  m.settings.speed = 24;
  m.waypoints[0].x = 10000;
  assert.ok(validate(m));
});
test("clearance detects edge crossings and near misses", () => {
  const z = [
    {
      id: "a",
      vertices: [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 100, y: 100 },
        { x: 0, y: 100 },
      ],
    },
  ];
  assert.equal(
    clearSegment({ x: -100, y: 50 }, { x: 200, y: 50 }, z, 10),
    false,
  );
  assert.equal(
    clearSegment({ x: -100, y: -5 }, { x: 200, y: -5 }, z, 10),
    false,
  );
  assert.equal(
    clearSegment({ x: -100, y: -20 }, { x: 200, y: -20 }, z, 10),
    true,
  );
});
test("bank and speed change radius in expected direction", () => {
  const s = demo().settings;
  assert.ok(radius({ ...s, speed: 30 }) > radius(s));
  assert.ok(radius({ ...s, bank: 40 }) < radius(s));
});
test("simulation pauses, captures once, and terminates without teleporting", () => {
  const m = demo(),
    r = planner.mission(m);
  assert.ok(r.ok);
  if (!r.ok) return;
  const sim = new Simulator(m.home);
  sim.setRoute(r);
  sim.step(0.1, 240, m.waypoints);
  assert.deepEqual(sim.pose, m.home);
  sim.running = true;
  for (let i = 0; i < 10000 && sim.running; i++)
    sim.step(0.1, 240, m.waypoints);
  assert.equal(sim.running, false);
  assert.equal(sim.captured.size, 2);
  assert.ok(distance(sim.pose, m.waypoints.at(-1)!) < 0.01);
  sim.reset(m.home);
  assert.equal(sim.captured.size, 0);
});

test("detours around a skew polygon when home is inside only its expanded box", () => {
  const m = demo();
  m.zones = [
    {
      id: "skew",
      vertices: [
        { x: -1530, y: 720 },
        { x: 400, y: 550 },
        { x: 320, y: -507 },
        { x: -1477, y: -175 },
      ],
    },
  ];
  const route = planner.mission(m);
  assert.ok(route.ok, route.ok ? "" : route.reason);
  if (!route.ok) return;
  assert.ok(
    route.points.every((p, i) =>
      clearSegment(
        i ? route.points[i - 1] : p,
        p,
        m.zones,
        m.settings.clearance,
      ),
    ),
  );
  for (const fraction of [0.1, 0.4, 0.8]) {
    const pose = route.points[Math.floor((route.points.length - 1) * fraction)];
    const rth = planner.returnHome(pose, m);
    assert.ok(rth.ok, rth.ok ? "" : rth.reason);
    if (rth.ok)
      assert.ok(
        rth.points.every((p, i) =>
          clearSegment(
            i ? rth.points[i - 1] : p,
            p,
            m.zones,
            m.settings.clearance,
          ),
        ),
      );
  }
});
