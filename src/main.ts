import * as maplibregl from "maplibre-gl";
import mapWorkerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
import type * as GeoJSON from "geojson";
import "maplibre-gl/dist/maplibre-gl.css";
import "./style.css";
import {
  demo,
  complexCorridorDemo,
  CORRIDOR,
  FEET,
  fromLngLat,
  LIMIT,
  radius,
  toLngLat,
  type Mission,
  type Point,
  type Pose,
  type Route,
} from "./types";
import { validate } from "./planning/planner";
import { inside, validPolygon } from "./planning/geometry";
import { nearestLine } from "./planning/corridor";
import { Simulator } from "./simulator";
import { LocalPlanner } from "./planning/local";
import embeddedTiles from "./basemap.json";

const $ = <T extends HTMLElement = HTMLElement>(id: string) =>
  document.getElementById(id) as T;
let mission = complexCorridorDemo(),
  mode = "select",
  draft: Point[] = [],
  selectedZone: string | undefined,
  markers: maplibregl.Marker[] = [];
let planned: Route | undefined,
  rth: Route | undefined,
  revision = 0,
  sequence = 0,
  pendingMission = 0,
  pendingRth = 0,
  rthAt = 0,
  returning = false,
  loaded = false,
  notice = "";
let rthPose: Pose | undefined;
let renderedWaypoints = "";
let renderedLine = "";
const sim = new Simulator(mission.home),
  worker: Worker | LocalPlanner =
    location.protocol === "file:"
      ? new LocalPlanner()
      : new Worker(new URL("./planning/worker.ts", import.meta.url), {
          type: "module",
        });
document.querySelector("#app")!.innerHTML = `
 <header><div class="brand"><span class="brand-icon">↗</span><div>FLIGHTLINE<small>MISSION SANDBOX</small></div></div><span class="simulation">SIMULATION ONLY</span><div class="header-note">Fixed-wing planning · Austin test area</div><button id="export">Export mission</button><label class="file-button">Import<input id="import" type="file" accept="application/json"></label></header>
 <main><aside><section><div class="eyebrow">01 / MISSION DESIGN</div><h1>A route with room<br>to return.</h1><p class="intro">Plan inspection passes, draw exclusions, and explore return paths in a simulated airspace.</p><div class="tools" role="group" aria-label="Map tools"><button data-mode="select" class="active">↖ Select / drag</button><button data-mode="nav">＋ Nav point</button><button data-mode="photo">◎ Photo point</button><button data-mode="zone">⬡ Exclusion</button><button data-mode="home">⌂ Set home</button></div><p id="tool-hint" class="hint">Drag home or numbered points. Click an exclusion to edit its vertices.</p><div id="draw-actions" hidden><button id="finish">Finish polygon</button><button id="undo">Undo vertex</button><button id="cancel">Cancel</button></div><div id="zone-actions" hidden><button id="delete-zone" class="danger">Delete selected exclusion</button><p class="hint">Drag vertex handles. Click an edge’s + handle to insert a vertex. Right-click a vertex to remove it.</p></div><div id="notice" role="status"></div></section>
 <section><div class="section-title"><h2>Mission waypoints</h2><span id="point-count" class="tag"></span></div><div id="waypoints"></div><p class="hint">Drag markers to move. With corridor enforcement, heights are feet above the conductor; otherwise altitude is metadata in meters AGL.</p></section>
 <section><div class="eyebrow">02 / TRANSMISSION CORRIDOR</div><h2>Stay with the line</h2><label class="corridor-toggle"><input id="corridor-enabled" type="checkbox"> Enforce corridor (mission + RTH)</label><p class="hint">200 ft lateral on straights · 700 ft on all turns · 0–200 ft above conductor. This is a proximity envelope, not wire-collision protection.</p><div class="tools"><button data-mode="line">Draw line</button><button data-mode="line-edit">Edit line vertices</button></div><div class="settings"><label>Home above line <span>ft</span><input id="home-height" type="number" min="0" max="200" step="1"></label><label>New line elevation <span>ft datum</span><input id="line-elevation" type="number" min="-30000" max="30000" value="100"></label></div><div id="line-vertices"></div><p id="corridor-telemetry" class="hint"></p><p class="hint">Synthetic conductor profile. Vertex elevations share an arbitrary local datum. Aircraft altitude follows the interpolated conductor elevation plus the selected height; climb performance is not modeled.</p><button id="corridor-example">Load corridor example</button><button id="free-example">Load free-planning example</button></section>
 <section><div class="eyebrow">03 / AIRCRAFT MODEL</div><h2>Simulated fixed wing</h2><div class="settings"><label>Airspeed <span>m/s</span><input id="speed" type="number" min="12" max="45" step="1"></label><label>Bank limit <span>°</span><input id="bank" type="number" min="15" max="45" step="1"></label><label>Zone clearance <span>m</span><input id="clearance" type="number" min="10" max="300" step="5"></label><label>Departure heading <span>° true</span><input id="heading" type="number" min="0" max="359" step="5"></label></div><div class="radius">Minimum turn radius <strong id="radius"></strong></div><p class="hint">R = v² / (g · tan bank). Constant speed, level turns, zero wind. Exclusions apply at every altitude.</p></section>
 <section class="limits"><h2>A planning experiment</h2><p>No terrain, wind, battery, airspace rules, communications, takeoff or landing model. A green route only passes this prototype’s geometry checks. Never use it to command an aircraft.</p><button id="demo">Restore example</button><button id="blocked">Try blocked-home example</button></section></aside>
 <div class="map-shell"><div id="map"></div><div class="map-top"><div class="map-pill"><span class="live-dot"></span> DARK TOPO MAP <span>Austin · USGS</span></div><button id="fit">Fit mission</button></div><div id="map-error" hidden>Map rendering error. Reload the page to restart the map.</div><div class="legend"><span><i class="cyan"></i>Planned route</span><span><i class="green"></i>Return candidate</span><span><i class="red"></i>Exclusion</span><span><i class="orange"></i>Clearance</span><span><i style="background:#cda6ff"></i>Transmission line</span></div><div class="status-stack"><div class="status-card"><span class="eyebrow">PLANNED ROUTE</span><strong id="route-state">Calculating…</strong><p id="route-detail"></p></div><div class="status-card"><span class="eyebrow">RETURN TO HOME · RECHECKED ~1 Hz</span><strong id="rth-state">Calculating…</strong><p id="rth-detail"></p></div></div><div class="playback"><div class="play-buttons"><button id="play" class="primary">▶ Play</button><button id="reset">↺ Reset</button><button id="return">⌂ Return home</button></div><div class="metric"><small>GROUND SPEED</small><strong id="speed-value">24 <em>m/s</em></strong></div><div class="metric"><small>PHOTOS SIMULATED</small><strong id="photos">0 / 2</strong></div><label class="time-scale">Playback<select id="scale"><option value="1">1×</option><option value="4" selected>4×</option><option value="10">10×</option></select></label><div id="flight-state" class="flight-state">Ready at home</div></div></div></main>`;
