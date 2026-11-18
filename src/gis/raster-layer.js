import {GIS_SPEC,localFrame,latitude,mercatorY} from './core.js';
import {availableTile} from './imagery.js';
/** Shared bounded, camera-centred raster pass. Dependency injection keeps one Three.js runtime per app. */
export function createRasterLayer(THREE,scene,origin,{invalidate=()=>{},anisotropy=1,status=()=>{}}={}){
  const group=new THREE.Group();scene.add(group);
  const frame=localFrame(origin),tiles=new Map();let mode='imagery',signature='',disposed=false;
  function remove(key,tile){tiles.delete(key);group.remove(tile.mesh);tile.mesh.geometry.dispose();tile.mesh.material.map?.dispose();tile.mesh.material.dispose();}
  function clear(){for(const [key,tile] of tiles)remove(key,tile);signature='';}
  function refresh(tile){
    if(disposed||tiles.get(tile.key)!==tile)return;
    const image=availableTile(tile.z,tile.x,tile.y,()=>refresh(tile),mode);
    if(!image)return;
    if(tile.image?.image===image.image&&tile.image.pixels===image.pixels)return;
    tile.image=image;
    const texture=new THREE.Texture(image.image);texture.colorSpace=THREE.SRGBColorSpace;
    texture.anisotropy=anisotropy;texture.repeat.set(image.pixels/image.image.naturalWidth,image.pixels/image.image.naturalWidth);
    texture.offset.set(image.x/image.image.naturalWidth,1-(image.y+image.pixels)/image.image.naturalHeight);texture.needsUpdate=true;
    tile.mesh.material.map?.dispose();tile.mesh.material.map=texture;tile.mesh.material.needsUpdate=true;tile.mesh.visible=true;
    status('USGS The National Map / USDA · historical imagery; lower-resolution fallback when needed');invalidate();
  }
  return {
    setMode(value){if(value===mode)return;mode=value;clear();status(mode==='offline'?'Offline · no imagery requests':'Loading · USGS The National Map');invalidate();},
    update(camera,target){
      if(mode==='offline'||disposed)return;
      const distance=camera.position.distanceTo(target),[lon,lat]=frame.geographic(target.toArray());
      const cos=Math.cos(origin[1]*Math.PI/180);
      const z=Math.max(0,Math.min(GIS_SPEC.maxTileZoom,Math.round(Math.log2(40075000*cos/Math.max(30,distance*.6))))),n=2**z;
      const x=Math.floor((lon+180)/360*n),y=Math.floor(mercatorY(lat)*n),sig=`${mode}/${z}/${x}/${y}`;
      if(sig===signature)return;signature=sig;
      const needed=new Set();status('Loading · USGS The National Map');
      for(let dx=-GIS_SPEC.tileRadius;dx<=GIS_SPEC.tileRadius;dx++)for(let dy=-GIS_SPEC.tileRadius;dy<=GIS_SPEC.tileRadius;dy++){
        const col=x+dx,row=y+dy;if(row<0||row>=n)continue;
        const key=`${z}/${row}/${col}`;needed.add(key);if(tiles.has(key))continue;
        const west=frame.project([col/n*360-180,latitude(row/n)]),east=frame.project([(col+1)/n*360-180,latitude((row+1)/n)]);
        // Use an unwrapped width so tiles at the dateline cannot span the world.
        const width=360/n*GIS_SPEC.metersPerDegree*cos,height=east[2]-west[2];
        const geometry=new THREE.PlaneGeometry(width,height);geometry.rotateX(-Math.PI/2);
        const material=new THREE.MeshBasicMaterial({color:mode==='dark'?0x6e8995:0xffffff,depthTest:false,depthWrite:false});
        // Flightline's original post-color-space dark tint, applied only to historical imagery.
        if(mode==='imagery')material.onBeforeCompile=shader=>{
          shader.fragmentShader=shader.fragmentShader.replace('#include <colorspace_fragment>', '#include <colorspace_fragment>\ngl_FragColor.rgb=mix(gl_FragColor.rgb,vec3(.018,.035,.05),.55);');
        };
        const mesh=new THREE.Mesh(geometry,material);mesh.position.set(west[0]+width/2,-.1,(west[2]+east[2])/2);mesh.renderOrder=-10;mesh.visible=false;group.add(mesh);
        const tile={key,z,x:((col%n)+n)%n,y:row,mesh};tiles.set(key,tile);refresh(tile);
      }
      for(const [key,tile] of tiles)if(!needed.has(key))remove(key,tile);
    },
    dispose(){disposed=true;clear();scene.remove(group);}
  };
}
