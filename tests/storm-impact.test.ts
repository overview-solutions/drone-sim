import {test} from 'node:test';
import assert from 'node:assert/strict';
import {impactedSegments} from '../src/fleet/storm-impact';
const ring=[[0,0],[2,0],[2,2],[0,2],[0,0]];
const line=(coords:number[][])=>({id:1,operator:'',voltage:138000,aep:false,coords});
test('tornado clips a crossing even when both line endpoints lie outside',()=>{
 const hits=impactedSegments([line([[-1,1],[3,1]])],[ring]);
 assert.equal(hits.length,1);
 assert.deepEqual(hits[0].start,[0,1]);
 assert.deepEqual(hits[0].end,[2,1]);
});
test('tornado retains interior segments and excludes distant segments',()=>{
 assert.equal(impactedSegments([line([[.5,1],[1.5,1]])],[ring]).length,1);
 assert.equal(impactedSegments([line([[-1,3],[3,3]])],[ring]).length,0);
});
