type Incident = {id:string;title:string;source:string;issued:string;rings:number[][][]};
/** Local preparation packet. Provider schemas and originator authorization remain external. */
export function notamDraft(host:HTMLElement,incident:Incident) {
 const details=document.createElement('details');
 const summary=document.createElement('summary');summary.textContent='Prepare NOTAM request';details.append(summary);
 const form=document.createElement('form');
 form.className='notam-draft';
 form.innerHTML='<strong>Local draft · submission unconnected</strong><label>Request type <select name="kind"><option value="tfr-request">Disaster TFR request</option><option value="uas-activity">UAS activity notice request</option></select></label><label>Start UTC <input name="start" type="datetime-local" required></label><label>End UTC <input name="end" type="datetime-local" required></label><label>Accountable organization <input name="organization" required></label><label>Coordinator contact <input name="contact" required></label><label>Requested ceiling ft AGL <input name="ceiling" type="number" min="1" max="60000" required></label><small>Incident footprint requires airspace review. No restriction or clearance is created.</small><button type="submit">Export review packet</button><output></output>';
 const input=(name:string)=>form.elements.namedItem(name) as HTMLInputElement;
 const start=new Date();start.setUTCMinutes(start.getUTCMinutes()+30,0,0);
 input('start').value=start.toISOString().slice(0,16);
 input('end').value=new Date(start.getTime()+3600000).toISOString().slice(0,16);
 form.onsubmit=event=>{
  event.preventDefault();
  const begins=new Date(input('start').value+'Z'),ends=new Date(input('end').value+'Z');
  const output=form.querySelector('output')!;
  if(!Number.isFinite(begins.getTime())||!Number.isFinite(ends.getTime())||ends<=begins||begins.getTime()<Date.now()){
   output.textContent='Choose a future UTC start and a later end.';return;
  }
  const packet={
   schema:'flightline.notice-request.v1',status:'draft',submitted:false,simulation:true,
   createdAt:new Date().toISOString(),requestType:input('kind').value,
   incident:{id:incident.id,title:incident.title,source:incident.source,observedAt:incident.issued},
   requestedWindow:{start:begins.toISOString(),end:ends.toISOString()},
   accountableOrganization:input('organization').value.trim(),coordinatorContact:input('contact').value.trim(),
   requestedAltitude:{floor:0,ceiling:Number(input('ceiling').value),units:'ft',reference:'AGL',terrainValidated:false},
   incidentGeometry:{type:'MultiLineString',coordinates:incident.rings},
   geometryStatus:'Incident outlines or report markers only; authorized airspace geometry required',
   pending:['Authorized originator and jurisdiction','Airspace boundary and altitude datum review','Provider submission contract','Incident coordination','Approval and issued NOTAM identifier'],
   provider:{name:null,requestId:null,issuedNotamId:null}
  };
  const url=URL.createObjectURL(new Blob([JSON.stringify(packet,null,2)],{type:'application/json'}));
  const link=document.createElement('a');link.href=url;link.download='flightline-notam-request-draft.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  output.textContent='Draft exported for review · not submitted';
 };
 details.append(form);host.append(details);
}
