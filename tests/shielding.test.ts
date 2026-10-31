import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Vector3} from 'three';
import {nearestShieldAsset, type ShieldAsset} from '../src/fleet/shielding';
const line:ShieldAsset={id:'line',kind:'Transmission',heightKnown:true,points:[new Vector3(0,20,0),new Vector3(100,40,0)]};
test('shielding separates lateral distance and interpolated asset height',()=>{
 const result=nearestShieldAsset(new Vector3(50,80,10),[line])!;
 assert.equal(result.lateral,10);assert.equal(result.vertical,50);
});
test('nearest asset supplies both distances; unknown height remains unknown',()=>{
 const distribution={...line,id:'distribution',heightKnown:false,points:[new Vector3(50,0,8)]};
 const result=nearestShieldAsset(new Vector3(50,80,10),[line,distribution])!;
 assert.equal(result.asset.id,'distribution');assert.equal(result.lateral,2);assert.equal(result.vertical,null);
});
test('station footprint contains aircraft laterally without inventing vertical clearance',()=>{
 const station:ShieldAsset={id:'station',kind:'Substation',heightKnown:false,area:true,points:[new Vector3(0,0,0),new Vector3(100,0,0),new Vector3(100,0,100),new Vector3(0,0,100),new Vector3(0,0,0)]};
 const result=nearestShieldAsset(new Vector3(50,80,50),[station])!;
 assert.equal(result.lateral,0);assert.equal(result.vertical,null);
 assert.equal(nearestShieldAsset(new Vector3(),[]),undefined);
});
