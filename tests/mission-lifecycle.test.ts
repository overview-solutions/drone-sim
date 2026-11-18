import test from 'node:test';import assert from 'node:assert/strict';
import {missionAppearance} from '../src/gis/mission-lifecycle.js';
const now=Date.parse('2026-11-17T20:00:00Z'),day=86400000;
test('operations includes future plans, active flights and exactly seven days of completion',()=>{
 assert.equal(missionAppearance({status:'scheduled'},'operations',now).visible,true);
 assert.equal(missionAppearance({start:new Date(now-day).toISOString()},'operations',now).state,'active');
 assert.equal(missionAppearance({end:new Date(now-7*day).toISOString()},'operations',now).visible,true);
 assert.equal(missionAppearance({end:new Date(now-7*day-1).toISOString()},'operations',now).visible,false);
});
test('recorded completion fades with age and review keeps older history',()=>{
 const recent=missionAppearance({end:new Date(now).toISOString()},'operations',now),old=missionAppearance({end:new Date(now-6*day).toISOString()},'operations',now);
 assert.ok(recent.opacity>old.opacity);assert.equal(missionAppearance({end:new Date(now-30*day).toISOString()},'review',now).visible,true);
});
test('missing completion timestamps do not masquerade as recent operations',()=>{
 assert.equal(missionAppearance({status:'completed'},'operations',now).visible,false);
 assert.equal(missionAppearance({status:'completed'},'review',now).visible,true);
 assert.equal(missionAppearance({status:'draft'},'planning',now).visible,true);
 assert.equal(missionAppearance({},'operations',now).visible,false);
});
