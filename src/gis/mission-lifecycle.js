const week=7*86400000;
export function missionAppearance(mission,stage='operations',now=Date.now()){
 const start=Date.parse(mission?.start),end=Date.parse(mission?.end);
 const status=String(mission?.status??mission?.result??'').toLowerCase();
 const completed=Number.isFinite(end)&&end<=now||/completed|success|failed|cancelled|canceled|aborted/.test(status);
 const planned=!completed&&(/planned|scheduled|draft|queued/.test(status)||Number.isFinite(start)&&start>now);
 const active=!completed&&!planned&&(/active|running|in_progress/.test(status)||Number.isFinite(start)&&start<=now);
 const state=completed?'completed':planned?'planned':active?'active':'unknown';
 const age=Number.isFinite(end)?Math.max(0,now-end):null;
 const opacity=state==='completed'?(age===null?.3:Math.max(.2,1-.8*age/week)):1;
 return {state,opacity,visible:stage==='review'?state==='completed':stage==='planning'?state==='planned':state==='planned'||state==='active'||state==='completed'&&age!==null&&age<=week,ageDays:age===null?null:age/86400000};
}
