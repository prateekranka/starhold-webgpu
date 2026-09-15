import './style.css';
import {Renderer, RENDER_WIDTH, RENDER_HEIGHT, buttonGlyphPixels} from './renderer';
import {State, names, jobs} from './kinds';
import {Hud, HQ_POP_CAP, isBuildingKind, isUnitKind, type HudView, type SimAbi} from './hud';
/** Frozen ABI plus the wave-2 additions (docs/MATCH_SPEC.md §2). */
type SimExports = SimAbi & WebAssembly.Exports;
interface App {
 ready:boolean;error:string|null;
 getState():{touch:boolean;yawSteps:number;zoom:number;selected:number|null;entityCount:number;fps:number|null;frameStats:{drawCalls:number;triangles:number}|null;
  mode:number;player:number;age:number;ageProgress:number;popUsed:number;popCap:number;alloy:number;charge:number;selectedKind:number|null;actions:number[]};
 rotate(dir:1|-1):void;zoomBy(delta:1|-1):void;selectAt(x:number,y:number):void;fastForward(seconds:number):void;
 startMatch(faction:0|1):void;resetShowcase():void;command(op:number,a:number,b:number):number;
 selectEntity(index:number):boolean;selectKind(kind:number):boolean;
 /** Distinct entity kinds in the current snapshot (read-only coverage probe). */
 kinds():number[];
}
declare global {interface Window {__APP:App}}
let yawSteps=0,zoomIndex=1,sim:SimExports|undefined,entities=new Float32Array(0),entityCount=0,selected:number|null=null,fps:number|null=null;
let seed=73129;
const zooms=[4/3,1,4/5,2/3];
const renderer=new Renderer();
const touchLayout=navigator.maxTouchPoints>0||matchMedia('(pointer: coarse)').matches;
document.body.classList.add(touchLayout?'touch':'mouse');
renderer.hudButtons=!touchLayout;
const hud=new Hud({command:(op,a,b)=>command(op,a,b),build:(kind)=>buildNearest(kind),startMatch:(faction)=>startMatch(faction),resetShowcase:()=>resetShowcase()});
function rotate(dir:1|-1) {yawSteps=(yawSteps+(dir===-1?-1:1)+4)%4;}
function zoomBy(delta:1|-1) {zoomIndex=Math.max(0,Math.min(3,zoomIndex+(delta===-1?-1:1)));}
function selectAt(x:number,y:number) {
 if(!sim||!window.__APP.ready)return;
 const rect=canvas.getBoundingClientRect();
 if(x<rect.left||y<rect.top||x>=rect.right||y>=rect.bottom)return;
 selected=renderer.pick((x-rect.left)*RENDER_WIDTH/rect.width,(y-rect.top)*RENDER_HEIGHT/rect.height,yawSteps,zooms[zoomIndex]);
 sim.sim_select(selected??-1);refreshEntities();updateSelection();syncHud();
}
function fastForward(seconds:number) {
 if(!sim||!Number.isFinite(seconds)||seconds<=0)return;
 const steps=Math.round(seconds*60);
 for(let i=0;i<steps;i++){sim.sim_step(1000/60);tick++;}
 accumulator=0;previous=0;refreshEntities();updateSelection();syncHud();
}
// ---- match mode (docs/MATCH_SPEC.md §10) ------------------------------------
/** True when the loaded wasm exports the wave-2 match ABI. */
function matchAbi():boolean {
 const s=sim;
 return !!s&&typeof s.sim_match_init==='function'&&typeof s.sim_mode==='function'&&typeof s.sim_player==='function'&&
  typeof s.sim_age==='function'&&typeof s.sim_age_progress==='function'&&typeof s.sim_command==='function'&&
  typeof s.sim_roster_count==='function'&&typeof s.sim_roster_ptr==='function'&&
  typeof s.sim_pop_used==='function'&&typeof s.sim_pop_cap==='function';
}
function simMode():number {const s=sim;return s&&typeof s.sim_mode==='function'?s.sim_mode()>>>0:0;}
function simPlayer():number {const s=sim;return s&&typeof s.sim_player==='function'?(s.sim_player()===1?1:0):0;}
function simAge():number {const s=sim;return s&&typeof s.sim_age==='function'?s.sim_age()>>>0:0;}
function simAgeProgress():number {const s=sim;const value=s&&typeof s.sim_age_progress==='function'?s.sim_age_progress():1;return Number.isFinite(value)?Math.max(0,Math.min(1,value)):1;}
function simAgeCost():number {const s=sim;return s&&typeof s.sim_age_cost==='function'?s.sim_age_cost()>>>0:0;}
function simAgeCostCharge():number {const s=sim;return s&&typeof s.sim_age_cost_charge==='function'?s.sim_age_cost_charge()>>>0:0;}
function simPopCap():number {const s=sim;return s&&typeof s.sim_pop_cap==='function'?s.sim_pop_cap()>>>0:HQ_POP_CAP;}
/** Live units, used only when the wasm build has no sim_pop_used. */
function simPopUsed():number {
 const s=sim;
 if(s&&typeof s.sim_pop_used==='function')return s.sim_pop_used()>>>0;
 let used=0;
 for(let i=0;i<entityCount;i++)if(isUnitKind(entities[i*12+4])&&entities[i*12+5]!==State.Death)used++;
 return used;
}
const clampTile=(value:number)=>Math.max(0,Math.min(31,Math.floor(value)||0));
const tileOf=(x:number,y:number)=>clampTile(x)+clampTile(y)*32;
function currentKind():number|null {return selected===null||selected*12+4>=entities.length?null:entities[selected*12+4];}
/** Terrain height at a tile, from the sim's 32x32 grid (0 void, 0.5/1 land). */
function terrainAt(tile:number):number {
 if(!sim)return 0;
 const pointer=sim.sim_terrain_ptr();
 if(!pointer||tile<0||tile>1023)return 0;
 return new Float32Array(sim.memory.buffer,pointer,1024)[tile];
}
function tileOccupied(tile:number,ignore:number):boolean {
 for(let i=0;i<entityCount;i++){if(i===ignore)continue;if(tileOf(entities[i*12],entities[i*12+1])===tile)return true;}
 return false;
}
/** Placement tile for a build command: the selection's own tile when it is
 *  clear, else the nearest free land tile around it. */
