import {lineLength,pointAlong} from './model';
export const CRUISE_KM_S=40*1.609344/3600;
export const concept={batteryWh:2400,flightLoadW:900,flightSolarW:180,parkSolarW:600,hotelW:20,starlinkW:35,uploadMbps:20,captureGBPerMinute:2,taxiSeconds:240,secureSeconds:90};
/** Constant effective solar input, no weather/daylight model. Custom aircraft concept, not Albatross performance. */
export function cycle(flightSeconds:number,inspectionSeconds:number,seconds:number){
 const t=Math.max(0,seconds),air=Math.min(t,flightSeconds),post=Math.max(0,t-flightSeconds),secureAt=concept.taxiSeconds+concept.secureSeconds;
 const usedWh=air/3600*(concept.flightLoadW-concept.flightSolarW),landWh=.95*concept.batteryWh-flightSeconds/3600*(concept.flightLoadW-concept.flightSolarW);
 const chargeW=concept.parkSolarW-concept.hotelW-concept.starlinkW;
 const groundUsed=Math.min(post,secureAt)*120/3600;
 const chargeSeconds=Math.max(0,(.95*concept.batteryWh-landWh+secureAt*120/3600)/chargeW*3600);
 const dataGB=inspectionSeconds/60*concept.captureGBPerMinute,uploadSeconds=dataGB*8000/concept.uploadMbps;
 const serviceSeconds=Math.max(chargeSeconds,uploadSeconds),total=flightSeconds+secureAt+serviceSeconds;
 const service=Math.max(0,post-secureAt),uploadedGB=Math.min(dataGB,service*concept.uploadMbps/8000);
 const battery=Math.max(0,Math.min(100,(.95*concept.batteryWh-usedWh-groundUsed+service*chargeW/3600)/concept.batteryWh*100));
 const stage=post===0?'Flight':post<concept.taxiSeconds?'Taxi to stand':post<secureAt?'Securing anchors':t<total?'Solar charge / Starlink upload':'Ready for next mission';
 return {stage,seconds:t,flightSeconds,total,battery,dataGB,uploadedGB,uploadSeconds,chargeSeconds,secured:post>=secureAt,ready:t>=total,groundSeconds:post,energyShortfall:landWh<0,solarW:post>=secureAt?concept.parkSolarW:post>0?0:concept.flightSolarW};
}
/** Synthetic ground layout aligned with arrival, never an actual airport taxi chart. */
export function taxiLayout(route:number[][]){
 const end=route.at(-1)!,prev=pointAlong(route,Math.max(0,lineLength(route)-.1)),sx=111195*Math.cos(end[1]*Math.PI/180);
 let dx=(end[0]-prev[0])*sx,dy=(end[1]-prev[1])*111195;const len=Math.hypot(dx,dy)||1;dx/=len;dy/=len;
 const point=(forward:number,side:number)=>[end[0]+(dx*forward-dy*side)/sx,end[1]+(dy*forward+dx*side)/111195];
 const control=point(120,0),park=point(160,120);
 const points=Array.from({length:41},(_,i)=>{const t=i/40;return [0,1].map(k=>(1-t)**2*end[k]+2*(1-t)*t*control[k]+t*t*park[k]);});
 return {points,park};
}
