import {test} from 'node:test';
import assert from 'node:assert/strict';
import {exposureLines} from '../src/fleet/capture-footprints';
import {currentSpanIndex,extraCapturePriority} from '../src/fleet/inspection-index';
test('exposure frustum preserves optical pose and target at capture time',()=>{
 const lines=exposureLines({tower:0,phase:0,seconds:10,position:[0,0,0],quaternion:[0,0,0,1],vfov:90,aspect:2,target:[0,0,-10],extra:false});
 assert.equal(lines.length,18);assert.ok(Math.abs(lines[1].x+20)<1e-8);assert.ok(Math.abs(lines[1].y+10)<1e-8);assert.equal(lines[1].z,-10);assert.deepEqual(lines.at(-1)!.toArray(),[0,0,-10]);
});
test('current span is geometric rather than dependent on forward mission order',()=>{
 const towers=[[0,0,0],[100,0,0],[100,0,300]];
 assert.equal(currentSpanIndex(towers,[60,85,10]),0);assert.equal(currentSpanIndex(towers,[110,85,200]),1);
});
test('well-captured assets remain eligible for spare-time photographs',()=>{
 assert.ok(Number.isFinite(extraCapturePriority({requiredCaptured:true,extras:12,flagged:false,forward:100,angle:2,range:200,slack:40})));
});
