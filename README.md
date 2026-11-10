# drone-sim — Flightline fixed-wing mission sandbox

**Proprietary — all rights reserved.** Original project software and documentation are not offered under an open-source license. Use requires authorization from the applicable rights holder; see [LICENSE](LICENSE). Third-party software and data retain their own licenses, including ODbL for OSM-derived data. This change does not revoke previously granted GPL rights or establish ownership.

**Simulation only. Not flight-ready, not a safety system, and not an aircraft controller.** A route marked “Geometry checks passed” passed only the planar checks described below.

## Where the displayed data comes from

**The supplied Ohio and Austin demos combine public maps with simulated operations. They include no internal AEP GIS export, inspection imagery, LiDAR survey, maintenance history, work orders, or live fleet telemetry.** On the Ohio map, an “AEP” label comes from a contributor-entered operator tag in OpenStreetMap. Selecting that line opens a simulated inspection. A red insulator, for example, is a generated finding at a modeled component, not a reported defect on that circuit.

| Displayed layer | Source and interpretation |
| --- | --- |
| Ohio transmission routes, operator names and nominal voltages | Public [OpenStreetMap](https://www.openstreetmap.org/copyright) power-line geometry and tags, downloaded via Overpass on October 16, 2026. The snapshot includes 681 ways tagged as AEP and at least 69 kV. Ways with unknown operators stay unassigned. This is a mapped subset, not an authoritative asset inventory. |
| Buildings and nearby features | Embedded downtown Columbus building footprints come from the OSM map API on October 25, 2026. The optional nearby OSM loader fetches mapped buildings, power infrastructure, vegetation, waterways, roads, paths and rail features through Overpass. Missing heights are approximated for display. Review views can also include explicitly marked demo crossings. **© OpenStreetMap contributors. OSM-derived data is licensed under [ODbL 1.0](https://www.openstreetmap.org/copyright).** |
| Ohio airports and runways | Airport locations, identifiers, tower status and runway attributes come from the [FAA NASR airport and runway files, October 1, 2026 cycle](https://nfdc.faa.gov/webContent/28DaySub/extra/01_Oct_2026_APT_CSV.zip). Suggested drone stations, taxi operations, parking, charging and airport arrangements are hypothetical. |
| State boundary and rural airport filter | The Ohio outline comes from [U.S. Census Bureau TIGERweb state boundaries](https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/State_County/MapServer). The rural filter compares each airport location with [2020 Census urban-area polygons](https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/Urban/MapServer). |
| Map background | Ohio streams historical aerial imagery from [USGS The National Map imagery service](https://basemap.nationalmap.gov/arcgis/rest/services/USGSImageryOnly/MapServer) (display credit USGS / USDA) and topography from [USGS Topo](https://basemap.nationalmap.gov/arcgis/rest/services/USGSTopo/MapServer). Austin embeds 20 tiles from that topo service. The offline grid and dark styling are drawn by the application. |
| Flood focus and terrain | Clicking a flood alert requests public [USGS WBD HUC12 boundaries](https://hydro.nationalmap.gov/arcgis/rest/services/wbd/MapServer/6), [NHD river flowlines](https://hydro.nationalmap.gov/arcgis/rest/services/nhd/MapServer/6), and [3DEP elevation samples](https://elevation.nationalmap.gov/arcgis/rest/services/3DEPElevation/ImageServer). A 25 × 25 grid at 125 m spacing covers approximately 3 km around the alert bounding-box center. Blue cells show a connected, constant-water-elevation scenario seeded from mapped waterways. The initial level is lowest sampled river-cell elevation +2 m, an assumption adjustable by the user. This is coarse terrain screening, not a flood forecast. It omits flow, rainfall, channel bathymetry, levees, drainage structures and calibrated river stages. Elevations are used numerically while the result is drawn on the simulator’s flat map. Service failures are shown explicitly. |
| Historical disaster examples | Includes the [1974 Xenia tornado](https://www.weather.gov/iln/19740403) and [2009 Shawnee Complex wildfire](https://www.nifc.gov/sites/default/files/NICC/1-Incident%20Information/IMSR/2009/April/20090430IMSR.pdf). Xenia uses an approximate city locator; Shawnee uses an approximate locator derived from the report description. Neither is a surveyed damage/burn boundary. Fire acreage and containment reflect the April 30, 2009 report; local weather measurements are unspecified.  Curated public NWS reports for the [June 29, 2012 derecho](https://www.weather.gov/cle/event_20120629_derecho) and [March 14, 2024 Auglaize–Logan tornado](https://www.weather.gov/iln/20240314_auglaize_logan). The Ohio weather history selector shows event dates, measurement/estimate distinctions, and original source links. The Indian Lake event uses the NWS polygon imported from the supplied KMZ. The derecho uses all 32 reports parsed from the Cleveland summary, with UTC timestamps, original EDT labels, measured/estimated qualifiers, observer types and remarks. Crosses locate those reports; they do not define a continuous damage footprint. The report selector focuses individual locations. Historical examples are separate from active NWS alerts. |
| Natural hazards | Active Ohio alerts from the [National Weather Service API](https://api.weather.gov/alerts/active?area=OH), refreshed every two minutes. Published alert polygons or forecast/county zone boundaries define outlines. Notifications preserve issue time. Flood and storm incidents labeled DEMO are fictional, shown immediately and after 60 seconds of wall-clock time. Demo incidents can be hidden. Feed failures are reported and retained alerts expire on their supplied validity times. |
| Air traffic, Remote ID and airspace notices | The default examples are simulated. If explicitly configured, the optional Rust service displays aircraft observations from [OpenSky Network](https://openskynetwork.github.io/opensky-api/rest.html), Remote ID observations from a user-supplied receiver file, and notices from a user-supplied NOTAM/TFR file. Those inputs are separate from the distributed demo. See the [feed configuration and limits](ingestion/README.md). |

**What the simulator generates.** The Austin transmission loops and OH-08 downtown inspection corridor are fictional. For Ohio missions based on OSM lines, the simulator builds its own towers, spans, conductors, phase attachments, insulators, splices and SOCC boundaries. The Utility Network-style GeoJSON describes those modeled objects. The [schema references and aircraft and camera specifications](OHIO_SHOWCASE.md) inform the model.

Aircraft positions, mission timelines, communications, camera views, LiDAR points, trees and obstacles in the detailed scan, and derived geometry are simulated. Inspection recency, asset service dates, condition trends, storm and maintenance events, faults, risk colors, clearance and rating scenarios, and initial follow-up tasks are generated examples. Operator-entered task notes, comments, assignees and imported missions are user inputs and can appear in the corresponding exports.

For the original download links, query filters and steps to reproduce the Ohio snapshot, see [Ohio data sources](OHIO_DATA_SOURCES.md). The repository also carries source metadata in the [fleet snapshot](src/fleet/ohio-data.json) and [Columbus building extract](src/fleet/urban-buildings.json).

## Planned wildfire integration

See the [Earth Fire Alliance / FireSat integration plan](docs/EARTH_FIRE_ALLIANCE.md) for verified access information, potential utility workflows, proposed Rust ingestion, and licensing questions. This integration is proposed and has no connected FireSat feed.

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

## Published entry points

GitHub Pages `/` redirects to `OhioFleet.html`, the current Ohio fleet dashboard. `Flightline.html` remains the original mission-planning sandbox. Both are generated standalone files; commit rebuilt HTML when publishing changes. For source development, use `/ohio.html` for Ohio or `/sandbox.html` for the original planner. The original build uses `sandbox.html`; its packaging script still outputs `Flightline.html`.

### Airspace awareness

Ohio Fleet includes simulated aircraft/helicopters, Remote ID detections and NOTAM/TFR examples. Expand **Airspace awareness** to switch to the local Rust ingestion service. See [ingestion/README.md](ingestion/README.md) for the OpenSky connection, receiver/notice import formats and source limitations. No Node runtime is needed for the standalone page or Rust service.

## Project layout

- Root HTML files are ready-to-open deliveries: `OhioFleet.html` is the Ohio fleet demo, `Flightline.html` is the earlier mission planner. They are generated bundles, not the preferred editing location.
- `src/fleet/` holds Ohio simulation, 3D rendering, camera, asset, traffic and operator-interface modules. `operations.ts` owns flight state; `contingency.ts` contains pure escape geometry checks; `contingency-panel.ts` connects those checks to the demo.
- Other `src/` modules provide the original planner and shared geometry.
- `ingestion/` is the separate Rust airspace ingestion service. It is optional for simulated encounters; real sources need their own access/configuration.
- `tests/` holds automated geometry and state regression tests.
- `scripts/` contains packaging and data-preparation tools; `dist-fleet/` is generated build output.
- `docs/screenshots/` contains captured UI previews. Keep future screenshots here, not in the root.
- `OHIO_SHOWCASE.md` and `CORRIDOR_DATA.md` explain scenario assumptions and data provenance.

### Return and encounter demonstrations

Select a live aircraft, then use the controls above the timeline. **Return home** evaluates curved connections to the flown route. The encounter selector and **Test avoidance** offer a crossing airplane, oncoming helicopter, and deliberately blocked escape case. It evaluates forward refuges and backtrack/return candidates, applies a passing connection to the selected flight, and displays why other candidates failed. A no-route result leaves the aircraft moving on its current route and requests operator intervention; this is not a safe fallback guarantee.

Connection checks use a 700 ft turn radius, 700 ft lateral envelope, 20 m modeled-conductor clearance, 20 m synthetic flat-ground floor, 2 m/s descent limit, and illustrative 120 m horizontal / 35 m vertical traffic proximity. These are demonstration parameters, not certified DAA thresholds. Traffic prediction assumes constant velocity. The checks cover the connection, not the subsequent mission or airport approach. No actual terrain, buildings, vegetation, exclusion volumes, wind, aircraft performance or live surveillance are validated. Live service observations do not trigger automatic maneuvers. The demonstration's on-demand traffic and response are synthetic.

## Disaster response airspace demonstration

Select an incident, then **Response airspace** to view an illustrative TFR cylinder and three assigned sectors for inspection UAS, rescue/suppression helicopters, and fixed-wing mapping. The 5 km radius, 3,000 ft AGL ceiling and tier heights are invented scenario parameters referenced to flat simulated ground. These outlines do not represent an issued FAA restriction or historical TFR.

A priority helicopter transit reserves the shared corridor for ten seconds while the other scenario tracks freeze, then resumes their animations. This demonstrates sequencing only. These extra demonstration markers are separate from the Ohio fleet and its route planner. Freezing is a schematic hold, not fixed-wing flight dynamics. Actual fleet avoidance, admission authorization, terrain-referenced altitudes and operational separation enforcement remain unimplemented here.

FAA disaster-response TFR and UAS access guidance is available at [FAA Temporary Flight Restrictions](https://www.faa.gov/uas/getting_started/temporary_flight_restrictions). Real operations require applicable authorization and incident coordination. NWS hazard geometry alone does not establish a TFR.

## NOTAM request preparation

Incident details include **Prepare NOTAM request** to export an editable local review packet with UTC validity and coordination fields. See [FAA / Leidos integration status](docs/NOTAM_INTEGRATION.md). Live origination requires a verified provider interface and authorized account; submission is currently unconnected.

Historical geometry is bundled in src/fleet/indian-lake-track.json and src/fleet/derecho-reports.json, with source URLs and input hashes. Reproduce conversion using scripts/import_storm_history.py with the NWS KMZ and downloaded event HTML. The Cleveland report set is partial regional coverage.


### Ray–King 345 kV: actual OGRIP LiDAR preview

Use **Ray–King · OGRIP** in the top banner, or open `ohio.html#ray-king`.
This joins the existing public OSM snapshot ways **179559746 → 953747816 → 953747815** at their shared endpoints, retaining the covered interior portion. The OSM operator field is blank; the corridor is **not asserted to be AEP-owned**. Ray–King is the user-supplied dataset label, not a verified OSM circuit name.

Source LAS remains in `../Data/lidar/Ray_King_345/`. Five `S*.las` tiles have metadata acquisition dates March–May **2006**; `BS19050726.las` belongs to the March–April **2021** block (published 2022). These are historical, overlapping surveys, not a simultaneous/current scan. `src/fleet/ray-king-data.json` contains 130,068 deterministic sampled real returns within 150 m of the OSM centerline and source tile metadata. It contains no private utility GIS records. Original LAS classification is retained; unclassified points are not inferred to be vegetation or conductors. Display thinning does not imply a measured point density.

The newer LAS explicitly identifies EPSG:6551 (NAD83(2011) Ohio South US survey feet) and NAVD88/Geoid18 feet. Older LAS lacks embedded CRS; its XML inconsistently names CORS and HARN. EPSG:3735 is used as an **approximate horizontal display transformation** for those tiles; precision registration is unverified. Elevation feet are converted to metres and a constant 321.725933 m subtracted for the local scene. Terrain relief remains; the existing synthetic towers/flight routes are **not terrain-conformed or extracted from these scans**. Do not interpret their intersection with the points as a surveyed clearance result.

Reproduce with Python dependencies `laspy`, `numpy`, `pyproj`:

```sh
python3 scripts/import_ray_king.py ../Data/lidar/Ray_King_345
```

The source panel exports a GeoJSON corridor and tile footprints, with OSM way IDs and provenance. The point preview is embedded in the standalone build for offline use; original multi-million-point LAS stays outside the repository.

### Simulated mission NOTAMs

The top-banner **Mission NOTAMs** list generates one fictional UAS activity advisory per fleet mission, plus a planned advisory for an unassigned selected corridor (including Ray–King). Click a mission to frame its route and dashed bounding rectangle; close the list to remove the highlight. Export produces `flightline.simulated-mission-notams.v1` JSON with `simulation: true`, `submitted: false`, and no issued identifier.

The illustrative window includes 15 minutes before/after simulated flight. Status follows the simulation (including replay), not real-time FAA validity. The rectangle includes the whole route with 700 ft padding; it is not a precise corridor buffer. SFC–400 ft AGL is an assumed notice envelope, not a measured aircraft altitude or terrain-validated operational limit. These notices do not reserve airspace, establish a TFR, provide clearance or get transmitted to any authority.

Ray–King is also an auto-loaded fleet mission (normally **OH-09 · Ray–King · OGRIP**). Select that aircraft, its map marker, or the Ray–King banner shortcut to load the recorded point cloud and mission outline; **Follow aircraft** follows the corridor flight. The mission remains available in the aircraft picker after inspection. Its simulated staging strips are 400 m beyond the covered corridor endpoints, not actual airports. Recorded LiDAR stays visible during playback; the synthetic sensor trail defaults off for this mission. Historical survey returns are not newly captured by the simulated aircraft.

Ray–King now runs continuous back-and-forth inspection passes with explicit 700 ft-radius Dubins endpoint turnarounds. This replaces its previous staging/landing demonstration. It begins at the corridor start; the recorded cloud starts hidden and reveals in along-corridor order as the aircraft passes. Completed coverage remains visible on subsequent loops. Replay shows the coverage up to the replay position. This is a historical-data reveal animation across the 150 m display swath, not simulated ray tracing, guaranteed sensor coverage, terrain avoidance, or an endurance-feasible perpetual flight. Return commands interrupt looping.

### Ray–King LiDAR-derived span candidates

OH-09 uses 14 OSM-seeded elevated-return clusters and 13 adjoining span candidates, replacing uniform synthetic support spacing. Click the amber span buffers or select spans through Profile to open the recorded returns (including 30 m beyond each end) and derived envelope. Span review intentionally reveals the selected historical scan independently of the animated capture progress.

`scripts/derive_ray_king_spans.py` processes the actual sampled returns in `ray-king-data.json`: ground median within 60 m; elevated returns 25–80 m above ground within 22 m of each OSM vertex; robust median XY and 95th-percentile top. Each candidate requires at least five elevated returns. Adjacent supported seeds define boundaries; unsupported seeds are not bridged. Across each span, eight bins of elevated returns within 18 m of the axis support a quadratic envelope only if at least five bins have three returns. Twelve spans pass this screening; one has adjacency geometry only. These are **unverified candidates**, not certified tower detections, phase-resolved wires or mechanical sag measurements. Trees can contaminate the fit; mixed survey dates and approximate older CRS remain limitations.

The existing UI has internal phase placeholders for compatibility, but Ray–King displays one envelope, exports no invented attachments/splices, and disables synthetic defect generation and rating claims. Its UN-style export provides candidate support/span IDs, evidence counts, unresolved phase status and vertical reference. Rebuild candidates with `python3 scripts/derive_ray_king_spans.py` (NumPy required). Raw LAS remains untouched.

Ray–King display refinement: the flight scene now shows a monochrome RAW-preview trail only, extending approximately one local OSM span behind the aircraft in its current direction. Older trail points leave the display; endpoint turns outside the 150 m corridor hide the trail. Derived support/envelope graphics appear only in selected Span review. Span review loads recorded classified returns and offers **Classified / Elevation**; elevation colors span the selected returns' measured NAVD88 range, with a metres legend. The rolling raw preview is hidden while inspecting a span. “RAW” describes unclassified presentation of the existing thinned historical preview, not the full-resolution original LAS.

### On-demand full-resolution tower processing

In a Ray–King **Span** view, click either amber tower box (or its `RK-T… · Process` button). A local service reads the original associated LAS tiles, reports progress, and adds a candidate 3D structure envelope. **Export 3D GeoJSON** downloads the fitted polygons in longitude/latitude/NAVD88 metres.

Start the service separately from the web preview (Python with `laspy`, `numpy`, `pyproj`):

```sh
python3 scripts/tower_lidar_service.py --data ../Data/lidar/Ray_King_345
```

It listens only on `127.0.0.1:8790`. Jobs are limited to the known 14 candidate IDs, run one at a time, and are cached in memory until restart. No LAS is uploaded or modified. Static/standalone pages need this local service running; they show an unavailable message otherwise.

The processor streams original LAS chunks, crops an 18 m radius around the candidate above local ground, excludes LAS noise class 7, and prefers the 2021 survey when it supplies enough returns; otherwise it uses older tiles without mixing epochs. Each 3 m vertical band needs six returns and a nondegenerate XY convex hull. A prism uses that hull and the observed minimum/maximum elevations. Sparse bands remain absent. This creates an **unverified structure envelope**, not steel-member identification, a watertight engineering model, a vegetation-free segmentation, or clearance certification. Wires/trees can contaminate the shape. Older datum uncertainty remains. Click another span to dismiss the result; no external submission occurs.

Tower labels and wire boxes now enter **Profile → Asset**, zoom to the structure, and initiate full-resolution processing. Processing status and the **Open UN** object live in the bottom Profile, not a map popup. The exported `flightline-open-un/1.0` packet contains a candidate `StructureJunction` point, 3D polygon surfaces and explicit `surfaceOf` links. Electrical connectivity and phase attachments remain empty because the extraction cannot establish them. This is an open UN-style exchange convention, not a native Esri Utility Network import or verified topology.

Tower extraction now uses the neighboring support alignment to define a **36 m across-corridor × 10 m along-corridor** window, instead of the earlier circular crop. The selection box follows that orientation, with its long axis perpendicular to the corridor. This reduces longitudinal conductor contamination without rotating source points. The crop dimensions are modeling assumptions, not surveyed tower dimensions; they may omit components of unusually deep or rotated structures. Restart the processor after changing this method to discard cached envelopes.

Additional high-resolution tiles now supply RK-T05 (`BS19030727`), RK-T06 (`BS19050727`), and RK-T08 (`BS19060725`), alongside RK-T07 (`BS19050726`). `BS19060726` is also available but does not cover a current candidate tower crop. The original-resolution processor discovers extracted LAS recursively on each request. Identical files are excluded by SHA-256 when file sizes match, and identical XYZ returns are removed before fitting. Changes in source paths, sizes or modification times invalidate completed in-memory jobs automatically on the next tower request. ZIP files must be extracted; originals remain outside the repository.

### Prebuilt OH-09 structure estimates

OH-09 now automatically loads 14 estimated tower frames. Their locations and heights use the OSM-seeded LiDAR candidates. Upper full-resolution envelopes inform crossarm width where available; frame members, crossarm elevation and body proportions remain explicitly inferred. Crossarms run across the local corridor. Ten candidates have fitted full-resolution envelopes; RK-T03, RK-T04, RK-T09 and RK-T14 lack sufficient 3D evidence and use amber inferred frames. Even the other frames are not surveyed steelwork. Click a frame to enter its Asset view, or use **Export structures** for 3D GeoJSON with provenance and inference flags. **Estimated structures** toggles the layer.

Reproduce from the original LAS without modifying it:

```sh
python3 scripts/build_ray_king_structures.py ../Data/lidar/Ray_King_345
```

Prebuilt frames are embedded for offline display; on-demand reprocessing still requires the local tower service. No additional structures between the existing OSM-seeded candidates have been asserted.

### Estimated three-phase completion

OH-09 now includes 42 modeled attachment/insulator targets (A/B/C on 14 structures) and 39 conductor curves across 13 spans. Attachment positions follow the estimated frame crossarm widths, perpendicular to the local corridor, with 2.5 m illustrative insulator strings. Conductors connect matching phase endpoints with a parabolic sag assumption capped at 7 m; this is not a tension/temperature calculation or an extracted wire survey. These same attachment coordinates drive gimbal acquisition. Capture targets reset for each direction of the repeating mission.

**Export structures** now exports the UN-style network plus estimated frames, including structure/attachment associations and phase connectivity. This supersedes the earlier empty phase/connectivity export: the new electrical layout is explicitly marked estimated/synthetic with unresolved real-world phase identity. Measured candidate supports and modeled electrical components remain distinguished.
