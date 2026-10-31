/** Illustrative EO sampling and actuator assumptions, not a calibrated payload model. */
export const cameraProfile={width:1280,height:720,wideHFov:60,maxOpticalZoom:40,slewDegPerSecond:15,accelDegPerSecond2:30,zoomFullTravelSeconds:8,retargetSeconds:4,focusSeconds:1.5,targetSizeM:.5,minTargetPixels:24};
export function optics(rangeM:number,zoom:number){const z=Math.max(1,Math.min(cameraProfile.maxOpticalZoom,zoom));const hfov=2*Math.atan(Math.tan(Math.PI/6)/z);const widthM=2*Math.max(.1,rangeM)*Math.tan(hfov/2);return {hfov:hfov*180/Math.PI,vfov:2*Math.atan(Math.tan(hfov/2)*9/16)*180/Math.PI,pixels:cameraProfile.targetSizeM/widthM*cameraProfile.width,cmPerPixel:widthM/cameraProfile.width*100};}
export function approachZoom(current:number,target:number,seconds:number){const limit=Math.log(40)/cameraProfile.zoomFullTravelSeconds*seconds;return Math.exp(Math.log(current)+Math.max(-limit,Math.min(limit,Math.log(Math.max(1,Math.min(40,target))/current))));}

/** Known coordinates permit advance pointing; the capture gate remains separate. */
export function canPreposition(forwardM:number,rangeM:number,mode:string){
 return forwardM>20&&Number.isFinite(rangeM)&&(mode==='known'||rangeM<650);
}
