/** Dock mission view hosted by the shared Mission Profile panel. */
export function dockProfile(panel:HTMLElement){
 const body=document.createElement('div');body.className='dock-profile-body';body.hidden=true;
 body.innerHTML='<p class="dock-profile-summary"></p><svg class="timeline-chart" viewBox="0 0 1000 165" role="img" aria-label="Dock mission waypoint height profile"></svg><div class="timeline-options"><button data-step="-1">Previous waypoint</button><input type="range" min="0" max="0" value="0" aria-label="Dock mission waypoint"><button data-step="1">Next waypoint</button><span class="dock-waypoint-label"></span></div><small>Local mission draft · heights relative to takeoff · straight connections · no terrain or clearance validation</small>';
 panel.append(body);
 let mode='fleet',stage='operations',points:any[]=[],index=0;
 const slider=body.querySelector('input')!,chart=body.querySelector('svg')!;
 const title=panel.querySelector<HTMLElement>('.timeline-current')!;
 const collapse=panel.querySelector<HTMLElement>('.timeline-collapse')!;
 function context(){const active=mode==='dock'&&stage==='planning'&&points.length>0;panel.classList.toggle('dock-mission-profile',active);body.hidden=!active;}
 function render(focus=false){
  if(!points.length)return;
  const heights=points.map(p=>Number(p.geometry.coordinates[2]??p.properties.height_above_takeoff_m??0));
  const max=Math.max(1,...heights),x=(i:number)=>30+i/Math.max(1,points.length-1)*940,y=(h:number)=>135-h/max*105;
  chart.replaceChildren();
  const svg=(tag:string,attrs:Record<string,string>)=>{const el=document.createElementNS('http://www.w3.org/2000/svg',tag);for(const [k,v]of Object.entries(attrs))el.setAttribute(k,v);chart.append(el);return el;};
  svg('polyline',{points:heights.map((h,i)=>`${x(i)},${y(h)}`).join(' '),fill:'none',stroke:'#7adaca','stroke-width':'2'});
  points.forEach((p,i)=>{const dot=svg('circle',{cx:String(x(i)),cy:String(y(heights[i])),r:i===index?'7':'4',fill:i===index?'#ffcf60':'#7adaca',tabindex:'0',role:'button','aria-label':`Select waypoint ${i+1}`});dot.addEventListener('click',()=>choose(i));dot.addEventListener('keydown',e=>{if((e as KeyboardEvent).key==='Enter')choose(i);});});
  const label=svg('text',{x:'30',y:'160',fill:'#b1c6c1','font-size':'12'});label.textContent=`0–${max.toFixed(0)} m above takeoff · ${points.length} photo waypoints`;
  slider.max=String(points.length-1);slider.value=String(index);
  const p=points[index];body.querySelector('.dock-waypoint-label')!.textContent=`${index+1} / ${points.length} · Structure ${p.properties.structure??'—'} · ${heights[index].toFixed(0)} m · ${p.properties.pass??''}`;
  if(focus)window.parent.postMessage({type:'flightline:dock-profile-focus',coordinates:p.geometry.coordinates,height:heights[index]},location.origin);
 }
 function choose(i:number){index=Math.max(0,Math.min(points.length-1,i));render(true);}
 slider.oninput=()=>choose(Number(slider.value));body.querySelectorAll<HTMLButtonElement>('[data-step]').forEach(b=>b.onclick=()=>choose(index+Number(b.dataset.step)));
 const receive=(event:MessageEvent)=>{
  if(event.origin!==location.origin||event.source!==window.parent)return;
  if(event.data?.type==='flightline:workspace-mode'){mode=event.data.mode;context();}
  if(event.data?.type==='flightline:stage'){stage=event.data.stage;context();}
  if(event.data?.type==='flightline:focus-dock'){points=[];context();}
  if(event.data?.type==='flightline:inspection'&&Array.isArray(event.data.features)){
   const photos=event.data.features.filter((f:any)=>f.geometry?.type==='Point'&&f.properties?.layer==='photo');
   if(!photos.length)return;
   const changed=JSON.stringify(photos)!==JSON.stringify(points);points=photos;if(changed)index=0;
   context();if(mode!=='dock'||stage!=='planning')return;
   panel.classList.remove('collapsed','asset-profile-mode');collapse.textContent='Hide profile';title.textContent='Skydio Dock · mission draft';
   body.querySelector('.dock-profile-summary')!.textContent=`Mission Profile · ${points.length} captures · ${new Set(points.map(p=>p.properties.structure)).size} targets`;
   render();
  }
 };
 window.addEventListener('message',receive);
 return {active:()=>panel.classList.contains('dock-mission-profile'),dispose(){window.removeEventListener('message',receive);body.remove();}};
}
