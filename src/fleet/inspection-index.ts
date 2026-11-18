/** A demonstration coverage score, not a defect-confidence or safety rating. */
export function inspectionIndex(requiredCaptured:boolean,extras:number){return Math.min(100,(requiredCaptured?80:0)+Math.min(2,extras)*10);}
export function extraCapturePriority(c:{requiredCaptured:boolean;extras:number;flagged:boolean;forward:number;angle:number;range:number;slack:number}){
 if(c.forward<=20||c.angle>35||c.range>1800)return -Infinity;
 const roundTripSeconds=c.angle/15*2+4+1.5+4+4;
 if(c.slack<roundTripSeconds)return -Infinity;
 return (100-inspectionIndex(c.requiredCaptured,c.extras))+(c.flagged?80:0)-c.angle*3-c.range/100;
}

/** Closest corridor segment, in local horizontal meters; works in either flight direction. */
export function currentSpanIndex(points:readonly (readonly number[])[],position:readonly number[]){
 let index=-1,best=Infinity;
 for(let i=0;i<points.length-1;i++){
  const a=points[i],b=points[i+1],dx=b[0]-a[0],dz=b[2]-a[2];
  const t=Math.max(0,Math.min(1,((position[0]-a[0])*dx+(position[2]-a[2])*dz)/(dx*dx+dz*dz||1)));
  const distance=(position[0]-a[0]-t*dx)**2+(position[2]-a[2]-t*dz)**2;
  if(distance<best){best=distance;index=i;}
 }
 return index;
}
