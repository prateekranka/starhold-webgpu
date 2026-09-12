import './style.css';
import {Renderer} from './renderer';
import {names, jobs} from './kinds';
interface SimExports extends WebAssembly.Exports {
 memory:WebAssembly.Memory;
 sim_init(seed:number):void;sim_step(dt:number):void;
 sim_entity_count():number;sim_entity_ptr():number;sim_entity_stride():number;
 sim_select(index:number):void;sim_terrain_ptr():number;sim_alloy():number;sim_charge():number;
}
interface App {
 ready:boolean;error:string|null;
 getState():{yawSteps:number;zoom:number;selected:number|null;entityCount:number;fps:number|null;frameStats:{drawCalls:number;triangles:number}|null};
 rotate(dir:1|-1):void;zoomBy(delta:1|-1):void;selectAt(x:number,y:number):void;
}
declare global {interface Window {__APP:App}}
let yawSteps=0,zoomIndex=1,sim:SimExports|undefined,entities=new Float32Array(0),entityCount=0,selected:number|null=null,fps:number|null=null;
const zooms=[4/3,1,4/5,2/3];
const renderer=new Renderer();
function rotate(dir:1|-1) {yawSteps=(yawSteps+(dir===-1?-1:1)+4)%4;}
function zoomBy(delta:1|-1) {zoomIndex=Math.max(0,Math.min(3,zoomIndex+(delta===-1?-1:1)));}
function selectAt(x:number,y:number) {
 if(!sim||!window.__APP.ready)return;
 const rect=canvas.getBoundingClientRect();
 if(x<rect.left||y<rect.top||x>=rect.right||y>=rect.bottom)return;
 selected=renderer.pick((x-rect.left)*480/rect.width,(y-rect.top)*270/rect.height,yawSteps,zooms[zoomIndex]);
 sim.sim_select(selected??-1);refreshEntities();updateSelection();
}
window.__APP={ready:false,error:null,getState:()=>({yawSteps,zoom:zooms[zoomIndex],selected,entityCount,fps,frameStats:window.__APP.ready?renderer.stats:null}),rotate,zoomBy,selectAt};
const canvas=document.querySelector<HTMLCanvasElement>('#world')!;
const viewport=document.querySelector<HTMLElement>('#viewport')!;
const selection=document.querySelector<HTMLOutputElement>('#selection')!;
function fatal(error:unknown) {if(window.__APP.error)return;window.__APP.error=error instanceof Error?error.message:String(error);const overlay=document.querySelector<HTMLElement>('#error')!;overlay.textContent=window.__APP.error;overlay.hidden=false;}
function resize() {const fit=Math.min(innerWidth/480,innerHeight/270);const scale=fit>=1?Math.floor(fit):fit;viewport.style.width=`${480*scale}px`;viewport.style.height=`${270*scale}px`;}
window.addEventListener('resize',resize);resize();
document.getElementById('rotate-left')!.addEventListener('click',()=>rotate(-1));
document.getElementById('rotate-right')!.addEventListener('click',()=>rotate(1));
document.getElementById('zoom-out')!.addEventListener('click',()=>zoomBy(-1));
document.getElementById('zoom-in')!.addEventListener('click',()=>zoomBy(1));
canvas.addEventListener('click',e=>selectAt(e.clientX,e.clientY));
function refreshEntities() {
 if(!sim)return;entityCount=sim.sim_entity_count();const pointer=sim.sim_entity_ptr();
 // Reuse the direct linear-memory view until the pointer/count or buffer changes.
 if(entities.buffer!==sim.memory.buffer||entities.byteOffset!==pointer)entities=new Float32Array(sim.memory.buffer,pointer);
 selected=null;for(let i=0;i<entityCount;i++)if(entities[i*12+8]===1){selected=i;break;}
}
let lastSelection=-2,lastHealth=-1,lastJob=-1;
function updateSelection() {const o=selected===null?-1:selected*12;const hp=o<0?0:Math.round(entities[o+7]*100),job=o<0?-1:entities[o+5];if(lastSelection===(selected??-1)&&lastHealth===hp&&lastJob===job)return;lastSelection=selected??-1;lastHealth=hp;lastJob=job;selection.hidden=o<0;selection.textContent=o<0?'':`${names[entities[o+4]]} — HP ${hp}% — ${jobs[job]}`;}
let previous=0,accumulator=0,windowStart=0,frames=0;
function frame(now:number) {
 if(window.__APP.error||!sim)return;
 try {
  if(previous===0){previous=now;windowStart=now;}
  accumulator+=Math.min(now-previous,250);previous=now;
  while(accumulator>=1000/60){sim.sim_step(1000/60);accumulator-=1000/60;}
  refreshEntities();updateSelection();renderer.render(entities,entityCount,yawSteps,zooms[zoomIndex],sim.sim_alloy(),sim.sim_charge());
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
