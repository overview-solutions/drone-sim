import * as THREE from 'three';
import type {Vehicle} from './operations';
import type {Airport,PowerLine,Sortie} from './model';
export type WorldData={lines:PowerLine[];airports:Airport[];bases:Airport[];boundary:number[][];radiusKm:number;mission?:Sortie;fleet?:()=>Vehicle[];fleetState?:()=>{running:boolean;rate:number};toggleFleet?:()=>void;setFleetRate?:(rate:number)=>void;recall?:(id:string)=>void};
export function addWorld(scene:THREE.Scene,origin:number[],data:WorldData){
 const cos=Math.cos(origin[1]*Math.PI/180),project=(p:number[],height=0)=>new THREE.Vector3((p[0]-origin[0])*111320*cos,height,-(p[1]-origin[1])*111320);
 const group=new THREE.Group();scene.add(group);
 function line(points:THREE.Vector3[],color:number,opacity=1){const obj=new THREE.Line(new THREE.BufferGeometry().setFromPoints(points),new THREE.LineBasicMaterial({color,transparent:true,opacity,depthTest:false,depthWrite:false}));group.add(obj);return obj;}
 line(data.boundary.map(p=>project(p,5)),0x8cb1bc);
 const positions:number[]=[];for(const l of data.lines)for(let i=1;i<l.coords.length;i++){positions.push(...project(l.coords[i-1],35).toArray(),...project(l.coords[i],35).toArray());}
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));group.add(new THREE.LineSegments(geometry,new THREE.LineBasicMaterial({color:0xe0b774,transparent:true,opacity:.9,depthTest:false,depthWrite:false})));
 const labels:THREE.Sprite[]=[];
 for(const a of data.airports){const active=data.bases.some(b=>b.id===a.id),p=project(a.coord,80);const dot=new THREE.Sprite(new THREE.SpriteMaterial({color:active?0x9beafa:0x587c8c}));dot.position.copy(p);dot.userData.active=active;group.add(dot);labels.push(dot);
 if(active){const radius=data.radiusKm*1000;line(Array.from({length:129},(_,i)=>new THREE.Vector3(p.x+Math.cos(i/128*Math.PI*2)*radius,10,p.z+Math.sin(i/128*Math.PI*2)*radius)),0xb9ec8c,.3);
 const canvas=document.createElement('canvas');canvas.width=256;canvas.height=64;const c=canvas.getContext('2d')!;c.fillStyle='#9beafa';c.font='bold 32px sans-serif';c.fillText(a.id,8,42);const label=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(canvas),transparent:true,depthTest:false}));label.position.copy(p);label.userData.label=true;group.add(label);labels.push(label);}}
 if(data.mission)line(data.mission.points.map(p=>project(p,85)),0xcc9aff);
 const aircraft:THREE.Sprite[]=[];
 const center=project([-82.6,40.4]);
 return {center,project,update(camera:THREE.Camera){const positions=data.fleet?.()||[];while(aircraft.length<positions.length){const marker=new THREE.Sprite(new THREE.SpriteMaterial({color:0xe4b5ff,depthTest:false}));group.add(marker);aircraft.push(marker);}aircraft.forEach((marker,i)=>{marker.visible=i<positions.length;if(marker.visible){marker.position.copy(project(positions[i].coord,100));const size=Math.max(8,camera.position.distanceTo(marker.position)*.012);marker.scale.set(size,size,1);}});for(const sprite of labels){const d=camera.position.distanceTo(sprite.position),scale=Math.max(4,d*.012);sprite.scale.set(scale*(sprite.userData.label?6:1),scale*(sprite.userData.label?1.5:1),1);if(sprite.userData.label)sprite.center.set(-.1,.5);}}};
}
