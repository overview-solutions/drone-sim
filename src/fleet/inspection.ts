import {rayKingStructures} from './ray-king-structures';
import {missionNotams} from './mission-notams';
import {rayKingCloud} from './ray-king';
import {disasters} from './disasters';
import {inspectionIndex,extraCapturePriority} from './inspection-index';
import {assetPassages} from './history-backfill';
import {SpanCoverage} from './span-coverage';
import {reviewNavigation} from './review-navigation';
import {catchupSpeed} from './capture-speed';
import {contingencyPanel} from './contingency-panel';
import {shielding} from './shielding';
import {airspace} from './airspace';
import {equipment,defectFor} from './equipment';
import {vegetation} from './vegetation';
import {missionTimeline} from './timeline';
import {taxiLayout} from './turnaround';
import {sensorOverlay} from './sensor-overlay';
import * as THREE from 'three';
import {cameraProfile,optics,approachZoom,canPreposition,canSupplementalShot} from './camera-model';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {addWorld,type WorldData} from './world';
import {osmContext} from './osm-context';
import {basemap} from './basemap';
import {fleetPanel} from './fleet-panel';
import {dataPanel} from './mission-data';
import {generateUN,type V3} from './un';
import type {PowerLine} from './model';
let acquisitionMode='known';
export function inspection(host:HTMLElement,line:PowerLine,worldData?:WorldData){
 const network=generateUN(line);let mph=40,rate=1,running=false,autoZoom=true,phase='auto',progress=0,elapsed=0,disposed=false,followFlight=false;
 host.innerHTML=`<div class="inspection-head"><strong>Ohio operations <small>Simulated live environment</small></strong><span class="badge">SYNTHETIC STRUCTURES / NO LIVE CAMERA</span></div><div class="inspection-tools"><button id="inspect-play" class="primary">Inspection demo</button><button id="demo-return" disabled>Return demo to launch</button><button id="world-ohio">State overview</button><button id="world-follow">Follow demo</button><button id="mission-overview">Mission outline</button><button id="world-unfollow" hidden>Stop following</button><button id="camera-toggle" aria-pressed="true">Hide camera</button><details class="mission-settings"><summary>Camera & sensors</summary><div class="settings-content"><button id="world-corridor">Fit corridor</button><label>Airspeed <input id="inspect-speed" type="range" min="25" max="50" value="40"> <span id="mph">40 mph</span></label><label>Playback <select id="inspect-rate"><option value="1" selected>1×</option><option value="5">5×</option><option value="10">10×</option></select></label><label>Target acquisition <select id="acquisition-mode"><option value="known">Known coordinates · direct targeting</option><option value="wide">Wide-view reacquisition</option></select></label><label>Phase target <select id="inspect-phase"><option value="auto">Overview → A → B → C</option>A</option><option>B</option><option>C</option></select></label><label><input id="auto-zoom" type="checkbox" checked> Auto attachment zoom</label><label>Gimbal FOV <input id="inspect-fov" type="range" min="4" max="55" value="14"></label><label><input id="show-camera-fov" type="checkbox" checked> Camera FOV wireframe</label><label><input id="show-lidar" type="checkbox" checked> Hypothetical LiDAR points</label><small>Gold: camera cone (up to 150 m). Teal: 60° downward scan; height-colored returns on displayed surfaces. 30 pts/m² modeled target; displayed returns are thinned. Not measured coverage.<span id="lidar-density"></span></small><button id="inspect-reset">Restart pass</button><button id="un-export">Export UN geometry</button><details><summary>Camera acquisition history</summary><p>Provisional EO profile. Timers overlap; total is wall-clock simulation time. 24 pixels across a 0.5 m detail is an illustrative capture threshold, not defect-detection certification.</p><div id="camera-history"></div></details></div></details></div><div class="inspection-canvas"><details class="camera-info"><summary aria-label="Camera information" title="Camera information">ⓘ</summary><div class="gimbal-caption">GIMBAL · forward acquisition · simulated zoom</div></details><div class="crosshair">＋</div><div id="inspect-readout"></div></div><p class="note">OSM alignment with synthetic supports at major bends / nominal 450 m (1,476 ft) spans. Three phases, sagging spans, 60 m lateral offset, 85 m local flight height. Drag to orbit · scroll to zoom · right-drag to pan. Illustrative launch / climb / approach / landing. Forward-only overview then phase captures; minimum 2 s reposition, 1.5 s focus/settle, 4 s between shots. Illustrative 15°/s slew and 4°/s zoom-FOV limits. No terrain, runway, flight-dynamics or calibrated gimbal validation.</p>`;
 const banner=host.querySelector('.inspection-head')!;banner.querySelector('.badge')?.remove();const droneBar=document.createElement('div');droneBar.className='drone-toolbar';host.append(droneBar);droneBar.append(host.querySelector('.inspection-tools')!);banner.append(host.querySelector('#world-ohio')!);
 let cameraOpen=true;
 (host.querySelector('#camera-toggle') as HTMLButtonElement).onclick=()=>{cameraOpen=!cameraOpen;const b=host.querySelector('#camera-toggle')!;b.textContent=cameraOpen?'Hide camera':'Show camera';b.setAttribute('aria-pressed',String(cameraOpen));};
 const dock=document.createElement("div");dock.className="data-dock";host.append(dock);const inspector=dataPanel(dock,line);
 let review:ReturnType<typeof reviewNavigation>|undefined;
 let canopy:ReturnType<typeof vegetation>|undefined;let faults:ReturnType<typeof equipment>|undefined;
 const timeline=worldData?missionTimeline(host,worldData,()=>[...(canopy?.events()??[]),...(faults?.events()??[])].sort((a,b)=>a.seconds-b.seconds),id=>id.startsWith('EQUIP-')?faults?.select(id):canopy?.select(id),{eventPosition:e=>review?.eventPosition(e)??{at:0,span:0},sectors:()=>review?.sectors()??[],select:id=>review?.select(id),scope:()=>review?.profileScope(),level:l=>review?.profileLevel(l),open:id=>review?.profileOpen(id)}):undefined;
 const canvasHost=host.querySelector('.inspection-canvas') as HTMLElement;
 if(worldData){const legend=document.createElement('div');legend.className='recency-legend';legend.innerHTML='<strong>Inspection recency · simulated</strong><div class="recency-ramp"></div><div class="recency-labels"><span>Today</span><span>30 days</span><span>90+ days</span></div>';canvasHost.append(legend);}

 function download(){const a=document.createElement('a'),url=URL.createObjectURL(new Blob([JSON.stringify(network.pack,null,2)],{type:'application/json'}));a.href=url;a.download=`osm-${line.id}-synthetic-un.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
 (host.querySelector('#un-export') as HTMLButtonElement).onclick=download;
 let renderer:THREE.WebGLRenderer;
 try{renderer=new THREE.WebGLRenderer({antialias:true,logarithmicDepthBuffer:true});}catch{canvasHost.innerHTML='<p>WebGL is unavailable. The Ohio map and UN export remain available.</p>';return {dispose(){},pack:network.pack};}
 renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.setClearColor(0x102330);renderer.autoClear=false;canvasHost.prepend(renderer.domElement);
 const scene=new THREE.Scene();scene.add(new THREE.HemisphereLight(0xc9eaff,0x152922,2));const sun=new THREE.DirectionalLight(0xffedcd,2);sun.position.set(300,800,400);scene.add(sun);
 const recordedLidar=rayKingCloud(scene,banner,line);
 if(line.id===179559746)rayKingStructures(scene,banner,network);
 if(line.id===179559746)(host.querySelector('#show-lidar') as HTMLInputElement).checked=false;
 const camera=new THREE.PerspectiveCamera(55,1,1,2000000),gimbal=new THREE.PerspectiveCamera(14,1,.1,12000);
 camera.layers.enable(1);
 const mapSurface=document.createElement('div');mapSurface.className='map-interaction';canvasHost.append(mapSurface);
 const controls=new OrbitControls(camera,mapSurface);controls.enableDamping=true;controls.minDistance=5;controls.maxDistance=900000;controls.maxPolarAngle=Math.PI*.495;controls.zoomSpeed=1.7;

 let followedVehicle:string|null=null;
 const followAnchor=new THREE.Vector3();let anchorReady=false,acquiring=false;
 const followOffset=new THREE.Vector3(0,100,180);
 function startTracking(){host.classList.add('following-aircraft');review?.hide();missionBox.visible=false;transition=undefined;anchorReady=false;acquiring=true;(host.querySelector('#world-unfollow') as HTMLButtonElement).hidden=false;}
 function stopTracking(){host.classList.remove('following-aircraft');host.querySelectorAll<HTMLDetailsElement>('.aircraft-details').forEach(el=>el.open=false);followFlight=false;followedVehicle=null;anchorReady=false;acquiring=false;(host.querySelector('#world-unfollow') as HTMLButtonElement).hidden=true;}
 (host.querySelector('#world-unfollow') as HTMLButtonElement).onclick=stopTracking;
 // OrbitControls owns the user's chosen angle and distance; input cancels only the initial approach.
 controls.addEventListener('start',()=>{acquiring=false;});
 function track(position:THREE.Vector3,dt:number){
 if(anchorReady){const delta=position.clone().sub(followAnchor);camera.position.add(delta);controls.target.add(delta);}
 followAnchor.copy(position);anchorReady=true;
 if(acquiring){const alpha=1-Math.exp(-dt*4);camera.position.lerp(position.clone().add(followOffset),alpha);controls.target.lerp(position,alpha);if(camera.position.distanceTo(position.clone().add(followOffset))<1)acquiring=false;}
 }

 const traffic=airspace(scene,canvasHost,network.origin,worldData?.fleet?.().find(v=>v.id===worldData.activeVehicle)?.route??[]);banner.append(traffic.panel);
 const contingency=worldData?contingencyPanel(scene,droneBar,worldData,network.origin,network.spans.map(s=>s.points.map(p=>new THREE.Vector3(...p)))):undefined;
 const world=worldData?addWorld(scene,network.origin,worldData):undefined;
 let transition:{position:THREE.Vector3;target:THREE.Vector3}|undefined;
 controls.addEventListener('start',()=>transition=undefined);
 function view(mode:string){review?.hide();followedVehicle=null;followFlight=mode==='flight';if(mode==='flight'){transition=undefined;startTracking();return;}stopTracking();const target=mode==='ohio'&&world?world.center:new THREE.Box3().setFromPoints(network.locations.map(p=>new THREE.Vector3(...p))).getCenter(new THREE.Vector3());const extent=mode==='ohio'?480000:Math.max(800,new THREE.Box3().setFromPoints(network.locations.map(p=>new THREE.Vector3(...p))).getSize(new THREE.Vector3()).length());transition={target,position:target.clone().add(new THREE.Vector3(0,extent,extent*.55))};}
 (host.querySelector('#world-ohio') as HTMLButtonElement).onclick=()=>view('ohio');(host.querySelector('#world-corridor') as HTMLButtonElement).onclick=()=>view('corridor');(host.querySelector('#world-follow') as HTMLButtonElement).onclick=()=>view('flight');
 const selectedRoute=new THREE.Line(new THREE.BufferGeometry(),new THREE.LineBasicMaterial({color:0x9df3cf,depthTest:false}));scene.add(selectedRoute);
 const missionBox=new THREE.LineLoop(new THREE.BufferGeometry(),new THREE.LineBasicMaterial({color:0xffdc84,depthTest:false,transparent:true,opacity:.85}));missionBox.userData.sensorIgnore=true;missionBox.visible=false;missionBox.renderOrder=8;scene.add(missionBox);
 function fitMission(){review?.mission();const vehicle=worldData?.fleet?.().find(v=>v.id===worldData.activeVehicle);if(!vehicle||!world)return;stopTracking();const points=vehicle.route.map(p=>world.project(p,110));const bounds=new THREE.Box3().setFromPoints(points).expandByScalar(100),target=bounds.getCenter(new THREE.Vector3());const min=bounds.min,max=bounds.max;
 missionBox.geometry.dispose();missionBox.geometry=new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(min.x,110,min.z),new THREE.Vector3(max.x,110,min.z),new THREE.Vector3(max.x,110,max.z),new THREE.Vector3(min.x,110,max.z)]);missionBox.visible=true;
 const split=cameraOpen&&!vehicle.done&&!!worldData?.fleetState?.().running;const aspect=Math.max(.1,canvasHost.clientWidth/(split?2:1)/Math.max(1,canvasHost.clientHeight));const halfVertical=THREE.MathUtils.degToRad(camera.fov/2),halfAngle=Math.min(halfVertical,Math.atan(Math.tan(halfVertical)*aspect));const radius=bounds.getSize(new THREE.Vector3()).length()/2,distance=Math.max(500,radius/Math.sin(halfAngle)*1.15);
 transition={target,position:target.clone().add(new THREE.Vector3(0,1,.25).normalize().multiplyScalar(distance))};
 }
 (host.querySelector('#mission-overview') as HTMLButtonElement).onclick=fitMission;
 const panel=world&&worldData?fleetPanel(canvasHost,worldData,world.project,id=>{if(id&&id!==worldData?.activeVehicle){worldData?.selectVehicle?.(id);return;}followedVehicle=id;followFlight=false;transition=undefined;if(id)startTracking();else stopTracking();},points=>{selectedRoute.geometry.dispose();selectedRoute.geometry=new THREE.BufferGeometry().setFromPoints(points.map(p=>world.project(p,110)));if(points.length)fitMission();else missionBox.visible=false;}):undefined;
 const steel=new THREE.MeshStandardMaterial({color:0x9eafb7,metalness:.5,roughness:.55});const black=new THREE.MeshStandardMaterial({color:0x112b34});
 function beam(a:V3,b:V3,width=.35,mat=steel){const av=new THREE.Vector3(...a),bv=new THREE.Vector3(...b),mesh=new THREE.Mesh(new THREE.CylinderGeometry(width,width,av.distanceTo(bv),5),mat);mesh.position.copy(av).add(bv).multiplyScalar(.5);mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),bv.sub(av).normalize());scene.add(mesh);return mesh;}
 for(const t of network.towers){if(line.id===179559746)continue;const [x,,z]=t.position,h=t.height;for(const dx of [-1,1])for(const dz of [-1,1])beam([x+dx*5,0,z+dz*5],[x+dx*1.3,h,z+dz*1.3]);
 for(let y=0;y<h-6;y+=7){const w=5-3.7*y/h,w2=5-3.7*(y+7)/h;for(const sign of [-1,1]){beam([x-w,y,z+sign*w],[x+w2,y+7,z+sign*w2],.14);beam([x+w,y,z+sign*w],[x-w2,y+7,z+sign*w2],.14);beam([x+sign*w,y,z-w],[x+sign*w2,y+7,z+w2],.14);}}
 const towerIndex=network.towers.indexOf(t);
 const tag=(mesh:THREE.Mesh,phase:number)=>{mesh.userData.equipmentTower=towerIndex;mesh.userData.equipmentPhase=phase;return mesh;};
 const a=t.attachments[0].position,c=t.attachments[2].position;tag(beam([a[0],h,a[2]],[c[0],h,c[2]],.45,network.towers.indexOf(t)%4===1?new THREE.MeshStandardMaterial({color:0x9c5636,roughness:1}):steel),-1);
 for(const a of t.attachments){const p=a.position;tag(beam([p[0],h,p[2]],p,.45,black),t.attachments.indexOf(a));for(let k=0;k<6;k++){if(defectFor(network.towers.indexOf(t)).phase===0&&a.phase==='A'&&k===2)continue;const ins=new THREE.Mesh(new THREE.CylinderGeometry(.8,.8,.22,10),new THREE.MeshStandardMaterial({color:0xb8d9ce}));ins.position.set(p[0],p[1]+.4+k*.4,p[2]);tag(ins,t.attachments.indexOf(a));scene.add(ins);}const marker=new THREE.Mesh(new THREE.SphereGeometry(.6,8,6),new THREE.MeshBasicMaterial({color:a.phase==='A'?0xffb563:a.phase==='B'?0x8be0fa:0xcb9dff}));marker.position.set(...p);tag(marker,t.attachments.indexOf(a));scene.add(marker);}
 }
 for(const s of network.spans){if(line.id===179559746)continue;const geometry=new THREE.BufferGeometry().setFromPoints(s.points.map(p=>new THREE.Vector3(...p)));scene.add(new THREE.Line(geometry,new THREE.LineBasicMaterial({color:s.phase==='A'?0xd4af76:s.phase==='B'?0x8eafb8:0xb1a0c5})));}
 for(const splice of network.splices){const mesh=new THREE.Mesh(new THREE.CylinderGeometry(.35,.35,2,10),steel);mesh.position.set(...splice.position);const a=network.towers[splice.fromTower].attachments[1].position,b=network.towers[splice.toTower].attachments[1].position;mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),new THREE.Vector3(b[0]-a[0],b[1]-a[1],b[2]-a[2]).normalize());mesh.userData.equipmentTower=splice.fromTower;mesh.userData.equipmentPhase=3;mesh.userData.componentId=splice.id;scene.add(mesh);}
 const bound=new THREE.Box3().setFromPoints(network.locations.map(p=>new THREE.Vector3(...p)));const center=bound.getCenter(new THREE.Vector3());const ground=new THREE.Mesh(new THREE.PlaneGeometry(2000000,2000000),new THREE.MeshStandardMaterial({color:0x213d38,roughness:1}));ground.renderOrder=-20;ground.rotation.x=-Math.PI/2;ground.position.set(center.x,-.2,center.z);scene.add(ground);
 const baseLayer=basemap(scene,canvasHost,network.origin);
 const osmLayer=osmContext(scene,canvasHost,network.origin);if(line.id===-1001)osmLayer.loadUrban();
 const shield=shielding(scene,canvasHost,[...network.spans.map(s=>({id:s.id,kind:'Modeled transmission',points:s.points.map(p=>new THREE.Vector3(...p)),heightKnown:true})),...(worldData?.lines.filter(l=>l.id!==line.id).map(l=>({id:`OSM way/${l.id}`,kind:'Other power line',points:l.coords.map(p=>world!.project(p,0)),heightKnown:false}))??[])],()=>osmLayer.shieldingAssets());
 const grid=new THREE.GridHelper(10000,100,0x3b5e57,0x294b44);grid.position.copy(center);scene.add(grid);
 const pathPoints=network.towers.map(t=>new THREE.Vector3(t.position[0]-Math.sin(t.heading)*60,85,t.position[2]+Math.cos(t.heading)*60));
 if(pathPoints.length<2)pathPoints.push(pathPoints[0].clone().add(new THREE.Vector3(200,0,0)));
 const first=pathPoints[0].clone(),last=pathPoints[pathPoints.length-1].clone();
 const outbound=pathPoints[1].clone().sub(first).setY(0).normalize(),inbound=last.clone().sub(pathPoints[pathPoints.length-2]).setY(0).normalize();
 const launch=first.clone().addScaledVector(outbound,-900).setY(1.5),land=last.clone().addScaledVector(inbound,900).setY(1.5);
 pathPoints.unshift(launch,first.clone().addScaledVector(outbound,-650).setY(1.5),first.clone().addScaledVector(outbound,-350).setY(45));
 pathPoints.push(last.clone().addScaledVector(inbound,350).setY(45),last.clone().addScaledVector(inbound,650).setY(1.5),land);
 const missionPath=new THREE.CatmullRomCurve3(pathPoints,false,'centripetal');
 let path=missionPath,pathLength=path.getLength(),returning=false;
 function resetRoute(){path=missionPath;pathLength=path.getLength();returning=false;returnLine.visible=false;}
 const returnLine=new THREE.Line(new THREE.BufferGeometry(),new THREE.LineBasicMaterial({color:0xb9ec8c}));scene.add(returnLine);returnLine.visible=false;
 (host.querySelector('#demo-return') as HTMLButtonElement).onclick=()=>{
 if(returning||progress<=0||progress>=pathLength)return;
 const current=path.getPointAt(progress/pathLength),direction=path.getTangentAt(progress/pathLength).setY(0).normalize(),side=new THREE.Vector3(-direction.z,0,direction.x);
 const points=[current];
 if(current.y>5){points.push(current.clone().addScaledVector(direction,100),current.clone().addScaledVector(direction,130).addScaledVector(side,100),current.clone().addScaledVector(side,180),current.clone().addScaledVector(direction,-100).addScaledVector(side,100));}
 for(let d=Math.max(0,progress-200);d>0;d-=100)points.push(missionPath.getPointAt(d/missionPath.getLength()));
 points.push(launch.clone());
 path=new THREE.CatmullRomCurve3(points,false,'centripetal');pathLength=path.getLength();progress=0;returning=true;running=true;settled=0;activeKey='';
 returnLine.geometry.dispose();returnLine.geometry=new THREE.BufferGeometry().setFromPoints(path.getPoints(600));returnLine.visible=true;
 host.querySelector('#inspect-play')!.textContent='Pause return';
 }; 
 if(!worldData)for(const [a,b] of [[launch,first.clone().addScaledVector(outbound,-650).setY(1.5)],[last.clone().addScaledVector(inbound,650).setY(1.5),land]]){const runway=new THREE.Mesh(new THREE.BoxGeometry(a.distanceTo(b)+80,.3,25),new THREE.MeshStandardMaterial({color:0x626c70}));runway.position.copy(a).add(b).multiplyScalar(.5).setY(.1);runway.rotation.y=-Math.atan2(b.z-a.z,b.x-a.x);scene.add(runway);}
 const extraCounts=new Map<string,number>();let lastExtra=-Infinity;let coverageSignature='';
 let shotCount=0,lastShot=-Infinity,settled=0,activeKey='',locked=false,acquiredAt=0;
 const transitionStart=new THREE.Quaternion();
 let cameraStage='SCANNING',lastCapture='None',zoom=1,slewSpeed=0,slewTime=0,zoomTime=0,focusTime=0,reacquiring=false,wideSettled=0,lastTower=-1;
 const shotLog:string[]=[];
 const captured=new Set<string>();const scannedSpans=new Set<number>();const spanCoverage=new SpanCoverage();let capturePass=1;
 function frameReview(points:THREE.Vector3[],side?:THREE.Vector3){stopTracking();cameraOpen=false;host.querySelector('#camera-toggle')!.textContent='Show camera';host.querySelector('#camera-toggle')!.setAttribute('aria-pressed','false');missionBox.visible=false;
 const bounds=new THREE.Box3().setFromPoints(points),target=bounds.getCenter(new THREE.Vector3()),size=bounds.getSize(new THREE.Vector3());if(side){
 const aspect=Math.max(.1,canvasHost.clientWidth/Math.max(1,canvasHost.clientHeight)),tanV=Math.tan(THREE.MathUtils.degToRad(camera.fov/2)),tanH=tanV*aspect;
 const right=new THREE.Vector3().crossVectors(new THREE.Vector3(0,1,0),side).normalize(),up=new THREE.Vector3().crossVectors(side,right).normalize();let distance=30;
 for(const p of points){const q=p.clone().sub(target),depth=q.dot(side);distance=Math.max(distance,depth+Math.abs(q.dot(right))*1.12/tanH,depth+Math.abs(q.dot(up))*1.12/tanV);}
 transition={target,position:target.clone().addScaledVector(side,distance)};return;
 }
 const aspect=Math.max(.1,canvasHost.clientWidth/Math.max(1,canvasHost.clientHeight)),half=THREE.MathUtils.degToRad(camera.fov/2),angle=Math.min(half,Math.atan(Math.tan(half)*aspect)),distance=Math.max(180,size.length()/2/Math.sin(angle)*1.1);transition={target,position:target.clone().add(new THREE.Vector3(0,1,.45).normalize().multiplyScalar(distance))};}
 const notices=missionNotams(scene,banner,network.origin,worldData,line,frameReview);
 const hazards=disasters(scene,canvasHost,network.origin,frameReview,worldData?.lines??[]);
 review=reviewNavigation(scene,canvasHost,droneBar,network,frameReview,()=>[...(canopy?.events()??[]),...(faults?.events()??[])],i=>[-1,0,1,2].every(j=>captured.has(`${i}:${j}`))&&(!network.splices.some(s=>s.fromTower===i)||captured.has(`${i}:3`)),id=>id.startsWith('EQUIP-')?faults?.select(id):canopy?.select(id),worldData?.fleet?.().find(v=>v.id===worldData.activeVehicle)?.route??[],i=>line.id===179559746||scannedSpans.has(i),()=>[...osmLayer.crossings(),...(worldData?.lines.filter(l=>l.id!==line.id).map(l=>({id:'OSM way/'+l.id,kind:'power',points:l.coords.map(p=>world!.project(p,0))}))??[])]);
 if(timeline){const rating=droneBar.querySelector('.line-rating');if(rating)timeline.ratingHost.append(rating);const navigation=droneBar.querySelector('.review-navigation') as HTMLElement|null;if(navigation)navigation.style.display='none';}

 const desiredGimbal=new THREE.PerspectiveCamera();
 function resetCapture(){extraCounts.clear();lastExtra=-Infinity;shotCount=0;lastShot=-Infinity;settled=0;activeKey='';locked=false;acquiredAt=0;cameraStage='SCANNING';lastCapture='None';shotLog.length=0;lastTower=-1;reacquiring=false;wideSettled=0;slewTime=0;zoomTime=0;focusTime=0;captured.clear();scannedSpans.clear();spanCoverage.clear();capturePass=1;}

 if(!worldData)scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(path.getPoints(600)),new THREE.LineBasicMaterial({color:0x68d5ed,transparent:true,opacity:.45})));
 const plane=new THREE.Group();const body=new THREE.Mesh(new THREE.ConeGeometry(1,8,8),new THREE.MeshStandardMaterial({color:0xf3f2df}));body.rotation.z=-Math.PI/2;plane.add(body);const wings=new THREE.Mesh(new THREE.BoxGeometry(1,.18,14),new THREE.MeshStandardMaterial({color:0xe7e8d2}));plane.add(wings);const tail=new THREE.Mesh(new THREE.BoxGeometry(1,.18,5),steel);tail.position.x=-3;plane.add(tail);scene.add(plane);
 const solar=new THREE.Mesh(new THREE.BoxGeometry(.85,.08,12),new THREE.MeshStandardMaterial({color:0x183d65,metalness:.4,roughness:.3}));solar.position.y=.16;plane.add(solar);
 const terminal=new THREE.Mesh(new THREE.BoxGeometry(.7,.12,.5),new THREE.MeshStandardMaterial({color:0xd9e1e3}));terminal.position.set(-2,.7,0);plane.add(terminal);
 const dockGroup=new THREE.Group();scene.add(dockGroup);const anchors:THREE.Mesh[]=[];let standOrigin:THREE.Vector3|undefined;
 if(world&&worldData?.activeVehicle){const v=worldData.fleet?.().find(v=>v.id===worldData.activeVehicle);if(v){const layout=taxiLayout(v.route),park=world.project(layout.park,.2);standOrigin=park.clone();
 const taxi=new THREE.Line(new THREE.BufferGeometry().setFromPoints(layout.points.map(p=>world.project(p,.3))),new THREE.LineBasicMaterial({color:0xe8ca73}));dockGroup.add(taxi);
 const pad=new THREE.Mesh(new THREE.BoxGeometry(26,.2,26),new THREE.MeshStandardMaterial({color:0x3f5057}));pad.position.copy(park);dockGroup.add(pad);
 for(const dx of [-7,7])for(const dz of [-7,7]){const bolt=new THREE.Mesh(new THREE.CylinderGeometry(.55,.55,1.6,8),new THREE.MeshStandardMaterial({color:0xe3ac67}));bolt.position.copy(park).add(new THREE.Vector3(dx,.8,dz));anchors.push(bolt);dockGroup.add(bolt);}
 const sign=document.createElement('canvas');sign.width=512;sign.height=64;const ctx=sign.getContext('2d')!;ctx.fillStyle='#b9ec8c';ctx.font='22px sans-serif';ctx.fillText('CONCEPT STAND · TAXI / ANCHOR / SOLAR',5,40);const label=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(sign),transparent:true}));label.position.copy(park).add(new THREE.Vector3(0,8,0));label.scale.set(55,7,1);dockGroup.add(label);
 }}

 if(worldData?.activeVehicle&&world){const v=worldData.fleet?.().find(v=>v.id===worldData.activeVehicle);if(v){for(const end of [0,v.route.length-1]){const a=world.project(v.route[end]),b=world.project(v.route[end===0?1:end-1]);const strip=new THREE.Mesh(new THREE.BoxGeometry(400,.2,25),new THREE.MeshStandardMaterial({color:0x535e63}));strip.position.copy(a).setY(.1);strip.rotation.y=-Math.atan2(b.z-a.z,b.x-a.x);scene.add(strip);}}}
 if(line.id!==179559746)faults=equipment(scene,canvasHost,network);
 if(line.id!==179559746)canopy=vegetation(scene,canvasHost,mapSurface,camera,network,id=>review?.openAsset(id));
 const initialVehicle=worldData?.fleet?.().find(v=>v.id===worldData.activeVehicle);
 if(initialVehicle&&!initialVehicle.returning&&initialVehicle.distanceKm>0){
 capturePass=initialVehicle.inspectionPass;
 const coords=network.towers.map(t=>[network.origin[0]+t.position[0]/(111320*Math.cos(network.origin[1]*Math.PI/180)),network.origin[1]-t.position[2]/111320]);
 const passages=assetPassages(initialVehicle.route,coords),seconds=initialVehicle.timeline.seconds;
 passages.forEach((km,i)=>{if(km+.02>=initialVehicle.distanceKm)return;const at=Math.max(0,seconds*km/initialVehicle.distanceKm-3);for(const phase of [-1,0,1,2]){captured.add(i+':'+phase);faults?.capture(i,phase,at);}
 if(i+1<passages.length&&Math.max(km,passages[i+1])+.02<initialVehicle.distanceKm){scannedSpans.add(i);captured.add(i+':3');faults?.capture(i,3,at);canopy?.backfill(i,Math.max(0,seconds*Math.max(km,passages[i+1])/initialVehicle.distanceKm-3));}});
 shotLog.unshift('Seeded prior-pass evidence · hypothetical history');
 }

 const flightTools=document.createElement('div');flightTools.className='flight-mode-tools';droneBar.append(flightTools);
 for(const selector of ['#camera-toggle','.mission-settings','.contingency-controls','.aircraft-details','#demo-return']){const control=host.querySelector(selector);if(control)flightTools.append(control);}
 droneBar.prepend(host.querySelector('#vehicle-picker')!);
 const layers=document.createElement('details');layers.className='operator-drawer';layers.innerHTML='<summary>Layers & findings</summary><div class="operator-drawer-content"></div>';banner.append(layers);
 banner.append(canvasHost.querySelector('.basemap-control')!);
 const osmTools=document.createElement('details');osmTools.className='operator-drawer';osmTools.innerHTML='<summary>OSM layers</summary><div class="operator-drawer-content"></div>';osmTools.querySelector('.operator-drawer-content')!.append(canvasHost.querySelector('.osm-context')!);banner.append(osmTools);
 for(const tool of Array.from(canvasHost.querySelectorAll('.equipment-panel,.vegetation-panel,.airspace-panel')))layers.querySelector('.operator-drawer-content')!.append(tool);
 const sensors=sensorOverlay(scene,plane,id=>canopy?.observe(id));
 const targetMarker=new THREE.Mesh(new THREE.SphereGeometry(1.2,12,8),new THREE.MeshBasicMaterial({color:0xffde7c,wireframe:true}));scene.add(targetMarker);
 const aim=new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(),new THREE.Vector3()]),new THREE.LineBasicMaterial({color:0xffd47b,transparent:true,opacity:.7}));scene.add(aim);
 (host.querySelector('#inspect-play') as HTMLButtonElement).onclick=()=>{if(progress>=pathLength){resetRoute();progress=0;elapsed=0;resetCapture();}running=!running;if(running)view('flight');(host.querySelector('#inspect-play') as HTMLElement).textContent=running?(returning?'Pause return':'Pause mission'):(returning?'Resume return':'Resume mission');};
 (host.querySelector('#inspect-speed') as HTMLInputElement).oninput=e=>{mph=Number((e.target as HTMLInputElement).value);host.querySelector('#mph')!.textContent=`${mph} mph`;};
 (host.querySelector('#inspect-rate') as HTMLSelectElement).onchange=e=>rate=Number((e.target as HTMLSelectElement).value);
 const acquisitionSelect=host.querySelector('#acquisition-mode') as HTMLSelectElement;acquisitionSelect.value=acquisitionMode;acquisitionSelect.onchange=()=>{acquisitionMode=acquisitionSelect.value;reacquiring=false;wideSettled=0;lastTower=-1;settled=0;};
 (host.querySelector('#inspect-phase') as HTMLSelectElement).onchange=e=>phase=(e.target as HTMLSelectElement).value;
 (host.querySelector('#auto-zoom') as HTMLInputElement).onchange=e=>autoZoom=(e.target as HTMLInputElement).checked;
 (host.querySelector('#inspect-fov') as HTMLInputElement).oninput=e=>{autoZoom=false;(host.querySelector('#auto-zoom') as HTMLInputElement).checked=false;zoom=Math.max(1,Math.min(40,Math.tan(Math.PI/6)*9/16/Math.tan(Number((e.target as HTMLInputElement).value)*Math.PI/360)));gimbal.fov=optics(1,zoom).vfov;gimbal.updateProjectionMatrix();};
 (host.querySelector('#inspect-reset') as HTMLButtonElement).onclick=()=>{resetRoute();progress=0;elapsed=0;resetCapture();running=true;view('flight');host.querySelector('#inspect-play')!.textContent='Pause mission';};
 if(worldData){
 const play=host.querySelector('#inspect-play') as HTMLButtonElement;play.textContent='Follow aircraft';play.onclick=()=>{const id=worldData.activeVehicle||worldData.fleet?.().find(v=>v.stage==='Inspecting')?.id;if(id){if(id===worldData.activeVehicle){followedVehicle=id;startTracking();}else worldData.selectVehicle?.(id);}};
 (host.querySelector('#demo-return') as HTMLElement).hidden=true;
 (host.querySelector('#world-follow') as HTMLElement).hidden=true;
 (host.querySelector('#inspect-reset') as HTMLButtonElement).textContent='Replay selected from launch';
 (host.querySelector('#inspect-reset') as HTMLButtonElement).onclick=()=>{if(worldData.activeVehicle){worldData.seek?.(worldData.activeVehicle,0);resetCapture();followedVehicle=worldData.activeVehicle;startTracking();}};
 (host.querySelector('#inspect-speed')!.closest('label') as HTMLElement).hidden=true;
 const speed=host.querySelector('#inspect-rate') as HTMLSelectElement;(speed.closest('label') as HTMLElement).hidden=true;speed.innerHTML='<option value="1">1×</option><option value="2">2×</option><option value="5">5×</option><option value="10">10×</option><option value="60">60×</option><option value="600">600×</option>';speed.value=String(worldData.fleetState?.().rate||5);speed.onchange=()=>worldData.setFleetRate?.(Number(speed.value));
 }
 let lastVehicleDistance=-1;
 const clock=new THREE.Clock();let frame=0,lastText=0;
 function tick(){if(disposed)return;frame=requestAnimationFrame(tick);const dt=Math.min(clock.getDelta(),.1);if(running){elapsed+=dt*rate;}if(running&&!worldData){progress=Math.min(pathLength,progress+dt*rate*mph*.44704);if(progress===pathLength){running=false;host.querySelector('#inspect-play')!.textContent='Landed · restart';}}
 (host.querySelector('#demo-return') as HTMLButtonElement).disabled=returning||progress<=0||progress>=pathLength;
 const vehicle=worldData?.fleet?.().find(v=>v.id===worldData.activeVehicle);
 if(vehicle){mph=vehicle.speedMph;if(vehicle.distanceKm<lastVehicleDistance){resetCapture();sensors.clear();}lastVehicleDistance=vehicle.distanceKm;}
 if(worldData){(host.querySelector('#inspect-rate') as HTMLSelectElement).value=String(worldData.fleetState?.().rate||5);running=!!vehicle&&!vehicle.ready&&!!worldData.fleetState?.().running;rate=worldData.fleetState?.().rate||5;returning=vehicle?.returning||false;}
 const t=progress/pathLength,p=vehicle&&world?world.project(vehicle.coord,vehicle.altitude):path.getPointAt(t),tangent=vehicle&&world?world.project(vehicle.headingCoord,vehicle.altitude).sub(p).normalize():path.getTangentAt(t);
 plane.visible=!worldData||!!vehicle;
 if(vehicle&&world&&standOrigin&&vehicle.returning){dockGroup.position.copy(world.project(taxiLayout(vehicle.route).park,.2)).sub(standOrigin);}
 for(const bolt of anchors){(bolt.material as THREE.MeshStandardMaterial).color.set(vehicle?.timeline.secured?0x91e6a5:0xe3ac67);bolt.scale.y=vehicle?.timeline.secured?.3:vehicle?.stage==='Securing anchors'?Math.max(.3,1-(vehicle.timeline.groundSeconds-240)/90):1;}

p.y=Math.max(1.5,p.y);plane.position.copy(p);const bank=THREE.MathUtils.lerp(plane.rotation.x,vehicle?.bank||0,Math.min(1,dt*3));plane.rotation.set(bank,-Math.atan2(tangent.z,tangent.x),Math.asin(tangent.y));
 if(vehicle?.inspectionPass&&vehicle.inspectionPass!==capturePass){captured.clear();activeKey='';locked=false;capturePass=vehicle.inspectionPass;}
 if(running&&p.y>5&&(!vehicle||(vehicle.stage==='Inspecting'&&!vehicle.turning))&&(host.querySelector('#show-lidar') as HTMLInputElement).checked){for(let i=0;i<network.towers.length-1;i++){
 const a=new THREE.Vector3(...network.towers[i].position),b=new THREE.Vector3(...network.towers[i+1].position),d=b.clone().sub(a);d.y=0;const length=d.length(),q=p.clone().sub(a);q.y=0;const along=q.dot(d)/(length||1),lateral=q.clone().addScaledVector(d,-along/(length||1)).length();
 const time=vehicle?.timeline.seconds??elapsed;spanCoverage.observe(i,along,length,lateral,time);if(spanCoverage.complete(i,time))scannedSpans.add(i);
 }}
 const flightStage=vehicle?(vehicle.stage==='Inspecting'?(vehicle.turning?'TURNING · CAPTURE PAUSED':'INSPECTING'):vehicle.stage.toUpperCase()):returning?(pathLength-progress<250?'LANDING AT LAUNCH':'RETURNING TO LAUNCH'):progress<250?'LAUNCH':progress<900?'CLIMB':pathLength-progress<250?'LANDING ROLL':pathLength-progress<900?'APPROACH':'INSPECTING';
 // Pre-position on known forward assets even outside exposure range or during turns.
 const aimingAllowed=flightStage==='INSPECTING'||(acquisitionMode==='known'&&flightStage==='TURNING · CAPTURE PAUSED');
 let idx=-1,best=Infinity,attachmentIndex=-1;
 if(aimingAllowed)network.towers.forEach((tower,i)=>{
 // A full-height profile always precedes the selected phase close-ups.
 const sequence=[-1,...(phase==='auto'?[0,1,2]:[['A','B','C'].indexOf(phase)])];
 const j=sequence.find(j=>!captured.has(`${i}:${j}`));if(j===undefined)return;
 const position=j===-1?new THREE.Vector3(tower.position[0],tower.height/2,tower.position[2]):new THREE.Vector3(...tower.attachments[j].position);
 const delta=position.sub(p),distance=delta.length(),key=`${i}:${j}`;
 if(canPreposition(delta.dot(tangent),distance,acquisitionMode)&&(key===activeKey||distance<best)){
 if(idx>=0&&`${idx}:${attachmentIndex}`===activeKey)return;
 best=distance;idx=i;attachmentIndex=j;
 }
 });
 if(aimingAllowed&&phase==='auto')for(const splice of network.splices){const i=splice.fromTower,key=`${i}:3`;if(captured.has(key))continue;const delta=new THREE.Vector3(...splice.position).sub(p),distance=delta.length();if(canPreposition(delta.dot(tangent),distance,acquisitionMode)&&(key===activeKey||distance<best)&&`${idx}:${attachmentIndex}`!==activeKey){idx=i;attachmentIndex=3;best=distance;}}
 let supplemental=false;
 const requiredSlack=idx>=0?Math.max(0,(best-650)/Math.max(1,mph*.44704)):60;
 if(running&&flightStage==='INSPECTING'&&requiredSlack>14&&elapsed-lastExtra>=10){
  const direction=gimbal.getWorldDirection(new THREE.Vector3()),flagged=new Set((faults?.events()??[]).map(e=>Number(e.id.slice(6))));let score=-Infinity;
  network.towers.forEach((tower,i)=>{for(const j of [-1,0,1,2]){const key=`${i}:${j}`,at=j<0?new THREE.Vector3(tower.position[0],tower.height/2,tower.position[2]):new THREE.Vector3(...tower.attachments[j].position),delta=at.sub(p),range=delta.length(),angle=THREE.MathUtils.radToDeg(direction.angleTo(delta));
   const priority=extraCapturePriority({requiredCaptured:captured.has(key),extras:extraCounts.get(key)??0,flagged:flagged.has(i),forward:delta.dot(tangent),angle,range,slack:requiredSlack});
   const stablePriority=priority+(key===activeKey?20:0);if(stablePriority>score){score=stablePriority;idx=i;attachmentIndex=j;best=range;supplemental=true;}
  }});
 }
 const spliceTarget=attachmentIndex===3?network.splices.find(s=>s.fromTower===idx):undefined;
 const hasTarget=idx>=0,key=hasTarget?`${idx}:${attachmentIndex}`:'';
 if(key!==activeKey){if(activeKey&&!captured.has(activeKey))shotLog.unshift('Skipped '+activeKey+' · passed before ready');activeKey=key;settled=0;locked=false;acquiredAt=elapsed;slewSpeed=0;transitionStart.copy(gimbal.quaternion);slewTime=0;zoomTime=0;focusTime=0;}
 if(hasTarget&&idx!==lastTower){lastTower=idx;reacquiring=acquisitionMode==='wide';wideSettled=0;}
 if(!hasTarget&&acquisitionMode==='wide')reacquiring=false;
 const profile=hasTarget&&attachmentIndex===-1;
 const shotLabel=hasTarget?(spliceTarget?'CONDUCTOR SPLICE':profile?'FULL STRUCTURE PROFILE':`PHASE ${network.towers[idx].attachments[attachmentIndex].phase}`):'FORWARD SCAN';
 const target=hasTarget?(spliceTarget?new THREE.Vector3(...spliceTarget.position):profile?new THREE.Vector3(network.towers[idx].position[0],network.towers[idx].height/2,network.towers[idx].position[2]):new THREE.Vector3(...network.towers[idx].attachments[attachmentIndex].position)):p.clone().addScaledVector(acquisitionMode==='known'?gimbal.getWorldDirection(new THREE.Vector3()):tangent,300);
 if(hasTarget)inspector.follow(idx);
 targetMarker.position.copy(target);
 if(followFlight)track(p,dt);
 if(transition){camera.position.lerp(transition.position,.09);controls.target.lerp(transition.target,.09);if(camera.position.distanceTo(transition.position)<1)transition=undefined;}
 if(followedVehicle&&world&&worldData){const vehicle=worldData.fleet?.().find(v=>v.id===followedVehicle);if(vehicle){const vp=world.project(vehicle.coord,vehicle.altitude);track(vp,dt);}}
 camera.near=Math.max(.1,camera.position.distanceTo(controls.target)/100000);controls.update();world?.update(camera);baseLayer.update(camera,controls.target);osmLayer.update(controls.target);
 const simDt=running?dt*rate:0;
 // Rate-limited optics: overview frames the entire structure with margin, then zooms into attachments.
 const frameHalfHeight=profile?Math.max(network.towers[idx].height*.7,18):4;
 const range=p.distanceTo(target);
 const desiredZoom=reacquiring?1:hasTarget?Math.max(1,Math.min(40,Math.tan(Math.PI/6)*range*9/16/frameHalfHeight)):(acquisitionMode==='known'?zoom:1);
 const beforeZoom=zoom;if(autoZoom||profile||reacquiring)zoom=approachZoom(zoom,desiredZoom,simDt);
 const sampling=optics(range,zoom);if(autoZoom||profile||reacquiring)gimbal.fov=sampling.vfov;
 const zooming=Math.abs(Math.log(desiredZoom/zoom))>.02;
 if(hasTarget&&Math.abs(beforeZoom-zoom)>.001)zoomTime+=simDt;
 gimbal.position.copy(p).add(new THREE.Vector3(0,-1,0));
 desiredGimbal.position.copy(gimbal.position);desiredGimbal.lookAt(target);
 const error=THREE.MathUtils.radToDeg(gimbal.quaternion.angleTo(desiredGimbal.quaternion));
 const desiredSpeed=Math.min(cameraProfile.slewDegPerSecond,Math.sqrt(2*cameraProfile.accelDegPerSecond2*error));
 slewSpeed+=THREE.MathUtils.clamp(desiredSpeed-slewSpeed,-cameraProfile.accelDegPerSecond2*simDt,cameraProfile.accelDegPerSecond2*simDt);
 const transitionSeconds=cameraProfile.retargetSeconds;const blend=THREE.MathUtils.clamp((elapsed-acquiredAt)/transitionSeconds,0,1);const eased=blend*blend*(3-2*blend);const commanded=transitionStart.clone().slerp(desiredGimbal.quaternion,eased);gimbal.quaternion.rotateTowards(commanded,THREE.MathUtils.degToRad(slewSpeed)*simDt);
 const residual=THREE.MathUtils.radToDeg(gimbal.quaternion.angleTo(desiredGimbal.quaternion));
 if(reacquiring){wideSettled=zoom<1.03&&residual<1?wideSettled+simDt:0;if(wideSettled>=1){reacquiring=false;settled=0;}}
 const tolerance=Math.min(.5,sampling.hfov*.02),aligned=!reacquiring&&residual<tolerance&&(!autoZoom||!zooming);
 if(hasTarget&&residual>=tolerance)slewTime+=simDt;
 const repositioned=elapsed-acquiredAt>=cameraProfile.retargetSeconds;
 settled=hasTarget&&aligned&&repositioned?settled+simDt:0;focusTime=settled;locked=hasTarget&&settled>=cameraProfile.focusSeconds;
 const detailOK=profile||sampling.pixels>=cameraProfile.minTargetPixels;
 const exposureAllowed=flightStage==='INSPECTING'&&range<650;
 if(vehicle&&running&&flightStage==='INSPECTING'&&!supplemental){
 const remainingShots=profile?4:attachmentIndex>=0&&attachmentIndex<3?3-attachmentIndex:1;
 const secondsNeeded=Math.max(0,cameraProfile.retargetSeconds-(elapsed-acquiredAt))+Math.max(0,cameraProfile.focusSeconds-settled)+(remainingShots-1)*(cameraProfile.retargetSeconds+cameraProfile.focusSeconds+2)+2;
 worldData?.capturePace?.(vehicle.id,hasTarget?catchupSpeed(vehicle.plannedMph,target.clone().sub(p).dot(tangent),secondsNeeded):40);
 }

 cameraStage=hasTarget&&!exposureAllowed?'PREPOSITION · NEXT ASSET':!hasTarget?(acquisitionMode==='known'?'HOLD ZOOM · AWAIT NEXT COORDINATE':'WIDE SCAN'):reacquiring?'WIDE REACQUISITION':!repositioned||!aligned?'SLEW / ZOOM':!locked?'FOCUS / SETTLE':!detailOK?'INSUFFICIENT PIXELS':'EXPOSURE READY';
 if(running&&!supplemental&&exposureAllowed&&locked&&detailOK&&elapsed-lastShot>=4){captured.add(activeKey);if(vehicle)faults?.capture(idx,attachmentIndex,vehicle.timeline.seconds);shotCount++;lastShot=elapsed;lastCapture=`Tower ${idx+1} · ${shotLabel} · ${(elapsed-acquiredAt).toFixed(1)}s acquisition`;shotLog.unshift(`${lastCapture} (slew ${slewTime.toFixed(1)}s / zoom ${zoomTime.toFixed(1)}s / focus ${focusTime.toFixed(1)}s)`);settled=0;cameraStage='CAPTURED';}
 const opportunistic=supplemental&&requiredSlack>6&&elapsed-lastExtra>=10&&elapsed-lastShot>=4;
 const distant=canSupplementalShot({locked,inspecting:flightStage==='INSPECTING',range,forwardMeters:target.clone().sub(p).dot(tangent),speedMps:mph*.44704,secondsSinceShot:elapsed-lastShot,secondsSinceExtra:elapsed-lastExtra});
 if(running&&hasTarget&&locked&&(opportunistic||distant)&&(extraCounts.get(activeKey)??0)<2){extraCounts.set(activeKey,(extraCounts.get(activeKey)??0)+1);shotCount++;lastExtra=lastShot=elapsed;cameraStage='EXTRA CAPTURE';lastCapture=`Extra · T${idx+1} ${shotLabel} · ${Math.round(range)} m · ${Math.round(sampling.pixels)} px/detail · supplemental`;shotLog.unshift(lastCapture);}
 const nextCoverage=`${capturePass}:${captured.size}:${shotCount}`;
 if(nextCoverage!==coverageSignature){coverageSignature=nextCoverage;scene.traverse(o=>{const tower=o.userData.equipmentTower,phase=o.userData.equipmentPhase;if(!Number.isInteger(tower)||!Number.isInteger(phase))return;const key=`${tower}:${phase}`,extras=extraCounts.get(key)??0;o.userData.inspectionSummary=`Inspection index ${inspectionIndex(captured.has(key),extras)}/100 · required ${captured.has(key)?'captured':'pending'} · ${extras} supplemental frames · simulated coverage only`;});}
 host.querySelector('.gimbal-caption')!.textContent=`${acquisitionMode==='known'?'KNOWN COORDINATES':'WIDE ACQUISITION'} · ${shotLabel} · ${cameraStage} · ${(hasTarget?elapsed-acquiredAt:0).toFixed(1)}s elapsed
Slew ${slewTime.toFixed(1)}s · Zoom ${zoomTime.toFixed(1)}s · Focus ${focusTime.toFixed(1)} / ${cameraProfile.focusSeconds}s
${zoom.toFixed(1)}× optical · ${sampling.hfov.toFixed(1)}° HFOV · ${Math.round(range)} m · ${sampling.cmPerPixel.toFixed(1)} cm/px · 0.5 m detail ≈ ${Math.round(sampling.pixels)} px
${shotLog[0]||'Awaiting capture'}
Asset inspection index ${hasTarget?inspectionIndex(captured.has(activeKey),extraCounts.get(activeKey)??0):0}/100 · simulated coverage
Speed ${vehicle?.speedMph.toFixed(0)??mph} mph · planned ${vehicle?.plannedMph.toFixed(0)??mph} mph · ${vehicle?.captureLimited?'camera catch-up':'spacing-based pace'}
EO profile provisional · timing assumptions · simulation seconds (${rate}×)`;
 shotLog.splice(20);
 const history=host.querySelector('#camera-history')!;const historyText=shotLog.join('\n');if(history.textContent!==historyText)history.textContent=historyText;
 const attribute=aim.geometry.getAttribute('position') as THREE.BufferAttribute;attribute.setXYZ(0,p.x,p.y,p.z);attribute.setXYZ(1,target.x,target.y,target.z);attribute.needsUpdate=true;aim.geometry.computeBoundingSphere();
 gimbal.aspect=16/9;gimbal.updateProjectionMatrix();scene.updateMatrixWorld(true);
 shield.update(p,!!vehicle?.turning,!!vehicle&&!vehicle.done,performance.now());
 recordedLidar?.update(worldData?.fleet?.().find(v=>v.osmWay===179559746));
 notices.update();traffic.update(performance.now(),vehicle?p:undefined);contingency?.update(dt);
 faults?.update(vehicle?.timeline.seconds??0,performance.now());
 canopy?.update(vehicle,p,tangent,performance.now());
 sensors.update(gimbal,p,tangent,range,plane.visible&&p.y>5,running&&flightStage==='INSPECTING',elapsed,(host.querySelector('#show-camera-fov') as HTMLInputElement).checked,(host.querySelector('#show-lidar') as HTMLInputElement).checked);
 const lidar=sensors.density();host.querySelector('#lidar-density')!.textContent=` Modeled: ${lidar.density.toFixed(1)} pts/m² · ${Math.round(lidar.requiredRate).toLocaleString()} pulses/s required · preview max 3,000.`;
 const w=canvasHost.clientWidth,h=canvasHost.clientHeight,split=cameraOpen&&running&&!returning&&!vehicle?.done,mapWidth=split?Math.floor(w/2):w;canvasHost.classList.toggle('camera-split',split);mapSurface.style.width=mapWidth+'px';canvasHost.style.setProperty('--map-width',mapWidth+'px');renderer.setSize(w,h,false);camera.aspect=mapWidth/h;camera.updateProjectionMatrix();camera.updateMatrixWorld();panel?.update(camera,performance.now());renderer.setScissorTest(false);renderer.setViewport(0,0,w,h);renderer.clear();renderer.setViewport(0,0,mapWidth,h);renderer.render(scene,camera);timeline?.update(performance.now());review?.update(camera,performance.now());
 canvasHost.classList.toggle('mission-idle',!split);targetMarker.visible=running&&hasTarget;aim.visible=running&&hasTarget;
 if(split){const pane=w-mapWidth,iw=Math.min(pane,Math.max(1,h)*16/9),ih=iw*9/16,ix=mapWidth+(pane-iw)/2,iy=(h-ih)/2;gimbal.aspect=16/9;gimbal.updateProjectionMatrix();renderer.setScissorTest(true);renderer.setScissor(ix,iy,iw,ih);renderer.setViewport(ix,iy,iw,ih);renderer.clear();renderer.render(scene,gimbal);renderer.setScissorTest(false);}

 if(elapsed-lastText>.15||!running){lastText=elapsed;host.querySelector('#inspect-readout')!.textContent=running?` ${flightStage} · ${hasTarget?`Tower ${idx+1} · ${cameraStage}`:'Forward scan'} · ${shotCount} shots · ${mph.toFixed(0)} mph${vehicle?.capturePassRequired?' · additional pass needed':vehicle?.captureLimited?' · camera catch-up':''} · ${Math.round((vehicle?.progress??progress/pathLength)*100)}% · ${rate}×`:vehicle?(vehicle.done?`${vehicle.stage} · ${vehicle.timeline.battery.toFixed(0)}% battery · ${vehicle.timeline.uploadedGB.toFixed(1)} GB uploaded`:`${vehicle.replaying?'HISTORY':'LIVE'} · ${vehicle.stage} · simulation paused`):progress>=pathLength?(returning?'LANDED AT LAUNCH · Return complete':'LANDED · Mission complete'):progress?'MISSION PAUSED · Camera preview off':'Fleet telemetry · simulated positions · click an aircraft';}
 }
 view('ohio');if(transition){camera.position.copy(transition.position);controls.target.copy(transition.target);transition=undefined;}
 if(worldData?.activeVehicle)fitMission();
 tick();return {pack:network.pack,view,dispose(){disposed=true;cancelAnimationFrame(frame);hazards.dispose();notices.dispose();shield.dispose();review?.dispose();contingency?.dispose();traffic.dispose();faults?.dispose();canopy?.dispose();timeline?.dispose();panel?.dispose();baseLayer.dispose();osmLayer.dispose();controls.dispose();scene.traverse(obj=>{const o=obj as THREE.Mesh;if(o.geometry)o.geometry.dispose();if(o.material){for(const m of Array.isArray(o.material)?o.material:[o.material])m.dispose();}});renderer.dispose();host.innerHTML='';}};
}
