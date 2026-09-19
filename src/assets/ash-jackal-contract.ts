import {drawAshJackal,JACKAL_FOOT_SIZE,JACKAL_SCALE,JACKAL_SOCKET,JACKAL_VARIANTS,type BoxSink,type JackalPose,type JackalVariant} from './ash-jackal.ts';

export type AssetLifecycle='experiment'|'candidate'|'technical-pass'|'visual-review'|'approved'|'rework';
export interface AssetCandidate {
 id:JackalVariant;
 revision:string;
 name:string;
 stage:AssetLifecycle;
 parentRevision:string|null;
 summary:string;
}
export interface AssetGateResult {
 id:string;
 label:string;
 pass:boolean;
 detail:string;
 required:true;
}
export interface HumanReviewCriterion {id:string;label:string;description:string;}

export const ASH_JACKAL_CONTRACT=Object.freeze({
 schema:'starhold-asset-contract-v1',
 id:'cinderwake.ash-jackal',
 kind:30,
 civilization:1,
 civilizationName:'Cinderwake Reavers',
 role:'Mobile ranged raider',
 bodyPlan:'mechanical-centaur-quadruped',
 engineRepresentation:'procedural-box-rig',
 sourceReferences:Object.freeze([
  'art/concept/steppe-centaur-ashjackal.png',
  'art/concept/cinderwake-roster.png',
 ]),
 identity:Object.freeze({
  mustReadAs:Object.freeze(['four-legged low chassis','upright archer torso','oversized ember bow','rear quiver']),
  mustNotReadAs:Object.freeze(['literal canine or jackal','generic humanoid archer','Dawnward symmetry','heavy tank']),
  palette:Object.freeze(['wine-red armor','dark iron chassis','vermilion cloth','restrained orange ember heat']),
 }),
 animation:Object.freeze({
  requiredStates:Object.freeze(['idle','walk','attack','wreck']),
  locomotion:'mechanical diagonal-pair trot',
  attack:'draw → release → recovery; projectile release is simulation-authoritative',
  wreck:'terminal collapsed silhouette; never returns toward idle',
 }),
 gameplay:Object.freeze({
  releaseSocket:JACKAL_SOCKET,
  scale:JACKAL_SCALE,
  baseDrawTicks:24,
  baseCycleTicks:48,
  runningDrawMovementUnlockTicks:36,
  anchoredDrawTicks:36,
  anchoredCycleTicks:60,
 }),
 technicalLimits:Object.freeze({
  maxLocalWidth:2.5,
  maxLocalDepth:1.25,
  maxLocalHeight:2.1,
  maxWreckHeight:.8,
  requiredLegs:4,
 }),
 review:Object.freeze({
  nativeGameplayScale:true,
  facings:8,
  cameraYaws:4,
  humanApprovalRequired:true,
  approvalPromotesRuntime:false,
 }),
});

export const ASH_JACKAL_CANDIDATES:readonly AssetCandidate[]=Object.freeze([
 {
  id:'field',revision:'jackal-field-1',name:'Field rig',stage:'technical-pass',parentRevision:null,
  summary:'Compact baseline rig. Preserves the original production silhouette and shared weapon socket.',
 },
 {
  id:'longbow',revision:'jackal-longbow-1',name:'Longbow outrider',stage:'visual-review',parentRevision:'jackal-field-1',
  summary:'Longer chassis and larger bow intended to improve ranged identity at gameplay scale.',
 },
]);

export const ASH_JACKAL_HUMAN_CRITERIA:readonly HumanReviewCriterion[]=Object.freeze([
 {id:'silhouette',label:'Centaur silhouette reads at native scale',description:'Four-legged chassis and upright archer torso are immediately separable.'},
 {id:'faction',label:'Cinderwake identity is unmistakable',description:'Low salvage-built massing, wine-red/iron palette and ember heat do not drift toward Dawnward.'},
 {id:'weapon',label:'Bow and quiver remain readable',description:'The weapon silhouette survives all eight facings and does not merge into the torso.'},
 {id:'motion',label:'Actions communicate clearly',description:'Walk, draw/release/recovery and terminal wreck each read without relying on the enlarged preview.'},
]);

type BoxRecord={x:number;y:number;z:number;w:number;d:number;h:number;color:number;owner?:number;screen?:number};
const close=(a:number,b:number,epsilon=1e-6)=>Math.abs(a-b)<=epsilon;
function capture(variant:JackalVariant,pose:JackalPose):BoxRecord[]{
 const boxes:BoxRecord[]=[];
 const sink:BoxSink={box(x,y,z,w,d,h,color,owner,screen){boxes.push({x,y,z,w,d,h,color,owner,screen});}};
 drawAshJackal(sink,0,0,0,7,pose,variant);
 return boxes;
}
function bounds(boxes:readonly BoxRecord[]){
 return {
  minX:Math.min(...boxes.map(b=>b.x-b.w/2)),maxX:Math.max(...boxes.map(b=>b.x+b.w/2)),
  minY:Math.min(...boxes.map(b=>b.y-b.d/2)),maxY:Math.max(...boxes.map(b=>b.y+b.d/2)),
  minZ:Math.min(...boxes.map(b=>b.z)),maxZ:Math.max(...boxes.map(b=>b.z+b.h)),
 };
}
function signature(boxes:readonly BoxRecord[]):string{
 return boxes.map(b=>[b.x,b.y,b.z,b.w,b.d,b.h,b.color].map(n=>Number(n.toFixed(5))).join(',')).join('|');
}
function feet(boxes:readonly BoxRecord[]):BoxRecord[]{
 return boxes.filter(b=>b.color===23&&close(b.w,JACKAL_FOOT_SIZE[0])&&close(b.d,JACKAL_FOOT_SIZE[1])&&close(b.h,JACKAL_FOOT_SIZE[2]));
}
function nockedArrows(boxes:readonly BoxRecord[]):BoxRecord[]{
 return boxes.filter(b=>b.color===26&&close(b.d,.04)&&close(b.h,.04)&&b.w>.2);
}
function gate(id:string,label:string,pass:boolean,detail:string):AssetGateResult{return {id,label,pass,detail,required:true};}

