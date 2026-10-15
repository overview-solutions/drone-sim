import { planner } from "./planner";
import type { Mission, Pose } from "../types";
self.onmessage = (
  e: MessageEvent<{
    id: number;
    type: "mission" | "rth";
    mission: Mission;
    pose: Pose;
  }>,
) => {
  const { id, type, mission, pose } = e.data;
  try {
    self.postMessage({
      id,
      type,
      route:
        type === "mission"
          ? planner.mission(mission)
          : planner.returnHome(pose, mission),
    });
  } catch {
    self.postMessage({
      id,
      type,
      route: { ok: false, reason: "Planner rejected malformed input." },
    });
  }
};
