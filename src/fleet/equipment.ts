import * as THREE from 'three';
import type {generateUN} from './un';
import type {VegetationEvent} from './vegetation-model';
export const defectTypes=[{label:'Broken insulator',phase:0,risk:'high'},{label:'Component corrosion',phase:-1,risk:'growing'},{label:'Loose attachment hardware',phase:1,risk:'high'},{label:'Damaged crossarm',phase:-1,risk:'high'}] as const;
export function defectFor(tower:number){return defectTypes[tower%defectTypes.length];}
export function recordEquipmentCapture(findings:Map<number,{seconds:number;status:string}>,tower:number,phase:number,seconds:number){
 if(!Number.isInteger(tower)||tower<0||!Number.isFinite(seconds)||seconds<0||tower%20>=8||defectFor(tower).phase!==phase)return false;
 const old=findings.get(tower);if(!old||seconds<old.seconds)findings.set(tower,{seconds,status:old?.status??'candidate'});return true;
}
const sessions=new Map<string,Map<number,{seconds:number;status:string}>>();
export function equipment(scene:THREE.Scene,host:HTMLElement,network:ReturnType<typeof generateUN>){
 const key=network.pack.subnetworks.id;let findings=sessions.get(key);if(!findings){findings=new Map();sessions.set(key,findings);}
 const info=(i:number)=>i<network.towers.length?{...defectFor(i),tower:i,componentId:defectFor(i).phase<0?network.towers[i].id:network.towers[i].attachments[defectFor(i).phase].id}:({label:'Suspect conductor splice',phase:3,risk:'high' as const,tower:i-network.towers.length,componentId:network.splices.find(s=>s.fromTower===i-network.towers.length)!.id});
 const keys=[...network.towers.map((_,i)=>i),...network.splices.map(s=>network.towers.length+s.fromTower)];
 const targets=new Map<number,Array<{material:THREE.MeshStandardMaterial|THREE.MeshBasicMaterial;color:THREE.Color}>>();
 scene.traverse(object=>{const mesh=object as THREE.Mesh;if(!mesh.isMesh||!Number.isInteger(mesh.userData.equipmentTower))return;const tower=mesh.userData.equipmentTower as number,phase=mesh.userData.equipmentPhase as number,key=phase===3?network.towers.length+tower:tower;if(phase!==info(key).phase)return;
  // Materials must be private: steel is shared by the aircraft and healthy structures.
  const original=Array.isArray(mesh.material)?mesh.material:[mesh.material],clones=original.map(m=>m.clone());mesh.material=Array.isArray(mesh.material)?clones:clones[0];
  for(const material of clones){const m=material as THREE.MeshStandardMaterial;if(m.color){const list=targets.get(key)??[];list.push({material:m,color:m.color.clone()});targets.set(key,list);}}
 });
 const marks=new Map(keys.map(i=>{const d=info(i),t=network.towers[d.tower],position=d.phase===3?network.splices.find(s=>s.fromTower===d.tower)!.position:d.phase<0?t.position.map((v,k)=>k===1?t.height:v):t.attachments[d.phase].position;const mesh=new THREE.Mesh(new THREE.OctahedronGeometry(2.5),new THREE.MeshBasicMaterial({color:0xff263c,wireframe:true,depthTest:false}));mesh.position.set(position[0],position[1]+3,position[2]);mesh.userData.sensorIgnore=true;mesh.visible=false;scene.add(mesh);return [i,mesh] as const;}));
 const panel=document.createElement('details');panel.className='equipment-panel';panel.innerHTML='<summary>Equipment findings · simulated</summary><small>Red components are potential risks, revealed 2 simulation seconds after a matching capture. No image classifier or real fault diagnosis.</small><div class="equipment-list"></div><div class="equipment-detail">Awaiting camera evidence.</div><button data-status="reviewed">Mark reviewed</button><button data-status="dismissed">Dismiss candidate</button><button data-status="candidate">Reopen</button>';host.append(panel);
 let selected:number|undefined,time=0,last=-Infinity;
 function show(i:number){selected=i;panel.open=true;const drawer=panel.closest('.operator-drawer') as HTMLDetailsElement|null;if(drawer)drawer.open=true;render();}
 function render(){const list=panel.querySelector('.equipment-list')!;const signature=[...findings!].filter(([,r])=>r.seconds<=time).map(([i,r])=>`${i}:${r.status}`).join('|');if(list.getAttribute('data-signature')!==signature){list.setAttribute('data-signature',signature);list.replaceChildren();for(const [i,r] of findings!){if(r.seconds>time)continue;const b=document.createElement('button');b.textContent=`T${info(i).tower+1} · ${info(i).label} · ${r.status}`;b.onclick=()=>show(i);list.append(b);}}
 const r=selected===undefined?undefined:findings!.get(selected);panel.querySelector('.equipment-detail')!.textContent=r&&r.seconds<=time?`Tower ${info(selected!).tower+1} · ${info(selected!).label}\n${info(selected!).phase===3?'Phase B splice':info(selected!).phase<0?'Structure overview':'Phase '+['A','B','C'][info(selected!).phase]} · ${info(selected!).componentId} · simulated processing completed at ${(r.seconds/60).toFixed(1)} min\n${r.status.toUpperCase()} · hypothetical ${info(selected!).risk==='high'?'high':'medium'} review priority. Requires qualified inspection; no measured severity or outage probability.`:[...findings!.values()].some(f=>f.seconds<=time)?'Select a finding to review.':'Awaiting camera evidence.';
 panel.querySelectorAll<HTMLButtonElement>('[data-status]').forEach(b=>b.disabled=!r||r.seconds>time);
 }
 panel.querySelectorAll<HTMLButtonElement>('[data-status]').forEach(b=>b.onclick=()=>{if(selected!==undefined){const r=findings!.get(selected);if(r)r.status=b.dataset.status!;render();}});
 return {
 capture(tower:number,phase:number,seconds:number){if(tower%20>=8)return;if(phase===3&&network.splices.some(s=>s.fromTower===tower)&&Number.isFinite(seconds)&&seconds>=0){const key=network.towers.length+tower,old=findings!.get(key);if(!old||seconds+2<old.seconds)findings!.set(key,{seconds:seconds+2,status:old?.status??'candidate'});}else recordEquipmentCapture(findings!,tower,phase,seconds+2);},
 update(seconds:number,now:number){time=seconds;marks.forEach((m,i)=>{const r=findings!.get(i);m.visible=!!r&&r.seconds<=time&&r.status!=='dismissed';for(const t of targets.get(i)??[])t.material.color.copy(m.visible?new THREE.Color(0xff102b):t.color);});if(now-last>500){last=now;render();}},
 events():VegetationEvent[]{return [...findings!].filter(([,r])=>r.seconds<=time&&r.status!=='dismissed').map(([i,r])=>({id:`EQUIP-${i}`,seconds:r.seconds,risk:info(i).risk,zone:false,category:'equipment',label:`T${info(i).tower+1} · ${info(i).label}`}));},
 select(id:string){show(Number(id.replace('EQUIP-','')));},dispose(){panel.remove();}
 };
}