maplibregl.setWorkerUrl(mapWorkerUrl);
// Geometry is rendered by our canvas; the empty map style needs no workers.
maplibregl.setWorkerCount(0);
const map = new maplibregl.Map({
  container: "map",
  center: toLngLat({ x: 0, y: 0 }),
  zoom: 13.1,
  maxZoom: 18,
  minZoom: 10,
  style: {
    version: 8,
    sources: {},
    layers: [
      {
        id: "background",
        type: "background",
        paint: { "background-color": "#162a36" },
      },
    ],
  },
});
map.addControl(
  new maplibregl.NavigationControl({ showCompass: false }),
  "top-right",
);
map.addControl(new maplibregl.ScaleControl({ unit: "metric" }), "bottom-left");
map.doubleClickZoom.disable();
const aircraftEl = document.createElement("div");
aircraftEl.className = "aircraft";
aircraftEl.innerHTML = "<span>➤</span>";
aircraftEl.title = "Simulated aircraft";
const aircraft = new maplibregl.Marker({
  element: aircraftEl,
  rotationAlignment: "map",
})
  .setLngLat(toLngLat(sim.pose))
  .addTo(map);
const fc = (features: GeoJSON.Feature[]): GeoJSON.FeatureCollection => ({
  type: "FeatureCollection",
  features,
});
const line = (points: Point[], properties = {}): GeoJSON.Feature => ({
  type: "Feature",
  properties,
  geometry: { type: "LineString", coordinates: points.map(toLngLat) },
});
const polygon = (points: Point[], properties = {}): GeoJSON.Feature => ({
  type: "Feature",
  properties,
  geometry: {
    type: "Polygon",
    coordinates: [[...points, points[0]].map(toLngLat)],
  },
});
// Local canvas avoids GeoJSON worker restrictions for standalone pages.
const geometryData = new Map<string, GeoJSON.FeatureCollection>();
const overlay = document.createElement("canvas");
overlay.style.cssText =
  "position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:1";
map.getCanvasContainer().appendChild(overlay);
// Recolor embedded tiles once at load time; mission overlay colors stay unchanged.
const basemapTiles = embeddedTiles.map((tile) => {
  const image = new Image();
  const canvas = document.createElement("canvas");
  const result = { ...tile, image: canvas, ready: false };
  image.onload = () => {
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.drawImage(image, 0, 0);
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
    for (let i = 0; i < pixels.data.length; i += 4) {
      const luminance =
        (0.2126 * pixels.data[i] +
          0.7152 * pixels.data[i + 1] +
          0.0722 * pixels.data[i + 2]) /
        255;
      const contrast = Math.pow(1 - luminance, 0.8);
      pixels.data[i] = 16 + 125 * contrast;
      pixels.data[i + 1] = 27 + 139 * contrast;
      pixels.data[i + 2] = 35 + 145 * contrast;
    }
    context.putImageData(pixels, 0, 0);
    result.ready = true;
    drawGeometry();
  };
  image.src = tile.url;
  return result;
});
map.addControl(
  new maplibregl.AttributionControl({
    customAttribution: "Embedded topographic map: USGS The National Map",
    compact: true,
  }),
  "bottom-right",
);

