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
