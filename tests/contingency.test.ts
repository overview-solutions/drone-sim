import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Vector3 as V} from 'three';
import {validateEscape,planEscape} from '../src/fleet/contingency';
const wires=[[new V(-3000,40,0),new V(3000,40,0)]];
test('escape checks conductor, lateral, terrain and predicted traffic independently',()=>{
 assert.equal(validateEscape([new V(0,85,50)],wires),'');
 assert.match(validateEscape([new V(0,45,1)],wires),/conductor/);
 assert.match(validateEscape([new V(0,85,300)],wires),/lateral/);
 assert.match(validateEscape([new V(0,10,50)],wires),/terrain/);
 assert.match(validateEscape([new V(0,85,50)],wires,{position:new V(0,85,50),velocity:new V()}),/traffic/);
});
test('planner finds a continuous forward refuge with modest descent',()=>{
 const start=new V(0,85,50);
 const result=planEscape(start,0,[{point:new V(1000,70,50),heading:0,label:'refuge'}],wires);
 assert.ok(result.best);assert.ok(result.best.points[0].distanceTo(start)<.01);
 assert.ok(result.best.points.at(-1)!.distanceTo(new V(1000,70,50))<.01);
 assert.equal(validateEscape(result.best.points,wires),'');
});
test('planner refuses an unmodeled corridor instead of returning a straight unsafe fallback',()=>{
 assert.equal(planEscape(new V(0,85,50),0,[{point:new V(1000,70,50),heading:0,label:'refuge'}],[]).best,undefined);
});
test('return reversal can use a tighter labeled radius while retaining conductor and corridor checks',()=>{
 const start=new V(0,85,0),targets=[{point:new V(-800,85,0),heading:Math.PI,label:'return'}];
 const strict=planEscape(start,0,targets,wires);
 assert.equal(strict.best,undefined);
 const relaxed=planEscape(start,0,targets,wires,undefined,100);
 assert.ok(relaxed.best);
 assert.equal(validateEscape(relaxed.best.points,wires),'');
 assert.ok(relaxed.best.points[0].distanceTo(start)<.01);
});

import {createFlight,applyContingency,advanceFlight,flightSnapshot} from '../src/fleet/operations';
import {sortie} from '../src/fleet/model';
test('accepted return connection actually replaces the mission and advances toward launch',()=>{
 const base={id:'TEST',name:'Test',city:'',county:'',coord:[-83,40],rural:true,runways:[],certificated:false};
 const power={id:1,operator:'Demo',aep:false,voltage:138000,coords:[[-82.99,40],[-82.95,40]]};
 const flight=createFlight(sortie(base,base,power,100),0);flight.traveled=2;
 const here=flightSnapshot(flight).coord,scale=111320*Math.cos(40*Math.PI/180);
 const project=(p:number[],y=85)=>new V((p[0]+83)*scale,y,-(p[1]-40)*111320);
 const start=project(here),wire=[[new V(-3000,40,0),new V(10000,40,0)]];
 const result=planEscape(start,0,[{point:start.clone().add(new V(-800,0,0)),heading:Math.PI,label:'return'}],wire,undefined,100);
 assert.ok(result.best);
 const points=[...result.best.points,project(base.coord,1.5)];
 assert.ok(applyContingency(flight,points.map(p=>[-83+p.x/scale,40-p.z/111320]),points.map(p=>p.y),true,'Returning',result.best.length/1000));
 assert.equal(flight.returning,true);assert.deepEqual(flight.route.at(-1),base.coord);
 const before=flightSnapshot(flight).coord;advanceFlight(flight,10);assert.notDeepEqual(flightSnapshot(flight).coord,before);
});
