/** Read-only content comes from Rust. Presentation owns names, never balance values. */
export interface ContentAbi {
 memory: WebAssembly.Memory;
 sim_kind_stat(kind:number,field:number):number;
 sim_research_count():number; sim_research_stride():number; sim_research_ptr():number;
 sim_research_status(id:number):number; sim_research_active():number; sim_research_remaining():number;
 sim_research_owned(faction:number,id:number):number;
 sim_command(op:number,a:number,b:number):number;
 sim_mode():number; sim_player():number; sim_age():number; sim_alloy():number; sim_charge():number;
 sim_roster_count():number; sim_roster_ptr():number;
}
export interface ActorDefinition {
 kind:number; faction:number; tier:number; klass:number; producer:number; alloy:number; charge:number;
 population:number; ticks:number; health:number; speed:number; range:number; damage:number; cadence:number;
 width:number; depth:number;
}
export interface ResearchNode {
 id:number; faction:number; age:number; producer:number; alloy:number; charge:number; ticks:number;
 requires:number; exclusive:number; effect:number; target:number; value:number; index:number;
}
export const CIVILIZATIONS=['Dawnward Compact','Cinderwake Reavers'] as const;
export const RESEARCH_LABELS:Readonly<Record<number,readonly [string,string]>>={
 100:['Surveyor Boots','Logistics'],101:['Cargo Bearings','Logistics'],102:['Ward Plating','Bastion'],
 103:['Focused Lenses','Lattice'],104:['Long Sight','Lattice'],105:['Foundation Braces','Bastion'],
 200:['Scavenger Stride','Salvage'],201:['Mule Bearings','Salvage'],202:['Tempered Arrows','Raiding'],
 203:['Running Draw','Raiding'],204:['Anchored Draw','Raiding'],205:['Yard Braces','Siegebreaking'],
};
export const RESEARCH_STATUS=['Unavailable in this mode or civilization','Requires a later age','Missing prerequisite research',
 'Requires a completed producer','Insufficient Alloy or Charge','Research or producer is busy','Conflicts with the chosen doctrine',
 'Completed','Researching','Available'] as const;
export function readDefinition(s:ContentAbi,kind:number):ActorDefinition|null {
 const v=Array.from({length:16},(_,i)=>s.sim_kind_stat(kind,i));
 if(v[0]<0)return null;
 const [k,faction,tier,klass,producer,alloy,charge,population,ticks,health,speed,range,damage,cadence,width,depth]=v;
 return {kind:k,faction,tier,klass,producer,alloy,charge,population,ticks,health,speed,range,damage,cadence,width,depth};
}
export function readRoster(s:ContentAbi):ActorDefinition[] {
 const view=new Float32Array(s.memory.buffer,s.sim_roster_ptr(),s.sim_roster_count()*8);
 return Array.from({length:s.sim_roster_count()},(_,i)=>readDefinition(s,view[i*8])!).filter(Boolean);
}
export function readResearch(s:ContentAbi):ResearchNode[] {
 const count=s.sim_research_count(),stride=s.sim_research_stride();
 if(stride!==12)throw new Error(`Unsupported research ABI stride: ${stride}`);
 const view=new Float32Array(s.memory.buffer,s.sim_research_ptr(),count*stride);
 return Array.from({length:count},(_,index)=>{
  const [id,faction,age,producer,alloy,charge,ticks,requires,exclusive,effect,target,value]=view.slice(index*stride,(index+1)*stride);
  return {id,faction,age,producer,alloy,charge,ticks,requires,exclusive,effect,target,value,index};
 });
}
export function researchEffect(n:ResearchNode):string {
 switch(n.effect){
  case 0:return `Movement speed +${n.value}%`;
  case 1:return `Attack damage +${n.value}%`;
  case 2:return `Maximum health +${n.value}%; existing actors are not healed`;
  case 3:return `Range +${n.value} tile${n.value===1?'':'s'}`;
  case 4:return `Movement unlocks ${n.value} ticks earlier after firing; shot cooldown is unchanged`;
  case 5:return `Draw for ${n.value} ticks; 50% stronger shots, 60-tick attack cycle`;
  default:return 'Unrecognized effect; update the content reader';
 }
}
export function requirements(n:ResearchNode,all:ResearchNode[]):ResearchNode[]{return all.filter(p=>(n.requires&(1<<p.index))!==0);}
export const escapeMarkup=(text:unknown):string=>String(text).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
