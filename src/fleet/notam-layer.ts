import * as THREE from 'three';
import {localFrame} from '../gis/core.js';
type Geometry={type:string;coordinates?:any;geometries?:Geometry[]};
/** Display supplied FAA geometry without inventing terrain/vertical restriction volumes. */
export function notamLayer(scene:THREE.Scene,host:HTMLElement,origin:number[],fit:(points:THREE.Vector3[])=>void){
 const group=new THREE.Group();scene.add(group);const frame=localFrame(origin);let visible=true;
 const credit=document.createElement('small');credit.className='faa-notam-credit';credit.hidden=true;credit.style.cssText='font-size:11px;color:#efcf8c;padding:5px 10px';host.append(credit);
 const project=(p:number[])=>new THREE.Vector3(...frame.project(p,8));
 const clear=()=>{group.traverse(o=>{const object=o as THREE.Mesh;object.geometry?.dispose();if(object.material&&!Array.isArray(object.material))object.material.dispose();});group.clear();};
 function draw(geometry:Geometry,selected:boolean,points:THREE.Vector3[]){
  if(!geometry)return;
  const color=selected?0xff6f91:0xffcd73,material=()=>new THREE.LineBasicMaterial({color,transparent:true,opacity:selected?1:.75,depthTest:false,depthWrite:false});
  const line=(coords:number[][])=>{const vertices=coords.filter(p=>p?.slice(0,2).every(Number.isFinite)).map(project);if(!vertices.length)return;points.push(...vertices);const object=new THREE.Line(new THREE.BufferGeometry().setFromPoints(vertices),material());object.renderOrder=selected?12:10;group.add(object);};
  if(geometry.type==='GeometryCollection'){geometry.geometries?.forEach(g=>draw(g,selected,points));return;}
  if(geometry.type==='Point'){const point=project(geometry.coordinates);points.push(point);const object=new THREE.Points(new THREE.BufferGeometry().setFromPoints([point]),new THREE.PointsMaterial({color,size:selected?13:8,sizeAttenuation:false,depthTest:false}));object.renderOrder=12;group.add(object);return;}
  if(geometry.type==='MultiPoint'){geometry.coordinates.forEach((p:number[])=>draw({type:'Point',coordinates:p},selected,points));return;}
  if(geometry.type==='LineString'){line(geometry.coordinates);return;}
  if(geometry.type==='MultiLineString'){geometry.coordinates.forEach(line);return;}
  const polygons=geometry.type==='Polygon'?[geometry.coordinates]:geometry.type==='MultiPolygon'?geometry.coordinates:[];
  for(const polygon of polygons){const shape=new THREE.Shape();polygon.forEach((ring:number[][],index:number)=>{line(ring);const coords=ring.map(project).map(p=>new THREE.Vector2(p.x,-p.z));if(!index)shape.setFromPoints(coords);else shape.holes.push(new THREE.Path(coords));});const geo=new THREE.ShapeGeometry(shape);geo.rotateX(-Math.PI/2);const object=new THREE.Mesh(geo,new THREE.MeshBasicMaterial({color,transparent:true,opacity:selected?.14:.06,depthTest:false,depthWrite:false,side:THREE.DoubleSide}));object.position.y=8;object.renderOrder=selected?11:9;group.add(object);}
 }
 const receive=(event:MessageEvent)=>{if(event.origin!==location.origin||event.source!==window.parent)return;
  if(event.data?.type==='flightline:layers'){visible=event.data.layers.notams;group.visible=visible;credit.hidden=!visible||!group.children.length;}
  if(event.data?.type==='flightline:notams'){
   clear();const selected=JSON.stringify(event.data.selectedGeometry);let selectedPoints:THREE.Vector3[]=[];
   for(const geometry of event.data.geometries??[]){const highlighted=JSON.stringify(geometry)===selected;const points:THREE.Vector3[]=[];draw(geometry,highlighted,points);if(highlighted)selectedPoints=points;}
   credit.textContent=`FAA NMS staging · ${event.data.geometries?.length??0} mapped notice geometries · amber / pink selected`;credit.hidden=!visible||!group.children.length;if(selectedPoints.length)fit(selectedPoints);
  }
  if(event.data?.type==='flightline:soc-fit')fit(event.data.points.map(project));
 };
 window.addEventListener('message',receive);
 return {dispose(){window.removeEventListener('message',receive);clear();scene.remove(group);credit.remove();}};
}