function buildTile():number {
 if(selected===null||selected*12+4>entities.length)return 0;
 const x=Math.floor(entities[selected*12]),y=Math.floor(entities[selected*12+1]);
 const spots:[number,number][]=[[0,0],[1,0],[0,1],[-1,0],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]];
 const tiles:number[]=[];
 for(const [dx,dy] of spots){const tile=tileOf(x+dx,y+dy);if(!tiles.includes(tile))tiles.push(tile);}
 for(const tile of tiles)if(terrainAt(tile)>0&&!tileOccupied(tile,selected))return tile;
 for(const tile of tiles)if(!tileOccupied(tile,selected))return tile;
 return tileOf(x,y);
}
const view:HudView={ready:false,match:false,mode:0,player:0,age:0,ageProgress:1,ageCost:0,ageCostCharge:0,alloy:0,charge:0,popUsed:0,popCap:0,selected:null,selectedKind:null,selectedState:-1,tile:0};
/** Push the current sim/selection state into the DOM bar. The view object is
 *  reused, so the bar never allocates per frame. */
function syncHud() {
 view.ready=window.__APP.ready;
 view.match=matchAbi();
 view.mode=simMode();
 view.player=simPlayer();
 view.age=simAge();
 view.ageProgress=simAgeProgress();
 view.ageCost=simAgeCost();
 view.ageCostCharge=simAgeCostCharge();
 view.alloy=sim?sim.sim_alloy():0;
 view.charge=sim?sim.sim_charge():0;
 view.popUsed=simPopUsed();
 view.popCap=simPopCap();
 view.selected=selected;
 view.selectedKind=currentKind();
 view.selectedState=selected===null||selected*12+5>=entities.length?-1:entities[selected*12+5];
 view.tile=buildTile();
 hud.update(sim,view);
}
function startMatch(faction:0|1) {
 if(!sim||typeof sim.sim_match_init!=='function')return;
 sim.sim_match_init(seed>>>0,faction===1?1:0);
 resetClock();selectDefault();
}
function resetShowcase() {
 if(!sim)return;
 sim.sim_init(seed>>>0);
 resetClock();selectDefault();
}
function command(op:number,a:number,b:number):number {
 if(!sim||typeof sim.sim_command!=='function')return 0;
 const accepted=sim.sim_command(op>>>0,a>>>0,b>>>0);
 refreshEntities();updateSelection();syncHud();
 return accepted?1:0;
}
/** Place one HUD-requested building on the nearest simulation-approved tile.
 * Rejected probes are side-effect-free in the frozen command ABI; Rust remains
 * authoritative for full footprints, level terrain, bounds, and collisions. */
