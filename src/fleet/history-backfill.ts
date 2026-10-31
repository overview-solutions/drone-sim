import {distance} from './model';
/** Earliest modeled passage near an asset; does not bridge unflown route portions. */
export function assetPassages(route:number[][],assets:number[][]){
 const km=[0];for(let i=1;i<route.length;i++)km.push(km[i-1]+distance(route[i-1],route[i]));
 return assets.map(asset=>{let best=Infinity,at=Infinity;route.forEach((p,i)=>{const d=distance(p,asset);if(d<best){best=d;at=km[i];}});return best<=.15?at:Infinity;});
}
