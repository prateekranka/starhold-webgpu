import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync,readdirSync} from 'node:fs';
import {readResearch,readRoster,readDefinition} from '../src/content-api.ts';
import {drawAshJackal,jackalReleasePoint} from '../src/assets/ash-jackal.ts';
import {ASH_JACKAL_CANDIDATES,ASH_JACKAL_CONTRACT,ASH_JACKAL_HUMAN_CRITERIA,candidateCatalogMatchesRenderer,evaluateAshJackalCandidate} from '../src/assets/ash-jackal-contract.ts';
const normal=readFileSync('public/sim.wasm'),workshop=readFileSync('tools/sim.workshop.wasm');
async function load(bytes=workshop){return (await WebAssembly.instantiate(bytes,{})).instance.exports;}
function snapshot(s){return new Float32Array(s.memory.buffer,s.sim_entity_ptr(),s.sim_entity_count()*12).slice();}
function advance(s,n){for(let i=0;i<n;i++)s.sim_step(1000/60);}
test('production excludes sandbox mutation exports and developer entry pages',async()=>{
 const s=await load(normal);assert.equal(s.sim_lab_init,undefined);assert.equal(s.sim_lab_prepare,undefined);
 assert.equal(typeof s.sim_kind_stat,'function');assert.equal(typeof s.sim_research_status,'function');
 assert.deepEqual(readdirSync('dist').filter(f=>f.endsWith('.html')),['index.html']);
 assert.equal(existsSync('dist/tools/sim.workshop.wasm'),false);
 for(const f of readdirSync('dist/assets').filter(f=>f.endsWith('.js')))assert.ok(!readFileSync(`dist/assets/${f}`,'utf8').includes('starhold-workshop-v1'));
});
test('frozen showcase retains its established tuple and exact baseline snapshot',async()=>{
 const s=await load(normal);s.sim_init(1);advance(s,6480);
 assert.equal(s.sim_entity_count(),55);assert.equal(s.sim_alloy(),247);assert.equal(s.sim_charge(),199);
 assert.ok(existsSync('workshop-evidence/baseline.wasm'),'Build the pinned baseline before running verification.');
 const base=await load(readFileSync('workshop-evidence/baseline.wasm'));base.sim_init(1);advance(base,6480);
 assert.deepEqual(snapshot(s),snapshot(base));
});
test('all thirty actors and twelve research definitions come from WASM',async()=>{
 const s=await load();s.sim_lab_init(7319,0,1,30,22,1);
 const roster=readRoster(s),research=readResearch(s);assert.equal(roster.length,30);assert.equal(research.length,12);
 assert.equal(readDefinition(s,30).producer,63);assert.equal(readDefinition(s,999),null);
 assert.equal(research.filter(n=>n.faction===1).length,6);
});
test('paid preparation preserves battle time and mutually exclusive choices',async()=>{
 const s=await load();s.sim_lab_init(7319,0,1,30,22,1);
 assert.equal(s.sim_lab_prepare(203),0);assert.equal(s.sim_lab_prepare(202),1);assert.equal(s.sim_lab_prepare(203),1);
 assert.equal(s.sim_lab_prepare(204),0);assert.equal(s.sim_lab_tick(),0);assert.equal(s.sim_lab_preparation_ticks(),2640);
 assert.equal(s.sim_alloy(),448);assert.equal(s.sim_charge(),270);
});
test('authoritative arrow origin matches both rendered rigs in every facing',async()=>{
 for(const variant of ['field','longbow']){
  const boxes=[];drawAshJackal({box(...args){boxes.push(args);}},0,0,0,0,{state:2,phase:.5,tick:25,cooldown:1},variant);
  assert.ok(boxes.some(b=>b[0]===1&&b[1]===.3&&b[2]===1.15&&b[3]===.1&&b[4]===.12&&b[5]===.1));
  for(let i=0;i<8;i++){
   const yaw=i*Math.PI/4,p=jackalReleasePoint(10,20,.5,yaw);
   assert.ok(Math.abs(Math.hypot(p.x-10,p.y-20)-Math.hypot(.6,.18))<1e-6);assert.equal(p.z,1.22);
  }
 }
 const s=await load();s.sim_lab_init(7319,0,1,30,22,1);advance(s,25);
 const stride=s.sim_lab_event_stride(),events=new Float32Array(s.memory.buffer,s.sim_lab_event_ptr(),s.sim_lab_event_count()*stride);
 const shot=Array.from({length:events.length/stride},(_,i)=>events.slice(i*stride,(i+1)*stride)).find(r=>r[1]===2);
 assert.ok(shot);const origin=jackalReleasePoint(29.5,29.5,.5,0);
 for(const [offset,key] of [[5,'x'],[6,'y'],[7,'z']])assert.ok(Math.abs(shot[offset]-origin[key])<1e-5);assert.equal(shot[8],.5);
});
test('research paths have deterministic outcomes through actual combat',async()=>{
 for(const path of [[],[202],[202,203],[202,204]]){
  const run=async()=>{const s=await load();s.sim_lab_init(7319,0,1,30,22,1);for(const id of path)assert.equal(s.sim_lab_prepare(id),1);advance(s,360);return snapshot(s);};
  assert.deepEqual(await run(),await run());
 }
});
test('Ash Jackal contract governs immutable candidates and all required asset gates',()=>{
 assert.equal(ASH_JACKAL_CONTRACT.kind,30);assert.equal(ASH_JACKAL_CONTRACT.civilization,1);
 assert.deepEqual([...ASH_JACKAL_CONTRACT.animation.requiredStates],['idle','walk','attack','wreck']);
 assert.equal(ASH_JACKAL_CONTRACT.review.humanApprovalRequired,true);
 assert.equal(ASH_JACKAL_CONTRACT.review.approvalPromotesRuntime,false);
 assert.equal(ASH_JACKAL_HUMAN_CRITERIA.length,4);
 assert.equal(new Set(ASH_JACKAL_CANDIDATES.map(c=>c.revision)).size,ASH_JACKAL_CANDIDATES.length);
 assert.equal(candidateCatalogMatchesRenderer(),true);
 for(const candidate of ASH_JACKAL_CANDIDATES){
  const gates=evaluateAshJackalCandidate(candidate.id),failed=gates.filter(g=>!g.pass);
  assert.ok(gates.length>=8,`${candidate.revision} must have a meaningful technical gate set`);
  assert.deepEqual(failed,[],`${candidate.revision} failed: ${failed.map(g=>`${g.id}: ${g.detail}`).join('; ')}`);
 }
});
test('Ash Jackal wreck is a distinct terminal presentation',()=>{
 for(const variant of ['field','longbow']){
  const idle=[],wreck=[];
  drawAshJackal({box(...args){idle.push(args);}},0,0,0,0,{state:0,phase:0,tick:0},variant);
  drawAshJackal({box(...args){wreck.push(args);}},0,0,0,0,{state:4,phase:1,tick:36},variant);
  assert.notDeepEqual(wreck,idle);
  const top=Math.max(...wreck.map(b=>b[2]+b[5]));assert.ok(top<=ASH_JACKAL_CONTRACT.technicalLimits.maxWreckHeight);
 }
});
