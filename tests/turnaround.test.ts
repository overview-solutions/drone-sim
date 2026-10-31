import {test} from 'node:test';
import assert from 'node:assert/strict';
import {cycle,concept,taxiLayout,CRUISE_KM_S} from '../src/fleet/turnaround';
import {createFlight,advanceFlight,flightSnapshot,previewMission,missionCycle} from '../src/fleet/operations';
import {sortie,distance} from '../src/fleet/model';
import {downtownBase,downtownLine} from '../src/fleet/flight-path';
test('airport sequence secures aircraft before solar charging and uploading',()=>{
 const flight=3600,inspection=2400;
 assert.equal(cycle(flight,inspection,flight+120).stage,'Taxi to stand');
 assert.equal(cycle(flight,inspection,flight+250).stage,'Securing anchors');
 assert.equal(cycle(flight,inspection,flight+250).uploadedGB,0);
 const service=cycle(flight,inspection,flight+400);assert.ok(service.secured);assert.ok(service.uploadedGB>0);
 const end=cycle(flight,inspection,service.total);assert.equal(end.ready,true);assert.ok(end.battery>=94.99);assert.equal(end.uploadedGB,end.dataGB);
 assert.equal(service.uploadSeconds,80*8000/concept.uploadMbps);
});
test('aircraft lands then moves on taxi path, with stable heading while secured',()=>{
 const f=createFlight(sortie(downtownBase,downtownBase,downtownLine,144.8),7);
 advanceFlight(f,f.length/CRUISE_KM_S);assert.equal(f.done,true);
 const landed=flightSnapshot(f).coord;advanceFlight(f,120);const mid=flightSnapshot(f);
 assert.equal(mid.stage,'Taxi to stand');assert.ok(distance(landed,mid.coord)>.01);assert.equal(mid.altitude,1.5);
 advanceFlight(f,240);const parked=flightSnapshot(f);assert.deepEqual(parked.coord,taxiLayout(f.route).park);assert.ok(distance(parked.coord,parked.headingCoord)>0);assert.ok(parked.timeline.secured);
});
test('timeline preview never overwrites live flight, and live service advances to ready',()=>{
 const f=createFlight(sortie(downtownBase,downtownBase,downtownLine,144.8),7);advanceFlight(f,300);const saved=f.traveled;
 previewMission(f,missionCycle(f).flightSeconds+120);assert.equal(flightSnapshot(f).stage,'Taxi to stand');assert.equal(f.traveled,saved);
 advanceFlight(f,2);assert.equal(f.traveled,saved);assert.equal(flightSnapshot(f).conceptPreview,true);
 previewMission(f,null);assert.equal(f.traveled,saved);assert.equal(flightSnapshot(f).conceptPreview,false);
 advanceFlight(f,100000);assert.equal(flightSnapshot(f).ready,true);
});
test('unrealistic long flights expose energy shortfall instead of claiming feasibility',()=>{assert.equal(cycle(20000,10000,20000).energyShortfall,true);assert.equal(cycle(20000,10000,20000).battery,0);});
