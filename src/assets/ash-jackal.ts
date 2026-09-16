/** Palette-indexed, 2x Ash Jackal. +X is forward; Z is height above the ground. */
export type JackalVariant='field'|'longbow';
// Retained for consumers of the original rig; the authored coordinates below are doubled.
// The renderer multiplies every Jackal box by JACKAL_SCALE (renderer.ts, unit()).
// Authored 2x x render 0.6 leaves the unit at 1.2x its original on-screen size.
export const JACKAL_SCALE=0.6;
/** Authored-space bow grip, BEFORE the renderer's JACKAL_SCALE is applied. */
export const JACKAL_GRIP=Object.freeze([2,.6,2.3] as const);
/** World-space projectile socket: the authored grip after the renderer's scale.
 *  The simulation spawns the arrow here, so this value must equal
 *  JACKAL_GRIP * JACKAL_SCALE and must match sim/src/actors.rs exactly. */
export const JACKAL_SOCKET=Object.freeze([
 JACKAL_GRIP[0]*JACKAL_SCALE,JACKAL_GRIP[1]*JACKAL_SCALE,JACKAL_GRIP[2]*JACKAL_SCALE,
] as const);
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
 const moving=pose.state===1||pose.state===6,attacking=pose.state===2,fallen=pose.state===4;
 const tick=Number.isFinite(pose.tick)?pose.tick:0;
 const phase=Math.max(0,Math.min(1,Number.isFinite(pose.phase)?pose.phase:0));
 const gait=((tick%36)+36)%36/36;
 // Draw, a short full-draw hold, release at .5, then recover. Never use a wall clock.
 const tension=attacking&&phase<.5?Math.min(1,phase/.4):0;
 const recovery=fallen?0:attacking?(phase>=.5?Math.max(0,(1-phase)*2):0):Math.min(1,Math.max(0,pose.cooldown??0)/12);
 const pull=attacking?tension+recovery:recovery*.12;
 const settle=attacking||fallen?0:Math.sin(tick*Math.PI/36)*.05;
 const pitch=moving?Math.sin(gait*Math.PI*2)*.04:0;
 const torso=.64-pull*.12;
 // These are palette INDICES, not RGB. Index 0 is never used, even on undersides.
 const navy=1,coat=2,shade=3,white=9,teal=12,feather=13;
 const hoof=15,sock=16,cyan=17,pale=18,leather=19,brown=20,tan=21,skin=27;
 const box=(a:number,b:number,c:number,w:number,d:number,h:number,color:number,mode=0)=>{
  // A rigid quarter-turn onto the flank makes the entire wreck lie on the ground.
  // Rotate box centres, then swap depth/height: no upright head or floating feet.
  if(fallen)sink.box(x+a,y+1.6-c-h/2,z+.8+b-d/2,w,h,d,color,id,mode);
  else sink.box(x+a,y+b,z+c,w,d,h,color,id,mode);
 };
 const strut=(a:number,b:number,c:number,dx:number,dy:number,dz:number,width:number,color:number,steps=2)=>{
  for(let i=0;i<steps;i++){
   const t=(i+.5)/steps;
   box(a+dx*t,b+dy*t,c+dz*t-(Math.abs(dz)/steps+width)/2,
    Math.abs(dx)/steps+width,Math.abs(dy)/steps+width,Math.abs(dz)/steps+width,color);
  }
 };
 const star=(a:number,b:number,c:number)=>{
  // Physical four-point crosses on both flanks survive yaw; no screen-facing billboard.
  box(a,b,c-.18,.14,.14,.36,white);
  box(a,b,c-.07,.34,.14,.14,white);
 };

 // Four separate tapered legs. Fore/aft offsets separate both hoof pairs even in profile.
 // Quarter-cycle footfalls give four beats, with diagonal pairs half a cycle apart.
 for(const end of [-1,1])for(const side of [-1,1]){
  const offset=end===1?(side===1?0:.25):(side===1?.75:.5);
  const p=(gait+offset)%1;
  const step=moving?(p<.6?.36-.72*p/.6:-.36+.72*(p-.6)/.4):0;
  const shift=!moving&&!attacking&&!fallen&&end===-1&&side===1?Math.max(0,Math.sin(tick*Math.PI/36))*.06:0;
  const lift=moving&&p>=.6?Math.sin((p-.6)/.4*Math.PI)*.28:shift;
  const root=end===1?torso:-1.02,foot=root+side*.28+step,spread=side*.48;
  const knee=root-end*.18+side*.1+step*.4;
  box(foot+.06,spread,.04+lift,.32,.26,.18,hoof);
  strut(foot,spread,.24+lift,knee-foot,0,.46-lift,.16,navy);
  strut(knee,spread,.7,root-knee,0,.64+settle+end*pitch,.24,side===1?coat:navy);
  box(foot,spread,.24+lift,.2,.28,.14,sock);
  box(foot+(knee-foot)*.3,spread,.44+lift*.6,.2,.26,.14,sock);
 }

 // Long equine barrel, rounded croup and forward shoulder; nothing bridges the leg gaps.
 // Three values so the anatomy reads at 1:1: shade(3) on top and the loading
 // shoulder, coat(2) for the barrel, navy(1) underneath.
 box(-.18,0,1.18+settle,2.52,.92,.48,coat);
 box(-1.08,0,1.3+settle-pitch,.8,1.04,.48,coat,-1);
 box(torso,0,1.24+settle+pitch,.88,1.04,.58,shade,-1);
 // Tapered withers continue the waist into the chest directly over the forelegs.
 // Their top stops below the girth so the leather bridge remains exposed.
 box(torso,0,1.5+settle,.72,.82,.3,shade,-1);
 box(torso+.18,0,1.16+settle,.5,.76,.5,shade,-1);
 for(const side of [-1,1])box(.02,side*.46,1.38+settle,.94,.14,.28,shade);
 box(-.54,0,1.64+settle,1.6,.84,.2,shade,-1);
 box(-.18,0,1.1+settle,1.6,.64,.14,navy);
 for(const side of [-1,1])box(-.98,side*.5,1.36+settle-pitch,.42,.14,.28,shade);

 // Brown, weighty tail, stepping down and back rather than an antenna or a fifth leg.
 strut(-1.38,0,1.62+settle,-.28,0,-.42,.3,leather);
 strut(-1.66,0,1.2+settle,-.22,0,-.52,.36,leather);
 box(-2.02,0,.5+settle,.44,.34,.28,leather,-1);
 box(-1.78,.18,.82+settle,.14,.14,.38,brown);

 // A narrow human waist above the horse's shoulders, bare abdomen, then broad shoulders.
 box(torso,0,1.76+settle,.48,.54,.4,tan,-1);
 box(torso,0,2.1+settle,.62,.66,.44,tan,-1);
 box(torso+.2,0,2.14+settle,.2,.46,.3,skin);
 box(torso,0,2.48+settle,.52,.7,.14,tan);
 box(torso-.18,-.28,1.94+settle,.14,.14,.18,24);
 // Leather girth and thin waist strap; the abdomen remains tan, not a solid brown bib.
 // The girth is the value bridge between the tan torso and the navy horse: without
 // it the black-to-orange break reads as a rider sitting on a mount.
 box(torso,0,1.76+settle,.58,.64,.18,leather);
 for(const side of [-1,1]){
  strut(torso-.12,side*.4,1.82+settle,.18,0,-.28,.14,leather);
  strut(torso-.16,side*.34,2.5+settle,.4,0,-.28,.14,leather);
 }
 box(torso+.28,0,2.12+settle,.14,.54,.14,brown);
 box(torso+.26,0,2.34+settle,.14,.52,.14,leather);
 // The pendant is on the FRONT of the chest, not hidden in the horse's back.
 box(torso+.36,0,2.26+settle,.14,.28,.14,white);
 box(torso+.36,0,2.18+settle,.14,.14,.24,pale);
 box(torso+.4,0,2.26+settle,.14,.14,.14,cyan);

 // Neck, face and flowing navy hair, with a distinct wrap and a small eye on either side.
 box(torso+.02,0,2.6+settle,.26,.3,.18,tan);
 box(torso+.08,0,2.76+settle,.44,.42,.46,tan);
 box(torso+.3,0,2.84+settle,.16,.34,.16,skin);
 box(torso-.16,0,2.82+settle,.26,.5,.48,navy);
 box(torso,0,3.18+settle,.5,.46,.14,navy);
 strut(torso-.22,0,2.94+settle,-.28,0,-.7,.24,navy);
 box(torso-.42,0,2.2+settle,.3,.42,.22,navy,-1);
 box(torso+.02,0,3.06+settle,.5,.46,.14,coat);
 for(const side of [-1,1]){
  box(torso-.08,side*.24,2.88+settle,.18,.14,.32,15);
  box(torso+.3,side*.18,2.98+settle,.14,.14,.14,white);
  box(torso+.36,side*.18,3+settle,.14,.14,.14,navy);
  // Broad ear base plus a backward, pointed tip.
  box(torso-.1,side*.32,2.86+settle,.28,.22,.14,skin,-1);
  box(torso-.24,side*.46,2.9+settle,.24,.18,.14,tan,-1);
 }
 // Exactly two feathers, fanning backwards at different heights.
 strut(torso-.24,-.12,3.12+settle,-.64,-.16,.22,.16,teal);
 strut(torso-.24,.12,3.14+settle,-.42,.2,.3,.16,feather);
 box(torso-.72,-.24,3.28+settle,.24,.18,.14,feather);

 // Bow hand stays at the authoritative socket; drawing hand, elbow and string animate.
 const hand=1.88-pull*.86,nock=1.88-tension*.86;
 strut(torso+.04,.36,2.5+settle,.58,.14,-.08-settle,.2,tan);
 strut(torso+.62,.5,2.42,2-torso-.62,.1,-.02,.18,skin);
 box(1.9,.6,2.3,.2,.28,.2,tan);
 const elbow=torso+.08-pull*.6;
 const elbowZ=2.06+pull*.44+settle;
 strut(torso,-.36,2.46+settle,elbow-torso,-.16,elbowZ-2.46-settle,.2,tan);
 strut(elbow,-.52,elbowZ,hand-elbow,1.12,2.32-elbowZ,.18,skin);
 box(hand,.56,2.26,.2,.22,.16,tan);
 box(1.64,.58,2.32,.14,.24,.14,sock);

 // Variants differ ONLY in this bow's height and forward reach (including its string/glints).
 const height=variant==='longbow'?1.2:1,reach=variant==='longbow'?.88:.68;
 // Keep these exact arguments: the Rust projectile socket is the same local point.
 box(JACKAL_GRIP[0],JACKAL_GRIP[1],JACKAL_GRIP[2],.2,.24,.2,leather);
 for(const side of [-1,1]){
  strut(2,.6,2.4,reach,0,side*height*.5,.2,brown,3);
  strut(2+reach,.6,2.4+side*height*.5,-.18,0,side*height*.34,.2,brown);
  strut(1.82+reach,.6,2.4+side*height*.84,.14-reach,0,side*height*.16,.18,brown);
  strut(1.96,.6,2.4+side*height,.08,0,side*.12,.18,brown,1);
  // Taut contrasting string: at this scale anything thinner than ~.14 authored
  // units disappears (0.6 render scale, ~12 px per world unit at zoom 1).
  strut(2.04,.6,2.4+side*(height+.12),nock-2.04,0,2.3-(2.4+side*(height+.12)),.15,white,4);
  star(2+reach,.62,2.4+side*height*.5);
 }

 // Cyan open rune and a separate star charm on BOTH hindquarters, readable across facings.
 for(const side of [-1,1]){
  const flank=side*.56,runeZ=1.48+settle-pitch;
  box(-1.04,flank,runeZ-.22,.14,.14,.44,cyan);
  box(-1.2,flank,runeZ-.06,.14,.14,.24,sock);
  box(-1.12,flank,runeZ-.1,.28,.14,.14,cyan);
  box(-.92,flank,runeZ+.02,.14,.14,.14,cyan);
  star(-.64,flank,1.42+settle);
 }
 // A held shaft exists only before RELEASE. No arrow is drawn during release/recovery/idle.
 if(attacking&&phase<.5){
  box((hand+2)/2,.6,2.3,2-hand+.2,.14,.14,white);
  box(2.08,.6,2.28,.16,.14,.14,pale);
 }
}
