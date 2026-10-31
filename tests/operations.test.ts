import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createFlight,startOnInspection,seekFlight,advanceFlight,recallFlight,flightSnapshot} from '../src/fleet/operations';
import {taxiLayout} from '../src/fleet/turnaround';
import {sortie} from '../src/fleet/model';
const a={id:'A',name:'A',city:'A',county:'A',coord:[-82,40],rural:true,runways:[],certificated:false},b={...a,id:'B',coord:[-81.9,40.1]};
const route=sortie(a,b,{id:5,operator:'Demo',aep:true,voltage:138000,coords:[[-81.98,40.01],[-81.94,40.07]]},200);
test('return changes only selected aircraft and preserves its current position',()=>{const f=createFlight(route,0),other=createFlight(route,1);advanceFlight(f,300);const before=flightSnapshot(f).coord;assert.equal(recallFlight(f),true);const after=flightSnapshot(f);assert.ok(Math.hypot(before[0]-after.coord[0],before[1]-after.coord[1])<1e-9);assert.equal(after.to,'A');assert.equal(other.returning,false);assert.equal(recallFlight(f),false);advanceFlight(f,100000);assert.equal(f.done,true);assert.deepEqual(flightSnapshot(f).coord,taxiLayout(f.route).park);assert.equal(f.events.length,3);});
test('aircraft retain identity and landed position after completion',()=>{const f=createFlight(route,3);advanceFlight(f,100000);const s=flightSnapshot(f);assert.equal(s.id,'OH-04');assert.equal(s.stage,'Ready for next mission');assert.equal(s.progress,1);assert.equal(s.etaMinutes,0);assert.deepEqual(s.coord,taxiLayout(f.route).park);assert.equal(recallFlight(f),false);advanceFlight(f,1000);assert.equal(f.events.length,2);});

test('history replay begins at launch without rewinding live mission, then rejoins saved position',()=>{const f=createFlight(route,0);advanceFlight(f,300);const saved=f.traveled;seekFlight(f,0);let v=flightSnapshot(f);assert.deepEqual(v.coord,a.coord);assert.equal(v.stage,'Launch');assert.equal(v.altitude,1.5);assert.equal(recallFlight(f),false);advanceFlight(f,10);assert.equal(f.traveled,saved);assert.ok(flightSnapshot(f).distanceKm>0);seekFlight(f,null);assert.equal(flightSnapshot(f).distanceKm,saved);seekFlight(f,0);advanceFlight(f,10000);assert.equal(f.replay,null);assert.equal(f.traveled,saved);});
test('return history includes outbound travel before return leg',()=>{const f=createFlight(route,0);advanceFlight(f,300);recallFlight(f);advanceFlight(f,100);seekFlight(f,0);assert.deepEqual(flightSnapshot(f).coord,a.coord);assert.equal(flightSnapshot(f).returning,false);seekFlight(f,1);assert.equal(flightSnapshot(f).returning,true);});

test('auto-loaded mission begins on its power-line leg, not airport transit',()=>{const f=createFlight(route,3);startOnInspection(f,.4);assert.equal(flightSnapshot(f).stage,'Inspecting');assert.ok(f.traveled>0);assert.ok(f.traveled<f.length);});

test('contingency route preserves position and changes only its selected flight',async()=>{
 const {applyContingency}=await import('../src/fleet/operations');
 const f=createFlight(route,0),other=createFlight(route,1);startOnInspection(f,.3);
 const here=flightSnapshot(f).coord;
 const points=[here,[here[0]+.003,here[1]],[here[0]+.01,here[1]]];
 assert.equal(applyContingency(f,points,[85,70,70],false,'Avoiding / rejoining',.2),true);
 assert.deepEqual(flightSnapshot(f).coord,here);assert.equal(flightSnapshot(f).altitude,85);
 advanceFlight(f,5);assert.ok(flightSnapshot(f).altitude<85);
 assert.equal(other.contingency,undefined);
 assert.equal(applyContingency(other,points,[85,70,70],false,'Avoiding'),false);
});
test('capture feedback slows actual motion gradually and expires',()=>{
 const f=createFlight(route,0);startOnInspection(f,.4);f.captureLimit=30;f.captureTTL=20;
 const before=f.traveled;advanceFlight(f,1);
 assert.equal(f.speedMph,39);assert.ok(f.traveled-before<40*1.609344/3600);
 advanceFlight(f,10);assert.ok(f.speedMph!>=30&&f.speedMph!<40);
 advanceFlight(f,20);assert.equal(f.captureTTL,0);
});
