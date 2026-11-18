import * as THREE from 'three';
import {createRasterLayer} from '../gis/raster-layer.js';
/** Flightline GIS v1 shared raster engine, with mode-specific UI only. */
export function basemap(scene:THREE.Scene,host:HTMLElement,origin:number[]){
 const ui=document.createElement('div');ui.className='basemap-control';
 ui.innerHTML='<label>Basemap <select aria-label="Basemap"><option value="offline">Offline grid</option><option value="dark">Dark topo</option><option value="topo">Topographic</option><option value="imagery" selected>Aerial imagery</option></select></label><small aria-live="polite">Loading imagery…</small>';host.append(ui);
 const layer=createRasterLayer(THREE,scene,origin,{anisotropy:4,status:text=>ui.querySelector('small')!.textContent=text});
 ui.querySelector('select')!.onchange=event=>layer.setMode((event.target as HTMLSelectElement).value);
 const receive=(event:MessageEvent)=>{if(event.origin!==location.origin||event.source!==window.parent||event.data?.type!=='flightline:layers'||typeof event.data.layers?.satellite!=='boolean')return;const mode=event.data.layers.satellite?'imagery':'offline';ui.querySelector('select')!.value=mode;layer.setMode(mode);};
 window.addEventListener('message',receive);
 return {update:layer.update,dispose(){window.removeEventListener('message',receive);layer.dispose();ui.remove();}};
}
