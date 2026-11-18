import * as THREE from 'three';
import {localFrame} from '../gis/core.js';
type LineFeature={geometry:{type:string;coordinates:number[][]};properties:{power?:string;voltage?:number}};
/** Cached OSM line traces only; do not promote these to measured conductor elevations. */
export function aepNetwork(scene:THREE.Scene,host:Element,origin:number[]){
 const group=new THREE.Group();scene.add(group);const frame=localFrame(origin);
 const ui=document.createElement('label');ui.className='aep-network-control';ui.style.cssText='display:flex;align-items:center;gap:6px;font-size:11px;margin:0 8px';
 const toggle=document.createElement('input');toggle.type='checkbox';toggle.checked=true;
 const text=document.createElement('span');text.textContent='AEP lines · loading local OSM…';
 ui.title='OSM operator/owner association, not an exhaustive AEP inventory. Ground traces; unknown heights remain unknown. © OpenStreetMap contributors / ODbL';ui.append(toggle,text);const credit=document.createElement('a');credit.href='https://www.openstreetmap.org/copyright';credit.target='_blank';credit.rel='noopener';credit.textContent='© OSM';credit.title='© OpenStreetMap contributors · ODbL';ui.append(credit);host.append(ui);
 toggle.onchange=()=>group.visible=toggle.checked;
 const receive=(event:MessageEvent)=>{if(event.origin!==location.origin||event.source!==window.parent||event.data?.type!=='flightline:layers'||typeof event.data.layers?.osm!=='boolean')return;toggle.checked=event.data.layers.osm;group.visible=toggle.checked;};window.addEventListener('message',receive);
 let disposed=false;const controller=new AbortController();
 const path=location.pathname.startsWith('/flightline-fixed/')?'/flightline-fixed/gis/aep-power-lines.geojson':'/gis/aep-power-lines.geojson';
 fetch(path,{signal:controller.signal}).then(response=>{if(!response.ok)throw Error('Local OSM snapshot unavailable');return response.json();}).then(data=>{
  if(disposed)return;
  const segments=new Map<string,number[]>([['transmission',[]],['minor',[]],['cable',[]],['unknown',[]]]);
  let count=0;
  for(const feature of data.features as LineFeature[]){
   if(feature.geometry?.type!=='LineString')continue;
   const coords=feature.geometry.coordinates,properties=feature.properties;
   const category=properties.power==='cable'?'cable':properties.power==='minor_line'?'minor':(properties.voltage??0)>=69000?'transmission':'unknown';
   const positions=segments.get(category)!;let valid=false;
   for(let i=1;i<coords.length;i++){
    if(!coords[i-1].slice(0,2).every(Number.isFinite)||!coords[i].slice(0,2).every(Number.isFinite)||Math.abs(coords[i][0]-coords[i-1][0])>180)continue;
    positions.push(...frame.project(coords[i-1],2),...frame.project(coords[i],2));valid=true;
   }
   if(valid)count++;
  }
  const colors:Record<string,number>={transmission:0xe8bd73,minor:0x9ab8a7,cable:0x8298ae,unknown:0xc7b390};
  for(const [category,positions] of segments){if(!positions.length)continue;const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));const lines=new THREE.LineSegments(geometry,new THREE.LineBasicMaterial({color:colors[category],transparent:true,opacity:.6,depthTest:false,depthWrite:false}));lines.renderOrder=1;group.add(lines);}
  text.textContent=`AEP lines · ${count.toLocaleString()} ${data.metadata?.regional_pending?'Ohio ':''}OSM ways`;ui.title+=' · '+(data.metadata?.scope??'OSM-tagged associations');
  ui.title+=` · snapshot ${data.metadata?.osm_timestamp??data.metadata?.retrieved??'date unknown'}`;
 }).catch(error=>{if(disposed)return;text.textContent='AEP lines · local snapshot unavailable';ui.title=error.message;});
 return {dispose(){window.removeEventListener('message',receive);disposed=true;controller.abort();group.traverse(o=>{const line=o as THREE.Line;line.geometry?.dispose();if(line.material&&!Array.isArray(line.material))line.material.dispose();});scene.remove(group);ui.remove();}};
}
