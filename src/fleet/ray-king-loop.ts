import {dubins} from '../planning/dubins';
import {TURN_RADIUS_M} from './flight-path';
import {lineLength} from './model';
/** Repeated centerline passes with explicit fixed-radius endpoint turnarounds. */
export function rayKingLoop(coords:number[][]){
 const origin=coords[0],sx=111195*Math.cos(origin[1]*Math.PI/180);
 const xy=coords.map(p=>({x:(p[0]-origin[0])*sx,y:(p[1]-origin[1])*111195}));
 const headings=xy.map((p,i)=>{const a=xy[Math.max(0,i-1)],b=xy[Math.min(xy.length-1,i+1)];return Math.atan2(b.y-a.y,b.x-a.x);});
 const poses=xy.map((p,i)=>({...p,heading:headings[i]}));
 poses.push(...xy.map((p,i)=>({...p,heading:headings[i]+Math.PI})).reverse(),{...xy[0],heading:headings[0]});
 const points=[coords[0]];
 for(let i=1;i<poses.length;i++){const path=dubins(poses[i-1],poses[i],TURN_RADIUS_M)[0];if(!path)throw Error('Ray–King turnaround unavailable');points.push(...path.points.slice(1).map(p=>[origin[0]+p.x/sx,origin[1]+p.y/111195]));}
 points[points.length-1]=[...coords[0]];return {points,length:lineLength(points)};
}
