export type Coord = [number,number];
export type Airport={id:string;name:string;city:string;county:string;coord:number[];rural:boolean;runways:{id:string;lengthFt:number;surface:string}[];certificated:boolean};
export type PowerLine={id:number;operator:string;voltage:number;aep:boolean;coords:number[][]};
export const MI=1.609344;
export function distance(a:number[],b:number[]){const r=Math.PI/180,dl=(b[0]-a[0])*r,dp=(b[1]-a[1])*r;return 6371*2*Math.asin(Math.min(1,Math.sqrt(Math.sin(dp/2)**2+Math.cos(a[1]*r)*Math.cos(b[1]*r)*Math.sin(dl/2)**2)));}
export const lineLength=(ps:number[][])=>ps.reduce((n,p,i)=>n+(i?distance(ps[i-1],p):0),0);
export function budget(radiusMi:number,nominalKm:number){return Math.min(2*radiusMi*MI,.8*nominalKm);}
export function candidates(airports:Airport[],rural=true){return airports.filter(a=>(!rural||a.rural)&&a.runways.some(r=>r.lengthFt>=2500));}
export type Sample={coord:number[];km:number};
export function samples(lines:PowerLine[]):Sample[]{return lines.flatMap(l=>l.coords.slice(1).flatMap((b,i)=>{const a=l.coords[i],d=distance(a,b),n=Math.max(1,Math.ceil(d/2));return Array.from({length:n},(_,j)=>({coord:[a[0]+(b[0]-a[0])*(j+.5)/n,a[1]+(b[1]-a[1])*(j+.5)/n],km:d/n}));}));}
export function suggestedBases(airports:Airport[],points:Sample[],count:number,radiusKm:number){const selected:Airport[]=[],uncovered=new Set(points.map((_,i)=>i));for(let k=0;k<count;k++){let best:Airport|undefined,score=-1;for(const a of airports){if(selected.includes(a))continue;let gain=0;for(const i of uncovered)if(distance(a.coord,points[i].coord)<=radiusKm)gain+=points[i].km;
// On ties prefer dispersion so additional stations are not clustered.
const separation=selected.length?Math.min(...selected.map(b=>distance(a.coord,b.coord))):0;
const value=gain+separation*.000001;if(value>score){score=value;best=a;}}
if(!best)break;selected.push(best);for(const i of uncovered)if(distance(best.coord,points[i].coord)<=radiusKm)uncovered.delete(i);
}return selected;}
export type Sortie={from:Airport;to:Airport;line:PowerLine;points:number[][];length:number;inspectionKm:number;feasible:boolean};
export function sortie(from:Airport,to:Airport,line:PowerLine,maxKm:number):Sortie {const forward=line.coords,reverse=[...forward].reverse();const paths=[forward,reverse].map(coords=>({coords,total:distance(from.coord,coords[0])+lineLength(coords)+distance(coords.at(-1)!,to.coord)}));const chosen=paths.sort((a,b)=>a.total-b.total)[0];return {from,to,line,points:[from.coord,...chosen.coords,to.coord],length:chosen.total,inspectionKm:lineLength(line.coords),feasible:chosen.total<=maxKm};}
export function bestSortie(bases:Airport[],line:PowerLine,maxKm:number,relocate:boolean){let best:Sortie|undefined;for(const from of bases)for(const to of (relocate?bases.filter(a=>a.id!==from.id):[from])){const s=sortie(from,to,line,maxKm);if(!best||s.length<best.length)best=s;}return best;}
export function pointAlong(ps:number[][],km:number){for(let i=1;i<ps.length;i++){const d=distance(ps[i-1],ps[i]);if(km<=d){const t=d?km/d:0;return [ps[i-1][0]+(ps[i][0]-ps[i-1][0])*t,ps[i-1][1]+(ps[i][1]-ps[i-1][1])*t];}km-=d;}return ps.at(-1)!;}
