import {GIS_SPEC,localFrame} from '../gis/core.js';
import * as THREE from 'three';
import type {Vehicle} from './operations';
import type {Airport,PowerLine,Sortie} from './model';
export type WorldData={lines:PowerLine[];airports:Airport[];bases:Airport[];boundary:number[][];radiusKm:number;mission?:Sortie;inspectionAge?:(id:number)=>number|null;fleet?:()=>Vehicle[];fleetState?:()=>{running:boolean;rate:number};toggleFleet?:()=>void;setFleetRate?:(rate:number)=>void;capturePace?:(id:string,mph:number)=>void;recall?:(id:string)=>void;contingency?:(id:string,route:number[][],altitudes:number[],returning:boolean,label:string,connectionKm?:number)=>boolean;previewMission?:(id:string,seconds:number|null)=>void;seek?:(id:string,fraction:number|null)=>void;activeVehicle?:string;selectVehicle?:(id:string)=>void};
export function addWorld(scene:THREE.Scene,origin:number[],data:WorldData){
 const frame=localFrame(origin),project=(p:number[],height=0)=>new THREE.Vector3(...frame.project(p,height));
 const group=new THREE.Group();scene.add(group);
 function line(points:THREE.Vector3[],color:number,opacity=1){const obj=new THREE.Line(new THREE.BufferGeometry().setFromPoints(points),new THREE.LineBasicMaterial({color,transparent:true,opacity,depthTest:false,depthWrite:false}));group.add(obj);return obj;}
 line(data.boundary.map(p=>project(p,5)),0x8cb1bc);
 const positions:number[]=[],assetIds:number[]=[];for(const l of data.lines)for(let i=1;i<l.coords.length;i++){positions.push(...project(l.coords[i-1],35).toArray(),...project(l.coords[i],35).toArray());assetIds.push(l.id,l.id);}
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));const colors=new THREE.Float32BufferAttribute(new Float32Array(positions.length),3);geometry.setAttribute('color',colors);let colorUpdate=-Infinity;
 group.add(new THREE.LineSegments(geometry,new THREE.LineBasicMaterial({vertexColors:true,transparent:true,opacity:.9,depthTest:false,depthWrite:false})));
 const labels:THREE.Sprite[]=[];
 for(const a of data.airports){const active=data.bases.some(b=>b.id===a.id),p=project(a.coord,80);const dot=new THREE.Sprite(new THREE.SpriteMaterial({color:active?0x9beafa:0x587c8c}));dot.position.copy(p);dot.userData.active=active;dot.userData.airportLayer=true;group.add(dot);labels.push(dot);
 if(active){const radius=data.radiusKm*1000;const coverage=line(Array.from({length:129},(_,i)=>new THREE.Vector3(p.x+Math.cos(i/128*Math.PI*2)*radius,10,p.z+Math.sin(i/128*Math.PI*2)*radius)),0xb9ec8c,.3);coverage.userData.airportLayer=true;
 const canvas=document.createElement('canvas');canvas.width=256;canvas.height=64;const c=canvas.getContext('2d')!;c.fillStyle='#9beafa';c.font='bold 32px sans-serif';c.fillText(a.id,8,42);const label=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(canvas),transparent:true,depthTest:false}));label.position.copy(p);label.userData.label=true;label.userData.airportLayer=true;group.add(label);labels.push(label);}}
 if(data.mission)line(data.mission.points.map(p=>project(p,85)),0xcc9aff);
 const dotCanvas=document.createElement('canvas');dotCanvas.width=dotCanvas.height=32;
 const dotContext=dotCanvas.getContext('2d')!;dotContext.fillStyle='white';dotContext.beginPath();dotContext.arc(16,16,13,0,Math.PI*2);dotContext.fill();
 const dotTexture=new THREE.CanvasTexture(dotCanvas);
 const aircraft:THREE.Sprite[]=[];
 const center=project([-82.6,40.4]);
 return {center,project,dispose(){dotTexture.dispose();},update(camera:THREE.Camera,showAirports=true){
 if(performance.now()-colorUpdate>1000){colorUpdate=performance.now();const fresh=new THREE.Color('#52d9ad'),mid=new THREE.Color('#e9cb63'),old=new THREE.Color('#e46b72'),unknown=new THREE.Color('#64717d');assetIds.forEach((id,i)=>{const age=data.inspectionAge?.(id);const color=age==null?unknown:age<=30?fresh.clone().lerp(mid,Math.max(0,age)/30):mid.clone().lerp(old,Math.min(1,(age-30)/60));colors.setXYZ(i,color.r,color.g,color.b);});colors.needsUpdate=true;}
 for(const object of group.children)if(object.userData.airportLayer)object.visible=showAirports;
 const positions=document.body.classList.contains('flightline-embedded')&&document.querySelector('#inspection-host')?.getAttribute('data-stage')!=='simulations'?[]:data.fleet?.()||[];while(aircraft.length<positions.length){const marker=new THREE.Sprite(new THREE.SpriteMaterial({color:GIS_SPEC.colors.fixedWing,map:dotTexture,transparent:true,depthTest:false,depthWrite:false}));group.add(marker);aircraft.push(marker);}aircraft.forEach((marker,i)=>{marker.visible=i<positions.length;if(marker.visible){marker.position.copy(project(positions[i].coord,positions[i].altitude));const distance=camera.position.distanceTo(marker.position);marker.visible=distance>2000;const size=distance*.012;marker.scale.set(size,size,1);}});for(const sprite of labels){const d=camera.position.distanceTo(sprite.position),scale=Math.max(4,d*.012);sprite.scale.set(scale*(sprite.userData.label?6:1),scale*(sprite.userData.label?1.5:1),1);if(sprite.userData.label){sprite.visible=showAirports&&d<1100000;sprite.center.set(-.1,.5);}}}};
}
