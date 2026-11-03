import {historyCard} from './asset-history';
import * as THREE from 'three';
import {defectFor} from './equipment';
import type {generateUN} from './un';
import type {VegetationEvent} from './vegetation-model';
/** Resolve evidence to modeled components, not an invented survey position. */
export function assetTarget(scene:THREE.Scene,network:ReturnType<typeof generateUN>,event:VegetationEvent){
 const equipment=event.id.startsWith('EQUIP-'),key=Number(event.id.slice(6)),splice=equipment&&key>=network.towers.length;
 const tower=equipment?(splice?key-network.towers.length:key):Math.max(0,Number(event.id.split('-')[1])-1);
 const phase=equipment?(splice?3:defectFor(tower).phase):undefined;
 const meshes:THREE.Mesh[]=[];scene.traverse(o=>{const m=o as THREE.Mesh;if(m.isMesh&&(equipment?m.userData.equipmentTower===tower&&m.userData.equipmentPhase===phase:m.userData.treeId===event.id&&!m.userData.sensorIgnore))meshes.push(m);});
 const bounds=new THREE.Box3();meshes.forEach(m=>bounds.expandByObject(m));
 const component=equipment?(splice?network.splices.find(s=>s.fromTower===tower)?.id:phase!<0?network.towers[tower]?.id:network.towers[tower]?.attachments[phase!]?.id):event.id;
 if(bounds.isEmpty()){const t=network.towers[tower];if(!t)return;bounds.setFromCenterAndSize(new THREE.Vector3(t.position[0],t.height,t.position[2]),new THREE.Vector3(8,8,8));}
 return {bounds,meshes,component:component??event.id,tower,phase,kind:equipment?'Equipment':'Vegetation'};
}
export function assetEvidence(host:HTMLElement,scene:THREE.Scene){
 const panel=document.createElement('section');panel.className='asset-evidence';panel.hidden=true;host.append(panel);
 return {show(event:VegetationEvent,target:NonNullable<ReturnType<typeof assetTarget>>,back:()=>void){panel.replaceChildren();panel.hidden=false;
 const info=document.createElement('div'),title=document.createElement('strong'),meta=document.createElement('p'),button=document.createElement('button');title.textContent=event.label??event.id;meta.textContent=`${target.component} · ${target.kind}${target.phase===undefined?'':target.phase===3?' · Phase B splice':target.phase<0?' · Structure':' · Phase '+['A','B','C'][target.phase]} · ${Number.isFinite(event.seconds)?(event.risk==='high'||event.zone?'High':'Review')+' priority · flagged '+(event.seconds/60).toFixed(1)+' mission min':'No active flagged finding'}`;button.textContent='← Span';button.onclick=back;info.append(button,title,meta);const coverage=target.meshes.find(m=>m.userData.inspectionSummary)?.userData.inspectionSummary;const coverageText=document.createElement('p');coverageText.textContent=coverage??'Inspection index: no capture record loaded';info.append(coverageText);const description=target.meshes.find(m=>m.userData.assetDescription)?.userData.assetDescription;if(description){const p=document.createElement('p');p.textContent=description;info.append(p);}
 const note=document.createElement('small');note.textContent='No captured photos available. These are current synthetic model previews, not inspection evidence.';info.append(note);panel.append(info);
 const gallery=document.createElement('div');gallery.className='asset-gallery';panel.append(gallery);panel.append(historyCard(target.component,target.kind==='Vegetation'));
 let renderer:THREE.WebGLRenderer|undefined;
 try{renderer=new THREE.WebGLRenderer({antialias:true});renderer.setSize(360,200);const center=target.bounds.getCenter(new THREE.Vector3()),size=Math.max(6,target.bounds.getSize(new THREE.Vector3()).length());
 for(const [label,side] of [['Front',1],['Opposing',-1]] as const){const camera=new THREE.PerspectiveCamera(42,1.8,.1,1000000);camera.layers.enable(1);camera.position.copy(center).add(new THREE.Vector3(side,.35,1).normalize().multiplyScalar(size*1.7));camera.lookAt(center);renderer.render(scene,camera);const figure=document.createElement('figure'),image=document.createElement('img'),caption=document.createElement('figcaption');image.src=renderer.domElement.toDataURL('image/png');image.alt=label+' synthetic model preview of '+target.component;caption.textContent=label+' · simulated model';figure.append(image,caption);gallery.append(figure);}
 }catch{gallery.textContent='Model previews unavailable.';}finally{renderer?.dispose();renderer?.forceContextLoss();}
 },hide(){panel.hidden=true;},dispose(){panel.remove();}};
}
