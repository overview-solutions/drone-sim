import {test} from 'node:test';
import assert from 'node:assert/strict';
import data from '../src/fleet/ray-king-data.json';
import derived from '../src/fleet/ray-king-spans.json';
import {generateUN} from '../src/fleet/un';
test('Ray–King modeled phases connect distinct crossarm attachments with sag',()=>{
 const n=generateUN(data.line);assert.equal(n.towers.length,14);assert.equal(n.pack.electricLines.features.length,39);assert.equal(n.pack.electricJunctions.features.length,42);
 assert.deepEqual(n.locations,derived.supports.map(s=>s.position));assert.equal(n.splices.length,0);
 const structureIds=new Set(n.pack.structure.features.map(f=>f.id));const ids=new Set(n.pack.electricJunctions.features.map(f=>f.id));
 for(const a of n.pack.associations.attachment){assert.ok(structureIds.has(a.fromId));assert.ok(ids.has(a.toId));}
 for(const f of n.pack.electricLines.features){assert.ok(ids.has(String(f.properties.fromAttachment)));assert.ok(ids.has(String(f.properties.toAttachment)));assert.equal(f.properties.estimated,true);}
 for(const t of n.towers){const [a,b,c]=t.attachments;assert.ok(Math.hypot(a.position[0]-c.position[0],a.position[2]-c.position[2])>=12);const dx=c.position[0]-a.position[0],dz=c.position[2]-a.position[2];assert.ok(Math.abs(dx*Math.cos(t.heading)+dz*Math.sin(t.heading))<1e-6);assert.ok(b.position[1]>t.position[1]);}
 n.spans.forEach((s,i)=>{const tower=Math.floor(i/3),phase=i%3;assert.deepEqual(s.points[0],n.towers[tower].attachments[phase].position);assert.deepEqual(s.points.at(-1),n.towers[tower+1].attachments[phase].position);assert.ok(s.points[10][1]<(s.points[0][1]+s.points[20][1])/2);});
});
