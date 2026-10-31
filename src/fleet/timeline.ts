import type {ReviewTimeline} from './review-navigation';
import {riskColors,type VegetationEvent} from './vegetation-model';
import type {WorldData} from './world';
import type {Vehicle} from './operations';
import {cycle,concept} from './turnaround';
const colors={altitude:'#74d8f3',battery:'#ffc66c',data:'#bc9dff',upload:'#6de1ad',solar:'#efea75'};
export function missionTimeline(host:HTMLElement,data:WorldData,vegetationEvents:()=>VegetationEvent[]=()=>[],selectTree?:(id:string)=>void,review?:ReviewTimeline){
 const panel=document.createElement('section');panel.className='mission-timeline collapsed';host.append(panel);
 panel.innerHTML=`<div class="timeline-title"><strong>Profile</strong><div class="profile-levels"><button data-level="Mission">Mission</button><button data-level="SOCC">SOCC</button><button data-level="Span">Span</button></div><b class="profile-scope"></b><span class="timeline-current">Select an aircraft</span><button class="timeline-collapse">Show profile</button></div><div class="timeline-body"><div class="timeline-options"><label>Window <select class="timeline-window"><option value="flight">Flight + airport arrival</option><option value="cycle">Full turnaround</option></select></label><details><summary>Add / remove layers</summary><div>${['altitude','battery','data','upload','solar','communications','socc','vegetation','equipment'].map(k=>`<label><input type="checkbox" value="${k}" ${['altitude','battery','communications','socc','vegetation','equipment'].includes(k)?'checked':''}> ${k==='socc'?'SOCC sectors':k}</label>`).join('')}</div></details><details><summary>Concept assumptions</summary><div>2.4 kWh battery · 900 W flight load · 180 W effective airborne solar · 600 W parked solar · 55 W parked loads · 20 Mbps upload · constant sunlight · no airport approval or mechanical validation</div></details><button data-jump="launch">Launch</button><button data-jump="approach">Approach</button><button data-jump="taxi">Taxi</button><button data-jump="secure">Secure</button><button data-jump="ready">Ready</button><button data-jump="live">Back to live</button></div><div class="profile-edges" aria-label="SOCC boundary components"></div><div class="timeline-plot"><div class="timeline-sectors"></div><svg class="timeline-chart" viewBox="0 0 1000 165" preserveAspectRatio="none" role="img" aria-label="Simulated mission phases and selectable parameter profiles"></svg></div><input class="timeline-scrub" aria-label="Preview mission time" type="range" min="0" max="1" step="1" value="0"><div class="risk-breadcrumbs" aria-label="Vegetation risk breadcrumbs"></div><div class="timeline-legend"></div><small>CONCEPT SIMULATION · solid = elapsed, dashed = forecast · separate normalized scales · communications are scenario markers, no messages or clearances. Release the slider to resume the preview; Back to live restores the saved aircraft.</small></div>`;
 const ratingHost=document.createElement('div');ratingHost.className='profile-rating';const workspace=document.createElement('div');workspace.className='profile-workspace';const body=panel.querySelector('.timeline-body')!;body.before(workspace);workspace.append(body,ratingHost);
 panel.querySelectorAll<HTMLButtonElement>('[data-level]').forEach(b=>b.onclick=()=>{review?.level?.(b.dataset.level!);last=0;});
 let vehicle:Vehicle|undefined,last=0,scrubbing=false;const chart=panel.querySelector('svg')!,scrub=panel.querySelector('input.timeline-scrub') as HTMLInputElement;
 const mode=panel.querySelector('.timeline-window') as HTMLSelectElement;
 chart.addEventListener('click',e=>{const id=(e.target as Element).closest('[data-socc]')?.getAttribute('data-socc');if(id)review?.select(id);});
 chart.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){const id=(e.target as Element).closest('[data-socc]')?.getAttribute('data-socc');if(id){e.preventDefault();review?.select(id);}}});

 function seek(t:number|null){if(vehicle)data.previewMission?.(vehicle.id,t);last=0;}
 panel.querySelector('.timeline-collapse')!.addEventListener('click',e=>{const hidden=panel.classList.toggle('collapsed');(e.target as HTMLElement).textContent=hidden?'Show profile':'Hide profile';});
 panel.querySelectorAll<HTMLInputElement>('input[type=checkbox]').forEach(e=>e.onchange=()=>last=0);mode.onchange=()=>last=0;
 scrub.oninput=()=>{scrubbing=true;seek(Number(scrub.value));};
 scrub.onchange=()=>{scrubbing=false;if(vehicle&&!data.fleetState?.().running)data.toggleFleet?.();};
 panel.querySelectorAll<HTMLButtonElement>('[data-jump]').forEach(b=>b.onclick=()=>{if(!vehicle)return;const t=vehicle.timeline;const jumps:Record<string,number|null>={launch:0,approach:Math.max(0,t.flightSeconds-60),taxi:t.flightSeconds+1,secure:t.flightSeconds+concept.taxiSeconds+1,ready:t.total,live:null};if(b.dataset.jump==='ready')mode.value='cycle';seek(jumps[b.dataset.jump!]);});
 const fmt=(s:number)=>`${Math.floor(s/3600)}h ${Math.floor(s%3600/60)}m`;
 function render(v:Vehicle){const t=v.timeline,flight=t.flightSeconds,scope=review?.scope?.(),zoom=scope&&scope.level!=='Mission';
 const start=zoom?scope.start*flight:0,end=zoom?Math.max(start+1,scope.end*flight):mode.value==='cycle'?t.total:flight+concept.taxiSeconds+concept.secureSeconds+60,duration=end-start;
 panel.querySelector('.profile-scope')!.textContent=scope?.label??'';panel.querySelectorAll<HTMLButtonElement>('[data-level]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.level===(scope?.level??'Mission'))));
 scrub.min=String(Math.floor(start));
 scrub.max=String(Math.ceil(end));if(!scrubbing)scrub.value=String(Math.min(end,t.seconds));
 panel.querySelector('.timeline-current')!.textContent=`${v.id} · ${v.conceptPreview?'PLAN PREVIEW':v.replaying?'HISTORY':'LIVE'} · ${v.stage} · ${fmt(t.seconds)} · battery ${t.battery.toFixed(0)}%${t.energyShortfall?' · ENERGY BUDGET EXCEEDED':''}`;
 const enabled=new Set(Array.from(panel.querySelectorAll<HTMLInputElement>('input[type=checkbox]:checked')).map(e=>e.value));
 const x=(s:number)=>Math.max(0,Math.min(1000,(s-start)/duration*1000));let svg='';
 const phases:[[number,number,string,string],[number,number,string,string],...Array<[number,number,string,string]>]=[[0,Math.min(60,flight),'Launch','#355863'],[Math.min(60,flight),Math.max(60,flight-60),'Inspect / transit','#294e46'],[Math.max(60,flight-60),flight,'Land','#355863'],[flight,flight+240,'Taxi','#695b35'],[flight+240,flight+330,'Secure','#645071'],[flight+330,t.total,'Solar + upload','#344e4e']];
 for(const [a,b,label,color] of phases){if(a>=end)continue;svg+=`<rect x="${x(a)}" y="0" width="${x(b)-x(a)}" height="22" fill="${color}"/><text x="${x(a)+4}" y="15" fill="#e3eeee" font-size="10">${x(b)-x(a)>75?label:''}</text>`;}
 for(let i=0;i<=4;i++)svg+=`<line x1="${i*250}" x2="${i*250}" y1="24" y2="145" stroke="#58717b" opacity=".3"/><text x="${Math.min(950,i*250)}" y="161" fill="#a5b9c1" font-size="10">${fmt(start+duration*i/4)}</text>`;
 const legend:string[]=[];
 for(const key of Object.keys(colors) as Array<keyof typeof colors>){if(!enabled.has(key))continue;const points:Array<[number,number]>=[];
 for(let i=0;i<=240;i++){const s=start+duration*i/240,c=cycle(flight,t.dataGB/concept.captureGBPerMinute*60,s),air=Math.min(1,s/flight);const val=key==='altitude'?Math.max(0,Math.min(1,(s-11.18)/39.15,(flight-s-11.18)/39.15)):key==='battery'?c.battery/100:key==='solar'?c.solarW/600:key==='upload'?c.uploadedGB/Math.max(1,t.dataGB):Math.max(0,Math.min(1,(s-v.inspectionStartSeconds)/Math.max(1,v.inspectionEndSeconds-v.inspectionStartSeconds)));
 points.push([x(s),126-Math.max(0,Math.min(1,val))*90]);}
 const path=(p:Array<[number,number]>)=>p.map(a=>a.join(',')).join(' ');const split=Math.min(points.length-1,Math.max(0,Math.floor((t.seconds-start)/duration*240)));
 svg+=`<polyline points="${path(points.slice(0,split+1))}" fill="none" stroke="${colors[key]}" stroke-width="2"/><polyline points="${path(points.slice(split))}" fill="none" stroke="${colors[key]}" stroke-width="1.5" stroke-dasharray="4 4" opacity=".65"/>`;
 legend.push(`<span style="color:${colors[key]}">${key} · 0–${key==='altitude'?'85 m AGL':key==='battery'?'100%':key==='solar'?'600 W':t.dataGB.toFixed(0)+' GB'}</span>`);
 }


 const edgeHost=panel.querySelector<HTMLElement>('.profile-edges')!;
 const edges=(scope?.edges??[]).filter(e=>flight*e.at>=start-.01&&flight*e.at<=end+.01);
 for(const old of Array.from(edgeHost.children))if(!edges.some(e=>e.id===(old as HTMLElement).dataset.edge))old.remove();
 edges.forEach((edge,i)=>{let b=edgeHost.querySelector<HTMLButtonElement>('[data-edge="'+edge.id+'"]');if(!b){b=document.createElement('button');b.dataset.edge=edge.id;b.onclick=()=>review?.open?.(edge.id);edgeHost.append(b);}b.textContent=edge.label;b.title=edge.description+' · click to focus · simulated boundary';b.setAttribute('aria-label','Focus boundary '+edge.label);const percent=x(flight*edge.at)/10;b.style.left=percent+'%';b.style.transform=percent<10?'none':percent>90?'translateX(-100%)':'translateX(-50%)';b.style.top=(i%2)*22+'px';});
 edgeHost.hidden=!edges.length;
 const sectorHost=panel.querySelector('.timeline-sectors')!;const sectors=enabled.has('socc')?scope?.items??(review?.sectors()??[]).map(s=>({...s,label:s.id})):[];
 for(const old of Array.from(sectorHost.children))if(!sectors.some(s=>s.id===(old as HTMLElement).dataset.socc))old.remove();
 for(const sector of sectors){let button=sectorHost.querySelector<HTMLButtonElement>(`[data-socc="${sector.id}"]`);if(!button){button=document.createElement('button');button.dataset.socc=sector.id;button.onclick=()=>review?.open?review.open(sector.id):review?.select(sector.id);sectorHost.append(button);}
 button.textContent=sector.label;button.title=sector.label;button.setAttribute('aria-label','Focus '+sector.id+': '+sector.label);button.style.background=sector.color;button.style.left=(x(flight*sector.start)/10)+'%';button.style.width=Math.max(2,(x(flight*sector.end)-x(flight*sector.start))/10)+'%';}

 if(enabled.has('communications')){legend.push('<span>Prior day: deconflict request → NOTAM/TFR review → SOCC acknowledgment → airport coordination (all hypothetical)</span>');for(const [s,label] of [[0,'Preflight / SOCC start'],[flight*.33,'SOCC handoff'],[flight*.66,'SOCC handoff'],[Math.max(0,flight-60),'Airport / CTAF'],[flight+240,'Runway clear / closeout']] as Array<[number,string]>){if(s<start||s>end)continue;svg+=`<line x1="${x(s)}" x2="${x(s)}" y1="24" y2="125" stroke="#f08caa" opacity=".6"/><text x="${Math.min(880,x(s)+3)}" y="${s===0?33:46}" fill="#efb1c4" font-size="9">${mode.value==='flight'?label:''}</text>`;}}
 svg+=`<line x1="${x(t.seconds)}" x2="${x(t.seconds)}" y1="0" y2="146" stroke="white" stroke-width="2" pointer-events="none"/>`;chart.innerHTML=svg;panel.querySelector('.timeline-legend')!.innerHTML=legend.join('');
 const crumbs=panel.querySelector('.risk-breadcrumbs')!;const position=(e:VegetationEvent)=>review?.eventPosition?.(e);const eventTime=(e:VegetationEvent)=>scope?.level==='Mission'?e.seconds:(position(e)?.at??0)*flight;const events=vegetationEvents().filter(e=>eventTime(e)>=start&&eventTime(e)<=end).filter(e=>enabled.has(e.category==='equipment'?'equipment':'vegetation'));
 const signature=(scope?.label??'')+events.map(e=>`${e.id}:${e.risk}:${e.zone}`).join('|');
 if(crumbs.getAttribute('data-signature')!==signature){crumbs.setAttribute('data-signature',signature);crumbs.replaceChildren();
 for(const e of events){const b=document.createElement('button');b.className='risk-crumb';b.style.borderColor=e.zone?'#df8aff':riskColors[e.risk];b.style.color=riskColors[e.risk];b.textContent=`◆ ${fmt(e.seconds)} · ${e.label??e.id} · ${e.risk==='growing'&&e.category==='equipment'?'medium':e.risk}${e.zone?' · exclusion':''}`;b.title=e.category==='equipment'?'Review simulated equipment finding':'Review synthetic canopy assessment';b.onclick=()=>{const p=position(e);if(scope?.level!=='Mission'&&p)review?.open?.('span:'+p.span);else seek(e.seconds+3);selectTree?.(e.id);};crumbs.append(b);}}
 if(events.length){for(const e of events){const mark=document.createElementNS('http://www.w3.org/2000/svg','circle');mark.setAttribute('cx',String(x(eventTime(e))));mark.setAttribute('cy','119');mark.setAttribute('r','4');mark.setAttribute('fill',riskColors[e.risk]);chart.append(mark);}}

 }
 return {ratingHost,update(now:number){vehicle=data.fleet?.().find(v=>v.id===data.activeVehicle);if(!vehicle)return;if(now-last<250&&last)return;last=now;render(vehicle);},dispose(){panel.remove();}};
}
