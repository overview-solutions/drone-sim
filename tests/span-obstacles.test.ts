import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Vector3} from 'three';
import {obstacleCloud} from '../src/fleet/span-obstacles';
test('span obstacle clouds are reproducible, categorized and cancellable',async()=>{
 const a=new Vector3(),b=new Vector3(400,0,0);const p=await obstacleCloud(a,b,1000,3,()=>false);
 assert.ok(p);assert.equal(Object.values(p).reduce((n,v)=>n+v.length/3,0),1000);assert.ok(Object.values(p).every(v=>v.length>0&&v.every(Number.isFinite)));
 assert.deepEqual(p,await obstacleCloud(a,b,1000,3,()=>false));assert.equal(await obstacleCloud(a,b,1000,3,()=>true),null);
});
