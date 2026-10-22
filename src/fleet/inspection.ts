import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {addWorld,type WorldData} from './world';
import {basemap} from './basemap';
import {fleetPanel} from './fleet-panel';
import {dataPanel} from './mission-data';
import {generateUN,type V3} from './un';
import type {PowerLine} from './model';
export function inspection(host:HTMLElement,line:PowerLine,worldData?:WorldData){
 const network=generateUN(line);let mph=40,rate=1,running=false,autoZoom=true,phase='auto',progress=0,elapsed=0,disposed=false,followFlight=false;
 host.innerHTML=`<div class="inspection-head"><strong>Ohio operations <small>Simulated live environment</small></strong><span class="badge">SYNTHETIC STRUCTURES / NO LIVE CAMERA</span></div><div class="inspection-tools"><button id="inspect-play" class="primary">Inspection demo</button><button id="demo-return" disabled>Return demo to launch</button><button id="world-ohio">State</button><button id="world-follow">Follow demo</button><button id="world-unfollow" hidden>Stop following</button><details class="mission-settings"><summary>Mission settings</summary><div class="settings-content"><button id="world-corridor">Fit corridor</button><label>Airspeed <input id="inspect-speed" type="range" min="25" max="50" value="40"> <span id="mph">40 mph</span></label><label>Playback <select id="inspect-rate"><option value="1" selected>1×</option><option value="5">5×</option><option value="10">10×</option></select></label><label>Phase target <select id="inspect-phase"><option value="auto">Overview → A → B → C</option>A</option><option>B</option><option>C</option></select></label><label><input id="auto-zoom" type="checkbox" checked> Auto attachment zoom</label><label>Gimbal FOV <input id="inspect-fov" type="range" min="4" max="55" value="14"></label><button id="inspect-reset">Restart pass</button><button id="un-export">Export UN geometry</button></div></details></div><div class="inspection-canvas"><div class="gimbal-caption">GIMBAL · forward acquisition · simulated zoom</div><div class="crosshair">＋</div><div id="inspect-readout"></div></div><p class="note">OSM alignment with synthetic supports at major bends / nominal 450 m (1,476 ft) spans. Three phases, sagging spans, 60 m lateral offset, 85 m local flight height. Drag to orbit · scroll to zoom · right-drag to pan. Illustrative launch / climb / approach / landing. Forward-only overview then phase captures; minimum 2 s reposition, 1.5 s focus/settle, 4 s between shots. Illustrative 15°/s slew and 4°/s zoom-FOV limits. No terrain, runway, flight-dynamics or calibrated gimbal validation.</p>`;
 const dock=document.createElement("div");dock.className="data-dock";host.append(dock);const inspector=dataPanel(dock,line);
 const canvasHost=host.querySelector('.inspection-canvas') as HTMLElement;
 function download(){const a=document.createElement('a'),url=URL.createObjectURL(new Blob([JSON.stringify(network.pack,null,2)],{type:'application/json'}));a.href=url;a.download=`osm-${line.id}-synthetic-un.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
 (host.querySelector('#un-export') as HTMLButtonElement).onclick=download;
 let renderer:THREE.WebGLRenderer;
 try{renderer=new THREE.WebGLRenderer({antialias:true,logarithmicDepthBuffer:true});}catch{canvasHost.innerHTML='<p>WebGL is unavailable. The Ohio map and UN export remain available.</p>';return {dispose(){},pack:network.pack};}
 renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.setClearColor(0x102330);renderer.autoClear=false;canvasHost.prepend(renderer.domElement);
 const scene=new THREE.Scene();scene.add(new THREE.HemisphereLight(0xc9eaff,0x152922,2));const sun=new THREE.DirectionalLight(0xffedcd,2);sun.position.set(300,800,400);scene.add(sun);
 const camera=new THREE.PerspectiveCamera(55,1,1,2000000),gimbal=new THREE.PerspectiveCamera(14,1,.1,12000);
 const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.minDistance=5;controls.maxDistance=900000;controls.maxPolarAngle=Math.PI*.495;controls.zoomSpeed=1.7;

 let followedVehicle:string|null=null;
 const followAnchor=new THREE.Vector3();let anchorReady=false,acquiring=false;
 const followOffset=new THREE.Vector3(0,100,180);
 function startTracking(){anchorReady=false;acquiring=true;(host.querySelector('#world-unfollow') as HTMLButtonElement).hidden=false;}
 function stopTracking(){followFlight=false;followedVehicle=null;anchorReady=false;acquiring=false;(host.querySelector('#world-unfollow') as HTMLButtonElement).hidden=true;}
 (host.querySelector('#world-unfollow') as HTMLButtonElement).onclick=stopTracking;
 // OrbitControls owns the user's chosen angle and distance; input cancels only the initial approach.
 controls.addEventListener('start',()=>{acquiring=false;});
 function track(position:THREE.Vector3,dt:number){
 if(anchorReady){const delta=position.clone().sub(followAnchor);camera.position.add(delta);controls.target.add(delta);}
 followAnchor.copy(position);anchorReady=true;
 if(acquiring){const alpha=1-Math.exp(-dt*4);camera.position.lerp(position.clone().add(followOffset),alpha);controls.target.lerp(position,alpha);if(camera.position.distanceTo(position.clone().add(followOffset))<1)acquiring=false;}
 }

 const world=worldData?addWorld(scene,network.origin,worldData):undefined;
 let transition:{position:THREE.Vector3;target:THREE.Vector3}|undefined;
 controls.addEventListener('start',()=>transition=undefined);
 function view(mode:string){followedVehicle=null;followFlight=mode==='flight';if(mode==='flight'){transition=undefined;startTracking();return;}stopTracking();const target=mode==='ohio'&&world?world.center:new THREE.Box3().setFromPoints(network.locations.map(p=>new THREE.Vector3(...p))).getCenter(new THREE.Vector3());const extent=mode==='ohio'?480000:Math.max(800,new THREE.Box3().setFromPoints(network.locations.map(p=>new THREE.Vector3(...p))).getSize(new THREE.Vector3()).length());transition={target,position:target.clone().add(new THREE.Vector3(0,extent,extent*.55))};}
 (host.querySelector('#world-ohio') as HTMLButtonElement).onclick=()=>view('ohio');(host.querySelector('#world-corridor') as HTMLButtonElement).onclick=()=>view('corridor');(host.querySelector('#world-follow') as HTMLButtonElement).onclick=()=>view('flight');
 const selectedRoute=new THREE.Line(new THREE.BufferGeometry(),new THREE.LineBasicMaterial({color:0x9df3cf,depthTest:false}));scene.add(selectedRoute);
 const panel=world&&worldData?fleetPanel(canvasHost,worldData,world.project,id=>{followedVehicle=id;followFlight=false;transition=undefined;if(id)startTracking();else stopTracking();},points=>{selectedRoute.geometry.dispose();selectedRoute.geometry=new THREE.BufferGeometry().setFromPoints(points.map(p=>world.project(p,110)));}):undefined;
 const steel=new THREE.MeshStandardMaterial({color:0x9eafb7,metalness:.5,roughness:.55});const black=new THREE.MeshStandardMaterial({color:0x112b34});
 function beam(a:V3,b:V3,width=.35,mat=steel){const av=new THREE.Vector3(...a),bv=new THREE.Vector3(...b),mesh=new THREE.Mesh(new THREE.CylinderGeometry(width,width,av.distanceTo(bv),5),mat);mesh.position.copy(av).add(bv).multiplyScalar(.5);mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),bv.sub(av).normalize());scene.add(mesh);return mesh;}
 for(const t of network.towers){const [x,,z]=t.position,h=t.height;for(const dx of [-1,1])for(const dz of [-1,1])beam([x+dx*5,0,z+dz*5],[x+dx*1.3,h,z+dz*1.3]);
 for(let y=0;y<h-6;y+=7){const w=5-3.7*y/h,w2=5-3.7*(y+7)/h;for(const sign of [-1,1]){beam([x-w,y,z+sign*w],[x+w2,y+7,z+sign*w2],.14);beam([x+w,y,z+sign*w],[x-w2,y+7,z+sign*w2],.14);beam([x+sign*w,y,z-w],[x+sign*w2,y+7,z+w2],.14);}}
 const a=t.attachments[0].position,c=t.attachments[2].position;beam([a[0],h,a[2]],[c[0],h,c[2]],.45);
 for(const a of t.attachments){const p=a.position;beam([p[0],h,p[2]],p,.45,black);for(let k=0;k<6;k++){const ins=new THREE.Mesh(new THREE.CylinderGeometry(.8,.8,.22,10),new THREE.MeshStandardMaterial({color:0xb8d9ce}));ins.position.set(p[0],p[1]+.4+k*.4,p[2]);scene.add(ins);}const marker=new THREE.Mesh(new THREE.SphereGeometry(.6,8,6),new THREE.MeshBasicMaterial({color:a.phase==='A'?0xffb563:a.phase==='B'?0x8be0fa:0xcb9dff}));marker.position.set(...p);scene.add(marker);}
 }
 for(const s of network.spans){const geometry=new THREE.BufferGeometry().setFromPoints(s.points.map(p=>new THREE.Vector3(...p)));scene.add(new THREE.Line(geometry,new THREE.LineBasicMaterial({color:s.phase==='A'?0xd4af76:s.phase==='B'?0x8eafb8:0xb1a0c5})));}
 const bound=new THREE.Box3().setFromPoints(network.locations.map(p=>new THREE.Vector3(...p)));const center=bound.getCenter(new THREE.Vector3());const ground=new THREE.Mesh(new THREE.PlaneGeometry(2000000,2000000),new THREE.MeshStandardMaterial({color:0x213d38,roughness:1}));ground.renderOrder=-20;ground.rotation.x=-Math.PI/2;ground.position.set(center.x,-.2,center.z);scene.add(ground);
 const baseLayer=basemap(scene,canvasHost,network.origin);
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
 for(const [a,b] of [[launch,first.clone().addScaledVector(outbound,-650).setY(1.5)],[last.clone().addScaledVector(inbound,650).setY(1.5),land]]){const runway=new THREE.Mesh(new THREE.BoxGeometry(a.distanceTo(b)+80,.3,25),new THREE.MeshStandardMaterial({color:0x626c70}));runway.position.copy(a).add(b).multiplyScalar(.5).setY(.1);runway.rotation.y=-Math.atan2(b.z-a.z,b.x-a.x);scene.add(runway);}
 let shotCount=0,lastShot=-Infinity,settled=0,activeKey='',locked=false,acquiredAt=0;
 let cameraStage='SCANNING',lastCapture='None';
 const captured=new Set<string>();
 const desiredGimbal=new THREE.PerspectiveCamera();
 function resetCapture(){shotCount=0;lastShot=-Infinity;settled=0;activeKey='';locked=false;acquiredAt=0;cameraStage='SCANNING';lastCapture='None';captured.clear();}

 scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(path.getPoints(600)),new THREE.LineBasicMaterial({color:0x68d5ed,transparent:true,opacity:.45})));
 const plane=new THREE.Group();const body=new THREE.Mesh(new THREE.ConeGeometry(1,8,8),new THREE.MeshStandardMaterial({color:0xf3f2df}));body.rotation.z=-Math.PI/2;plane.add(body);const wings=new THREE.Mesh(new THREE.BoxGeometry(1,.18,14),new THREE.MeshStandardMaterial({color:0xe7e8d2}));plane.add(wings);const tail=new THREE.Mesh(new THREE.BoxGeometry(1,.18,5),steel);tail.position.x=-3;plane.add(tail);scene.add(plane);
 const targetMarker=new THREE.Mesh(new THREE.SphereGeometry(1.2,12,8),new THREE.MeshBasicMaterial({color:0xffde7c,wireframe:true}));scene.add(targetMarker);
 const aim=new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(),new THREE.Vector3()]),new THREE.LineBasicMaterial({color:0xffd47b,transparent:true,opacity:.7}));scene.add(aim);
 (host.querySelector('#inspect-play') as HTMLButtonElement).onclick=()=>{if(progress>=pathLength){resetRoute();progress=0;elapsed=0;resetCapture();}running=!running;if(running)view('flight');(host.querySelector('#inspect-play') as HTMLElement).textContent=running?(returning?'Pause return':'Pause mission'):(returning?'Resume return':'Resume mission');};
 (host.querySelector('#inspect-speed') as HTMLInputElement).oninput=e=>{mph=Number((e.target as HTMLInputElement).value);host.querySelector('#mph')!.textContent=`${mph} mph`;};
 (host.querySelector('#inspect-rate') as HTMLSelectElement).onchange=e=>rate=Number((e.target as HTMLSelectElement).value);
 (host.querySelector('#inspect-phase') as HTMLSelectElement).onchange=e=>phase=(e.target as HTMLSelectElement).value;
 (host.querySelector('#auto-zoom') as HTMLInputElement).onchange=e=>autoZoom=(e.target as HTMLInputElement).checked;
 (host.querySelector('#inspect-fov') as HTMLInputElement).oninput=e=>{autoZoom=false;(host.querySelector('#auto-zoom') as HTMLInputElement).checked=false;gimbal.fov=Number((e.target as HTMLInputElement).value);gimbal.updateProjectionMatrix();};
 (host.querySelector('#inspect-reset') as HTMLButtonElement).onclick=()=>{resetRoute();progress=0;elapsed=0;resetCapture();running=true;view('flight');host.querySelector('#inspect-play')!.textContent='Pause mission';};
 const clock=new THREE.Clock();let frame=0,lastText=0;
 function tick(){if(disposed)return;frame=requestAnimationFrame(tick);const dt=Math.min(clock.getDelta(),.1);if(running){elapsed+=dt*rate;progress=Math.min(pathLength,progress+dt*rate*mph*.44704);if(progress===pathLength){running=false;host.querySelector('#inspect-play')!.textContent='Landed · restart';}}
 (host.querySelector('#demo-return') as HTMLButtonElement).disabled=returning||progress<=0||progress>=pathLength;
 const t=progress/pathLength,p=path.getPointAt(t),tangent=path.getTangentAt(t);p.y=Math.max(1.5,p.y);plane.position.copy(p);plane.rotation.set(0,-Math.atan2(tangent.z,tangent.x),Math.asin(tangent.y));
 const flightStage=returning?(pathLength-progress<250?'LANDING AT LAUNCH':'RETURNING TO LAUNCH'):progress<250?'LAUNCH':progress<900?'CLIMB':pathLength-progress<250?'LANDING ROLL':pathLength-progress<900?'APPROACH':'INSPECTING';
 // Acquire only uncaptured attachments in the forward hemisphere, in closest-first order.
 let idx=-1,best=Infinity,attachmentIndex=-1;
 if(flightStage==='INSPECTING')network.towers.forEach((tower,i)=>{
 // A full-height profile always precedes the selected phase close-ups.
 const sequence=[-1,...(phase==='auto'?[0,1,2]:[['A','B','C'].indexOf(phase)])];
 const j=sequence.find(j=>!captured.has(`${i}:${j}`));if(j===undefined)return;
 const position=j===-1?new THREE.Vector3(tower.position[0],tower.height/2,tower.position[2]):new THREE.Vector3(...tower.attachments[j].position);
 const delta=position.sub(p),distance=delta.length(),key=`${i}:${j}`;
 if(delta.dot(tangent)>20&&distance<650&&(key===activeKey||distance<best)){
 if(idx>=0&&`${idx}:${attachmentIndex}`===activeKey)return;
 best=distance;idx=i;attachmentIndex=j;
 }
 });
 const hasTarget=idx>=0,key=hasTarget?`${idx}:${attachmentIndex}`:'';
 if(key!==activeKey){activeKey=key;settled=0;locked=false;acquiredAt=elapsed;}
 const profile=hasTarget&&attachmentIndex===-1;
 const shotLabel=hasTarget?(profile?'FULL STRUCTURE PROFILE':`PHASE ${network.towers[idx].attachments[attachmentIndex].phase}`):'FORWARD SCAN';
 const target=hasTarget?(profile?new THREE.Vector3(network.towers[idx].position[0],network.towers[idx].height/2,network.towers[idx].position[2]):new THREE.Vector3(...network.towers[idx].attachments[attachmentIndex].position)):p.clone().addScaledVector(tangent,300);
 if(hasTarget)inspector.follow(idx);
 targetMarker.position.copy(target);
 if(followFlight)track(p,dt);
 if(transition){camera.position.lerp(transition.position,.09);controls.target.lerp(transition.target,.09);if(camera.position.distanceTo(transition.position)<1)transition=undefined;}
 if(followedVehicle&&world&&worldData){const vehicle=worldData.fleet?.().find(v=>v.id===followedVehicle);if(vehicle){const vp=world.project(vehicle.coord,100);track(vp,dt);}}
 camera.near=Math.max(.1,camera.position.distanceTo(controls.target)/100000);controls.update();world?.update(camera);baseLayer.update(camera,controls.target);
 const simDt=running?dt*rate:0;
 // Rate-limited optics: overview frames the entire structure with margin, then zooms into attachments.
 const frameHalfHeight=profile?Math.max(network.towers[idx].height*.7,18):4;
 const desiredFov=hasTarget?Math.max(4,Math.min(55,2*Math.atan(frameHalfHeight/p.distanceTo(target))*180/Math.PI)):35;
 if(autoZoom||profile){const zoomStep=4*simDt;gimbal.fov+=THREE.MathUtils.clamp(desiredFov-gimbal.fov,-zoomStep,zoomStep);}
 gimbal.position.copy(p).add(new THREE.Vector3(0,-1,0));
 desiredGimbal.position.copy(gimbal.position);desiredGimbal.lookAt(target);
 gimbal.quaternion.rotateTowards(desiredGimbal.quaternion,THREE.MathUtils.degToRad(15)*simDt);
 const aligned=gimbal.quaternion.angleTo(desiredGimbal.quaternion)<THREE.MathUtils.degToRad(.5)&&(!(autoZoom||profile)||Math.abs(gimbal.fov-desiredFov)<.5);
 const repositioned=elapsed-acquiredAt>=2;
 settled=hasTarget&&aligned&&repositioned?settled+simDt:0;locked=hasTarget&&settled>=1.5;
 cameraStage=!hasTarget?'SCANNING':!repositioned||!aligned?'REPOSITION / ZOOM':!locked?'FOCUS / SETTLE':'EXPOSURE READY';
 if(running&&locked&&elapsed-lastShot>=4){captured.add(activeKey);shotCount++;lastShot=elapsed;lastCapture=`Tower ${idx+1} · ${shotLabel}`;settled=0;cameraStage='CAPTURED';}
 host.querySelector('.gimbal-caption')!.textContent=`${shotLabel} · ${cameraStage} · last: ${lastCapture}`;
 const attribute=aim.geometry.getAttribute('position') as THREE.BufferAttribute;attribute.setXYZ(0,p.x,p.y,p.z);attribute.setXYZ(1,target.x,target.y,target.z);attribute.needsUpdate=true;aim.geometry.computeBoundingSphere();
 const w=canvasHost.clientWidth,h=canvasHost.clientHeight;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();camera.updateMatrixWorld();panel?.update(camera,performance.now());renderer.setScissorTest(false);renderer.setViewport(0,0,w,h);renderer.clear();renderer.render(scene,camera);
 canvasHost.classList.toggle('mission-idle',!running||returning);targetMarker.visible=running&&hasTarget;aim.visible=running&&hasTarget;
 if(running&&!returning){const iw=Math.round(w*.42),ih=Math.round(h*.42),ix=w-iw-16,iy=16;gimbal.aspect=iw/ih;gimbal.updateProjectionMatrix();renderer.setScissorTest(true);renderer.setScissor(ix,iy,iw,ih);renderer.setViewport(ix,iy,iw,ih);renderer.clear();renderer.render(scene,gimbal);renderer.setScissorTest(false);}
 if(elapsed-lastText>.15||!running){lastText=elapsed;host.querySelector('#inspect-readout')!.textContent=running?` ${flightStage} · ${hasTarget?`Tower ${idx+1} · ${cameraStage}`:'Forward scan'} · ${shotCount} shots · ${mph} mph · ${Math.round(progress/pathLength*100)}% · ${rate}×`:progress>=pathLength?(returning?'LANDED AT LAUNCH · Return complete':'LANDED · Mission complete'):progress?'MISSION PAUSED · Camera preview off':'Fleet telemetry · simulated positions · click an aircraft';}
 }
 view('ohio');if(transition){camera.position.copy(transition.position);controls.target.copy(transition.target);transition=undefined;}
 tick();return {pack:network.pack,view,dispose(){disposed=true;cancelAnimationFrame(frame);panel?.dispose();baseLayer.dispose();controls.dispose();scene.traverse(obj=>{const o=obj as THREE.Mesh;if(o.geometry)o.geometry.dispose();if(o.material){for(const m of Array.isArray(o.material)?o.material:[o.material])m.dispose();}});renderer.dispose();host.innerHTML='';}};
}
