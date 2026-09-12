import './style.css';
import {Renderer, RENDER_WIDTH, RENDER_HEIGHT, buttonGlyphPixels} from './renderer';
import {names, jobs} from './kinds';
interface SimExports extends WebAssembly.Exports {
 memory:WebAssembly.Memory;
 sim_init(seed:number):void;sim_step(dt:number):void;
 sim_entity_count():number;sim_entity_ptr():number;sim_entity_stride():number;
 sim_select(index:number):void;sim_terrain_ptr():number;sim_alloy():number;sim_charge():number;
}
interface App {
 ready:boolean;error:string|null;
 getState():{touch:boolean;yawSteps:number;zoom:number;selected:number|null;entityCount:number;fps:number|null;frameStats:{drawCalls:number;triangles:number}|null};
 rotate(dir:1|-1):void;zoomBy(delta:1|-1):void;selectAt(x:number,y:number):void;fastForward(seconds:number):void;
}
declare global {interface Window {__APP:App}}
let yawSteps=0,zoomIndex=1,sim:SimExports|undefined,entities=new Float32Array(0),entityCount=0,selected:number|null=null,fps:number|null=null;
const zooms=[4/3,1,4/5,2/3];
const renderer=new Renderer();
const touchLayout=navigator.maxTouchPoints>0||matchMedia('(pointer: coarse)').matches;
document.body.classList.add(touchLayout?'touch':'mouse');
renderer.hudButtons=!touchLayout;
function rotate(dir:1|-1) {yawSteps=(yawSteps+(dir===-1?-1:1)+4)%4;}
function zoomBy(delta:1|-1) {zoomIndex=Math.max(0,Math.min(3,zoomIndex+(delta===-1?-1:1)));}
function selectAt(x:number,y:number) {
 if(!sim||!window.__APP.ready)return;
 const rect=canvas.getBoundingClientRect();
 if(x<rect.left||y<rect.top||x>=rect.right||y>=rect.bottom)return;
 selected=renderer.pick((x-rect.left)*RENDER_WIDTH/rect.width,(y-rect.top)*RENDER_HEIGHT/rect.height,yawSteps,zooms[zoomIndex]);
 sim.sim_select(selected??-1);refreshEntities();updateSelection();
}
function fastForward(seconds:number) {
 if(!sim||!Number.isFinite(seconds)||seconds<=0)return;
 const steps=Math.round(seconds*60);
 for(let i=0;i<steps;i++){sim.sim_step(1000/60);tick++;}
 accumulator=0;previous=0;refreshEntities();updateSelection();
}
window.__APP={ready:false,error:null,getState:()=>({touch:touchLayout,yawSteps,zoom:zooms[zoomIndex],selected,entityCount,fps,frameStats:window.__APP.ready?renderer.stats:null}),rotate,zoomBy,selectAt,fastForward};
const canvas=document.querySelector<HTMLCanvasElement>('#world')!;
const viewport=document.querySelector<HTMLElement>('#viewport')!;
const selection=document.querySelector<HTMLOutputElement>('#selection')!;
function fatal(error:unknown) {if(window.__APP.error)return;window.__APP.error=error instanceof Error?error.message:String(error);const overlay=document.querySelector<HTMLElement>('#error')!;overlay.textContent=window.__APP.error;overlay.hidden=false;}
function resize() {
 const read=(name:string)=>parseFloat(getComputedStyle(document.documentElement).getPropertyValue(name))||0;
 const availW=innerWidth-read('--safe-l')-read('--safe-r');
 const availH=innerHeight-read('--safe-t')-read('--safe-b');
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
  refreshEntities();updateSelection();renderer.render(entities,entityCount,yawSteps,zooms[zoomIndex],sim.sim_alloy(),sim.sim_charge(),tick);
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
 const value=new URLSearchParams(location.search).get('seed');const seed=value===null?73129:Number(value);sim.sim_init(Number.isFinite(seed)?seed>>>0:73129);refreshEntities();
 await renderer.init(canvas,new Float32Array(sim.memory.buffer,sim.sim_terrain_ptr(),1024));renderer.onError(fatal);requestAnimationFrame(frame);
}
void boot().catch(fatal);
