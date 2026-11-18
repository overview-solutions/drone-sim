import * as THREE from 'three';
import {localFrame} from '../gis/core.js';
export function planningAirports(scene:THREE.Scene,host:HTMLElement,origin:number[]){
 const group=new THREE.Group();group.visible=false;scene.add(group);const frame=localFrame(origin);let enabled=false,stage='operations',disposed=false;
 const label=document.createElement('label');label.className='planning-airports-control';label.style.cssText='display:flex;gap:6px;align-items:center;font-size:11px';label.hidden=true;
 const toggle=document.createElement('input');toggle.type='checkbox';toggle.checked=true;label.append(toggle,document.createTextNode('Fixed-wing airport planning'));host.querySelector('.inspection-head')?.append(label);
 const apply=()=>{group.visible=enabled&&stage==='planning'&&!host.classList.contains('workspace-dock');host.dataset.airportsVisible=String(group.visible);label.hidden=window.parent!==window||stage!=='planning';};toggle.onchange=()=>{enabled=toggle.checked;apply();};
 const source=location.pathname.startsWith('/flightline-fixed/')?'/flightline-fixed/gis/aep-state-airports.geojson':'/gis/aep-state-airports.geojson';
 fetch(source).then(r=>{if(!r.ok)throw Error();return r.json();}).then(data=>{if(disposed)return;
  const vertices:number[]=[];for(const f of data.features){const p=f.geometry.coordinates;vertices.push(...frame.project(p,1));}
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));const dots=new THREE.Points(geometry,new THREE.PointsMaterial({color:0x749ab0,size:5,sizeAttenuation:false,depthTest:false}));dots.renderOrder=2;group.add(dots);
  label.title=`${data.features.length} public non-towered airport positions across AEP's 11 states. Existing local inventory; source date and runway/access suitability unverified.`;
 }).catch(()=>label.title='Local airport inventory unavailable');
 const receive=(event:MessageEvent)=>{if(event.origin!==location.origin||event.source!==window.parent)return;if(event.data?.type==='flightline:stage')stage=event.data.stage;else if(event.data?.type==='flightline:layers')enabled=!!event.data.layers.airports;else if(event.data?.type!=='flightline:workspace-mode')return;apply();};window.addEventListener('message',receive);
 return {dispose(){disposed=true;window.removeEventListener('message',receive);group.traverse(o=>{const points=o as THREE.Points;points.geometry?.dispose();(points.material as THREE.Material)?.dispose();});scene.remove(group);label.remove();}};
}
