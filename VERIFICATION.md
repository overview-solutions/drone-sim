# Verification

Verified locally on 2026-10-13 with Node.js 25.2.1.

- `npm run build`: passed strict TypeScript checking and production bundling. Vite reports the expected large MapLibre bundle warning; the app bundle is approximately 293 KB gzipped, plus the map worker and CSS.
- `npm test`: 8 passing tests cover analytic path endpoints, bounded curvature, exclusion clearance, exact waypoint passage, return from multiple mission positions, enclosed-home failure, invalid geometry, turn-radius parameters, pause/reset, and photo capture.
- Dependency installation audit: zero known vulnerabilities after updating MapLibre and Vite. This is an installation-time dependency check, not a security audit of the application.
- Browser checks: development and production builds load the map and route geometry. Tested photo waypoint addition, waypoint dragging, exclusion drawing, vertex dragging, play/pause, return-home action, and the blocked-home failure state. Checked the narrow-screen layout and reset the viewport afterward.

These checks validate the prototype, not real flight safety. The bounded planner is incomplete and can reject feasible paths. See README.md for modeling limits and future integration boundaries.

Regression fix: a skew exclusion between home and waypoint 1 previously trapped home inside an expanded search bounding box. A screenshot-derived fixture fails with the old planner and passes with the fix. Its mission path and returns from three positions pass actual polygon clearance checks. Ten tests now pass.

Transmission corridor update (2026-10-14): eighteen automated tests cover distinct 200/700 ft lateral limits, conductor-relative heights, RTH from turns, a blocked corridor, conductor elevation interpolation, bent-line following and distinct home/waypoint heights. Browser preview verified corridor bands, edit handles, and a 150 ft home-height update. Direct file-URL browser testing remains unavailable.

Complex corridor update: all 19 automated tests pass, including the winding outbound mission and return paths at 20%, 40%, 60%, 80%, and 100% of its sampled path. Tests verify lateral/vertical envelopes and exclusion clearance. These sampled checks are not flight-safety certification or exhaustive return feasibility proof.
