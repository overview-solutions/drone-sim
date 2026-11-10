import * as THREE from 'three';
import data from './ray-king-data.json';
import type {Vehicle} from './operations';
import type {PowerLine} from './model';
export const rayKingLine:PowerLine=data.line;
export function rayKingCloud(scene:THREE.Scene,banner:Element,line:PowerLine){
 if(line.id!==rayKingLine.id)return;
 const origin=line.coords[0],cos=Math.cos(origin[1]*Math.PI/180);
 const dx=(data.origin[0]-origin[0])*111320*cos,dz=-(data.origin[1]-origin[1])*111320;
 // Sort original returns by their projected distance along the first pass.
 const center=data.line.coords.map(p=>[(p[0]-data.origin[0])*111320*Math.cos(data.origin[1]*Math.PI/180),-(p[1]-data.origin[1])*111320]);
 const along=[0];for(let i=1;i<center.length;i++)along.push(along[i-1]+Math.hypot(center[i][0]-center[i-1][0],center[i][1]-center[i-1][1]));
 const ordered=data.points.map(p=>{let best=Infinity,station=0;for(let i=1;i<center.length;i++){const a=center[i-1],b=center[i],x=b[0]-a[0],z=b[1]-a[1],len=Math.hypot(x,z),t=Math.max(0,Math.min(1,((p[0]-a[0])*x+(p[2]-a[1])*z)/(len*len)));const d=Math.hypot(p[0]-a[0]-t*x,p[2]-a[1]-t*z);if(d<best){best=d;station=along[i-1]+t*len;}}return {p,station};}).sort((a,b)=>a.station-b.station);
 const positions=new Float32Array(data.points.length*3),colors=new Float32Array(positions.length);
 const minHeight=data.points.reduce((m,p)=>Math.min(m,p[1]),Infinity),maxHeight=data.points.reduce((m,p)=>Math.max(m,p[1]),-Infinity);
 const stops=['#254cc9','#24c7bf','#ead94c','#ed6a42'].map(c=>new THREE.Color(c));
 const elevationColor=(height:number)=>{const v=THREE.MathUtils.clamp((height-minHeight)/(maxHeight-minHeight),0,1)*3,i=Math.min(2,Math.floor(v));return stops[i].clone().lerp(stops[i+1],v-i);};
 ordered.forEach(({p},i)=>{positions.set([p[0]+dx,p[1],p[2]+dz],i*3);const c=elevationColor(p[1]);colors.set([c.r,c.g,c.b],i*3);});
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));geometry.setAttribute('color',new THREE.BufferAttribute(colors,3));
 geometry.setDrawRange(0,0);
 const points=new THREE.Points(geometry,new THREE.PointsMaterial({size:2,sizeAttenuation:false,vertexColors:true}));points.userData.sensorIgnore=true;scene.add(points);
 const label=document.createElement('label');label.innerHTML='<input type="checkbox" checked> RAW LiDAR · elevation';label.title=`${data.points.length.toLocaleString()} actual sampled returns · 150 m corridor buffer · elevation colors (blue low → red high). NAVD88 heights shifted by ${data.verticalOffsetMeters.toFixed(2)} m for display. Older tile horizontal datum approximate. Modeled structures and flight heights remain synthetic, not fitted to this terrain.`;
 const ramp=document.createElement('span');ramp.style.cssText='display:inline-block;width:70px;height:6px;margin-left:6px;background:linear-gradient(90deg,#254cc9,#24c7bf,#ead94c,#ed6a42)';ramp.title=`${(minHeight+data.verticalOffsetMeters).toFixed(1)}–${(maxHeight+data.verticalOffsetMeters).toFixed(1)} m NAVD88 · fixed corridor scale`;label.append(ramp);label.title+=' '+ramp.title;
 label.querySelector('input')!.onchange=e=>points.visible=(e.target as HTMLInputElement).checked;banner.append(label);
 const info=document.createElement('details');info.innerHTML='<summary>LiDAR source</summary><small>Ray–King · recorded returns revealed as flown (not live acquisition). 150 m display swath; no sensor coverage claim.<br>Five 2006 tiles + one 2021 tile; overlapping historical surveys, not current conditions.<br>150 m buffer · thinned actual returns. Tan: ground; mint: vegetation classes; amber: buildings; blue: other returns.<br>Older horizontal datum approximate. Structures and missions remain hypothetical; no terrain-following validation.</small>';
 const download=document.createElement('button');download.textContent='Export corridor GeoJSON';download.onclick=()=>{const features:any[]=[{type:'Feature',geometry:{type:'LineString',coordinates:data.line.coords},properties:{name:'Ray–King LiDAR corridor',source:'OpenStreetMap contributors',sourceWayIds:data.sourceWayIds,voltage:345000,operator:null,clippedToTileInterior:true}}];for(const t of data.tiles){const [w,s,e,n]=t.bounds;features.push({type:'Feature',geometry:{type:'Polygon',coordinates:[[[w,s],[e,s],[e,n],[w,n],[w,s]]]},properties:{...t,source:'User-supplied OGRIP LAS',previewOnly:true}});}const url=URL.createObjectURL(new Blob([JSON.stringify({type:'FeatureCollection',features},null,2)],{type:'application/geo+json'}));const a=document.createElement('a');a.href=url;a.download='ray-king-corridor.geojson';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};info.append(download);banner.append(info);
 return {update(vehicle:Vehicle|undefined){
  const detail=banner.parentElement?.querySelector<HTMLElement>('.span-detail');
  points.visible=label.querySelector('input')!.checked&&(!detail||detail.hidden);
  if(!vehicle){geometry.setDrawRange(0,0);return;}
  const x=(vehicle.coord[0]-data.origin[0])*111320*Math.cos(data.origin[1]*Math.PI/180),z=-(vehicle.coord[1]-data.origin[1])*111320;
  let best=Infinity,station=0,spanLength=450,direction=1;
  const hx=(vehicle.headingCoord[0]-vehicle.coord[0])*Math.cos(data.origin[1]*Math.PI/180),hz=-(vehicle.headingCoord[1]-vehicle.coord[1]);
  for(let i=1;i<center.length;i++){const a=center[i-1],b=center[i],dx=b[0]-a[0],dz=b[1]-a[1],len=along[i]-along[i-1],t=Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[1])*dz)/(len*len))),d=Math.hypot(x-a[0]-t*dx,z-a[1]-t*dz);if(d<best){best=d;station=along[i-1]+t*len;spanLength=len;direction=hx*dx+hz*dz>=0?1:-1;}}
  if(best>150||vehicle.done){geometry.setDrawRange(0,0);return;}
  const start=direction>0?station-spanLength:station,end=direction>0?station:station+spanLength;
  const lower=(value:number)=>{let lo=0,hi=ordered.length;while(lo<hi){const mid=(lo+hi)>>>1;if(ordered[mid].station<value)lo=mid+1;else hi=mid;}return lo;};
  const from=lower(start);geometry.setDrawRange(from,lower(end)-from);

 }};
}
