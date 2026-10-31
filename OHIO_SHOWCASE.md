# Ohio fleet and 3D inspection showcase

Open **OhioFleet.html** in Chrome or Safari on your Mac. No Node, server, API key, or network connection is needed to run the packaged file. WebGL is required for the 3D view. Keep Flightline.html beside it to use the Mission sandbox link.

## Demonstration

1. Start with eight suggested bases and the 45-mile return radius. Click airports to add/remove stations; change settings and click Suggest station network to recompute.
2. Compare returning to launch with landing at another staffed base. The opening example uses OSM way 8788779: 115.3 km returning versus 97.4 km relocating, under the default assumptions. These are best choices across the selected bases, so departure airports can differ.
3. Simulate fleet animates one illustrative sortie per base at 600× playback and updates the destination aircraft inventory. Additional aircraft remain staged. Reset before running another batch.
4. Select a gold transmission line or an OSM segment from the list, then click **Open selected corridor in 3D**.
5. Watch the aircraft and the gimbal inset. Set speed from **25–50 mph** (default 40), choose 1×/5×/10× playback, target phases automatically or choose A/B/C, and adjust camera FOV or enable automatic zoom. Pause and restart are available.
6. Export UN geometry downloads the selected corridor's synthetic structures, phase junctions, conductor spans and explicit associations. Export scenario saves the fleet assumptions and selected sortie.

The 3D view is an idealized moving-camera demonstration, not the original constrained mission planner. It uses a constant-speed spline, 60 m lateral offset and 85 m height above a flat local datum. It does not validate aircraft bank/turn limits, terrain clearance, gimbal slew limits, occlusion, image resolution or exposure. Auto targeting chooses the nearest structure and cycles phases every two simulation seconds; it is not a guarantee of usable inspection imagery at every attachment. The original mission planner remains separately available in Flightline.html.

## Data provenance and screening

