/** Illustrative steady-state heat balance. Not IEEE 738 / clearance certification. */
export function spanRating(index:number,seconds:number,kv:number){
 const ambient=26+5*Math.sin(seconds/900+index*.3),wind=1.2+.9*Math.sin(seconds/600+index*.7),solar=650+150*Math.sin(seconds/1200);
 const diameter=.028,resistance=.00009,maxTemp=75;
 const convection=(4+8*Math.sqrt(Math.max(0,wind)))*(maxTemp-ambient)*diameter;
 const radiation=.5*Math.PI*diameter*5.670374419e-8*((maxTemp+273.15)**4-(ambient+273.15)**4);
 const heating=.5*solar*diameter;
 const amps=Math.sqrt(Math.max(0,convection+radiation-heating)/resistance);
 return {ambient,wind,solar,amps,mva:kv>0?Math.sqrt(3)*kv*amps/1000:null,maxTemp};
}
export function limitingRating(indices:number[],seconds:number,kv:number){return indices.map(index=>({index,...spanRating(index,seconds,kv)})).reduce((a,b)=>b.amps<a.amps?b:a);}

export const voltageClasses=[34.5,69,115,138,161,230,345,500,765];
const checks=['Phase spacing','Ground / sag','Insulation','Hardware'];
/** Seeded design envelopes only; no engineering acceptance thresholds. */
export function voltageReview(indices:number[],kv:number){
 if(!indices.length||!(kv>0)||kv>765)return null;
 const base=voltageClasses.findIndex(v=>v>=kv);
 const limits=checks.map((label,j)=>indices.map(span=>({label,span,kv:voltageClasses[Math.min(8,base+(span*3+j*7)%4)]})).reduce((a,b)=>a.kv<b.kv?a:b));
 const highest=Math.min(...limits.map(c=>c.kv));return {limits,highest,next:voltageClasses.find(v=>v>highest)??highest};
}
export function ratingGraphic(indices:number[],kv:number,seconds:number,label:string,observed:number,complete:number,issues:number){
 const v=voltageReview(indices,kv),r=limitingRating(indices,seconds,kv);
 if(!v)return '<b>Voltage design model unavailable</b>';
 const ladder=voltageClasses.map(k=>'<div class="voltage-step '+(k<=v.highest?'meets':'blocked')+(k===v.highest?' highest':'')+'"><span>'+(k<=v.highest?'✓':'×')+'</span><b>'+k+'</b></div>').join('');
 const bars=v.limits.map(c=>'<div class="rating-check '+(c.kv<v.next?'blocked':'meets')+'"><div>'+ (c.kv<v.next?'⊘ ':'✓ ')+c.label+' <button data-rating-span="'+c.span+'">T'+(c.span+1)+'–T'+(c.span+2)+' ↗</button></div><div class="rating-meter"><i style="width:'+Math.min(100,c.kv/v.next*100)+'%"></i></div><small>'+c.kv+' kV envelope · '+(c.kv<v.next?'blocks ':'supports ')+v.next+' kV</small></div>').join('');
 return '<div class="rating-heading"><b>'+label+'</b><span>HYPOTHETICAL DESIGN</span><details><summary>ⓘ</summary><div>Seeded voltage envelopes, not measured clearances or utility criteria. Actual qualification is unverified. DLR is a separate simplified thermal calculation using synthetic weather. No operating approval.</div></details></div><div class="rating-main"><div class="rating-hero"><small>Scenario ceiling</small><strong>'+v.highest+' <small>kV</small></strong><small>Verified rating: —</small></div><div class="rating-ladder"><div class="voltage-steps">'+ladder+'</div><small>Voltage class · kV</small></div><div class="rating-hero"><small>Simulated thermal DLR</small><strong>'+Math.round(r.amps)+' <small>A</small></strong><small>'+(r.mva?.toFixed(1)??'—')+' MVA @ '+kv+' kV</small></div></div><div class="rating-checks">'+bars+'</div><div class="rating-evidence"><span>◉ LiDAR '+observed+'/'+indices.length+'</span><span>▣ Imagery '+complete+'/'+indices.length+'</span><span>⚑ '+issues+' findings</span><span>☀ '+r.ambient.toFixed(0)+'°C · ≋ '+r.wind.toFixed(1)+' m/s</span></div>';
}
