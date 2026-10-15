import { test } from "node:test";
import assert from "node:assert/strict";
import { LocalPlanner } from "../src/planning/local";
import { demo } from "../src/types";
test("standalone local transport returns mission and RTH without workers", async () => {
  const transport = new LocalPlanner(),
    mission = demo();
  const received: number[] = [];
  transport.onmessage = (e) => received.push(e.data.id);
  const result = await new Promise<MessageEvent>((resolve) => {
    transport.addEventListener("message", (e) => resolve(e as MessageEvent), {
      once: true,
    });
    transport.postMessage({
      id: 1,
      type: "mission",
      mission,
      pose: mission.home,
    });
  });
  assert.equal(result.data.route.ok, true);
  assert.deepEqual(received, [1]);
  const pose = result.data.route.points[200];
  const home = await new Promise<MessageEvent>((resolve) => {
    transport.addEventListener("message", (e) => resolve(e as MessageEvent), {
      once: true,
    });
    transport.postMessage({ id: 2, type: "rth", mission, pose });
  });
  assert.equal(home.data.route.ok, true);
  assert.deepEqual(received, [1, 2]);
});
