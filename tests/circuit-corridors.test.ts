import test from 'node:test';import assert from 'node:assert/strict';
import {corridorRing,segmentDistance} from '../src/fleet/circuit-corridors';
test('click corridor has round endcaps and an 80 metre total width',()=>{
 const ring=corridorRing([0,0],[100,0]);assert.deepEqual(ring[0],ring.at(-1));
 assert.ok(Math.abs(Math.min(...ring.map(p=>p[0]))+40)<1e-8);assert.ok(Math.abs(Math.max(...ring.map(p=>p[0]))-140)<1e-8);
 assert.ok(Math.abs(Math.min(...ring.map(p=>p[1]))+40)<1e-8);assert.ok(Math.abs(Math.max(...ring.map(p=>p[1]))-40)<1e-8);
});
test('distance resolves overlapping candidates by closest centerline including endpoints',()=>{
 assert.equal(segmentDistance([50,10],[0,0],[100,0]),10);assert.equal(segmentDistance([110,0],[0,0],[100,0]),10);
 assert.ok(segmentDistance([50,8],[0,0],[100,0])<segmentDistance([50,8],[0,30],[100,30]));
});
test('degenerate segments do not create a false selectable asset',()=>{
 assert.deepEqual(corridorRing([1,1],[1,1]),[]);assert.throws(()=>corridorRing([0,0],[1,1],0));
});
