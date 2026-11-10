import * as THREE from 'three';

const hydro = 'https://hydro.nationalmap.gov/arcgis/rest/services/';
const elevation = 'https://elevation.nationalmap.gov/arcgis/rest/services/3DEPElevation/ImageServer/getSamples';
const size = 25;
type Geometry = {rings?: number[][][]; paths?: number[][][]};
type Feature = {geometry: Geometry; attributes: Record<string, string>};

/** Coarse, connected water-level scenario. World Y remains the simulator's local datum. */
export function floodScenario(scene: THREE.Scene, anchor: HTMLElement, project: (p: number[]) => THREE.Vector3, focus: (p: THREE.Vector3[]) => void) {
 const panel = document.createElement('div');
 panel.className = 'flood-scenario';
 panel.hidden = true;
 panel.innerHTML = '<strong>Flood scenario</strong><span role="status"></span><label>Water elevation <input type="range" step="0.25" aria-label="Scenario water elevation" disabled><output></output></label><small>Purple = watershed divides · cyan = rivers · blue = water scenario · 125 m cells</small><button>Close</button>';
 anchor.after(panel);
 const status = panel.querySelector('span')!;
 const slider = panel.querySelector('input')!;
 const output = panel.querySelector('output')!;
 const group = new THREE.Group();
 scene.add(group);
 const progress=document.createElement('div');
 progress.className='flood-progress';
 panel.append(progress);
 const retry=document.createElement('button');
 retry.textContent='Retry';retry.hidden=true;panel.append(retry);
 let lastRings:number[][][]=[];
 retry.onclick=()=>void open(lastRings);
 let timer:number|undefined;
 let request: AbortController | undefined;
 let cells: number[][] = [], heights: number[] = [], seeds = new Set<number>();
 let water: THREE.Mesh | undefined;
 function clear() {
  for (const child of [...group.children]) {
   const mesh = child as THREE.Mesh;
   mesh.geometry.dispose();
   (mesh.material as THREE.Material).dispose();
   group.remove(child);
  }
  water = undefined;
 }
 function close() {request?.abort();clearInterval(timer);panel.hidden=true;clear();}
 panel.querySelector('button')!.onclick=close;
 function draw() {
  if (water) {water.geometry.dispose();(water.material as THREE.Material).dispose();group.remove(water);}
  const level = Number(slider.value);
  const visited = new Set<number>(), queue = [...seeds].filter(i=>heights[i]<=level);
  for (const i of queue) visited.add(i);
  for (let at=0;at<queue.length;at++) {
   const i=queue[at],x=i%size,y=Math.floor(i/size);
   for (const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
    const nx=x+dx,ny=y+dy,n=ny*size+nx;
    if(nx<0||ny<0||nx>=size||ny>=size||visited.has(n)||!Number.isFinite(heights[n])||heights[n]>level)continue;
    visited.add(n);queue.push(n);
   }
  }
  const positions:number[]=[],colors:number[]=[];
  for(const i of visited) {
   const p=project(cells[i]);p.y=2;
   const color=new THREE.Color('#80dcf3').lerp(new THREE.Color('#1661c4'),Math.min(1,(level-heights[i])/5));
   for(const [dx,dz] of [[-62.5,-62.5],[62.5,-62.5],[62.5,62.5],[-62.5,-62.5],[62.5,62.5],[-62.5,62.5]]) {
    positions.push(p.x+dx,p.y,p.z+dz);colors.push(color.r,color.g,color.b);
   }
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
  water=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({vertexColors:true,transparent:true,opacity:.55,side:THREE.DoubleSide,depthWrite:false}));
  group.add(water);
  output.textContent=level.toFixed(2)+' m · '+(visited.size*125*125/1e6).toFixed(2)+' km²';
 }
 slider.oninput=draw;
 async function json(url:string,params:URLSearchParams,signal:AbortSignal,step:HTMLElement,post=false) {
  step.textContent+=' · waiting for USGS response';
  try {
  const response=await fetch(post?url:url+'?'+params,{method:post?'POST':'GET',body:post?params:undefined,signal:AbortSignal.any([signal,AbortSignal.timeout(45000)])});
  if(!response.ok)throw new Error('HTTP '+response.status);
  step.textContent=step.dataset.label+' · reading response';
  const data=await response.json();
  if(data.error)throw new Error(data.error.message);
  const count=data.features?.length??data.samples?.length??0;
  step.textContent=step.dataset.label+' · received '+count+' records';
  step.dataset.state='done';
  return data;
  } catch(error) {
   const message=error instanceof Error?error.message:'Request failed';
   step.textContent=step.dataset.label+' · '+(signal.aborted?'cancelled':message.includes('timeout')||message.includes('timed out')?'timed out after 45s':message);
   step.dataset.state='error';
   throw error;
  }
 }
 async function open(rings:number[][][]) {
   close();lastRings=rings;panel.hidden=false;slider.disabled=true;output.textContent='';retry.hidden=true;
   progress.replaceChildren();
   const started=performance.now();
   const steps=['Watershed boundaries','River flowlines','625 elevation samples','Validate elevation coverage','Connect river cells','Build flood surface'].map(label=>{
    const item=document.createElement('span');item.dataset.label=label;item.textContent=label+' · queued';progress.append(item);return item;
   });
   timer=window.setInterval(()=>{status.textContent='Loading flood data · '+Math.floor((performance.now()-started)/1000)+'s · requests limited to 45s';},1000);
   status.textContent='Loading USGS watershed, river network and elevation…';
   const current=new AbortController();request=current;
   const points=rings.flat(),bounds=new THREE.Box2().setFromPoints(points.map(p=>new THREE.Vector2(p[0],p[1])));
   const center=bounds.getCenter(new THREE.Vector2()),cos=Math.cos(center.y*Math.PI/180);
   const lonStep=125/(111320*cos),latStep=125/111320;
   cells=Array.from({length:size*size},(_,i)=>[center.x+(i%size-12)*lonStep,center.y+(Math.floor(i/size)-12)*latStep]);
   const corners=[[center.x-12.5*lonStep,center.y-12.5*latStep],[center.x+12.5*lonStep,center.y+12.5*latStep]];
   focus(corners.map(project));
   const base={where:'1=1',f:'json',geometry:corners.flat().join(','),geometryType:'esriGeometryEnvelope',inSR:'4326',outSR:'4326',spatialRel:'esriSpatialRelIntersects',returnGeometry:'true',outFields:'*',resultRecordCount:'2000'};
   try {
    const [watersheds,rivers,dem]=await Promise.all([
     json(hydro+'wbd/MapServer/6/query',new URLSearchParams(base),current.signal,steps[0]),
     json(hydro+'nhd/MapServer/6/query',new URLSearchParams(base),current.signal,steps[1]),
     json(elevation,new URLSearchParams({f:'json',geometry:JSON.stringify({points:cells,spatialReference:{wkid:4326}}),geometryType:'esriGeometryMultipoint',returnFirstValueOnly:'true',interpolation:'RSP_BilinearInterpolation'}),current.signal,steps[2],true)
    ]);
    if(current.signal.aborted)return;
    if(watersheds.exceededTransferLimit||rivers.exceededTransferLimit)throw new Error('Hydrography response truncated');
    const line=(path:number[][],color:number)=>{
     const geometry=new THREE.BufferGeometry().setFromPoints(path.map(p=>project(p).setY(1)));
     group.add(new THREE.Line(geometry,new THREE.LineBasicMaterial({color,depthTest:false})));
    };
    const basins=watersheds.features as Feature[],streams=rivers.features as Feature[];
    for(const feature of basins)for(const ring of feature.geometry.rings??[])line(ring,0xbca4e8);
    const paths=streams.flatMap(f=>f.geometry.paths??[]);
    for(const path of paths)line(path,0x5cdcf2);
    steps[3].textContent='Validating elevation coverage…';
    heights=Array(size*size).fill(NaN);
    for(const sample of dem.samples??[]) {
     const x=Math.round((sample.location.x-center.x)/lonStep)+12,y=Math.round((sample.location.y-center.y)/latStep)+12;
     const value=Number(sample.value);
     if(x>=0&&x<size&&y>=0&&y<size&&sample.value!==null&&sample.value!==''&&Number.isFinite(value)&&value>-1000)heights[y*size+x]=value;
    }
    if(heights.filter(Number.isFinite).length<cells.length*.9)throw new Error('Incomplete elevation coverage');
    steps[3].textContent='Elevation coverage · '+heights.filter(Number.isFinite).length+'/625 valid';steps[3].dataset.state='done';
    steps[4].textContent='Connecting mapped river cells…';
    seeds=new Set();
    // Rasterize real hydrography segments onto the sampling grid.
    for(const path of paths)for(let i=1;i<path.length;i++){
     const a=path[i-1],b=path[i],steps=Math.ceil(Math.hypot((b[0]-a[0])/lonStep,(b[1]-a[1])/latStep)*2);
     for(let j=0;j<=steps;j++){
      const t=steps?j/steps:0,x=Math.round((a[0]+(b[0]-a[0])*t-center.x)/lonStep)+12,y=Math.round((a[1]+(b[1]-a[1])*t-center.y)/latStep)+12;
      if(x>=0&&x<size&&y>=0&&y<size&&Number.isFinite(heights[y*size+x]))seeds.add(y*size+x);
     }
    }
    if(!seeds.size){steps[4].textContent='No river cells in sampled area';steps[4].dataset.state='error';steps[5].textContent='Flood surface skipped';}
    if(!seeds.size)throw new Error('No mapped river cells in this focus area');
    steps[4].textContent='River cells · '+seeds.size+' connected seeds';steps[4].dataset.state='done';
    steps[5].textContent='Building flood surface…';
    const reference=Math.min(...[...seeds].map(i=>heights[i]));
    slider.min=String(reference);slider.max=String(reference+15);slider.value=String(reference+2);slider.disabled=false;
    status.textContent='USGS WBD · '+basins.map(b=>(b.attributes.name??'')+' '+(b.attributes.huc12??'')).join(' / ')+' · 3DEP elevations · assumed level starts at lowest river cell +2 m';
    draw();steps[5].textContent='Flood surface ready';steps[5].dataset.state='done';
   } catch(error) {
    if(current.signal.aborted)return;
    retry.hidden=false;
    current.abort();
    status.textContent='Flood surface unavailable · '+(error instanceof Error?error.message:'USGS data unavailable')+' · select alert again to retry';
   } finally {if(request===current)clearInterval(timer);}
  }
 return {open,
  close,
  dispose(){close();panel.remove();group.removeFromParent();}
 };
}
