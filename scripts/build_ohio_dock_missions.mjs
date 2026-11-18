/** Generate local drafts only, using the established Skydio action builder and reference template. */
import {readFile,writeFile,mkdir} from 'node:fs/promises';
const root=new URL('../',import.meta.url),skydio=new URL('../Workbench/projects/skydio-dark/',root);
const inventory=JSON.parse(await readFile(new URL('public/gis/dock-assets.json',root),'utf8'));
const dock=inventory.docks.find(d=>d.name==='OH-001-X10Dock-xa63');if(!dock)throw Error('Ohio dock inventory missing');
const core=new URL('src/gis/core.js',root).href;
const source=(await readFile(new URL('public/structure-planner.js',skydio),'utf8')).replace("'/gis/core.js'",JSON.stringify(core));
const {buildStructurePlan}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const reference=JSON.parse(await readFile(new URL('data/FostoriaCtr_AvoidancePoints.json',skydio),'utf8'));
const output=new URL('public/gis/ohio-missions/',root);await mkdir(output,{recursive:true});
const manifest={schema:'flightline-ohio-mission-drafts/1.0',dock:dock.name,generated:new Date().toISOString(),status:'LOCAL DRAFTS — not uploaded or scheduled',limitations:['OSM ways are candidate line segments, not confirmed circuit identities; overlapping candidates may describe the same circuit.','Structure heights, conductor elevations, terrain and actual obstacle clearance are unknown.','WORLD_TAKEOFF 65 m and 40 m stand-off are configurable planning assumptions.','OSM-only targets are corridor samples, not claimed pole locations.','Automatic return and lost-link behavior are inherited from the supplied reference; validate with Skydio before use.'],missions:[]};
const combined=[];
for(const circuit of dock.circuits){
 const cos=Math.cos(dock.coordinates[1]*Math.PI/180),meter=111320;
 const xy=p=>[(p[0]-dock.coordinates[0])*meter*cos,(p[1]-dock.coordinates[1])*meter];
 const gps=p=>[dock.coordinates[0]+p[0]/(meter*cos),dock.coordinates[1]+p[1]/meter];
 let targets=circuit.supports.map(s=>({id:s.id,coord:s.coord,properties:s.properties??{},kind:'supplied_structure'}));
 if(!targets.length){let count=0;targets=[];
  for(const segment of circuit.segments){const a=xy(segment[0]),b=xy(segment[1]),length=Math.hypot(b[0]-a[0],b[1]-a[1]),steps=Math.max(1,Math.ceil(length/250));
   for(let i=0;i<=steps;i++){const p=[a[0]+(b[0]-a[0])*i/steps,a[1]+(b[1]-a[1])*i/steps];if(Math.hypot(...p)>3*1609.344-100)continue;const coord=gps(p);if(targets.some(t=>Math.hypot(...xy(t.coord).map((v,k)=>v-p[k]))<15))continue;targets.push({id:String(++count),coord,properties:{},kind:'corridor_sample'});}
  }
 }
 if(targets.length<2){manifest.missions.push({circuitId:circuit.id,name:circuit.name,status:'insufficient interior targets; manual planning required'});continue;}
 const layer={type:'FeatureCollection',features:targets.map((t,i)=>({type:'Feature',properties:{...t.properties,layer:'structure',STRUCTURE_NUMBER:t.id,target_kind:t.kind},geometry:{type:'Point',coordinates:t.coord}}))};
 const counts=Object.fromEntries(targets.map(t=>[t.id,t.kind==='supplied_structure'?4:2]));
 const model=buildStructurePlan(layer,reference,{standOff:40,altitude:65,speed:3,pitch:-20,topDown:false,side:'right',outAndBack:true,frontView:false},counts);
 model.mission.displayName='DRAFT_OH001_'+circuit.id.replaceAll('/','_');model.mission.autoStart=false;
 delete model.mission.estimateReferenceNavTNavTakeoff;
 model.mission.expectedGpsOrigin={...reference.expectedGpsOrigin,lon:dock.coordinates[0],lat:dock.coordinates[1]};
 const name=circuit.id.replaceAll('/','_'),filename=name+'.json',preview=name+'.geojson';
 const features=model.features.map(f=>({...f,properties:{...f.properties,circuitId:circuit.id,missionName:model.mission.displayName,geometry_status:'Draft planning geometry; collision clearance unverified',height_reference:['photo','draft_route'].includes(f.properties.layer)?'WORLD_TAKEOFF':'source XY; height unknown'}}));
 const photos=features.filter(f=>f.properties.layer==='photo');
 if(photos.some(f=>Math.hypot(...xy(f.geometry.coordinates))>3*1609.344+1))throw Error('Capture waypoint outside dock buffer: '+circuit.id);
 await writeFile(new URL(filename,output),JSON.stringify(model.mission,null,2));await writeFile(new URL(preview,output),JSON.stringify({type:'FeatureCollection',features}));
 manifest.missions.push({circuitId:circuit.id,name:circuit.name,status:'draft',file:filename,preview,photos:photos.length,targets:targets.length,targetKind:targets[0].kind,summary:model.summary});combined.push(...features);
}
await writeFile(new URL('manifest.json',output),JSON.stringify(manifest,null,2));await writeFile(new URL('all-mission-previews.geojson',output),JSON.stringify({type:'FeatureCollection',features:combined}));
await writeFile(new URL('README.txt',output),manifest.status+'\n\n'+manifest.limitations.join('\n')+'\n\nOne payload per loaded circuit candidate. Coordinates are longitude/latitude in previews; Skydio action GPS xy uses x=latitude,y=longitude following the supplied reference.\n');
console.log(`${manifest.missions.filter(m=>m.file).length} local mission drafts created for ${dock.circuits.length} candidates; ${combined.filter(f=>f.properties.layer==='photo').length} captures`);
