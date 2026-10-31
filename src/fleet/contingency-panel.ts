import * as THREE from 'three';
import {planEscape,type Intruder} from './contingency';
import type {WorldData} from './world';
export function contingencyPanel(scene:THREE.Scene,host:HTMLElement,world:WorldData,origin:number[],wires:THREE.Vector3[][]){
 const project=(p:number[],y=85)=>new THREE.Vector3((p[0]-origin[0])*111320*Math.cos(origin[1]*Math.PI/180),y,-(p[1]-origin[1])*111320);
 const unproject=(p:THREE.Vector3)=>[origin[0]+p.x/(111320*Math.cos(origin[1]*Math.PI/180)),origin[1]-p.z/111320];
 const panel=document.createElement('div');panel.className='contingency-controls';panel.innerHTML='<button data-rth title="Calculate a curved connection and return along the flown route">Return home</button><select aria-label="Demo encounter"><option value="cross">Crossing plane</option><option value="head">Oncoming helicopter</option><option value="blocked">Blocked escape</option></select><button data-run>Test avoidance</button><span class="contingency-info" tabindex="0" title="Simulation only. Checks cover the connection: 700 ft radius and lateral envelope, 20 m conductor clearance, 2 m/s descent, synthetic ground. Remaining route and airport approach are unvalidated." aria-label="Simulation assumptions">ⓘ</span><p role="status" hidden></p>';host.append(panel);
 const status=panel.querySelector('p')!;
 const line=new THREE.Line(new THREE.BufferGeometry(),new THREE.LineBasicMaterial({color:0x61eed0,depthTest:false}));line.layers.set(1);scene.add(line);
 const intruderMesh=new THREE.Mesh(new THREE.ConeGeometry(25,65,4),new THREE.MeshBasicMaterial({color:0xff925f,wireframe:true,depthTest:false}));intruderMesh.layers.set(1);intruderMesh.visible=false;scene.add(intruderMesh);
 const previewLine=new THREE.Line(new THREE.BufferGeometry(),new THREE.LineBasicMaterial({color:0xffdc84,depthTest:false,transparent:true,opacity:.95}));previewLine.layers.set(1);previewLine.userData.sensorIgnore=true;previewLine.renderOrder=12;previewLine.visible=false;scene.add(previewLine);
 let hovering=false,previewAge=0;
 let intruder:Intruder|undefined,age=0;
 function run(returning=false,preview=false){status.hidden=false;
  const v=world.fleet?.().find(v=>v.id===world.activeVehicle);
  if(!v||v.done||v.replaying||v.returning){if(preview)previewLine.visible=false;status.textContent=v?.returning?'Returning home':v?.replaying?'Switch to live to command return.':'Select an airborne aircraft.';return;}
  const start=project(v.coord,v.altitude),forward=project(v.headingCoord,v.altitude).sub(start).normalize(),heading=Math.atan2(forward.z,forward.x);
  let nearest=0,min=Infinity;v.route.forEach((p,i)=>{const d=project(p).distanceTo(start);if(d<min){min=d;nearest=i;}});
  const scenario=(panel.querySelector('select') as HTMLSelectElement).value;
  if(!returning){const side=new THREE.Vector3(-forward.z,0,forward.x);intruder={position:start.clone().addScaledVector(forward,800).addScaledVector(side,scenario==='cross'?900:0),velocity:(scenario==='cross'?side.clone().negate():forward.clone().negate()).multiplyScalar(45)};age=0;intruderMesh.visible=true;intruderMesh.position.copy(intruder.position);}
  const candidates:{point:THREE.Vector3;heading:number;label:string;index:number;backtrack:boolean}[]=[];
  for(const offset of (returning?[-120,-220,-360]:[120,220,360,-120,-220])){const backtrack=offset<0;const i=Math.max(0,Math.min(v.route.length-2,nearest+offset));if(i===nearest)continue;const end=project(v.route[i],returning?85:Math.max(70,v.altitude-15));const direction=project(v.route[i+(backtrack?-1:1)]??v.route[i]).sub(end);candidates.push({point:end,heading:Math.atan2(direction.z,direction.x),label:backtrack?'Curved backtrack / return':'Forward refuge / rejoin',index:i,backtrack});}
  status.textContent=returning?'Calculating return…':'Checking escape…';
  const result=planEscape(start,heading,candidates,wires,returning?undefined:intruder);
  if(!result.best||(!returning&&scenario==='blocked')){status.textContent=(returning?'No return connection':'No escape')+' · current route continues · operator action needed';status.title=scenario==='blocked'?'Demo blocks all candidates.':result.rejected.join('; ');if(preview)previewLine.visible=false;else line.visible=false;return;}
  const best=result.best,target=candidates.find(c=>c.point.distanceTo(best.points.at(-1)!)<1)!;
  const returningHome=returning||target.backtrack;
  const rest=returningHome?v.route.slice(0,target.index).reverse():v.route.slice(target.index+1);
  const points=[...best.points,...rest.map((p,i)=>project(p,Math.min(85,target.point.y+i*.5)))];
  // Preserve an illustrative final descent. Airport segment is not shielding-validated.
  let remaining=0;for(let i=points.length-1;i>=best.points.length;i--){if(i<points.length-1)remaining+=points[i].distanceTo(points[i+1]);points[i].y=Math.min(points[i].y,Math.max(1.5,remaining*.08));}
  if(preview){previewLine.geometry.dispose();previewLine.geometry=new THREE.BufferGeometry().setFromPoints(points);previewLine.visible=true;status.textContent='Gold: proposed return · connection checked; approach unvalidated';return;}
  previewLine.visible=false;
  const applied=world.contingency?.(v.id,points.map(unproject),points.map(p=>p.y),returningHome,returningHome?'Returning':'Avoiding / rejoining',best.length/1000);
  if(!applied){status.textContent='Flight changed; no route applied. Retry in live mode.';return;}
  line.geometry.dispose();line.geometry=new THREE.BufferGeometry().setFromPoints(returningHome?points:best.points);line.visible=true;
  let total=0;for(let i=1;i<points.length;i++)total+=points[i].distanceTo(points[i-1]);
  status.textContent=(returningHome?'Returning to '+v.from+' · '+(total/1000).toFixed(1)+' km':'Avoiding · '+Math.round(best.length)+' m connection')+' · connection checks passed';
  status.title='700 ft radius and lateral envelope; modeled conductor clearance. Remaining route and approach unvalidated.';
 }
 panel.querySelector<HTMLButtonElement>('[data-run]')!.onclick=()=>run();
 const returnButton=panel.querySelector<HTMLButtonElement>('[data-rth]')!;
 returnButton.onclick=()=>{hovering=false;run(true);};
 const enter=()=>{hovering=true;previewAge=0;run(true,true);};
 const leave=()=>{hovering=false;previewLine.visible=false;status.hidden=true;};
 returnButton.onmouseenter=enter;returnButton.onmouseleave=leave;returnButton.onfocus=enter;returnButton.onblur=leave;
 world.recall=()=>run(true);
 return {update(dt:number){if(hovering){previewAge+=dt;if(previewAge>=1){previewAge=0;run(true,true);}}if(intruder&&world.fleetState?.().running){age+=dt*(world.fleetState?.().rate||1);intruderMesh.position.copy(intruder.position).addScaledVector(intruder.velocity,age);intruderMesh.visible=age<120;}},dispose(){previewLine.geometry.dispose();(previewLine.material as THREE.Material).dispose();scene.remove(previewLine);line.geometry.dispose();(line.material as THREE.Material).dispose();intruderMesh.geometry.dispose();intruderMesh.material.dispose();scene.remove(line,intruderMesh);panel.remove();}};
}
