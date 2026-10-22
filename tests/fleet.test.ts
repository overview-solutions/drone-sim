import {test} from 'node:test';import assert from 'node:assert/strict';
import {budget,MI,distance,sortie,bestSortie,candidates,type Airport,type PowerLine} from '../src/fleet/model';
import {generateUN} from '../src/fleet/un';
import data from '../src/fleet/ohio-data.json';
const a:Airport={id:'A',name:'A',city:'',county:'',coord:[-82,40],rural:true,runways:[{id:'1',lengthFt:3000,surface:'ASPH'}],certificated:false};
const b:Airport={...a,id:'B',coord:[-81.5,40]};const line:PowerLine={id:1,aep:true,operator:'American Electric Power',voltage:138000,coords:[[-81.95,40],[-81.55,40]]};
test('45-mile radius shares one 90-mile total budget with alternate landing',()=>{assert.equal(budget(45,200),90*MI);assert.equal(budget(45,100),80);assert.ok(sortie(a,b,line,145).length<sortie(a,a,line,145).length);assert.ok(bestSortie([a],line,145,true)===undefined);});
test('FAA rural candidate screening and source snapshot are explicit',()=>{assert.equal(data.meta.faaCycle,'2026-10-01');assert.equal(data.airports.length,128);assert.equal(candidates(data.airports).length,89);assert.ok(candidates(data.airports).every(a=>a.rural&&a.runways.some(r=>r.lengthFt>=2500)));});
test('UN-like model has three attached junctions per structure and phase-preserving edges',()=>{
 const n=generateUN(line),p=n.pack;
 assert.equal(p.electricJunctions.features.length,n.towers.length*3);
 assert.equal(p.electricLines.features.length,(n.towers.length-1)*3);
 const ids=new Set([...p.structure.features,...p.electricJunctions.features,...p.electricLines.features].map(f=>f.id));
 for(const e of [...p.associations.attachment,...p.associations.connectivity]){assert.ok(ids.has(e.fromId));assert.ok(ids.has(e.toId));}
 for(const e of p.associations.attachment){assert.ok(p.structure.features.some(f=>f.id===e.fromId));assert.ok(p.electricJunctions.features.some(f=>f.id===e.toId));}
 for(const f of p.electricLines.features){const ps=f.geometry.coordinates as number[][];const from=p.electricJunctions.features.find(j=>j.id===f.properties.fromAttachment)!;const to=p.electricJunctions.features.find(j=>j.id===f.properties.toAttachment)!;assert.deepEqual(ps[0],from.geometry.coordinates);assert.deepEqual(ps.at(-1),to.geometry.coordinates);assert.equal(from.properties.phase,to.properties.phase);assert.ok(ps[10][2]<Math.max(ps[0][2],ps.at(-1)![2]));}
 assert.deepEqual(generateUN(line).pack,p);
});
test('great-circle distances are km and symmetric',()=>{assert.ok(Math.abs(distance([0,0],[1,0])-111.195)<.01);assert.equal(distance(a.coord,b.coord),distance(b.coord,a.coord));});

test('dense OSM alignment vertices do not create dense towers; long spans exceed 1000 ft',()=>{
 const line={id:999,operator:'Synthetic',aep:true,voltage:138000,coords:Array.from({length:101},(_,i)=>[-82+i*.0001,40])};
 const network=generateUN(line);
 assert.equal(network.towers.length,3);
 for(const span of network.spans){const a=span.points[0],b=span.points.at(-1)!;assert.ok(Math.hypot(b[0]-a[0],b[2]-a[2])>304.8);}
 assert.equal(network.pack.provenance.supportPlacement.nominalSpanMeters,450);
});
