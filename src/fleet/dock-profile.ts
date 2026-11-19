/** Dock mission view hosted by the shared Mission Profile panel. */
export function dockProfile(panel:HTMLElement){
 const body=document.createElement('div');body.className='dock-profile-body';body.hidden=true;
 body.innerHTML='<p class="dock-profile-summary"></p><div class="timeline-options"><button data-axis="line" aria-pressed="true">Line profile</button><button data-axis="waypoint" aria-pressed="false">Waypoint order</button><span>Teal: outbound · Pink: return · Gold: selected · White: modeled attachments</span></div><svg class="timeline-chart" viewBox="0 0 1000 165" role="img" aria-label="Dock mission waypoint height profile"></svg><div class="timeline-options"><button data-step="-1">Previous waypoint</button><input type="range" min="0" max="0" value="0" aria-label="Dock mission waypoint"><button data-step="1">Next waypoint</button><span class="dock-waypoint-label"></span></div><small>Local mission draft · heights relative to takeoff · straight connections · no terrain or clearance validation</small>';
 panel.append(body);
 let mode='fleet',stage='operations',points:any[]=[],structures:any[]=[],index=0,axis='line',targets:any[]=[],route:number[][]=[];
 const slider=body.querySelector('input')!,chart=body.querySelector('svg')!;
 const title=panel.querySelector<HTMLElement>('.timeline-current')!;
 const collapse=panel.querySelector<HTMLElement>('.timeline-collapse')!;
 function context(){const active=mode==='dock'&&stage==='planning'&&(points.length>0||structures.length>0);panel.classList.toggle('dock-mission-profile',active);body.hidden=!active;}
 function render(focus=false){
  if(!points.length&&!structures.length)return;
  const heights=points.map(p=>Number(p.geometry.coordinates[2]??p.properties.height_above_takeoff_m??0));
  const towerHeights=structures.map(s=>Number(s.properties.tower_height_above_takeoff_m??0));
  const attachmentHeights=points.filter(p=>['phase_attachment','shield_wire'].includes(p.properties.view)).map(p=>Number(p.properties.target_height_above_takeoff_m??0)).filter(Number.isFinite);
  const max=Math.max(1,...heights,...towerHeights,...attachmentHeights,...route.map(p=>p[2]??0))*1.12,y=(h:number)=>135-h/max*115;
  const origin=structures[0]?.geometry.coordinates??points[0]?.geometry.coordinates??[0,0];
  const xy=(p:number[])=>[(p[0]-origin[0])*111320*Math.cos(origin[1]*Math.PI/180),(p[1]-origin[1])*111320];
  const centers=structures.map(s=>xy(s.geometry.coordinates)),stations=[0];
  for(let i=1;i<centers.length;i++)stations.push(stations[i-1]+Math.hypot(centers[i][0]-centers[i-1][0],centers[i][1]-centers[i-1][1]));
  const length=Math.max(1,stations.at(-1)??1);
  function station(coord:number[]){const p=xy(coord);let best=Infinity,result=0;for(let i=1;i<centers.length;i++){const a=centers[i-1],b=centers[i],dx=b[0]-a[0],dy=b[1]-a[1],l=dx*dx+dy*dy,t=l?Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/l)):0,d=Math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dy);if(d<best){best=d;result=stations[i-1]+Math.sqrt(l)*t;}}return result;}
  const x=(i:number)=>axis==='line'?40+station(points[i].geometry.coordinates)/length*920:40+i/Math.max(1,points.length-1)*920;
  chart.replaceChildren();
  const svg=(tag:string,attrs:Record<string,string>)=>{const el=document.createElementNS('http://www.w3.org/2000/svg',tag);for(const [k,v]of Object.entries(attrs))el.setAttribute(k,v);chart.append(el);return el;};
  for(let i=0;i<=4;i++){const h=max*i/4;svg('line',{x1:'40',x2:'960',y1:String(y(h)),y2:String(y(h)),stroke:'#36534e','stroke-width':'1'});svg('text',{x:'3',y:String(y(h)+4),fill:'#afc6bf','font-size':'10'}).textContent=(h/.3048).toFixed(0)+' ft';}
  if(axis==='line')structures.forEach((structure,i)=>{const at=40+stations[i]/length*920,ground=Number(structure.properties.ground_height_above_takeoff_m??0),top=towerHeights[i];if(top>ground)svg('line',{x1:String(at),x2:String(at),y1:String(y(ground)),y2:String(y(top)),stroke:'#9cb6af','stroke-width':'2'});svg('text',{x:String(at),y:'150',fill:'#b1c6c1','font-size':'10','text-anchor':'middle'}).textContent=String(structure.properties.STRUCTURE_NUMBER);});
  for(const target of targets){const at=40+station(target.geometry.coordinates)/length*920,h=target.properties.height_above_takeoff_m;svg('line',{x1:String(at-6),x2:String(at+6),y1:String(y(h)),y2:String(y(h)),stroke:'#e6eee9','stroke-width':'2'});}
  const drawn=new Set<string>();
  points.forEach((p,i)=>{const props=p.properties,target=props.target_coordinates;if(axis!=='line'||!['phase_attachment','shield_wire'].includes(props.view)||!target||!Number.isFinite(props.target_height_above_takeoff_m))return;const key=props.structure+':'+props.attachment;if(drawn.has(key)||!props.attachment)return;drawn.add(key);const at=40+station(target)/length*920,h=props.target_height_above_takeoff_m;svg('line',{x1:String(at-5),x2:String(at+5),y1:String(y(h)),y2:String(y(h)),stroke:'#e6eee9','stroke-width':'2'});});
  if(axis==='line'&&route.length>1){svg('polyline',{points:route.map(p=>`${40+station(p)/length*920},${y(p[2]??0)}`).join(' '),fill:'none',stroke:'#e8bd73','stroke-width':'1.5',opacity:'.85'});}
  else for(let i=1;i<points.length;i++)svg('line',{x1:String(x(i-1)),y1:String(y(heights[i-1])),x2:String(x(i)),y2:String(y(heights[i])),stroke:points[i].properties.pass==='return'?'#eaa4e9':'#7adaca','stroke-width':'1.5',opacity:'.7'});
  points.forEach((p,i)=>{const dot=svg('circle',{cx:String(x(i)),cy:String(y(heights[i])),r:i===index?'6':'3',fill:i===index?'#ffcf60':p.properties.pass==='return'?'#eaa4e9':'#7adaca',tabindex:'0',role:'button','aria-label':`Select waypoint ${i+1}, ${p.properties.attachment??p.properties.view??''}, ${(heights[i]/.3048).toFixed(0)} feet`});dot.addEventListener('click',()=>choose(i));dot.addEventListener('keydown',e=>{if((e as KeyboardEvent).key==='Enter')choose(i);});});
  svg('text',{x:'40',y:'164',fill:'#b1c6c1','font-size':'10'}).textContent=axis==='line'?`Structure number · ${(length/1609.344).toFixed(2)} mi along circuit · heights above takeoff (not terrain)`:`${points.length} photo waypoints in flight order · heights above takeoff`;
  body.querySelectorAll<HTMLButtonElement>('[data-axis]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.axis===axis)));
  if(!points.length){body.querySelector('.dock-waypoint-label')!.textContent='Structure locations loaded · Preview mission to generate capture heights';return;}
  slider.max=String(points.length-1);slider.value=String(index);
  const p=points[index];body.querySelector('.dock-waypoint-label')!.textContent=`${index+1} / ${points.length} · Structure ${p.properties.structure??'—'} · ${(heights[index]/.3048).toFixed(0)} ft · ${p.properties.pass??''} · ${p.properties.attachment??p.properties.view??''}`;
  if(focus)window.parent.postMessage({type:'flightline:dock-profile-focus',coordinates:p.geometry.coordinates,height:heights[index],waypoint:p},location.origin);
 }
 body.querySelectorAll<HTMLButtonElement>('[data-axis]').forEach(b=>b.onclick=()=>{axis=b.dataset.axis!;render();});
 function choose(i:number){if(!points.length)return;index=Math.max(0,Math.min(points.length-1,i));render(true);}
 slider.oninput=()=>choose(Number(slider.value));body.querySelectorAll<HTMLButtonElement>('[data-step]').forEach(b=>b.onclick=()=>choose(index+Number(b.dataset.step)));
 const receive=(event:MessageEvent)=>{
  if(event.origin!==location.origin||event.source!==window.parent)return;
  if(event.data?.type==='flightline:workspace-mode'){mode=event.data.mode;context();}
  if(event.data?.type==='flightline:stage'){stage=event.data.stage;context();}
  if(event.data?.type==='flightline:focus-dock'){points=[];structures=[];targets=[];route=[];context();}
  if(event.data?.type==='flightline:inspection'&&Array.isArray(event.data.features)){
   route=event.data.features.find((f:any)=>f.properties?.layer==='draft_route')?.geometry?.coordinates??[];
   targets=event.data.features.filter((f:any)=>f.properties?.layer==='phase_target');
   const photos=event.data.features.filter((f:any)=>f.geometry?.type==='Point'&&f.properties?.layer==='photo');
   structures=event.data.features.filter((f:any)=>f.geometry?.type==='Point'&&f.properties?.layer==='structure').sort((a:any,b:any)=>Number(a.properties.STRUCTURE_NUMBER)-Number(b.properties.STRUCTURE_NUMBER));
   if(!photos.length&&!structures.length){points=[];context();return;}
   const changed=JSON.stringify(photos)!==JSON.stringify(points);points=photos;if(changed)index=0;
   context();if(mode!=='dock'||stage!=='planning')return;
   panel.classList.remove('collapsed','asset-profile-mode');collapse.textContent='Hide profile';title.textContent='Skydio Dock · mission draft';
   body.querySelector('.dock-profile-summary')!.textContent=points.length?`Line profile · ${structures.length} structures · ${points.length} captures`:`Line profile · ${structures.length} structures · modeled heights · no photo mission required`;
   render();
  }
 };
 window.addEventListener('message',receive);
 return {active:()=>panel.classList.contains('dock-mission-profile'),dispose(){window.removeEventListener('message',receive);body.remove();}};
}
