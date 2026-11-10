import {towerProcessing} from './tower-processing';
import rayPoints from './ray-king-data.json';
import raySpans from './ray-king-spans.json';
import {obstacleCloud,scanClasses} from './span-obstacles';
import {demoClearanceMeters,scenarioVoltages,nearestVoltageIndex} from './clearance-envelope';
import * as THREE from 'three';
import type {generateUN} from './un';
/** On-demand synthetic surface sampling; never presented as acquired survey data. */
export function spanDetail(scene:THREE.Scene,host:HTMLElement,network:ReturnType<typeof generateUN>,onTower:(index:number)=>void=()=>{}){
 const root=new THREE.Group(),cloud=new THREE.Group(),derived=new THREE.Group(),clearance=new THREE.Group(),motion=new THREE.Group(),ground=new THREE.Group();root.add(cloud,derived,clearance,motion,ground);scene.add(root);
 const ui=document.createElement('div');ui.className='span-detail';ui.hidden=true;ui.innerHTML='<b>Span inspection</b><span class="span-load" role="status"></span><div><label><input type="checkbox" data-cloud checked> Points</label><label><input type="checkbox" data-derived checked> Geometry</label></div><div class="span-voltage"><label>kV <input data-voltage type="range" min="0" max="12" step="1" aria-label="Scenario voltage in kilovolts"></label><output data-clearance></output><label><input type="checkbox" data-zones checked> Zones</label></div><small>Illustrative zones · not MAD / MVCD / arc-flash limits</small><small>Synthetic surface samples · cyan wires / amber supports · not acquired LiDAR</small>';host.append(ui);
 const processor=network.pack.provenance.osmWay===179559746?towerProcessing(scene,host,ui,onTower):undefined;
 const vision=document.createElement('select');vision.setAttribute('aria-label','Span vision mode');vision.innerHTML='<option value="contrast">Ghost</option><option value="scene">Scene</option><option value="elevation">Elevation</option>';ui.prepend(vision);
 if(network.pack.provenance.osmWay===179559746)vision.innerHTML='<option value="scene">Classified</option><option value="elevation">Elevation</option>';
 const legend=document.createElement('div');legend.className='span-height-legend';legend.hidden=true;legend.innerHTML='<div style="height:7px;background:linear-gradient(90deg,#254cc9,#24c7bf,#ead94c,#ed6a42);border-radius:4px"></div><small>0 m · 20 m · 40 m · 60+ m<br>Height above synthetic ground</small>';ui.append(legend);
 const heightColor=(y:number)=>{const stops=[new THREE.Color('#254cc9'),new THREE.Color('#24c7bf'),new THREE.Color('#ead94c'),new THREE.Color('#ed6a42')],v=THREE.MathUtils.clamp(y/60,0,1)*3,i=Math.min(2,Math.floor(v));return stops[i].clone().lerp(stops[i+1],v-i);};
 const originals=new Map<THREE.Mesh,THREE.Material|THREE.Material[]>();
 function restore(){for(const [mesh,original] of originals){for(const m of Array.isArray(mesh.material)?mesh.material:[mesh.material])m.dispose();mesh.material=original;}originals.clear();}
 function ghost(meshes:THREE.Mesh[]){restore();if(vision.value==='scene')return;for(const mesh of meshes){originals.set(mesh,mesh.material);const faded=(Array.isArray(mesh.material)?mesh.material:[mesh.material]).map(m=>{const c=m.clone();c.transparent=true;c.opacity=.12;c.depthWrite=false;return c;});mesh.material=Array.isArray(mesh.material)?faded:faded[0];}}
 let surfaces:THREE.Mesh[]=[];
 function elevation(){const active=current>=0&&vision.value==='elevation';legend.hidden=!active;ground.visible=active;
 for(const o of cloud.children){const pts=o as THREE.Points,mat=pts.material as THREE.PointsMaterial,g=pts.geometry;
 if(!pts.userData.originalAppearance)pts.userData.originalAppearance={color:mat.color.clone(),vertexColors:mat.vertexColors,attribute:g.getAttribute('color')};
 const original=pts.userData.originalAppearance;
 if(active){if(!pts.userData.heightColors){const pos=g.getAttribute('position'),values:number[]=[];for(let i=0;i<pos.count;i++){const c=heightColor(pts.userData.elevationRange?60*(pos.getY(i)-pts.userData.elevationRange[0])/Math.max(.01,pts.userData.elevationRange[1]-pts.userData.elevationRange[0]):pos.getY(i));values.push(c.r,c.g,c.b);}pts.userData.heightColors=new THREE.Float32BufferAttribute(values,3);}g.setAttribute('color',pts.userData.heightColors);mat.color.set(0xffffff);mat.vertexColors=true;}
 else{if(original.attribute)g.setAttribute('color',original.attribute);else g.deleteAttribute('color');mat.color.copy(original.color);mat.vertexColors=original.vertexColors;}mat.needsUpdate=true;
 }}
 vision.onchange=()=>{ghost(surfaces);elevation();};
 const adjustments=document.createElement('div');adjustments.className='span-motion';adjustments.title='Illustrative envelopes: 3 m extra sag / ±3 m sway';adjustments.innerHTML='<label><input data-sag type="checkbox"> Sag</label><label><input data-sway type="checkbox"> Sway</label><small>Illustrative envelopes · 3 m extra sag / ±3 m sway</small>';ui.append(adjustments);
 function motionPoints(points:number[][],sag=0,sway=0){const a=new THREE.Vector3(...points[0]),b=new THREE.Vector3(...points.at(-1)!),normal=new THREE.Vector3(-(b.z-a.z),0,b.x-a.x).normalize();return points.map((p,i)=>{const t=i/(points.length-1),shape=4*t*(1-t);return new THREE.Vector3(...p).addScaledVector(normal,sway*shape).add(new THREE.Vector3(0,-sag*shape,0));});}
 function updateMotion(){clear(motion);if(current<0)return;const sag=adjustments.querySelector<HTMLInputElement>('[data-sag]')!.checked,sway=adjustments.querySelector<HTMLInputElement>('[data-sway]')!.checked;
 for(const span of network.spans.slice(current*3,current*3+3))for(const [drop,shift,color] of [...(sag?[[3,0,0xff96cf]]:[]),...(sway?[[0,-3,0x9eacff],[0,3,0x9eacff]]:[])]){const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints(motionPoints(span.points,drop,shift)),new THREE.LineBasicMaterial({color}));line.layers.set(1);line.userData.sensorIgnore=true;motion.add(line);}zones();}
 adjustments.onchange=updateMotion;
 let current=-1,generation=0,disposed=false;
 const voltage=ui.querySelector<HTMLInputElement>('[data-voltage]')!;voltage.max=String(scenarioVoltages.length-1);voltage.value=String(nearestVoltageIndex(Number(network.pack.electricLines.features[0]?.properties.nominalKv)||138));voltage.title='Voltage classes: '+scenarioVoltages.join(', ')+' kV';
 voltage.oninput=()=>zones();ui.querySelector<HTMLInputElement>('[data-zones]')!.onchange=e=>clearance.visible=(e.target as HTMLInputElement).checked;
 function zones(){clear(clearance);const kv=scenarioVoltages[Number(voltage.value)],radius=demoClearanceMeters(kv);voltage.setAttribute('aria-valuetext',kv+' kilovolts');ui.querySelector('output')!.textContent=kv+' kV';ui.querySelector('output')!.title='Illustrative clearance: '+radius.toFixed(2)+' m / '+(radius/0.3048).toFixed(1)+' ft; not an electrical safety limit';if(current<0)return;
 const vertices:THREE.Vector3[]=[];
 function sphere(center:THREE.Vector3){for(let plane=0;plane<3;plane++)for(let k=0;k<24;k++){const point=(j:number)=>{const a=j/24*Math.PI*2,c=Math.cos(a)*radius,s=Math.sin(a)*radius;return center.clone().add(plane===0?new THREE.Vector3(c,s,0):plane===1?new THREE.Vector3(c,0,s):new THREE.Vector3(0,c,s));};vertices.push(point(k),point(k+1));}}
 // Sparse radial rings and four longitudinal rails around every phase conductor.
 for(const span of network.spans.slice(current*3,current*3+3)){const pts=motionPoints(span.points);const direction=pts.at(-1)!.clone().sub(pts[0]).normalize(),normal=new THREE.Vector3(-direction.z,0,direction.x).normalize(),up=new THREE.Vector3().crossVectors(direction,normal).normalize();
 const offset=(p:THREE.Vector3,a:number)=>p.clone().addScaledVector(normal,Math.cos(a)*radius).addScaledVector(up,Math.sin(a)*radius);
 for(let j=0;j<pts.length;j++){if(j%2===0)for(let k=0;k<16;k++)vertices.push(offset(pts[j],k/16*Math.PI*2),offset(pts[j],(k+1)/16*Math.PI*2));if(j)for(let k=0;k<4;k++)vertices.push(offset(pts[j-1],k*Math.PI/2),offset(pts[j],k*Math.PI/2));}}
 for(const i of [current,current+1])for(const at of network.towers[i].attachments)sphere(new THREE.Vector3(...at.position));
 for(const splice of network.splices.filter(s=>s.fromTower===current))sphere(new THREE.Vector3(...splice.position));
 const lines=new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(vertices),new THREE.LineBasicMaterial({color:0xe8b45b,transparent:true,opacity:.4,depthWrite:false}));lines.layers.set(1);lines.userData.sensorIgnore=true;clearance.add(lines);
 }

 ui.querySelector<HTMLInputElement>('[data-cloud]')!.onchange=e=>{cloud.visible=(e.target as HTMLInputElement).checked;elevation();};
 ui.querySelector<HTMLInputElement>('[data-derived]')!.onchange=e=>{derived.visible=(e.target as HTMLInputElement).checked;elevation();};
 function clear(group:THREE.Group){for(const o of [...group.children]){const m=o as THREE.Mesh;m.geometry?.dispose();if(m.material)for(const mat of Array.isArray(m.material)?m.material:[m.material])mat.dispose();group.remove(o);}}
 function addOutline(points:THREE.Vector3[],color:number){const l=new THREE.Line(new THREE.BufferGeometry().setFromPoints(points),new THREE.LineBasicMaterial({color,transparent:true,opacity:.9}));l.layers.set(1);l.userData.sensorIgnore=true;derived.add(l);}
 async function show(index:number){if(index<0||index+1>=network.towers.length)return;ui.hidden=false;root.visible=true;if(index===current)return;restore();surfaces=[];current=index;updateMotion();const token=++generation;clear(cloud);clear(derived);clear(ground);elevation();
 const status=ui.querySelector<HTMLElement>('.span-load')!;status.textContent='Loading surfaces…';
 const a=new THREE.Vector3(...network.towers[index].position),b=new THREE.Vector3(...network.towers[index+1].position),axis=b.clone().sub(a);axis.y=0;const length=axis.length();axis.normalize();const normal=new THREE.Vector3(-axis.z,0,axis.x);
 if(network.pack.provenance.osmWay===179559746){
  processor?.show(index);
  const selected=rayPoints.points.filter(p=>{const q=new THREE.Vector3(p[0],p[1],p[2]).sub(a),t=q.dot(axis);return t>=-30&&t<=length+30&&Math.abs(q.dot(normal))<=150;});
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(selected.flatMap(p=>p.slice(0,3)),3));geometry.setAttribute('color',new THREE.Float32BufferAttribute(selected.flatMap(p=>{const c=new THREE.Color(p[3]===2?0xc3b493:p[3]===5?0x65d9b0:0xa9d9ff);return [c.r,c.g,c.b];}),3));
  const pts=new THREE.Points(geometry,new THREE.PointsMaterial({size:2,vertexColors:true,sizeAttenuation:false}));pts.userData.sensorIgnore=true;cloud.add(pts);
  for(const cable of network.spans.slice(index*3,index*3+3))addOutline(cable.points.map(p=>new THREE.Vector3(...p)),0x65d9b0);
  const record=raySpans.spans[index];if(record.envelope.length)addOutline(record.envelope.map(p=>new THREE.Vector3(...p)),0xe8b45b);
  for(const i of [index,index+1]){const t=raySpans.supports[i];addOutline([new THREE.Vector3(...t.position),new THREE.Vector3(t.position[0],t.top,t.position[2])],0xe8b45b);}
  status.textContent=`${record.id} · ${record.lengthMeters.toFixed(0)} m · ${selected.length.toLocaleString()} recorded returns · ${record.supportedBins}/8 envelope bins · unverified`;
  ui.querySelectorAll('small').forEach(el=>el.hidden=true);vision.hidden=false;adjustments.hidden=true;(ui.querySelector('.span-voltage') as HTMLElement).hidden=true;clear(clearance);clear(motion);
  const min=Math.min(...selected.map(p=>p[1])),max=Math.max(...selected.map(p=>p[1]));
  pts.userData.elevationRange=[min,max];
  legend.innerHTML='<div style="height:7px;background:linear-gradient(90deg,#254cc9,#24c7bf,#ead94c,#ed6a42)"></div><small>'+ (min+rayPoints.verticalOffsetMeters).toFixed(1)+'–'+(max+rayPoints.verticalOffsetMeters).toFixed(1)+' m NAVD88 · recorded elevation</small>';
  elevation();
  return;
 }
 // The demo has flat ground; preserve its datum rather than invent terrain relief.
 const corners=[a.clone().addScaledVector(axis,-60).addScaledVector(normal,-65),b.clone().addScaledVector(axis,60).addScaledVector(normal,-65),b.clone().addScaledVector(axis,60).addScaledVector(normal,65),a.clone().addScaledVector(axis,-60).addScaledVector(normal,65)];corners.forEach(p=>p.y=.04);
 const floor=new THREE.Mesh(new THREE.BufferGeometry().setFromPoints([corners[0],corners[1],corners[2],corners[0],corners[2],corners[3]]),new THREE.MeshBasicMaterial({color:heightColor(0),side:THREE.DoubleSide}));floor.layers.set(1);floor.userData.sensorIgnore=true;ground.add(floor);
 const inside=(p:THREE.Vector3)=>{const q=p.clone().sub(a),along=q.dot(axis);return along>=-60&&along<=length+60&&Math.abs(q.dot(normal))<=65&&p.y>=0&&p.y<=100;};
 scene.updateMatrixWorld(true);const meshes:THREE.Mesh[]=[];
 scene.traverse(o=>{const m=o as THREE.Mesh;if(!m.isMesh||m.userData.sensorIgnore||!m.geometry?.getAttribute('position'))return;let parent:THREE.Object3D|null=m;while(parent){if(parent===root||!parent.visible)return;parent=parent.parent;}const box=new THREE.Box3().setFromObject(m);if(inside(box.getCenter(new THREE.Vector3())))meshes.push(m);});
 surfaces=meshes;ghost(surfaces);
 for(const i of [index,index+1]){const t=network.towers[i],x=t.position[0],z=t.position[2],h=t.height;addOutline([new THREE.Vector3(x-8,0,z),new THREE.Vector3(x,h,z),new THREE.Vector3(x+8,0,z)],0xe8b45b);for(const at of t.attachments){const p=new THREE.Vector3(...at.position);addOutline([new THREE.Vector3(x,h,z),p],0xe8b45b);}}
 for(const span of network.spans.slice(index*3,index*3+3))addOutline(span.points.map(p=>new THREE.Vector3(...p)),0x65d9b0);
 // Canopy envelopes from the same visible synthetic crown surfaces.
 const seenTrees=new Set<string>();for(const mesh of meshes){const id=mesh.userData.treeId as string|undefined;if(!id||seenTrees.has(id))continue;seenTrees.add(id);const box=new THREE.Box3().setFromObject(mesh);const envelope=new THREE.Box3Helper(box,0x89b969);envelope.layers.set(1);envelope.userData.sensorIgnore=true;derived.add(envelope);}
 const limit=100000,positions:number[]=[],colors:number[]=[];let seed=index+17;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 const push=(p:THREE.Vector3)=>{positions.push(p.x,p.y+.08,p.z);const c=new THREE.Color().setHSL(.52-Math.min(1,p.y/60)*.35,.65,.45+Math.min(.2,p.y/150));colors.push(c.r,c.g,c.b);};
 for(let offset=0;offset<limit;offset+=2000){if(disposed||token!==generation)return;
 for(let n=offset;n<Math.min(limit,offset+2000);n++){
 if(n%4===0||!meshes.length){const p=a.clone().addScaledVector(axis,random()*(length+120)-60).addScaledVector(normal,(random()-.5)*130);p.y=.12;push(p);continue;}
 const mesh=meshes[Math.floor(random()*meshes.length)],g=mesh.geometry,attr=g.getAttribute('position'),idx=g.index,count=idx?idx.count:attr.count;if(count<3)continue;const tri=Math.floor(random()*Math.floor(count/3))*3;
 const p0=new THREE.Vector3().fromBufferAttribute(attr,idx?idx.getX(tri):tri),p1=new THREE.Vector3().fromBufferAttribute(attr,idx?idx.getX(tri+1):tri+1),p2=new THREE.Vector3().fromBufferAttribute(attr,idx?idx.getX(tri+2):tri+2);let u=random(),v=random();if(u+v>1){u=1-u;v=1-v;}const p=p0.add(p1.sub(p0.clone()).multiplyScalar(u)).add(p2.sub(new THREE.Vector3().fromBufferAttribute(attr,idx?idx.getX(tri):tri)).multiplyScalar(v)).applyMatrix4(mesh.matrixWorld);if(inside(p))push(p);
 }
 status.textContent='Loading '+Math.round(Math.min(limit,offset+2000)/limit*100)+'%';await new Promise<void>(resolve=>setTimeout(resolve,0));
 }
 status.textContent='Loading classified obstacles…';
 const extra=await obstacleCloud(a,b,limit*2,index+101,()=>disposed||token!==generation);
 if(!extra||disposed||token!==generation)return;
 for(const [key,coords] of Object.entries(extra)){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(coords,3));const pts=new THREE.Points(g,new THREE.PointsMaterial({size:1.3,sizeAttenuation:false,color:scanClasses[key as keyof typeof scanClasses],transparent:true,opacity:.85}));pts.layers.set(1);pts.userData.sensorIgnore=true;pts.userData.scanClass=key;pts.visible=true;cloud.add(pts);}
 if(disposed||token!==generation)return;const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));const points=new THREE.Points(geometry,new THREE.PointsMaterial({size:1.5,sizeAttenuation:false,vertexColors:true,transparent:true,opacity:.8}));points.layers.set(1);points.userData.sensorIgnore=true;cloud.add(points);status.textContent=(positions.length/3+limit*2).toLocaleString()+' points · Detailed · T'+(index+1)+'–T'+(index+2);elevation();
 }
 return {show,processTower(index:number){void processor?.process(index);},assetHost(parent?:HTMLElement){processor?.move(parent??ui);},updateCamera(camera:THREE.Camera){processor?.camera(camera);},hide(){processor?.hide();restore();surfaces=[];legend.hidden=true;generation++;current=-1;root.visible=false;ui.hidden=true;clear(cloud);clear(derived);clear(clearance);clear(motion);clear(ground);},dispose(){processor?.dispose();restore();legend.remove();disposed=true;generation++;clear(cloud);clear(derived);clear(clearance);clear(motion);clear(ground);scene.remove(root);ui.remove();}};
}