function setSource(id: string, data: GeoJSON.FeatureCollection) {
  geometryData.set(id, data);
  drawGeometry();
}
function drawGeometry() {
  const rect = map.getContainer().getBoundingClientRect(),
    dpr = devicePixelRatio || 1;
  if (!rect.width || !rect.height) return;
  if (
    overlay.width !== Math.round(rect.width * dpr) ||
    overlay.height !== Math.round(rect.height * dpr)
  ) {
    overlay.width = Math.round(rect.width * dpr);
    overlay.height = Math.round(rect.height * dpr);
  }
  const ctx = overlay.getContext("2d");
  if (!ctx) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, rect.width, rect.height);
  for (const tile of basemapTiles) {
    if (!tile.ready) continue;
    const a = map.project(tile.nw as [number, number]),
      b = map.project(tile.se as [number, number]);
    ctx.drawImage(tile.image, a.x, a.y, b.x - a.x, b.y - a.y);
  }

  if (mission.transmission) {
    const vertices = mission.transmission.vertices;
    const scale = Math.abs(
      map.project(toLngLat({ x: 1, y: 0 })).x -
        map.project(toLngLat({ x: 0, y: 0 })).x,
    );
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.setLineDash([]);
    for (const [width, color] of [
      [CORRIDOR.turn, "#a57cdf20"],
      [CORRIDOR.straight, "#a57cdf48"],
      [2 / scale, "#cda6ff"],
    ] as const) {
      ctx.beginPath();
      vertices.forEach((p, i) => {
        const q = map.project(toLngLat(p));
        if (i) ctx.lineTo(q.x, q.y);
        else ctx.moveTo(q.x, q.y);
      });
      ctx.strokeStyle = color;
      ctx.lineWidth = width === 2 / scale ? 2 : 2 * width * scale;
      ctx.stroke();
    }
    ctx.lineCap = "butt";
    ctx.lineJoin = "miter";
  }
  const stroke = (
    coords: number[][],
    color: string,
    width: number,
    dash: number[] = [],
    fill?: string,
  ) => {
    ctx.beginPath();
    coords.forEach((p, i) => {
      const q = map.project([p[0], p[1]]);
      if (i === 0) ctx.moveTo(q.x, q.y);
      else ctx.lineTo(q.x, q.y);
    });
    if (fill) {
      ctx.fillStyle = fill;
      ctx.fill();
    }
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.setLineDash(dash);
    ctx.stroke();
  };
  ctx.globalAlpha = 0.12;
  for (let v = -LIMIT; v <= LIMIT; v += 500) {
    const color = v === 0 ? "#527a8b" : "#294653";
    stroke(
      [toLngLat({ x: v, y: -LIMIT }), toLngLat({ x: v, y: LIMIT })],
      color,
      1,
    );
    stroke(
      [toLngLat({ x: -LIMIT, y: v }), toLngLat({ x: LIMIT, y: v })],
      color,
      1,
    );
  }
  ctx.globalAlpha = 1;
  const styles: Record<string, [string, number, number[], string?]> = {
    area: ["#a3b8c0", 1, [5, 5]],
    zones: ["#ff7181", 2, [], "#ef647338"],
    clearance: ["#b28b55", 1, []],
    route: ["#61d6fb", 4, []],
    rth: ["#b2ed84", 3, [9, 6]],
    trail: ["#ffffff", 2, []],
    draft: ["#ffd68a", 2, []],
  };
  for (const id of Object.keys(styles))
    for (const f of geometryData.get(id)?.features ?? []) {
      const g = f.geometry;
      if (g.type === "LineString") stroke(g.coordinates, ...styles[id]);
      if (g.type === "Polygon")
        g.coordinates.forEach((r) => stroke(r, ...styles[id]));
    }
}
map.on("move", drawGeometry);
map.on("resize", drawGeometry);
map.on("render", drawGeometry);
map.on("error", () => {
  $("map-error").textContent =
    "Map background unavailable. Local mission overlay remains active.";
  $("map-error").hidden = false;
});
loaded = true;
setSource(
  "area",
  fc([
    polygon([
      { x: -LIMIT, y: -LIMIT },
      { x: LIMIT, y: -LIMIT },
      { x: LIMIT, y: LIMIT },
      { x: -LIMIT, y: LIMIT },
    ]),
  ]),
);
function renderGeometry() {
  setSource(
    "zones",
    fc(mission.zones.map((z) => polygon(z.vertices, { id: z.id }))),
  );
  // Clearance is the union of edge capsules: render their rings as a visual aid.
  const rings: GeoJSON.Feature[] = [];
  for (const z of mission.zones)
    for (let i = 0; i < z.vertices.length; i++) {
      const a = z.vertices[i],
        b = z.vertices[(i + 1) % z.vertices.length],
        h = Math.atan2(b.y - a.y, b.x - a.x),
        v: Point[] = [];
      for (let j = 0; j <= 16; j++) {
        const t = h - Math.PI / 2 + (j * Math.PI) / 16;
        v.push({
          x: b.x + mission.settings.clearance * Math.cos(t),
          y: b.y + mission.settings.clearance * Math.sin(t),
        });
      }
      for (let j = 0; j <= 16; j++) {
        const t = h + Math.PI / 2 + (j * Math.PI) / 16;
        v.push({
          x: a.x + mission.settings.clearance * Math.cos(t),
          y: a.y + mission.settings.clearance * Math.sin(t),
        });
      }
      rings.push(polygon(v));
    }
  setSource("clearance", fc(rings));
  setSource("draft", fc(draft.length > 1 ? [line(draft)] : []));
  setSource("route", fc(planned?.ok ? [line(planned.points)] : []));
  setSource(
    "rth",
    fc(rth?.ok && rth.points.length > 1 ? [line(rth.points)] : []),
  );
}
function makeMarker(
  p: Point,
  label: string,
  cls: string,
  onDrag?: (p: Point) => void,
) {
  const el = document.createElement("button");
  el.className = `map-marker ${cls}`;
  el.textContent = label;
  el.setAttribute(
    "aria-label",
    cls === "home" ? "Home: drag to move" : `Map handle ${label}`,
  );
  el.addEventListener("click", (e) => e.stopPropagation());
  const marker = new maplibregl.Marker({ element: el, draggable: !!onDrag })
    .setLngLat(toLngLat(p))
    .addTo(map);
  if (onDrag) {
    marker.on("dragstart", () => {
      sim.running = false;
    });
    marker.on("dragend", () => {
      const ll = marker.getLngLat();
      onDrag(fromLngLat(ll.lng, ll.lat));
    });
  }
  markers.push(marker);
  return el;
}
function renderMarkers() {
  markers.forEach((m) => m.remove());
  markers = [];
  makeMarker(mission.home, "H", "home", (p) => {
    mission.home = { ...mission.home, ...p };
    changed();
  });
  mission.waypoints.forEach((w, i) =>
    makeMarker(w, String(i + 1), w.kind, (p) => {
      Object.assign(w, p);
      changed();
    }),
  );
  draft.forEach((p, i) => {
    const el = makeMarker(p, String(i + 1), "vertex");
    if (mode === "zone" && i === 0) {
      el.title = "Close exclusion polygon";
      el.setAttribute("aria-label", "Close exclusion polygon at first vertex");
      el.onclick = finish;
    }
  });
  if (mode === "line-edit" && mission.transmission)
    mission.transmission.vertices.forEach((v, i) => {
      makeMarker(v, `L${i + 1}`, "line-vertex", (p) => {
        Object.assign(v, p);
        changed();
      });
      const next = mission.transmission!.vertices[i + 1];
      if (next)
        makeMarker(
          { x: (v.x + next.x) / 2, y: (v.y + next.y) / 2 },
          "+",
          "midpoint",
        ).onclick = () => {
          if (mission.transmission!.vertices.length >= 30) return;
          mission.transmission!.vertices.splice(i + 1, 0, {
            x: (v.x + next.x) / 2,
            y: (v.y + next.y) / 2,
            elevation: (v.elevation + next.elevation) / 2,
          });
          changed();
        };
    });
  const z = mission.zones.find((z) => z.id === selectedZone);
  if (z)
    z.vertices.forEach((p, i) => {
      const el = makeMarker(p, "", "vertex", (q) => {
        const old = z.vertices[i];
        z.vertices[i] = q;
        if (!validPolygon(z.vertices)) {
          z.vertices[i] = old;
          notice =
            "Vertex move rejected: polygon must remain simple and inside the area.";
        }
        changed(false);
      });
      el.addEventListener("contextmenu", (e) => {
        e.preventDefault();
        const v = z.vertices.filter((_, j) => i !== j);
        if (validPolygon(v)) {
          z.vertices = v;
          changed(false);
        } else {
          notice = "At least three valid vertices are required.";
          renderUI();
        }
      });
      const next = z.vertices[(i + 1) % z.vertices.length];
      makeMarker(
        { x: (p.x + next.x) / 2, y: (p.y + next.y) / 2 },
        "+",
        "midpoint",
      ).onclick = () => {
        if (z.vertices.length >= 40) return;
        z.vertices.splice(i + 1, 0, {
          x: (p.x + next.x) / 2,
          y: (p.y + next.y) / 2,
        });
        changed();
      };
    });
  $("zone-actions").hidden = !z;
}
function requestMission() {
  pendingMission = ++sequence;
  worker.postMessage({
    id: pendingMission,
    type: "mission",
    mission,
    pose: sim.pose,
  });
}
function requestRth() {
  if (pendingRth) return;
  pendingRth = ++sequence;
  worker.postMessage({ id: pendingRth, type: "rth", mission, pose: sim.pose });
  rthPose = { ...sim.pose };
}
function changed(clearNotice = true) {
  revision++;
  if (clearNotice) notice = "";
  sim.reset(mission.home);
  returning = false;
  planned = undefined;
  rth = undefined;
  pendingRth = 0;
  rthAt = 0;
  setSource("trail", fc([]));
  requestMission();
  requestRth();
  renderGeometry();
  renderMarkers();
  renderUI();
}
worker.onmessage = (e: MessageEvent) => {
  const { id, type, route } = e.data as {
    id: number;
    type: string;
    route: Route;
  };
  if (type === "mission") {
    if (id !== pendingMission) return;
    pendingMission = 0;
    planned = route;
    if (route.ok) sim.setRoute(route);
  } else {
    if (id !== pendingRth) return;
    pendingRth = 0;
    rth = route;
    rthAt = performance.now();
    if (!route.ok) sim.running = false;
  }
  renderGeometry();
  renderUI();
};
worker.onerror = () => {
  sim.running = false;
  planned = {
    ok: false,
    reason: "Planning worker failed. Reload the page to restart.",
  };
  rth = undefined;
  pendingMission = 0;
  pendingRth = 0;
  renderUI();
};
function renderUI() {
  $("radius").textContent = `${radius(mission.settings).toFixed(0)} m`;
  $("point-count").textContent = `${mission.waypoints.length} / 20`;
  $("notice").textContent = notice;
  for (const k of ["speed", "bank", "clearance"] as const)
    if (document.activeElement !== $(k))
      ($(k) as HTMLInputElement).value = String(mission.settings[k]);
  document.activeElement !== $("heading") &&
    $("heading") instanceof HTMLInputElement &&
    ($("heading") as HTMLInputElement).value !==
      String(
        Math.round((90 - (mission.home.heading * 180) / Math.PI + 360) % 360),
      ) &&
    (($("heading") as HTMLInputElement).value = String(
      Math.round((90 - (mission.home.heading * 180) / Math.PI + 360) % 360),
    ));
  $("route-state").textContent = planned
    ? planned.ok
      ? "Geometry checks passed"
      : "No feasible mission route"
    : "Calculating…";
  $("route-state").className = planned?.ok ? "ok" : planned ? "bad" : "";
  $("route-detail").textContent = planned
    ? planned.ok
      ? `${(planned.length / 1000).toFixed(2)} km · ${(planned.length / mission.settings.speed / 60).toFixed(1)} min · curved waypoint-to-waypoint path`
      : planned.reason
    : "Checking turn radius and exclusion clearance.";
  $("rth-state").textContent = rth
    ? rth.ok
      ? "Return candidate available"
      : "NO RETURN PATH FOUND"
    : "Calculating…";
  $("rth-state").className = rth?.ok ? "ok" : rth ? "bad" : "";
  $("rth-detail").textContent = rth
    ? rth.ok
      ? `${(rth.length / 1000).toFixed(2)} km · sampled from current heading · geometry only`
      : rth.reason
    : "Waiting for a checked candidate.";
  const enabled = !!mission.transmission?.enabled;
  ($("corridor-enabled") as HTMLInputElement).checked = enabled;
  if (document.activeElement !== $("home-height"))
    ($("home-height") as HTMLInputElement).value = String(
      Math.round((mission.home.heightAboveLine ?? 30) / FEET),
    );
  const lineKey = JSON.stringify(mission.transmission);
  if (renderedLine !== lineKey) {
    renderedLine = lineKey;
    $("line-vertices").innerHTML =
      mission.transmission?.vertices
        .map(
          (v, i) =>
            `<div class="line-row"><span>L${i + 1}</span><label>Conductor elevation <input aria-label="Line vertex ${i + 1} elevation in feet" data-elevation="${i}" type="number" min="-30000" max="30000" step="0.1" value="${(v.elevation / FEET).toFixed(1)}"> ft datum</label><button data-line-delete="${i}" aria-label="Remove line vertex ${i + 1}">×</button></div>`,
        )
        .join("") ??
      '<p class="hint">Draw a line or load the corridor example.</p>';
  }
  const waypointKey = JSON.stringify([mission.waypoints, enabled]);
  if (renderedWaypoints !== waypointKey) {
    renderedWaypoints = waypointKey;
    $("waypoints").innerHTML = mission.waypoints.length
      ? mission.waypoints
          .map(
            (w, i) =>
              `<div class="waypoint"><span class="number ${w.kind}">${i + 1}</span><div><select aria-label="Waypoint ${i + 1} type" data-kind="${i}"><option value="nav" ${w.kind === "nav" ? "selected" : ""}>Navigation</option><option value="photo" ${w.kind === "photo" ? "selected" : ""}>Photo capture</option></select><small>${toLngLat(w)[1].toFixed(4)}, ${toLngLat(w)[0].toFixed(4)}</small></div><label><input aria-label="Waypoint ${i + 1} altitude" data-alt="${i}" type="number" min="${enabled ? 0 : 30}" max="${enabled ? 200 : 300}" step="0.1" value="${enabled ? (w.altitude / FEET).toFixed(1) : w.altitude}"><small>${enabled ? "ft above line" : "m AGL*"}</small></label><div class="row-actions"><button data-up="${i}" aria-label="Move waypoint ${i + 1} earlier" ${i === 0 ? "disabled" : ""}>↑</button><button data-delete="${i}" aria-label="Delete waypoint ${i + 1}">×</button></div></div>`,
          )
          .join("")
      : '<p class="hint">Choose Nav point or Photo point, then click the map.</p>';
  }
  updateTelemetry();
}
function updateTelemetry() {
  const transmission = mission.transmission;
  if (transmission?.enabled) {
    const nearest = nearestLine(sim.pose, transmission),
      height = sim.pose.heightAboveLine ?? mission.home.heightAboveLine ?? NaN;
    sim.pose.altitude = nearest.elevation + height;
    $("corridor-telemetry").textContent =
      `${sim.pose.turning ? "TURN · 700 ft limit" : "STRAIGHT · 200 ft limit"} | lateral ${(nearest.distance / FEET).toFixed(0)} ft | above line ${(height / FEET).toFixed(0)} ft | elevation ${(sim.pose.altitude / FEET).toFixed(0)} ft datum`;
  } else $("corridor-telemetry").textContent = "Corridor enforcement is off.";

  $("play").textContent = sim.running ? "Ⅱ Pause" : "▶ Play";
  ($("play") as HTMLButtonElement).disabled =
    !planned?.ok ||
    !rth?.ok ||
    !!pendingMission ||
    sim.index >= (sim.route?.points.length ?? 1) - 1;
  ($("return") as HTMLButtonElement).disabled = !rth?.ok || !!pendingRth;
  $("speed-value").innerHTML =
    `${sim.running ? mission.settings.speed : 0} <em>m/s</em>`;
  $("photos").textContent =
    `${sim.captured.size} / ${mission.waypoints.filter((w) => w.kind === "photo").length}`;
  $("flight-state").textContent = sim.running
    ? returning
      ? "Returning to home"
      : "Mission in progress"
    : sim.index >= (sim.route?.points.length ?? Infinity) - 1
      ? returning
        ? "Home reached · playback stopped"
        : "Mission complete · playback stopped"
      : sim.traveled
        ? "Paused"
        : "Ready at home";
  aircraft
    .setLngLat(toLngLat(sim.pose))
    .setRotation((-sim.pose.heading * 180) / Math.PI);
}
map.on("click", (e) => {
  const p = fromLngLat(e.lngLat.lng, e.lngLat.lat);
  if (Math.abs(p.x) > LIMIT || Math.abs(p.y) > LIMIT) {
    notice = "Click inside the dashed planning boundary.";
    renderUI();
    return;
  }
  if (mode === "nav" || mode === "photo") {
    if (mission.waypoints.length >= 20) {
      notice = "Maximum 20 waypoints.";
      renderUI();
      return;
    }
    mission.waypoints.push({
      ...p,
      id: crypto.randomUUID(),
      kind: mode,
      altitude: mission.transmission?.enabled ? 30 : 120,
    });
    changed();
  } else if (mode === "home") {
    mission.home = { ...mission.home, ...p };
    changed();
    setMode("select");
  } else if (mode === "zone" || mode === "line") {
    if (draft.length >= (mode === "line" ? 30 : 40)) return;
    draft.push(p);
    renderGeometry();
    renderMarkers();
  } else if (loaded) {
    selectedZone = [...mission.zones]
      .reverse()
      .find((z) => inside(p, z.vertices))?.id;
    renderMarkers();
  }
});
function setMode(value: string) {
  mode = value;
  selectedZone = undefined;
  draft = [];
  document
    .querySelectorAll<HTMLButtonElement>("[data-mode]")
    .forEach((b) => b.classList.toggle("active", b.dataset.mode === mode));
  $("tool-hint").textContent =
    mode === "line"
      ? "Click at least two line vertices, then Finish line. Elevations can be edited below."
      : mode === "line-edit"
        ? "Drag L handles; use + to insert a vertex. Edit conductor elevations in the sidebar."
        : mode === "zone"
          ? "Click at least 3 corners, then click the first corner, Exclusion again, Finish polygon, or press Enter. Escape cancels."
          : mode === "select"
            ? "Drag home or numbered points. Click an exclusion to edit its vertices."
            : mode === "home"
              ? "Click to move home. The mission will restart there."
              : "Click the map to add waypoints. Drag numbered markers to adjust.";
  $("draw-actions").hidden = mode !== "zone" && mode !== "line";
  $("finish").textContent = mode === "line" ? "Finish line" : "Finish polygon";
  map.getCanvas().style.cursor = mode === "select" ? "" : "crosshair";
  renderGeometry();
  renderMarkers();
}
document.querySelectorAll<HTMLButtonElement>("[data-mode]").forEach(
  (b) =>
    (b.onclick = () => {
      if (b.dataset.mode === "zone" && mode === "zone") finish();
      else setMode(b.dataset.mode!);
    }),
);
function finish() {
  if (mode !== "zone" && mode !== "line") return;
  if (mode === "line") {
    const elevation =
      Number(($("line-elevation") as HTMLInputElement).value) * FEET;
    if (draft.length < 2 || !Number.isFinite(elevation)) {
      notice = "A line needs at least two vertices and a finite elevation.";
      renderUI();
      return;
    }
    mission.transmission = {
      enabled: true,
      vertices: draft.map((p) => ({ ...p, elevation })),
    };
    mission.home.heightAboveLine ??= 30;
    setMode("line-edit");
    changed();
    return;
  }

  if (mission.zones.length >= 8) {
    notice = "Maximum 8 exclusions.";
  } else if (!validPolygon(draft)) {
    notice =
      "Draw at least 3 corners without crossing edges. Minimum edge length: 5 m.";
  } else {
    mission.zones.push({ id: crypto.randomUUID(), vertices: draft });
    setMode("select");
    changed();
    return;
  }
  renderUI();
}
$("corridor-enabled").onchange = () => {
  if (!mission.transmission) {
    notice = "Draw a transmission line first.";
    renderUI();
    return;
  }
  mission.transmission.enabled = (
    $("corridor-enabled") as HTMLInputElement
  ).checked;
  mission.home.heightAboveLine ??= 30;
  changed();
};
$("home-height").oninput = () => {
  const input = $("home-height") as HTMLInputElement;
  if (!input.value || !input.checkValidity()) return;
  mission.home.heightAboveLine = Number(input.value) * FEET;
  changed();
};
$("line-vertices").addEventListener("change", (e) => {
  const input = e.target as HTMLInputElement;
  if (
    input.dataset.elevation === undefined ||
    !input.value ||
    !input.checkValidity()
  )
    return;
  mission.transmission!.vertices[Number(input.dataset.elevation)].elevation =
    Number(input.value) * FEET;
  changed();
});
$("line-vertices").addEventListener("click", (e) => {
  const i = (e.target as HTMLElement).dataset.lineDelete;
  if (i === undefined || !mission.transmission) return;
  if (mission.transmission.vertices.length <= 2) {
    notice = "A line needs at least two vertices.";
    renderUI();
    return;
  }
  mission.transmission.vertices.splice(Number(i), 1);
  changed();
});
$("corridor-example").onclick = () => {
  mission = complexCorridorDemo();
  setMode("select");
  changed();
  fit();
};
$("free-example").onclick = () => {
  mission = demo();
  setMode("select");
  changed();
  fit();
};
$("finish").onclick = finish;
$("cancel").onclick = () => setMode("select");
$("undo").onclick = () => {
  draft.pop();
  renderGeometry();
  renderMarkers();
};
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") setMode("select");
  const target = e.target as HTMLElement;
  if (
    e.key === "Enter" &&
    (mode === "zone" || mode === "line") &&
    !target.closest("input, textarea, select, button, [contenteditable]")
  ) {
    e.preventDefault();
    finish();
  }
});
$("delete-zone").onclick = () => {
  mission.zones = mission.zones.filter((z) => z.id !== selectedZone);
  selectedZone = undefined;
  changed();
};
$("waypoints").addEventListener("click", (e) => {
  const el = e.target as HTMLElement;
  if (el.dataset.delete !== undefined) {
    mission.waypoints.splice(Number(el.dataset.delete), 1);
    changed();
  }
  if (el.dataset.up !== undefined) {
    const i = Number(el.dataset.up);
    if (i > 0)
      [mission.waypoints[i - 1], mission.waypoints[i]] = [
        mission.waypoints[i],
        mission.waypoints[i - 1],
      ];
    changed();
  }
});
$("waypoints").addEventListener("change", (e) => {
  const el = e.target as HTMLInputElement;
  if (el.dataset.kind !== undefined)
    mission.waypoints[Number(el.dataset.kind)].kind = el.value as
      "nav" | "photo";
  if (el.dataset.alt !== undefined) {
    if (!el.checkValidity()) {
      renderUI();
      return;
    }
    mission.waypoints[Number(el.dataset.alt)].altitude =
      Number(el.value) * (mission.transmission?.enabled ? FEET : 1);
  }
  changed();
});
for (const k of ["speed", "bank", "clearance"] as const)
  $(k).onchange = () => {
    const input = $(k) as HTMLInputElement;
    if (!input.checkValidity() || !input.value) {
      notice = "Enter a value within the displayed settings range.";
      renderUI();
      return;
    }
    mission.settings[k] = Number(input.value);
    changed();
  };
