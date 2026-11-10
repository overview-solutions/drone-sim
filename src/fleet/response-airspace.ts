import * as THREE from 'three';

/** Illustrative incident assignments in the simulator's flat-ground datum. */
export function responseAirspace(scene:THREE.Scene,anchor:HTMLElement,focus:(points:THREE.Vector3[])=>void) {
 const panel=document.createElement('section');
 panel.className='storm-weather';panel.hidden=true;anchor.after(panel);
 panel.innerHTML='<strong>SIMULATED response TFR</strong><small>5 km radius · surface–3,000 ft AGL · illustrative assignments</small><button data-action="fit">Focus airspace</button><button data-action="priority">Request helicopter transit</button><button data-action="close">Close</button><div class="response-tiers"></div><span role="status"></span><small>Scenario aircraft only · actual entry requires applicable FAA authorization and incident coordination</small>';
 const tierList=panel.querySelector('.response-tiers')!;
 const status=panel.querySelector('[role=status]')!;
 const group=new THREE.Group();scene.add(group);
 const tiers=[
  {name:'Inspection UAS',low:100,high:300,x:-2200,color:0x65d9b0},
  {name:'Rescue / suppression helicopter',low:500,high:900,x:0,color:0xe8b45b},
  {name:'Fixed-wing mapping / coordination',low:1800,high:2500,x:2200,color:0xbca4e8}
 ];
 let center=new THREE.Vector3(),timer:number|undefined,elapsed=0,transit=0;
 const markers:THREE.Mesh[]=[];
 const cards:HTMLElement[]=[];
 function clear(){
  clearInterval(timer);
  group.traverse(o=>{const mesh=o as THREE.Mesh;if(mesh.geometry)mesh.geometry.dispose();if(mesh.material)(mesh.material as THREE.Material).dispose();});
  group.clear();markers.length=0;cards.length=0;tierList.replaceChildren();
 }
 function outline(points:THREE.Vector3[],color:number){
  group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(points),new THREE.LineBasicMaterial({color,transparent:true,opacity:.7})));
 }
 function fit(){focus([center.clone().add(new THREE.Vector3(-5500,0,-5500)),center.clone().add(new THREE.Vector3(5500,1000,5500))]);}
 function close(){clear();panel.hidden=true;}
 (panel.querySelector('[data-action=fit]') as HTMLButtonElement).onclick=fit;
 const priority=panel.querySelector('[data-action=priority]') as HTMLButtonElement;
 priority.onclick=()=>{transit=10;priority.disabled=true;};
 (panel.querySelector('[data-action=close]') as HTMLButtonElement).onclick=close;
 return {
  open(points:THREE.Vector3[]){
   close();panel.hidden=false;elapsed=0;transit=0;priority.disabled=false;
   center=new THREE.Box3().setFromPoints(points).getCenter(new THREE.Vector3()).setY(0);
   for(const height of [0,914.4])outline(Array.from({length:97},(_,i)=>center.clone().add(new THREE.Vector3(Math.cos(i/96*Math.PI*2)*5000,height,Math.sin(i/96*Math.PI*2)*5000))),0xff6977);
   for(let i=0;i<8;i++){const x=Math.cos(i/8*Math.PI*2)*5000,z=Math.sin(i/8*Math.PI*2)*5000;outline([center.clone().add(new THREE.Vector3(x,0,z)),center.clone().add(new THREE.Vector3(x,914.4,z))],0xff6977);}
   for(const tier of tiers){
    const box=new THREE.EdgesGeometry(new THREE.BoxGeometry(1500,(tier.high-tier.low)*.3048,3000));
    const volume=new THREE.LineSegments(box,new THREE.LineBasicMaterial({color:tier.color,transparent:true,opacity:.55}));
    volume.position.copy(center).add(new THREE.Vector3(tier.x,(tier.high+tier.low)*.1524,0));group.add(volume);
    const marker=new THREE.Mesh(new THREE.ConeGeometry(70,180,4),new THREE.MeshBasicMaterial({color:tier.color,depthTest:false}));
    group.add(marker);markers.push(marker);
    const card=document.createElement('span');card.style.borderLeft='3px solid #'+tier.color.toString(16);tierList.append(card);cards.push(card);
   }
   // Shared transit corridor reserved through all demonstration tiers.
   const corridor=new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(650,914.4,8000)),new THREE.LineDashedMaterial({color:0xffffff,dashSize:150,gapSize:100,transparent:true,opacity:.35}));
   corridor.position.copy(center).add(new THREE.Vector3(0,457.2,0));corridor.computeLineDistances();group.add(corridor);
   function tick(){
    const active=transit>0;
    if(!active)elapsed+=.1;
    for(let i=0;i<tiers.length;i++){
     const tier=tiers[i],angle=elapsed*.15+i;
     markers[i].position.copy(center).add(new THREE.Vector3(tier.x+Math.cos(angle)*500,(tier.low+tier.high)*.1524,Math.sin(angle)*1100));
     markers[i].rotation.z=-angle;
     cards[i].textContent=tier.name+' · '+tier.low+'–'+tier.high+' ft · '+(active?'reserved / yielding':'assigned sector');
    }
    if(active){
     // Freeze other demonstration tracks while a priority transition owns the shared volume.
     markers[1].position.copy(center).add(new THREE.Vector3(0,213.36,-4000+8000*(1-transit/10)));
     cards[1].textContent='Helicopter · 700 ft · priority transit';
     status.textContent='Transit reserved · other scenario tracks held · '+Math.ceil(transit)+'s remaining';
     transit=Math.max(0,transit-.1);
    }else {status.textContent='Assigned lateral sectors + altitude bands · shared transit clear';priority.disabled=false;}
   }
   tick();timer=window.setInterval(tick,100);fit();
  },close,dispose(){close();panel.remove();group.removeFromParent();}
 };
}
