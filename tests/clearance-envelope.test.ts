import {test} from 'node:test';
import assert from 'node:assert/strict';
import {demoClearanceMeters} from '../src/fleet/clearance-envelope';
test('illustrative voltage envelopes are bounded and increase with voltage',()=>{
 assert.ok(demoClearanceMeters(345)>demoClearanceMeters(138));
 assert.equal(demoClearanceMeters(-1),demoClearanceMeters(0));
 assert.equal(demoClearanceMeters(1000),demoClearanceMeters(765));
 assert.ok(Number.isFinite(demoClearanceMeters(NaN)));
});
