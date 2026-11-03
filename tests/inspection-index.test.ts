import {test} from 'node:test';import assert from 'node:assert/strict';
import {inspectionIndex,extraCapturePriority} from '../src/fleet/inspection-index';
import {canSupplementalShot} from '../src/fleet/camera-model';
test('extras never substitute for required capture',()=>{assert.equal(inspectionIndex(false,100),20);assert.equal(inspectionIndex(true,2),100);});
test('extra targeting favors issues and gaps while rejecting rearward or rushed retargets',()=>{const c={requiredCaptured:true,extras:0,flagged:false,forward:800,angle:5,range:900,slack:40};assert.ok(extraCapturePriority({...c,flagged:true})>extraCapturePriority(c));assert.ok(extraCapturePriority({...c,requiredCaptured:false})>extraCapturePriority(c));assert.equal(extraCapturePriority({...c,angle:180}),-Infinity);assert.equal(extraCapturePriority({...c,slack:5}),-Infinity);});
test('distant in-focus frames leave room for required shots',()=>{const c={locked:true,inspecting:true,range:1000,forwardMeters:900,speedMps:20,secondsSinceShot:10,secondsSinceExtra:15};assert.ok(canSupplementalShot(c));assert.equal(canSupplementalShot({...c,range:700}),false);assert.equal(canSupplementalShot({...c,locked:false}),false);});
