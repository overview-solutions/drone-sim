import * as THREE from 'three';
type Track={id:string;label:string;kind:string;source:string;observedAt:number;longitude:number;latitude:number;altitudeM?:number;altitudeDatum?:string;heading?:number;speedMps?:number};
type Notice={id:string;title:string;source:string;start:number;end:number;ring?:number[][]};
type Snapshot={tracks:Track[];notices:Notice[];sources:{name:string;status:string}[]};
/** Awareness overlay only: observed altitude is never treated as local AGL. */
export function airspace(scene:THREE.Scene,host:HTMLElement,origin:number[],mission:number[][]=[]){
 const group=new THREE.Group();scene.add(group);
 const box=document.createElement('details');box.className='airspace-panel';box.innerHTML='<summary>Airspace awareness · simulated</summary><label>Source <select><option value="demo">Simulated examples</option><option value="service">Rust local service</option><option value="off">Hidden</option></select></label><p class="airspace-status"></p><div class="airspace-list"></div><small>Horizontal awareness only. Symbols use display heights, not altitude clearance. No feed is proof of clear airspace.</small>';host.append(box);
 const select=box.querySelector('select')!;const status=box.querySelector('.airspace-status')!;const list=box.querySelector('.airspace-list')!;
 const center=mission.length?[0,1].map(k=>(Math.min(...mission.map(p=>p[k]))+Math.max(...mission.map(p=>p[k])))/2):origin.slice();
 const radius=mission.length?[0,1].map(k=>Math.max(.006,(Math.max(...mission.map(p=>p[k]))-Math.min(...mission.map(p=>p[k])))*.3)):[.012,.009];
 const trails=new Map<string,{time:number;point:THREE.Vector3}[]>();
 let snapshot:Snapshot={tracks:[],notices:[],sources:[]};let last=0;let pending=false;let disposed=false;let error='';let generation=0;
 const project=(lon:number,lat:number,y:number)=>new THREE.Vector3((lon-origin[0])*111320*Math.cos(origin[1]*Math.PI/180),y,-(lat-origin[1])*111320);
 function clear(){for(const child of [...group.children]){group.remove(child);const mesh=child as THREE.Mesh;mesh.geometry?.dispose();if((mesh.material as THREE.SpriteMaterial)?.map)(mesh.material as THREE.SpriteMaterial).map?.dispose();const materials=Array.isArray(mesh.material)?mesh.material:[mesh.material];materials.forEach(m=>m?.dispose());}}
 function render(t:number){clear();list.replaceChildren();
 for(const [id,history] of trails)if(!history.length||t-history.at(-1)!.time>60)trails.delete(id);
 for(const track of snapshot.tracks){if(!Number.isFinite(track.longitude)||!Number.isFinite(track.latitude)||!Number.isFinite(track.observedAt))continue;const age=Math.max(0,t-track.observedAt);if(age>60)continue;
 if(mission.length&&(Math.abs(track.longitude-center[0])>radius[0]*2.5||Math.abs(track.latitude-center[1])>radius[1]*2.5))continue;
 const history=trails.get(track.id)||[];
 if(!history.length||track.observedAt>history.at(-1)!.time)history.push({time:track.observedAt,point:project(track.longitude,track.latitude,380)});
 while(history.length&&(t-history[0].time>30||history.length>120))history.shift();trails.set(track.id,history);
 const color=age>60?0x81939e:track.kind==='remote-id'?0xee87ff:track.kind==='helicopter'?0xffbb55:0x62dfff;
 if(history.length>1){const trail=new THREE.Line(new THREE.BufferGeometry().setFromPoints(history.map(p=>p.point)),new THREE.LineBasicMaterial({color,transparent:true,opacity:.6,depthTest:false}));trail.layers.set(1);trail.userData.sensorIgnore=true;group.add(trail);}
 const telemetry=`${track.altitudeM===undefined?'ALT ?':Math.round(track.altitudeM*3.28084)+' ft'} · ${track.speedMps===undefined?'SPD ?':Math.round(track.speedMps*1.94384)+' kt'} · ${track.heading===undefined?'HDG ?':Math.round(track.heading)+'°'} · ${Math.round(age)}s`;
 const marker=new THREE.Mesh(new THREE.ConeGeometry(track.kind==='remote-id'?25:45,90,4),new THREE.MeshBasicMaterial({color,wireframe:true}));marker.position.copy(project(track.longitude,track.latitude,track.kind==='remote-id'?160:380));marker.userData.sensorIgnore=true;marker.layers.set(1);group.add(marker);
 const canvas=document.createElement('canvas');canvas.width=512;canvas.height=112;const ctx=canvas.getContext('2d')!;ctx.fillStyle='#102631b8';ctx.fillRect(0,0,512,112);ctx.fillStyle='#'+color.toString(16).padStart(6,'0');ctx.font='bold 27px sans-serif';ctx.textAlign='center';ctx.fillText((track.kind==='helicopter'?'H ':track.kind==='remote-id'?'RID ':'✈ ')+(track.label||track.id),256,34);ctx.font='20px sans-serif';ctx.fillText(telemetry,256,66);ctx.font='18px sans-serif';ctx.fillText((track.source==='Simulation'?'SIMULATED · ':track.source+' · ')+(track.altitudeDatum??'datum unknown'),256,96);
 const label=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(canvas),sizeAttenuation:false,depthTest:false,transparent:true}));label.position.copy(marker.position);label.position.y+=65;label.scale.set(.20,.044,1);label.layers.set(1);label.userData.sensorIgnore=true;group.add(label);
 const row=document.createElement('div');row.textContent=`${track.kind==='helicopter'?'H':track.kind==='remote-id'?'RID':'✈'} ${track.label||track.id} · ${Math.round(age)}s old · ${track.altitudeM??'?'} m ${track.altitudeDatum??'unknown datum'}`;row.style.color=`#${color.toString(16).padStart(6,'0')}`;list.append(row);
 }
 for(const n of snapshot.notices){if(!Number.isFinite(n.start)||!Number.isFinite(n.end)||n.end<t)continue;const active=n.start<=t;const row=document.createElement('div');row.textContent=`${active?'ACTIVE':'UPCOMING'} · ${n.id}: ${n.title} · ${n.source}${n.ring?'':' · no mapped geometry'}`;list.append(row);
 if(n.ring?.length&&n.ring.every(p=>p.length>=2&&p.every(Number.isFinite))){const pts=n.ring.map(p=>project(p[0],p[1],35));pts.push(pts[0].clone());const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),new THREE.LineBasicMaterial({color:active?0xff6677:0xffcb66}));line.userData.sensorIgnore=true;group.add(line);}
 }
 box.querySelector('summary')!.textContent=`Traffic · ${snapshot.tracks.length} · ${select.value==='demo'?'simulated':'service'}`;
 status.textContent=error||snapshot.sources.map(s=>`${s.name}: ${s.status}`).join(' · ');
 }
 select.onchange=()=>{generation++;trails.clear();snapshot={tracks:[],notices:[],sources:[]};error='';last=0;clear();list.replaceChildren();box.querySelector('summary')!.textContent=`Airspace awareness · ${select.value==='demo'?'simulated':select.value==='off'?'hidden':'service'}`;};
 return {panel:box,update(ms:number,_focus?:THREE.Vector3){if(ms-last<(select.value==='demo'?250:2000)||select.value==='off')return;last=ms;const t=Date.now()/1000;
 if(select.value==='demo'){snapshot={tracks:['aircraft','helicopter'].map((kind,i)=>{const a=ms/180000+i*Math.PI,dx=Math.cos(a)*radius[0]*111320*Math.cos(center[1]*Math.PI/180)/180,dy=-Math.sin(a)*radius[1]*111320/180;return {id:`DEMO-${i+1}`,label:i?'SIM HELI-02':'SIM AIR-01',kind,source:'Simulation',observedAt:t,longitude:center[0]+Math.sin(a)*radius[0],latitude:center[1]+Math.cos(a)*radius[1],altitudeM:450+i*150,altitudeDatum:'synthetic AGL',heading:(Math.atan2(dx,dy)*180/Math.PI+360)%360,speedMps:Math.hypot(dx,dy)};}),notices:[{id:'SIM-TFR',title:'Hypothetical restricted area',source:'Simulation — not FAA',start:t-3600,end:t+3600,ring:[[origin[0]+.01,origin[1]+.005],[origin[0]+.02,origin[1]+.005],[origin[0]+.02,origin[1]+.015],[origin[0]+.01,origin[1]+.015]]},{id:'SIM-NOTAM',title:'Hypothetical airport runway work',source:'Simulation — not FAA',start:t-3600,end:t+3600}],sources:[{name:'Demo',status:'Invented traffic and notices'}]};}
 else if(!pending){pending=true;const requestGeneration=generation;fetch('http://127.0.0.1:8788/v1/airspace',{signal:AbortSignal.timeout(5000)}).then(r=>{if(!r.ok)throw Error();return r.json();}).then(v=>{if(disposed||requestGeneration!==generation)return;if(!Array.isArray(v.tracks)||!Array.isArray(v.notices)||!Array.isArray(v.sources))throw Error();snapshot=v;error='';}).catch(()=>{if(requestGeneration===generation)error='Service unavailable; previous observations age out. Start Rust service on port 8788.';}).finally(()=>{pending=false;});}
 render(t);
 },dispose(){disposed=true;clear();scene.remove(group);box.remove();}};
}
