import {Vector3} from 'three';
import {dubins} from '../planning/dubins';
import {TURN_RADIUS_M} from './flight-path';
export type Intruder={position:Vector3;velocity:Vector3};
export type Escape={points:Vector3[];length:number;reason:string};
export function separation(p:Vector3,a:Vector3,b:Vector3){const d=b.clone().sub(a);return p.distanceTo(a.clone().addScaledVector(d,Math.max(0,Math.min(1,p.clone().sub(a).dot(d)/(d.lengthSq()||1)))));}
export function validateEscape(points:Vector3[],wires:Vector3[][],intruder?:Intruder){
 let meters=0;
 for(let i=0;i<points.length;i++){
  const p=points[i];if(i)meters+=p.distanceTo(points[i-1]);
  if(p.y<20)return 'Below synthetic 20 m terrain floor';
  let horizontal=Infinity,clearance=Infinity;
  for(const line of wires)for(let j=1;j<line.length;j++){
   clearance=Math.min(clearance,separation(p,line[j-1],line[j]));
   horizontal=Math.min(horizontal,separation(new Vector3(p.x,0,p.z),new Vector3(line[j-1].x,0,line[j-1].z),new Vector3(line[j].x,0,line[j].z)));
  }
  if(clearance<20)return 'Within 20 m of modeled conductor';
  if(horizontal>213.36)return 'Outside 700 ft lateral envelope';
  if(intruder){const q=intruder.position.clone().addScaledVector(intruder.velocity,meters/17.88);if(Math.hypot(p.x-q.x,p.z-q.z)<120&&Math.abs(p.y-q.y)<35)return 'Predicted traffic proximity';}
 }
 return '';
}
export function planEscape(start:Vector3,heading:number,targets:{point:Vector3;heading:number;label:string}[],wires:Vector3[][],intruder?:Intruder,radius=TURN_RADIUS_M){
 const accepted:Escape[]=[];const rejected=new Set<string>();
 for(const target of targets)for(const path of dubins({x:start.x,y:start.z,heading},{x:target.point.x,y:target.point.z,heading:target.heading},radius)){
  // Limit vertical rate to 2 m/s at the scenario's 40 mph.
  if(Math.abs(target.point.y-start.y)>path.length/17.88*2){rejected.add('Descent rate exceeds 2 m/s');continue;}
  const points=path.points.map((p,i)=>new Vector3(p.x,start.y+(target.point.y-start.y)*i/(path.points.length-1),p.y));
  const reason=validateEscape(points,wires,intruder);if(reason)rejected.add(reason);else accepted.push({points,length:path.length,reason:target.label});
 }
 accepted.sort((a,b)=>a.length-b.length);
 return {best:accepted[0],rejected:[...rejected]};
}