export function candidateFor(variant:JackalVariant):AssetCandidate{
 const candidate=ASH_JACKAL_CANDIDATES.find(c=>c.id===variant);
 if(!candidate)throw new Error(`Unknown Ash Jackal candidate: ${variant}`);
 return candidate;
}

export function evaluateAshJackalCandidate(variant:JackalVariant):AssetGateResult[]{
 const idle=capture(variant,{state:0,phase:0,tick:0});
 const walk=capture(variant,{state:1,phase:0,tick:27});
 const drawn=capture(variant,{state:2,phase:.49,tick:24,cooldown:48});
 const released=capture(variant,{state:2,phase:.5,tick:25,cooldown:48});
 const wreck=capture(variant,{state:4,phase:1,tick:36,cooldown:0});
 const all=[...idle,...walk,...drawn,...released,...wreck],idleFeet=feet(idle),walkFeet=feet(walk);
 const lifted=walkFeet.filter(b=>b.z>.03).length,planted=walkFeet.filter(b=>b.z<=.03).length;
 const allBounds=[bounds(idle),bounds(walk),bounds(drawn),bounds(released)];
 const widest=Math.max(...allBounds.map(b=>b.maxX-b.minX)),deepest=Math.max(...allBounds.map(b=>b.maxY-b.minY)),highest=Math.max(...allBounds.map(b=>b.maxZ-b.minZ));
 const wreckBounds=bounds(wreck),candidate=candidateFor(variant);
 const revisions=new Set(ASH_JACKAL_CANDIDATES.map(c=>c.revision));
 return [
  gate('finite-geometry','Geometry is finite and positive',
   all.length>0&&all.every(b=>[b.x,b.y,b.z,b.w,b.d,b.h,b.color].every(Number.isFinite)&&b.w>0&&b.d>0&&b.h>0),
   `${all.length} authored box primitives sampled across required states.`),
  gate('body-plan','Four-leg body plan is intact',
   idleFeet.length===ASH_JACKAL_CONTRACT.technicalLimits.requiredLegs,
   `${idleFeet.length}/${ASH_JACKAL_CONTRACT.technicalLimits.requiredLegs} contract footplates detected in idle.`),
  gate('locomotion-support','Diagonal-pair trot has support',
   walkFeet.length===4&&lifted===2&&planted===2,
   `${planted} planted + ${lifted} lifted feet at the sampled swing phase.`),
  gate('release-socket','Weapon release socket is contract-owned',
   close(JACKAL_SOCKET[0],.6)&&close(JACKAL_SOCKET[1],.18)&&close(JACKAL_SOCKET[2],.72)&&close(JACKAL_SCALE,.6),
   `World socket (${JACKAL_SOCKET.join(', ')}) at scale ${JACKAL_SCALE}.`),
  gate('release-presentation','Release removes the nocked presentation arrow',
   nockedArrows(drawn).length===1&&nockedArrows(released).length===0,
   `${nockedArrows(drawn).length} pre-release presentation arrow; ${nockedArrows(released).length} after release.`),
  gate('gameplay-bounds','Candidate stays inside the authored local envelope',
   widest<=ASH_JACKAL_CONTRACT.technicalLimits.maxLocalWidth&&deepest<=ASH_JACKAL_CONTRACT.technicalLimits.maxLocalDepth&&highest<=ASH_JACKAL_CONTRACT.technicalLimits.maxLocalHeight,
   `Sampled envelope ${widest.toFixed(2)} × ${deepest.toFixed(2)} × ${highest.toFixed(2)} local units.`),
  gate('required-states','Required states produce distinct geometry',
   new Set([signature(idle),signature(walk),signature(drawn),signature(wreck)]).size===4,
   'Idle, locomotion, attack draw and wreck are mechanically distinct samples.'),
  gate('terminal-wreck','Wreck is a terminal low silhouette',
   wreckBounds.maxZ<=ASH_JACKAL_CONTRACT.technicalLimits.maxWreckHeight&&signature(wreck)!==signature(idle),
   `Wreck top ${wreckBounds.maxZ.toFixed(2)} ≤ ${ASH_JACKAL_CONTRACT.technicalLimits.maxWreckHeight.toFixed(2)} local units.`),
  gate('version-lineage','Candidate revision is immutable and unique',
   /^jackal-(field|longbow)-\d+$/.test(candidate.revision)&&revisions.size===ASH_JACKAL_CANDIDATES.length,
   `${candidate.revision}${candidate.parentRevision?` ← ${candidate.parentRevision}`:' · root candidate'}.`),
 ];
}

export function allRequiredGatesPass(variant:JackalVariant):boolean{
 return evaluateAshJackalCandidate(variant).every(g=>g.pass);
}

// Ensure the lightweight renderer metadata and the governed candidate catalog never drift.
export function candidateCatalogMatchesRenderer():boolean{
 return JACKAL_VARIANTS.length===ASH_JACKAL_CANDIDATES.length&&JACKAL_VARIANTS.every(v=>{
  const c=ASH_JACKAL_CANDIDATES.find(candidate=>candidate.id===v.id);
  return c?.revision===v.revision&&c.name===v.name;
 });
}
