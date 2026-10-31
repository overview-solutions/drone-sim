import {followupTasks} from './followup-tasks';
import {spanDetail} from './span-detail';
import {ratingGraphic} from './line-rating';
import * as THREE from 'three';
import {soccPackages} from './socc';
import type {generateUN} from './un';
import type {VegetationEvent} from './vegetation-model';
export const reviewColors={red:'#ff6575',yellow:'#e8b45b',green:'#65d9b0'};
export function reviewHealth(events:VegetationEvent[],complete:boolean){
 return events.some(e=>e.risk==='high'||e.zone)?'red':events.some(e=>e.risk==='growing')||!complete?'yellow':'green';
}
export function eventStructures(e:VegetationEvent,n:number):number[]{
 if(e.id.startsWith('EQUIP-')){const k=Number(e.id.slice(6));return k<n?[k]:[k-n,k-n+1];}
 const k=Number(e.id.split('-')[1]);return Number.isFinite(k)?[k-1,k]:[];
}
export type ProfileScope={edges:{id:string;label:string;at:number;description:string}[];level:string;label:string;start:number;end:number;items:{id:string;label:string;start:number;end:number;color:string}[]};
export type ReviewTimeline={eventPosition?:(e:VegetationEvent)=>{at:number;span:number};scope?:()=>ProfileScope|undefined;level?:(level:string)=>void;open?:(id:string)=>void;sectors:()=>{id:string;color:string;start:number;end:number;label:string}[];select:(id:string)=>void};
export function reviewNavigation(scene:THREE.Scene,host:HTMLElement,toolbar:HTMLElement,network:ReturnType<typeof generateUN>,frame:(points:THREE.Vector3[],side?:THREE.Vector3)=>void,events:()=>VegetationEvent[],complete:(i:number)=>boolean,showFinding:(id:string)=>void,route:number[][]=[],scanned:(i:number)=>boolean=complete){
 const workspace=document.createElement('div');workspace.className='inspection-workspace';
 host.before(workspace);workspace.append(host);
 const dock=document.createElement('section');dock.className='review-dock';dock.hidden=true;dock.setAttribute('aria-label','Inspection side panel');
 dock.innerHTML='<div class="review-dock-header"><strong></strong><button aria-label="Close side panel">×</button></div><div class="review-dock-body"></div>';
 workspace.append(dock);
 const body=dock.querySelector<HTMLElement>('.review-dock-body')!;
 const taskHost=document.createElement('div'),spanHost=document.createElement('div');body.append(taskHost);spanHost.className='span-toolbar-layers';spanHost.hidden=true;const modeTools=document.createElement('div');modeTools.className='scene-mode-tools';toolbar.append(modeTools);modeTools.append(spanHost);const overviewTools=document.createElement('div');overviewTools.className='review-mode-actions';modeTools.append(overviewTools);
 const tasks=followupTasks(taskHost,showFinding,String(network.pack.provenance.osmWay),e=>{const ids=eventStructures(e,network.towers.length);const spans=new Set<number>();if(ids.length===2)spans.add(ids[0]);else for(const i of ids){if(i>0)spans.add(i-1);if(i<network.towers.length-1)spans.add(i);}return [...spans].map(i=>network.spans[i*3]?.id.replace(/-[ABC]$/,'')??`T${i+1}–T${i+2}`);});
 const detail=spanDetail(scene,host,network);
 spanHost.append(host.querySelector('.span-detail')!);
 const taskToggle=document.createElement('button');taskToggle.textContent='Tasks';taskToggle.setAttribute('aria-expanded','false');
 const spanToggle=document.createElement('button');spanToggle.textContent='Span view';spanToggle.hidden=true;
 toolbar.append(taskToggle,spanToggle);
 let dockMode:'tasks'|'span'|undefined;
 function openDock(next:'tasks'|'span'|undefined){dockMode=next;dock.hidden=!next;taskHost.hidden=next!=='tasks';dock.querySelector('strong')!.textContent=next==='span'?`Span view · T${span+1}–T${span+2}`:'Follow-up tasks';taskToggle.setAttribute('aria-expanded',String(next==='tasks'));spanToggle.setAttribute('aria-expanded',String(next==='span'));}
 taskToggle.onclick=()=>openDock(dockMode==='tasks'?undefined:'tasks');
 spanToggle.onclick=()=>{spanHost.hidden=!spanHost.hidden;};
 dock.querySelector('button')!.onclick=()=>openDock(undefined);
 const escape=(e:KeyboardEvent)=>{if(e.key==='Escape'&&dockMode){openDock(undefined);taskToggle.focus();}};
 workspace.addEventListener('keydown',escape);
 const exitSpan=document.createElement('button');exitSpan.textContent='← SOCC view';exitSpan.onclick=()=>select(groups[selected].id);spanHost.prepend(exitSpan);
 const groups=soccPackages(network).map(p=>({...p,indices:p.structureIds.map(id=>network.towers.findIndex(t=>t.id===id)),core:p.coreStructureIds.map(id=>network.towers.findIndex(t=>t.id===id))}));
 const routePoints=route.map(p=>new THREE.Vector3((p[0]-network.origin[0])*111320*Math.cos(network.origin[1]*Math.PI/180),0,-(p[1]-network.origin[1])*111320));
 const cumulative=[0];for(let i=1;i<routePoints.length;i++)cumulative.push(cumulative[i-1]+routePoints[i].distanceTo(routePoints[i-1]));
 const fraction=(index:number)=>{const target=new THREE.Vector3(...network.towers[index].position);let best=Infinity,at=0;routePoints.forEach((p,i)=>{const d=p.distanceToSquared(target);if(d<best){best=d;at=i;}});return routePoints.length?(cumulative[at]/(cumulative.at(-1)||1)):index/Math.max(1,network.towers.length-1);};
 const sectorTimes=groups.map(g=>{const times=g.core.map(fraction);return {start:Math.min(...times),end:Math.max(...times)};});
 let mode:'mission'|'socc'|'span'|'hidden'='mission',selected=0,span=0,last=-Infinity,signature='';
 const overlay=document.createElement('div');overlay.className='review-labels';host.append(overlay);
 const rating=document.createElement('section');rating.className='line-rating';toolbar.append(rating);rating.onclick=e=>{const b=(e.target as Element).closest<HTMLElement>('[data-rating-span]');if(b){const i=Number(b.dataset.ratingSpan);selected=Math.max(0,groups.findIndex(g=>g.core.includes(i)));selectSpan(i);}};
 const nav=document.createElement('div');nav.className='review-navigation';toolbar.append(nav);
 const group=new THREE.Group();group.layers.set(1);scene.add(group);
 const labels:{button:HTMLButtonElement;position:THREE.Vector3;indices:number[]}[]=[];
 const floors:{mesh:THREE.Mesh;indices:number[];span:number}[]=[];
 const outlines:{line:THREE.LineSegments|THREE.LineLoop;indices:number[]}[]=[];
 function relevant(indices:number[]){return events().filter(e=>eventStructures(e,network.towers.length).some(i=>indices.includes(i)));}
 function health(indices:number[]){return reviewHealth(relevant(indices),indices.every(complete));}
 function points(indices:number[]){return indices.flatMap(i=>{const t=network.towers[i];return [new THREE.Vector3(...t.position),new THREE.Vector3(t.position[0],t.height,t.position[2])];});}
 function bounds(indices:number[],pad:number){const b=new THREE.Box3().setFromPoints(points(indices)).expandByScalar(pad);return [b.min,b.max];}
 function clear(){labels.splice(0);overlay.replaceChildren();outlines.splice(0);floors.splice(0);for(const o of [...group.children]){const l=o as THREE.LineSegments;l.geometry.dispose();(l.material as THREE.Material).dispose();group.remove(l);}}
 function sectorBox(indices:number[]){
  const [min,max]=bounds(indices,100);
  const line=new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints([
   new THREE.Vector3(min.x,110,min.z),new THREE.Vector3(max.x,110,min.z),
   new THREE.Vector3(max.x,110,max.z),new THREE.Vector3(min.x,110,max.z)
  ]),new THREE.LineBasicMaterial({color:reviewColors[health(indices)],depthTest:false,transparent:true,opacity:.85}));
  line.layers.set(1);line.userData.sensorIgnore=true;line.renderOrder=8;
  group.add(line);outlines.push({line,indices});
 }
 function buffer(indices:number[],width:number,floor=false){
  const coords:THREE.Vector3[]=[];
  for(let j=1;j<indices.length;j++){const a=new THREE.Vector3(...network.towers[indices[j-1]].position),b=new THREE.Vector3(...network.towers[indices[j]].position),d=b.clone().sub(a).normalize(),n=new THREE.Vector3(-d.z,0,d.x).multiplyScalar(width);a.addScaledVector(d,-width);b.addScaledVector(d,width);a.y=b.y=4;
   const corners=[a.clone().add(n),b.clone().add(n),b.clone().sub(n),a.clone().sub(n)];
   if(floor){const geometry=new THREE.BufferGeometry().setFromPoints([corners[0],corners[1],corners[2],corners[0],corners[2],corners[3]]);const mesh=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({color:reviewColors[health(indices)],side:THREE.DoubleSide,transparent:true,opacity:scanned(indices[0])?.24:0,depthWrite:false}));mesh.layers.set(1);mesh.userData.sensorIgnore=true;group.add(mesh);floors.push({mesh,indices,span:indices[0]});}
   for(let k=0;k<4;k++)coords.push(corners[k],corners[(k+1)%4]);
  }
  const line=new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(coords),new THREE.LineDashedMaterial({color:reviewColors[health(indices)],dashSize:15,gapSize:10,transparent:true,opacity:.7,depthTest:false}));line.layers.set(1);line.userData.sensorIgnore=true;line.computeLineDistances();group.add(line);outlines.push({line,indices});
 }
 function button(text:string,indices:number[],click:()=>void){const b=document.createElement('button');b.textContent=text;b.onclick=click;b.style.borderColor=reviewColors[health(indices)];b.title='Red: detected issue · Yellow: pending / intermediate · Green: imagery complete, no current findings';overlay.append(b);const center=new THREE.Box3().setFromPoints(points(indices)).getCenter(new THREE.Vector3());center.y+=60;labels.push({button:b,position:center,indices});}
 function boundaryMarkers(){
  const g=groups[selected];
  g.boundaryFeatures.forEach((f,k)=>{
   const symbols:Record<string,string>={CB:'⊠',XMFR:'◎',ANGLE:'∠',EXT:'↗'};
   button(symbols[f.kind]+' '+f.kind+' · T'+(f.index+1),[f.index],()=>frame(bounds([f.index],150)));
   const l=labels.at(-1)!;l.position.y=150;l.button.classList.add('socc-boundary');l.button.style.borderColor='#e5f0e9';
   l.button.title=(k===0?'Start':'End')+' of '+g.id+' · '+f.label+' · '+f.reason+' · '+f.provenance+'. One-span review overlap continues beyond this core edge.';
   l.button.setAttribute('aria-label',g.id+' '+(k===0?'start':'end')+' boundary: '+f.label+' at T'+(f.index+1));
   const at=new THREE.Vector3(...f.position);at.y=4;
   const ring=Array.from({length:33},(_,j)=>new THREE.Vector3(at.x+35*Math.cos(j/32*Math.PI*2),4,at.z+35*Math.sin(j/32*Math.PI*2)));
   const marker=new THREE.Line(new THREE.BufferGeometry().setFromPoints([...ring,at,new THREE.Vector3(at.x,145,at.z)]),new THREE.LineBasicMaterial({color:0xe5f0e9,transparent:true,opacity:.85,depthTest:false}));marker.layers.set(1);marker.userData.sensorIgnore=true;group.add(marker);
  });
 }
 function render(){
  modeTools.hidden=mode==='hidden';overviewTools.hidden=mode==='span';overviewTools.replaceChildren();
  if(mode==='mission'||mode==='socc'){
   const label=document.createElement('strong');label.textContent=mode==='mission'?'Mission':groups[selected].id;overviewTools.append(label);
   const fit=document.createElement('button');fit.textContent=mode==='mission'?'Fit mission':'Fit SOCC';fit.onclick=()=>mode==='mission'?mission(true):select(groups[selected].id);overviewTools.append(fit);
   if(mode==='mission'){const chooser=document.createElement('select');chooser.setAttribute('aria-label','Review SOCC');chooser.add(new Option('Review SOCC…',''));groups.forEach(g=>chooser.add(new Option(g.id,g.id)));chooser.onchange=()=>{if(chooser.value)select(chooser.value);};overviewTools.append(chooser);}
   else{const back=document.createElement('button');back.textContent='Mission';back.onclick=()=>mission(true);const spans=document.createElement('select');spans.setAttribute('aria-label','Review span');spans.add(new Option('Review span…',''));groups[selected].indices.slice(0,-1).forEach(i=>spans.add(new Option(`T${i+1}–T${i+2}`,String(i))));spans.onchange=()=>{if(spans.value!=='')selectSpan(Number(spans.value));};overviewTools.append(back,spans);}
  }
  spanToggle.hidden=true;spanHost.hidden=mode!=='span';toolbar.classList.toggle('span-toolbar-mode',mode==='span');workspace.classList.toggle('span-view-mode',mode==='span');
  if(mode==='span'){void detail.show(span);}else{detail.hide();if(dockMode==='span')openDock('tasks');}
  last=-Infinity;clear();host.classList.toggle('asset-review',mode==='socc'||mode==='span');nav.replaceChildren();nav.hidden=mode==='hidden';rating.hidden=mode==='hidden';
  if(mode==='hidden'){for(let i=0;i<network.towers.length-1;i++)buffer([i,i+1],60,true);return;}
  const back=document.createElement('button');back.textContent=mode==='mission'?'SOCC overview':'← '+(mode==='span'?groups[selected].id:'Mission');
  back.onclick=()=>{if(mode==='span')select(groups[selected].id);else mission(true);};nav.append(back);
  const note=document.createElement('span');note.textContent=mode==='mission'?'Select a sector':mode==='socc'?groups[selected].id+' · click a span':`${groups[selected].id} · T${span+1}–T${span+2}`;nav.append(note);
  // Selection changes framing and details, never removes neighboring navigation targets.
  groups.forEach((g,i)=>{sectorBox(g.indices);button(g.id,g.indices,()=>select(g.id));const label=labels.at(-1)!.button;label.setAttribute('aria-pressed',String(mode!=='mission'&&i===selected));});
  for(let i=0;i<network.towers.length-1;i++)buffer([i,i+1],60,true);
  if(mode==='socc')boundaryMarkers();
  if(mode==='span'){button(`T${span+1}`,[span],()=>{});button(`T${span+2}`,[span+1],()=>{});
   const findings=relevant([span,span+1]);for(const e of findings){const b=document.createElement('button');b.textContent=e.label??e.id;b.style.color=reviewColors[e.risk==='high'||e.zone?'red':'yellow'];b.onclick=()=>showFinding(e.id);nav.append(b);}
   if(!findings.length){const text=document.createElement('span');text.textContent=health([span,span+1])==='green'?'Imagery complete · no findings':'Review pending · no findings yet';nav.append(text);}
  }
 }
 function select(id:string){const i=groups.findIndex(g=>g.id===id);if(i<0)return;selected=i;mode='socc';render();frame(bounds(groups[i].indices,120));}
 function selectSpan(i:number){span=i;mode='span';render();
 const a=new THREE.Vector3(...network.towers[i].position),b=new THREE.Vector3(...network.towers[i+1].position),axis=b.clone().sub(a);axis.y=0;axis.normalize();
 const side=new THREE.Vector3(-axis.z,.12,axis.x).normalize(),normal=new THREE.Vector3(-axis.z,0,axis.x);
 const framing=points([i,i+1]);for(const [end,sign] of [[a,-1],[b,1]] as const)for(const lateral of [-60,60]){const p=end.clone().addScaledVector(axis,sign*60).addScaledVector(normal,lateral);framing.push(p,p.clone().setY(Math.max(network.towers[i].height,network.towers[i+1].height)+12));}
 frame(framing,side);
 }
 function mission(fit=false){mode='mission';render();if(fit)frame(bounds(network.towers.map((_,i)=>i),150));}
 let lastCamera:THREE.Camera|undefined,down=[0,0];
 const pointerDown=(e:PointerEvent)=>{down=[e.clientX,e.clientY];};
 const pointerUp=(e:PointerEvent)=>{if(!lastCamera||(e.target as Element).closest('button,details,input,select')||Math.hypot(e.clientX-down[0],e.clientY-down[1])>4)return;const r=host.getBoundingClientRect(),w=host.classList.contains('camera-split')?r.width/2:r.width,x=e.clientX-r.left,y=e.clientY-r.top;if(x>w)return;const ray=new THREE.Raycaster();ray.layers.set(1);ray.setFromCamera(new THREE.Vector2(x/w*2-1,1-y/r.height*2),lastCamera);const hits=ray.intersectObjects(floors.filter(f=>mode!=='hidden'||scanned(f.span)).map(f=>f.mesh));if(hits.length){const f=floors.find(f=>f.mesh===hits[0].object)!;selected=Math.max(0,groups.findIndex(g=>g.core.includes(f.span)));selectSpan(f.span);}};
 host.addEventListener('pointerdown',pointerDown);host.addEventListener('pointerup',pointerUp);
 mission();openDock('tasks');
 return {select,mission,eventPosition(e:VegetationEvent){const ids=eventStructures(e,network.towers.length);const i=Math.max(0,Math.min(network.towers.length-2,ids[0]??0));return {span:i,at:(fraction(i)+fraction(i+1))/2};},profileLevel(level:string){if(level==='Mission')mission(true);else if(level==='SOCC')select(groups[selected].id);else selectSpan(span);},profileOpen(id:string){if(id.startsWith('edge:')){const i=Number(id.slice(5));selected=Math.max(0,groups.findIndex(g=>g.core.includes(i)));mode='socc';render();frame(bounds([i],150));}else if(id.startsWith('span:')){const i=Number(id.slice(5));selected=Math.max(0,groups.findIndex(g=>g.core.includes(i)));selectSpan(i);}else select(id);},profileScope():ProfileScope{
 const level=mode==='span'?'Span':mode==='socc'?'SOCC':'Mission';
 const interval=(i:number)=>{const a=fraction(i),b=fraction(i+1);return {start:Math.min(a,b),end:Math.max(a,b)};};
 const range=level==='Span'?interval(span):level==='SOCC'?sectorTimes[selected]:{start:0,end:1};
 const ids=level==='Mission'?[]:level==='Span'?[span]:groups[selected].indices.slice(0,-1);
 const items=level==='Mission'?groups.map((g,i)=>({id:g.id,label:g.id,...sectorTimes[i],color:reviewColors[health(g.indices)]})):ids.map(i=>({id:'span:'+i,label:'T'+(i+1)+'–T'+(i+2),...interval(i),color:scanned(i)?reviewColors[health([i,i+1])]:'#456052'}));
 const features=(level==='Mission'?groups: [groups[selected]]).flatMap(g=>g.boundaryFeatures);const edges=[...new Map(features.map(f=>[f.id,f])).values()].map(f=>({id:'edge:'+f.index,label:({CB:'⊠',XMFR:'◎',ANGLE:'∠',EXT:'↗'} as Record<string,string>)[f.kind]+' '+f.kind+' · T'+(f.index+1),at:fraction(f.index),description:f.label+' · '+f.reason+' · '+f.provenance}));
 return {edges,level,label:level==='Span'?'T'+(span+1)+'–T'+(span+2):level==='SOCC'?groups[selected].id:'Full mission',...range,items};
 },hide(){mode='hidden';host.classList.remove('asset-review');render();},sectors(){return groups.map((g,i)=>({id:g.id,color:reviewColors[health(g.indices)],start:sectorTimes[i].start,end:sectorTimes[i].end,label:health(g.indices)==='green'?'Imagery complete; no findings':health(g.indices)==='red'?'Detected issues':'Pending / intermediate'}));},
 update(camera:THREE.Camera,now:number){lastCamera=camera;tasks.update(events());
 if(now-last>1500&&mode!=='hidden'){
 const indices=mode==='span'?[span]:mode==='socc'?groups[selected].indices.slice(0,-1):network.towers.slice(0,-1).map((_,i)=>i);
 if(indices.length){const kv=Number(network.pack.electricLines.features[0]?.properties.nominalKv)||0;
 const assessed=indices.filter(scanned).length,done=indices.filter(i=>complete(i)&&complete(i+1)).length,issues=relevant([...new Set(indices.flatMap(i=>[i,i+1]))]).length;
 rating.innerHTML=ratingGraphic(indices,kv,now/1000,mode==='span'?'Span T'+(span+1)+'–T'+(span+2):mode==='socc'?groups[selected].id:'Mission',assessed,done,issues);
 }}for(const f of floors){const m=f.mesh.material as THREE.MeshBasicMaterial;m.color.set(reviewColors[health(f.indices)]);m.opacity=scanned(f.span)?.24:0;}const w=host.classList.contains('camera-split')?host.clientWidth/2:host.clientWidth,h=host.clientHeight;
  const placed:{x:number;y:number}[]=[];
  for(const l of labels){const p=l.position.clone().project(camera);l.button.hidden=Math.abs(p.x)>1||Math.abs(p.y)>1||Math.abs(p.z)>1;const x=(p.x+1)*w/2,y=(1-p.y)*h/2;if(mode==='socc'&&!l.button.classList.contains('socc-boundary')&&placed.some(q=>Math.abs(x-q.x)<62&&Math.abs(y-q.y)<24))l.button.hidden=true;if(!l.button.hidden)placed.push({x,y});l.button.style.left=x+'px';l.button.style.top=y+'px';}
  if(now-last>1500){last=now;for(const o of outlines)(o.line.material as THREE.LineBasicMaterial).color.set(reviewColors[health(o.indices)]);for(const l of labels)if(!l.button.classList.contains('socc-boundary'))l.button.style.borderColor=reviewColors[health(l.indices)];const next=events().map(e=>e.id+e.risk+e.zone).join('|')+health([span,Math.min(span+1,network.towers.length-1)]);if(mode==='span'&&next!==signature){signature=next;render();}}
 },dispose(){tasks.dispose();detail.dispose();taskToggle.remove();spanToggle.remove();modeTools.remove();toolbar.classList.remove('span-toolbar-mode');workspace.removeEventListener('keydown',escape);workspace.before(host);workspace.remove();host.removeEventListener('pointerdown',pointerDown);host.removeEventListener('pointerup',pointerUp);clear();scene.remove(group);overlay.remove();nav.remove();rating.remove();}};
}
