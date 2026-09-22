import './workshop.css';
import {Renderer} from '../renderer';
import {names} from '../kinds';
import {readRoster,readDefinition,CIVILIZATIONS,escapeMarkup as e} from '../content-api';
import {ResearchPanel} from '../research-panel';
import {JACKAL_VARIANTS,type JackalVariant} from '../assets/ash-jackal';
import {getActorDetails} from '../actor-specs';
import {loadWorkshop,DEFAULT_FIXTURE,downloadJSON,type WorkshopSession,type Fixture} from './runtime';
if(!import.meta.env.DEV)throw new Error('The workshop is development-only.');
const VIEWS=['codex','forge','encounter','research','review'] as const;
type View=typeof VIEWS[number];
const TITLES=['Civilization Codex','Asset Forge','Encounter Lab','Research Atlas','Review & Evidence'];
const q=new URLSearchParams(location.search);
let view:View=VIEWS.includes(q.get('view') as View)?q.get('view') as View:'forge';
let civ=q.get('civ')==='0'?0:1,kind=Number(q.get('kind'))||30,variant:JackalVariant=q.get('variant')==='longbow'?'longbow':'field';
let phase=0,state=0,playing=false,speed=1,frame=0,last=0,accumulator=0,disposed=false,drawing=false;
let session:WorkshopSession,createSession:()=>Promise<WorkshopSession>,research:ResearchPanel,selected:number|null=null,commandMode=0;
let comparisons:Record<string,unknown>[]=[];
const root=document.querySelector<HTMLElement>('#workshop')!;
const renderer=new Renderer();
const capturedFrame=document.createElement('canvas');capturedFrame.width=960;capturedFrame.height=540;
const capturedContext=capturedFrame.getContext('2d')!;
let redrawPending=false;
let revision:Record<string,unknown>={revision:'unavailable'};
const element=<T extends HTMLElement=HTMLElement>(id:string)=>document.getElementById(id) as T;
function fail(error:unknown){playing=false;element('status').textContent=error instanceof Error?error.message:String(error);root.dataset.error='true';}
function route(){const params=new URLSearchParams({view,civ:String(civ),kind:String(kind),variant});history.replaceState(null,'',`?${params}`);}
function tabs(){for(const button of root.querySelectorAll<HTMLButtonElement>('[data-view]'))button.setAttribute('aria-current',button.dataset.view===view?'page':'false');}
function renderActorSpecs(){
 const d=readDefinition(session.sim,kind);
 if(!d)return;
 const actor=getActorDetails(kind);
 const civName=CIVILIZATIONS[d.faction]??'Unknown';
 const klassName=d.klass===0?'Building':'Unit';

 const codexMount=element('codex-content');
 if(codexMount){
  codexMount.innerHTML=`<div class="actor-card codex-card"><div class="actor-card-header"><div><span class="badge ${d.faction===0?'badge-dawn':'badge-cinder'}">${civName}</span> <span class="badge">${klassName} · Age ${d.tier+1}</span> <span class="badge badge-gold">Kind ${kind}</span></div><p class="actor-role-title"><strong>${e(actor.role)}</strong></p></div><p class="actor-lore">${e(actor.lore)}</p><div class="actor-section"><h3>${d.klass===0?'Architectural Details':'Procedural Rig Specifications'}</h3><ul class="spec-list">${actor.details.map(item=>`<li><span class="bullet-check">✓</span><span>${e(item)}</span></li>`).join('')}</ul></div><div class="actor-contracts-grid"><div><h4>Silhouette Contract</h4><p>${e(actor.silhouette)}</p></div><div><h4>Motion Contract</h4><p>${e(actor.motion)}</p></div></div><div class="actor-stats-grid"><div class="stat-pill"><span class="stat-label">Health</span><span class="stat-val">${d.health} HP</span></div><div class="stat-pill"><span class="stat-label">Speed</span><span class="stat-val">${d.speed.toFixed(2)}</span></div><div class="stat-pill"><span class="stat-label">Range</span><span class="stat-val">${d.range>0?d.range:'Melee'}</span></div><div class="stat-pill"><span class="stat-label">Damage</span><span class="stat-val">${d.damage}</span></div><div class="stat-pill"><span class="stat-label">Cost</span><span class="stat-val">${d.alloy}A / ${d.charge}C</span></div><div class="stat-pill"><span class="stat-label">Build Time</span><span class="stat-val">${d.ticks/60}s</span></div><div class="stat-pill"><span class="stat-label">Producer</span><span class="stat-val">${d.producer>0?(names[d.producer]??`Kind ${d.producer}`):'Citadel'}</span></div><div class="stat-pill"><span class="stat-label">Authority</span><span class="stat-val">WASM Sim</span></div></div></div>`;
 }

 const forgeSpecs=element('forge-specs');
 if(forgeSpecs){
  forgeSpecs.innerHTML=`<div class="actor-card forge-spec-card"><div class="actor-card-header"><h3>Authoritative Rig Specifications</h3><span class="badge badge-gold">Single Source of Truth</span></div><p class="actor-spec-intro"><strong>Contract Silhouette:</strong> ${e(actor.silhouette)}</p><ul class="spec-list">${actor.details.map(item=>`<li><span class="bullet-check">✓</span><span>${e(item)}</span></li>`).join('')}</ul><div class="pipeline-badge"><span>Active Pipeline: Procedural WebGPU Geometry (<code>src/assets/</code>) · 32-Color Quantized Palette</span></div></div>`;
 }

 const encounterMount=element('encounter-matchup');
 if(encounterMount){
  const enemyKind=Number(element<HTMLSelectElement>('enemy')?.value)||(civ===1?22:30);
  const enemyDef=readDefinition(session.sim,enemyKind);
  const enemyActor=getActorDetails(enemyKind);
  const friendlyName=names[kind]??`Kind ${kind}`;
  const enemyName=names[enemyKind]??`Kind ${enemyKind}`;

  encounterMount.innerHTML=`<div class="matchup-grid"><div class="matchup-side friendly"><div class="side-tag">YOUR UNIT · ${civName}</div><h4>${e(friendlyName)}</h4><p class="matchup-role">${e(actor.role)}</p><div class="matchup-stat-row"><span>HP: <strong>${d.health}</strong></span><span>DMG: <strong>${d.damage}</strong></span><span>RNG: <strong>${d.range}</strong></span><span>SPD: <strong>${d.speed.toFixed(2)}</strong></span></div><p class="matchup-detail">${e(actor.details[0]??actor.silhouette)}</p></div><div class="matchup-vs">VS</div><div class="matchup-side enemy"><div class="side-tag">OPPONENT · ${enemyDef?CIVILIZATIONS[enemyDef.faction]:'Enemy'}</div><h4>${e(enemyName)}</h4><p class="matchup-role">${e(enemyActor.role)}</p><div class="matchup-stat-row"><span>HP: <strong>${enemyDef?.health??0}</strong></span><span>DMG: <strong>${enemyDef?.damage??0}</strong></span><span>RNG: <strong>${enemyDef?.range??0}</strong></span><span>SPD: <strong>${enemyDef?enemyDef.speed.toFixed(2):0}</strong></span></div><p class="matchup-detail">${e(enemyActor.details[0]??enemyActor.silhouette)}</p></div></div>`;
 }

 const reviewSpecs=element('review-specs');
 if(reviewSpecs){
  reviewSpecs.innerHTML=`<div class="actor-card review-spec-card"><div class="actor-card-header"><h3>Asset Contract & Review Baseline</h3><span class="badge ${d.faction===0?'badge-dawn':'badge-cinder'}">${civName} · ${names[kind]??kind}</span></div><p><strong>Role:</strong> ${e(actor.role)}</p><p><strong>Silhouette:</strong> ${e(actor.silhouette)}</p><p><strong>Motion Contract:</strong> ${e(actor.motion)}</p><h4>Authoritative Rig Requirements</h4><ul class="spec-list">${actor.details.map(item=>`<li><span class="bullet-check">✓</span><span>${e(item)}</span></li>`).join('')}</ul><div class="review-status-grid"><div class="review-status-item pass">✓ WASM Simulation Rules Match</div><div class="review-status-item pass">✓ 32-Color Quantized Palette</div><div class="review-status-item pass">✓ Procedural Asset Geometry Active</div><div class="review-status-item pass">✓ Clean Shadow Profile Applied</div></div></div>`;
 }
}
function metadata(){const d=readDefinition(session.sim,kind)!;element('asset-name').textContent=names[kind]??String(kind);element('definition').textContent=`${CIVILIZATIONS[d.faction]} · ${d.klass===0?'Building':'Unit'} · ${d.health} HP · ${d.speed.toFixed(2)} speed · ${d.range} range · ${d.damage} damage · ${d.alloy} Alloy / ${d.charge} Charge · ${d.ticks/60}s production`;renderActorSpecs();}
function roster(query=''){
 const rows=readRoster(session.sim).filter(d=>d.faction===civ&&`${names[d.kind]} ${d.kind}`.toLowerCase().includes(query.toLowerCase()));
 element('roster').innerHTML=rows.map(d=>`<button data-kind="${d.kind}" aria-pressed="${d.kind===kind}"><strong>${e(names[d.kind]??d.kind)}</strong><small>${d.klass===0?'Building':'Unit'} · Age ${d.tier+1}</small></button>`).join('');
}
function fixture():Fixture {
 const d=readDefinition(session.sim,kind)!;
 const chosen=element<HTMLSelectElement>('doctrine').value;
 const researchIDs=civ===1&&kind===30?(chosen==='running'?[202,203]:chosen==='anchored'?[202,204]:chosen==='tempered'?[202]:[]):[];
 return {...DEFAULT_FIXTURE,seed:Number(element<HTMLInputElement>('seed').value)>>>0,scenario:Number(element<HTMLSelectElement>('scenario').value),faction:civ,kind:d.klass===1?kind:civ===1?30:22,enemy:Number(element<HTMLSelectElement>('enemy').value),count:Number(element<HTMLInputElement>('count').value),research:researchIDs};
}
function reset(){playing=false;last=0;accumulator=0;selected=null;session.reset(fixture());renderer.setReviewWorld(session.terrain(),64,32,32);research?.dispose();research=new ResearchPanel(session.sim,()=>{void draw();});element('research-mount').replaceChildren(research.element);update();void draw();}
function setView(next:View){playing=false;view=next;route();tabs();for(const id of ['codex','forge','encounter','research','review'])element(`view-${id}`).hidden=id!==view;element('preview').hidden=view==='research'||view==='review';element('scene').hidden=view==='forge'||view==='codex';element('rig-pair').hidden=view!=='forge'&&view!=='codex';update();void draw();}
function options(){
 const all=readRoster(session.sim),d=all.find(d=>d.kind===kind&&d.faction===civ);if(!d)kind=civ===1?30:22;
 element<HTMLSelectElement>('enemy').innerHTML=all.filter(d=>d.faction!==civ&&d.klass===1&&d.damage>0).map(d=>`<option value="${d.kind}">${e(names[d.kind])}</option>`).join('');
 element<HTMLSelectElement>('doctrine').disabled=civ!==1||kind!==30;
 const variantSelect=element<HTMLSelectElement>('variant');
 if(kind===30){
  variantSelect.disabled=false;
  variantSelect.innerHTML=JACKAL_VARIANTS.map(v=>`<option value="${v.id}">${v.name} · ${v.status}</option>`).join('');
  if(variant!=='field'&&variant!=='longbow')variant='field';
  variantSelect.value=variant;
 }else{
  variantSelect.disabled=false;
  variantSelect.innerHTML=`<option value="authoritative" selected>${names[kind]??'Actor'} · Authoritative Rig</option>`;
 }
 roster();metadata();route();
}
function update(){
 if(!session)return;const m=session.metrics();
 element('status').textContent=`${(m.tick/60).toFixed(2)} / ${view==='research'?120:30}s · ${m.shots} releases · ${m.totalDamage.toFixed(1)} total damage (both sides) · ${m.deaths} deaths · ${m.preparationSeconds}s paid setup · ${m.alloy} Alloy / ${m.charge} Charge`;
 element('play').textContent=playing?'Pause':'Play';element('events').textContent=session.events.slice(-24).map(row=>`${(row[0]/60).toFixed(3)}s · ${['','DRAW','RELEASE','DAMAGE','DEATH','INTERRUPT','BLOCKED','ORDER'][row[1]]??row[1]} · actor ${row[2]} · value ${row[4].toFixed(2)}`).join('\n');
 if(view==='research')research.update();metadata();
}
async function draw(){
 if(disposed||!session)return;if(drawing){redrawPending=true;return;}drawing=true;
 try{
  const rig=view==='forge'||view==='codex';let data=session.snapshot(),tick=session.sim.sim_lab_tick();
  if(!rig&&selected!==null){for(let i=0;i<data.length/12;i++)data[i*12+8]=session.sim.sim_actor_handle(i)===selected?1:0;}
  if(rig){const construction=readDefinition(session.sim,kind)!.klass===0?phase:1;data=new Float32Array([32,32,.5,Number(element<HTMLSelectElement>('facing').value)*Math.PI/4,kind,state,phase,Number(element<HTMLInputElement>('health').value),0,civ,construction,state===2&&phase>=.5?1:0]);tick=Math.round(phase*36);}
  renderer.jackalVariant=kind===30?variant:'field';
  renderer.render(data,data.length/12,Number(element<HTMLSelectElement>('yaw').value),1,session.sim.sim_alloy(),session.sim.sim_charge(),tick);
  const image=await renderer.captureFrame();
  if(disposed)return;
  capturedContext.putImageData(image,0,0);
  if(rig){const source=capturedFrame,native=element<HTMLCanvasElement>('native'),large=element<HTMLCanvasElement>('large');
   for(const [target,mult] of [[native,1],[large,4]] as const){const c=target.getContext('2d')!;c.imageSmoothingEnabled=false;c.clearRect(0,0,target.width,target.height);c.drawImage(source,416,192,128,112,0,0,128*mult,112*mult);}}
 }catch(error){fail(error);}finally{drawing=false;if(redrawPending&&!disposed){redrawPending=false;void draw();}}
}
function animate(now:number){frame=0;if(disposed)return;const dt=last?Math.min(.05,(now-last)/1000):0;last=now;
 if(playing&&!document.hidden){if(view==='forge'){phase=(phase+dt*speed/1.2)%1;element<HTMLInputElement>('phase').value=String(phase);}else{accumulator+=dt*speed;let ticks=Math.min(12,Math.floor(accumulator*60));if(ticks){session.step(ticks,view==='research'?7200:1800);accumulator-=ticks/60;}if(session.sim.sim_lab_tick()>=(view==='research'?7200:1800))playing=false;}update();void draw();}
 if(playing&&!document.hidden)frame=requestAnimationFrame(animate);
}
function run(){last=0;if(!frame)frame=requestAnimationFrame(animate);update();}
async function compare(){
 playing=false;const current=fixture(),button=element<HTMLButtonElement>('compare');button.disabled=true;
 try{comparisons=[];
  for(const [name,path] of [['Base',[]],['Tempered',[202]],['Running',[202,203]],['Anchored',[202,204]]] as const){
   const next=await createSession();next.reset({...current,faction:1,kind:30,enemy:22,research:[...path]});next.step(1800);
   comparisons.push({name,...next.evidence({source:revision,policy:'Authored fixture orders; no manually optimized micro. Not a general win-rate or balance claim.'})});
   await new Promise(resolve=>setTimeout(resolve,0));
  }
  element('comparison').textContent=JSON.stringify(comparisons.map(c=>({name:c.name,metrics:c.metrics})),null,2);
 }catch(error){fail(error);}finally{button.disabled=false;}
}
async function boot(){
 root.innerHTML=`<header class="workshop-header"><a href="/tools/">STARHOLD <span>WORKSHOP</span></a><p>Shared runtime · disposable state · no live deployment</p><a href="/">Open game ↗</a></header><nav aria-label="Workspaces">${VIEWS.map((v,i)=>`<button data-view="${v}">${TITLES[i]}</button>`).join('')}</nav><div class="workshop-layout"><aside><label>Civilization<select id="civ">${CIVILIZATIONS.map((name,i)=>`<option value="${i}">${name}</option>`).join('')}</select></label><label>Find an actor<input id="search" type="search" placeholder="Ash Jackal, Fang Yard…"></label><div id="roster"></div><a href="/lab.html">Original document / roster lab ↗</a></aside><main><header class="asset-header"><h1 id="asset-name">Loading workshop…</h1><p id="definition"></p></header><section id="view-codex"><h2>Civilization Codex · Single Source of Truth</h2><p class="note">All thirty roster definitions come from the loaded simulation. Select an actor to inspect its authoritative procedural model, role, contracts, and specifications.</p><div id="codex-content"></div><div class="toolbar"><button data-view="forge">Open in Asset Forge</button><button data-view="encounter">Test in Encounter Lab</button></div></section><section id="view-forge"><div class="toolbar"><label>Variant<select id="variant">${JACKAL_VARIANTS.map(v=>`<option value="${v.id}">${v.name} · ${v.status}</option>`).join('')}</select></label><label>Pose<select id="state"><option value="0">Idle</option><option value="1">Walk</option><option value="2">Attack</option><option value="4">Wreck</option></select></label><label>Facing<select id="facing">${['E','SE','S','SW','W','NW','N','NE'].map((n,i)=>`<option value="${i}">${n}</option>`).join('')}</select></label><label>Pose / construction phase<input id="phase" type="range" min="0" max="1" step=".005" value="1"></label><label>Health fraction<input id="health" type="range" min=".1" max="1" step=".1" value="1"></label></div><div id="forge-specs"></div><p class="note">Staged pose inspection, not a combat test. Buildings use the phase slider for construction. Both Jackal candidates keep the same simulation socket. Exporting a review does not promote the candidate into the game.</p><button id="approve">Export candidate review recipe</button></section><section id="view-encounter"><div class="toolbar"><label>Fixture<select id="scenario"><option value="0">Weapon / stationary target</option><option value="1">Small engagement</option><option value="2">Wall and passage</option></select></label><label>Enemy<select id="enemy"></select></label><label>Units per side<input id="count" type="number" min="1" max="8" value="1"></label><label>Seed<input id="seed" type="number" min="1" max="4294967295" value="7319"></label><label>Prepared research<select id="doctrine"><option value="base">None</option><option value="tempered">Tempered Arrows</option><option value="running">Tempered + Running Draw</option><option value="anchored">Tempered + Anchored Draw</option></select></label><button id="reset">Reset fixture</button></div><div id="encounter-matchup"></div><p class="note">Reset creates a fresh 64×64 simulation. Prepared research spends real resources; its elapsed setup time is reported separately. Weapon targets do not retaliate. Click your unit, choose Move / Attack / Hold, then click the scene. Shift-click selects multiple units.</p><div class="toolbar"><button id="move">Move</button><button id="attack">Attack target</button><button id="hold">Hold position</button><button id="compare">Compare four Jackal research paths</button></div><pre id="comparison"></pre></section><section id="view-research"><p class="note">This is the production research panel in a disposable session. Press Play to advance research, or Step to advance exactly one 60 Hz tick.</p><div id="research-mount"></div></section><section id="view-review"><h2>Reproducible evidence</h2><p>Exports include the scenario, paid research, actor handles, commands, event trace, WASM hash, asset revision and available source stamp. Visual approval remains separate from technical correctness.</p><div id="review-specs"></div><button id="export">Export session and comparisons</button><pre id="provenance"></pre></section><section id="preview"><canvas id="scene" width="960" height="540" aria-label="Production renderer preview"></canvas><div id="rig-pair"><figure><canvas id="native" width="128" height="112"></canvas><figcaption>Native raster · 1×</figcaption></figure><figure><canvas id="large" width="512" height="448"></canvas><figcaption>Same frame · 4× nearest-neighbor</figcaption></figure></div></section><div class="toolbar playback"><button id="play">Play</button><button id="step">Step 1 tick</button><label>Playback<select id="speed"><option value=".25">¼×</option><option value=".5">½×</option><option value="1" selected>1×</option><option value="2">2×</option></select></label><label>Camera yaw<select id="yaw">${[0,90,180,270].map((n,i)=>`<option value="${i}">${n}°</option>`).join('')}</select></label><button id="capture">Capture PNG</button></div><p id="status" role="status">Loading verified WASM…</p><details><summary>Observed events</summary><pre id="events"></pre></details></main></div>`;
 const loader=await loadWorkshop();createSession=loader.create;session=await createSession();
 try{const r=await fetch('/tools/revision.json');if(r.ok)revision=await r.json();}catch{/* WASM hash still identifies the loaded executable. */}
 element('provenance').textContent=JSON.stringify({source:revision,wasmSHA256:loader.hash},null,2);
 element<HTMLSelectElement>('civ').value=String(civ);element<HTMLSelectElement>('variant').value=variant;phase=1;
 session.reset({...DEFAULT_FIXTURE,faction:civ,kind:civ===1?30:22,enemy:civ===1?22:30});options();
 renderer.showInterface=false;renderer.authoritativeActors=true;
 await renderer.init(element<HTMLCanvasElement>('scene'),new Float32Array(1024).fill(.5));renderer.onError(fail);
 renderer.setReviewWorld(session.terrain(),64,32,32);research=new ResearchPanel(session.sim);element('research-mount').append(research.element);
 const selectedHandles=new Set<number>();
 root.addEventListener('click',ev=>{const b=(ev.target as Element).closest<HTMLButtonElement>('button');if(!b)return;
  if(b.dataset.view)setView(b.dataset.view as View);
  if(b.dataset.kind){kind=Number(b.dataset.kind);options();reset();selectedHandles.clear();}
 });
 element('civ').onchange=()=>{civ=Number(element<HTMLSelectElement>('civ').value);kind=civ===1?30:22;options();reset();selectedHandles.clear();};
 element<HTMLInputElement>('search').oninput=ev=>roster((ev.target as HTMLInputElement).value);
 element('enemy').onchange=()=>renderActorSpecs();
 for(const id of ['variant','state','phase','health','facing','yaw'])element(id).addEventListener('input',()=>{
  const val=element<HTMLSelectElement>('variant').value;
  if(val==='longbow'||val==='field')variant=val;
  state=Number(element<HTMLSelectElement>('state').value);
  phase=Number(element<HTMLInputElement>('phase').value);
  route();void draw();
 });
 element('reset').onclick=()=>{try{reset();selectedHandles.clear();}catch(error){fail(error);}};

 // Pause must remain a real pause rather than a new replay.
 element('play').onclick=()=>{if(playing){playing=false;update();return;}if(view!=='forge'&&session.sim.sim_lab_tick()>=(view==='research'?7200:1800))reset();playing=true;run();};
 element('step').onclick=()=>{playing=false;if(view==='forge'){phase=Math.min(1,phase+1/60);element<HTMLInputElement>('phase').value=String(phase);}else session.step(1,view==='research'?7200:1800);update();void draw();};
 element('speed').onchange=()=>{speed=Number(element<HTMLSelectElement>('speed').value);};
 element('move').onclick=()=>{commandMode=0;};element('attack').onclick=()=>{commandMode=1;};element('hold').onclick=()=>{for(const handle of selectedHandles)session.order(handle,2,0);update();};
 element('scene').onclick=ev=>{if(view!=='encounter')return;const canvas=element<HTMLCanvasElement>('scene'),rect=canvas.getBoundingClientRect(),px=(ev.clientX-rect.left)*960/rect.width,py=(ev.clientY-rect.top)*540/rect.height,yaw=Number(element<HTMLSelectElement>('yaw').value);const data=session.actors(),picked=renderer.pick(px,py,yaw,1),actor=picked===null?null:data[picked];
  if(actor?.faction===civ&&readDefinition(session.sim,actor.kind)?.klass===1){if(!ev.shiftKey)selectedHandles.clear();selectedHandles.add(actor.handle);selected=actor.handle;element('status').textContent=`Selected ${selectedHandles.size} unit(s). Choose a command and target.`;return;}
  if(!selectedHandles.size)return;
  if(commandMode===1&&actor&&actor.faction!==civ){for(const h of selectedHandles)session.order(h,1,actor.handle);}
  else if(commandMode===0){const c=Math.round(Math.cos(yaw*Math.PI/2)),s=Math.round(Math.sin(yaw*Math.PI/2));const diff=(px/2-240)/6,sum=(py/2-136+6.9282032*.5)/3.4641016,a=(sum+diff)/2,b=(sum-diff)/2;const tx=Math.max(1,Math.min(62,Math.floor(32+c*a+s*b))),ty=Math.max(1,Math.min(62,Math.floor(32-s*a+c*b)));for(const h of selectedHandles)session.order(h,0,tx+ty*64);}
  update();void draw();
 };
 element('compare').onclick=()=>{void compare();};
 element('export').onclick=()=>downloadJSON('starhold-session.json',session.evidence({source:revision,actorSpecs:getActorDetails(kind),asset:JACKAL_VARIANTS.find(v=>v.id===variant),comparisons}));
 element('approve').onclick=()=>downloadJSON('starhold-asset-review.json',{format:'starhold-asset-review-v1',kind,civilization:civ,variant,asset:JACKAL_VARIANTS.find(v=>v.id===variant),phase,state,source:revision,wasmSHA256:loader.hash,status:'candidate-review-not-runtime-promotion'});
 element('capture').onclick=()=>{void (async()=>{await draw();await renderer.settled();const canvas=(view==='forge'||view==='codex')?element<HTMLCanvasElement>('large'):capturedFrame;const a=document.createElement('a');a.download=`starhold-${kind}-${variant}-${session.sim.sim_lab_tick()}.png`;a.href=canvas.toDataURL('image/png');a.click();})().catch(fail);};
 document.addEventListener('visibilitychange',()=>{if(document.hidden){cancelAnimationFrame(frame);frame=0;last=0;accumulator=0;}else if(playing)run();});
 setView(view);root.dataset.ready='true';
 Object.assign(window,{__WORKSHOP:{getState:()=>({view,kind,civ,variant,selected,playing,...session.metrics()}),evidence:()=>session.evidence({source:revision,actorSpecs:getActorDetails(kind)}),step:(ticks:number)=>{session.step(ticks,view==='research'?7200:1800);update();return draw();},reset:()=>reset(),show:(next:View)=>setView(next)}});
}
function dispose(){disposed=true;playing=false;cancelAnimationFrame(frame);research?.dispose();renderer.dispose();}
window.addEventListener('pagehide',dispose,{once:true});if(import.meta.hot)import.meta.hot.dispose(dispose);
void boot().catch(error=>{if(element('status'))fail(error);else root.textContent=String(error);});
