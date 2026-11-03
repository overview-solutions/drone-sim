import {test} from 'node:test';
import assert from 'node:assert/strict';
import {demoClearanceMeters} from '../src/fleet/clearance-envelope';
test('illustrative voltage envelopes are bounded and increase with voltage',()=>{
 assert.ok(demoClearanceMeters(345)>demoClearanceMeters(138));
 assert.equal(demoClearanceMeters(-1),demoClearanceMeters(0));
 assert.equal(demoClearanceMeters(1000),demoClearanceMeters(765));
 assert.ok(Number.isFinite(demoClearanceMeters(NaN)));
});

import {scenarioVoltages,nearestVoltageIndex} from '../src/fleet/clearance-envelope';
test('voltage slider selects discrete classes and preserves nominal ratings',()=>{
 assert.equal(scenarioVoltages[nearestVoltageIndex(138)],138);
 assert.equal(scenarioVoltages[nearestVoltageIndex(34)],34.5);
 assert.equal(scenarioVoltages[nearestVoltageIndex(800)],765);
 assert.equal(scenarioVoltages[nearestVoltageIndex(0)],23);
});
