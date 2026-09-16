import './asset-review.css';
import {ASH_JACKAL_CANDIDATES,ASH_JACKAL_CONTRACT,ASH_JACKAL_HUMAN_CRITERIA,allRequiredGatesPass,candidateFor,evaluateAshJackalCandidate,type AssetCandidate} from '../assets/ash-jackal-contract';
import type {JackalVariant} from '../assets/ash-jackal';

type ReviewDecision='pending'|'approved'|'rework';
interface HumanReview {
 revision:string;
 decision:ReviewDecision;
 checks:Record<string,boolean>;
 note:string;
 decidedAt:string|null;
}
const root=document.querySelector<HTMLElement>('#workshop')!;
const key=(revision:string)=>`starhold.asset-review.v2.${revision}`;
const ESCAPE:Record<string,string>={'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'};
const html=(value:unknown)=>String(value??'').replace(/[&<>"']/g,ch=>ESCAPE[ch]??ch);
const stage=(value:string)=>value.split('-').map(word=>word[0]?.toUpperCase()+word.slice(1)).join(' ');
function blank(candidate:AssetCandidate):HumanReview{
 return {revision:candidate.revision,decision:'pending',checks:Object.fromEntries(ASH_JACKAL_HUMAN_CRITERIA.map(c=>[c.id,false])),note:'',decidedAt:null};
}
function load(candidate:AssetCandidate):HumanReview{
 try{
  const parsed=JSON.parse(localStorage.getItem(key(candidate.revision))??'null') as Partial<HumanReview>|null;
  if(!parsed||parsed.revision!==candidate.revision)return blank(candidate);
  return {...blank(candidate),...parsed,checks:{...blank(candidate).checks,...parsed.checks}};
 }catch{return blank(candidate);}
}
function save(review:HumanReview){
 try{localStorage.setItem(key(review.revision),JSON.stringify(review));}catch{/* Review can still be exported in privacy-restricted contexts. */}
}
function provenance():unknown{
 try{return JSON.parse(document.querySelector('#provenance')?.textContent||'{}');}catch{return {};}
}
function workshopState():any{return (window as any).__WORKSHOP?.getState?.();}
function download(filename:string,payload:unknown){
 const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');
 a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),0);
}
let panel:HTMLElement|null=null;
function currentVariant():JackalVariant{
 return (document.querySelector<HTMLSelectElement>('#variant')?.value==='longbow'?'longbow':'field');
}
function currentReview(){
 const candidate=candidateFor(currentVariant()),review=load(candidate),gates=evaluateAshJackalCandidate(candidate.id);
 return {candidate,review,gates};
}
function exportReview(){
 const state=workshopState(),{candidate,review,gates}=currentReview();
 download(`starhold-${candidate.revision}-review.json`,{
  format:'starhold-asset-review-v2',
  contract:ASH_JACKAL_CONTRACT,
  candidate,
  technicalGates:gates,
  humanReview:review,
  provenance:provenance(),
  workshopState:state,
  policy:'Human approval is review evidence only. It never promotes a candidate, rewrites source, or changes the runtime default.',
 });
}
function render(){
 if(!panel)return;
 const state=workshopState();
 if(!state||state.kind!==ASH_JACKAL_CONTRACT.kind||state.civ!==ASH_JACKAL_CONTRACT.civilization){
  panel.hidden=true;panel.dataset.ready='true';return;
 }
 panel.hidden=false;
 const {candidate,review,gates}=currentReview(),technical=gates.every(g=>g.pass),humanComplete=ASH_JACKAL_HUMAN_CRITERIA.every(c=>review.checks[c.id]);
 const decision=review.decision==='approved'?'Approved locally — not promoted':review.decision==='rework'?'Rework requested':'Pending human review';
 const candidates=ASH_JACKAL_CANDIDATES.map(c=>`<li class="${c.revision===candidate.revision?'current':''}"><strong>${html(c.revision)}</strong><span>${html(stage(c.stage))}</span><small>${html(c.summary)}</small>${c.parentRevision?`<em>parent ${html(c.parentRevision)}</em>`:'<em>root candidate</em>'}</li>`).join('');
 const gateRows=gates.map(g=>`<li data-gate="${html(g.id)}" data-pass="${g.pass}" class="${g.pass?'pass':'fail'}"><span aria-hidden="true">${g.pass?'✓':'×'}</span><div><strong>${html(g.label)}</strong><small>${html(g.detail)}</small></div></li>`).join('');
 const humanRows=ASH_JACKAL_HUMAN_CRITERIA.map(c=>`<label><input type="checkbox" data-human="${html(c.id)}" ${review.checks[c.id]?'checked':''}><span><strong>${html(c.label)}</strong><small>${html(c.description)}</small></span></label>`).join('');
 panel.innerHTML=`<header class="asset-governance-head"><div><p class="eyebrow">GOVERNED ASSET · ${html(ASH_JACKAL_CONTRACT.schema)}</p><h2>Ash Jackal asset contract</h2><p>${html(ASH_JACKAL_CONTRACT.role)} · ${html(ASH_JACKAL_CONTRACT.bodyPlan)} · candidate <strong id="candidate-revision">${html(candidate.revision)}</strong></p></div><span class="stage stage-${html(candidate.stage)}">${html(stage(candidate.stage))}</span></header>
 <div class="asset-contract-grid">
  <section><h3>Identity contract</h3><dl><dt>Must read as</dt><dd>${ASH_JACKAL_CONTRACT.identity.mustReadAs.map(html).join(' · ')}</dd><dt>Must not become</dt><dd>${ASH_JACKAL_CONTRACT.identity.mustNotReadAs.map(html).join(' · ')}</dd><dt>Palette</dt><dd>${ASH_JACKAL_CONTRACT.identity.palette.map(html).join(' · ')}</dd><dt>Required states</dt><dd>${ASH_JACKAL_CONTRACT.animation.requiredStates.map(html).join(' · ')}</dd></dl></section>
  <section><h3>Version history</h3><ol class="candidate-history">${candidates}</ol></section>
 </div>
 <section class="gate-block"><div class="gate-title"><h3>Automated asset gates</h3><strong id="gate-summary" class="${technical?'pass':'fail'}">${gates.filter(g=>g.pass).length}/${gates.length} required gates pass</strong></div><ul id="asset-gates" class="asset-gates">${gateRows}</ul><p class="gate-rule">Gate thresholds are contract values. Fix the asset when a gate fails; do not weaken a gate to make a candidate pass without an explicit design decision.</p></section>
 <section class="human-review"><div class="gate-title"><h3>Human visual review</h3><strong id="review-status" class="decision-${review.decision}">${html(decision)}</strong></div><div id="human-review" class="human-checks">${humanRows}</div><label class="review-note">Review note<textarea id="asset-review-note" rows="3" placeholder="What works? What needs another pass?">${html(review.note)}</textarea></label><div class="review-actions"><button id="asset-approve-human" ${!technical||!humanComplete?'disabled':''}>Approve candidate</button><button id="asset-rework-human">Request rework</button><button id="asset-clear-human">Clear decision</button></div><p class="gate-rule">Approval is stored only as local review evidence and can be exported. It does not change the game’s production default or commit anything to Git.</p></section>`;
 panel.dataset.ready='true';
 for(const input of panel.querySelectorAll<HTMLInputElement>('[data-human]'))input.onchange=()=>{
  const next=load(candidate);next.checks[input.dataset.human!]=input.checked;if(next.decision==='approved')next.decision='pending';next.decidedAt=null;save(next);render();
 };
 const note=panel.querySelector<HTMLTextAreaElement>('#asset-review-note')!;note.oninput=()=>{const next=load(candidate);next.note=note.value;save(next);};
 panel.querySelector<HTMLButtonElement>('#asset-approve-human')!.onclick=()=>{
  const next=load(candidate);if(!allRequiredGatesPass(candidate.id)||!ASH_JACKAL_HUMAN_CRITERIA.every(c=>next.checks[c.id]))return;
  next.decision='approved';next.decidedAt=new Date().toISOString();save(next);render();
 };
 panel.querySelector<HTMLButtonElement>('#asset-rework-human')!.onclick=()=>{const next=load(candidate);next.decision='rework';next.decidedAt=new Date().toISOString();save(next);render();};
 panel.querySelector<HTMLButtonElement>('#asset-clear-human')!.onclick=()=>{const next=load(candidate);next.decision='pending';next.decidedAt=null;save(next);render();};
}
function install(){
 if(document.querySelector('#asset-governance'))return;
 const forge=document.querySelector<HTMLElement>('#view-forge'),exportButton=document.querySelector<HTMLButtonElement>('#approve');
 if(!forge||!exportButton)return;
 panel=document.createElement('section');panel.id='asset-governance';panel.className='asset-governance';panel.setAttribute('aria-label','Asset contract and approval');
 forge.insertBefore(panel,exportButton);
 exportButton.textContent='Export full review record';
 exportButton.onclick=exportReview;
 document.querySelector<HTMLSelectElement>('#variant')?.addEventListener('input',()=>queueMicrotask(render));
 document.querySelector<HTMLSelectElement>('#civ')?.addEventListener('change',()=>queueMicrotask(render));
 root.addEventListener('click',()=>queueMicrotask(render));
 render();
 Object.assign(window,{__ASSET_REVIEW:{
  getState:()=>{const {candidate,review,gates}=currentReview();return {candidate,review,gates,technicalPass:gates.every(g=>g.pass)};},
  export:exportReview,
 }});
}
function waitForWorkshop(){
 if(root.dataset.ready==='true'){install();return;}
 if(root.dataset.error==='true')return;
 requestAnimationFrame(waitForWorkshop);
}
waitForWorkshop();
if(import.meta.hot)import.meta.hot.dispose(()=>panel?.remove());
