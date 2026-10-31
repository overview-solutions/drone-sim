import {test} from 'node:test';
import assert from 'node:assert/strict';
import {taskFor} from '../src/fleet/followup-tasks';
test('findings produce different inspection and vegetation work drafts',()=>{
 const e=taskFor({id:'EQUIP-4',seconds:0,risk:'high',zone:false});assert.equal(e.kind,'Multirotor');assert.equal(e.priority,'High');assert.match(e.gate,/pilot/);
 const v=taskFor({id:'TREE-4-1',seconds:0,risk:'growing',zone:false});assert.equal(v.kind,'Vegetation');assert.match(v.action,/arborist/);assert.equal(v.id,'TREE-4-1');
});
