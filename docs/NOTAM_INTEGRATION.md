# NOTAM integration status

Checked November 4, 2026. Flightline prepares a local review packet from a selected incident. Submission is unconnected. The packet contains an editable UTC window, coordinator, accountable organization, requested ceiling and source geometry. Report markers remain line geometry and require airspace review. All exported packets are flagged simulation and draft.

## Provider roles

FAA identifies CGI Federal as the provider for the modernized NOTAM Management Service. Its public FAQ describes the NMS API as a distribution interface and requires access requests. Origination uses role-based permissions. A data-consumer account does not establish origination authority. [FAA NMS](https://www.faa.gov/about/initiatives/notam) · [FAA FAQ](https://www.faa.gov/about/initiatives/notam/faqs)

Leidos publishes Flight Service web-service documentation and UAS NOTAM guidance. Confirm the current supported submission operation, applicable COA requirements, sandbox credentials and account entitlements directly before implementing an adapter. [Leidos web services](https://lmfswebservices.atlassian.net/wiki/spaces/WSS/overview) · [Leidos announcements](https://www.1800wxbrief.com/Website/announcements)

Disaster TFR requests and UAS activity notices have different approval paths. A generated packet cannot establish a TFR or authorize entry into one. [FAA TFR guidance](https://www.faa.gov/uas/getting_started/temporary_flight_restrictions)

## Planned Rust adapter

Extend the existing ingestion service only after obtaining the approved provider schema and origination entitlement. Keep credentials server-side. Validate geometry, altitude reference, UTC validity, accountable organization and authority before an explicit operator submission.

Persist an idempotency key and immutable draft revision before sending. Track submitted, pending review, approved, rejected, issued, cancellation requested and cancelled as distinct states. On a timeout, reconcile provider status before retrying. Store the actual issued identifier and authoritative geometry separately from the requested values. Cancellation requires a confirmed provider response. Preserve an audit record of each revision and response.

Current export is a Flightline contract for review, not an FAA or Leidos upload format. No remote submission, approval, issuance or cancellation is implemented. Access documentation and a test account are the next dependencies.
