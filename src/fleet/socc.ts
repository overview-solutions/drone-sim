import {generateUN} from './un';
export function boundaryFeature(network:ReturnType<typeof generateUN>,index:number){
 const towers=network.towers,t=towers[index];let turn=0;
 if(index>0&&index<towers.length-1){const a=towers[index-1].position,b=t.position,c=towers[index+1].position;const h1=Math.atan2(b[2]-a[2],b[0]-a[0]),h2=Math.atan2(c[2]-b[2],c[0]-b[0]);turn=Math.abs(Math.atan2(Math.sin(h2-h1),Math.cos(h2-h1)))*180/Math.PI;}
 const kind=index===0?'CB':index===towers.length-1?'XMFR':turn>=15?'ANGLE':'EXT';
 return {id:t.id+'-boundary',structureId:t.id,index,kind,turnDegrees:Math.round(turn),position:t.position,simulationOnly:true,
 label:kind==='CB'?'Circuit breaker':kind==='XMFR'?'Transformer terminal':kind==='ANGLE'?'Angle / strain structure':'Line extension / splice boundary',
 reason:kind==='ANGLE'?'Alignment changes '+Math.round(turn)+'°':kind==='EXT'?'Synthetic extension section break':kind==='CB'?'Synthetic switched circuit terminal':'Synthetic transformer interface',
 provenance:kind==='ANGLE'?'Inferred from modeled alignment; structure type unverified':'Seeded demonstration equipment; not observed OSM equipment'};
}
/** Synthetic review sectors: shared junction plus one span on each side. */
export function soccPackages(network:ReturnType<typeof generateUN>){
 const {towers,pack}=network,n=towers.length;
 const boundaries=Array.from(new Set([0,Math.floor((n-1)/3),Math.floor(2*(n-1)/3),n-1])).sort((a,b)=>a-b);
 return boundaries.slice(0,-1).map((start,i)=>{
  const end=boundaries[i+1],lo=Math.max(0,start-1),hi=Math.min(n-1,end+1),selected=towers.slice(lo,hi+1),ids=new Set(selected.map(t=>t.id)),attachments=new Set(selected.flatMap(t=>t.attachments.map(a=>a.id)));
  for(const j of pack.electricJunctions.features)if(j.properties.assetClass==='conductor_splice'&&ids.has(String(j.properties.fromStructure))&&ids.has(String(j.properties.toStructure)))attachments.add(j.id);
  const conductors=pack.electricLines.features.filter(f=>attachments.has(String(f.properties.fromAttachment))&&attachments.has(String(f.properties.toAttachment)));
  const featureIds=new Set([...ids,...attachments,...conductors.map(f=>f.id)]);
  return {id:`SOCC-${i+1}`,simulationOnly:true,boundaryFeatures:[boundaryFeature(network,start),boundaryFeature(network,end)],coreStructureIds:towers.slice(start,end+1).map(t=>t.id),overlapSpans:1,spliceReviewRequirements:network.splices.filter(s=>attachments.has(s.id)).map(s=>({componentId:s.id,phase:s.phase,requiredViews:['splice-close-up'],status:'unreviewed',reviewScope:`SOCC-${i+1}`})),structureIds:[...ids],reviewRequirements:selected.map(t=>({structureId:t.id,phaseAttachmentIds:t.attachments.map(a=>a.id),requiredViews:['incoming-side','outgoing-side','full-structure'],status:'unreviewed',reviewScope:`SOCC-${i+1}`,sharedBoundary:t.id===towers[start].id&&i>0||t.id===towers[end].id&&i<boundaries.length-2})),network:{...pack,structure:{...pack.structure,features:pack.structure.features.filter(f=>ids.has(f.id))},electricJunctions:{...pack.electricJunctions,features:pack.electricJunctions.features.filter(f=>attachments.has(f.id))},electricLines:{...pack.electricLines,features:conductors},associations:{attachment:pack.associations.attachment.filter(a=>featureIds.has(a.fromId)&&featureIds.has(a.toId)),connectivity:pack.associations.connectivity.filter(a=>featureIds.has(a.fromId)&&featureIds.has(a.toId))}}};
 });
}
