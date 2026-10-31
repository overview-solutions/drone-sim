import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spanRating,limitingRating} from '../src/fleet/line-rating';
import {recordEquipmentCapture} from '../src/fleet/equipment';
test('DLR voltage scales apparent power, not conductor ampacity',()=>{
 const a=spanRating(0,0,69),b=spanRating(0,0,138);
 assert.equal(a.amps,b.amps);assert.equal(b.mva!,a.mva!*2);assert.equal(spanRating(0,0,0).mva,null);
 assert.ok(Number.isFinite(a.amps)&&a.amps>0);
});
test('SOCC thermal rating is its weakest modeled span and varies with weather',()=>{
 const indices=[0,1,2,3,4];const r=limitingRating(indices,100,138);
 assert.equal(r.amps,Math.min(...indices.map(i=>spanRating(i,100,138).amps)));
 assert.notEqual(spanRating(0,0,138).amps,spanRating(0,1000,138).amps);
});
test('healthy demonstration structures do not generate equipment defects',()=>{
 const findings=new Map<number,{seconds:number;status:string}>();
 for(let i=8;i<20;i++)for(const phase of [-1,0,1,2])assert.equal(recordEquipmentCapture(findings,i,phase,10),false);
 assert.equal(findings.size,0);
});

import {voltageReview} from '../src/fleet/line-rating';
test('voltage envelope aggregates weakest component and unknown voltage stays unknown',()=>{
 assert.equal(voltageReview([0],0),null);
 const section=voltageReview([0,1,2],138)!;
 assert.equal(section.highest,Math.min(...[0,1,2].map(i=>voltageReview([i],138)!.highest)));
 assert.ok(section.limits.some(c=>c.kv<section.next));
});
