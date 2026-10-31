import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildingPolygons,rings} from '../src/fleet/osm-buildings';
const p=(lon:number,lat:number)=>({lon,lat});
const outer=[p(0,0),p(10,0),p(10,10),p(0,10),p(0,0)],hole=[p(2,2),p(3,2),p(3,3),p(2,3),p(2,2)];
test('stitches reversed member ways and preserves courtyard, suppressing duplicate member',()=>{const result=buildingPolygons([{type:'way',id:1,tags:{building:'yes'},geometry:outer},{type:'relation',id:9,tags:{building:'yes'},members:[{type:'way',ref:1,role:'outer',geometry:outer.slice(0,3)},{type:'way',ref:2,role:'outer',geometry:[...outer.slice(2)].reverse()},{type:'way',ref:3,role:'inner',geometry:hole}]}]);assert.equal(result.length,1);assert.deepEqual(result[0].outer,outer);assert.deepEqual(result[0].holes,[hole]);});
test('open or invalid geometry never produces invented closed buildings',()=>{assert.deepEqual(rings([outer.slice(0,3)]),[]);assert.deepEqual(rings([[p(NaN,0),p(0,0)]]),[]);assert.equal(buildingPolygons([{type:'way',id:1,tags:{building:'yes'},geometry:outer}]).length,1);});

test('bundled Columbus snapshot contains renderable real building footprints',async()=>{const {readFile}=await import('node:fs/promises');const data=JSON.parse(await readFile(new URL('../src/fleet/urban-buildings.json',import.meta.url),'utf8'));const buildings=buildingPolygons(data.elements);assert.equal(buildings.length,38);assert.ok(buildings.every(b=>b.outer.every(p=>p.lon> -83.02&&p.lon< -82.98&&p.lat>39.95&&p.lat<39.98)));});
