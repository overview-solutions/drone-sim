# Corridor vegetation: layered data plan

Research checked 2026-10-25. This is a proposed ingestion architecture; no real canopy, NDVI, species, or Gaussian-splat datasets have been added to the simulator by this change.

## Regional pilot and automated discovery

Choose a 2–5 km distribution corridor with urban trees plus a wooded section. Use real line geometry, not the hypothetical Columbus demo lines, to define the pilot. Query intersecting source footprints, retain date/CRS/vertical units/classification metadata, download a small reproducible sample, then automate the same manifest. Keep a manual import fallback when a service fails.

Verified Ohio services:
- OGRIP data-services directory: https://das.ohio.gov/technology-and-strategy/OGRIP/data_services
- Current imagery coverage index, queryable polygons with year, month_flown, resolution and county; supports pagination and GeoJSON: https://maps.ohio.gov/arcgis/rest/services/Hosted/OSIP_Index_June_2026/FeatureServer/0
- Current imagery ImageServer: https://maps.ohio.gov/image/rest/services/osip_most_current/ImageServer?f=pjson — metadata advertises RGB, three bands, Catalog/Image/Metadata capabilities. Use imagery services for preview and source imagery for quantitative work; do not treat rendered JPEG tiles as radiometrically calibrated data.
- Older OSIP download tile layers: https://maps.ohio.gov/arcgis/rest/services/OGRIP/OSIPDownloads/MapServer — inspect vintages rather than assuming these are current LiDAR.
- Candidate 3DEP tile endpoint https://maps.ohio.gov/arcgis/rest/services/OGRIP/3DepTiles/MapServer/0 returned a 500 through the research browser; availability/schema/download URL fields were not verified. Do not hard-code this as a working production connector.
- USGS LidarExplorer is a fallback for finding matching 3DEP acquisitions: https://www.usgs.gov/tools/lidarexplorer

Typical ArcGIS index query: query?where=1%3D1&geometry=<AOI envelope>&geometryType=esriGeometryEnvelope&inSR=4326&spatialRel=esriSpatialRelIntersects&outFields=*&returnGeometry=true&outSR=4326&f=geojson . Encode the envelope and paginate past service limits. The coverage index identifies acquisitions; it does not itself guarantee raw point-cloud download access. Resolve product URLs from verified catalog metadata. Use bounded EPT/COPC reads where the chosen dataset offers them; otherwise cache intersecting LAZ downloads. Never retrieve the entire state for a narrow corridor.

## Three levels of geometry

1. Lightweight line/structure vectors and canopy-height zones for normal navigation.
2. Automatically request nearby point-cloud chunks when a buffered line corridor intersects canopy footprints, canopy height overlaps plausible conductor height, data confidence is low, or source dates are old. These are candidate-selection signals, not proof of contact. Manual detail loading should always be available. Limit loading by visible area, byte/point budget, and cache; unload outside a wider hysteresis radius.
3. Optional georeferenced Gaussian splats from appropriate imagery/reconstruction for visual context. Splats are not reliable solid collision geometry and do not expose obscured wires or branches merely because they render photorealistically. Preserve classified LiDAR and uncertainty for measurements. Do not replace missing geometry with invented detail.

## Height-specific rasters

A canopy height model is 2.5D: one canopy-top value per horizontal cell. It cannot represent a wire running through a canopy, a gap beneath a crown, or multiple branches at the same XY. Use several aligned products:

| Product | Value in each cell | Use |
|---|---|---|
| DTM | Ground elevation in a declared vertical datum | Terrain and normalization |
| CHM | Vegetation height above ground, e.g. robust upper percentile | Canopy envelope and zone extrusion |
| Height-slice stack | Observed vegetation return count/density in 0–2, 2–5, 5–10, 10–15 m AGL etc. | Vegetation near conductor height |
| Vertical occupancy | Occupied voxels and observation counts | More complete 3D structure near assets |
| Quality layers | Density, ground support, no-data, acquisition date | Distinguish weak evidence from absence |
| Spectral layers | NDVI or explicitly named RGB greenness index | Color and vegetation condition context |

An empty LiDAR slice means no observed returns, not proven free space: occlusion, scan direction and point density matter. Query slices relative to actual conductor elevation where available rather than a generic fixed height band. Height rasters can be tiled COGs with overviews and served only for the visible corridor. Point-cloud detail still matters for distribution; neither a CHM nor extruded zone is a branch-level clearance model. Cross-sections and synchronized height sliders would make these products useful in this viewer.

## Spectral coloring and species

NDVI=(NIR-red)/(NIR+red), masking no-data and zero denominators. Ohio's verified current RGB service lacks NIR. Select a dated four-band NAIP acquisition with confirmed NIR, or acquire calibrated multispectral imagery. USDA four-band explanation: https://www.fsa.usda.gov/Internet/FSA_File/fourband_info_sheet_2011.pdf . Not every imagery product is four-band. RGB greenness can be useful but label it as RGB-derived, not NDVI. NDVI alone is not a diagnosis or reliable species classifier. Preserve imagery date, leaf-on/off season, resolution, and normalization; resampling coarse imagery onto fine geometry adds no spectral detail.

OSM provides existing vectors: natural=tree nodes; natural=tree_row ways; natural=wood / landuse=forest polygons; natural=scrub, grassland, hedges and other land-cover tags. Tree tags may include genus, species, height, crown_diameter, leaf_type and leaf_cycle. Coverage is uneven, absence is not absence of vegetation, and tree points need measured crown diameter or a clearly marked assumed crown radius before they become polygons. Woodland polygons are mapped land cover, not LiDAR-derived crown boundaries. Preserve OSM attribution and license requirements.
- https://wiki.openstreetmap.org/wiki/Tree
- https://wiki.openstreetmap.org/wiki/Tag:natural%3Dtree_row

Prefer municipal street-tree inventories with species where available. USDA TreeMap supplies modeled forest attributes tied to FIA plots, not a surveyed species ID for each visible tree: https://research.fs.usda.gov/firelab/products/dataandtools/treemap-tree-level-model-united-states-forests . USDA Tree Atlas is broader habitat context: https://www.fs.usda.gov/nrs/atlas/tree/ . LiDAR + seasonal/multispectral imagery + local labeled inventory could support later species-group classification with confidence and an unknown class; LiDAR shape alone should not be labeled definitive species.
