import {type ContentAbi,readRoster,readResearch} from '../content-api';
export interface WorkshopAbi extends ContentAbi {
 sim_init(seed:number):void;sim_step(dt:number):void;sim_entity_count():number;sim_entity_stride():number;sim_entity_ptr():number;
 sim_terrain_ptr():number;sim_world_size():number;sim_world_ptr():number;
 sim_actor_handle(index:number):number;sim_actor_order(handle:number,op:number,arg:number):number;
 sim_lab_init(seed:number,scenario:number,faction:number,kind:number,enemy:number,count:number):number;
 sim_lab_tick():number;sim_lab_event_count():number;sim_lab_event_stride():number;sim_lab_event_ptr():number;
 sim_lab_events_clear():void;sim_lab_events_dropped():number;sim_lab_prepare(id:number):number;sim_lab_preparation_ticks():number;
}
export interface Fixture {seed:number;scenario:number;faction:number;kind:number;enemy:number;count:number;research:number[];}
export interface RecordedCommand {tick:number;handle:number;op:number;arg:number;accepted:boolean;}
export const DEFAULT_FIXTURE:Fixture={seed:7319,scenario:0,faction:1,kind:30,enemy:22,count:1,research:[]};
export async function loadWorkshop(){
 const response=await fetch('/tools/sim.workshop.wasm');
 if(!response.ok)throw new Error('Workshop WASM is missing. Run npm run dev:tools to build it.');
 const bytes=await response.arrayBuffer(),digest=await crypto.subtle.digest('SHA-256',bytes);
 const hash=Array.from(new Uint8Array(digest),n=>n.toString(16).padStart(2,'0')).join('');
 const module=await WebAssembly.compile(bytes);
 const create=async()=>new WorkshopSession((await WebAssembly.instantiate(module,{})).exports as unknown as WorkshopAbi,hash);
 return {create,hash};
}
export class WorkshopSession {
 readonly events:number[][]=[];readonly commands:RecordedCommand[]=[];
 fixture:Fixture={...DEFAULT_FIXTURE,research:[]};private omitted=0;
 constructor(readonly sim:WorkshopAbi,readonly wasmHash:string){
  for(const name of ['sim_lab_init','sim_lab_prepare','sim_actor_order','sim_kind_stat'])if(typeof (sim as unknown as Record<string,unknown>)[name]!=='function')throw new Error(`Unsupported workshop module: ${name}`);
 }
 reset(fixture:Fixture):void {
  if(!this.sim.sim_lab_init(fixture.seed,fixture.scenario,fixture.faction,fixture.kind,fixture.enemy,fixture.count))throw new Error('The simulation rejected this fixture.');
  this.fixture={...fixture,research:[...fixture.research]};this.events.length=0;this.commands.length=0;this.omitted=0;
  for(const id of fixture.research)if(!this.sim.sim_lab_prepare(id))throw new Error(`Cannot prepare research ${id}; check prerequisites and resources.`);
  this.collect();
 }
 snapshot():Float32Array{return new Float32Array(this.sim.memory.buffer,this.sim.sim_entity_ptr(),this.sim.sim_entity_count()*12).slice();}
 terrain():Float32Array{return new Float32Array(this.sim.memory.buffer,this.sim.sim_world_ptr(),64*64).slice();}
 actors(){const data=this.snapshot();return Array.from({length:data.length/12},(_,index)=>({index,handle:this.sim.sim_actor_handle(index),kind:data[index*12+4],faction:data[index*12+9],x:data[index*12],y:data[index*12+1],health:data[index*12+7],state:data[index*12+5]}));}
 step(ticks=1):void {
  const remaining=Math.max(0,1800-this.sim.sim_lab_tick()),count=Math.min(remaining,Math.max(0,Math.min(1800,Math.floor(ticks))));
  for(let i=0;i<count;i++){this.sim.sim_step(1000/60);this.collect();}
 }
 order(handle:number,op:number,arg:number):boolean {
  const tick=this.sim.sim_lab_tick(),accepted=!!this.sim.sim_actor_order(handle,op,arg);
  this.commands.push({tick,handle,op,arg,accepted});this.collect();return accepted;
 }
 private collect():void {
  const count=this.sim.sim_lab_event_count(),stride=this.sim.sim_lab_event_stride();
  if(stride!==9)throw new Error('Unsupported event ABI');
  const data=new Float32Array(this.sim.memory.buffer,this.sim.sim_lab_event_ptr(),count*stride);
  for(let i=0;i<count;i++){if(this.events.length<10000)this.events.push(Array.from(data.slice(i*stride,(i+1)*stride)));else this.omitted++;}
  this.sim.sim_lab_events_clear();
 }
 metrics(){const shots=this.events.filter(e=>e[1]===2),hits=this.events.filter(e=>e[1]===3);return {tick:this.sim.sim_lab_tick(),shots:shots.length,totalDamage:hits.reduce((sum,e)=>sum+e[4],0),deaths:this.events.filter(e=>e[1]===4).length,blockedRoutes:this.events.filter(e=>e[1]===6).length,preparationSeconds:this.sim.sim_lab_preparation_ticks()/60,alloy:this.sim.sim_alloy(),charge:this.sim.sim_charge(),omittedEvents:this.omitted+this.sim.sim_lab_events_dropped()};}
 evidence(extra:Record<string,unknown>={}){return {format:'starhold-workshop-v1',wasmSHA256:this.wasmHash,fixture:this.fixture,metrics:this.metrics(),commands:this.commands,events:this.events,eventFields:['tick','type','actor','target','value','x','y','z','phase'],actors:this.actors(),roster:readRoster(this.sim),research:readResearch(this.sim),...extra};}
}
export function downloadJSON(name:string,data:unknown):void {
 const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
