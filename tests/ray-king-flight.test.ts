import {test} from 'node:test';
import assert from 'node:assert/strict';
import data from '../src/fleet/ray-king-data.json';
import {rayKingFlight} from '../src/fleet/ray-king-flight';
import {advanceFlight,flightSnapshot,recallFlight} from '../src/fleet/operations';
import {distance} from '../src/fleet/model';
test('Ray–King loops continuously without landing or teleporting between endpoints',()=>{
 const f=rayKingFlight(data.line,8);
 assert.equal(f.id,'OH-09');assert.ok(f.loop);assert.ok(distance(f.route[0],f.route.at(-1)!)<.001);
 assert.ok(f.length>10);assert.ok(f.route.some(p=>distance(p,data.line.coords.at(-1)!)<.01));
 f.traveled=f.length-.001;advanceFlight(f,1);
 assert.equal(f.laps,1);assert.equal(f.done,false);assert.ok(f.traveled<.1);
 const v=flightSnapshot(f);assert.equal(v.altitude,85);assert.equal(v.stage,'Inspecting');
 f.traveled=1;assert.ok(recallFlight(f));advanceFlight(f,1000);assert.ok(f.done);
});
