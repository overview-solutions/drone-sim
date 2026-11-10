import * as THREE from 'three';
import type {generateUN} from './un';
import data from './ray-king-structures.json';
export function rayKingStructures(scene:THREE.Scene,banner:Element,network:ReturnType<typeof generateUN>){
 const group=new THREE.Group();scene.add(group);
 data.structures.forEach((s,index)=>{
  const geometry=new THREE.BufferGeometry().setFromPoints(s.edges.flatMap(edge=>edge.map(p=>new THREE.Vector3(...p as [number,number,number]))));
  const frame=new THREE.LineSegments(geometry,new THREE.LineBasicMaterial({color:s.envelopeAvailable?0xe5f0e9:0xe8b45b}));frame.userData.sensorIgnore=true;group.add(frame);
  const hit=new THREE.Mesh(new THREE.CylinderGeometry(9,9,s.heightMeters,8),new THREE.MeshBasicMaterial({transparent:true,opacity:0,depthWrite:false}));hit.position.set(s.position[0],s.position[1]+s.heightMeters/2,s.position[2]);hit.userData.rayTowerIndex=index;hit.userData.sensorIgnore=true;group.add(hit);
 });
 const colors=[0xffb563,0x8be0fa,0xcb9dff];
 network.towers.forEach((tower,index)=>tower.attachments.forEach((at,j)=>{
  const p=new THREE.Vector3(...at.position);
  const insulator=new THREE.Mesh(new THREE.CylinderGeometry(.22,.22,2.5,10),new THREE.MeshStandardMaterial({color:0xb8d9ce}));insulator.position.copy(p).add(new THREE.Vector3(0,1.25,0));insulator.userData.equipmentTower=index;insulator.userData.equipmentPhase=j;group.add(insulator);
  for(let k=0;k<9;k++){const disc=new THREE.Mesh(new THREE.CylinderGeometry(.45,.45,.12,10),new THREE.MeshStandardMaterial({color:0xb8d9ce}));disc.position.copy(p).add(new THREE.Vector3(0,.2+k*.26,0));disc.userData.equipmentTower=index;disc.userData.equipmentPhase=j;group.add(disc);}
  const marker=new THREE.Mesh(new THREE.SphereGeometry(.35,10,8),new THREE.MeshBasicMaterial({color:colors[j]}));marker.position.copy(p);marker.userData.equipmentTower=index;marker.userData.equipmentPhase=j;group.add(marker);
 }));
 for(const span of network.spans){const cable=new THREE.Line(new THREE.BufferGeometry().setFromPoints(span.points.map(p=>new THREE.Vector3(...p))),new THREE.LineBasicMaterial({color:colors[['A','B','C'].indexOf(span.phase)]}));group.add(cable);}
 const label=document.createElement('label');label.innerHTML='<input type="checkbox" checked> Estimated structures';label.title='OSM + LiDAR positions and heights; cross-corridor arms and lattice members are inferred, not surveyed steelwork.';label.querySelector('input')!.onchange=e=>group.visible=(e.target as HTMLInputElement).checked;banner.append(label);
 const exportButton=document.createElement('button');exportButton.textContent='Export structures';exportButton.onclick=()=>{const url=URL.createObjectURL(new Blob([JSON.stringify({...network.pack,estimatedFrames:data.geojson},null,2)],{type:'application/geo+json'}));const link=document.createElement('a');link.href=url;link.download='ray-king-modeled-three-phase-un.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};banner.append(exportButton);
}
