import {test} from 'node:test';
import assert from 'node:assert/strict';
import {reviewHealth,eventStructures} from '../src/fleet/review-navigation';
test('review does not confuse missing evidence with a good section',()=>{
 assert.equal(reviewHealth([],false),'yellow');
 assert.equal(reviewHealth([],true),'green');
 assert.equal(reviewHealth([{id:'TREE-2-0',seconds:1,risk:'growing',zone:false}],true),'yellow');
 assert.equal(reviewHealth([{id:'EQUIP-2',seconds:1,risk:'high',zone:false}],true),'red');
 assert.equal(reviewHealth([{id:'TREE-2-0',seconds:1,risk:'low',zone:true}],true),'red');
});
test('span findings include both adjoining structures and splices',()=>{
 assert.deepEqual(eventStructures({id:'EQUIP-12',seconds:1,risk:'high',zone:false},10),[2,3]);
 assert.deepEqual(eventStructures({id:'TREE-3-0',seconds:1,risk:'high',zone:false},10),[2,3]);
 assert.deepEqual(eventStructures({id:'EQUIP-3',seconds:1,risk:'high',zone:false},10),[3]);
});
