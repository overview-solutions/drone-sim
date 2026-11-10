# Earth Fire Alliance / FireSat integration plan

Research checked November 4, 2026. Status — proposed integration. Flightline currently connects to NWS alerts and displays separately labeled demo incidents. No FireSat credentials, imagery or observations are bundled.

## Availability and access

EFA describes four products — hotspot identification, fire perimeter, fire progression and fire radiative power (FRP). Its access page lists commercial licensing for utilities and infrastructure companies. Non-commercial availability for eligible agencies, researchers and NGOs is described from 2027. Listed delivery channels include API push/pull, Google Cloud, Amazon S3, ArcGIS Online, raster services and vector services. Exact endpoints, authentication, quotas, Ohio coverage and contractual permissions require confirmation. [EFA data access](https://earthfirealliance.org/data-access/)

The published roadmap describes initial early-adopter delivery at least twice daily by the end of 2026, faster coverage during 2027–2029, and approximately 20-minute-or-better global updates for the full constellation from 2030 onward. These are provider rollout statements, not measured Ohio delivery performance. EFA lists approximately 80 m average imagery resolution and detection of fires as small as 5 × 5 m. Detection size must be kept separate from pixel resolution and location uncertainty when relating observations to a conductor or tree. [FireSat products and roadmap](https://earthfirealliance.org/about-firesat/)

Deepfire is a potential delivery partner. Its documentation describes an authenticated wildfire API and work with FireSat, alongside other satellite sources. Confirm FireSat entitlement and source identifiers for the account before treating any returned hotspot as a FireSat observation. [Deepfire documentation](https://docs.deepfire.co/)

## Proposed operator experience

These are Flightline design proposals.

| Product | Map and Profile behavior | Utility workflow |
| --- | --- | --- |
| Hotspot | Small marker, observation age, source and supplied uncertainty. Click frames the detection and nearby corridors. | Identify SOCCs for operator review and draft follow-up inspection tasks. |
| Perimeter | Thin boundary with optional faint fill. Click frames the affected area. | Intersect current perimeter with corridors, substations and airport approach areas. |
| Progression | Time-indexed boundary snapshots in Profile, with observed and modeled changes visually distinguished. | Review which assets entered an affected area and when. |
| FRP | Optional intensity layer with original units and quality flags. | Prioritize incident review using source measurements and local context. |
| Multispectral imagery | Load the selected event's image footprint on demand. | Compare incident context with subsequent drone imagery and vegetation review. |

Use the existing unobtrusive hazard strip. New observations update an existing incident card where the provider establishes identity. Camera movement happens only after selection. Keep acquisition time, provider publication time and local receipt time distinct. The one-minute demo trigger remains explicitly simulated and independent of live delivery.

An intersection creates an exposure candidate. Confirmed component damage requires inspection evidence. Show positional uncertainty before assigning a fire to a particular span. FireSat context can support a proposed mission hold or return-route review, with operator acceptance and the existing flight constraints applied separately.

## Proposed Rust data flow

Extend the optional service under `ingestion/` with a FireSat provider adapter once access is available.

1. Fetch licensed observations within an Ohio or mission-area bounding box using the negotiated delivery channel. For cloud objects, use manifests and object revisions. For push delivery, validate the provider's agreed authentication and replay protection.
2. Preserve the original record, timestamps, quality flags, coordinate reference system and attribution in storage permitted by the license.
3. Normalize vectors into WGS84 GeoJSON. Retain source geometry and uncertainty. Preserve raster georeferencing and request only selected areas and resolutions.
4. Upsert by provider, product, source ID and revision. Track updates and retractions explicitly. Retry with backoff and use watermarks with a small overlap to recover delayed records.
5. Expose a proposed read-only `/v1/hazards` response to the frontend. Keep provider credentials in the service. Adapt `src/fleet/disasters.ts` to consume normalized incidents beside NWS observations.
6. Associate affected geometry with mission, SOCC, span and asset IDs through spatial joins. Keep these derived associations separate from the source record.

Existing `/v1/airspace` serves traffic and notices. The new hazard endpoint and adapter described here are planned work.

### Proposed normalized record

This is a Flightline contract sketch, not an EFA response schema. Null means unknown or unavailable.

```json
{
  "type": "Feature",
  "id": "provider-product-observation-revision",
  "geometry": null,
  "properties": {
    "provider": "Earth Fire Alliance",
    "sensor": "FireSat",
    "product": "hotspot",
    "sourceId": null,
    "incidentId": null,
    "revision": null,
    "observedAt": null,
    "publishedAt": null,
    "receivedAt": null,
    "validUntil": null,
    "confidence": null,
    "confidenceScale": null,
    "uncertaintyM": null,
    "frp": null,
    "frpUnit": null,
    "qualityFlags": [],
    "status": "unknown",
    "sourceUrl": null,
    "licenseId": null,
    "simulated": false
  }
}
```

Do not infer extinction from the absence of a later detection. Preserve a stale observation with its age until a documented source status or retention policy resolves it. Do not merge NWS warnings and satellite detections solely because their footprints overlap.

## Access questions to resolve

- What coverage and revisit cadence are available over Ohio now? What are acquisition-to-publication delays, outage behavior and cloud/quality limitations?
- Which products and spectral bands are available under a utility evaluation agreement? Can EFA supply an Ohio sample with its schema and quality documentation?
- Which delivery channel provides stable observation IDs, revisions, retractions, timestamps, paging and historical replay?
- What do confidence, FRP, location uncertainty and validity fields mean? Which progression outputs are observed versus predicted?
- May AEP staff, contractors and partners view the data? Are caching, derived exposure assessments, screenshots, exports and public demonstrations permitted?
- What attribution, retention, redistribution and deletion requirements apply? Confirm these separately for direct EFA and partner delivery.

Use EFA's data-interest registration to request evaluation access. No outreach has been sent. Public documentation about the feed does not establish permission to publish licensed feed contents.

## First implementation milestone

Obtain one authorized sample, implement the Rust normalization adapter, and display a source-labeled incident with click-to-focus and observation age. Exercise duplicate delivery, revised boundaries, missing geometry, stale data and retraction. Then add corridor exposure associations and on-demand raster viewing. Record measured Ohio freshness before describing the integration as operational real-time monitoring.
