import {stormImpact,impactedSegments} from './storm-impact';
import type {PowerLine} from './model';
import tornadoTrack from './indian-lake-track.json';
import derechoReports from './derecho-reports.json';
import {notamDraft} from './notam-draft';
import * as THREE from 'three';
import {responseAirspace} from './response-airspace';
import {floodScenario} from './flood-scenario';

type Hazard = {
 id: string; title: string; source: string; issued: string; expires: number;
 rings: number[][][]; detail: string; weather?: string[]; url?: string; historical?: boolean;
};
const openedAt = Date.now();
const feed = 'https://api.weather.gov/alerts/active?area=OH';
const demo = (id: string, title: string, lon: number, lat: number): Hazard => ({
 id, title, source: 'DEMO', issued: new Date(openedAt).toISOString(), expires: Infinity,
 rings: [[[lon-.025,lat-.018],[lon+.025,lat-.018],[lon+.025,lat+.018],[lon-.025,lat+.018],[lon-.025,lat-.018]]],
 detail: 'Hypothetical incident footprint for notification demonstration.'
});
const reportMarks = (points: number[][]) => points.map(([x,y])=>[[x-.003,y],[x+.003,y],[x,y],[x,y-.003],[x,y+.003]]);
const history: Hazard[] = [
 {id:'history-shawnee-fire',title:'2009 Shawnee Complex wildfire',source:'HISTORY',issued:'2009-04-30 report',expires:Infinity,historical:true,
 rings:reportMarks([[-83.122,38.758]]),
 detail:'NICC report dated April 30, 2009, 0800 MDT. Approximate locator derived from the report’s description of five miles west of West Portsmouth. Burn perimeter and incident weather measurements are unavailable in this example.',
 weather:['2,964 acres reported · 95% contained as of report','Hardwood litter · smoldering activity','Ohio DNR · wind / humidity / temperature unspecified'],
 url:'https://www.nifc.gov/sites/default/files/NICC/1-Incident%20Information/IMSR/2009/April/20090430IMSR.pdf'},
 {id:'history-xenia',title:'1974 Xenia tornado',source:'HISTORY',issued:'1974-04-03',expires:Infinity,historical:true,
 rings:reportMarks([[-83.929,39.684]]),
 detail:'Approximate Xenia city locator. NWS documents the tornado within the April 3–4 Super Outbreak. The marker is not a surveyed track or damage boundary.',
 weather:['F5 · original Fujita scale','April 3, 1974 · historical tornado','Exact local weather measurements not loaded'],
 url:'https://www.weather.gov/iln/19740403'},

 {id:'history-derecho',title:'2012 Ohio derecho',source:'HISTORY',issued:'2012-06-29',expires:Infinity,historical:true,
 rings:reportMarks(derechoReports.features.map(f=>f.geometry.coordinates)),
 detail:'32 reports from the NWS Cleveland preliminary summary. Crosses mark reported locations; overlapping reports are retained. Coverage is the source page, not the entire Ohio derecho. Times are EDT.',
 weather:['Findlay · 4:25 PM · 84 mph measured gust (trained spotter)','Marion · 4:54 PM · 62 mph measured gust (ODOT sensor)','1 E Marion · 4:47 PM · 1.75 in estimated hail (trained spotter)'],
 url:'https://www.weather.gov/cle/event_20120629_derecho'},
 {id:'history-tornado',title:'2024 Indian Lake tornado',source:'HISTORY',issued:'2024-03-14',expires:Infinity,historical:true,
 rings:tornadoTrack.features.flatMap(f=>f.geometry.coordinates),
 detail:'NWS surveyed damage-path polygon imported from the supplied 20240314_auglaize_logan.kmz. The overall EF3 rating does not imply uniform damage intensity throughout the polygon.',
 weather:['EF3 · 155 mph estimated maximum wind','7:29–8:16 PM EDT · March 14, 2024','32.0 mi surveyed path length · 1,000 yd maximum width'],
 url:'https://www.weather.gov/iln/20240314_auglaize_logan'}
];
const examples = [demo('demo-flood','River flooding',-83.01,39.96),demo('demo-storm','Severe storm',-82.55,40.35)];

