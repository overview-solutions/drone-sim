# Airspace ingestion (Rust)

Run from the drone-sim repository, with Rust/Cargo installed:

```sh
cargo run --locked --manifest-path ingestion/Cargo.toml
```

Open `OhioFleet.html`, expand **Airspace awareness**, select **Rust local service**. Standalone HTML requires no Node. Service binds only 127.0.0.1:8788 and exposes read-only `GET /v1/airspace`. File pages and localhost origins are supported; browsers may require local-network permission. Hosted HTTPS pages may block localhost HTTP: use the local HTML or dev page.

The default service has no upstream feeds configured. The UI's separate **Simulated examples** mode has invented airplane/helicopter/Remote ID traffic and NOTAM/TFR examples near the selected corridor. These are not observations or authorizations.

## OpenSky

Set `OPENSKY_ENABLED=1` before running. Optional `OPENSKY_CLIENT_ID` and `OPENSKY_CLIENT_SECRET` enable OAuth client credentials; never put credentials in frontend files. Anonymous access is supported where the upstream allows it. Ohio bounding box, 300-second polling, 15-second timeout, token renewal and rate-limit backoff are implemented. Position time is preserved separately from last radio contact. Missing coordinates and ground reports are omitted. Rotorcraft category 8 is displayed as helicopter; unknown aircraft are not inferred from speed.

Positions turn gray after 60 seconds and disappear after 10 minutes. This polling interval is deliberately conservative for API quota, **not tactical traffic awareness**. Failure retains timestamped previous observations, never silently inserts simulated ones.

Official schema/access: https://openskynetwork.github.io/opensky-api/rest.html

## Receiver and notice imports

Set `REMOTE_ID_FILE` and/or `NOTICES_FILE` to absolute paths. Files are reread every five seconds; producers should atomically replace them. JSON timestamps are Unix seconds, coordinates WGS84 longitude/latitude. This is an adapter contract, not an OpenDroneID radio decoder or FAA message parser.

Remote ID array example (replace timestamp with the receiver observation time):

```json
[{"id":"receiver-drone-1","label":"Observed UAS","observedAt":1793000000,"longitude":-83.0,"latitude":40.0,"altitudeM":120,"altitudeDatum":"WGS84 ellipsoid"}]
```

Only valid coordinates with observations less than 120 seconds old are accepted. No operator location is collected by this contract. A Bluetooth/Wi-Fi receiver plus decoder must write the observations. OpenDroneID is a decoding ecosystem, **not a statewide feed**: https://github.com/opendroneid/opendroneid-core-c

NOTAM/TFR array example:

```json
[{"id":"EXAMPLE-ONLY","title":"Hypothetical runway work","source":"Simulation","start":1793000000,"end":1793100000,"ring":[[-83,40],[-82.99,40],[-82.99,40.01],[-83,40.01]]}]
```

`ring` is optional: text-only notices are shown without fabricated boundaries. Upcoming and active notices are distinguished; expired notices are hidden. Geometry is a horizontal outline, not a reconstructed legal airspace volume. Import authoritative notice text, identifiers, validity and verified geometry through an authorized upstream exporter. The service does not scrape FAA NOTAM Search or assert notice completeness/currency.

FAA access: https://aa.data.faa.gov/ · TFR reference: https://tfr.faa.gov/

ADS-B Exchange, FAA SWIM/SFDPS and Dronetag are **not connected adapters** in this version; their account/partner access and payload contracts must be configured before implementation. OpenSky is the implemented internet adapter; notices and receiver detections use local JSON imports.

## Display limitations

Observed barometric/ellipsoid altitude cannot be equated to simulator AGL. All traffic symbols use illustrative display heights; the list preserves supplied altitude and datum. No vertical-clearance calculation, automatic evasive command, full surveillance coverage, or flight authorization is implied. Observation age uses wall-clock time, independent of mission replay. Demo traffic also runs on wall-clock time.

Service CORS permits file/localhost use only. It has no write endpoints. Keep it local; do not expose receiver data on a public host without authentication and data retention controls.

## Tests

```sh
cargo test --locked --manifest-path ingestion/Cargo.toml
```
