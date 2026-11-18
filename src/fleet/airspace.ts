import * as THREE from 'three';
type Track={id:string;label:string;kind:string;source:string;observedAt:number;longitude:number;latitude:number;altitudeM?:number;altitudeDatum?:string;heading?:number;speedMps?:number};
type Notice={id:string;title:string;source:string;start:number;end:number;ring?:number[][]};
type Snapshot={tracks:Track[];notices:Notice[];sources:{name:string;status:string}[]};
/** Awareness overlay only: observed altitude is never treated as local AGL. */
export function airspace(scene:THREE.Scene,host:HTMLElement,origin:number[],mission:number[][]=[]){
 const group=new THREE.Group();scene.add(group);
 const box=document.createElement('details');box.className='airspace-panel';box.innerHTML='<summary>Airspace awareness · simulated</summary><p class="airspace-status"></p><div class="airspace-list"></div><small>Horizontal awareness only. Symbols use display heights, not altitude clearance. No feed is proof of clear airspace.</small>';host.append(box);
 const status=box.querySelector('.airspace-status')!;const list=box.querySelector('.airspace-list')!;
 const center=mission.length?[0,1].map(k=>(Math.min(...mission.map(p=>p[k]))+Math.max(...mission.map(p=>p[k])))/2):origin.slice();
 const radius=mission.length?[0,1].map(k=>Math.max(.006,(Math.max(...mission.map(p=>p[k]))-Math.min(...mission.map(p=>p[k])))*.3)):[.012,.009];
 const trails=new Map<string,{time:number;point:THREE.Vector3}[]>();
 let selectedTrack:string|undefined,camera:THREE.Camera|undefined;
 let snapshot:Snapshot={tracks:[],notices:[],sources:[]};let last=0;
 const project=(lon:number,lat:number,y:number)=>new THREE.Vector3((lon-origin[0])*111320*Math.cos(origin[1]*Math.PI/180),y,-(lat-origin[1])*111320);
 const missionBounds=mission.length?new THREE.Box3().setFromPoints(mission.map(p=>project(p[0],p[1],0))).expandByScalar(100):undefined;
 const inMission=(p:THREE.Vector3)=>!!missionBounds&&p.x>=missionBounds.min.x&&p.x<=missionBounds.max.x&&p.z>=missionBounds.min.z&&p.z<=missionBounds.max.z;
 function clear(){for(const child of [...group.children]){group.remove(child);const mesh=child as THREE.Mesh;mesh.geometry?.dispose();if((mesh.material as THREE.SpriteMaterial)?.map)(mesh.material as THREE.SpriteMaterial).map?.dispose();const materials=Array.isArray(mesh.material)?mesh.material:[mesh.material];materials.forEach(m=>m?.dispose());}}
 function render(t:number){clear();list.replaceChildren();
 for(const [id,history] of trails)if(!history.length||t-history.at(-1)!.time>60)trails.delete(id);
 for(const track of snapshot.tracks){if(!Number.isFinite(track.longitude)||!Number.isFinite(track.latitude)||!Number.isFinite(track.observedAt))continue;const age=Math.max(0,t-track.observedAt);if(age>60)continue;
 const history=trails.get(track.id)||[],height=track.kind==='remote-id'?160:380;
 const position=project(track.longitude,track.latitude,height);
 // Demo-only prehistory follows the same synthetic trajectory; live tracks use observations only.
 if(!history.length&&track.source==='Simulation'){const i=track.id==='DEMO-2'?1:0;for(let seconds=30;seconds>=1;seconds--){const a=(last-seconds*1000)/180000+i*Math.PI;history.push({time:t-seconds,point:project(center[0]+Math.sin(a)*radius[0],center[1]+Math.cos(a)*radius[1],height)});}}
 if(!history.length||track.observedAt>history.at(-1)!.time)history.push({time:track.observedAt,point:position.clone()});
 while(history.length&&(t-history[0].time>30||history.length>120))history.shift();trails.set(track.id,history);
 if(mission.length&&(Math.abs(track.longitude-center[0])>radius[0]*2.5||Math.abs(track.latitude-center[1])>radius[1]*2.5))continue;
 const color=age>60?0x81939e:track.kind==='remote-id'?0xee87ff:track.kind==='helicopter'?0xffbb55:0x62dfff;
 if(history.length>1&&inMission(position)){const trail=new THREE.Line(new THREE.BufferGeometry().setFromPoints(history.map(p=>p.point)),new THREE.LineBasicMaterial({color,transparent:true,opacity:.35,depthTest:false,depthWrite:false}));trail.renderOrder=15;trail.layers.set(1);trail.userData.sensorIgnore=true;group.add(trail);}
 const telemetry=`${track.altitudeM===undefined?'ALT ?':Math.round(track.altitudeM*3.28084)+' ft'} · ${track.speedMps===undefined?'SPD ?':Math.round(track.speedMps*1.94384)+' kt'} · ${track.heading===undefined?'HDG ?':Math.round(track.heading)+'°'} · ${Math.round(age)}s`;
 const iconCanvas=document.createElement('canvas');iconCanvas.width=iconCanvas.height=64;const iconContext=iconCanvas.getContext('2d')!;
 iconContext.fillStyle='#'+color.toString(16).padStart(6,'0');iconContext.strokeStyle='#102330';iconContext.lineWidth=3;
 iconContext.beginPath();iconContext.moveTo(32,6);iconContext.lineTo(38,27);iconContext.lineTo(57,39);iconContext.lineTo(57,45);iconContext.lineTo(37,39);iconContext.lineTo(36,52);iconContext.lineTo(45,58);iconContext.lineTo(19,58);iconContext.lineTo(28,52);iconContext.lineTo(27,39);iconContext.lineTo(7,45);iconContext.lineTo(7,39);iconContext.lineTo(26,27);iconContext.closePath();iconContext.fill();iconContext.stroke();
 const marker=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(iconCanvas),color:0xffffff,transparent:true,depthTest:false,depthWrite:false,sizeAttenuation:false,rotation:-(track.heading??0)*Math.PI/180}));marker.position.copy(position);marker.scale.set(.024,.024,1);marker.userData.sensorIgnore=true;marker.userData.trackId=track.id;marker.layers.set(1);marker.renderOrder=16;group.add(marker);
 const expanded=selectedTrack===track.id;
 const canvas=document.createElement('canvas');canvas.width=expanded?512:320;canvas.height=expanded?116:48;const ctx=canvas.getContext('2d')!;
 ctx.fillStyle='#10232de8';ctx.beginPath();ctx.roundRect(0,0,canvas.width,canvas.height,10);ctx.fill();
 ctx.fillStyle='#'+color.toString(16).padStart(6,'0');ctx.font='500 25px system-ui';ctx.textAlign='left';ctx.fillText(track.label||track.id,14,32);
 if(expanded){ctx.font='20px system-ui';ctx.fillStyle='#d8e6e9';ctx.fillText(telemetry,14,70);ctx.font='17px system-ui';ctx.fillText((track.source==='Simulation'?'SIMULATED · ':track.source+' · ')+(track.altitudeDatum??'datum unknown'),14,100);}
 const label=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(canvas),sizeAttenuation:false,depthTest:false,depthWrite:false,transparent:true}));label.position.copy(position);label.center.set(-.12,.5);label.scale.set(expanded?.17:.10,expanded?.039:.015,1);label.layers.set(1);label.renderOrder=17;label.userData.sensorIgnore=true;label.userData.trackId=track.id;group.add(label);
 const row=document.createElement('div');row.textContent=`${track.kind==='helicopter'?'H':track.kind==='remote-id'?'RID':'✈'} ${track.label||track.id} · ${Math.round(age)}s old · ${track.altitudeM??'?'} m ${track.altitudeDatum??'unknown datum'}`;row.style.color=`#${color.toString(16).padStart(6,'0')}`;list.append(row);
 }
 for(const n of snapshot.notices){if(window.parent!==window)continue;if(!Number.isFinite(n.start)||!Number.isFinite(n.end)||n.end<t)continue;const active=n.start<=t;const row=document.createElement('div');row.textContent=`${active?'ACTIVE':'UPCOMING'} · ${n.id}: ${n.title} · ${n.source}${n.ring?'':' · no mapped geometry'}`;list.append(row);
 if(n.ring?.length&&n.ring.every(p=>p.length>=2&&p.every(Number.isFinite))){const pts=n.ring.map(p=>project(p[0],p[1],35));pts.push(pts[0].clone());const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),new THREE.LineBasicMaterial({color:active?0xff6677:0xffcb66}));line.userData.sensorIgnore=true;group.add(line);}
 }
 box.querySelector('summary')!.textContent=`Traffic · ${snapshot.tracks.length} · simulated`;
 status.textContent=snapshot.sources.map(s=>`${s.name}: ${s.status}`).join(' · ');
 }
 const raycaster=new THREE.Raycaster();raycaster.layers.set(1);
 const onClick=(event:MouseEvent)=>{
   if(!camera||!group.visible||(event.target as HTMLElement).closest('button,select,details'))return;
   const rect=host.getBoundingClientRect(),width=host.classList.contains('camera-split')?rect.width/2:rect.width;
   if(event.clientX>rect.left+width)return;
   raycaster.setFromCamera(new THREE.Vector2((event.clientX-rect.left)/width*2-1,-(event.clientY-rect.top)/rect.height*2+1),camera);
   const hit=raycaster.intersectObjects(group.children).find(hit=>hit.object.userData.trackId);
   selectedTrack=hit?.object.userData.trackId;render(Date.now()/1000);
 };
 host.addEventListener('click',onClick);
 return {panel:box,update(ms:number,focus?:THREE.Vector3,viewCamera?:THREE.Camera){camera=viewCamera;const overview=!!camera&&!!focus&&camera.position.distanceTo(focus)>1100000;const hiddenSimulation=document.body.classList.contains('flightline-embedded')&&host.closest('#inspection-host')?.getAttribute('data-stage')!=='simulations';group.visible=!hiddenSimulation&&!overview;box.hidden=overview||hiddenSimulation;if(hiddenSimulation)return;if(overview)return;if(ms-last<250)return;last=ms;const t=Date.now()/1000;
 snapshot={tracks:['aircraft','helicopter'].map((kind,i)=>{const a=ms/180000+i*Math.PI,dx=Math.cos(a)*radius[0]*111320*Math.cos(center[1]*Math.PI/180)/180,dy=-Math.sin(a)*radius[1]*111320/180;return {id:`DEMO-${i+1}`,label:i?'SIM HELI-02':'SIM AIR-01',kind,source:'Simulation',observedAt:t,longitude:center[0]+Math.sin(a)*radius[0],latitude:center[1]+Math.cos(a)*radius[1],altitudeM:450+i*150,altitudeDatum:'synthetic AGL',heading:(Math.atan2(dx,dy)*180/Math.PI+360)%360,speedMps:Math.hypot(dx,dy)};}),notices:[{id:'SIM-TFR',title:'Hypothetical restricted area',source:'Simulation — not FAA',start:t-3600,end:t+3600,ring:[[origin[0]+.01,origin[1]+.005],[origin[0]+.02,origin[1]+.005],[origin[0]+.02,origin[1]+.015],[origin[0]+.01,origin[1]+.015]]},{id:'SIM-NOTAM',title:'Hypothetical airport runway work',source:'Simulation — not FAA',start:t-3600,end:t+3600}],sources:[{name:'Demo',status:'Invented traffic and notices'}]};
 render(t);
 },dispose(){host.removeEventListener('click',onClick);clear();scene.remove(group);box.remove();}};
}
