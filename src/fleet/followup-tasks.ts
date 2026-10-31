import type {VegetationEvent} from './vegetation-model';
export function taskFor(e:VegetationEvent){const equipment=e.category==='equipment'||e.id.startsWith('EQUIP-');return {id:e.id,kind:equipment?'Multirotor':'Vegetation',title:equipment?(e.label??e.id):e.id,priority:e.risk==='high'||e.zone?'High':'Review',action:equipment?'Confirm component ID; acquire overview and opposing oblique zoom images. Compare attachment, insulator or splice condition with the original finding.':'Ground-survey species, crown and conductor clearance; assess selective pruning. Consider removal only after arborist review. Re-scan after approved work.',gate:equipment?'Qualified pilot to approve access, stand-off and flight plan; no autonomous close approach.':'Qualified utility vegetation crew to approve treatment, permissions and electrical work controls.'};}
export function followupTasks(host:HTMLElement,select:(id:string)=>void,scope:string,spanIds:(e:VegetationEvent)=>string[]){
 const key='flightline.tasks.v2:'+scope;
 type Task=ReturnType<typeof taskFor>&{status:string;spanIds:string[];flaggedAt:string;missionSeconds:number;assignee:string;notes:string;comments:{at:string;text:string}[]};
 const tasks=new Map<string,Task>();
 let storageOk=true;
 try{const saved=JSON.parse(localStorage.getItem(key)??'[]');if(Array.isArray(saved))for(const t of saved)if(typeof t.id==='string'&&Array.isArray(t.comments)&&Array.isArray(t.spanIds))tasks.set(t.id,t);}catch{storageOk=false;}
 const panel=document.createElement('section');panel.className='followup-tasks';panel.innerHTML='<div class="task-count">Tasks <span>0</span></div><small class="task-save"></small><input class="task-search" aria-label="Search tasks" placeholder="Search tasks or spans"><div class="followup-list"></div><button class="task-export">Export tasks</button>';host.append(panel);
 const list=panel.querySelector<HTMLElement>('.followup-list')!,search=panel.querySelector<HTMLInputElement>('.task-search')!;
 function saved(){panel.querySelector('.task-save')!.textContent=storageOk?'Simulation drafts · saved on this browser':'Browser storage unavailable · export to retain';}
 function save(){try{localStorage.setItem(key,JSON.stringify([...tasks.values()]));storageOk=true;}catch{storageOk=false;}saved();}
 panel.querySelector<HTMLButtonElement>('.task-export')!.onclick=()=>{const url=URL.createObjectURL(new Blob([JSON.stringify({simulationOnly:true,scope,tasks:[...tasks.values()]},null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='followup-task-drafts.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
 function filter(){const q=search.value.toLowerCase();for(const card of Array.from(list.children) as HTMLElement[])card.hidden=!(card.dataset.search??'').includes(q);}
 search.oninput=filter;
 function add(t:Task){
  const card=document.createElement('details');card.className='task-card';card.dataset.search=[t.title,t.id,...t.spanIds,t.assignee].join(' ').toLowerCase();
  const summary=document.createElement('summary'),title=document.createElement('strong'),meta=document.createElement('small');title.textContent=t.title;meta.textContent=t.kind+' · '+t.priority+' · '+t.status;summary.append(title,meta);
  const span=document.createElement('div');span.className='task-span';span.textContent=t.spanIds.join(' · ');summary.append(span);card.append(summary);
  const details=document.createElement('div');details.className='task-fields';card.append(details);
  const date=document.createElement('small');date.textContent='Flagged '+new Date(t.flaggedAt).toLocaleString()+' · mission '+Math.round(t.missionSeconds/60)+' min';date.title='Date this simulated finding was first added to the task list';details.append(date);
  function field(label:string,value:string,multiline:boolean,change:(v:string)=>void){const wrap=document.createElement('label');wrap.textContent=label;const input=document.createElement(multiline?'textarea':'input');input.value=value;input.setAttribute('aria-label',label+' for '+t.id);input.oninput=()=>{change(input.value);save();};wrap.append(input);details.append(wrap);}
  field('Title',t.title,false,v=>{t.title=v;title.textContent=v;card.dataset.search=[v,t.id,...t.spanIds,t.assignee].join(' ').toLowerCase();});
  field('Assignee',t.assignee,false,v=>{t.assignee=v;card.dataset.search=[t.title,t.id,...t.spanIds,v].join(' ').toLowerCase();});
  const status=document.createElement('select');status.setAttribute('aria-label','Task status for '+t.id);for(const value of ['Draft','Reviewed','Scheduled','Complete'])status.add(new Option(value,value));status.value=t.status;status.onchange=()=>{t.status=status.value;meta.textContent=t.kind+' · '+t.priority+' · '+t.status;save();};details.append(status);
  field('Notes',t.notes,true,v=>t.notes=v);
  const comments=document.createElement('div');comments.className='task-comments';details.append(comments);
  function showComment(c:Task['comments'][number]){const p=document.createElement('p');p.textContent=new Date(c.at).toLocaleString()+' — '+c.text;comments.append(p);}t.comments.forEach(showComment);
  const draft=document.createElement('textarea');draft.placeholder='Add a comment';draft.setAttribute('aria-label','New comment for '+t.id);const post=document.createElement('button');post.textContent='Add comment';post.onclick=()=>{if(!draft.value.trim())return;const c={at:new Date().toISOString(),text:draft.value.trim()};t.comments.push(c);showComment(c);draft.value='';save();};details.append(draft,post);
  const locate=document.createElement('button');locate.textContent='Locate finding';locate.onclick=()=>select(t.id);details.append(locate);
  const guidance=document.createElement('details');const heading=document.createElement('summary');heading.textContent='Suggested work';const p=document.createElement('p');p.textContent=t.action+' '+t.gate;guidance.append(heading,p);details.append(guidance);
  list.prepend(card);
 }
 for(const t of tasks.values())add(t);
 function count(){panel.querySelector('.task-count span')!.textContent=String(tasks.size);}count();saved();
 return {update(events:VegetationEvent[]){let changed=false;for(const e of events)if(!tasks.has(e.id)){const t:Task={...taskFor(e),status:'Draft',spanIds:spanIds(e),flaggedAt:new Date().toISOString(),missionSeconds:e.seconds,assignee:'',notes:'',comments:[]};tasks.set(e.id,t);add(t);changed=true;}if(changed){save();count();filter();}},dispose(){panel.remove();}};
}
