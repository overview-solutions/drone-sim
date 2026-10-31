import {test} from 'node:test';
import assert from 'node:assert/strict';
import {captureSpeed,catchupSpeed} from '../src/fleet/capture-speed';
test('spacing and shot workload set bounded capture pace',()=>{
 assert.ok(captureSpeed(450).mph<captureSpeed(900).mph);
 assert.ok(captureSpeed(450,5).mph<=captureSpeed(450,4).mph);
 assert.equal(captureSpeed(100).mph,30);
 assert.equal(captureSpeed(100).requiresAnotherPass,true);
 assert.equal(captureSpeed(1200).mph,40);
});
test('catch-up never accelerates past the plan or drops below scenario floor',()=>{
 assert.equal(catchupSpeed(35,50,30),30);
 assert.equal(catchupSpeed(35,1500,10),35);
});
