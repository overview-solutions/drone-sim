import {Vector3} from 'three';
export type CrossingSource={id:string;kind:string;points:Vector3[];synthetic?:boolean};
/** Segment intersection in the ground plane. Collinear lines are not crossings. */
export function crossingPoint(a:Vector3,b:Vector3,c:Vector3,d:Vector3){const x=b.x-a.x,z=b.z-a.z,u=d.x-c.x,v=d.z-c.z,den=x*v-z*u;if(Math.abs(den)<1e-8)return;const t=((c.x-a.x)*v-(c.z-a.z)*u)/den,s=((c.x-a.x)*z-(c.z-a.z)*x)/den;if(t<0||t>1||s<0||s>1)return;return a.clone().lerp(b,t);}
export function spanCrossings(a:Vector3,b:Vector3,sources:CrossingSource[],index:number){
 const found:CrossingSource[]=[];
 for(const source of sources){for(let j=1;j<source.points.length;j++){const p=source.points[j-1],q=source.points[j],at=crossingPoint(a,b,p,q);if(!at)continue;const dir=q.clone().sub(p).normalize(),before=Math.min(180,at.clone().setY(p.y).distanceTo(p)),after=Math.min(180,at.clone().setY(q.y).distanceTo(q));at.y=source.kind==='power'?25:2;found.push({...source,points:[at.clone().addScaledVector(dir,-before),at.clone().addScaledVector(dir,after)]});break;}}
 // Offline fixtures explicitly separate from observed OSM geometry.
 if(index%3===0){const delta=b.clone().sub(a),at=a.clone().lerp(b,.55),dir=new Vector3(-delta.z,0,delta.x).normalize();const kind=index%9===0?'power':index%6===0?'rail':'road';at.y=kind==='power'?25:2;found.push({id:'Demo '+kind+' crossing',kind,synthetic:true,points:[at.clone().addScaledVector(dir,-180),at.clone().addScaledVector(dir,180)]});}
 return found;
}
