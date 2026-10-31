import {test} from 'node:test';
import assert from 'node:assert/strict';
import {optics,approachZoom} from '../src/fleet/camera-model';
test('optical zoom caps at 40x and sampling decreases with range',()=>{assert.deepEqual(optics(100,80),optics(100,40));assert.ok(Math.abs(optics(200,10).pixels*2-optics(100,10).pixels)<1e-9);assert.equal(optics(100,1).hfov,59.99999999999999);});
test('zoom requires full modeled travel time and does not snap between frames',()=>{assert.ok(approachZoom(1,40,.1)<2);assert.ok(Math.abs(approachZoom(1,40,8)-40)<1e-9);assert.ok(Math.abs(approachZoom(40,1,8)-1)<1e-9);});

test('known-coordinate targeting starts before entering capture range',async()=>{
 const {canPreposition}=await import('../src/fleet/camera-model');
 assert.equal(canPreposition(1100,1200,'known'),true);
 assert.equal(canPreposition(1100,1200,'wide'),false);
 assert.equal(canPreposition(-10,200,'known'),false);
 assert.equal(canPreposition(100,200,'wide'),true);
});