function buildNearest(kind:number):number {
 if(!sim||typeof sim.sim_command!=='function'||selected===null)return 0;
 const sx=entities[selected*12],sy=entities[selected*12+1];
 const tiles:number[]=[];
 for(let tile=0;tile<1024;tile++){
  if(terrainAt(tile)<=0||tileOccupied(tile,selected))continue;
  tiles.push(tile);
 }
 tiles.sort((a,b)=>{
  const ax=a%32+.5-sx,ay=Math.floor(a/32)+.5-sy;
  const bx=b%32+.5-sx,by=Math.floor(b/32)+.5-sy;
  return ax*ax+ay*ay-(bx*bx+by*by)||a-b;
 });
 let accepted=0;
 for(const tile of tiles)if(sim.sim_command(1,kind>>>0,tile)!==0){accepted=1;break;}
 refreshEntities();updateSelection();syncHud();
 return accepted;
}
function resetClock() {accumulator=0;previous=0;tick=0;refreshEntities();updateSelection();syncHud();}
/** Keep a playable selection when the sim starts a mode without one. */
function selectDefault() {
 if(!sim)return;
 for(let i=0;i<entityCount;i++)if(entities[i*12+8]===1)return;
 for(let i=0;i<entityCount;i++){
  const kind=entities[i*12+4],state=entities[i*12+5];
  if(isBuildingKind(kind)&&state!==State.Construct&&state!==State.Death){sim.sim_select(i);refreshEntities();syncHud();return;}
 }
}
function selectEntity(index:number):boolean {
 if(!sim||!Number.isInteger(index)||index<0||index>=entityCount)return false;
 sim.sim_select(index);refreshEntities();updateSelection();syncHud();
 return selected===index;
}
function selectKind(kind:number):boolean {
 if(!sim)return false;
 let spare=-1;
 for(let i=0;i<entityCount;i++){
  if(entities[i*12+4]!==kind)continue;
  const state=entities[i*12+5];
  if(state!==State.Death&&state!==State.Construct)return selectEntity(i);
  if(spare<0)spare=i;
 }
 return spare<0?false:selectEntity(spare);
}
/** Distinct kinds present in the current snapshot. Read-only; used by the
 *  orchestrator's coverage probe and safe to call at any time. */
function kinds():number[] {
 const out:number[]=[];
 for(let i=0;i<entityCount;i++){const k=entities[i*12+4];if(!out.includes(k))out.push(k);}
 return out.sort((a,b)=>a-b);
}
window.__APP={ready:false,error:null,getState:()=>({touch:touchLayout,yawSteps,zoom:zooms[zoomIndex],selected,entityCount,fps,frameStats:window.__APP.ready?renderer.stats:null,
 mode:simMode(),player:simPlayer(),age:simAge(),ageProgress:simAgeProgress(),popUsed:simPopUsed(),popCap:simPopCap(),
 alloy:sim?sim.sim_alloy():0,charge:sim?sim.sim_charge():0,selectedKind:currentKind(),actions:hud.actions()}),rotate,zoomBy,selectAt,fastForward,startMatch,resetShowcase,command,selectEntity,selectKind,kinds};
