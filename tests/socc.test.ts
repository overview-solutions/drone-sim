import {test} from 'node:test';
import assert from 'node:assert/strict';
import {soccPackages} from '../src/fleet/socc';
import {generateUN} from '../src/fleet/un';
import {downtownLine,curvedRoute} from '../src/fleet/flight-path';
test('SOCC exports share boundaries and full attachment topology without dangling references',()=>{
 const sectors=soccPackages(generateUN(downtownLine));assert.equal(sectors.length,3);
 for(let i=0;i<2;i++){const a=sectors[i],b=sectors[i+1];assert.equal(a.coreStructureIds.at(-1),b.coreStructureIds[0]);assert.ok(a.structureIds.filter(id=>b.structureIds.includes(id)).length>=3);}
 for(const s of sectors){const ids=new Set([...s.network.structure.features,...s.network.electricJunctions.features,...s.network.electricLines.features].map(f=>f.id));for(const a of [...s.network.associations.attachment,...s.network.associations.connectivity]){assert.ok(ids.has(a.fromId));assert.ok(ids.has(a.toId));}assert.ok(s.reviewRequirements.every(r=>r.phaseAttachmentIds.length===3&&r.status==='unreviewed'));}
});
test('right-angle route crosses junction again aligned with outgoing span after long-way turn',()=>{
 const corner=[-82.98,40],r=curvedRoute([[-83,40],corner,[-82.98,39.98]]);
 const visits=r.points.map((p,i)=>Math.hypot(p[0]-corner[0],p[1]-corner[1])<1e-8?i:-1).filter(i=>i>=0);assert.equal(visits.length,2);
 const end=visits[1];assert.ok(r.points[end-1][1]>40);assert.ok(r.points[end+1][1]<40);assert.ok(Math.abs(r.points[end-1][0]-corner[0])<1e-8);
});
test('synthetic splices split the same-phase conductor and survive overlapping exports',()=>{
 const n=generateUN(downtownLine),p=n.pack;assert.ok(n.splices.length>0);
 for(const s of n.splices){const j=p.electricJunctions.features.find(j=>j.id===s.id)!;assert.equal(j.properties.assetClass,'conductor_splice');const edges=p.electricLines.features.filter(e=>e.properties.fromAttachment===s.id||e.properties.toAttachment===s.id);assert.equal(edges.length,2);assert.ok(edges.every(e=>e.properties.phase===s.phase));assert.deepEqual(edges[0].geometry.coordinates.at(-1),j.geometry.coordinates);assert.deepEqual(edges[1].geometry.coordinates[0],j.geometry.coordinates);}
 for(const sector of soccPackages(n)){const ids=new Set(sector.network.electricJunctions.features.map(f=>f.id));assert.ok(sector.spliceReviewRequirements.every(r=>ids.has(r.componentId)&&r.status==='unreviewed'));}
});

import {boundaryFeature} from '../src/fleet/socc';
test('SOCC boundary annotations share identity and distinguish geometry from seeded equipment',()=>{
 const n=generateUN(downtownLine),s=soccPackages(n);
 assert.equal(s[0].boundaryFeatures[0].kind,'CB');assert.equal(s.at(-1)!.boundaryFeatures[1].kind,'XMFR');
 assert.deepEqual(s[0].boundaryFeatures[1],s[1].boundaryFeatures[0]);
 const angle=n.towers.map((_,i)=>boundaryFeature(n,i)).find(f=>f.kind==='ANGLE');assert.ok(angle);assert.ok(angle.turnDegrees>=15);
 assert.ok(s.every(g=>g.boundaryFeatures.every(f=>f.simulationOnly&&g.coreStructureIds.includes(f.structureId))));
});
