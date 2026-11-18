# Flightline GIS specification v1

Canonical implementation: `src/gis/core.js`, `src/gis/imagery.js`, and `src/gis/raster-layer.js` in Flightline (`AEP/drone-sim`). Both operating modes consume these exact modules. Skydio's local server exposes an explicit three-file allowlist at `/gis/`; the fixed-wing build bundles them. Do not fork those implementations into the Skydio project.

## Stack decision

| Concern | Previous fixed-wing | Previous Skydio | Shared decision |
| --- | --- | --- | --- |
| 3D engine | Three.js 0.186.1, OrbitControls, scene hierarchy | Same Three.js and OrbitControls, separate renderer setup | Retain Three.js and the Flightline scene/navigation architecture. No new engine or web map provider. |
| Coordinates | WGS84 to east/up/south metres, 111320 m/degree approximation | Same convention, 111319.49 m/degree and separate FOV approximation | One `localFrame` using 111320, wrapped longitude, inverse conversion and polar-origin guard. |
| Imagery | Independent 7×7 raster loader, zoom 5–16, no parent fallback | Independent 3D loader, parent fallback and separate 2D cache | One raster engine and cache: bounded 7×7 neighborhood, requested zoom 0–19, USGS imagery/topo, parent fallback, sRGB, texture disposal and depth-independent ground pass. |
| Navigation | State/corridor/span/asset hierarchy and camera model | Fleet/dock, mission and photo waypoint stepping | Flightline fleet scene owns Fleet region → State → Asset navigation. Dock mode retains its planner and history. |
| Camera | 55° orbit camera, fixed per-frame transition fraction | 55° orbit camera, timed waypoint easing | Shared camera defaults; elapsed-time transitions; user input cancels camera motion. FOV/zoom/aspect calculations share one model. |
| GIS objects | GeoJSON plus explicit UN-style topology/provenance | GeoJSON structures, inferred spans, routes, live inventory | Keep GeoJSON as exchange format and distinguish measured, configured, inferred, and simulated properties. No native Esri UN topology claim. |

MapLibre remains a dependency of Flightline's separate mission sandbox / FAA tools; neither of these 3D operating modes uses it as its scene renderer. This change does not rewrite those separate tools.

## Coordinate and height contract

- GIS coordinates are WGS84 `[longitude, latitude]` in degrees. Geometry coordinates with a third value must declare its vertical reference; no implicit conversion between ellipsoid, MSL/NAVD88, AGL, and height above takeoff.
- Scene coordinates are `[east, up, south]` in metres relative to an explicit geographic origin. GeoJSON coordinates remain geographic, never Three.js XYZ.
- `localFrame` is a flat tangent approximation, suitable for visualization, not a survey projection. National views have increasing scale distortion; they are navigation overviews, not clearance/range measurement surfaces. Detailed engineering should use an appropriate projected CRS and measured terrain.
- Skydio mission heights remain `WORLD_TAKEOFF` metres. Flightline synthetic ground heights remain local modeled metres. Ray–King recorded data retain their existing NAVD88 offset and provenance. Sharing a renderer does not make these references interchangeable.
- Unknown structure height remains unknown. Inferred spans and camera previews must not imply surveyed conductor clearance.

## Rendering and controls

- Perspective FOV 55°, OrbitControls, distance 5–8,000,000 m, polar limit 0.495π, zoom speed 1.7, screen-space panning off. Main scene device pixel ratio capped at 2.
- Ground/raster layers do not write or compete in the depth buffer. Raster tiles render at −10; geographic boundaries and operational objects render above the raster. Dynamic camera clipping scales with viewing distance.
- 850 ms smoothstep waypoint transitions in dock mode. Fixed-wing overview transitions use elapsed-time exponential easing; continuous aircraft following remains a separate behavior. User orbit/pan cancels transitions.
- Horizontal optical FOV is `2 atan(tan(wideHFov / 2) / zoom)`. Vertical FOV derives from the actual frame aspect: fixed-wing illustrative EO 16:9; Skydio planner preview 3:2. Camera assumptions are not calibrated payload specifications.
- Teal `#7adaca`: Skydio docks. Orange `#ffad56`: simulated fixed-wings. Mission, selection, inspection-age and finding colors have separate meanings.
- Imagery is historical USGS/USDA, network dependent. Offline mode makes no new tile requests and retains vector/scene data. Parent imagery can be lower resolution; no availability guarantee at high zoom. No terrain occlusion or 3D terrain claim.

