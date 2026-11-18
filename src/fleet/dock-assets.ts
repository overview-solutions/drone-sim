import {corridorRing,segmentDistance} from './circuit-corridors';
import * as THREE from 'three';
import {localFrame} from '../gis/core.js';
type Circuit={id:string;name:string;source:string;voltage:number;lengthM:number;segments:number[][][];supports:{id:string;coord:number[];heightM:number|null}[];status:string;geometryStatus:string;modeledHeightM:number};
type DockInventory={id:string;name:string;coordinates:number[];circuits:Circuit[];coverage:string};
export function dockAssets(scene:THREE.Scene,host:HTMLElement,origin:number[],focus:(points:THREE.Vector3[])=>void){
 const frame=localFrame(origin),group=new THREE.Group(),corridors=new THREE.Group();group.add(corridors);scene.add(group);let camera:THREE.Camera|undefined;let manifest:{missions:{circuitId:string;name:string;file?:string;preview?:string;photos?:number;summary?:string}[]}|undefined;let data:DockInventory[]=[],selected:string|undefined,current:Circuit|undefined,disposed=false;let mode='fleet',stage='operations';
 const ui=document.createElement('div');ui.className='dock-circuit-tools';ui.style.cssText='display:flex;flex-wrap:wrap;align-items:center;gap:7px;padding:8px 0;font-size:11px';ui.hidden=true;
 const title=document.createElement('span');title.textContent='Mission SOCCs';const select=document.createElement('select');select.setAttribute('aria-label','Mission-ready dock SOCCs');select.style.width='auto';select.style.maxWidth='260px';const fit=document.createElement('button');fit.textContent='Fit circuit';const exportButton=document.createElement('button');exportButton.textContent='Export 3D GeoJSON';const status=document.createElement('small');status.style.cssText='display:block;width:100%;color:#b1c6c1';const previewMission=document.createElement('button');previewMission.textContent='Preview mission draft';const downloadMission=document.createElement('a');downloadMission.textContent='Download mission';const bundle=document.createElement('a');bundle.textContent='All Ohio drafts (.zip)';bundle.href='/flightline-fixed/gis/ohio-dock-mission-drafts.zip';bundle.download='ohio-dock-mission-drafts.zip';ui.append(title,select,fit,previewMission,downloadMission,bundle,exportButton,status);host.append(ui);
 const project=(p:number[],height=0)=>new THREE.Vector3(...frame.project(p,height));
 const clear=()=>{group.traverse(object=>{const line=object as THREE.Line;line.geometry?.dispose();if(line.material&&!Array.isArray(line.material))line.material.dispose();});group.clear();corridors.clear();group.add(corridors);};
 let previewed='',previewRequest=0;
 async function showProfile(){
  const draft=manifest?.missions.find(m=>m.circuitId===current?.id);
  if(mode!=='dock'||stage!=='planning'||!draft?.preview||previewed===draft.preview)return;
  const request=++previewRequest;previewed=draft.preview;
  try{const response=await fetch('/flightline-fixed/gis/ohio-missions/'+draft.preview);if(!response.ok)throw Error();const data=await response.json();if(request!==previewRequest||disposed||mode!=='dock'||stage!=='planning')return;window.parent.postMessage({type:'flightline:mission-preview',features:data.features,auto:true,missionFile:draft.file,circuitId:current?.id,name:current?.name},location.origin);}catch{previewed='';}
 }
 let packet:unknown,visiblePoints:THREE.Vector3[]=[];
 const missionCircuits=(dock:DockInventory|undefined)=>(dock?.circuits??[]).filter(c=>manifest?.missions.some(m=>m.circuitId===c.id&&m.file&&m.preview&&(m.photos??0)>0));
 function applyContext(){
   const planning=mode==='dock'&&stage==='planning'&&Boolean(selected);
   group.visible=mode==='dock';corridors.visible=planning;
   for(const object of group.children)if(object.userData.circuitCorridor)object.visible=planning;
   ui.hidden=!planning;
 }

 function draw(){
  clear();visiblePoints=[];
  const dock=data.find(d=>d.id===selected);if(!dock)return;
  current=dock.circuits.find(c=>c.id===select.value);if(!current)return;
  const palette=[0x7adaca,0x83b8ff,0xe5b578,0xc4a6df,0x8ec7ac,0xeaa4c1];
  for(const [index,candidate] of missionCircuits(dock).entries()){
    const selected=candidate.id===current.id,color=selected?0xffcf60:palette[index%palette.length];
    const shapes:THREE.Shape[]=[],segments:number[][][]=[];
    for(const segment of candidate.segments){
      const a=project(segment[0]),b=project(segment[1]);
      const ring=corridorRing([a.x,a.z],[b.x,b.z],100);if(!ring.length)continue;
      const shape=new THREE.Shape(ring.map(([x,z])=>new THREE.Vector2(x,-z)));
      shapes.push(shape);segments.push([[a.x,a.z],[b.x,b.z]]);
      const border=new THREE.Line(new THREE.BufferGeometry().setFromPoints(ring.map(([x,z])=>new THREE.Vector3(x,4,z))),new THREE.LineBasicMaterial({color,transparent:true,opacity:selected?.9:.35,depthTest:false,depthWrite:false}));border.renderOrder=4;border.userData.circuitCorridor=true;group.add(border);
    }
    // A single hit target represents the whole SOCC, never an individual span.
    if(shapes.length){
      const geometry=new THREE.ShapeGeometry(shapes);geometry.rotateX(-Math.PI/2);
      const material=new THREE.MeshBasicMaterial({color,transparent:true,opacity:selected?.22:.075,depthTest:false,depthWrite:false,side:THREE.DoubleSide});
      const surface=new THREE.Mesh(geometry,material);surface.position.y=4;surface.renderOrder=selected?4:3;
      surface.userData.sensorIgnore=true;surface.userData.circuitId=candidate.id;surface.userData.segments=segments;corridors.add(surface);
    }
  }
  const c=current,height=c.modeledHeightM;
  const draft=manifest?.missions.find(m=>m.circuitId===c.id);previewMission.disabled=!draft?.preview;downloadMission.hidden=!draft?.file;bundle.hidden=!selected||!data.find(d=>d.id===selected)?.name.startsWith('OH-001');if(draft?.file){downloadMission.href='/flightline-fixed/gis/ohio-missions/'+draft.file;downloadMission.download=draft.file;}
  const positions:THREE.Vector3[]=[],features:unknown[]=[];
  for(const [index,segment] of c.segments.entries()){
   const a=project(segment[0],height),b=project(segment[1],height),coords:number[][]=[];
   let previous:THREE.Vector3|undefined;
   for(let step=0;step<=16;step++){const fraction=step/16,p=a.clone().lerp(b,fraction);p.y-=3*4*fraction*(1-fraction);if(previous)positions.push(previous,p);previous=p;visiblePoints.push(p);coords.push(frame.geographic(p.toArray()));}
   features.push({type:'Feature',id:c.id+'/span/'+index,properties:{assetType:'ElectricLine',source:c.source,geometryStatus:c.geometryStatus,height_reference:'schematic local flat ground; not AGL survey',sag_status:'3 m display assumption'},geometry:{type:'LineString',coordinates:coords}});
  }
  const steel:THREE.Vector3[]=[];
  for(const support of c.supports){
   const h=support.heightM??height,base=project(support.coord),top=project(support.coord,h);
   steel.push(base,top,top.clone().add(new THREE.Vector3(-6,-3,0)),top.clone().add(new THREE.Vector3(6,-3,0)));
   visiblePoints.push(base,top);features.push({type:'Feature',id:c.id+'/support/'+support.id,properties:{assetType:'StructureJunction',source:c.source,structure:support.id,height_measured:support.heightM,height_modeled:h,height_reference:'schematic local flat ground',geometryStatus:'Mapped XY; height and pole/crossarm shape estimated'},geometry:{type:'Point',coordinates:frame.geographic(top.toArray())}});
  }
  for(const [points,color] of [[positions,0x7adaca],[steel,0xe9ece7]] as [THREE.Vector3[],number][]){if(!points.length)continue;const object=new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(points),new THREE.LineBasicMaterial({color,depthTest:false,depthWrite:false}));object.renderOrder=5;group.add(object);}
  packet={type:'FeatureCollection',schema:'flightline-open-un/1.0',metadata:{dock:dock.name,circuit:c.id,buffer_radius_miles:3,source:c.source,limitations:c.geometryStatus,phaseConnectivity:'Unknown; no electrical phase topology asserted'},features};
  status.textContent=`${(c.lengthM/1000).toFixed(2)} km in buffer · ${c.supports.length} supplied supports · ${height} m schematic height · 200 m clickable SOCC corridor · not clearance verified`;
  applyContext();void showProfile();
  window.parent.postMessage({type:'flightline:circuit-selected',circuit:{id:c.id,name:c.name,status:c.status,source:c.source}},location.origin);
 }
 function loadDock(){
  const dock=data.find(d=>d.id===selected),ready=missionCircuits(dock),previous=select.value;
  select.replaceChildren(...ready.map(c=>new Option(`${c.name}${c.voltage?' · '+c.voltage/1000+' kV':''}`,c.id)));
  fit.disabled=exportButton.disabled=previewMission.disabled=!ready.length;
  downloadMission.hidden=bundle.hidden=!ready.length;
  if(!ready.length){clear();current=undefined;packet=undefined;status.textContent=manifest?'No mission-ready SOCC drafts for this dock.':'Loading mission SOCCs…';applyContext();return;}
  select.value=ready.some(c=>c.id===previous)?previous:ready[0].id;draw();applyContext();
 }
 previewMission.onclick=async()=>{const draft=manifest?.missions.find(m=>m.circuitId===current?.id);if(!draft?.preview)return;const response=await fetch('/flightline-fixed/gis/ohio-missions/'+draft.preview);if(!response.ok){status.textContent='Draft preview unavailable';return;}const data=await response.json();window.parent.postMessage({type:'flightline:mission-preview',features:data.features,missionFile:draft.file,circuitId:current?.id,name:current?.name},location.origin);status.textContent='Local draft · '+draft.photos+' captures · not scheduled';};
 select.onchange=()=>{draw();focus(visiblePoints);};fit.onclick=()=>focus(visiblePoints);
 exportButton.onclick=()=>{if(!packet)return;const url=URL.createObjectURL(new Blob([JSON.stringify(packet,null,2)],{type:'application/geo+json'}));const link=Object.assign(document.createElement('a'),{href:url,download:'dock-circuit-schematic-3d.geojson'});link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
 const raycaster=new THREE.Raycaster();let pointerStart:number[]|undefined,lastPick:{x:number;y:number;time:number;ids:string[];index:number}|undefined;
 const down=(event:PointerEvent)=>{pointerStart=[event.clientX,event.clientY];};
 const click=(event:MouseEvent)=>{
   if(mode!=='dock'||stage!=='planning'||!corridors.visible||!group.visible||!camera||!pointerStart||Math.hypot(event.clientX-pointerStart[0],event.clientY-pointerStart[1])>5||(event.target as HTMLElement).closest('button,select,input,details,a'))return;
   const rect=host.querySelector('.inspection-canvas')?.getBoundingClientRect();if(!rect)return;
   const width=host.querySelector('.inspection-canvas.camera-split')?rect.width/2:rect.width;
   if(event.clientX<rect.left||event.clientX>rect.left+width||event.clientY<rect.top||event.clientY>rect.bottom)return;
   raycaster.setFromCamera(new THREE.Vector2((event.clientX-rect.left)/width*2-1,-(event.clientY-rect.top)/rect.height*2+1),camera);
   const candidates=new Map<string,number>();
   for(const hit of raycaster.intersectObjects(corridors.children,false)){
     const segments=hit.object.userData.segments as number[][][],distance=Math.min(...segments.map(segment=>segmentDistance([hit.point.x,hit.point.z],segment[0],segment[1]))),id=hit.object.userData.circuitId;
     candidates.set(id,Math.min(candidates.get(id)??Infinity,distance));
   }
   const ids=[...candidates].sort((a,b)=>a[1]-b[1]||a[0].localeCompare(b[0])).map(([id])=>id);if(!ids.length)return;
   // Repeated clicks cycle coincident candidates instead of making one impossible to select.
   const repeated=lastPick&&performance.now()-lastPick.time<1800&&Math.hypot(event.clientX-lastPick.x,event.clientY-lastPick.y)<8&&ids.join()===lastPick.ids.join();
   const index=repeated?(lastPick!.index+1)%ids.length:0;
   lastPick={x:event.clientX,y:event.clientY,time:performance.now(),ids,index};
   select.value=ids[index];draw();event.stopImmediatePropagation();
   status.textContent+=ids.length>1?' · '+ids.length+' overlapping candidates; click again to cycle':'';
 };
 host.addEventListener('pointerdown',down,true);host.addEventListener('click',click,true);
 const receive=(event:MessageEvent)=>{if(event.origin!==location.origin||event.source!==window.parent)return;
  if(event.data?.type==='flightline:focus-dock'){selected=event.data.id;previewed='';loadDock();}
  if(event.data?.type==='flightline:workspace-mode'){mode=event.data.mode;applyContext();}
  if(event.data?.type==='flightline:stage'){stage=event.data.stage;applyContext();lastPick=undefined;void showProfile();}
 };
 window.addEventListener('message',receive);
 if(location.pathname.startsWith('/flightline-fixed/'))fetch('/flightline-fixed/gis/ohio-missions/manifest.json').then(r=>{if(!r.ok)throw Error();return r.json();}).then(value=>{if(disposed)return;manifest=value;loadDock();}).catch(()=>{});
 if(location.pathname.startsWith('/flightline-fixed/'))fetch('/flightline-fixed/gis/dock-assets.json').then(r=>{if(!r.ok)throw Error();return r.json();}).then(result=>{if(disposed)return;data=result.docks;loadDock();}).catch(()=>{status.textContent='Local dock circuit inventory unavailable.';});
 return {update(viewCamera:THREE.Camera){camera=viewCamera;},dispose(){host.removeEventListener('pointerdown',down,true);host.removeEventListener('click',click,true);disposed=true;window.removeEventListener('message',receive);clear();scene.remove(group);ui.remove();}};
}
