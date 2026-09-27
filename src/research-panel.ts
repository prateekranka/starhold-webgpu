import {researchGraph} from './research-graph';
import './research-panel.css';
import {names} from './kinds';
import {CIVILIZATIONS,RESEARCH_LABELS,RESEARCH_STATUS,readResearch,researchEffect,requirements,escapeMarkup as e,type ContentAbi} from './content-api';
/** The same inspector is mounted in a real match and a disposable workshop. */
export class ResearchPanel {
 readonly element=document.createElement('section');
 private stamp=''; private readonly abort=new AbortController();
 constructor(private readonly sim:ContentAbi,private readonly changed:()=>void=()=>{}){
  this.element.className='research-atlas';this.element.setAttribute('aria-label','Civilization research atlas');
  this.element.addEventListener('click',ev=>{
   const button=(ev.target as Element).closest<HTMLButtonElement>('button[data-research]');
   if(!button||button.disabled)return;
   const id=Number(button.dataset.research),ok=this.sim.sim_command(id===-1?11:10,id===-1?0:id,0);
   const status=this.element.querySelector<HTMLElement>('[role=status]');
   if(status)status.textContent=ok?'Research order accepted.':RESEARCH_STATUS[this.sim.sim_research_status(id)]??'Order rejected.';
   this.stamp='';this.changed();this.update();
  },{signal:this.abort.signal});this.update();
 }
 update():void {
  const s=this.sim,all=readResearch(s),nodes=all.filter(n=>n.faction===s.sim_player());
  const statuses=nodes.map(n=>s.sim_research_status(n.id));
  const stamp=[s.sim_mode(),s.sim_player(),s.sim_age(),s.sim_alloy(),s.sim_charge(),s.sim_research_active(),Math.ceil(s.sim_research_remaining()/60),...statuses].join(':');
  if(stamp===this.stamp)return;this.stamp=stamp;
  const focus=(document.activeElement as HTMLElement|null)?.dataset.research;
  const active=s.sim_research_active();
  this.element.innerHTML=`<header><div><small>PER-MATCH RESEARCH · SIX-NODE FIRST SLICE</small><h2>${e(CIVILIZATIONS[s.sim_player()])}</h2></div><p>${s.sim_alloy()} Alloy · ${s.sim_charge()} Charge<br>Age ${s.sim_age()+1} of 3</p></header><p class="research-help">Read left to right within each branch. Research spends resources once and completes over time. Both prerequisites and producer availability are checked by the simulation.</p>${researchGraph(nodes,all,s)}<div class="research-groups">${[...new Set(nodes.map(n=>RESEARCH_LABELS[n.id]?.[1]??'Research'))].map(group=>`<section class="research-cluster"><h3>${e(group)}</h3><div class="research-nodes">${nodes.filter(n=>RESEARCH_LABELS[n.id]?.[1]===group).map(n=>{
   const status=s.sim_research_status(n.id),parents=requirements(n,all),name=RESEARCH_LABELS[n.id]?.[0]??String(n.id);
   return `<article id="research-${n.id}" class="research-node state-${status}" data-node="${n.id}"><span class="node-state">${e(RESEARCH_STATUS[status]??'Unavailable')}</span><h4>${e(name)}</h4><p>${e(names[n.target]??n.target)}: ${e(researchEffect(n))}</p><dl><dt>Cost</dt><dd>${n.alloy} Alloy · ${n.charge} Charge · ${n.ticks/60}s</dd><dt>Requires</dt><dd>Age ${n.age+1} · ${e(names[n.producer]??n.producer)}${parents.length?' · '+parents.map(p=>e(RESEARCH_LABELS[p.id]?.[0]??p.id)).join(' + '):''}</dd></dl>${n.exclusive?'<p class="research-choice">Choose one doctrine for this match.</p>':''}<button data-research="${n.id}" ${status!==9?'disabled':''}>${status===7?'Completed':status===8?`${Math.ceil(s.sim_research_remaining()/60)}s remaining`:'Research'}</button></article>`;
  }).join('')}</div></section>`).join('')}</div><footer><span role="status">${active?`Researching ${e(RESEARCH_LABELS[active]?.[0]??active)}.`:'Research choices reset with a new match.'}</span>${active?'<button data-research="-1">Cancel / full refund</button>':''}</footer>`;
  if(focus)this.element.querySelector<HTMLButtonElement>(`button[data-research="${CSS.escape(focus)}"]`)?.focus({preventScroll:true});
 }
 dispose():void {this.abort.abort();this.element.remove();}
}
export function mountMatchResearch(sim:ContentAbi):{update:()=>void;dispose:()=>void}{
 const entry=document.createElement('button'),dialog=document.createElement('dialog'),close=document.createElement('button');
 entry.id='hud-research';entry.className='research-entry';entry.textContent='RESEARCH';entry.setAttribute('aria-haspopup','dialog');
 dialog.className='research-dialog';dialog.setAttribute('aria-label','Civilization research');close.textContent='Close research';close.className='research-close';
 const panel=new ResearchPanel(sim);dialog.append(close,panel.element);document.body.append(entry,dialog);
 entry.onclick=()=>{panel.update();dialog.showModal();close.focus();};close.onclick=()=>dialog.close();
 return {update(){const active=sim.sim_mode()===1;entry.hidden=!active;if(!active&&dialog.open)dialog.close();if(dialog.open)panel.update();},dispose(){panel.dispose();dialog.remove();entry.remove();}};
}
