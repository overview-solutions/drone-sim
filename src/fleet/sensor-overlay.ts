import * as THREE from 'three';
export function lidarBudget(height:number,speed:number){const width=2*Math.max(0,height)*Math.tan(Math.PI/6),areaRate=width*Math.max(0,speed),requiredRate=Math.ceil(areaRate*30/.8);return {width,requiredRate,density:areaRate>0?requiredRate*.8/areaRate:0};}
/** Illustrative rays against displayed geometry; not a calibrated LiDAR or coverage model. */
export function sensorOverlay(scene:THREE.Scene,aircraft:THREE.Object3D,onReturn?:(treeId:string)=>void){
 const group=new THREE.Group();scene.add(group);
 const fov=new THREE.LineSegments(new THREE.BufferGeometry(),new THREE.LineBasicMaterial({color:0xffdc84,transparent:true,opacity:.5}));
 const fan=new THREE.LineSegments(new THREE.BufferGeometry(),new THREE.LineBasicMaterial({color:0x66f5df,transparent:true,opacity:.22}));
 // Thin display history independently of the analytic acquisition budget.
 const capacity=3000,positions=new Float32Array(capacity*3),colors=new Float32Array(capacity*3);
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(positions,3).setUsage(THREE.DynamicDrawUsage));geometry.setAttribute('color',new THREE.BufferAttribute(colors,3).setUsage(THREE.DynamicDrawUsage));geometry.setDrawRange(0,0);
 const cloud=new THREE.Points(geometry,new THREE.PointsMaterial({size:2,sizeAttenuation:false,vertexColors:true,transparent:true,opacity:.85}));cloud.frustumCulled=false;
 group.add(fov,fan,cloud);group.traverse(o=>o.layers.set(1));
 let budget=lidarBudget(85,17.8816);
 let count=0,cursor=0,lastScan=-Infinity;const previous=new THREE.Vector3(Infinity,0,0),ray=new THREE.Raycaster();
 function lines(object:THREE.LineSegments,points:THREE.Vector3[]){object.geometry.dispose();object.geometry=new THREE.BufferGeometry().setFromPoints(points);}
 function clear(){count=cursor=0;geometry.setDrawRange(0,0);previous.set(Infinity,0,0);lastScan=-Infinity;fan.visible=false;}
 function update(camera:THREE.PerspectiveCamera,position:THREE.Vector3,heading:THREE.Vector3,range:number,active:boolean,scanning:boolean,time:number,showFov:boolean,showLidar:boolean){
  fov.visible=active&&showFov;cloud.visible=showLidar;fan.visible=active&&scanning&&showLidar;
  if(fov.visible){
   // Actual slewed gimbal orientation and current optical FOV; truncated for legibility.
   const length=Math.max(8,Math.min(150,range)),hy=Math.tan(THREE.MathUtils.degToRad(camera.fov/2))*length,hx=hy*camera.aspect;
   const corners=[[-hx,-hy],[hx,-hy],[hx,hy],[-hx,hy]].map(([x,y])=>new THREE.Vector3(x,y,-length).applyQuaternion(camera.quaternion).add(camera.position));
   const edges:THREE.Vector3[]=[];for(let i=0;i<4;i++)edges.push(camera.position.clone(),corners[i],corners[i],corners[(i+1)%4]);lines(fov,edges);
  }
  if(!active||!scanning||!showLidar||time-lastScan<.12||position.distanceTo(previous)<2)return;
  if(Number.isFinite(lastScan)&&time>lastScan)budget=lidarBudget(position.y,position.distanceTo(previous)/(time-lastScan));
  lastScan=time;previous.copy(position);
  const meshes:THREE.Object3D[]=[];const sphere=new THREE.Sphere();
  scene.traverse(obj=>{const m=obj as THREE.Mesh;if(!m.isMesh||!m.visible||m.userData.sensorIgnore)return;for(let p:THREE.Object3D|null=m;p;p=p.parent)if(p===aircraft||p===group||!p.visible)return;
   if(!m.geometry.boundingSphere)m.geometry.computeBoundingSphere();if(!m.geometry.boundingSphere)return;
   sphere.copy(m.geometry.boundingSphere).applyMatrix4(m.matrixWorld);if(sphere.center.distanceTo(position)<sphere.radius+180)meshes.push(m);
  });
  const side=new THREE.Vector3(-heading.z,0,heading.x).normalize(),edges:THREE.Vector3[]=[];
  for(let i=0;i<=24;i++){
   const angle=(i/24-.5)*Math.PI/3;const direction=side.clone().multiplyScalar(Math.sin(angle)).add(new THREE.Vector3(0,-Math.cos(angle),0));
   ray.set(position,direction);ray.far=180;const hit=ray.intersectObjects(meshes,false)[0];
   if(hit?.object.userData.treeId)onReturn?.(hit.object.userData.treeId);
   const point=hit?.point.clone()??position.clone().addScaledVector(direction,position.y/-direction.y);
   if(point.distanceTo(position)>180)continue;point.y+=.15;
   positions.set(point.toArray(),cursor*3);const color=new THREE.Color().setHSL(.48-Math.min(1,Math.max(0,point.y)/60)*.32,.9,.6);colors.set(color.toArray(),cursor*3);
   cursor=(cursor+1)%capacity;count=Math.min(capacity,count+1);if(i%6===0)edges.push(position.clone(),point);
  }
  geometry.setDrawRange(0,count);geometry.attributes.position.needsUpdate=true;geometry.attributes.color.needsUpdate=true;lines(fan,edges);
 }
 return {update,clear,density:()=>budget};
}
