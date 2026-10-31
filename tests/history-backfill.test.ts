import {test} from 'node:test';
import assert from 'node:assert/strict';
import {assetPassages} from '../src/fleet/history-backfill';
test('backfill locates passed assets and rejects remote assets',()=>{
 const p=assetPassages([[-83,40],[-83,40.01],[-83,40.02]],[[-83,40],[-83,40.01],[-83,40.02],[-80,40]]);
 assert.equal(p[0],0);assert.ok(p[1]>0&&p[2]>p[1]);assert.equal(p[3],Infinity);
 assert.deepEqual(p.map(x=>x<p[1]+.01),[true,true,false,false]);
});
