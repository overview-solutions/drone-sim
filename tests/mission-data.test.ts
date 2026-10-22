import {test} from 'node:test';
import assert from 'node:assert/strict';
import {inspectionMission} from '../src/fleet/mission-data';
test('inspection mission links each NAV point to 3D attachments and preserves coordinate order',()=>{
 const data=inspectionMission({id:123,operator:'Demo',aep:true,voltage:138000,coords:[[-82,40],[-81.995,40.003]]});
 assert.equal(data.document.items.length,data.network.towers.length);
 const rows=data.wpl.trim().split('\n');assert.equal(rows[0],'QGC WPL 110');
 data.document.items.forEach((item,i)=>{const fields=rows[i+1].split('\t');assert.equal(fields.length,12);assert.equal(item.frame,6);assert.equal(Number(fields[2]),3);assert.equal(Number(fields[8]),item.x/1e7);assert.equal(Number(fields[9]),item.y/1e7);assert.equal(Number(fields[10]),85);assert.equal(data.document.inspectionTargets[i].structureId,data.network.towers[i].id);assert.equal(data.document.inspectionTargets[i].phaseAttachmentIds.length,3);});
 assert.ok(data.document.items[0].x>0);assert.ok(data.document.items[0].y<0);
});
