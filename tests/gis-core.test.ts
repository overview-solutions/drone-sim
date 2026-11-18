import test from 'node:test';
import assert from 'node:assert/strict';
import {GIS_SPEC,localFrame,mercatorY,latitude,cameraOptics,frustumCorners,easeCamera,tileUrl} from '../src/gis/core.js';
const near=(a:number,b:number,tolerance=1e-8)=>assert.ok(Math.abs(a-b)<tolerance,`${a} != ${b}`);
test('WGS84 coordinate roundtrip preserves explicit height in east/up/south frame',()=>{
 const frame=localFrame([-83.46,41.14]);const local=frame.project([-83.459,41.141],65);
 assert.ok(local[0]>0&&local[2]<0);assert.equal(local[1],65);
 const p=frame.geographic(local);near(p[0],-83.459);near(p[1],41.141);assert.equal(p[2],65);
});
test('dateline uses nearest longitude and rejects a polar tangent frame',()=>{
 const frame=localFrame([179.9,30]);assert.ok(Math.abs(frame.project([-179.9,30])[0])<25000);
 near(frame.geographic(frame.project([-179.9,30]))[0],-179.9);
 assert.throws(()=>localFrame([0,90]));
});
test('Mercator inverse and polar tile clamp',()=>{
 for(const lat of [-80,0,41.14,80])near(latitude(mercatorY(lat)),lat);
 assert.ok(mercatorY(90)>=-1e-10&&mercatorY(-90)<=1+1e-10);
});
test('camera zoom narrows both FOV dimensions with the declared frame aspect',()=>{
 const wide=cameraOptics(60,1,3/2),zoom=cameraOptics(60,3,3/2);
 near(wide.halfWidth/zoom.halfWidth,3);near(wide.halfWidth/wide.halfHeight,1.5);
 assert.ok(zoom.vfov<wide.vfov);
});
test('nadir frustum projects directly below the camera without inventing a height datum',()=>{
 const origin=[-83,41,65],corners=frustumCorners(origin,0,-Math.PI/2,40,60,1);
 corners.forEach(p=>near(p[2],25));
 near(corners.reduce((s,p)=>s+p[0],0)/4,origin[0]);near(corners.reduce((s,p)=>s+p[1],0)/4,origin[1]);
});
test('shared tiles and camera easing use one contract',()=>{
 assert.equal(GIS_SPEC.version,'flightline-gis/1.0');assert.equal(easeCamera(-1),0);assert.equal(easeCamera(2),1);near(easeCamera(.5),.5);
 assert.match(tileUrl('imagery',12,4,7),/USGSImageryOnly\/MapServer\/tile\/12\/7\/4/);
 assert.match(tileUrl('topo',12,4,7),/USGSTopo/);
});

test('dock buffer is a closed 3-statute-mile ring at multiple latitudes',async()=>{
 const {geodesicCircle}=await import('../src/gis/core.js');
 for(const latitude of [26,38,42]){const ring=geodesicCircle([-85,latitude],3*1609.344);assert.equal(ring.length,129);near(ring[0][0],ring.at(-1)![0]);near(ring[0][1],ring.at(-1)![1]);
  const angular=Math.abs(ring[0][1]-latitude)*Math.PI/180;near(angular*6371008.8,4828.032,.001);
 }
});
