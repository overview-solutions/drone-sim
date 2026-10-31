import * as THREE from 'three';
export const scanClasses={broadleaf:0x71cf8d,conifer:0x39a99a,snag:0xcbb695,rock:0xb69ad5,built:0xefb76d};
export async function obstacleCloud(a:THREE.Vector3,b:THREE.Vector3,count:number,seed:number,cancelled:()=>boolean){
 const axis=b.clone().sub(a);axis.y=0;const length=axis.length();axis.normalize();const normal=new THREE.Vector3(-axis.z,0,axis.x);
 const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 const objects=Array.from({length:28},(_,i)=>({kind:(i%7<3?'broadleaf':i%7===3?'conifer':i%7===4?'snag':i%7===5?'rock':'built') as keyof typeof scanClasses,along:(i+.5)/28*length,side:(i%2?1:-1)*(24+random()*30),height:12+random()*20,width:4+random()*6}));
 const data=Object.fromEntries(Object.keys(scanClasses).map(k=>[k,[] as number[]])) as Record<keyof typeof scanClasses,number[]>;
 for(let offset=0;offset<count;offset+=3000){if(cancelled())return null;
 for(let j=offset;j<Math.min(count,offset+3000);j++){const o=objects[j%objects.length],angle=random()*Math.PI*2;let x=0,y=0,z=0;
 if(o.kind==='built'){const w=o.width,h=4+o.height*.2;const face=Math.floor(random()*5);x=(random()-.5)*w*2;z=(random()-.5)*w;y=random()*h;if(face===0)y=h;else if(face===1)x=w;else if(face===2)x=-w;else if(face===3)z=w/2;else z=-w/2;}
 else if(o.kind==='rock'){const elevation=random()*Math.PI/2,r=o.width*(.8+.2*Math.sin(angle*5));x=Math.cos(angle)*Math.cos(elevation)*r;z=Math.sin(angle)*Math.cos(elevation)*r*.65;y=Math.sin(elevation)*o.width*.7;}
 else if(o.kind==='snag'||random()<.18){y=random()*o.height;const branch=random()<.3;const r=branch?o.width*(1-y/o.height)*random():.25;x=Math.cos(angle)*r;z=Math.sin(angle)*r;}
 else {const t=random(),r=o.kind==='conifer'?o.width*(1-t):o.width*Math.sqrt(Math.max(0,1-(2*t-1)**2))*(.8+.2*Math.sin(angle*7));y=o.height*(.3+.7*t);x=Math.cos(angle)*r;z=Math.sin(angle)*r;}
 const p=a.clone().addScaledVector(axis,o.along+x).addScaledVector(normal,o.side+z);p.y=y+.15+(random()-.5)*.12;data[o.kind].push(p.x,p.y,p.z);
 }await new Promise<void>(resolve=>setTimeout(resolve,0));}
 return data;
}