$("heading").onchange = () => {
  const input = $("heading") as HTMLInputElement;
  if (!input.checkValidity() || !input.value) {
    renderUI();
    return;
  }
  mission.home.heading = ((90 - Number(input.value)) * Math.PI) / 180;
  changed();
};
$("play").onclick = () => {
  if (!planned?.ok || !rth?.ok) return;
  sim.running = !sim.running;
  updateTelemetry();
};
$("reset").onclick = () => changed();
$("return").onclick = () => {
  if (!rth?.ok) return;
  sim.running = false;
  const expected = revision,
    pose = { ...sim.pose };
  const id = ++sequence;
  pendingRth = id;
  rth = undefined;
  renderGeometry();
  renderUI();
  worker.postMessage({ id, type: "rth", mission, pose });
  const receive = (e: MessageEvent) => {
    if (e.data.id !== id) return;
    worker.removeEventListener("message", receive as EventListener);
    if (revision !== expected) return;
    const route = e.data.route as Route;
    if (route.ok) {
      sim.setRoute(route);
      returning = true;
      sim.running = route.points.length > 1;
      updateTelemetry();
    }
  };
  worker.addEventListener("message", receive as EventListener);
};
$("demo").onclick = () => {
  mission = demo();
  setMode("select");
  changed();
  fit();
};
$("blocked").onclick = () => {
  mission = demo();
  const h = mission.home;
  mission.zones.push({
    id: "blocked-home",
    vertices: [
      { x: h.x - 180, y: h.y - 180 },
      { x: h.x + 180, y: h.y - 180 },
      { x: h.x + 180, y: h.y + 180 },
      { x: h.x - 180, y: h.y + 180 },
    ],
  });
  setMode("select");
  changed();
};
function fit() {
  const points = [
    mission.home,
    ...mission.waypoints,
    ...(mission.transmission?.vertices ?? []),
    ...mission.zones.flatMap((z) => z.vertices),
  ];
  const bounds = new maplibregl.LngLatBounds();
  points.forEach((p) => bounds.extend(toLngLat(p)));
  map.fitBounds(bounds, {
    padding: { top: 100, right: 90, bottom: 210, left: 90 },
    maxZoom: 14,
    duration: 500,
  });
}
$("fit").onclick = fit;
$("export").onclick = () => {
  const blob = new Blob([JSON.stringify(mission, null, 2)], {
      type: "application/json",
    }),
    url = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = url;
  a.download = "flightline-simulation.json";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
$("import").onchange = async (e) => {
  const input = e.target as HTMLInputElement,
    file = input.files?.[0];
  if (!file) return;
  try {
    if (file.size > 100000) throw Error("Mission file exceeds 100 KB.");
    const data = JSON.parse(await file.text()) as Mission;
    const error = validate(data);
    if (error) throw Error(error);
    mission = data;
    mission.waypoints.forEach((w) => (w.id = crypto.randomUUID()));
    mission.zones.forEach((z) => (z.id = crypto.randomUUID()));
    setMode("select");
    changed();
    fit();
  } catch (error) {
    notice = error instanceof Error ? error.message : "Invalid mission file.";
    renderUI();
  }
  input.value = "";
};
let last = performance.now(),
  lastPaint = 0,
  lastRequest = 0;
function tick(now: number) {
  const dt = (now - last) / 1000;
  last = now;
  if (sim.running && now - rthAt > 4000) {
    sim.running = false;
    notice =
      "Return calculation is stale (>4 seconds). Playback paused until a fresh check arrives.";
    renderUI();
  }
  sim.step(
    dt,
    mission.settings.speed * Number(($("scale") as HTMLSelectElement).value),
    returning ? [] : mission.waypoints,
  );
  if (now - lastRequest > 1000 && !pendingRth) {
    lastRequest = now;
    requestRth();
  }
  if (now - lastPaint > 100) {
    lastPaint = now;
    updateTelemetry();
    if (sim.route)
      setSource(
        "trail",
        fc(
          sim.index > 0
            ? [line([...sim.route.points.slice(0, sim.index + 1), sim.pose])]
            : [],
        ),
      );
    const age = rthAt ? (now - rthAt) / 1000 : 0;
    if (rth?.ok)
      $("rth-detail").textContent =
        `${(rth.length / 1000).toFixed(2)} km · checked ${age.toFixed(1)}s ago${rthPose ? ` · origin ±${Math.hypot(sim.pose.x - rthPose.x, sim.pose.y - rthPose.y).toFixed(0)} m` : ""} · geometry only`;
  }
  requestAnimationFrame(tick);
}
changed();
fit();
requestAnimationFrame(tick);