export function disasters(scene: THREE.Scene, host: HTMLElement, origin: number[], focus: (points: THREE.Vector3[]) => void, powerLines:PowerLine[] = []) {
 const strip = document.createElement('section');
 strip.className = 'disaster-strip';
 strip.setAttribute('aria-label','Natural hazard notifications');
 const status = document.createElement('small');
 status.setAttribute('role','status');
 const list = document.createElement('div');
 list.className = 'disaster-events';
 const demos = document.createElement('button');
 demos.textContent = 'Demo incidents on';
 const historySelect=document.createElement('select');
 historySelect.setAttribute('aria-label','Historical Ohio disasters');
 historySelect.innerHTML='<option value="">Ohio disaster history…</option>';
 for(const event of history){const option=document.createElement('option');option.value=event.id;option.textContent=event.title;historySelect.append(option);}
 strip.append(status,list,historySelect,demos);
 host.before(strip);
 const group = new THREE.Group();
 scene.add(group);
 let live: Hazard[] = [], disposed = false, showDemo = true, checked = 0, failure = false;
 const controller = new AbortController();
 const project = (p: number[]) => new THREE.Vector3((p[0]-origin[0])*111320*Math.cos(origin[1]*Math.PI/180),1,-(p[1]-origin[1])*111320);
 const flood=floodScenario(scene,strip,project,focus);
 const response=responseAirspace(scene,strip,focus);
 const weatherPanel=document.createElement('section');
 weatherPanel.className='storm-weather';weatherPanel.hidden=true;strip.after(weatherPanel);
 let selectedHistory:Hazard|undefined;
 function selectHazard(hazard:Hazard) {
  const points=hazard.rings.flat().map(project);
  if(points.length){
   if(hazard.id==='history-shawnee-fire'||hazard.id==='history-xenia'){
    const center=points[0].clone();
    focus([center.clone().add(new THREE.Vector3(-5000,0,-5000)),center.clone().add(new THREE.Vector3(5000,0,5000))]);
   }else focus(points);
  }
  response.close();
  weatherPanel.replaceChildren();
  weatherPanel.hidden=false;
  const title=document.createElement('strong');
  title.textContent=hazard.source+' · '+hazard.title+' · '+hazard.issued;
  weatherPanel.append(title);
  if(hazard.id==='history-derecho'){
   const reports=document.createElement('select');
   reports.setAttribute('aria-label','Derecho storm report');
   const initial=document.createElement('option');initial.value='';initial.textContent='32 reports · choose location';reports.append(initial);
   const reportDetail=document.createElement('span');
   derechoReports.features.forEach((feature,index)=>{
    const p=feature.properties,option=document.createElement('option');
    option.value=String(index);option.textContent=p.localTime+' · '+p.location+' · '+p.event;
    reports.append(option);
   });
   reports.onchange=()=>{
    if(reports.value===''){reportDetail.textContent='';focus(points);return;}
    const feature=derechoReports.features[Number(reports.value)],p=feature.properties,position=project(feature.geometry.coordinates);
    focus([position.clone().add(new THREE.Vector3(-1800,0,-1800)),position.clone().add(new THREE.Vector3(1800,0,1800))]);
    reportDetail.textContent=[p.localTime,p.county+' County',p.magnitude===null?'Damage report':p.magnitude+' '+p.unit+' · '+p.qualifier,p.observer,p.remarks].filter(Boolean).join(' · ');
   };
   weatherPanel.append(reports,reportDetail);
  }
  notamDraft(weatherPanel,hazard);
  if(hazard.id==='history-tornado'){
   const impacts=impactedSegments(powerLines,hazard.rings);
   const picker=document.createElement('select');picker.setAttribute('aria-label','Simulated major tornado faults');
   const first=document.createElement('option');first.value='';first.textContent=impacts.length+' simulated major faults · intersecting segments';picker.append(first);
   impacts.forEach((impact,index)=>{const option=document.createElement('option');option.value=String(index);option.textContent='Major · conductor/support damage · OSM '+impact.lineId+' · '+(index+1);picker.append(option);});
   picker.onchange=()=>{if(picker.value==='')return;const impact=impacts[Number(picker.value)],a=project(impact.start),b=project(impact.end);focus([a.clone().add(new THREE.Vector3(-150,0,-150)),b.clone().add(new THREE.Vector3(150,0,150))]);};
   const note=document.createElement('small');note.textContent='Simulated damage candidates from footprint intersections · unverified';
   weatherPanel.append(picker,note);
  }
  if(points.length){
   const airspace=document.createElement('button');airspace.textContent='Response airspace';
   airspace.onclick=()=>{flood.close();response.open(points);};weatherPanel.append(airspace);
  }
  for(const value of hazard.weather??['Weather measurements not supplied with this example']){
   const metric=document.createElement('span');metric.textContent=value;weatherPanel.append(metric);
  }
  const details=document.createElement('details'),summary=document.createElement('summary'),body=document.createElement('p');
  summary.textContent='Event details';body.textContent=hazard.detail;details.append(summary,body);weatherPanel.append(details);
  if(hazard.url){const link=document.createElement('a');link.href=hazard.url;link.target='_blank';link.rel='noopener noreferrer';link.textContent='Official source';weatherPanel.append(link);}
  const close=document.createElement('button');close.textContent='×';close.setAttribute('aria-label','Close weather details');
  close.onclick=()=>{response.close();weatherPanel.hidden=true;selectedHistory=undefined;historySelect.value='';render();};weatherPanel.append(close);
  if(/flood/i.test(hazard.title))void flood.open(hazard.rings);else flood.close();
 }
 historySelect.onchange=()=>{
  selectedHistory=history.find(h=>h.id===historySelect.value);
  render();
  if(selectedHistory)selectHazard(selectedHistory);else weatherPanel.hidden=true;
 };
 function clearGeometry() {
  for (const child of [...group.children]) {
   const line = child as THREE.Line;
   line.geometry.dispose();
   (line.material as THREE.Material).dispose();
   group.remove(child);
  }
 }
 function render() {
  if (disposed) return;
  clearGeometry();
  list.replaceChildren();
  const active = live.filter(h => h.expires > Date.now());
  status.textContent = failure ? 'NWS unavailable · previous alerts may be stale' : checked ? 'NWS Ohio · checked '+new Date(checked).toLocaleTimeString() : 'NWS Ohio · connecting…';
  const visible = [...active,...(selectedHistory?[selectedHistory]:[]),...(showDemo ? examples.slice(0,Date.now()-openedAt>=60000?2:1) : [])];
  if (!visible.length) list.textContent = checked && !failure ? 'No active alerts' : 'No alerts loaded';
  for (const hazard of visible) {
   const points = hazard.rings.flat().map(project);
   const button = document.createElement('button');
   button.textContent = hazard.source+' · '+hazard.title;
   button.title = hazard.detail+'\nIssued '+hazard.issued+(points.length?'\nClick to focus affected area':'\nGeographic boundary unavailable');
   button.disabled = false;
   button.onclick = () => selectHazard(hazard);
   button.className = hazard.source==='DEMO'?'hazard-demo':'hazard-live';
   list.append(button);
   if(hazard.id==='history-tornado')stormImpact(group,hazard.rings,powerLines,project);
   for (const ring of hazard.rings) {
    const material = new THREE.LineDashedMaterial({color:hazard.source==='DEMO'?0xe8b45b:0xff6977,dashSize:250,gapSize:150,depthTest:false,transparent:true,opacity:.85});
    const outline = new THREE.Line(new THREE.BufferGeometry().setFromPoints(ring.map(project)),material);
    outline.computeLineDistances();
    group.add(outline);
   }
  }
 }
 function rings(geometry: {type?: string; coordinates?: unknown} | null): number[][][] {
  if (geometry?.type==='Polygon') return (geometry.coordinates as number[][][]).slice(0,1);
  if (geometry?.type==='MultiPolygon') return (geometry.coordinates as number[][][][]).map(p=>p[0]);
  return [];
 }
 async function refresh() {
  try {
   const response = await fetch(feed,{signal:AbortSignal.any([controller.signal,AbortSignal.timeout(15000)]),headers:{Accept:'application/geo+json'}});
   if (!response.ok) throw new Error('NWS '+response.status);
   const data = await response.json();
   if (!Array.isArray(data.features)) throw new Error('Invalid NWS response');
   const next: Hazard[] = [];
   for (const feature of data.features) {
    const p = feature.properties;
    if (!p || p.status!=='Actual' || p.messageType==='Cancel') continue;
    let boundary = rings(feature.geometry);
    // County/forecast-zone boundaries are the published alert area when a polygon is absent.
    if (!boundary.length) {
     for (const url of (p.affectedZones ?? []).slice(0,30)) {
      if (typeof url!=='string' || !url.startsWith('https://api.weather.gov/zones/')) continue;
      try {
       const zone = await fetch(url,{signal:AbortSignal.any([controller.signal,AbortSignal.timeout(5000)])});
       if (zone.ok) boundary.push(...rings((await zone.json()).geometry));
      } catch { /* Keep the alert available even when a boundary is unavailable. */ }
     }
    }
    next.push({id:feature.id,title:p.event,source:'NWS',issued:p.sent,expires:Date.parse(p.ends||p.expires),rings:boundary,detail:[p.headline,p.areaDesc,p.description,p.instruction].filter(Boolean).join('\n\n'),
     url:'https://forecast.weather.gov/showsigwx.php?warnzone='+encodeURIComponent((p.geocode?.UGC??[])[0]??'OH'),
     weather:[
      'Severity '+(p.severity??'unknown')+' · '+(p.certainty??'unknown')+' · '+(p.urgency??'unknown'),
      'Valid '+(p.onset||p.effective)+' to '+(p.ends||p.expires),
      ...Object.entries(p.parameters??{}).filter(([key])=>/wind|hail|tornado|rain/i.test(key)).map(([key,value])=>key+' · '+String(value))
     ]});
   }
   if (disposed) return;
   live = next;
   checked = Date.now();
   failure = false;
  } catch { failure = true; }
  render();
 }
 demos.onclick = () => {showDemo=!showDemo;demos.textContent='Demo incidents '+(showDemo?'on':'off');render();};
 render();
 void refresh();
 const reveal = window.setTimeout(render,Math.max(0,60000-(Date.now()-openedAt)));
 const poll = window.setInterval(()=>void refresh(),120000);
 const expiry = window.setInterval(render,60000);
 return {dispose() {disposed=true;response.dispose();flood.dispose();weatherPanel.remove();controller.abort();clearTimeout(reveal);clearInterval(poll);clearInterval(expiry);clearGeometry();group.removeFromParent();strip.remove();}};
}
