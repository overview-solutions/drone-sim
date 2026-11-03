/** Stable fictional history for the concept demo; no utility records are implied. */
export function assetHistory(id:string,vegetation:boolean){
 let hash=2166136261;for(const c of id)hash=Math.imul(hash^c.charCodeAt(0),16777619)>>>0;
 const age=vegetation?5+hash%13:8+hash%30,start=2026-age;
 const events=vegetation?[
 {date:`${start}-04-15`,title:'First corridor inventory',kind:'inspection'},
 {date:'2020-08-19',title:'Wind exposure noted',kind:'weather'},
 {date:'2022-03-10',title:'Selective pruning',kind:'maintenance'},
 {date:'2024-06-18',title:'Canopy resurvey',kind:'inspection'},
 {date:'2025-09-22',title:'Growth review',kind:'inspection'},
 ]:[
 {date:`${start}-06-01`,title:'Placed in service',kind:'service'},
 {date:'2018-02-12',title:'Ice-loading exposure',kind:'weather'},
 {date:'2020-07-09',title:'Storm patrol · no outage recorded',kind:'inspection'},
 {date:'2022-05-16',title:'Hardware inspection / tightening',kind:'maintenance'},
 {date:'2024-08-03',title:'High-load thermal inspection',kind:'inspection'},
 {date:'2025-10-21',title:'Condition review',kind:'inspection'},
 ];
 const filtered=events.filter(e=>Number(e.date.slice(0,4))>=start).sort((a,b)=>a.date.localeCompare(b.date));
 const trend=Array.from({length:5},(_,i)=>vegetation?Math.max(.5,6.5-i*.7-(hash%10)*.08):Math.max(35,96-i*(3+hash%4)));
 return {asOf:'2026-11-01',age,start,referenceLife:vegetation?undefined:45,events:filtered,trend,metric:vegetation?'Canopy gap':'Condition index',unit:vegetation?'m':'/100'};
}
export function historyCard(id:string,vegetation:boolean){
 const h=assetHistory(id,vegetation),section=document.createElement('section');section.className='asset-history';
 const header=document.createElement('div');header.className='asset-history-heading';header.innerHTML='<strong>Component history</strong><small>HYPOTHETICAL · as of '+h.asOf+'</small>';section.append(header);
 const metrics=document.createElement('div');metrics.className='asset-history-metrics';
 const age=document.createElement('div');age.innerHTML='<b>'+h.age+' yr</b><span>'+(vegetation?'Since first inventory':'In service')+' · '+h.start+'</span>';metrics.append(age);
 if(h.referenceLife){const life=document.createElement('div');life.innerHTML='<b>'+h.referenceLife+' yr</b><span>Illustrative planning life</span><progress max="'+h.referenceLife+'" value="'+h.age+'"></progress>';life.title='Scenario assumption, not remaining useful life or manufacturer rating';metrics.append(life);}
 const trend=document.createElement('div'),max=vegetation?8:100;trend.innerHTML='<b>'+h.trend.at(-1)!.toFixed(vegetation?1:0)+' '+h.unit+'</b><span>'+h.metric+' · 2022–2026</span>';
 const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 160 32');svg.setAttribute('role','img');svg.setAttribute('aria-label',h.metric+' hypothetical annual values: '+h.trend.join(', '));const line=document.createElementNS(svg.namespaceURI,'polyline');line.setAttribute('points',h.trend.map((v,i)=>`${i*38+4},${30-v/max*28}`).join(' '));line.setAttribute('fill','none');line.setAttribute('stroke','#e8b45b');line.setAttribute('stroke-width','2');svg.append(line);trend.append(svg);metrics.append(trend);section.append(metrics);
 const events=document.createElement('ol');events.className='asset-history-events';for(const e of h.events){const item=document.createElement('li');item.dataset.kind=e.kind;const time=document.createElement('time');time.dateTime=e.date;time.textContent=e.date;const text=document.createElement('span');text.textContent=e.title;item.append(time,text);events.append(item);}section.append(events);
 const note=document.createElement('small');note.textContent=vegetation?'Species, growth and clearance require field verification.':'Actual installation date, loading, faults and maintenance records are not connected. No remaining-life prediction.';section.append(note);return section;
}
