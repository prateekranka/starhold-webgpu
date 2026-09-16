/** Original procedural assets. Both variants use the same gameplay attachment point. */
export type JackalVariant='field'|'longbow';
export const JACKAL_SCALE=0.6;
export const JACKAL_SOCKET=Object.freeze([0.6,0.18,0.72] as const);
export const JACKAL_VARIANTS=Object.freeze([
 {id:'field' as const,name:'Field rig',revision:'jackal-field-1',status:'Reference'},
 {id:'longbow' as const,name:'Longbow outrider',revision:'jackal-longbow-1',status:'Candidate'},
]);
export interface BoxSink {box(x:number,y:number,z:number,w:number,d:number,h:number,color:number,owner?:number,screen?:number):void;}
export interface JackalPose {state:number;phase:number;tick:number;cooldown?:number;}
export function jackalReleasePoint(x:number,y:number,z:number,yaw:number){
 const [sx,sy,sz]=JACKAL_SOCKET,c=Math.cos(yaw),s=Math.sin(yaw);
 return {x:x+sx*c-sy*s,y:y+sx*s+sy*c,z:z+sz};
}
export function drawAshJackal(sink:BoxSink,x:number,y:number,z:number,id:number,pose:JackalPose,variant:JackalVariant='field'):void {
 const moving=pose.state===1||pose.state===6,attacking=pose.state===2;
 const phase=Math.max(0,Math.min(1,Number.isFinite(pose.phase)?pose.phase:0));
 const draw=attacking&&phase<.5?phase*2:0,gait=((pose.tick%36)+36)%36/36;
 const settle=attacking?0:Math.sin(pose.tick*Math.PI/36)*.025;
 const longer=variant==='longbow',span=longer?.82:.67,stance=longer?.43:.39;
 const box=(a:number,b:number,c:number,w:number,d:number,h:number,color:number,mode=0)=>sink.box(x+a,y+b,z+c,w,d,h,color,id,mode);
 const strut=(a:number,b:number,c:number,dx:number,dy:number,dz:number,width:number,color:number,steps=3)=>{
  for(let i=0;i<steps;i++){const t=(i+.5)/steps;box(a+dx*t,b+dy*t,c+dz*t-Math.abs(dz)/steps/2,Math.abs(dx)/steps+width,Math.abs(dy)/steps+width,Math.abs(dz)/steps+width,color);}
 };
 for(const end of [-1,1])for(const side of [-1,1]){
  const p=(gait+(end*side>0?0:.5))%1,step=moving?(p<.6?.19-.38*p/.6:-.19+.38*(p-.6)/.4):0;
  const lift=moving&&p>=.6?Math.sin((p-.6)/.4*Math.PI)*.18:0;
  box(end*span+step,side*stance,.025+lift,.27,.21,.13,23);
  strut(end*span+step,side*stance,.15+lift,-end*.18-step*.4,0,.3-lift,.115,24);
  strut(end*span-end*.18+step*.6,side*stance,.45,end*.12-step*.6,0,.23+settle,.14,25);
 }
 box(-.1,0,.62+settle,longer?1.78:1.48,.64,.34,24,-1);
 box(-.26,0,.89+settle,longer?1.25:1.02,.69,.13,23);
 for(const side of [-1,1])box(-.15,side*.34,.74+settle,.55,.055,.21,25);
 box(-.95,0,.73+settle,.35,.12,.18,25,-1);
 const torso=.34-draw*.055;
 box(torso,0,.84,.4,.45,.44,24,-1);
 box(torso+.06,0,1.22,.38,.42,.31,23,-1);
 box(torso+.23,0,1.31,.13,.22,.12,25);
 box(torso+.295,0,1.35,.045,.19,.045,27);
 for(const side of [-1,1])box(torso-.02,side*.145,1.49,.095,.09,longer?.23:.13,25,-1);
 box(-.19,-.38,.91,.3,.22,.49,23);
 for(let j=0;j<3;j++)box(-.3+j*.105,-.38,1.37,.035,.04,.3,25);
 // The grip is always (1,.3,1.2) before the common .6 world scale.
 const bow=1,hand=attacking?bow-.2-draw*.48:.71,height=longer?.66:.49;
 strut(torso+.05,.21,1.15,bow-torso-.05,.09,.05,.115,25);
 strut(torso,-.23,1.17,hand-torso,.53,.03,.10,24);
 box(bow,.3,1.15,.1,.12,.1,25);
 for(const side of [-1,1]){
  strut(bow,.3,1.2,-.15,0,side*height*.68,.07,26);
  strut(bow-.15,.3,1.2+side*height*.68,-.14,0,side*height*.32,.065,25);
  strut(bow-.29,.3,1.2+side*height,hand-(bow-.29),0,-side*height,.025,27,4);
 }
 const released=(pose.cooldown??0)>0&&phase>=.5;
 if(!released)box((hand+bow)/2,.3,1.2,bow-hand+.15,.04,.04,26);
 // No decorative flying arrow: the simulation's projectile is the only shot.
}
