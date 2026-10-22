# Reproducing the embedded snapshot

Runtime uses src/fleet/ohio-data.json, with source metadata. To rebuild, place the inputs below in one directory and run `python3 scripts/prepare_ohio_data.py /path/to/raw-directory`. Standard-library Python only. Metadata pins the FAA cycle and retrieval date; update these deliberately on refresh.

- FAA: download https://nfdc.faa.gov/webContent/28DaySub/extra/01_Oct_2026_APT_CSV.zip and extract APT_BASE.csv and APT_RWY.csv.
- OSM: POST the following as the `data` form field to https://overpass-api.de/api/interpreter and save as osm.json. A fresh query returns current data, not the historical snapshot.

```overpass
[out:json][timeout:120];
area["ISO3166-2"="US-OH"][admin_level=4]->.oh;
(way[power=line](area.oh);relation[route=power](area.oh););
out geom;
```

- Ohio: query https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/State_County/MapServer/0/query with `where=STATE='39'`, `outFields=NAME,STATE`, `outSR=4326`, `f=geojson`, `maxAllowableOffset=0.002`. Save as ohio.geojson.
- Urban areas: query https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/Urban/MapServer/0/query with `where=1=1`, `geometry=-84.9,38.3,-80.4,42.4`, `geometryType=esriGeometryEnvelope`, `inSR=4326`, `spatialRel=esriSpatialRelIntersects`, `outFields=NAME`, `outSR=4326`, `f=geojson`, `maxAllowableOffset=0.0001`, `resultRecordCount=1000`. Save as urban.geojson. Verify transfer limit is not exceeded and Census year remains appropriate; the snapshot contained 136 features.

The preparation script ignores relations (none returned in the snapshot). Unknown operators stay unassigned. © OpenStreetMap contributors; OSM-derived data is under ODbL 1.0, https://www.openstreetmap.org/copyright . FAA and Census inputs are public federal data. No proprietary AEP network data is used. Synthetic tower geometry is explicitly marked.