## Workspace and service contract

- The shared fleet uses the Flightline scene, starts at the Michigan–Texas operating extent and shows bundled US state boundaries. Selecting a state frames it; a state dock marker/list entry opens the dock workspace. Ohio fixed-wing scene overview starts one level farther out than before.
- Skydio inventory and fixed-wing simulation remain distinct. Docks are configured takeoff points; fixed-wing positions are simulated. Existing live Skydio telemetry keeps its existing source semantics.
- Same-origin, source-window-checked messages connect the existing views. Dock snapshots are sent only when their identifiers, names or coordinates change; simulation snapshots are local, once per second. No extra Skydio API polling is added by the GIS layer.
- The shared shell retains each view's in-memory state. Existing independently authored feature modules remain separate; the GIS core and raster engine are shared source, not duplicated engines.

Build with `npm run build:fleet`, then run the Skydio local server and open `http://127.0.0.1:8765/flightline`. Rebuild Flightline when shared modules change. The standalone fixed-wing build includes its state boundaries under `gis/states.geojson`; the integrated preview uses the existing local `/states.geojson` route.

### Continuous dock scene

Selecting a dock keeps the existing Flightline scene, renderer, origin, imagery and OrbitControls. A camera flight changes geographic target and zoom; Skydio controls open in a side panel. Structure/waypoint/FOV GeoJSON and recorded route/position messages draw into dedicated layers in the persistent scene. Mission heights retain the explicit takeoff reference; recorded GPS heights use first-sample-relative fallback only when takeoff height is absent. Returning to fleet frames the retained state selection. The original Skydio map remains available at `/` when opened separately.

## Integrated local data and workflow

Top-level workflow is Planning / Operations / Review. Asset type is no longer a separate page. Exit mission returns to the shared fleet while retaining the selected state. Dock labels and fixed-wing labels are clickable at state/detail scale; selection uses the same persistent Flightline scene.

Operations includes locally known plans/drafts, active missions, and recorded completions within seven days. Recorded completion brightness decreases with elapsed age; records with no completion timestamp are not asserted to be recently completed. Review retains older loaded history. Fixed-wing positions and completion times are explicitly simulation state; they are not live operational telemetry. Dock history is still queried narrowly on dock selection, not through a full-fleet history sweep. Scheduled Skydio missions are not automatically discovered; a local draft is not a scheduled flight.

- Cached OSM: `public/gis/aep-power-lines.geojson` currently contains 716 AEP-tagged Ohio ways from the existing snapshot. AEP-wide live retrieval timed out; no new collection is running. The checkbox labels this as Ohio coverage. The reproducible importer is `scripts/fetch_aep_osm.py`; do not run it automatically.
- Airports: `public/gis/aep-state-airports.geojson` contains 927 public, non-towered airport positions filtered from the existing `AEP/Data/rural_airports.geojson` across the eleven AEP states. Its source cycle is unknown. These appear only in fixed-wing Planning, never in dock planning/general Operations. Access, current status, runway length and rural suitability are not established by these points.
- Dock inventory: `public/gis/dock-assets.json` contains configured positions and available circuit candidates within three statute miles for 25 docks. Existing sources supply candidate ways at four docks; the other entries explicitly have no local circuit coverage. OSM ways without circuit identifiers remain identified by way ID; they are not relabeled as verified circuits.
- Geometry: `scripts/build_dock_assets.py --state /path/to/local-api-state.json` reproduces the clipped inventory. Supplied structure XY for circuit 265454 is retained. Where heights are unknown, the 3D viewer uses an explicit 45 m schematic height, 3 m sag and illustrative crossarms. Other ways have no mapped support inventory; missing poles are not invented. Exported 3D GeoJSON preserves uncertainty and does not claim surveyed terrain, electrical phases or native Esri UN topology.
- Selected dock buffer: geodesic display circle, radius `3 × 1609.344 m`, translucent teal; it does not define flight authorization or validated clearance. Circuit choices are planning candidates intersecting that buffer, not a declaration that the entire circuit can be flown.