- [FAA NASR, effective 2026-10-01](https://www.faa.gov/air_traffic/flight_info/aeronav/aero_data/NASR_Subscription/2026-10-01/): 128 Ohio operational, public-use airports with NON-ATCT tower status. The default shortlist has 89 airports outside Census urban areas with at least one runway ≥2,500 ft. This is a geographic screen, not FAA NPIAS Regional classification or an airport suitability assessment.
- [OpenStreetMap contributors, ODbL 1.0](https://www.openstreetmap.org/copyright): snapshot 2026-10-16. 681 ways tagged AEP and ≥69 kV. Match operator American Electric Power / AEP Ohio, or operator:wikidata Q464092 / Q109015295. 10,160 power-line ways lack operator tags; these are not assumed to be AEP. Preserve OSM attribution and ODbL terms when redistributing derived data.
- [Census TIGERweb Urban](https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/Urban/MapServer): 2020 urban-area polygons determine whether the airport reference point is outside an urban area. Simplification tolerance 0.0001 degrees. Ohio boundary comes from TIGERweb State_County.

The embedded snapshot is src/fleet/ohio-data.json, including provenance. OSM area selection can include ways extending across the state border. Coverage metrics sample only points inside Ohio, at intervals no longer than 2 km, weighted by segment length. They measure circular geographic reach to the tagged subset, not coverage of AEP's complete network or inspectable sortie distance. The suggested bases greedily maximize this metric; they are not a globally optimal deployment.

Default usable sortie distance = min(2 × 45 miles, 80% × 200 km) = 144.84 km. Both return and relocation count departure transit + the entire selected OSM way + arrival transit. There is no second range allowance for relocation. Straight transit legs omit airspace, weather, terrain, communications and detours. No launch, landing or inspection dwell energy model is included. Some long OSM ways exceed the budget and correctly remain infeasible; segment splitting is future work. Airport access and BVLOS/multiple-aircraft authorizations are separate from this geographic model.

## Utility Network adaptation

This follows the [ISV GeoJSON + JSON convention](https://isv.wiki/meter-village-geojson-un.html) and [simulator village documentation](https://github.com/overview-solutions/smart-village-simulator/tree/main/villages). It is an exchange prototype, **not a native Esri Utility Network geodatabase**.

| Generated object | Semantic UN class | Role |
| --- | --- | --- |
| Synthetic lattice support | StructureJunction | Structural support only |
| A/B/C phase attachment | ElectricTransmissionJunction | High Voltage Attachment, electrical endpoint |
| Sagging phase span | ElectricTransmissionLine | High Voltage Overhead Conductor |
| Tower → attachment association | Structural attachment | Junction attaches to structure |
| Attachment → span → attachment | Connectivity | Explicit phase-preserving electrical connections |

Esri [structural attachment rules](https://doc.esri.com/en/arcgis-pro/latest/help/data/utility-network/create-structural-attachment-association.html) do not attach a line directly to a tower; the junction provides that relationship. Class names follow [Electric Transmission Essentials](https://doc.arcgis.com/en/arcgis-solutions/11.5/reference/other/ElectricTransmissionEssentials_UtilityNetwork.html); numeric asset-domain codes are intentionally not invented.

Only horizontal alignments and OSM provenance come from source data. Supports at major bends and nominal 450 m (1,476 ft) spacing, after 25 m alignment simplification, heights, phase configuration, insulators and parabolic sag are synthetic. Features have deterministic IDs, assetClass/assetGroup, phase where applicable, nominalKv, subnetworkId and sourceOsmWay. Each way gets a hypothetical subnetwork with no controller; crossings do not imply connectivity. GeoJSON Z is meters above an invented flat local datum, not surveyed elevation. The renderer uses local east/up/south coordinates; unlike ISV's time-axis visualization, this view's vertical axis represents physical height. Import into ArcGIS would require a real schema, coded domains, spatial/vertical reference validation, GUID mapping, association rules and topology validation.

## Flight controller recommendation

The prototype is browser-only; no controller is connected. For an Albatross, prefer **PX4 on the manufacturer's qualified ARKV6X/Pixhawk configuration**, with a companion computer for inspection targeting and onboard mission decisions. A future Go fleet service should handle scheduling and telemetry, while MAVLink/MAVSDK connects the companion to the autopilot. Aircraft control and failsafes stay onboard.

The [current Albatross RTF page](https://store.appliedaeronautics.com/albatross-uav-rtf/) lists PX4 and an optional ARKV6X / Jetson Orin package. It advertises 100 km+ range; the requested 200 km is a scenario assumption requiring payload-specific validation. Communications range is a separate constraint. See [PX4 companion architecture](https://docs.px4.io/v1.14/en/companion_computer/).

## Developer workflow

Node is needed only to edit/build source, not to open the deliverable:

```sh
npm ci
npm test
npm run build:fleet
python3 scripts/fleet_standalone.py
```

For source preview: `npm run dev`, then open `/ohio.html`. The normal `npm run build` retains the original mission sandbox. Deploy the generated OhioFleet.html alongside Flightline.html on GitHub Pages; do not publish a development HTML that points directly at src/*.ts.

Modules: model.ts owns fleet distance/coverage calculations; un.ts generates pure geometry and associations; inspection.ts renders the 3D pass; main.ts owns map and UI. A future backend can replace data loading and scheduling without coupling flight control to the renderer.

## 3D mission and data inspector

OhioFleet.html now opens in 3D by default; use `#network` to open the statewide view. Header controls hide/show the sidebar and bottom data panel. The bottom panel stacks the selected mission item above its matching UN-style structure, phase junctions, outgoing 3D conductors and associations. Follow aircraft tracks the current tower; selecting a tower manually turns that off.

The mission JSON is an application preview of `MISSION_ITEM_INT` fields, not a binary MAVLink 2 packet. Optional QGC WPL 110 export uses tab-separated fields and relative-altitude frame 3; the INT preview uses frame 6 and latitude/longitude scaled by 10⁷. GeoJSON uses longitude, latitude, local height. Both describe synthetic coordinates with a hypothetical home datum. These are the 3D pass's spline control points; actual autopilot interpolation would differ. No executable takeoff, landing or gimbal commands are claimed. See [MAVLink file formats](https://mavlink.io/en/file_formats/) and [MISSION_ITEM_INT](https://mavlink.io/en/messages/common.html#MISSION_ITEM_INT).

## Continuous 3D world

The Ohio boundary, AEP-tagged network, airport markers, selected-base coverage rings, selected sortie, detailed corridor and gimbal camera now share one georeferenced Three.js scene. Use Ohio extent, Corridor extent and Follow aircraft as camera bookmarks. Scroll zooms continuously; drag orbits and right-drag pans. Orbit and zoom preserve aircraft following; Stop following releases it. The data dock stays linked to the selected inspection corridor. Fleet simulation markers also appear in this world.

For performance, the statewide layer uses line alignments; detailed synthetic towers and individual phase conductors are generated for the selected corridor. Choose another OSM segment in the sidebar to inspect it. The original Austin mission editing sandbox remains a separate tool; its unrelated geographic demo is not relocated into Ohio.

## Operations dashboard presentation

The default is a statewide view with eight simulated aircraft already distributed along assigned routes, running at 5× playback. Follow aircraft opens the selected fleet aircraft in close-up; pause and completion hide its phase-attachment camera and targeting overlay. State and Locate demo move the same camera, with manual orbit/zoom still available. Plan network and Data objects reveal optional panels; tuning controls are under Mission settings.

Data objects use independent CSS depth blocks inspired by the Object Nursery presentation: containment becomes nested blocks, primitives retain their types, and arrays disclose their lengths. Expand each object to inspect actual fields. These are diagrammatic shapes, not physical geometry inferred from arbitrary JSON. Raw formats and existing exports remain available. This presentation does not import or alter Object Nursery code or data. All live-looking activity remains a local simulation.

## Multi-aircraft operations

Click a vehicle label or select its stable OH identifier to highlight its route and open progress, destination, remaining distance and simulated ETA. Mission reflection expands its current position and event history. Follow aircraft tracks the selected vehicle; orbit, zoom and pan preserve following. Use Stop following or State to release it. Closing the card leaves all aircraft running.

Return to launch affects only the selected vehicle and retraces its flown route from its current position. This strategic distance-only simulation does not validate turns, airspace or energy feasibility. Aircraft remain at their landing locations with stable identities. Pause simulation freezes the fleet clock; it does not represent aircraft hovering. Playback options are 1×, 2×, 5× (default), 10×, 60× and 600×. Initial in-flight positions are synthetic scenario seeds, not live telemetry.

`operations.ts` owns per-aircraft progression and return state; `fleet-panel.ts` presents selectable vehicle overlays and operator controls. The close-up renderer follows the selected fleet route and shared clock.

## Inspection flight and camera timing

The close-up inspection demo includes illustrative runway roll, climb, inspection, approach and landing roll at synthetic corridor-end strips. Its third-person camera follows aircraft position and heading continuously, without targeting individual towers. These are animation phases, not airport/runway or aircraft performance validation.

Only uncaptured attachments ahead of the aircraft (more than 20 m forward, within 650 m) are eligible. Each support is captured as a full-height structure profile before its phase close-ups. The simulated gimbal slews at up to 15 degrees per simulation second; zoom FOV changes at up to 4 degrees per second. Every target change requires at least 2 seconds of repositioning followed by 1.5 seconds within 0.5 degree of aim and settled zoom, with at least 4 seconds between shots. Inspection playback defaults to 1×. These are illustrative assumptions, not calibrated payload specifications. Targets that pass behind are skipped; complete phase coverage is not guaranteed. Playback acceleration also accelerates camera timing.

## Basemaps

The upper-right selector offers Offline grid, Dark topo, Topographic and Aerial imagery. Online modes stream USGS The National Map tiles at zoom levels 5–16 around the camera target; dark topo recolors the topographic tiles. Imagery is historical USGS/USDA imagery, not live imagery. The raster is draped on the scene's flat geographic ground, not a terrain elevation mesh. Dark aerial imagery is the default; Offline grid is the no-network option. Failed tiles leave the ground and operational overlays available.

Sources: https://basemap.nationalmap.gov/arcgis/rest/services/USGSTopo/MapServer and https://basemap.nationalmap.gov/arcgis/rest/services/USGSImageryOnly/MapServer .

Following uses aircraft displacement to translate both camera and orbit target together, preserving the operator’s chosen distance, angle and framing. Initial acquisition moves to about 206 m from the aircraft; touching the camera interrupts only this approach, not tracking. Fleet and inspection-demo following use the same behavior.

## Demo return command

Return demo to launch replaces the close-up aircraft's active path with a return curve from its current position, an illustrative airborne turn, and the flown corridor back to the launch strip. Imaging stops during return, but aircraft movement and following continue until Landed at launch. This curve is not checked for terrain, exclusions or aircraft performance. Restart restores the outbound mission. In fleet mode, Return selected fleet aircraft controls the same aircraft shown in close-up.

## Dark imagery and nearby OSM context

Aerial imagery is blended with a 55% dark blue veil in the tile material; aircraft, structures and UI are not dimmed. Load nearby 3D OSM requests a 2 km square around the current camera target from the public Overpass API. Zoom/follow to the inspection area first. Buildings use closed OSM way footprints and tagged heights; levels are estimated at 3 m each, otherwise buildings default to 9 m. Power towers/poles are schematic supports, substations are flat footprints, and power lines are schematic 25 m alignments. Estimated heights are counted in the UI. Multipolygon relations are not supported in this initial layer.

Context is optional, internet-dependent, view-only and not added to the mission or Utility Network export. It is not obstacle-clearance or terrain data. OSM coverage varies; imported features are not ownership-verified. Attribution: © OpenStreetMap contributors (https://www.openstreetmap.org/copyright). The Show checkbox hides loaded context. A failed request retains the previous context.

Nearby OSM context also includes individually mapped trees (schematic crowns/trunks; missing heights estimated at 8 m), closed woodland/grass/meadow/park areas, waterways and water polygons, roads, footpaths and cycleways. Road/path/water widths are illustrative, not measured; bridges and tunnels are currently drawn on the flat ground. Woodland is shown as a green footprint, not invented individual tree locations. Multipolygon-only features remain unsupported. All features depend on local OSM mapping and service availability; no obstacle clearance is inferred.

## Unified fleet and mission history

Follow aircraft uses the selected OH vehicle's authoritative position, heading, altitude and route; it loads that vehicle's transmission corridor for detailed structures and gimbal acquisition. All aircraft are seeded in flight. Shared 1×/2×/5×/10×/60×/600× controls accelerate the statewide simulation and close-up together. Launch and landing use a schematic altitude ramp at airport endpoints, with illustrative runway strips. No aircraft-performance validation is implied.

Replay from launch and the mission-history slider replay the selected aircraft's traveled path, including a return leg if requested. Its live position is held while replaying; other aircraft continue. Back to live restores the saved position, or playback rejoins it automatically. History before initial seeding is reconstructed from the assigned route, not recorded telemetry; image captures are simulated anew during replay. Historical mode disables return commands. The state overview remains the same scene and does not reset missions.

## Camera acquisition timing and sampling

The EO model is provisional pending exact Raptor payload identification. NextVision lists 40× optical plus 2× digital zoom (https://nextvision-sys.com/cameras-cpt/raptor/). An integrator lists 1280×720 EO and 60° wide HFOV (https://www.deltaquad.com/payload/surveillance/nextvision-raptor); variants differ, and the manufacturer's current page identifies 1280×720 as IR resolution, so do not treat it as confirmation of this EO profile. Digital zoom is not enabled or credited with additional optical detail.

Assumptions: 15°/s maximum slew, 30°/s² acceleration/deceleration envelope, eight seconds for full 1–40× optical zoom travel, 1.5 seconds settled focus, two seconds minimum acquisition. Narrow FOV tightens aim tolerance. The view reports slant range, angular FOV, nominal cm/pixel and projected pixels across a hypothetical 0.5 m detail. Captures require at least 24 pixels across that detail (illustrative threshold), settled aim and zoom; passed targets are skipped. This is ideal geometric sampling, not measured image quality, autofocus, atmospheric blur, shutter blur or defect detectability.

Per-target slew, zoom and focus timers overlap. Total acquisition is elapsed simulated time; playback acceleration scales all timers. Mission settings → Camera acquisition history retains the last 20 captures/skips. Gimbal preview is 16:9 and no larger than 1280×720 display pixels.

## Inspection recency

Ohio transmission alignments use a continuous green (today) → yellow (30 days) → red (90+ days) gradient. Gray means no history. Initial ages are deterministic synthetic scenario values, not utility records. A live aircraft completing its assigned corridor pass refreshes that OSM way; returns and history playback do not. Ages advance on the fleet simulation clock; resetting the scenario restores the seed history. This represents corridor-pass coverage, not verified capture of every phase attachment.

### Building loader update

Nearby queries default to a 500 m square (2 km optional), use GET with two public endpoints, and reuse successful responses cached for that exact area in browser storage. Cached timestamps are not live data; storage availability depends on the browser/file origin. Import OSM JSON accepts an Overpass JSON response with an elements array as an offline alternative. Reloading after source updates does not refresh a cached area automatically.

Building multipolygon relations now assemble member ways into closed outer rings, preserve courtyard holes, and suppress duplicate member footprints. Incomplete rings are skipped. Heights/min_height accept meters or ft; untagged heights remain estimates. Public endpoint access still fails in this environment; parser tests cover geometry independently.

## Preloaded Columbus urban mission

The last aircraft (OH-08 with the default eight-base setup) is assigned a hypothetical downtown Columbus corridor, if it fits the selected distance budget. It starts mid-inspection. Select “OH-08 · Columbus urban” and Follow aircraft. The scene automatically loads 38 real closed OSM building footprints bundled in `src/fleet/urban-buildings.json`; no Overpass request is needed. Height tags/levels are used where available, otherwise the existing labeled estimate applies. The corridor and transmission structures are synthetic and do not represent actual downtown utility assets or an authorized flight.

Building source: OpenStreetMap map API https://api.openstreetmap.org/api/0.6/map?bbox=-83.003,39.960,-82.999,39.963 downloaded 2026-10-25. © OpenStreetMap contributors, ODbL: https://www.openstreetmap.org/copyright . Snapshot includes complete building ways from that area; it is not full-city coverage.

Auto-loaded aircraft now start on their power-line inspection leg, not on straight airport transit. New vehicle selections list only aircraft currently inspecting. An already-selected aircraft remains available through return, landing and history playback so controls do not disappear mid-operation.

## Coordinate-led versus wide acquisition

Mission settings → Target acquisition defaults to Known coordinates. Between eligible forward targets, optical zoom holds instead of resetting to 1×. The gimbal targets the next known attachment/structure directly and still obeys modeled slew, zoom and settle limits. Wide-view reacquisition instead returns to 1× for each new structure and requires one simulated second of aligned wide view before zooming to the shot. This emulates search time; it is not actual image-based detection. Full-structure overview shots still widen as required to frame the structure in either mode. Mode selection persists across aircraft switches in the current page session.

### Downtown inspection and turn geometry (2026-10-25)

OH-08 now surveys eight connected hypothetical downtown Columbus passes: 28.7 km of infrastructure, approximately 29.9 km of inspection flight including turns, and 7.2 km of transit (about 81% inspection). SIM-CMH is an explicitly **hypothetical staging strip**, not an FAA airport or an approved downtown launch location. The other fleet bases retain their FAA dataset. Building coverage remains the bundled 38-footprint central Columbus patch plus optional nearby OSM loading; it is not a complete downtown city model.

Normal fleet missions now use tangent-continuous Dubins connections with a 700 ft (213.36 m) radius rather than instantaneous waypoint corners. Infrastructure geometry stays separate from the aircraft path. Path length, inspection boundaries, history and arrival use the curved route. Added turn distance is checked against the sortie range budget. The aircraft banks visually, and modeled camera acquisition pauses while estimated bank exceeds 3°. This threshold is a demo assumption. The simulator does not generate or validate LiDAR returns, coverage, density or georeferencing accuracy.

Research basis:
- [Applied Aeronautics Albatross](https://store.appliedaeronautics.com/albatross-uav-rtf/) lists 18 m/s (40 mph) cruise.
- [INAV coordinated turn documentation](https://inavflight.github.io/docs/next/advanced-features/fixed-wing-waypoint-turns/) explains radius dependence on speed and bank and the need for roll-in/out shaping.
- [RIEGL RiPARAMETER](https://www.riegl.com/en-uk/products/detail/riparameter) treats survey planning as sensor/platform/altitude-specific. No universal LiDAR-quality minimum radius was established by these sources.

Using the still-air coordinated-level-turn relation R = v² / (g tan(bank)), 40 mph gives approximately 122 m at 15°, 89 m at 20°, and 56 m at 30°. A 700 ft (213.36 m) radius corresponds to about 8.7° at 40 mph, or 13.4° at 50 mph. These are calculated examples, **not published Albatross bank limits or certified survey minima**. The selected 700 ft radius is the user-requested demonstration planning value; straight, steady acquisition legs are preferable to assuming good data through turns. Wind, stall margin, payload, scan geometry and trajectory quality need separate assessment.

Limits: Dubins geometry has instantaneous curvature changes; visual roll smoothing is not a roll-dynamics solution. Ohio routes are not checked against buildings, terrain, airspace or exclusions. Operator-triggered Ohio return still reverses the recorded route and has an instantaneous reversal at the command point; the new radius guarantee applies to normal planned missions only. Exported inspection control points are conceptual targets, not an executable representation of these curved fleet trajectories.

Camera and LiDAR overlays: Mission settings toggles show a gold FOV wireframe following the actual modeled gimbal quaternion and zoom (truncated at 150 m), plus a 60° downward scan fan. Twenty-five illustrative rays per sampled scan intersect displayed mesh surfaces; absent geometry falls back to local flat ground. Height-colored returns retain at most 12,000 points. Collection is limited to straight inspection flight, pauses with playback, and clears on history rewind or scene change. Overlays are excluded from the gimbal preview. They are visualization samples, not measured LiDAR density, intensity, range accuracy, coverage or calibrated sensor performance; high playback rates intentionally decimate sampling.

### Autonomous turnaround concept and timeline (2026-10-25)

Select an aircraft to activate the bottom mission timeline. Show/hide layers for altitude, battery, data, upload, solar, communications and SOCC sector blocks. The flight window emphasizes arrival/taxi; full turnaround includes charging/upload. Launch, Approach, Taxi, Secure and Ready preview buttons and the time slider move the selected 3D aircraft through a hypothetical plan while preserving its live state. Resume simulation plays the preview; Back to live restores/resumes live operations. Existing history replay is retained separately. Forecast segments are dashed, elapsed segments solid; axes are normalized with independent ranges in the legend.

After touchdown the aircraft follows a curved synthetic taxi route to a concept outdoor stand (4 minutes), secures four anchor markers (90 seconds), then charges and uploads concurrently. The solar panel and terminal are illustrative meshes. Ground layouts are not airport charts, anchors have no modeled mechanical engagement/verification, and all communications/deconfliction/NOTAM markers are hypothetical. No transmissions or real clearances occur. The demo stops at Ready; it does not dispatch an unapproved next mission.

Custom aircraft energy assumptions (not Albatross specifications): 2.4 kWh battery, 95% departure charge, 900 W airborne load minus 180 W effective airborne solar; 120 W taxi/securing load; 600 W effective parked solar minus 20 W hotel load and 35 W terminal load. Constant sunlight is assumed, with no weather/day/night or panel-area model. Upload assumes effective 20 Mbps and collection averages 2 GB/min of the planned inspection interval. These are scenario parameters in src/fleet/turnaround.ts; not hardware sizing or measured throughput. Readiness requires reaching 95% charge and completing upload; energy-deficit flights show an explicit warning. Camera and LiDAR counts are independent illustrative samples, not the source of these data-volume estimates.

Starlink's Mini support documentation gives 20–40 W average consumption: https://starlink.com/my/support/article/a7fe6525-5356-a837-48e6-33df176cdbc5 . This does not establish airborne integration, aviation service availability, thermal, RF, drag, or regulatory compatibility. The simulation starts the modeled bulk upload only after securing at the stand.

### Synthetic vegetation inspection (2026-10-25)

Timeline slider input previews and pauses while dragging; committing/releasing resumes simulation automatically. The thumb follows playback again after release. Discrete phase/breadcrumb buttons still pause for review.

Selected corridors now include varied hypothetical trees along ±30 m corridor boundaries, with encroaching tall trees and short/rounded/conical crowns. Purple squares are invented vegetation exclusion zones, separate from flight geofences; they do not change route feasibility. The downtown demo has 378 synthetic trees. The displayed simulated LiDAR rays intersect crown/trunk geometry, record tree hits, and reveal a height-related canopy extrusion two simulation seconds after first detection. Turning, paused, or hidden-LiDAR periods do not collect new hits. These extrusions reuse synthetic source geometry rather than reconstructing a real canopy from sparse returns. Export supplies footprint polygons plus base/top heights, risk, source, species provenance and projection attributes.

Screening computes nearest distance from the conductor's piecewise-linear sag geometry to a conservative cylindrical crown envelope. Red: envelope gap <2 m. Amber: gap <6 m now or under a 3-year growth scenario. Green: neither condition. Purple outline independently identifies exclusion-zone trees. All distances/growth rates are illustrative parameters; no MVCD, voltage-specific flashover, conductor sway, weather, falling-tree mechanics or arc-flash incident-energy calculation is implemented. Real vegetation clearances depend on applicable engineering standards and operating conditions; the simulated colors are prioritization examples, not electrical safety findings. See https://www.nerc.com/standards/reliability-standards/fac and https://www.ferc.gov/transmission-line-vegetation-management .

Species assist offers broad candidate groups from the generated crown form, explicitly unconfirmed. Reviewers can assign oak, maple, pine or cottonwood; this changes an assumed growth scenario, not a measured probability. Session records survive switching corridors but not reload. Actual LiDAR-based species inference requires labeled data and validation; relevant research: https://research.fs.usda.gov/treesearch/67630 .

Risk events appear as colored dots on the time profile and clickable breadcrumbs underneath. Clicking a breadcrumb previews its assessment time and opens that tree's review panel. Rewinding hides future assessments; only previously sampled trees at or before the selected time are shown. Observations and reviewer labels are demo-session state, not a durable inventory.

### Equipment candidates (2026-10-26)

Seeded equipment scenarios rotate through broken phase-A insulators, component corrosion visible in overview, loose phase-B attachment hardware, and crossarm damage visible in overview. Missing insulator discs and rust-colored crossarms provide illustrative geometry cues. A matching completed simulated camera capture reveals the equipment marker and timeline breadcrumb; no defect appears merely because the aircraft passes nearby. These are hypothetical seeded findings, not image-classifier output, measured degradation, or confirmed faults. Reviewers can mark reviewed, dismiss, and reopen candidates. Dismissed candidates are hidden from markers and breadcrumbs; the finding remains in the review list. Historical scrubbing hides findings before their capture time. Equipment and vegetation timeline layers can be toggled independently.

### Coverage turns and overlapping review exports

Near-90° bends (80–100°, adjoining legs longer than 426.72 m) now fly through the junction, extend the inbound alignment and take the opposite-direction long turn before rejoining the outbound alignment upstream of the junction. At 90° this is a 270° turn at the modeled 700 ft (213.36 m) radius, plus tangent straights. Extra distance is counted against the range budget. This avoids cutting out the start of the outgoing line; it does not guarantee camera acquisition or validate obstacle/airspace clearance outside the corridor.

Data objects → Export scope offers three synthetic SOCC packages. Adjacent cores share their boundary structure, with one additional span on both sides. Exports preserve shared IDs, all phase attachments, conductor endpoints and associations. Each SOCC has independent unreviewed incoming-side, outgoing-side and full-structure requirements. These are review requirements, not a claim that both sides have already been captured. WPL contains navigation only; use JSON for review metadata. SOCC assignment is hypothetical, not authoritative AEP territory.

The operator banner holds follow/overview/stop, aircraft selection, playback and camera visibility. Layer tools/findings and aircraft details open on demand. While the camera is active the map uses the left half and a letterboxed camera pane occupies the right, with telemetry below. Hide camera restores full-width map navigation. LiDAR history is capped at 6,000 returns (previously 12,000).

### Processed component findings

Seeded attachment/insulator and crossarm findings tint the actual affected meshes red two simulation seconds after the matching camera capture. Healthy/shared steel materials remain unchanged. Rewinding before processing or dismissing a finding restores its original color; marking reviewed retains red until dismissed. This is deterministic simulated processing, not image inference or confirmed damage.

Every fourth synthetic span has a phase-B compression splice at the sag midpoint. The UN-style export includes a splice junction and two same-phase conductor segments with explicit connectivity. Splices have their own forward camera target, obey the existing slew/focus/capture timing, and only produce a candidate after that target is captured. SOCC packages carry splice junctions, connected segments and independent splice review requirements. Missed shots remain undetected rather than fabricating coverage.

Camera retargeting now eases between orientations over at least four simulation seconds before the existing focus/settle requirement. Angular speed and acceleration limits still apply. Playback accelerates these transitions along with the flight; these remain provisional timing assumptions.

LiDAR preview history is now capped at 3,000 displayed returns. Camera & sensors reports an analytic 30 pts/m² acquisition budget: swath = 2 × local height × tan(30°), required pulses/s = ceil(30 × swath × speed / 0.8), assuming 80% usable returns. This is an idealized adjustable-rate sensor budget, not an implemented full-density point cloud or measured density guarantee. The sparse raycast preview and vegetation hits do not certify 30 pts/m² coverage, terrain penetration or uniformity. A calibrated sensor and coverage raster are still needed to verify that requirement.

### Shielding reference graphic
The selected airborne vehicle displays a sparse dashed lateral ring and separate horizontal/vertical distance leaders. Straight-flight nominal lateral allowance is 200 ft; turning allowance is 700 ft. Vertical comparison is 0–200 ft above the same nearest asset. These are scenario settings, not waiver validation. The nearest reference is selected horizontally from modeled conductors, other loaded power lines, and nearby OSM distribution, station, plant, tower, pole and transformer geometry. OSM heights are unverified: those references show unknown vertical clearance and cannot receive a green within-bounds status. Nearby OSM assets must be loaded with the existing OSM loader; this is not a complete asset inventory. Unknown heights do not draw a vertical leader.

### Advance camera handoff
Known-coordinate mode selects the next uncaptured forward asset even beyond the 650 m exposure range, and prepositions during turns while capture remains paused. It no longer commands the forward/horizon idle pose when no eligible target exists; it retains camera orientation and zoom. Capture still requires inspection flight, range under 650 m, sufficient pixels, alignment, slew/zoom completion and focus settling. Wide reacquisition remains an explicit alternative.

### Capture-paced flight
Each synthetic structure receives a speed budget from its adjoining span length and a full-profile + three-phase shot sequence, with an extra splice shot on modeled splice spans. The budget includes slew, focus and a zoom allowance, plus handoff margin. Live inspection moves at a bounded 30–40 mph, with 1 mph/s speed changes. The selected camera can request a temporary slowdown from forward distance and remaining acquisition work; feedback expires after two simulation seconds if the camera is no longer active. Other aircraft retain their spacing-based pace. Narrow spans that cannot fit the sequence at the minimum speed display “additional pass needed”; no extra pass is automatically generated. Route geometry is unchanged; this adds a speed schedule. Live elapsed time and ETA reflect speed changes; timeline replay remains the existing nominal-speed distance approximation. The 30 mph floor is a scenario assumption, not a verified stall margin. No wind or airspeed/groundspeed distinction is modeled.

### SOCC and span review
Click the colored SOCC bands on the mission timeline or the sector labels in mission overview. The map frames that sector and hides the gimbal pane for inspection space. SOCC boundaries use the same three synthetic packages as export, including shared structures and one overlapping span. Dashed outline buffers distinguish their extent without filled polygons. Click a span line or a visible Tn–Tn+1 label to frame both adjoining structures with 100 m framing margin; the selected span has a 60 m outline buffer. Breadcrumb controls return to SOCC or mission level. Span finding buttons open existing equipment/vegetation review.

Red means a currently revealed high-priority or exclusion finding. Yellow means intermediate findings or incomplete camera evidence. Green requires full profile and all three phase captures (plus a modeled outgoing splice where present) and no current findings for that section. Green is not a complete vegetation/engineering clearance, nor proof of defect-free infrastructure. Evidence is session-local and can reset with replay/selection. Timeline positions are mapped from structure locations onto the initial route and scale with its estimated duration; contingency replans/replay do not provide a surveyed SOCC time boundary.

### Mission overview traffic
Two labeled synthetic traffic tracks are placed across each selected mission extent, with up to 30 seconds of trail, altitude/datum, knots, heading and observation age. The optional Rust service carries actual OpenSky velocity as well as heading. Live observations are filtered near the mission, not fabricated to meet a two-aircraft quota; observations older than 60 seconds are omitted. Display heights remain illustrative, not altitude separation. A live service/feed is required for real ADS-B observations.

### Span floors and reverse passes
SOCC view uses clickable 60 m half-width span floor buffers instead of floating span labels. Unscanned floors are transparent. A simulated inspecting aircraft passing within 100 m marks a span observed; this is a coarse visualization trigger, not measured LiDAR coverage. Observed floors use pending/issue/complete review colors. They remain clickable after Stop following and frame both adjoining structures. Evidence is local to the current scene and resets on replay/reselection.

Alternating rural demo assignments attempt a double pass for corridors at least 5 km long. The reverse pass uses curved connections with the existing 700 ft radius approximation, resets the camera checklist for opposite-direction acquisition, and is accepted only if its full route fits the configured distance budget. Other assignments retain a single pass. Turn clearance is not established by this radius approximation; captures can still be missed. This demonstrates additional verification opportunities, not guaranteed two-sided coverage or LiDAR accuracy validation.

### Dynamic line rating concept
The expandable Simulated DLR row follows mission, SOCC and span review. It shows a simplified steady-state thermal balance with synthetic changing ambient temperature, crosswind and solar irradiance; a section uses the minimum span ampacity. Nominal voltage converts ampacity to three-phase MVA, not to a new ampacity. The assumed conductor is 28 mm diameter, resistance 0.09 ohm/km at the assumed 75°C limit, emissivity/absorptivity 0.5. The convection approximation is illustrative, not an IEEE 738 implementation. No actual load or operational headroom is claimed.

Every voltage class receives a checklist for insulation coordination, phase/ground clearance, thermal sag and terminal capacity. These remain unverified without actual conductor specifications, surveyed geometry, equipment limits and approved voltage-specific criteria. Image and scan counts are separate. Thermal rating must not be interpreted as an approved usable system rating.

Example findings now cluster in 8 of every 20 structures, with lower healthy vegetation in the remaining section. Roughly half the interior spans can become green after complete captures; boundary findings, incomplete captures and short networks change that fraction. Unobserved floors stay empty. No real findings are overwritten to meet a color quota.

Background: https://www.energy.gov/sites/default/files/2017/08/f36/NYPA-Evaluation-Instrumentation-Dynamic-Thermal-Ratings-Overhead-Lines-Final.pdf

### Unified Profile
Mission, SOCC and Span share one bottom Profile panel. Selection from the map or sector/span clips updates its time window, scrubber and side ratings. Mission restores the whole operation; SOCC shows span clips; Span shows the selected interval. The intervals use the first nearest route passage and nominal duration, so repeat passes and speed changes are approximate rather than exact acquisition timestamps. The rating pane replaces the separate full-width block.

### Span completion and return preview
Span floors now wait for observed 10 m coverage cells across the full length, both endpoint neighborhoods (10 m), and two simulation seconds of processing. Sampling requires an inspecting, non-turning aircraft within 60 m laterally and LiDAR enabled. Mid-span starts, skipped time and incomplete passes remain unfilled. This is simulated along-track coverage, not a measured point-density guarantee.
Hover or keyboard-focus Return home to show the gold candidate route without commanding it. It refreshes while hovered and is removed on exit. Clicking recalculates from the current pose. Only the connection receives the existing geometric checks; the remaining route and airport approach remain unvalidated.

### SOCC edge features
SOCC view marks its two core boundary structures with pale ground rings, vertical leaders and labeled CB / XMFR / ANGLE / EXT badges. Click a badge to frame that boundary; hover for its role and provenance. Overlapping review spans remain outside the core edge. Adjacent SOCCs share identical boundary identifiers in their exports.
The existing three-sector split remains unchanged. Endpoint breakers and transformer terminals, and interior extension boundaries, are seeded demo annotations—not observed equipment or validated UN topology. An interior boundary with a modeled alignment change of at least 15° is annotated as an angle/strain structure, with the angle shown in the tooltip; its actual structure type is unverified.
