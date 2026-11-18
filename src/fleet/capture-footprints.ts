import * as THREE from 'three';
export type Exposure={tower:number;phase:number;seconds:number;position:number[];quaternion:number[];vfov:number;aspect:number;target:number[];extra:boolean};
const histories=new Map<string,Exposure[]>();
/** Frozen optical pose at exposure, not a photograph or reconstructed historical flight. */
export function exposureLines(shot:Exposure){
 const origin=new THREE.Vector3(...shot.position),target=new THREE.Vector3(...shot.target),q=new THREE.Quaternion(...shot.quaternion);
 const depth=target.clone().sub(origin).dot(new THREE.Vector3(0,0,-1).applyQuaternion(q));
 const h=Math.max(.1,depth)*Math.tan(THREE.MathUtils.degToRad(shot.vfov/2)),w=h*shot.aspect;
 const corners=[[-w,-h],[w,-h],[w,h],[-w,h]].map(([x,y])=>new THREE.Vector3(x,y,-depth).applyQuaternion(q).add(origin));
 return corners.flatMap((corner,i)=>[origin,corner,corner,corners[(i+1)%4]]).concat([origin,target]);
}
export function captureFootprints(scene:THREE.Scene,host:HTMLElement,key:string){
 const shots=histories.get(key)??[];histories.set(key,shots);
 const group=new THREE.Group();scene.add(group);group.userData.sensorIgnore=true;
 const control=document.createElement('label');control.hidden=true;control.innerHTML='<input type="checkbox" checked> Shot FOVs <small></small>';control.title='Recorded simulated exposures: amber camera frusta and mint focus rays. No stored photographs; unseen historical shots are not invented.';host.append(control);
 let signature='';
 function clear(){for(const child of [...group.children]){const line=child as THREE.LineSegments;line.geometry.dispose();(line.material as THREE.Material).dispose();group.remove(child);}}
 return {record(shot:Exposure){shots.push(shot);},update(scope:{mode:string;span:number;tower:number|undefined}){
  const visible=scope.mode==='span'||scope.mode==='asset';control.hidden=!visible;group.visible=visible&&(control.querySelector('input') as HTMLInputElement).checked;
  if(!visible)return;
  const selected=shots.filter(s=>scope.mode==='asset'?(scope.tower!==undefined&&s.tower===scope.tower):(s.tower===scope.span||s.tower===scope.span+1));
  control.querySelector('small')!.textContent=`${selected.length} simulated shots`;
  const next=JSON.stringify([scope,shots.length]);if(next===signature)return;signature=next;clear();
  const edges:THREE.Vector3[]=[],aim:THREE.Vector3[]=[];
  for(const shot of selected){const lines=exposureLines(shot);edges.push(...lines.slice(0,-2));aim.push(...lines.slice(-2));}
  for(const [points,color,opacity] of [[edges,0xe8b45b,.32],[aim,0x65d9b0,.6]] as const){
   const mesh=new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(points),new THREE.LineBasicMaterial({color,transparent:true,opacity,depthWrite:false}));mesh.userData.sensorIgnore=true;group.add(mesh);
  }
 },dispose(){clear();scene.remove(group);control.remove();}};
}
