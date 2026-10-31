import type {V3} from './un';
export type TreeKind='unknown'|'oak'|'maple'|'pine'|'cottonwood';
export type DemoTree={id:string;x:number;z:number;height:number;radius:number;form:'rounded'|'conical';zone:boolean;kind:TreeKind};
export type Risk='high'|'growing'|'low';
// Scenario assumptions, not species growth tables or electrical clearance standards.
export const growth:Record<TreeKind,number>={unknown:.8,oak:.4,maple:.7,pine:.6,cottonwood:1.2};
export const riskColors:Record<Risk,string>={high:'#ff6575',growing:'#ffbf64',low:'#78d8ad'};
export function treeCandidates(t:DemoTree){return t.form==='conical'?['Pine / spruce group — verify needles and cones']:['Oak / maple group — verify leaves and bark','Cottonwood possible — verify leaf shape'];}
/** Conservative crown-cylinder envelope against piecewise-linear conductor segments. */
export function crownClearance(tree:DemoTree,spans:V3[][],years=0){
 const g=growth[tree.kind]*years,r=tree.radius+g*.5,top=tree.height+g,bottom=tree.height*.4;
 const gap=(p:V3)=>Math.hypot(Math.max(0,Math.hypot(p[0]-tree.x,p[2]-tree.z)-r),Math.max(0,bottom-p[1],p[1]-top));
 let best=Infinity;
 for(const points of spans)for(let i=1;i<points.length;i++){
  const a=points[i-1],b=points[i];let lo=0,hi=1;
  // Distance to a convex cylinder along a segment is convex; bounded minimization.
  const at=(t:number):V3=>[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,a[2]+(b[2]-a[2])*t];
  for(let j=0;j<18;j++){const u=lo+(hi-lo)/3,v=hi-(hi-lo)/3;if(gap(at(u))<gap(at(v)))hi=v;else lo=u;}
  best=Math.min(best,gap(a),gap(b),gap(at((lo+hi)/2)));
 }
 return best;
}
export function screenTree(tree:DemoTree,spans:V3[][]){const clearance=crownClearance(tree,spans),future=crownClearance(tree,spans,3);const risk:Risk=clearance<2?'high':clearance<6||future<6?'growing':'low';return {clearance,future,risk};}
export type VegetationEvent={id:string;seconds:number;risk:Risk;zone:boolean;category?:'equipment';label?:string};
