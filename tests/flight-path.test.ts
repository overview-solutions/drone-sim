import {test} from 'node:test';
import assert from 'node:assert/strict';
import {curvedRoute,curvedSortie,downtownBase,downtownLine,TURN_RADIUS_M} from '../src/fleet/flight-path';
import {sortie} from '../src/fleet/model';
import {createFlight,flightSnapshot} from '../src/fleet/operations';
test('downtown has eight long inspection passes and more inspection than transit',()=>{
 const s=curvedSortie(sortie(downtownBase,downtownBase,downtownLine,144.8));
 const inspection=s.inspectionEndKm!-s.inspectionStartKm!;
 assert.ok(s.inspectionKm>25);assert.ok(inspection/s.length>.7);assert.ok(s.length<144.8);
 console.log(`Downtown: ${s.inspectionKm.toFixed(1)} km infrastructure, ${inspection.toFixed(1)} km inspection flight, ${(s.length-inspection).toFixed(1)} km transit`);
});
test('curved connections maintain at least approximately 700 ft radius including joins',()=>{
 const r=curvedRoute([[-83,40],[-82.98,40],[-82.98,40.02],[-83,40.02]]);
 const p=r.points.map(p=>[p[0]*111195*Math.cos(40*Math.PI/180),p[1]*111195]);
 for(let i=1;i<p.length-1;i++){
  const [a,b,c]=[p[i-1],p[i],p[i+1]],ab=Math.hypot(b[0]-a[0],b[1]-a[1]),bc=Math.hypot(c[0]-b[0],c[1]-b[1]),ac=Math.hypot(c[0]-a[0],c[1]-a[1]);
  const area2=Math.abs((b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]));
  if(area2>1e-5)assert.ok(ab*bc*ac/(2*area2)>TURN_RADIUS_M-1);
 }
});
test('turn state is exposed for capture gating, with gentle bank',()=>{
 const f=createFlight(sortie(downtownBase,downtownBase,downtownLine,144.8),7);
 let turns=0,straight=0;
 for(f.traveled=f.sortie.inspectionStartKm!;f.traveled<f.sortie.inspectionEndKm!;f.traveled+=.02){const v=flightSnapshot(f);if(v.turning)turns++;else straight++;assert.ok(Math.abs(v.bank)<.2);}
 assert.ok(turns>20);assert.ok(straight>100);
});
test('extra turn distance cannot silently exceed the range budget',()=>{
 const base=sortie(downtownBase,downtownBase,downtownLine,144.8);
 const curved=curvedSortie({...base,maxKm:base.length+.01});
 assert.ok(curved.length>base.length+.01);assert.equal(curved.feasible,false);
});

test('long demo missions can inspect both directions without exceeding budget',()=>{
 const f=createFlight(sortie(downtownBase,downtownBase,downtownLine,200),0,true);
 assert.ok(f.sortie.secondPassKm);assert.ok(f.length<=200);
 f.traveled=f.sortie.secondPassKm!-.01;assert.equal(flightSnapshot(f).inspectionPass,1);
 f.traveled=f.sortie.secondPassKm!+.01;assert.equal(flightSnapshot(f).inspectionPass,2);
 assert.ok(f.sortie.inspectionEndKm!>f.sortie.secondPassKm!);
});
