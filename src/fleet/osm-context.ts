import type {CrossingSource} from './review-crossings';
import type {ShieldAsset} from './shielding';
import * as THREE from 'three';
import urbanBuildings from './urban-buildings.json';
import {buildingPolygons} from './osm-buildings';
/** Optional local OSM context; footprints are mapped, missing heights are estimates. */
export function osmContext(scene:THREE.Scene,host:HTMLElement,origin:number[]){
 const ui=document.createElement('div');ui.className='osm-context';ui.innerHTML='<button>Load nearby 3D OSM</button><label><input type="checkbox" checked> Show</label><label>Area <select aria-label="OSM area"><option value="250">500 m</option><option value="1000">2 km</option></select></label><label>Import OSM JSON <input type="file" accept=".json,application/json" style="max-width:180px"></label><small>Buildings · power · trees · water · roads · paths · 500 m around view</small>';host.append(ui);
 const button=ui.querySelector('button')!,status=ui.querySelector('small')!,toggle=ui.querySelector('input[type=checkbox]') as HTMLInputElement;
 let shieldingAssets:ShieldAsset[]=[];let crossings:CrossingSource[]=[];
 let imported:any;const file=ui.querySelector('input[type=file]') as HTMLInputElement;file.onchange=async()=>{try{const parsed=JSON.parse(await file.files![0].text());if(!Array.isArray(parsed.elements))throw Error();imported=parsed;button.click();}catch{status.textContent='Choose an Overpass JSON file containing elements.';}};
 const group=new THREE.Group();scene.add(group);let center=new THREE.Vector3(),disposed=false,controller:AbortController|undefined;
 const cos=Math.cos(origin[1]*Math.PI/180),project=(lon:number,lat:number)=>new THREE.Vector3((lon-origin[0])*111320*cos,0,-(lat-origin[1])*111320);
 function clear(){group.traverse(o=>{const m=o as THREE.Mesh;m.geometry?.dispose();if(m.material)for(const material of Array.isArray(m.material)?m.material:[m.material])material.dispose();});group.clear();}
 toggle.onchange=()=>group.visible=toggle.checked;
 button.onclick=async()=>{
 const lon=origin[0]+center.x/(111320*cos),lat=origin[1]-center.z/111320,dy=Number(ui.querySelector('select')!.value)/111320,dx=dy/cos;
 const bbox=`${lat-dy},${lon-dx},${lat+dy},${lon+dx}`;
 button.disabled=true;status.textContent='Loading OSM context…';controller=new AbortController();const timeout=setTimeout(()=>controller?.abort(),60000);
 try{
 const query=`[out:json][timeout:20];(way[building](${bbox});relation[building][type=multipolygon](${bbox});way[power~"^(line|minor_line|substation|plant)$"](${bbox});node[power~"^(tower|pole|substation|transformer)$"](${bbox});way[highway](${bbox});way[waterway](${bbox});way[railway](${bbox});way[natural~"^(water|wood|scrub|grassland)$"](${bbox});way[landuse~"^(forest|grass|meadow|recreation_ground)$"](${bbox});way[leisure=park](${bbox});node[natural=tree](${bbox}););out geom;`;
 let data:any=imported;imported=undefined;
 const cacheKey=`flightline-osm-v3:${bbox}`;if(!data)try{data=JSON.parse(localStorage.getItem(cacheKey)||'null');}catch{}
 const fromCache=!!data;
 if(!data)for(const endpoint of ['https://overpass.kumi.systems/api/interpreter','https://overpass-api.de/api/interpreter']){
 try{const response=await fetch(endpoint+'?'+new URLSearchParams({data:query}),{signal:AbortSignal.any([controller.signal,AbortSignal.timeout(25000)])});if(!response.ok)throw Error('OSM service unavailable');data=await response.json();break;}catch(error){if(disposed||controller.signal.aborted)throw error;}
 }
 if(!data||!Array.isArray(data.elements)||data.remark)throw Error('OSM service unavailable');if(disposed)return;
 if(!fromCache)try{localStorage.setItem(cacheKey,JSON.stringify(data));}catch{}
 crossings=data.elements.filter((e:any)=>e.type==='way'&&e.geometry?.length>1&&(e.tags?.highway||e.tags?.waterway||e.tags?.railway||['line','minor_line'].includes(e.tags?.power))).map((e:any)=>({id:'OSM way/'+e.id,kind:e.tags.power?'power':e.tags.waterway?'water':e.tags.railway?'rail':'road',points:e.geometry.map((p:any)=>project(p.lon,p.lat))}));clear();let buildings=0,power=0,estimated=0,trees=0,water=0,roads=0,paths=0,green=0;
 for(const building of buildingPolygons(data.elements)){
 const tags=building.tags,tagged=parseFloat(tags.height),levels=parseFloat(tags['building:levels']);const inferred=!(Number.isFinite(tagged)&&tagged>0);
 const height=inferred?(levels>0?Math.min(400,levels*3):9):Math.min(400,tagged*(tags.height.includes('ft')?.3048:1));
 const minimum=parseFloat(tags.min_height||'0'),base=Number.isFinite(minimum)?Math.max(0,Math.min(height-.1,minimum*(tags.min_height?.includes('ft')?.3048:1))):0;
 const points=(ring:typeof building.outer)=>ring.map(p=>{const v=project(p.lon,p.lat);return new THREE.Vector2(v.x,-v.z);});
 const shape=new THREE.Shape(points(building.outer));for(const hole of building.holes)shape.holes.push(new THREE.Path(points(hole)));
 const geometry=new THREE.ExtrudeGeometry(shape,{depth:height-base,bevelEnabled:false});geometry.rotateX(-Math.PI/2);
 const mesh=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({color:0x577580,roughness:1}));mesh.position.y=base;mesh.userData.osmId=building.id;group.add(mesh);buildings++;if(inferred)estimated++;
 }
 shieldingAssets=(data.elements||[]).filter((e:any)=>['line','minor_line','substation','plant','tower','pole','transformer'].includes(e.tags?.power)).map((e:any)=>({id:`OSM ${e.type}/${e.id}`,kind:e.tags.power==='minor_line'?'Distribution':e.tags.power,points:e.geometry?.map((p:any)=>project(p.lon,p.lat))??(Number.isFinite(e.lon)?[project(e.lon,e.lat)]:[]),heightKnown:false,area:['substation','plant'].includes(e.tags.power)}));
 for(const e of data.elements||[]){const tags=e.tags||{};if(tags.building||e.type==='relation')continue;
 const tagged=parseFloat(tags.height),levels=parseFloat(tags['building:levels']);
 const height=Number.isFinite(tagged)&&tagged>0?Math.min(tagged*(String(tags.height).includes('ft')?.3048:1),400):Number.isFinite(levels)&&levels>0?Math.min(levels*3,400):tags.building?9:tags.power==='tower'?30:12;
 const inferred=!(Number.isFinite(tagged)&&tagged>0);
 if(e.type==='node'&&tags.natural==='tree'&&Number.isFinite(e.lon)&&Number.isFinite(e.lat)){
 const base=project(e.lon,e.lat),h=Number.isFinite(tagged)&&tagged>0?height:8;
 const trunk=new THREE.Mesh(new THREE.CylinderGeometry(.25,.4,h*.55,5),new THREE.MeshStandardMaterial({color:0x665847}));trunk.position.copy(base).setY(h*.275);group.add(trunk);
 const crown=new THREE.Mesh(new THREE.IcosahedronGeometry(h*.32,1),new THREE.MeshStandardMaterial({color:0x41644d,flatShading:true}));crown.position.copy(base).setY(h*.68);group.add(crown);trees++;if(inferred)estimated++;continue;
 }
 if(e.type==='way'&&e.geometry?.length>1&&(tags.highway||tags.waterway||tags.natural||tags.landuse||tags.leisure==='park')){
 const points:THREE.Vector3[]=e.geometry.map((p:{lon:number;lat:number})=>project(p.lon,p.lat));
 const isWater=!!tags.waterway||tags.natural==='water',isPath=['footway','path','cycleway','bridleway','steps','pedestrian'].includes(tags.highway);
 const area=points.length>3&&points[0].distanceTo(points[points.length-1])<1&&(!tags.highway||tags.area==='yes')&&(!tags.waterway||tags.waterway==='riverbank');
 if(area){const shape=new THREE.Shape(points.map(p=>new THREE.Vector2(p.x,-p.z))),geometry=new THREE.ShapeGeometry(shape);geometry.rotateX(-Math.PI/2);const mesh=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({color:isWater?0x30586e:0x304f3d,side:THREE.DoubleSide}));mesh.position.y=.2;group.add(mesh);if(isWater)water++;else green++;}
 else{
 if(!tags.highway&&!tags.waterway)continue;
 const width=isWater?4:isPath?1.5:['motorway','trunk','primary'].includes(tags.highway)?10:5;
 const material=new THREE.MeshBasicMaterial({color:isWater?0x47788c:isPath?0x998c70:0x627079});
 for(let i=1;i<points.length;i++){const a=points[i-1],b=points[i],length=a.distanceTo(b);if(length<.01)continue;const mesh=new THREE.Mesh(new THREE.PlaneGeometry(length,width),material);mesh.rotation.set(-Math.PI/2,0,-Math.atan2(b.z-a.z,b.x-a.x));mesh.position.copy(a).add(b).multiplyScalar(.5).setY(.3);group.add(mesh);}
 if(isWater)water++;else if(isPath)paths++;else roads++;
 }continue;
 }
 if(e.type==='way'&&e.geometry?.length>2&&(tags.building||['substation','plant'].includes(tags.power))){
 const points=e.geometry.map((p:{lon:number;lat:number})=>project(p.lon,p.lat));if(points[0].distanceTo(points[points.length-1])>1)continue;
 const shape=new THREE.Shape(points.map((p:THREE.Vector3)=>new THREE.Vector2(p.x,-p.z)));
 const geometry=new THREE.ExtrudeGeometry(shape,{depth:tags.building?height:1,bevelEnabled:false});geometry.rotateX(-Math.PI/2);
 const mesh=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({color:tags.building?0x577580:0xb09261,roughness:1}));group.add(mesh);if(tags.building){buildings++;if(inferred)estimated++;}else power++;
 }else if(e.type==='way'&&e.geometry?.length>1){
 const points=e.geometry.map((p:{lon:number;lat:number})=>project(p.lon,p.lat).setY(25));group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(points),new THREE.LineBasicMaterial({color:0xc9a767})));power++;estimated++;
 }else if(e.type==='node'&&Number.isFinite(e.lon)&&Number.isFinite(e.lat)){
 const mesh=new THREE.Mesh(new THREE.CylinderGeometry(tags.power==='tower'?1:0.4,tags.power==='tower'?4:0.4,height,4),new THREE.MeshStandardMaterial({color:0xb4b7a0}));mesh.position.copy(project(e.lon,e.lat)).setY(height/2);group.add(mesh);power++;if(inferred)estimated++;
 }
 }
 status.textContent=`${buildings} buildings · ${power} power · ${trees} trees · ${water} water · ${roads} roads · ${paths} paths · ${green} green areas · ${estimated} estimated heights · © OpenStreetMap contributors${fromCache?' · cached / imported':''}`;
 }catch{if(!disposed)status.textContent='OSM unavailable. Existing context retained; try again.';}finally{clearTimeout(timeout);if(!disposed)button.disabled=false;}
 };
 return {crossings:()=>crossings,shieldingAssets:()=>shieldingAssets,loadUrban(){imported=urbanBuildings;button.click();},update(target:THREE.Vector3){center.copy(target);},dispose(){disposed=true;controller?.abort();clear();scene.remove(group);ui.remove();}};
}
