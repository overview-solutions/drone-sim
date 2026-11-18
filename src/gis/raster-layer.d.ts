import * as THREE from 'three';
export function createRasterLayer(engine:typeof THREE,scene:THREE.Scene,origin:number[],options?:{invalidate?:()=>void;anisotropy?:number;status?:(text:string)=>void}):{setMode(mode:string):void;update(camera:THREE.Camera,target:THREE.Vector3):void;dispose():void};
