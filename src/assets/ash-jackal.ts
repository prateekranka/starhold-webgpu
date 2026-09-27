/** Original procedural Ash Jackal assets. Candidate revisions share one gameplay socket. */
export type JackalVariant='field'|'longbow';
export const JACKAL_SCALE=0.6;
export const JACKAL_SOCKET=Object.freeze([0.6,0.18,0.72] as const);
export const JACKAL_FOOT_SIZE=Object.freeze([0.27,0.21,0.13] as const);
export const JACKAL_VARIANTS=Object.freeze([
 {id:'field' as const,name:'Field rig',revision:'jackal-field-1',status:'Technical pass'},
 {id:'longbow' as const,name:'Longbow outrider',revision:'jackal-longbow-1',status:'Visual review'},
]);
export interface BoxSink {box(x:number,y:number,z:number,w:number,d:number,h:number,color:number,owner?:number,screen?:number):void;}
export interface JackalPose {state:number;phase:number;tick:number;cooldown?:number;}
export function jackalReleasePoint(x:number,y:number,z:number,yaw:number){
 const [sx,sy,sz]=JACKAL_SOCKET,c=Math.cos(yaw),s=Math.sin(yaw);
 return {x:x+sx*c-sy*s,y:y+sx*s+sy*c,z:z+sz};
}
export function drawAshJackal(sink:BoxSink,x:number,y:number,z:number,id:number,pose:JackalPose,variant:JackalVariant='field'):void {
 const moving=pose.state===1||pose.state===6,attacking=pose.state===2,wreck=pose.state===4;
 const phase=Math.max(0,Math.min(1,Number.isFinite(pose.phase)?pose.phase:0));
 const draw=attacking&&phase<.5?phase*2:0,gait=((pose.tick%36)+36)%36/36;
 const settle=attacking?0:Math.sin(pose.tick*Math.PI/36)*.025;
 const longer=variant==='longbow',span=longer?.82:.67,stance=longer?.43:.39;
 const box=(a:number,b:number,c:number,w:number,d:number,h:number,color:number,mode=0)=>sink.box(x+a,y+b,z+c,w,d,h,color,id,mode);
 const strut=(a:number,b:number,c:number,dx:number,dy:number,dz:number,width:number,color:number,steps=3)=>{
  for(let i=0;i<steps;i++){const t=(i+.5)/steps;box(a+dx*t,b+dy*t,c+dz*t-Math.abs(dz)/steps/2,Math.abs(dx)/steps+width,Math.abs(dy)/steps+width,Math.abs(dz)/steps+width,color);}
 };
 if(wreck){
  // Collapsed centaur chassis: folded legs, shattered bow, fallen quiver
  box(-.18,0,.10,longer?1.45:1.30,.58,.22,24,-1);
  box(.28,.05,.22,.42,.36,.22,21,-1);
  box(.43,.08,.38,.24,.26,.16,21,-1);
  for(const [a,b] of [[-.58,-.32],[-.52,.32],[.32,-.30],[.36,.32]] as const){
   box(a,b,.035,.38,.15,.11,24);
   box(a+(a<0?-.1:.1),b,.02,JACKAL_FOOT_SIZE[0],JACKAL_FOOT_SIZE[1],JACKAL_FOOT_SIZE[2],23);
  }
  box(-.72,-.22,.12,.32,.14,.16,19);
  box(-.25,-.33,.14,.32,.16,.18,19);
  for(let j=0;j<3;j++)box(-.35+j*.09,-.34,.28,.035,.04,.18,25);
  strut(.20,.36,.06,.65,0,.02,.065,25,4);
  box(.85,.36,.08,.14,.14,.08,27);
  return;
 }
 // 1. Articulated Quadruped Legs & Hooves (trot cycle with diagonal-pair support)
 for(const end of [-1,1])for(const side of [-1,1]){
  const p=(gait+(end*side>0?0:.5))%1,step=moving?(p<.6?.19-.38*p/.6:-.19+.38*(p-.6)/.4):0;
  const lift=moving&&p>=.6?Math.sin((p-.6)/.4*Math.PI)*.18:0;
  const lx=end*span+step,ly=side*stance,lz=.025+lift;
  // Hoof footplate (contract requires color 23 and JACKAL_FOOT_SIZE)
  box(lx,ly,lz,JACKAL_FOOT_SIZE[0],JACKAL_FOOT_SIZE[1],JACKAL_FOOT_SIZE[2],23);
  // Glowing anklet ring (cyan/ember accent from reference)
  box(lx,ly,lz+.12,.22,.18,.06,27);
  // Lower shin
  strut(lx,ly,lz+.16,-end*.12-step*.3,0,.28-lift,.10,2);
  // Knee / hock guard (wine armor)
  box(lx-end*.12,ly,lz+.42,.18,.16,.14,24);
  // Upper thigh / shoulder joint connecting to chassis
  strut(lx-end*.12,ly,lz+.46,end*.16-step*.3,0,.22+settle,.15,24);
 }
 // 2. Sculpted Quadruped Centaur Chassis
 box(-.1,0,.52+settle,longer?1.58:1.36,.50,.26,2,-1);
 box(-.1,0,.68+settle,longer?1.48:1.26,.56,.22,24,-1);
 box(.26,0,.74+settle,.40,.52,.22,24,-1);
 box(-.48,0,.70+settle,.46,.50,.18,23,-1);
 for(const side of [-1,1]){
  box(-.08,side*.29,.68+settle,.14,.04,.14,27);
  box(-.28,side*.28,.64+settle,.10,.04,.10,26);
 }
 // 3. Arched Horse Tail (bushy tail cascading down from rump)
 box(-.72,0,.74+settle,.22,.13,.16,2);
 strut(-.80,0,.72+settle,-.14,0,-.24,.14,1);
 strut(-.94,0,.48+settle,-.06,0,-.26,.12,19);
 box(-.98,0,.20+settle,.10,.10,.12,23);
 // 4. Upright Athletic Archer Torso
 const torso=.34-draw*.055;
 box(torso,0,.86+settle,.30,.32,.16,21,-1);
 box(torso,0,.92+settle,.32,.34,.06,19);
 box(torso+.02,0,1.02+settle,.32,.36,.22,21,-1);
 strut(torso+.16,-.15,1.10+settle,-.28,.30,-.18,.055,23);
 strut(torso+.16,.15,1.10+settle,-.28,-.30,-.18,.055,23);
 box(torso+.02,0,1.16+settle,.28,.44,.10,21,-1);
 // 5. Humanoid Head, Ears, Hair & Feather Crest
 box(torso+.05,0,1.23+settle,.16,.16,.12,21);
 box(torso+.13,0,1.32+settle,.22,.20,.18,21);
 box(torso+.22,0,1.35+settle,.07,.16,.07,20);
 box(torso-.03,0,1.33+settle,.16,.22,.16,1);
 box(torso-.12,0,1.24+settle,.14,.16,.20,1);
 for(const side of [-1,1])box(torso+.03,side*.12,1.39+settle,.12,.05,.10,21);
 box(torso+.02,-.13,1.46+settle,.07,.04,.16,14);
 box(torso+.04,-.13,1.52+settle,.05,.03,.08,18);
 // 6. Articulated Arms
 strut(torso+.06,.21,1.16+settle,.40,.06,-.01,.095,21);
 strut(torso+.46,.27,1.15+settle,.48,.02,-.01,.085,21);
 box(.82,.29,1.15+settle,.13,.10,.10,24);
 const bow=1,hand=attacking?bow-.2-draw*.48:.71,height=longer?.66:.49;
 box(torso-.10,-.28,1.15+settle,.11,.11,.11,21);
 strut(torso-.10,-.26,1.15+settle,hand-(torso-.10),.54,.02,.08,21);
 // 7. Composite Recurve Bow (grip at 1, .3, 1.15)
 box(bow,.3,1.15,.1,.12,.1,25);
 for(const side of [-1,1]){
  strut(bow,.3,1.20,-.15,0,side*height*.68,.07,24);
  strut(bow-.15,.3,1.20+side*height*.68,-.14,0,side*height*.32,.065,25);
  box(bow-.29,.3,1.20+side*height,.08,.08,.08,27);
  strut(bow-.29,.3,1.20+side*height,hand-(bow-.29),0,-side*height,.025,27,4);
 }
 // 8. Presentation Nocked Arrow
 const released=(pose.cooldown??0)>0&&phase>=.5;
 if(!released)box((hand+bow)/2,.3,1.20,bow-hand+.15,.04,.04,26);
 // 9. Rear Quiver on Flank
 box(-.22,-.34,.88+settle,.22,.16,.42,19);
 for(let j=0;j<3;j++){
  box(-.31+j*.09,-.34,1.24+settle,.035,.04,.24,25);
  box(-.31+j*.09,-.34,1.44+settle,.05,.05,.07,27);
 }
}
