import rayFrames from './ray-king-structures.json';
import raySpans from './ray-king-spans.json';
import {type PowerLine} from './model';
export type V3=[number,number,number]; // east, height, south in meters
export type UNFeature={type:'Feature';id:string;geometry:{type:'Point'|'LineString';coordinates:number[]|number[][]};properties:Record<string,unknown>};
export type Structure={id:string;position:V3;height:number;heading:number;attachments:{id:string;phase:string;position:V3}[]};
export function generateUN(line:PowerLine){
 const origin=line.coords[0],cos=Math.cos(origin[1]*Math.PI/180);
 const local=(p:number[]):V3=>[(p[0]-origin[0])*111320*cos,0,-(p[1]-origin[1])*111320];
 const geographic=(p:V3)=>[origin[0]+p[0]/(111320*cos),origin[1]-p[2]/111320,p[1]+(line.id===179559746?raySpans.verticalOffsetMeters:0)];
 // OSM vertices describe alignment, not surveyed support locations.
 // Simplify small alignment deviations, retaining substantial angle structures.
 function simplify(points:V3[]):V3[]{
  if(points.length<3)return points;
  const a=points[0],b=points.at(-1)!,dx=b[0]-a[0],dz=b[2]-a[2],length2=dx*dx+dz*dz;
  let far=0,index=0;
  for(let i=1;i<points.length-1;i++){const p=points[i],t=length2?Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[2]-a[2])*dz)/length2)):0;const d=Math.hypot(p[0]-a[0]-t*dx,p[2]-a[2]-t*dz);if(d>far){far=d;index=i;}}
  return far>25?[...simplify(points.slice(0,index+1)).slice(0,-1),...simplify(points.slice(index))]:[a,b];
 }
 const alignment=simplify(line.coords.map(local)),locations:V3[]=[alignment[0]];
 for(let i=1;i<alignment.length;i++){
  const a=alignment[i-1],b=alignment[i],length=Math.hypot(b[0]-a[0],b[2]-a[2]);
  // Nominal 450 m (~1,476 ft); equal division avoids tiny residual end spans.
  const count=Math.max(1,Math.round(length/450));
  for(let j=1;j<=count;j++){const t=j/count,p:V3=[a[0]+(b[0]-a[0])*t,0,a[2]+(b[2]-a[2])*t];if(Math.hypot(p[0]-locations.at(-1)![0],p[2]-locations.at(-1)![2])>1)locations.push(p);}
 }
 const measured=line.id===179559746;
 if(measured)locations.splice(0,locations.length,...raySpans.supports.map(s=>s.position as V3));
 const subnetworkId=`hypothetical-osm-${line.id}`;
 const props=(id:string,assetClass:string,assetGroup:string,esriClass:string,phase='ABC')=>({id,assetClass,assetGroup,esriClass,subnetworkId,phase,nominalKv:line.voltage/1000,sourceOsmWay:line.id,synthetic:true,verticalDatum:'hypothetical local ground = 0m'});
 const point=(id:string,p:V3,properties:Record<string,unknown>):UNFeature=>({type:'Feature',id,geometry:{type:'Point',coordinates:geographic(p)},properties});
 const structure:UNFeature[]=[],junctions:UNFeature[]=[],lines:UNFeature[]=[];
 const attachment:{fromId:string;toId:string;subnetworkId:string}[]=[],connectivity:{fromId:string;toId:string;phase:string;subnetworkId:string}[]=[];
 const towers:Structure[]=locations.map((p,i)=>{
  const before=locations[Math.max(0,i-1)],after=locations[Math.min(locations.length-1,i+1)];
  const heading=Math.atan2(after[2]-before[2],after[0]-before[0]),height=measured?raySpans.supports[i].top:38+4*Math.sin(i*.7),id=measured?raySpans.supports[i].id:`${subnetworkId}-T${i+1}`;
  structure.push(point(id,p,{...props(id,'tower','structure','StructureJunction'),heightMeters:height,assetType:'Hypothetical lattice support'}));
  const attachments=['A','B','C'].map((phase,j)=>{
   const offset=(j-1)*(measured?rayFrames.structures[i].crossarmWidthMeters/2:8);const attachmentHeight=measured?p[1]+(height-p[1])*.82-2.5:height-3;const pos:V3=[p[0]-Math.sin(heading)*offset,attachmentHeight,p[2]+Math.cos(heading)*offset];const aid=`${id}-${phase}`;
   junctions.push(point(aid,pos,{...props(aid,'phase_attachment','electric_junction','ElectricTransmissionJunction',phase),assetType:'High Voltage Attachment',structureId:id}));
   attachment.push({fromId:id,toId:aid,subnetworkId});return {id:aid,phase,position:pos};
  });return {id,position:p,height,heading,attachments};
 });
 const splices:{id:string;phase:string;position:V3;fromTower:number;toTower:number}[]=[];
 const spans:{id:string;phase:string;points:V3[]}[]=[];
 for(let i=1;i<towers.length;i++)for(let j=0;j<3;j++){
  const a=towers[i-1].attachments[j],b=towers[i].attachments[j],id=`${subnetworkId}-S${i}-${a.phase}`;
  const d=Math.hypot(b.position[0]-a.position[0],b.position[2]-a.position[2]),sag=Math.min(7,d*.025);
  let points=Array.from({length:21},(_,k):V3=>{const t=k/20;return [a.position[0]+(b.position[0]-a.position[0])*t,a.position[1]+(b.position[1]-a.position[1])*t-4*sag*t*(1-t),a.position[2]+(b.position[2]-a.position[2])*t];});
  spans.push({id,phase:a.phase,points});
  const splice=!measured&&i%4===1&&j===1?{id:`${id}-splice`,phase:a.phase,position:points[10],fromTower:i-1,toTower:i}:undefined;
  if(splice){splices.push(splice);junctions.push(point(splice.id,splice.position,{...props(splice.id,'conductor_splice','electric_junction','ElectricTransmissionJunction',a.phase),assetType:'Hypothetical compression splice',fromStructure:towers[i-1].id,toStructure:towers[i].id,parentSpanId:id}));}
  const pieces=splice?[{id:id+'-1',points:points.slice(0,11),from:a.id,to:splice.id},{id:id+'-2',points:points.slice(10),from:splice.id,to:b.id}]:[{id,points,from:a.id,to:b.id}];
  for(const piece of pieces){lines.push({type:'Feature',id:piece.id,geometry:{type:'LineString',coordinates:piece.points.map(geographic)},properties:{...props(piece.id,'overhead_conductor','electric_line','ElectricTransmissionLine',a.phase),fromAttachment:piece.from,toAttachment:piece.to,parentSpanId:id,syntheticSagMeters:sag,spanLengthMeters:splice?d/2:d}});
  connectivity.push({fromId:piece.from,toId:piece.id,phase:a.phase,subnetworkId},{fromId:piece.id,toId:piece.to,phase:a.phase,subnetworkId});}

 }
 if(measured){
  for(let i=0;i<structure.length;i++){structure[i].id=raySpans.supports[i].id;Object.assign(structure[i].properties,{synthetic:false,derived:true,...raySpans.supports[i],status:'Unverified LiDAR support candidate',verticalDatum:`NAVD88 metres minus ${raySpans.verticalOffsetMeters}`});}
  for(const feature of [...junctions,...lines])Object.assign(feature.properties,{synthetic:true,estimated:true,phaseResolved:false,status:'Modeled three-phase layout; not LiDAR-resolved',verticalDatum:'NAVD88 metres',layout:'Horizontal A/B/C, cross-corridor crossarm; 2.5 m modeled insulator strings'});

 }
 const fc=(features:UNFeature[])=>({type:'FeatureCollection',features});
 return {origin,towers,spans,splices,locations,pack:{schemaVersion:'flightline-un-convention/1.0',description:measured?raySpans.limitations+' Three-phase attachments, insulators and parabolic sag are estimated; not an as-built electrical topology.':'ISV-inspired GeoJSON + JSON convention, not an Esri geodatabase or validated UN topology. OSM alignment only; supports, phases, heights, sag and circuit membership are synthetic.',structure:fc(structure),electricJunctions:fc(junctions),electricLines:fc(lines),subnetworks:{id:subnetworkId,synthetic:!measured,controller:null},associations:{attachment,connectivity},provenance:{osmWay:line.id,license:'ODbL 1.0',origin,supportPlacement:{nominalSpanMeters:450,alignmentSimplificationMeters:25,description:measured?'OSM-seeded elevated LiDAR clusters; unverified structure candidates':'Synthetic supports; short spans may remain at major bends and endpoints'},verticalDatum:measured?`NAVD88 metres minus ${raySpans.verticalOffsetMeters}; mixed historic surveys`:'arbitrary flat local ground, not orthometric/ellipsoidal elevations',sources:['https://isv.wiki/meter-village-geojson-un.html','https://github.com/overview-solutions/smart-village-simulator/tree/main/villages','https://doc.arcgis.com/en/arcgis-solutions/11.5/reference/other/ElectricTransmissionEssentials_UtilityNetwork.html']}}};
}
