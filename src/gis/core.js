/** Flightline GIS spec v1. WGS84 input; local east/up/south metres, explicit vertical reference. */
export const GIS_SPEC = Object.freeze({version:'flightline-gis/1.0',metersPerDegree:111320,
  coordinateOrder:'longitude,latitude',axes:'east,up,south',tileSize:256,maxTileZoom:19,
  tileRadius:3,transitionMs:850,colors:{dock:'#7adaca',fixedWing:'#ffad56'},
  camera:{fov:55,minDistance:5,maxDistance:8000000,maxPolarAngle:Math.PI*.495,zoomSpeed:1.7,pixelRatioCap:2}});
export function localFrame(origin){
  const scale=GIS_SPEC.metersPerDegree,cos=Math.cos(origin[1]*Math.PI/180);
  if(!Number.isFinite(cos)||Math.abs(cos)<.001)throw new Error('Local GIS frame requires a non-polar origin.');
  return {
    project(point,height=0){return [(((point[0]-origin[0]+540)%360)-180)*scale*cos,height,(origin[1]-point[1])*scale];},
    geographic(point){return [((origin[0]+point[0]/(scale*cos)+540)%360)-180,origin[1]-point[2]/scale,point[1]];}
  };
}
export function configureControls(controls){
  Object.assign(controls,{enableDamping:true,minDistance:GIS_SPEC.camera.minDistance,maxDistance:GIS_SPEC.camera.maxDistance,
    maxPolarAngle:GIS_SPEC.camera.maxPolarAngle,zoomSpeed:GIS_SPEC.camera.zoomSpeed,screenSpacePanning:false});
}
export function cameraOptics(wideHFov=60,zoom=1,aspect=16/9){
  const halfWidth=Math.tan(wideHFov*Math.PI/360)/Math.max(1,zoom);
  return {halfWidth,halfHeight:halfWidth/aspect,hfov:2*Math.atan(halfWidth)*180/Math.PI,vfov:2*Math.atan(halfWidth/aspect)*180/Math.PI};
}
/** Geographic frustum corners; z is in the same declared local vertical reference as origin[2]. */
export function frustumCorners(origin,heading,pitch,depth,hfov=60,zoom=1,aspect=3/2){
  const {halfWidth,halfHeight}=cameraOptics(hfov,zoom,aspect),frame=localFrame(origin);
  return [[-1,-1],[1,-1],[1,1],[-1,1]].map(([x,y])=>{
    const east=Math.sin(heading)*Math.cos(pitch)+x*halfWidth*Math.cos(heading)-y*halfHeight*Math.sin(pitch)*Math.sin(heading);
    const north=Math.cos(heading)*Math.cos(pitch)-x*halfWidth*Math.sin(heading)-y*halfHeight*Math.sin(pitch)*Math.cos(heading);
    return frame.geographic([east*depth,origin[2]+(Math.sin(pitch)+y*halfHeight*Math.cos(pitch))*depth,-north*depth]);
  });
}
export const easeCamera=t=>{const v=Math.max(0,Math.min(1,t));return v*v*(3-2*v);};
export const mercatorY=lat=>(1-Math.asinh(Math.tan(Math.max(-85.05112878,Math.min(85.05112878,lat))*Math.PI/180))/Math.PI)/2;
export const latitude=y=>Math.atan(Math.sinh(Math.PI*(1-2*y)))*180/Math.PI;
export const tileUrl=(mode,z,x,y)=>`https://basemap.nationalmap.gov/arcgis/rest/services/${mode==='imagery'?'USGSImageryOnly':'USGSTopo'}/MapServer/tile/${z}/${y}/${x}?blankTile=false`;
/** Geodesic WGS84-style spherical display buffer; radius is metres, not nautical miles. */
export function geodesicCircle(center,radiusM,segments=128){
 const rad=Math.PI/180,latitude=center[1]*rad,longitude=center[0]*rad,angle=radiusM/6371008.8;
 return Array.from({length:segments+1},(_,i)=>{const bearing=i/segments*Math.PI*2;
  const lat=Math.asin(Math.sin(latitude)*Math.cos(angle)+Math.cos(latitude)*Math.sin(angle)*Math.cos(bearing));
  const lon=longitude+Math.atan2(Math.sin(bearing)*Math.sin(angle)*Math.cos(latitude),Math.cos(angle)-Math.sin(latitude)*Math.sin(lat));
  return [((lon/rad+540)%360)-180,lat/rad];});
}
