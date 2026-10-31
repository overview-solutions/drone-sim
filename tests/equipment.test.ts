import {test} from 'node:test';
import assert from 'node:assert/strict';
import {defectFor,recordEquipmentCapture} from '../src/fleet/equipment';
test('equipment findings require the matching phase or overview capture',()=>{
 const findings=new Map<number,{seconds:number;status:string}>();
 assert.equal(recordEquipmentCapture(findings,0,-1,10),false);assert.equal(findings.size,0);
 assert.equal(recordEquipmentCapture(findings,0,0,12),true);assert.equal(findings.get(0)?.seconds,12);
 assert.equal(recordEquipmentCapture(findings,1,0,13),false);assert.equal(recordEquipmentCapture(findings,1,-1,14),true);
 assert.equal(defectFor(2).label,'Loose attachment hardware');assert.equal(defectFor(3).label,'Damaged crossarm');
});
test('repeated captures preserve reviewer status and earliest evidence time',()=>{
 const findings=new Map([[0,{seconds:12,status:'dismissed'}]]);
 recordEquipmentCapture(findings,0,0,15);assert.equal(findings.get(0)?.seconds,12);
 recordEquipmentCapture(findings,0,0,9);assert.equal(findings.get(0)?.seconds,9);assert.equal(findings.get(0)?.status,'dismissed');
 assert.equal(recordEquipmentCapture(findings,-1,0,10),false);assert.equal(recordEquipmentCapture(findings,0,0,NaN),false);
});
