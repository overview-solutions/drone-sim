export type Point = { x: number; y: number };
/** Local east/north meters; heading radians counterclockwise from east. */
export type Pose = Point & {
  heading: number;
  /** Classification of the incoming sampled segment. */
  turning?: boolean;
  heightAboveLine?: number;
  altitude?: number;
};
export type TransmissionLine = {
  enabled: boolean;
  vertices: (Point & { elevation: number })[];
};
export const FEET = 0.3048;
export const CORRIDOR = {
  straight: 200 * FEET,
  turn: 700 * FEET,
  vertical: 200 * FEET,
};
export type Waypoint = Point & {
  id: string;
  kind: "nav" | "photo";
  altitude: number;
};
export type Zone = { id: string; vertices: Point[] };
export type Settings = { speed: number; bank: number; clearance: number };
export type Mission = {
  version: 1;
  transmission?: TransmissionLine;
  home: Pose;
  waypoints: Waypoint[];
  zones: Zone[];
  settings: Settings;
};
export type Route =
  | { ok: true; points: Pose[]; length: number; checkpoints: number[] }
  | { ok: false; reason: string };
export interface Planner {
  mission(mission: Mission): Route;
  returnHome(pose: Pose, mission: Mission): Route;
}
/** Future adapters consume telemetry; they must not turn this sandbox into a flight command source. */
export interface TelemetrySource {
  subscribe(listener: (pose: Pose) => void): () => void;
}
export const ORIGIN: [number, number] = [-97.72, 30.32];
export const LIMIT = 3500;
export const toLngLat = (p: Point): [number, number] => [
  ORIGIN[0] + p.x / (111320 * Math.cos((ORIGIN[1] * Math.PI) / 180)),
  ORIGIN[1] + p.y / 111320,
];
export const fromLngLat = (lng: number, lat: number): Point => ({
  x: (lng - ORIGIN[0]) * 111320 * Math.cos((ORIGIN[1] * Math.PI) / 180),
  y: (lat - ORIGIN[1]) * 111320,
});
export const radius = (s: Settings) =>
  s.speed ** 2 / (9.80665 * Math.tan((s.bank * Math.PI) / 180));
export function demo(): Mission {
  return {
    version: 1,
    home: { x: -1200, y: -700, heading: 0 },
    settings: { speed: 24, bank: 30, clearance: 60 },
    waypoints: [
      { id: "w1", x: 1100, y: -100, kind: "photo", altitude: 120 },
      { id: "w2", x: 1000, y: 1000, kind: "photo", altitude: 120 },
      { id: "w3", x: -1100, y: 1000, kind: "nav", altitude: 120 },
    ],
    zones: [
      {
        id: "z1",
        vertices: [
          { x: -400, y: -650 },
          { x: 400, y: -650 },
          { x: 400, y: 550 },
          { x: -400, y: 550 },
        ],
      },
    ],
  };
}

export function corridorDemo(): Mission {
  const m = demo();
  m.home = { x: -1200, y: 0, heading: 0, heightAboveLine: 30 };
  m.waypoints = [
    { id: "c1", x: 1100, y: 0, kind: "photo", altitude: 30 },
    { id: "c2", x: -1000, y: 0, kind: "photo", altitude: 30 },
  ];
  m.zones = [];
  m.transmission = {
    enabled: true,
    vertices: [
      { x: -1800, y: 0, elevation: 30 },
      { x: 0, y: 0, elevation: 40 },
      { x: 1800, y: 0, elevation: 35 },
    ],
  };
  return m;
}

/** Entirely synthetic winding corridor; elevations are illustrative datum meters. */
export function complexCorridorDemo(): Mission {
  // Repeated junctions join three loops; equal elevations keep junctions continuous.
  const coordinates = [
    [-2400, -1000, 60],
    [-2400, 600, 80],
    [-1600, 1200, 100],
    [-800, 600, 80],
    [-800, -1000, 60],
    [-2400, -1000, 60],
    [-800, -1000, 60],
    [800, -1000, 60],
    [800, 600, 80],
    [-800, 600, 80],
    [-800, -1000, 60],
    [800, -1000, 60],
    [2400, -1000, 60],
    [2600, 0, 75],
    [2200, 1000, 100],
    [1400, 1200, 100],
    [800, 600, 80],
    [800, -1000, 60],
  ];
  const vertices = coordinates.map(([x, y, elevation]) => ({
    x,
    y,
    elevation,
  }));
  return {
    version: 1,
    home: { ...vertices[0], heading: 0, heightAboveLine: 120 * FEET },
    settings: { speed: 20, bank: 35, clearance: 30 },
    transmission: { enabled: true, vertices },
    zones: [
      {
        id: "s-bend-exclusion",
        vertices: [
          { x: -1950, y: -200 },
          { x: -1450, y: -200 },
          { x: -1300, y: 200 },
          { x: -1500, y: 550 },
          { x: -1950, y: 350 },
        ],
      },
    ],
    waypoints: [1, 2, 3, 8, 15, 14, 13, 12]
      .map((index) => vertices[index])
      .map((p, i) => ({
        id: `complex-${i + 1}`,
        x: p.x,
        y: p.y,
        kind: i % 3 === 0 ? "nav" : "photo",
        altitude: 120 * FEET,
      })),
  };
}
