import * as THREE from 'three';
import type {WorldData} from './world';
import type {PowerLine} from './model';
import {lineLength} from './model';
const epochs=new Map<string,number>();
/** Fictional activity advisories, deliberately not FAA-format issued NOTAMs. */
export function missionNotams(scene:THREE.Scene,host:Element,origin:number[],data:WorldData|undefined,line:PowerLine,focus:(p:THREE.Vector3[])=>void){
 const panel=document.createElement('details');panel.className='mission-notams';panel.innerHTML='<summary>Mission NOTAMs · SIM</summary><small>Simulated UAS activity advisories · not filed · no airspace reservation</small><div class="notice-cards"></div><button>Export simulated notices</button>';host.append(panel);
 const cards=panel.querySelector('div')!,group=new THREE.Group();scene.add(group);
 const project=(p:number[],y=4)=>new THREE.Vector3((p[0]-origin[0])*111320*Math.cos(origin[1]*Math.PI/180),y,-(p[1]-origin[1])*111320);
 let notices:any[]=[],selected='',last=-Infinity,signature='';
 function clear(){for(const o of [...group.children]){group.remove(o);const m=o as THREE.Line;m.geometry.dispose();(m.material as THREE.Material).dispose();}}
 function draw(){clear();const n=notices.find(n=>n.id===selected);if(!n)return;const border=new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(n.geometry.coordinates[0].map((p:number[])=>project(p))),new THREE.LineDashedMaterial({color:0xe8b45b,dashSize:80,gapSize:45,depthTest:false}));border.computeLineDistances();border.userData.sensorIgnore=true;group.add(border);const route=new THREE.Line(new THREE.BufferGeometry().setFromPoints(n.route.coordinates.map((p:number[])=>project(p,8))),new THREE.LineBasicMaterial({color:0x65d9b0,depthTest:false}));route.userData.sensorIgnore=true;group.add(route);}
 function update(){if(performance.now()-last<1000)return;last=performance.now();
 const fleet=data?.fleet?.()??[];
 const missions=fleet.map(v=>({id:v.id,way:v.osmWay,route:v.route,elapsed:v.timeline.seconds,duration:v.timeline.flightSeconds,done:v.done,replay:v.replaying,from:v.from,to:v.to}));
 if(!fleet.some(v=>v.osmWay===line.id))missions.push({id:`OSM-${line.id}`,way:line.id,route:line.coords,elapsed:0,duration:lineLength(line.coords)/40/1.609344*3600,done:false,replay:false,from:'Corridor start',to:'Corridor end'});
 notices=missions.filter(m=>m.route.length>1).map(m=>{const id=`SIM-UAS-${m.id}`,paddingLat=213.36/111320,paddingLon=paddingLat/Math.cos(m.route[0][1]*Math.PI/180);const xs=m.route.map(p=>p[0]),ys=m.route.map(p=>p[1]);const w=Math.min(...xs)-paddingLon,e=Math.max(...xs)+paddingLon,s=Math.min(...ys)-paddingLat,n=Math.max(...ys)+paddingLat;
 if(!epochs.has(id))epochs.set(id,Date.now()-m.elapsed*1000);const epoch=epochs.get(id)!;
 return {id,simulation:true,submitted:false,issuedNotamId:null,kind:'UAS activity advisory',missionId:m.id,sourceOsmWay:m.way,status:m.done?'COMPLETED':m.id.startsWith('OSM-')?'PLANNED':'ACTIVE',replay:m.replay,from:m.from,to:m.to,window:{startUTC:new Date(epoch-900000).toISOString(),endUTC:new Date(epoch+(m.duration+900)*1000).toISOString(),clock:'Illustrative mission clock; follows simulation, not wall-clock expiry'},altitude:{floorFt:0,ceilingFt:400,reference:'AGL',assumed:true,terrainValidated:false},geometry:{type:'Polygon',coordinates:[[[w,s],[e,s],[e,n],[w,n],[w,s]]]},geometryMeaning:'Route bounding rectangle plus 700 ft padding, not a corridor authorization',route:{type:'LineString',coordinates:m.route},remarks:'Simulated fixed-wing power-line inspection. Advisory only; no priority, clearance, TFR or separation assurance.'};});
 panel.querySelector('summary')!.textContent=`Mission NOTAMs · ${notices.length} · SIM`;
 const next=JSON.stringify(notices.map(n=>[n.id,n.status,n.window.endUTC,n.route.coordinates.length]));if(next!==signature){signature=next;cards.replaceChildren();for(const n of notices){const row=document.createElement('div');const b=document.createElement('button');b.textContent=`${n.missionId} · ${n.status}`;b.onclick=()=>{selected=n.id;draw();focus(n.geometry.coordinates[0].map((p:number[])=>project(p)));};const detail=document.createElement('small');detail.textContent=`${n.from} → ${n.to} · SFC–400 ft AGL (assumed) · ${n.window.startUTC.slice(11,16)}–${n.window.endUTC.slice(11,16)} UTC`;row.append(b,detail);cards.append(row);}draw();}
 }
 panel.ontoggle=()=>{if(!panel.open){selected='';clear();}};
 panel.querySelector(':scope > button')!.addEventListener('click',()=>{update();const url=URL.createObjectURL(new Blob([JSON.stringify({schema:'flightline.simulated-mission-notams.v1',simulation:true,submitted:false,notices},null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='simulated-mission-notams.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
 update();return {update,dispose(){clear();scene.remove(group);panel.remove();}};
}
