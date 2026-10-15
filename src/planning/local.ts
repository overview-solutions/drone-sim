import { planner } from "./planner";
import type { Mission, Pose, Route } from "../types";
type Request = {
  id: number;
  type: "mission" | "rth";
  mission: Mission;
  pose: Pose;
};
type Result = { id: number; type: string; route: Route };
/** Worker-compatible local transport for file URLs, which can reject workers. */
export class LocalPlanner extends EventTarget {
  onmessage: ((event: MessageEvent<Result>) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  postMessage(request: Request) {
    const snapshot = structuredClone(request);
    setTimeout(() => {
      const { id, type, mission, pose } = snapshot;
      let route: Route;
      try {
        route =
          type === "mission"
            ? planner.mission(mission)
            : planner.returnHome(pose, mission);
      } catch {
        route = { ok: false, reason: "Planner rejected malformed input." };
      }
      const event = new MessageEvent<Result>("message", {
        data: { id, type, route },
      });
      this.onmessage?.(event);
      this.dispatchEvent(event);
    }, 0);
  }
}