const canvas=document.querySelector<HTMLCanvasElement>('#world')!;
const viewport=document.querySelector<HTMLElement>('#viewport')!;
const selection=document.querySelector<HTMLOutputElement>('#selection')!;
function fatal(error:unknown) {if(window.__APP.error)return;window.__APP.error=error instanceof Error?error.message:String(error);const overlay=document.querySelector<HTMLElement>('#error')!;overlay.textContent=window.__APP.error;overlay.hidden=false;}
/** The height the bar reserves at the bottom, shared with the body padding. */
function hudHeight():number {
 const value=parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--hud-h'));
 if(Number.isFinite(value)&&value>0)return value;
 const bar=document.getElementById('hud-bar');
 return bar?bar.getBoundingClientRect().height:0;
}
function resize() {
 const read=(name:string)=>parseFloat(getComputedStyle(document.documentElement).getPropertyValue(name))||0;
 const availW=innerWidth-read('--safe-l')-read('--safe-r');
 const availH=innerHeight-read('--safe-t')-read('--safe-b')-hudHeight();
 const fit=Math.min(availW/RENDER_WIDTH,availH/RENDER_HEIGHT);
 const scale=fit>=1?Math.floor(fit):Math.max(0.1,fit);
 viewport.style.width=`${RENDER_WIDTH*scale}px`;viewport.style.height=`${RENDER_HEIGHT*scale}px`;
}
window.addEventListener('resize',resize);
window.addEventListener('orientationchange',resize);resize();
for(const [kind,id] of ['rotate-left','rotate-right','zoom-out','zoom-in'].entries()){
 const glyph=document.querySelector<HTMLCanvasElement>(`#${id} canvas.glyph`)!;
 const context=glyph.getContext('2d')!;
 context.imageSmoothingEnabled=false;context.fillStyle='#F3F0D7';
 const pixels=buttonGlyphPixels(kind);
 for(let p=0;p<pixels.length;p++)if(pixels[p])context.fillRect(1+p%10,1+Math.floor(p/10),1,1);
}
document.getElementById('rotate-left')!.addEventListener('click',()=>rotate(-1));
document.getElementById('rotate-right')!.addEventListener('click',()=>rotate(1));
document.getElementById('zoom-out')!.addEventListener('click',()=>zoomBy(-1));
document.getElementById('zoom-in')!.addEventListener('click',()=>zoomBy(1));
canvas.addEventListener('click',e=>selectAt(e.clientX,e.clientY));
const activePointers=new Map<number,{x:number;y:number}>();
let downX=0,downY=0,downAt=0,pinched=false,pinchStartDist=0,pinchStartZoom=0;
let suppressPointerClick=false;
function resetGesture() {
 pinched=false;pinchStartDist=0;pinchStartZoom=0;downX=0;downY=0;downAt=0;
}
function pointerDistance() {
 const points=activePointers.values(),a=points.next().value!,b=points.next().value!;
 return Math.hypot(a.x-b.x,a.y-b.y);
}
canvas.addEventListener('pointerdown',e=>{
 suppressPointerClick=e.pointerType!=='mouse';
 if(e.pointerType==='mouse')return;
 e.preventDefault();
 if(activePointers.size===0){resetGesture();downX=e.clientX;downY=e.clientY;downAt=e.timeStamp;}
 activePointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
 canvas.setPointerCapture(e.pointerId);
 if(activePointers.size===2){
  pinched=true;pinchStartZoom=zoomIndex;
  const distance=pointerDistance();pinchStartDist=distance<20?0:distance;
 }
});
canvas.addEventListener('pointermove',e=>{
 const point=activePointers.get(e.pointerId);
 if(e.pointerType==='mouse'||!point)return;
 e.preventDefault();point.x=e.clientX;point.y=e.clientY;
 if(activePointers.size===2&&pinched&&pinchStartDist>=20){
  const ratio=pointerDistance()/pinchStartDist;
  const steps=Math.round(Math.log(ratio)/Math.log(1.4));
  zoomIndex=Math.max(0,Math.min(3,pinchStartZoom+steps));
 }
});
canvas.addEventListener('pointerup',e=>{
 if(e.pointerType==='mouse'||!activePointers.has(e.pointerId))return;
 e.preventDefault();
 if(activePointers.size===1&&!pinched&&Math.hypot(e.clientX-downX,e.clientY-downY)<=12&&e.timeStamp-downAt<=400)selectAt(e.clientX,e.clientY);
 activePointers.delete(e.pointerId);
 if(canvas.hasPointerCapture(e.pointerId))canvas.releasePointerCapture(e.pointerId);
 if(activePointers.size===0)resetGesture();
});
canvas.addEventListener('pointercancel',e=>{
 if(e.pointerType==='mouse')return;
 for(const id of activePointers.keys())if(canvas.hasPointerCapture(id))canvas.releasePointerCapture(id);
 activePointers.clear();resetGesture();
});
// Keep the existing mouse click path, but stop compatibility clicks from
// selecting a second time after taps or selecting at the end of a pinch.
canvas.addEventListener('click',e=>{
 const pointer=e as PointerEvent;
 if((pointer.pointerType&&pointer.pointerType!=='mouse')||suppressPointerClick){e.preventDefault();e.stopImmediatePropagation();}
},true);
function refreshEntities() {
 if(!sim)return;entityCount=sim.sim_entity_count();const pointer=sim.sim_entity_ptr();
 // Reuse the direct linear-memory view until the pointer/count or buffer changes.
 if(entities.buffer!==sim.memory.buffer||entities.byteOffset!==pointer)entities=new Float32Array(sim.memory.buffer,pointer);
 selected=null;for(let i=0;i<entityCount;i++)if(entities[i*12+8]===1){selected=i;break;}
}
let lastSelection=-2,lastHealth=-1,lastJob=-1,lastProgress=-1;
function updateSelection() {const o=selected===null?-1:selected*12;const hp=o<0?0:Math.round(entities[o+7]*100),job=o<0?-1:entities[o+5],progress=o<0?-1:Math.floor(entities[o+10]*100);if(lastSelection===(selected??-1)&&lastHealth===hp&&lastJob===job&&lastProgress===progress)return;lastSelection=selected??-1;lastHealth=hp;lastJob=job;lastProgress=progress;selection.hidden=o<0;selection.textContent=o<0?'':`${names[entities[o+4]]} — HP ${hp}% — ${jobs[job]}${job===5?` ${progress}%`:""}`;}
let previous=0,accumulator=0,windowStart=0,frames=0,tick=0;
function frame(now:number) {
 if(window.__APP.error||!sim)return;
 try {
  if(previous===0){previous=now;windowStart=now;}
  accumulator+=Math.min(now-previous,250);previous=now;
  while(accumulator>=1000/60){sim.sim_step(1000/60);tick++;accumulator-=1000/60;}
  refreshEntities();updateSelection();syncHud();
  renderer.render(entities,entityCount,yawSteps,zooms[zoomIndex],sim.sim_alloy(),sim.sim_charge(),tick);
  frames++;if(now-windowStart>=1000){fps=frames*1000/(now-windowStart);frames=0;windowStart=now;}
  window.__APP.ready=true;requestAnimationFrame(frame);
 }catch(error){fatal(error);}
}
// Hidden time does not produce a giant catch-up burst or alter the tick size.
document.addEventListener('visibilitychange',()=>{previous=0;accumulator=0;});
async function boot() {
 if(!navigator.gpu)throw new Error('WebGPU is unavailable. Starhold requires a WebGPU-capable browser with hardware acceleration enabled.');
 const result=await WebAssembly.instantiateStreaming(fetch('/sim.wasm'),{});sim=result.instance.exports as SimExports;
 if(sim.sim_entity_stride()!==12)throw new Error('Simulation ABI mismatch: expected 12 floats per entity.');
 const value=new URLSearchParams(location.search).get('seed');const requested=value===null?73129:Number(value);seed=Number.isFinite(requested)?requested>>>0:73129;sim.sim_init(seed);refreshEntities();
 syncHud();
 await renderer.init(canvas,new Float32Array(sim.memory.buffer,sim.sim_terrain_ptr(),1024));renderer.onError(fatal);requestAnimationFrame(frame);
}
void boot().catch(fatal);
