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

The default is a statewide view with eight simulated aircraft already distributed along assigned routes, running at 10× playback. Inspection demo separately begins the selected close-up inspection; pause and completion hide its phase-attachment camera and targeting overlay. State and Locate demo move the same camera, with manual orbit/zoom still available. Plan network and Data objects reveal optional panels; tuning controls are under Mission settings.

Data objects use independent CSS depth blocks inspired by the Object Nursery presentation: containment becomes nested blocks, primitives retain their types, and arrays disclose their lengths. Expand each object to inspect actual fields. These are diagrammatic shapes, not physical geometry inferred from arbitrary JSON. Raw formats and existing exports remain available. This presentation does not import or alter Object Nursery code or data. All live-looking activity remains a local simulation.

## Multi-aircraft operations

Click a vehicle label or select its stable OH identifier to highlight its route and open progress, destination, remaining distance and simulated ETA. Mission reflection expands its current position and event history. Follow aircraft tracks the selected vehicle; orbit, zoom and pan preserve following. Use Stop following or State to release it. Closing the card leaves all aircraft running.

Return to launch affects only the selected vehicle and retraces its flown route from its current position. This strategic distance-only simulation does not validate turns, airspace or energy feasibility. Aircraft remain at their landing locations with stable identities. Pause simulation freezes the fleet clock; it does not represent aircraft hovering. Playback options are 1×, 10×, 60× and 600×. Initial in-flight positions are synthetic scenario seeds, not live telemetry.

`operations.ts` owns per-aircraft progression and return state; `fleet-panel.ts` presents selectable vehicle overlays and operator controls. The close-up inspection demo remains separate from these strategic fleet routes.

## Inspection flight and camera timing

The close-up inspection demo includes illustrative runway roll, climb, inspection, approach and landing roll at synthetic corridor-end strips. Its third-person camera follows aircraft position and heading continuously, without targeting individual towers. These are animation phases, not airport/runway or aircraft performance validation.

Only uncaptured attachments ahead of the aircraft (more than 20 m forward, within 650 m) are eligible. Each support is captured as a full-height structure profile before its phase close-ups. The simulated gimbal slews at up to 15 degrees per simulation second; zoom FOV changes at up to 4 degrees per second. Every target change requires at least 2 seconds of repositioning followed by 1.5 seconds within 0.5 degree of aim and settled zoom, with at least 4 seconds between shots. Inspection playback defaults to 1×. These are illustrative assumptions, not calibrated payload specifications. Targets that pass behind are skipped; complete phase coverage is not guaranteed. Playback acceleration also accelerates camera timing.

## Basemaps

The upper-right selector offers Offline grid, Dark topo, Topographic and Aerial imagery. Online modes stream USGS The National Map tiles at zoom levels 5–16 around the camera target; dark topo recolors the topographic tiles. Imagery is historical USGS/USDA imagery, not live imagery. The raster is draped on the scene's flat geographic ground, not a terrain elevation mesh. Offline grid remains the no-network default. Failed tiles leave the ground and operational overlays available.

Sources: https://basemap.nationalmap.gov/arcgis/rest/services/USGSTopo/MapServer and https://basemap.nationalmap.gov/arcgis/rest/services/USGSImageryOnly/MapServer .

Following uses aircraft displacement to translate both camera and orbit target together, preserving the operator’s chosen distance, angle and framing. Initial acquisition moves to about 206 m from the aircraft; touching the camera interrupts only this approach, not tracking. Fleet and inspection-demo following use the same behavior.

## Demo return command

Return demo to launch replaces the close-up aircraft's active path with a return curve from its current position, an illustrative airborne turn, and the flown corridor back to the launch strip. Imaging stops during return, but aircraft movement and following continue until Landed at launch. This curve is not checked for terrain, exclusions or aircraft performance. Restart restores the outbound mission. The separate fleet card is labeled Return selected fleet aircraft to distinguish its strategic vehicle from the demo.
