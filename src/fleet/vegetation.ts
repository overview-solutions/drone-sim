import * as THREE from 'three';
import type {generateUN,V3} from './un';
import type {Vehicle} from './operations';
import {screenTree,treeCandidates,riskColors,growth,type TreeKind,type DemoTree,type VegetationEvent} from './vegetation-model';
type Network=ReturnType<typeof generateUN>;
const sessions=new Map<string,Map<string,{seconds:number;kind:TreeKind;hits:number}>>();
export function vegetation(scene:THREE.Scene,host:HTMLElement,canvas:HTMLElement,camera:THREE.Camera,network:Network,onAsset?:(id:string)=>void){
 const root=new THREE.Group();scene.add(root);
 const key=network.pack.subnetworks.id;let records=sessions.get(key);if(!records){records=new Map();sessions.set(key,records);}
 const trees:Array<{tree:DemoTree;crown:THREE.Mesh;polygon:THREE.Mesh;marker:THREE.LineSegments;spans:V3[][];result:ReturnType<typeof screenTree>}> = [];
 const meshes:THREE.Object3D[]=[];const byId=new Map<string,typeof trees[number]>();
 const groundLine=(points:V3[],color:number)=>{const obj=new THREE.Line(new THREE.BufferGeometry().setFromPoints(points.map(p=>new THREE.Vector3(...p))),new THREE.LineBasicMaterial({color,transparent:true,opacity:.45}));root.add(obj);};
 const step=Math.max(1,Math.ceil((network.locations.length-1)/90));
 for(let n=1;n<network.locations.length;n+=step){
  const a=network.locations[n-1],b=network.locations[n],dx=b[0]-a[0],dz=b[2]-a[2],len=Math.hypot(dx,dz);if(len<30)continue;const nx=-dz/len,nz=dx/len;
  for(const side of [-1,1])groundLine([[a[0]+nx*30*side,.4,a[2]+nz*30*side],[b[0]+nx*30*side,.4,b[2]+nz*30*side]],0x8ca9b0);
  const spans=network.spans.slice(Math.max(0,(n-2)*3),Math.min(network.spans.length,(n+1)*3)).map(s=>s.points);
  for(let j=0;j<6;j++){
   const f=.18+Math.floor(j/2)*.3,side=j%2?1:-1,variant=(n+j)%5,offset=[17,24,32,39,27][variant];
   const id=`TREE-${n}-${j}`,x=a[0]+dx*f+nx*offset*side,z=a[2]+dz*f+nz*offset*side;
   const tree:DemoTree={id,x,z,height:n%20>=9?12:[36,31,22,17,28][variant]+Math.sin(n)*2,radius:[9,10,8,6,9][variant],form:variant===3?'conical':'rounded',zone:n%20<9&&n%7===0&&j<2,kind:records.get(id)?.kind??'unknown'};
   const trunk=new THREE.Mesh(new THREE.CylinderGeometry(.4,.8,tree.height*.65,5),new THREE.MeshStandardMaterial({color:0x705543}));trunk.position.set(x,tree.height*.325,z);trunk.userData.treeId=id;root.add(trunk);meshes.push(trunk);
   const crown=new THREE.Mesh(tree.form==='conical'?new THREE.ConeGeometry(1,2,9):new THREE.IcosahedronGeometry(1,1),new THREE.MeshStandardMaterial({color:tree.zone?0x775380:0x49654d,roughness:1}));crown.position.set(x,tree.height*.7,z);crown.scale.set(tree.radius,tree.height*.3,tree.radius);crown.userData.treeId=id;crown.userData.assetDescription=`Height ${tree.height.toFixed(1)} m · crown width ${(tree.radius*2).toFixed(1)} m · ${tree.form} canopy · species unconfirmed · synthetic geometry`;root.add(crown);meshes.push(crown);
   const shape=new THREE.Shape();for(let k=0;k<12;k++){const angle=k/12*Math.PI*2,r=tree.radius;if(k===0)shape.moveTo(Math.cos(angle)*r,Math.sin(angle)*r);else shape.lineTo(Math.cos(angle)*r,Math.sin(angle)*r);}shape.closePath();
   const geo=new THREE.ExtrudeGeometry(shape,{depth:tree.height*.6,bevelEnabled:false});geo.rotateX(-Math.PI/2);
   const polygon=new THREE.Mesh(geo,new THREE.MeshBasicMaterial({color:0x78d8ad,transparent:true,opacity:.22,depthWrite:false}));polygon.position.set(x,tree.height*.4,z);polygon.userData.sensorIgnore=true;polygon.userData.treeId=id;polygon.visible=false;root.add(polygon);meshes.push(polygon);
   const marker=new THREE.LineSegments(new THREE.EdgesGeometry(geo),new THREE.LineBasicMaterial({color:0x78d8ad,transparent:true,opacity:.9}));marker.position.copy(polygon.position);marker.visible=false;root.add(marker);
   const item={tree,crown,polygon,marker,spans,result:screenTree(tree,spans)};trees.push(item);byId.set(id,item);
   if(tree.zone){const r=tree.radius+4;groundLine([[x-r,.6,z-r],[x+r,.6,z-r],[x+r,.6,z+r],[x-r,.6,z+r],[x-r,.6,z-r]],0xe08bff);}
  }
 }
 const ui=document.createElement('details');ui.className='vegetation-panel';ui.innerHTML=`<summary>Vegetation · synthetic corridor</summary><label><input class="veg-show" type="checkbox" checked> Trees + assessed canopy zones</label><div class="veg-count"></div><small>Corridor edges: ±30 m. Purple squares: hypothetical vegetation exclusion zones, not flight geofences. Red: &lt;2 m envelope gap; amber: &lt;6 m now / in 3 years. Demo thresholds, NOT flashover prediction.</small><label>Inspect tree <select class="veg-pick"><option value="">Click a tree or choose…</option>${trees.map(t=>`<option value="${t.tree.id}">${t.tree.id}${t.tree.zone?' · exclusion':''}</option>`).join('')}</select></label><div class="veg-detail">LiDAR returns → pass complete → canopy extrusion. Select a crown to review morphology and species.</div><label>Reviewer species <select class="veg-species"><option value="unknown">Unknown / unconfirmed</option><option value="oak">Oak</option><option value="maple">Maple</option><option value="pine">Pine</option><option value="cottonwood">Cottonwood</option></select></label><button class="veg-export">Export assessed canopy GeoJSON</button><small>Shapes/heights are synthetic scene geometry, not reconstructed from sparse demo returns. Candidate groups are rules, not a trained species classifier. Reviewer labels persist for this session.</small>`;host.append(ui);
 let selected:string|null=null,currentSeconds=0,vehicle:Vehicle|undefined,lastRender=0;const select=ui.querySelector('.veg-pick') as HTMLSelectElement,species=ui.querySelector('.veg-species') as HTMLSelectElement;
 function selectTree(id:string){selected=id;select.value=id;details();if(onAsset){ui.open=false;(ui.closest('.operator-drawer') as HTMLDetailsElement|null)?.removeAttribute('open');onAsset(id);}else ui.open=true;}
 function details(){const item=selected?byId.get(selected):undefined;if(!item)return;const t=item.tree,record=records!.get(t.id),seen=record&&record.seconds<=currentSeconds;if(document.activeElement!==species)species.value=t.kind;
 ui.querySelector('.veg-detail')!.textContent=`${t.id} · ${seen?record.hits+' simulated returns':'Not yet scanned'}${t.zone?' · EXCLUSION ZONE':''}\nHeight ${t.height.toFixed(1)} m · crown width ${(t.radius*2).toFixed(1)} m · ${t.form} form\n${treeCandidates(t).join('; ')}\nSpecies: ${t.kind==='unknown'?'unconfirmed':t.kind+' (reviewer assigned)'}\n${seen?`${item.result.risk.toUpperCase()} screening · crown-envelope gap ${item.result.clearance.toFixed(1)} m; 3-year scenario ${item.result.future.toFixed(1)} m`:'Risk assessment pending scan'}\nAssumed growth ${growth[t.kind]} m/year. Not species identification, branch clearance, or electrical safety validation.`;
 }
 select.onchange=()=>selectTree(select.value);species.onchange=()=>{const item=selected?byId.get(selected):undefined;if(!item)return;item.tree.kind=species.value as TreeKind;const record=records!.get(item.tree.id);records!.set(item.tree.id,{seconds:record?.seconds??Infinity,hits:record?.hits??0,kind:item.tree.kind});item.result=screenTree(item.tree,item.spans);details();};
 (ui.querySelector('.veg-show') as HTMLInputElement).onchange=e=>root.visible=(e.target as HTMLInputElement).checked;
 const ray=new THREE.Raycaster(),pointer=new THREE.Vector2();let down=[0,0];const onDown=(e:PointerEvent)=>down=[e.clientX,e.clientY];
 const onUp=(e:PointerEvent)=>{if(Math.hypot(e.clientX-down[0],e.clientY-down[1])>5||!root.visible)return;const r=canvas.getBoundingClientRect();pointer.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);ray.setFromCamera(pointer,camera);const hit=ray.intersectObjects(meshes.filter(m=>m.visible),false)[0];if(hit){selectTree(hit.object.userData.treeId);if(!onAsset){const drawer=ui.closest('.operator-drawer') as HTMLDetailsElement|null;if(drawer)drawer.open=true;}}};canvas.addEventListener('pointerdown',onDown);canvas.addEventListener('pointerup',onUp);
 (ui.querySelector('.veg-export') as HTMLButtonElement).onclick=()=>{const cos=Math.cos(network.origin[1]*Math.PI/180);const features=trees.filter(i=>records!.get(i.tree.id)?.seconds!<=currentSeconds).map(i=>{const t=i.tree;const ring=Array.from({length:13},(_,k)=>{const a=k%12/12*Math.PI*2,r=t.radius;return [network.origin[0]+(t.x+Math.cos(a)*r)/(111320*cos),network.origin[1]-(t.z-Math.sin(a)*r)/111320];});return {type:'Feature',id:t.id,geometry:{type:'Polygon',coordinates:[ring]},properties:{synthetic:true,treeId:t.id,heightMeters:t.height,baseHeightMeters:t.height*.4,species:t.kind,speciesSource:t.kind==='unknown'?'unconfirmed':'reviewer',risk:i.result.risk,clearanceEnvelopeMeters:i.result.clearance,projectedGap3Years:i.result.future,exclusionZone:t.zone,verticalDatum:'arbitrary flat local ground',thresholds:'hypothetical 2m/6m, not MVCD'}};});const url=URL.createObjectURL(new Blob([JSON.stringify({type:'FeatureCollection',features},null,2)],{type:'application/geo+json'}));const a=document.createElement('a');a.href=url;a.download='synthetic-canopy-assessments.geojson';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
 return {
 backfill(span:number,seconds:number){for(const item of trees){if(Number(item.tree.id.split('-')[1])!==span+1)continue;const old=records!.get(item.tree.id);if(!old||seconds<old.seconds)records!.set(item.tree.id,{seconds,hits:old?.hits??1,kind:item.tree.kind});}},
 observe(id:string){if(!vehicle||vehicle.stage!=='Inspecting'||!byId.has(id))return;const item=byId.get(id)!,r=records!.get(id);records!.set(id,{seconds:Math.min(r?.seconds??Infinity,currentSeconds),hits:(r?.hits??0)+1,kind:item.tree.kind});},
 update(v:Vehicle|undefined,p:THREE.Vector3,heading:THREE.Vector3,now:number){vehicle=v;currentSeconds=v?.timeline.seconds??0;
 for(const item of trees){const rec=records!.get(item.tree.id),assessed=!!rec&&rec.seconds+2<=currentSeconds;item.polygon.visible=item.marker.visible=assessed;
 if(assessed){const color=riskColors[item.result.risk];(item.polygon.material as THREE.MeshBasicMaterial).color.set(color);(item.marker.material as THREE.LineBasicMaterial).color.set(item.tree.zone?'#df8aff':color);}}
 if(now-lastRender>500){lastRender=now;const assessed=trees.filter(t=>t.polygon.visible);ui.querySelector('.veg-count')!.textContent=`${trees.length} hypothetical trees · ${assessed.length} assessed · ${assessed.filter(t=>t.result.risk==='high').length} high priority`;details();}
 },
 events():VegetationEvent[]{return trees.flatMap(t=>{const r=records!.get(t.tree.id);return r&&Number.isFinite(r.seconds)&&r.seconds+2<=currentSeconds&&(t.result.risk!=='low'||t.tree.zone)?[{id:t.tree.id,seconds:r.seconds,risk:t.result.risk,zone:t.tree.zone}]:[];});},
 select:selectTree,
 dispose(){canvas.removeEventListener('pointerdown',onDown);canvas.removeEventListener('pointerup',onUp);ui.remove();}
 };
}
