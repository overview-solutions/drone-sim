import {missionAppearance} from '../gis/mission-lifecycle.js';
import * as THREE from 'three';
import {GIS_SPEC,localFrame,geodesicCircle,frustumCorners} from '../gis/core.js';
import type {OrbitControls} from 'three/addons/controls/OrbitControls.js';
type Dock={id:string;name:string;coordinates:number[];kind:string};
type State={properties:{name:string};geometry:{type:string;coordinates:any}};
type Quadrant={properties:Record<string,string>;geometry:State['geometry']};
export function workspaceMap(scene:THREE.Scene,host:HTMLElement,camera:THREE.PerspectiveCamera,controls:OrbitControls,origin:number[],focus:(target:THREE.Vector3,distance:number)=>void){
 const inspectionRoot=host.closest<HTMLElement>('#inspection-host')??host.parentElement;
 const frame=localFrame(origin),group=new THREE.Group();scene.add(group);
 const project=(p:number[],height=0)=>new THREE.Vector3(...frame.project(p,height));
 let dockSignature='',sceneReady=false;
 let focusedDock:Dock|undefined,mode='fleet',stage='operations';
 let routeMission:{start?:string;end?:string;status?:string;result?:string}|undefined;
 const dockButtons=document.createElement('div');dockButtons.className='dock-map-buttons';host.append(dockButtons);
 const markerButtons=new Map<string,HTMLButtonElement>();
 const inspectionLayer=new THREE.Group(),recordedLayer=new THREE.Group();scene.add(inspectionLayer,recordedLayer);
 const previewDrone=new THREE.Group();scene.add(previewDrone);previewDrone.visible=false;
 previewDrone.visible=false;
 const droneMaterial=new THREE.MeshBasicMaterial({color:0xffcf60,depthTest:false});
 previewDrone.add(new THREE.Mesh(new THREE.SphereGeometry(1.5,12,8),droneMaterial));
 for(const angle of [Math.PI/4,-Math.PI/4]){const arm=new THREE.Mesh(new THREE.BoxGeometry(7,.5,.5),droneMaterial);arm.rotation.y=angle;previewDrone.add(arm);}previewDrone.renderOrder=12;
 const animatedFov=new THREE.LineSegments(new THREE.BufferGeometry(),new THREE.LineBasicMaterial({color:0xffcf60,transparent:true,opacity:.8,depthTest:false,depthWrite:false}));scene.add(animatedFov);animatedFov.visible=false;animatedFov.renderOrder=11;
 let previewMotion:{start:number;from:THREE.Vector3;to:THREE.Vector3;fromQ:THREE.Quaternion;toQ:THREE.Quaternion;fromFov:THREE.Vector3[];toFov:THREE.Vector3[]}|undefined,previewKey='',fovPoints:THREE.Vector3[]=[];
 function movePreview(feature:any,fovs:any[]=[]){
  const props=feature.properties??{},coord=feature.geometry.coordinates,height=coord[2]??props.height_above_takeoff_m??35;
  const key=JSON.stringify([coord,height,props.heading_radians,fovs]);if(key===previewKey)return;previewKey=key;
  const target=project(coord,height),q=new THREE.Quaternion().setFromEuler(new THREE.Euler(0,-(props.heading_radians??0),0));
  if(!fovs.length&&props.heading_radians!==undefined){const origin=[...coord.slice(0,2),height],corners=frustumCorners(origin,props.heading_radians,(props.pitch_degrees??-20)*Math.PI/180,80,60,props.zoom??1,1.5);fovs=corners.map((c:number[])=>({geometry:{coordinates:[origin,c]}}));fovs.push({geometry:{coordinates:[...corners,corners[0]]}});}
  const targetFov:THREE.Vector3[]=[];
  for(const feature of fovs){const coords=feature.geometry.coordinates;for(let i=1;i<coords.length;i++)targetFov.push(project(coords[i-1],coords[i-1][2]??height),project(coords[i],coords[i][2]??height));}
  if(!previewDrone.visible){previewDrone.position.copy(target);previewDrone.quaternion.copy(q);}
  const fromFov=targetFov.map((p,i)=>fovPoints[i]?.clone()??previewDrone.position.clone());
  previewMotion={start:performance.now(),from:previewDrone.position.clone(),to:target,fromQ:previewDrone.quaternion.clone(),toQ:q,fromFov,toFov:targetFov};
  previewDrone.visible=mode==='dock'&&stage==='planning';
 }
 let inspectionBounds=new THREE.Box3(),routeBounds=new THREE.Box3(),routeRelative=false,routeOrigin=0;
 const routeMarker=new THREE.Mesh(new THREE.SphereGeometry(3,12,8),new THREE.MeshBasicMaterial({color:0xffd268,depthTest:false}));routeMarker.visible=false;routeMarker.renderOrder=8;recordedLayer.add(routeMarker);
 const clearLayer=(layer:THREE.Group)=>{layer.traverse(o=>{const mesh=o as THREE.Mesh;mesh.geometry?.dispose();if(mesh.material&&!Array.isArray(mesh.material))mesh.material.dispose();});layer.clear();};
 const frameBounds=(bounds:THREE.Box3)=>{if(!bounds.isEmpty())focus(bounds.getCenter(new THREE.Vector3()),Math.max(180,bounds.getSize(new THREE.Vector3()).length()*1.8));};
 let quadrants:Quadrant[]=[],quadrantError=false;
 const quadrantLabels:THREE.Sprite[]=[];
 const stateCodes:Record<string,string>={Texas:'TX',Louisiana:'LA',Arkansas:'AR',Oklahoma:'OK',Ohio:'OH',Michigan:'MI',Indiana:'IN',Virginia:'VA','West Virginia':'WV',Kentucky:'KY',Tennessee:'TN',Mississippi:'MS',Alabama:'AL',Pennsylvania:'PA',Wisconsin:'WI'};
 const direction=(text:string)=>text.replace(/north/ig,'N').replace(/south/ig,'S').replace(/east/ig,'E').replace(/west/ig,'W').replace(/[\s-]+/g,'').toUpperCase();
 let states:State[]=[],docks:Dock[]=[],selected:State|undefined,active=false,disposed=false;
 const panel=document.createElement('div');panel.className='workspace-navigation';
 panel.style.display='contents';
 const label=document.createElement('div');label.textContent='Teal: Skydio docks · Orange: simulated fixed-wings';label.style.fontSize='11px';
 const list=document.createElement('div');list.style.cssText='max-height:180px;overflow:auto';
 (host.parentElement?.querySelector('.inspection-head')??host).append(panel);panel.hidden=true;
 const rings=(state:State):number[][][]=>state.geometry.type==='Polygon'?state.geometry.coordinates:state.geometry.coordinates.flat();
 function contains(state:State,p:number[]){
  const polys=state.geometry.type==='Polygon'?[state.geometry.coordinates]:state.geometry.coordinates;
  const inside=(ring:number[][])=>{let yes=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const a=ring[i],b=ring[j];if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])yes=!yes;}return yes;};
  return polys.some((poly:number[][][])=>inside(poly[0])&&!poly.slice(1).some(inside));
 }
 function redraw(){
  quadrantLabels.length=0;dockButtons.replaceChildren();markerButtons.clear();
  group.traverse(o=>{const sprite=o as THREE.Sprite;if(sprite.material instanceof THREE.SpriteMaterial)sprite.material.map?.dispose();const m=o as THREE.Mesh;m.geometry?.dispose();if(m.material&&!Array.isArray(m.material))m.material.dispose();});group.clear();list.replaceChildren();
  for(const state of states){for(const ring of rings(state)){const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints(ring.map(p=>project(p,4))),new THREE.LineBasicMaterial({color:state===selected?0xffd268:0x73969f,transparent:true,opacity:state===selected?1:.6,depthTest:false,depthWrite:false}));line.renderOrder=1;group.add(line);}}
  if(selected&&!focusedDock){
    const matches=quadrants.filter(q=>(q.properties.STATE_NAME_1??q.properties.STATE_NAME)===selected?.properties.name);
    const codes:string[]=[];
    for(const [index,q] of matches.entries()){
      const code=(stateCodes[selected.properties.name]??selected.properties.name)+'-'+direction(q.properties.SUB_REGION_1??q.properties.SUB_REGION??'');codes.push(code);
      const polygons=q.geometry.type==='Polygon'?[q.geometry.coordinates]:q.geometry.coordinates;
      const color=[0x7adaca,0xffce75,0xaab7ff,0xeaa4c1][index%4];
      let labelRing:number[][]=[],largest=0;
      for(const polygon of polygons){
        const shape=new THREE.Shape();
        polygon.forEach((ring:number[][],i:number)=>{
          const points=ring.map(p=>{const v=project(p);return new THREE.Vector2(v.x,-v.z);});
          if(i===0){shape.setFromPoints(points);let area=0;for(let k=1;k<ring.length;k++)area+=ring[k-1][0]*ring[k][1]-ring[k][0]*ring[k-1][1];if(Math.abs(area)>largest){largest=Math.abs(area);labelRing=ring;}}
          else shape.holes.push(new THREE.Path(points));
          const outline=new THREE.Line(new THREE.BufferGeometry().setFromPoints(ring.map(p=>project(p,7))),new THREE.LineBasicMaterial({color,depthTest:false,depthWrite:false}));outline.renderOrder=3;group.add(outline);
        });
        const geometry=new THREE.ShapeGeometry(shape);geometry.rotateX(-Math.PI/2);
        const mesh=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({color,transparent:true,opacity:.12,depthTest:false,depthWrite:false,side:THREE.DoubleSide}));mesh.position.y=6;mesh.renderOrder=2;group.add(mesh);
      }
      if(labelRing.length){
        const canvas=document.createElement('canvas');canvas.width=256;canvas.height=64;const context=canvas.getContext('2d')!;
        context.fillStyle='#10272feb';context.fillRect(0,0,256,64);context.fillStyle='#f1f7f6';context.font='bold 32px system-ui';context.textAlign='center';context.fillText(code,128,44);
        const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(canvas),transparent:true,depthTest:false,depthWrite:false}));
        const box=new THREE.Box3().setFromPoints(labelRing.map(p=>project(p,15)));sprite.position.copy(box.getCenter(new THREE.Vector3()));sprite.userData.quadrantLabel=true;sprite.renderOrder=6;group.add(sprite);quadrantLabels.push(sprite);
      }
    }
    label.textContent='Teal docks · Orange fixed-wings · '+(codes.length?'Quadrants: '+codes.join(', '):quadrantError?'Quadrant layer unavailable':'No deconfliction quadrants for this state');
  }else label.textContent='Teal: Skydio docks · Orange: simulated fixed-wings';
  if(focusedDock){
    const ring=geodesicCircle(focusedDock.coordinates,3*1609.344);
    const points=ring.map(p=>project(p,3));
    const shape=new THREE.Shape(points.map(p=>new THREE.Vector2(p.x,-p.z)));
    const geometry=new THREE.ShapeGeometry(shape);geometry.rotateX(-Math.PI/2);
    const disk=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({color:GIS_SPEC.colors.dock,transparent:true,opacity:.12,depthTest:false,depthWrite:false,side:THREE.DoubleSide}));disk.position.y=3;disk.renderOrder=2;group.add(disk);
    const border=new THREE.Line(new THREE.BufferGeometry().setFromPoints(points),new THREE.LineBasicMaterial({color:GIS_SPEC.colors.dock,transparent:true,opacity:.65,depthTest:false,depthWrite:false}));border.renderOrder=3;group.add(border);
  }
  for(const dock of docks.filter(d=>focusedDock?d.id===focusedDock.id:!selected||contains(selected,d.coordinates))){
   const marker=new THREE.Sprite(new THREE.SpriteMaterial({color:GIS_SPEC.colors.dock,depthTest:false}));marker.position.copy(project(dock.coordinates,10));marker.userData.dock=dock;marker.renderOrder=5;group.add(marker);
   const button=document.createElement('button');button.className='dock-map-button';button.textContent=(dock.name.match(/^(.*?)-X10Dock/)?.[1]??dock.name)+' · Dock';button.setAttribute('aria-label','Open dock '+dock.name);button.onclick=()=>openDock(dock);button.title=dock.name;dockButtons.append(button);markerButtons.set(dock.id,button);
   if(selected){const button=document.createElement('button');button.textContent=dock.name;button.style.cssText='display:block;font-size:11px;margin-top:4px';button.onclick=()=>openDock(dock);list.append(button);}
  }
  if(selected&&!list.children.length)list.textContent='No mapped Skydio docks in this state.';
 }
 // Fit the full three-mile dock disk with padding, including narrow map panels.
 function fitDock(dock:Dock){
   const vertical=THREE.MathUtils.degToRad(camera.fov)/2;
   const horizontal=Math.atan(Math.tan(vertical)*camera.aspect);
   const distance=3*1609.344/Math.sin(Math.min(vertical,horizontal))*1.15;
   focus(project(dock.coordinates,20),distance);
 }
 function openDock(dock:Dock){focusedDock=dock;fitDock(dock);redraw();window.parent.postMessage({type:'flightline:select-dock',id:dock.id},location.origin);}
 function choose(state?:State){
  selected=state;host.classList.toggle('workspace-national',active&&!selected);redraw();
  if(!state){
    // Operating footprint: Texas through Michigan and the eastern dock sites.
    const target=project([-89.5,36.25]);
    const aspect=Math.max(.4,host.clientWidth/Math.max(1,host.clientHeight));
    const tanV=Math.tan(camera.fov*Math.PI/360),tanH=tanV*aspect;
    let distance=0;
    for(const lon of [-103,-76])for(const lat of [25,47.5]){
      const delta=project([lon,lat]).sub(target);
      distance=Math.max(distance,Math.abs(delta.x)/tanH+.482*delta.z,Math.abs(.876*delta.z)/tanV+.482*delta.z);
    }
    focus(target,distance*1.08);return;
  }
  const points=rings(state).flat().map(p=>project(p));const box=new THREE.Box3().setFromPoints(points);
  focus(box.getCenter(new THREE.Vector3()),Math.max(100000,box.getSize(new THREE.Vector3()).length()*1.5));
 }
 fetch(location.pathname.startsWith('/flightline-fixed/')?'/states.geojson':'/gis/states.geojson').then(r=>{if(!r.ok)throw Error('State boundaries unavailable');return r.json();}).then(data=>{
  if(disposed)return;states=data.features;redraw();
 }).catch(()=>label.textContent='State boundaries unavailable · reload the local preview');
 if(location.pathname.startsWith('/flightline-fixed/'))fetch('/soc-quadrants.geojson').then(response=>{if(!response.ok)throw Error('Quadrants unavailable');return response.json();}).then(data=>{if(disposed)return;quadrants=data.features;redraw();}).catch(()=>{quadrantError=true;if(!disposed)redraw();});
 const receive=(event:MessageEvent)=>{
  if(event.origin!==location.origin||event.source!==window.parent)return;
  if(event.data?.type==='flightline:docks'&&Array.isArray(event.data.assets)){
   const signature=JSON.stringify(event.data.assets);if(signature===dockSignature)return;dockSignature=signature;
   docks=event.data.assets.filter((d:Dock)=>d.kind==='dock'&&Array.isArray(d.coordinates)&&d.coordinates.length===2&&d.coordinates.every(Number.isFinite));redraw();
  }
  if(event.data?.type==='flightline:stage'){
    stage=event.data.stage;host.dataset.stage=stage;inspectionRoot?.setAttribute('data-stage',stage);
    if(!sceneReady){sceneReady=true;requestAnimationFrame(()=>requestAnimationFrame(()=>window.parent.postMessage({type:'flightline:scene-ready'},location.origin)));}
    const state=missionAppearance(routeMission,stage);recordedLayer.visible=mode==='dock'&&state.visible;
    for(const object of recordedLayer.children){const material=(object as THREE.Line).material as THREE.LineBasicMaterial;if(material){material.transparent=true;material.opacity=state.opacity;}}
    inspectionLayer.visible=mode==='dock'&&stage!=='review';
  }
  if(event.data?.type==='flightline:mission-route-meta'){routeMission=event.data.mission;}
  if(event.data?.type==='flightline:focus-dock'){
    const dock=docks.find(d=>d.id===event.data.id);if(dock&&dock.id!==focusedDock?.id){focusedDock=dock;fitDock(dock);redraw();}
  }
  if(event.data?.type==='flightline:inspection'&&Array.isArray(event.data.features)){
    clearLayer(inspectionLayer);inspectionBounds=new THREE.Box3();
    const selectedPhoto=event.data.features.find((f:any)=>f.properties?.layer==='photo'&&f.properties?.selected);
    if(selectedPhoto)movePreview(selectedPhoto,event.data.features.filter((f:any)=>f.properties?.layer==='fov'));
    else{previewDrone.visible=false;animatedFov.visible=false;previewMotion=undefined;previewKey='';}
    const predicted=new Map<string,THREE.Vector3[]>();
    for(const feature of event.data.features){
      if(feature.properties?.layer==='predicted_network'&&feature.geometry?.type==='LineString'){const props=feature.properties,key=props.assetType==='PhaseConductor'?'phase-'+String(feature.id).split('/').at(-1):props.assetType;const points=predicted.get(key)??[];for(let i=1;i<feature.geometry.coordinates.length;i++)points.push(project(feature.geometry.coordinates[i-1],feature.geometry.coordinates[i-1][2]),project(feature.geometry.coordinates[i],feature.geometry.coordinates[i][2]));predicted.set(key,points);continue;}
      if(feature.properties?.layer==='fov'&&selectedPhoto)continue;
      if(!feature.geometry||!['Point','LineString'].includes(feature.geometry.type))continue;
      const props=feature.properties??{},height=props.height_above_takeoff_m??1;
      const coords=feature.geometry.type==='Point'?[feature.geometry.coordinates]:feature.geometry.coordinates;
      const points=coords.filter((p:number[])=>Array.isArray(p)&&p.slice(0,2).every(Number.isFinite)).map((p:number[])=>project(p,p[2]??height));
      if(!points.length)continue;points.forEach((p:THREE.Vector3)=>inspectionBounds.expandByPoint(p));
      const color=props.selected&&props.layer!=='photo'?0xffcf60:props.pass==='return'?0xeaa4e9:({structure:0xf5f5f5,orientation:0x83b8ff,inferred_span:0xb2bfc3} as Record<string,number>)[props.layer]??0x75e8d4;
      const geometry=new THREE.BufferGeometry().setFromPoints(points);
      const object=feature.geometry.type==='Point'?new THREE.Points(geometry,new THREE.PointsMaterial({color,size:props.selected?11:6,sizeAttenuation:false,depthTest:false})):new THREE.Line(geometry,new THREE.LineBasicMaterial({color,depthTest:false,depthWrite:false}));object.renderOrder=7;inspectionLayer.add(object);
    }
    const networkColors:Record<string,number>={StructureMember:0xaebbb9,Crossarm:0xcbd4d1,Insulator:0xc99566,ShieldSupport:0x9eaaa7,ShieldWire:0xa4afbc,'phase-0':0xe8b45b,'phase-1':0x82cbb6,'phase-2':0x90b8e4};
    for(const [kind,points]of predicted){const lines=new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(points),new THREE.LineBasicMaterial({color:networkColors[kind]??0xaebbb9,transparent:true,opacity:kind.startsWith('phase-')?.9:.85,depthTest:true,depthWrite:false}));lines.userData.predicted=true;inspectionLayer.add(lines);}
  }
  if(event.data?.type==='flightline:inspection-focus'&&Array.isArray(event.data.coordinates)){if(event.data.waypoint)movePreview(event.data.waypoint);focus(project(event.data.coordinates,event.data.height??35),180);}
  if(event.data?.type==='flightline:recorded-route'&&Array.isArray(event.data.points)){
    for(const child of [...recordedLayer.children])if(child!==routeMarker){recordedLayer.remove(child);const line=child as THREE.Line;line.geometry.dispose();(line.material as THREE.Material).dispose();}
    const points=event.data.points as number[][];routeRelative=points.some(p=>Number.isFinite(p[4]));routeOrigin=points.find(p=>Number.isFinite(p[3]))?.[3]??0;routeBounds=new THREE.Box3();const segments:THREE.Vector3[]=[];let previous:THREE.Vector3|undefined;
    for(const point of points){const height=routeRelative?point[4]:Number.isFinite(point[3])?point[3]-routeOrigin:0;if(!Number.isFinite(height)){previous=undefined;continue;}const next=project(point,height);routeBounds.expandByPoint(next);if(previous)segments.push(previous,next);previous=next;}
    const line=new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(segments),new THREE.LineBasicMaterial({color:0xffcf64,depthTest:false}));line.renderOrder=7;recordedLayer.add(line);const state=missionAppearance(routeMission,stage);line.material.transparent=true;line.material.opacity=state.opacity;recordedLayer.visible=state.visible;routeMarker.visible=false;frameBounds(routeBounds);
  }
  if(event.data?.type==='flightline:route-position'&&Array.isArray(event.data.point)){const p=event.data.point;const height=routeRelative?p[4]:Number.isFinite(p[3])?p[3]-routeOrigin:0;routeMarker.visible=Number.isFinite(height);if(routeMarker.visible)routeMarker.position.copy(project(p,height));}
  if(event.data?.type==='flightline:fit-inspection')frameBounds(inspectionBounds);
  if(event.data?.type==='flightline:fit-dock-data')frameBounds(routeBounds.isEmpty()?inspectionBounds:routeBounds);
  if(event.data?.type==='flightline:workspace-mode'){
    document.body.classList.add('flightline-embedded');const oldMode=mode;mode=event.data.mode;
    active=true;host.dataset.workspaceMode=mode;inspectionRoot?.classList.toggle('workspace-dock',mode==='dock');
    panel.hidden=!active;group.visible=active;inspectionLayer.visible=mode==='dock'&&stage!=='review';recordedLayer.visible=mode==='dock'&&missionAppearance(routeMission,stage).visible;
    if(mode==='fleet'&&oldMode!==mode){focusedDock=undefined;redraw();choose(selected);}
    else if(mode==='fleet'&&oldMode===mode&&!focusedDock)choose(selected);
    else if(mode==='dock'){redraw();if(oldMode!=='dock'&&focusedDock)fitDock(focusedDock);}
  }

 };
 window.addEventListener('message',receive);
 const hoverLayer=new THREE.Group();scene.add(hoverLayer);let hovered:State|undefined;
 const ray=new THREE.Raycaster(),ground=new THREE.Plane(new THREE.Vector3(0,1,0),0);
 let down:number[]|undefined;
 const pointerdown=(e:PointerEvent)=>{down=[e.clientX,e.clientY];};
 const hover=(e:PointerEvent)=>{
  if(!active||e.buttons||(e.target as Element).closest('button,input,select,details')){clearHover();return;}
  const rect=host.getBoundingClientRect(),width=host.classList.contains('camera-split')?rect.width/2:rect.width;
  if(e.clientX>rect.left+width){clearHover();return;}
  ray.setFromCamera(new THREE.Vector2((e.clientX-rect.left)/width*2-1,-(e.clientY-rect.top)/rect.height*2+1),camera);
  const point=ray.ray.intersectPlane(ground,new THREE.Vector3()),state=point?states.find(s=>contains(s,frame.geographic(point.toArray()))):undefined;
  const next=state!==selected?state:undefined;if(next===hovered)return;clearHover();hovered=next;if(!next)return;
  host.style.cursor='pointer';
  const polygons=next.geometry.type==='Polygon'?[next.geometry.coordinates]:next.geometry.coordinates;
  for(const polygon of polygons){const shape=new THREE.Shape();polygon.forEach((ring:number[][],i:number)=>{const points=ring.map(p=>{const v=project(p);return new THREE.Vector2(v.x,-v.z);});if(i===0)shape.setFromPoints(points);else shape.holes.push(new THREE.Path(points));});const geometry=new THREE.ShapeGeometry(shape);geometry.rotateX(-Math.PI/2);const mesh=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({color:0x9ae6d4,transparent:true,opacity:.14,depthTest:false,depthWrite:false,side:THREE.DoubleSide}));mesh.position.y=8;mesh.renderOrder=4;hoverLayer.add(mesh);}
 };
 function clearHover(){hovered=undefined;host.style.cursor='';clearLayer(hoverLayer);}
 const click=(e:MouseEvent)=>{
  if(!active||!down||Math.hypot(e.clientX-down[0],e.clientY-down[1])>5||(e.target as HTMLElement).closest('button,select,details'))return;
  const rect=host.getBoundingClientRect(),width=host.classList.contains('camera-split')?rect.width/2:rect.width;if(e.clientX>rect.left+width)return;ray.setFromCamera(new THREE.Vector2((e.clientX-rect.left)/width*2-1,-(e.clientY-rect.top)/rect.height*2+1),camera);
  if(selected||camera.position.distanceTo(controls.target)<1100000){const hit=ray.intersectObjects(group.children).find(h=>h.object.userData.dock);if(hit){e.stopImmediatePropagation();openDock(hit.object.userData.dock);return;}}
  const point=ray.ray.intersectPlane(ground,new THREE.Vector3());if(!point)return;
  const state=states.find(s=>contains(s,frame.geographic(point.toArray())));if(state&&state!==selected){e.stopImmediatePropagation();clearHover();focusedDock=undefined;choose(state);if(mode!=='fleet')window.parent.postMessage({type:'flightline:back-fleet'},location.origin);}
 };
 host.addEventListener('pointermove',hover);host.addEventListener('pointerleave',clearHover);host.addEventListener('pointerdown',pointerdown,true);host.addEventListener('click',click,true);
 inspectionLayer.visible=recordedLayer.visible=false;
 window.parent.postMessage({type:'flightline:map-ready'},location.origin);
 return {update(){
   if(previewMotion){const m=previewMotion,t=Math.min(1,(performance.now()-m.start)/900),ease=t*t*(3-2*t);previewDrone.position.lerpVectors(m.from,m.to,ease);previewDrone.quaternion.slerpQuaternions(m.fromQ,m.toQ,ease);fovPoints=m.toFov.map((p,i)=>m.fromFov[i].clone().lerp(p,ease));animatedFov.geometry.dispose();animatedFov.geometry=new THREE.BufferGeometry().setFromPoints(fovPoints);if(t===1)previewMotion=undefined;}
   const showPreview=mode==='dock'&&stage==='planning';previewDrone.visible=showPreview&&!!previewKey;animatedFov.visible=previewDrone.visible&&fovPoints.length>0;
   const width=host.clientWidth,height=host.clientHeight;host.dataset.workspaceDetail=String(camera.position.distanceTo(controls.target)<1200000);
   for(const object of group.children){if(!object.userData.dock)continue;const dock=object.userData.dock as Dock,button=markerButtons.get(dock.id);if(!button)continue;
     const point=object.position.clone().project(camera),detail=mode==='dock'||host.dataset.workspaceDetail==='true';
     button.hidden=!active||!detail||point.z< -1||point.z>1||Math.abs(point.x)>1||Math.abs(point.y)>1;
     button.style.left=(point.x+1)*width/2+'px';button.style.top=(1-point.y)*height/2+'px';
   }
   for(const object of group.children)if(object instanceof THREE.Sprite){const size=camera.position.distanceTo(object.position)*(object.userData.quadrantLabel?.035:.012);object.scale.set(size*(object.userData.quadrantLabel?4:1),size,1);}},dispose(){clearLayer(previewDrone);animatedFov.geometry.dispose();(animatedFov.material as THREE.Material).dispose();scene.remove(previewDrone,animatedFov);clearHover();scene.remove(hoverLayer);host.removeEventListener('pointermove',hover);host.removeEventListener('pointerleave',clearHover);disposed=true;window.removeEventListener('message',receive);host.removeEventListener('pointerdown',pointerdown,true);host.removeEventListener('click',click,true);panel.remove();clearLayer(inspectionLayer);clearLayer(recordedLayer);scene.remove(inspectionLayer,recordedLayer);host.classList.remove('workspace-national');group.traverse(o=>{const sprite=o as THREE.Sprite;if(sprite.material instanceof THREE.SpriteMaterial)sprite.material.map?.dispose();const m=o as THREE.Mesh;m.geometry?.dispose();if(m.material&&!Array.isArray(m.material))m.material.dispose();});scene.remove(group);}};
}
