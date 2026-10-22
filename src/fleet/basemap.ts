import * as THREE from 'three';
/** Raster tiles draped in the same local geographic frame as the synthetic scene. */
export function basemap(scene:THREE.Scene,host:HTMLElement,origin:number[]){
 const ui=document.createElement('div');ui.className='basemap-control';
 ui.innerHTML='<label>Basemap <select aria-label="Basemap"><option value="offline">Offline grid</option><option value="dark">Dark topo</option><option value="topo">Topographic</option><option value="imagery">Aerial imagery</option></select></label><small aria-live="polite">Offline · no tile requests</small>';host.append(ui);
 const select=ui.querySelector('select')!,status=ui.querySelector('small')!;
 const group=new THREE.Group();scene.add(group);
 let mode='offline',generation=0,signature='',disposed=false;
 const tiles=new Map<string,THREE.Mesh<THREE.PlaneGeometry,THREE.MeshBasicMaterial>>();
 const cos=Math.cos(origin[1]*Math.PI/180),lat=(y:number,n:number)=>Math.atan(Math.sinh(Math.PI*(1-2*y/n)))*180/Math.PI;
 function clear(){generation++;for(const mesh of tiles.values()){mesh.material.map?.dispose();mesh.material.dispose();mesh.geometry.dispose();}tiles.clear();group.clear();signature='';}
 select.onchange=()=>{mode=select.value;clear();status.textContent=mode==='offline'?'Offline · no tile requests':'Loading · USGS The National Map';};
 return {update(camera:THREE.Camera,target:THREE.Vector3){
 if(mode==='offline'||disposed)return;
 const distance=camera.position.distanceTo(target),z=Math.max(5,Math.min(16,Math.round(Math.log2(40075000*cos/Math.max(200,distance*.6))))),n=2**z;
 const lon=origin[0]+target.x/(111320*cos),latitude=Math.max(-80,Math.min(80,origin[1]-target.z/111320));
 const x=Math.floor((lon+180)/360*n),y=Math.floor((1-Math.asinh(Math.tan(latitude*Math.PI/180))/Math.PI)/2*n);
 const sig=`${mode}/${z}/${x}/${y}`;if(sig===signature)return;signature=sig;
 const needed=new Set<string>(),version=generation;let loaded=0,failed=0;
 for(let dx=-3;dx<=3;dx++)for(let dy=-3;dy<=3;dy++){
 const tx=x+dx,ty=y+dy;if(tx<0||tx>=n||ty<0||ty>=n)continue;
 const key=`${z}/${ty}/${tx}`;needed.add(key);if(tiles.has(key))continue;
 const west=(tx/n*360-180-origin[0])*111320*cos,east=((tx+1)/n*360-180-origin[0])*111320*cos;
 const north=-(lat(ty,n)-origin[1])*111320,south=-(lat(ty+1,n)-origin[1])*111320;
 const geometry=new THREE.PlaneGeometry(east-west,south-north);geometry.rotateX(-Math.PI/2);
 const material=new THREE.MeshBasicMaterial({color:0xffffff,depthTest:false,depthWrite:false});
 if(mode==='dark'){material.onBeforeCompile=shader=>{shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>','#include <map_fragment>\nfloat gray=dot(diffuseColor.rgb,vec3(.299,.587,.114)); diffuseColor.rgb=mix(vec3(.035,.075,.10),vec3(.26,.38,.43),1.0-gray);');};}
 const mesh=new THREE.Mesh(geometry,material);mesh.position.set((west+east)/2,-.1,(north+south)/2);mesh.renderOrder=-10;mesh.visible=false;tiles.set(key,mesh);group.add(mesh);
 const service=mode==='imagery'?'USGSImageryOnly':'USGSTopo';
 new THREE.TextureLoader().load(`https://basemap.nationalmap.gov/arcgis/rest/services/${service}/MapServer/tile/${key}`,texture=>{
 if(disposed||version!==generation||tiles.get(key)!==mesh){texture.dispose();return;}
 texture.colorSpace=THREE.SRGBColorSpace;material.map=texture;material.needsUpdate=true;mesh.visible=true;loaded++;status.textContent=failed?'Some tiles unavailable · USGS / USDA':'USGS The National Map'+(mode==='imagery'?' / USDA · historical imagery':' · topographic');
 },undefined,()=>{if(!disposed&&version===generation){failed++;status.textContent=loaded?'Some tiles unavailable · USGS':'Tiles unavailable · offline ground retained';}});
 }
 for(const [key,mesh] of tiles)if(!needed.has(key)){group.remove(mesh);mesh.material.map?.dispose();mesh.material.dispose();mesh.geometry.dispose();tiles.delete(key);}
 },dispose(){disposed=true;clear();scene.remove(group);ui.remove();}};
}
