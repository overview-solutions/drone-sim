/** A display/hit-test corridor, not a clearance or flight authorization boundary. */
export function corridorRing(a:number[],b:number[],halfWidth=40,steps=12):number[][]{
 if(!(halfWidth>0)||!Number.isFinite(halfWidth))throw Error('Corridor width must be positive');
 const angle=Math.atan2(b[1]-a[1],b[0]-a[0]);
 if(Math.hypot(b[0]-a[0],b[1]-a[1])<.01)return [];
 const ring:number[][]=[];
 for(let i=0;i<=steps;i++){const t=angle+Math.PI/2+i/steps*Math.PI;ring.push([a[0]+Math.cos(t)*halfWidth,a[1]+Math.sin(t)*halfWidth]);}
 for(let i=0;i<=steps;i++){const t=angle-Math.PI/2+i/steps*Math.PI;ring.push([b[0]+Math.cos(t)*halfWidth,b[1]+Math.sin(t)*halfWidth]);}
 ring.push([...ring[0]]);return ring;
}
export function segmentDistance(point:number[],a:number[],b:number[]){
 const dx=b[0]-a[0],dy=b[1]-a[1],length=dx*dx+dy*dy;
 const t=length?Math.max(0,Math.min(1,((point[0]-a[0])*dx+(point[1]-a[1])*dy)/length)):0;
 return Math.hypot(point[0]-a[0]-dx*t,point[1]-a[1]-dy*t);
}
