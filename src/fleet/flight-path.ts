import {dubins} from '../planning/dubins';
import {distance, lineLength, type PowerLine, type Airport, type Sortie} from './model';
export const TURN_RADIUS_M=700*0.3048; // User-selected 700 ft radius (213.36 m).
/** Constant-radius, tangent-continuous horizontal approximation, not obstacle clearance. */
export function curvedRoute(coords:number[][], initialHeading?:number){
 const origin=coords[0],scale=111195*Math.cos(origin[1]*Math.PI/180);
 const xy=coords.map(p=>({x:(p[0]-origin[0])*scale,y:(p[1]-origin[1])*111195}));
 const headings=xy.map((p,i)=>{const a=xy[Math.max(0,i-1)],b=xy[Math.min(xy.length-1,i+1)];return Math.atan2(b.y-a.y,b.x-a.x);});
 if(initialHeading!==undefined)headings[0]=initialHeading;
 const corners=new Map<number,{incoming:number;outgoing:number;angle:number}>();
 for(let i=1;i<xy.length-1;i++){
  const a=xy[i-1],b=xy[i],c=xy[i+1],incoming=Math.atan2(b.y-a.y,b.x-a.x),outgoing=Math.atan2(c.y-b.y,c.x-b.x);
  const angle=Math.atan2(Math.sin(outgoing-incoming),Math.cos(outgoing-incoming));
  if(Math.abs(angle)>=Math.PI*80/180&&Math.abs(angle)<=Math.PI*100/180&&Math.min(Math.hypot(b.x-a.x,b.y-a.y),Math.hypot(c.x-b.x,c.y-b.y))>TURN_RADIUS_M*2)corners.set(i,{incoming,outgoing,angle});
 }
 const points:number[][]=[[...origin]],at=[0];let km=0;
 function append(p:{x:number;y:number}){const q=[origin[0]+p.x/scale,origin[1]+p.y/111195];if(distance(points.at(-1)!,q)<1e-9)return;km+=distance(points.at(-1)!,q);points.push(q);}
 for(let i=1;i<xy.length;i++){
  const path=dubins({...xy[i-1],heading:corners.get(i-1)?.outgoing??headings[i-1]},{...xy[i],heading:corners.get(i)?.incoming??headings[i]},TURN_RADIUS_M)[0];
  if(!path)throw new Error('No curved connection');
  for(const p of path.points.slice(1)){
   append(p);
  }
  // Preserve exact endpoint coordinates for arrival/history comparisons.
  points[points.length-1]=[...coords[i]];at.push(km);
  const corner=corners.get(i);
  if(corner){
   // Fly through the junction, turn the long way outside it, then rejoin
   // before the junction on the outbound alignment. Both adjoining spans remain flown.
   const r=TURN_RADIUS_M,d=r*Math.tan(Math.abs(corner.angle)/2),k=-Math.sign(corner.angle),sweep=2*Math.PI-Math.abs(corner.angle);
   const start={x:xy[i].x+d*Math.cos(corner.incoming),y:xy[i].y+d*Math.sin(corner.incoming)};
   const n=Math.ceil(d/6);for(let j=1;j<=n;j++)append({x:xy[i].x+(start.x-xy[i].x)*j/n,y:xy[i].y+(start.y-xy[i].y)*j/n});
   const steps=Math.ceil(sweep*r/6);for(let j=1;j<=steps;j++){const h=corner.incoming+k*sweep*j/steps;append({x:start.x+r/k*(Math.sin(h)-Math.sin(corner.incoming)),y:start.y+r/k*(-Math.cos(h)+Math.cos(corner.incoming))});}
   const end={x:xy[i].x-d*Math.cos(corner.outgoing),y:xy[i].y-d*Math.sin(corner.outgoing)};
   for(let j=1;j<=n;j++)append({x:end.x+(xy[i].x-end.x)*j/n,y:end.y+(xy[i].y-end.y)*j/n});
  }
 }
 return {points,at,length:lineLength(points)};
}
function simplify(coords:number[][]):number[][]{
 if(coords.length<3)return coords;
 const a=coords[0],b=coords.at(-1)!,sx=111195*Math.cos(a[1]*Math.PI/180),sy=111195;
 const dx=(b[0]-a[0])*sx,dy=(b[1]-a[1])*sy,l2=dx*dx+dy*dy;
 let far=0,index=0;
 for(let i=1;i<coords.length-1;i++){const x=(coords[i][0]-a[0])*sx,y=(coords[i][1]-a[1])*sy,t=l2?Math.max(0,Math.min(1,(x*dx+y*dy)/l2)):0,d=Math.hypot(x-t*dx,y-t*dy);if(d>far){far=d;index=i;}}
 return far>25?[...simplify(coords.slice(0,index+1)).slice(0,-1),...simplify(coords.slice(index))]:[a,b];
}
export function curvedSortie(s:Sortie):Sortie{
 const controls=[s.points[0],...simplify(s.points.slice(1,-1)),s.points.at(-1)!];
 const route=curvedRoute(controls);
 return {...s,feasible:route.length<=(s.maxKm??Infinity),points:route.points,length:route.length,inspectionStartKm:route.at[1],inspectionEndKm:route.at.at(-2)!};
}
// Demonstration infrastructure, deliberately separate from observed OSM power lines.
export const downtownLine:PowerLine={id:-1001,operator:'Hypothetical downtown Columbus inspection network',voltage:138000,aep:false,
 coords:Array.from({length:8},(_,i)=>{const lat=39.945+i*.0054;return i%2?[[-82.982,lat],[-83.018,lat]]:[[-83.018,lat],[-82.982,lat]];}).flat()};
export const downtownBase:Airport={id:'SIM-CMH',name:'Hypothetical Columbus staging strip',city:'Columbus',county:'Franklin',coord:[-83.035,39.936],rural:false,runways:[{id:'SIM',lengthFt:2500,surface:'Hypothetical'}],certificated:false};

/** A second inspection direction, with a Dubins turnaround; distance budget still applies. */
export function doublePassSortie(s:Sortie):Sortie{
 const corridor=simplify(s.points.slice(1,-1));if(corridor.length<2)return curvedSortie(s);
 const controls=[s.points[0],...corridor,...corridor.slice(0,-1).reverse(),s.points.at(-1)!];
 const route=curvedRoute(controls);return {...s,points:route.points,length:route.length,inspectionKm:s.inspectionKm*2,inspectionStartKm:route.at[1],inspectionEndKm:route.at.at(-2)!,secondPassKm:route.at[corridor.length],feasible:route.length<=(s.maxKm??Infinity)};
}
