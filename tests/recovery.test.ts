import { test } from "node:test";
import assert from "node:assert/strict";
import { corridorDemo, type Pose } from "../src/types";
import {
  retrace,
  emergencyDirect,
  fallback,
  RECOVERY_SECONDS,
} from "../src/planning/recovery";
import { clearSegment, distance } from "../src/planning/geometry";
const history: Pose[] = Array.from({ length: 101 }, (_, i) => ({
  x: -1200 + i * 10,
  y: 0,
  heading: 0,
  heightAboveLine: 30,
}));
test("retrace connects current pose to reverse history without teleporting", () => {
  const m = corridorDemo(),
    pose = history.at(-1)!;
  const r = retrace(pose, history, m);
  assert.ok(r);
  assert.ok(distance(r.points[0], pose) < 1e-6);
  assert.ok(distance(r.points.at(-1)!, m.home) < 1e-6);
  assert.ok(
    r.points.every((p, i) =>
      clearSegment(
        i ? r.points[i - 1] : p,
        p,
        m.zones,
        m.settings.clearance + 1,
      ),
    ),
  );
});
test("emergency direct never crosses an exclusion even when other rules are overridden", () => {
  const m = corridorDemo();
  m.zones = [
    {
      id: "barrier",
      vertices: [
        { x: -800, y: -500 },
        { x: -700, y: -500 },
        { x: -700, y: 500 },
        { x: -800, y: 500 },
      ],
    },
  ];
  assert.equal(emergencyDirect(history.at(-1)!, m), undefined);
  assert.equal(fallback(history.at(-1)!, history, m).stage, "unresolved");
});
test("fallback order selects checked retrace before relaxing rules", () => {
  const m = corridorDemo();
  const r = fallback(history.at(-1)!, history, m);
  assert.equal(r.stage, "retrace");
  assert.deepEqual(r.attempts, ["retrace"]);
  assert.equal(RECOVERY_SECONDS, 8);
});
test("direct emergency is explicitly the last fallback when history is unavailable", () => {
  const r = fallback(history.at(-1)!, [], corridorDemo());
  assert.equal(r.stage, "direct");
  assert.deepEqual(r.attempts, ["retrace", "tight-turn", "direct"]);
  assert.ok(r.route);
});
test("tight-turn override is selected when normal radius cannot fit the corridor", () => {
  const m = corridorDemo();
  m.settings.speed = 45;
  m.settings.bank = 15;
  const result = fallback(history.at(-1)!, history, m);
  assert.equal(result.stage, "tight-turn");
  assert.ok(result.route);
  assert.deepEqual(result.attempts, ["retrace", "tight-turn"]);
});
