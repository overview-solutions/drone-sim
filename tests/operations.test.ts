import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createFlight,advanceFlight,recallFlight,flightSnapshot} from '../src/fleet/operations';
import {sortie} from '../src/fleet/model';
const a={id:'A',name:'A',city:'A',county:'A',coord:[-82,40],rural:true,runways:[],certificated:false},b={...a,id:'B',coord:[-81.9,40.1]};
const route=sortie(a,b,{id:5,operator:'Demo',aep:true,voltage:138000,coords:[[-81.98,40.01],[-81.94,40.07]]},200);
test('return changes only selected aircraft and preserves its current position',()=>{const f=createFlight(route,0),other=createFlight(route,1);advanceFlight(f,300);const before=flightSnapshot(f).coord;assert.equal(recallFlight(f),true);const after=flightSnapshot(f);assert.ok(Math.hypot(before[0]-after.coord[0],before[1]-after.coord[1])<1e-9);assert.equal(after.to,'A');assert.equal(other.returning,false);assert.equal(recallFlight(f),false);advanceFlight(f,100000);assert.equal(f.done,true);assert.deepEqual(flightSnapshot(f).coord,a.coord);assert.equal(f.events.length,3);});
test('aircraft retain identity and landed position after completion',()=>{const f=createFlight(route,3);advanceFlight(f,100000);const s=flightSnapshot(f);assert.equal(s.id,'OH-04');assert.equal(s.stage,'Landed');assert.equal(s.progress,1);assert.equal(s.etaMinutes,0);assert.deepEqual(s.coord,b.coord);assert.equal(recallFlight(f),false);advanceFlight(f,1000);assert.equal(f.events.length,2);});
