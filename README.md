# drone-sim — Flightline fixed-wing mission sandbox

**Simulation only. Not flight-ready, not a safety system, and not an aircraft controller.** A route marked “Geometry checks passed” passed only the planar checks described below.

## Open on Mac without installing anything

Open the supplied `Flightline.html` file in your browser by double-clicking it in Finder. The app, styles, map library, and planning workers are embedded in this one file; Node and a local server are not required. No internet connection is needed: the background contains embedded USGS topographic tiles for the 7 × 7 km Austin demo area. This standalone file was packaged from the verified production build; direct file opening was not browser-tested because the automated browser disallows file URLs.

## Run from source (developers)

Use Node.js 22.12+ (Node 24 LTS recommended) and npm:

```sh
cd drone-sim
npm ci
npm run dev
```

Open the localhost URL printed by Vite (normally http://127.0.0.1:5173). No API key or backend is needed. The background contains embedded USGS topographic tiles; no external tile or font requests are made. MapLibre and application code are bundled locally. This is a modest local demo, not a production tile-service deployment.

```sh
npm test       # geometry, planning, and simulator regression checks
npm run build # TypeScript check and production bundle
npm run preview # serve the production bundle locally
python3 scripts/standalone.py # after build, regenerate root Flightline.html
```

## Try it

1. The app starts with a synthetic transmission-line example near Austin: eight navigation/photo waypoints and three connected transmission loops. The earlier three-waypoint/exclusion demo is available through **Load free-planning example**. Cyan shows the planned mission; dashed green shows a return candidate from the aircraft pose. Red polygons are exclusions; orange edge capsules illustrate clearance. All coordinates and exclusions are synthetic.
2. Choose **Nav point** or **Photo point**, then click the map. Drag numbered markers to move them. Change type or altitude, move a waypoint earlier with ↑, or delete it with × in the sidebar. Photo captures are simulated counters at exact waypoint passage; no imagery is produced.
3. Choose **Exclusion**, click at least three corners, then click the first vertex, click **Exclusion** again, choose **Finish polygon**, or press Enter. Escape cancels. In Select mode, click a polygon to reveal handles. Drag a vertex, click a + midpoint to add a vertex, or right-click a vertex to remove it. Crossing/degenerate polygons are rejected. Delete the selected exclusion with the sidebar button.
4. Drag H or choose **Set home**. Adjust airspeed, bank limit, clearance, and departure heading. Every committed edit pauses and resets playback to home and replans; this is a design sandbox, not an in-flight mission editor.
5. **Play/Pause**, change playback speed, and watch photo events and the live return candidate. **Return home** pauses briefly to calculate a fresh path from the exact current pose, then follows that path. Reset starts the mission again.
6. **Try blocked-home example** demonstrates failure: no route line is displayed for failed results and playback is disabled. **Restore example** recovers.
7. Export/import JSON to save designs. Nothing is uploaded or persisted automatically. Mission data stays in the browser.

## What the planner actually checks

- A fixed local tangent approximation uses east/north meters around longitude −97.72, latitude 30.32. The allowed area is a 7 × 7 km square. It is not a global geodesic planner.
- Minimum turn radius is `v² / (9.80665 × tan(bank))`, using 12–45 m/s, 15–45° bank, and 10–300 m exclusion clearance. Wind is zero and true airspeed equals ground speed in the model.
- Each connection evaluates all six Dubins families (straight segments and constant-radius arcs), preserving the initial heading and matching an arrival heading. Mission waypoint arrival headings point toward the next waypoint (the last points toward home). A mission ends at the final waypoint; RTH is a separate candidate/action.
- If a direct curved connection is blocked, a shortest-path visibility graph uses expanded obstacle bounding boxes to place detour candidates, but tests graph edges against the actual polygons plus clearance. An endpoint inside an expanded candidate box is not automatically blocked. The planner tries three expansion distances and five angular heading candidates plus incoming/outgoing line directions at intermediate corners, then evaluates collision-checked Dubins connections through them. It selects the shortest candidate within each evaluated set. **This is a bounded heuristic, not a globally optimal or complete motion planner.** It can reject a geometrically possible route, especially in concave obstacles, narrow passages, overlapping bounding boxes, or near the planning boundary.
- Curves are sampled at ≤6 m. Every chord is checked for polygon intersection, polygon containment, and segment-to-edge distance. An additional 1 m margin covers the arc-to-chord sagitta at the supported minimum radius. All samples must remain inside the planning area; a curve may extend by a small sagitta beyond the boundary between samples, so that boundary is a scope limit, not a certified geofence.
- Polygons must have 3–40 vertices, edges ≥5 m, positive area, and no self-intersections. At most 8 zones and 20 waypoints keep browser computation bounded. Exclusion zones extend through all altitudes. In free-planning mode, altitude (30–300 m AGL) remains metadata. In corridor mode, waypoint heights are 0–200 ft above the synthetic conductor profile; see below.
- Corridor RTH first tries arrival opposite the launch heading, then falls back to eight home arrival headings if needed. Free-planning RTH considers eight home arrival headings. Return calculations run in the main browser thread for standalone local files, or in a Web Worker when served over HTTP, about once per second of **wall-clock** time while the aircraft moves, not once per simulated second. Stationary playback retains the last candidate; mission edits and explicit Return home requests still calculate a fresh path. The displayed age and displacement identify where the latest path originated. Edits invalidate old results. A failed return or four seconds of movement without a fresh result starts staged recovery (described below). The Return home action calculates again at the paused current pose before moving.
- The simulator interpolates a checked path at constant speed with bounded turn curvature. It pauses in place and stops at endpoints; these are playback controls, **not physically feasible fixed-wing hover or landing behavior**. Photo capture occurs at passage of a waypoint without hovering.

No takeoff/landing, flight dynamics, terrain, buildings, weather, stall margin, climb/descent, energy reserve, sensor footprint, regulatory restrictions, navigation uncertainty, connectivity, or autopilot failsafes are modeled. Do not export these paths to an aircraft.

## Architecture and integration seams

```text
src/types.ts                 Mission, pose, route, planner and telemetry contracts
src/planning/geometry.ts     Polygon validation and buffered collision checks
src/planning/dubins.ts       Heading-constrained constant-radius path candidates
src/planning/planner.ts      Bounded avoidance search, mission and RTH planning
src/planning/worker.ts       Request IDs and off-main-thread planning
src/simulator.ts             Kinematic playback and simulated photo events
src/main.ts                  MapLibre editor, UI state, worker orchestration
tests/planner.test.ts        Regression tests for paths and failure states
```

The frontend is Vite + strict TypeScript + MapLibre, without a framework or server. `Mission` is a versioned JSON model; `Planner` and `TelemetrySource` define integration boundaries. A future Go service can consume the mission DTO through REST, return `Route` results with request/revision identifiers, and publish telemetry through WebSockets. Convert global telemetry to an appropriate projection and preserve timestamp/freshness semantics. Keep vendor credentials on the backend.

There is deliberately **no MAVLink implementation or control endpoint**. Any future MAVLink/vendor adapter needs its own actual capability discovery, vehicle state machine, authenticated command authority, appropriate geodesy and flight planning, operator procedures, and testing. Commercial Skydio control access is not assumed.

Map interaction reference: [MapLibre draggable markers](https://maplibre.org/maplibre-gl-js/docs/examples/drag-a-marker/) and [Map API](https://maplibre.org/maplibre-gl-js/docs/API/classes/Map/).

### Standalone worker compatibility

Local-file mode uses `src/planning/local.ts`, a worker-free planner transport. Map geometry uses a projected 2D canvas; the empty MapLibre style uses zero workers. This avoids local-file worker origin errors without changing browser security settings. Complex designs may briefly pause UI updates while local planning runs. Open the top-level `Flightline.html`, not the source project’s `index.html`.

### Embedded basemap

The standalone file includes 20 USGS The National Map topographic tiles (zoom 14), retrieved October 13, 2026, covering the fixed Austin test area. These are geographic context only, not current aviation charts or obstacle data. Panning outside the embedded coverage shows the grid; zooming further enlarges the existing imagery. No live tile access is required. Source: https://basemap.nationalmap.gov/arcgis/rest/services/USGSTopo/MapServer

## Transmission-line corridor mode

- Enabled by default in the new example. **Load corridor example** resets it; legacy imported missions remain free-planning missions unless you draw a line and enable enforcement.
- Draw a line with 2–30 vertices, then finish it. **Edit line vertices** exposes draggable L handles and + midpoint handles. Edit each conductor elevation or remove vertices in the sidebar. Elevations are feet relative to one arbitrary local datum; the data is synthetic, not surveyed utility data.
- Normal straight segments must stay within **200 ft laterally** of the nearest line segment. Every analytic curved segment, including avoidance and RTH turns, may extend to **700 ft laterally**. A straight segment does not inherit that exception merely because it lies between turns. Home and mission waypoints must lie within the 200 ft corridor.
- Flight height is **0–200 ft above the conductor**, never below it. Home and waypoint height fields use feet above line in this mode. Internally heights remain meters: waypoint `altitude` is interpreted as above-conductor height while enforcement is enabled, and home uses `heightAboveLine`. Export/import preserves the optional `transmission` model and conductor elevations in meters.
- The nearest horizontal point on the line determines the interpolated conductor elevation. The selected above-line heights interpolate along each connection; absolute simulated elevation is conductor elevation plus that height. Equal-distance crossings use the first nearest segment. The profile is piecewise linear; conductor sag, line uncertainty, vertical speed, acceleration and climb/descent feasibility are **not** modeled. This is a draped altitude profile, not a full 3D flight planner.
- Lateral checks recursively bound the maximum distance on each chord, with a small reserve for curved sampling. Exclusion and turn-radius checks remain mandatory. Straight/turn classification comes from the path primitive, not a distance-based UI label. Separate approach/departure turns and line vertices provide additional search candidates. The search remains bounded and can reject a feasible path.
- Purple bands show the 200 ft normal corridor and 700 ft turning corridor. Live text reports segment class, lateral separation, above-line height and modeled elevation. This is a maximum-distance constraint, **not minimum wire clearance or collision protection**. Zero above-line height is allowed by the numeric envelope and is not an operational recommendation.
- Corridor constraints apply to mission and RTH. The broad turning envelope does not override exclusions. If the corridor is blocked, playback remains disabled or pauses. Mission edits restart playback from home.

### Connected-loop hypothetical example

The default example has three connected transmission loops with shared junctions, eight navigation/photo waypoints, and an exclusion inside the western loop. Repeated line vertices represent connected junctions with matching elevations. Conductor elevations vary from 60 to 100 meters in an illustrative datum; aircraft height is 120 ft above conductor.

The outbound mission follows the upper sections for approximately 9.08 km. Its final RTH uses the lower connections for 4.80 km, about 47% shorter than retracing the mission. The same corridor, turning-radius, and exclusion constraints apply. This demonstrates a shorter valid alternative, not a guarantee of global shortest-path optimality. Return candidates remain bounded heuristic results. All assets are synthetic; climb performance is not modeled.

## Staged return recovery (simulation only)

A failed or stale in-flight normal return starts an eight-second recovery-search interval while playback follows its remaining checked route. Normal searches retry from the changing pose. If a fresh current-pose route succeeds it is adopted. If time expires, or the checked route ends sooner, the fallback sequence is: checked turnaround and reverse flown history; a 10-meter-radius emergency turnaround with the corridor retained; then an exclusion-checked direct-home chord with turn radius and corridor overridden. Direct-home entry may change heading instantly and is explicitly beyond modeled aircraft capability. Exclusions and their clearance are never overridden. If all candidates fail, the simulation freezes with an unresolved-emergency label; this represents no known continuation, not physical hovering.

The sidebar shows the active stage, countdown, enforced/overridden rules and an attempt history. Amber paths indicate tight-turn overrides; red paths indicate direct emergency overrides. **Test return recovery** deliberately suppresses normal search successes for one drill; Reset clears it. User Pause freezes the recovery countdown. The eight-second threshold is a UI scheduling target, not a hard real-time guarantee: standalone local planning runs on the browser thread and can delay updates. All recovery searches remain bounded heuristics.

## Ohio fleet and 3D inspection

Open `OhioFleet.html` without a server. See [OHIO_SHOWCASE.md](OHIO_SHOWCASE.md) for FAA/OSM provenance, fleet comparison, synthetic Utility Network geometry, gimbal controls and build instructions.
