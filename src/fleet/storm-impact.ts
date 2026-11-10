import * as THREE from 'three';
import type {PowerLine} from './model';

function inside(point:number[],ring:number[][]) {
 let result=false;
 for(let i=0,j=ring.length-1;i<ring.length;j=i++){
  const a=ring[i],b=ring[j];
  if((a[1]>point[1])!==(b[1]>point[1])&&point[0]<(b[0]-a[0])*(point[1]-a[1])/(b[1]-a[1])+a[0])result=!result;
 }
 return result;
}
/** Clip each line segment to polygon interiors, including both boundary crossings. */
export function impactedSegments(lines:PowerLine[],rings:number[][][]) {
 const result:{lineId:number;start:number[];end:number[]}[]=[];
 for(const line of lines)for(let i=1;i<line.coords.length;i++){
  const a=line.coords[i-1],b=line.coords[i],dx=b[0]-a[0],dy=b[1]-a[1],cuts=[0,1];
  for(const ring of rings)for(let j=1;j<ring.length;j++){
   const c=ring[j-1],d=ring[j],ex=d[0]-c[0],ey=d[1]-c[1],det=dx*ey-dy*ex;
   if(Math.abs(det)<1e-15)continue;
   const t=((c[0]-a[0])*ey-(c[1]-a[1])*ex)/det,u=((c[0]-a[0])*dy-(c[1]-a[1])*dx)/det;
   if(t>0&&t<1&&u>=0&&u<=1)cuts.push(t);
  }
  cuts.sort((a,b)=>a-b);
  const point=(t:number)=>[a[0]+dx*t,a[1]+dy*t];
  for(let j=1;j<cuts.length;j++){
   if(cuts[j]-cuts[j-1]<1e-10)continue;
   if(rings.some(r=>inside(point((cuts[j]+cuts[j-1])/2),r)))result.push({lineId:line.id,start:point(cuts[j-1]),end:point(cuts[j])});
  }
 }
 return result;
}
export function stormImpact(group:THREE.Group,rings:number[][][],lines:PowerLine[],project:(p:number[])=>THREE.Vector3){
 for(const ring of rings){
  const shape=new THREE.Shape(ring.map(p=>{const v=project(p);return new THREE.Vector2(v.x,-v.z);}));
  const geometry=new THREE.ShapeGeometry(shape);geometry.rotateX(-Math.PI/2);
  const fill=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({color:0xff5968,transparent:true,opacity:.28,side:THREE.DoubleSide,depthWrite:false}));
  fill.position.y=1;group.add(fill);
 }
 const impacts=impactedSegments(lines,rings);
 for(const impact of impacts){
  const a=project(impact.start).setY(12),b=project(impact.end).setY(12);
  group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([a,b]),new THREE.LineBasicMaterial({color:0xff263f,depthTest:false})));
  const marker=new THREE.Mesh(new THREE.OctahedronGeometry(100),new THREE.MeshBasicMaterial({color:0xff263f,depthTest:false}));
  marker.position.copy(a).add(b).multiplyScalar(.5);group.add(marker);
 }
 return impacts;
}
