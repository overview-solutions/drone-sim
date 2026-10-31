import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {sensorOverlay} from '../src/fleet/sensor-overlay';
test('sensor overlay hits displayed roofs, pauses accumulation, and clears on replay',()=>{
 const scene=new THREE.Scene(),aircraft=new THREE.Group();scene.add(aircraft);
 const roof=new THREE.Mesh(new THREE.BoxGeometry(200,20,200));roof.position.y=10;scene.add(roof);scene.updateMatrixWorld(true);
 roof.userData.treeId='test-tree';const returns:string[]=[];const overlay=sensorOverlay(scene,aircraft,id=>returns.push(id)),camera=new THREE.PerspectiveCamera(30,16/9);camera.position.set(0,85,0);camera.lookAt(0,0,0);
 const update=(active:boolean,time:number)=>overlay.update(camera,new THREE.Vector3(time*3,85,0),new THREE.Vector3(1,0,0),85,true,active,time,true,true);
 update(true,1);const group=scene.children.at(-1) as THREE.Group,cloud=group.children[2] as THREE.Points;
 assert.equal(cloud.geometry.drawRange.count,25);assert.ok(returns.includes('test-tree'));assert.ok(Math.abs(cloud.geometry.attributes.position.getY(12)-20.15)<.01);
 update(false,2);assert.equal(cloud.geometry.drawRange.count,25);
 assert.equal(group.children[0].layers.mask,2);assert.equal(group.children[0].visible,true);
 overlay.clear();assert.equal(cloud.geometry.drawRange.count,0);
});
import {lidarBudget} from '../src/fleet/sensor-overlay';
test('modeled acquisition budget supports 30 pts per square meter across demo speeds',()=>{
 for(const speed of [25,40,50])for(const height of [40,85,120]){const b=lidarBudget(height,speed*.44704);assert.ok(b.density>=30);assert.ok(b.requiredRate>0);}
 assert.equal(lidarBudget(85,0).density,0);
});
