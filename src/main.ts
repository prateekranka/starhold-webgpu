import {mountMatchResearch} from './research-panel';
import type {ContentAbi} from './content-api';
import './style.css';
import {Renderer, RENDER_WIDTH, RENDER_HEIGHT, buttonGlyphPixels, type PlacementPreview} from './renderer';
import {State, names, jobs} from './kinds';
import {Hud, HQ_POP_CAP, isBuildingKind, isUnitKind, type HudView, type SimAbi} from './hud';
import {palette} from './kinds';
/** Frozen ABI plus the wave-2 additions (docs/MATCH_SPEC.md §2). */
type SimExports = SimAbi & WebAssembly.Exports;
interface App {
 ready:boolean;error:string|null;
 getState():{touch:boolean;yawSteps:number;zoom:number;selected:number|null;entityCount:number;fps:number|null;frameStats:{drawCalls:number;triangles:number}|null;
  mode:number;outcome:number;outcomeTick:number;player:number;age:number;ageProgress:number;popUsed:number;popCap:number;alloy:number;charge:number;selectedKind:number|null;actions:number[];
  worldTiles:number;worldMeters:number;camera:{x:number;y:number};minimap:{open:boolean}};
 /** Read-only heightfield sample: level codes on a fixed grid. */
 terrainSample(step:number):{side:number;stride:number;levels:number[]};
 /** Read-only actor view: one row per live entity. */
 entityProbe():{index:number;kind:number;faction:number;x:number;y:number;z:number;state:number;health:number;progress:number}[];
 rotate(dir:1|-1):void;zoomBy(delta:1|-1):void;selectAt(x:number,y:number):void;fastForward(seconds:number):void;
 startMatch(faction:0|1):void;resetShowcase():void;command(op:number,a:number,b:number):number;
 selectEntity(index:number):boolean;selectKind(kind:number):boolean;
 /** Distinct entity kinds in the current snapshot (read-only coverage probe). */
 kinds():number[];
 /** Screen centre (CSS px) of the first live entity of a kind, or null. The
  * harness taps this exact live position instead of scanning guessed points.
  * Read-only: it never selects, moves, or mutates simulation state. */
 entityScreen(kind:number,faction:number):{x:number;y:number}|null;
 tileScreen(tx:number,ty:number):{x:number;y:number}|null;
 /** A detached, read-only snapshot of the world footprint; never issues orders. */
 placement():PlacementPreview;
}
declare global {interface Window {__APP:App}}
let yawSteps=0,zoomIndex=1,sim:SimExports|undefined,entities=new Float32Array(0),entityCount=0,selected:number|null=null,fps:number|null=null;
let seed=73129;
const zooms=[4/3,1,4/5,2/3];
const renderer=new Renderer();
const touchLayout=navigator.maxTouchPoints>0||matchMedia('(pointer: coarse)').matches;
document.body.classList.add(touchLayout?'touch':'mouse');
renderer.hudButtons=!touchLayout;
const hud=new Hud({command:(op,a,b)=>command(op,a,b),build:(kind)=>beginPlacement(kind),startMatch:(faction)=>startMatch(faction),resetShowcase:()=>resetShowcase()});
// ---- Floating minimap (LARGEMAP_SPEC §6) ----------------------------------
const minimap=document.getElementById('minimap') as HTMLElement;
const minimapCanvas=document.getElementById('minimap-canvas') as HTMLCanvasElement;
const minimapContext=minimapCanvas.getContext('2d')!;
const MINIMAP=256;
let minimapTerrain:ImageData|null=null,minimapSide=0,minimapStamp=-1000,minimapDrag:number|null=null,minimapGrabX=0,minimapGrabY=0,minimapMoved=0;
const minimapHex=(index:number)=>`#${palette[index]}`;
/** Terrain bitmap for the active map: 4 tiles per pixel in the world, 8 in the
 *  showcase. Rebuilt when the map changes, never per frame. */
function minimapBuild():void {
 const view=terrainView(),side=sideOf();
 const image=minimapContext.createImageData(MINIMAP,MINIMAP);
 const step=side/MINIMAP;
 const rgb=new Map<number,number[]>();
 // Void, low shore, mesa, plateau: three separated steps so plateaus read.
 const shade=(h:number)=>h<0?0:h<0.25?28:h<0.75?30:31;
 const colour=(index:number)=>{
  let value=rgb.get(index);
  if(!value) {const hex=palette[index];value=[parseInt(hex.slice(0,2),16),parseInt(hex.slice(2,4),16),parseInt(hex.slice(4,6),16)];rgb.set(index,value);}
  return value;
 };
 for(let py=0;py<MINIMAP;py++)for(let px=0;px<MINIMAP;px++) {
  const tile=shade(view[Math.min(side-1,Math.floor(py*step))*side+Math.min(side-1,Math.floor(px*step))]);
  const c=colour(tile),i=(py*MINIMAP+px)*4;
  image.data[i]=c[0];image.data[i+1]=c[1];image.data[i+2]=c[2];image.data[i+3]=255;
 }
 minimapTerrain=image;minimapSide=side;
}
/** Redraw the panel at 10 Hz: terrain plate, entity dots, camera window. */
function minimapDraw(force=false):void {
 if(minimap.classList.contains('off'))return;
 if(!force&&performance.now()-minimapStamp<100)return;
 minimapStamp=performance.now();
 if(!minimapTerrain||minimapSide!==sideOf())minimapBuild();
 if(!minimapTerrain)return;
 minimapContext.putImageData(minimapTerrain,0,0);
 const scale=MINIMAP/minimapSide;
 for(let i=0;i<entityCount;i++) {
  const kind=entities[i*12+4];
  const ore=kind===40;
  if(!ore&&!isUnitKind(kind)&&!isBuildingKind(kind))continue;
  minimapContext.fillStyle=minimapHex(ore?22:entities[i*12+9]===1?25:13);
  const size=ore?1:2;
  minimapContext.fillRect(Math.floor(entities[i*12]*scale),Math.floor(entities[i*12+1]*scale),size,size);
 }
 const reach=Math.max(5,24*zooms[zoomIndex]);
 minimapContext.strokeStyle=minimapHex(9);minimapContext.lineWidth=2;
 minimapContext.strokeRect(Math.floor((camX-reach)*scale)+.5,Math.floor((camY-reach)*scale)+.5,Math.ceil(reach*2*scale),Math.ceil(reach*2*scale));
}
/** Read-only view of the live actors, for the capture harness and playtests.
 *  Nothing here selects, moves or mutates state. */
function entityProbe():{index:number;kind:number;faction:number;x:number;y:number;z:number;state:number;health:number;progress:number}[] {
 const out=[];for(let i=0;i<entityCount;i++)out.push({index:i,kind:entities[i*12+4],faction:entities[i*12+9],x:entities[i*12],y:entities[i*12+1],z:entities[i*12+2],state:entities[i*12+5],health:entities[i*12+7],progress:entities[i*12+10]});
 return out;
}
/** Read-only heightfield sample on a fixed grid, for the capture harness. */
function terrainSample(step:number):{side:number;stride:number;levels:number[]} {
 const view=terrainView(),side=sideOf(),stride=Math.max(1,Math.floor(step)||1),levels:number[]=[];
 for(let y=0;y<side;y+=stride)for(let x=0;x<side;x+=stride)levels.push(view[y*side+x]);
 return {side,stride,levels};
}
function minimapInvalidate():void {minimapTerrain=null;minimapSide=0;minimapDraw(true);}
function setMinimapOpen(open:boolean):void {minimap.classList.toggle('off',!open);if(open)minimapDraw(true);}
/** Centre the camera on the tapped tile, the same way a drag pans it. */
function minimapJump(clientX:number,clientY:number):void {
 if(worldSide<=0)return;
 const rect=minimapCanvas.getBoundingClientRect();
 if(!rect.width||!rect.height)return;
 renderer.setView((clientX-rect.left)/rect.width*worldSide,(clientY-rect.top)/rect.height*worldSide);
 camX=renderer.viewX;camY=renderer.viewY;reprojectPlacement();minimapDraw(true);
}
minimap.addEventListener('pointerdown',e=>{
 if((e.target as HTMLElement).id==='minimap-close')return;
 const rect=minimap.getBoundingClientRect();
 minimapDrag=e.pointerId;minimapMoved=0;minimapGrabX=e.clientX-rect.left;minimapGrabY=e.clientY-rect.top;
 minimap.setPointerCapture(e.pointerId);e.preventDefault();
});
minimap.addEventListener('pointermove',e=>{
 if(minimapDrag!==e.pointerId)return;
 if(e.pointerType==='mouse')minimapMoved+=Math.abs(e.movementX)+Math.abs(e.movementY);
 else {const rect=minimap.getBoundingClientRect();minimapMoved+=Math.abs(e.clientX-rect.left-minimapGrabX)+Math.abs(e.clientY-rect.top-minimapGrabY);}
 const w=minimap.offsetWidth,h=minimap.offsetHeight;
 const x=Math.max(0,Math.min(innerWidth-w,e.clientX-minimapGrabX));
 const y=Math.max(0,Math.min(innerHeight-h,e.clientY-minimapGrabY));
 minimap.style.left=`${x}px`;minimap.style.top=`${y}px`;minimap.style.right='auto';minimap.style.bottom='auto';
 e.preventDefault();
});
minimap.addEventListener('pointerup',e=>{
 if(minimapDrag!==e.pointerId)return;
 minimapDrag=null;
 if(minimapMoved<=6)minimapJump(e.clientX,e.clientY);
});
minimap.addEventListener('pointercancel',()=>{minimapDrag=null;});
document.getElementById('minimap-close')!.addEventListener('click',()=>setMinimapOpen(false));
document.getElementById('hud-minimap')!.addEventListener('click',()=>setMinimapOpen(minimap.classList.contains('off')));

function rotate(dir:1|-1) {yawSteps=(yawSteps+(dir===-1?-1:1)+4)%4;reprojectPlacement();}
/** Drag the world under the pointer. Screen pixels in, world tiles out, using
 *  the same quarter-turn rotation and magnification the shader applies. */
function panBy(dxCss:number,dyCss:number):boolean {
 if(worldSide<=0)return false;
 const rect=canvas.getBoundingClientRect();
 if(!rect.width||!rect.height)return false;
 const scale=rect.width/RENDER_WIDTH,zoom=zooms[zoomIndex];
 const c=Math.round(Math.cos(yawSteps*Math.PI/2)),s2=Math.round(Math.sin(yawSteps*Math.PI/2));
 const hx=6*2/zoom*scale,hy=3.4641016*2/zoom*scale;
 const drx=.5*(dxCss/hx+dyCss/hy),dry=.5*(dyCss/hy-dxCss/hx);
 const du=drx*c+dry*s2,dv=-drx*s2+dry*c;
 renderer.setView(camX-du,camY-dv);
 camX=renderer.viewX;camY=renderer.viewY;
 return true;
}
function zoomBy(delta:1|-1) {zoomIndex=Math.max(0,Math.min(3,zoomIndex+(delta===-1?-1:1)));reprojectPlacement();}
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
function simOutcome():number {const s=sim;return s&&typeof s.sim_outcome==='function'?s.sim_outcome()>>>0:0;}
function simOutcomeTick():number {const s=sim;return s&&typeof s.sim_outcome_tick==='function'?s.sim_outcome_tick()>>>0:0;}
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
// Expansive world state (LARGEMAP_SPEC §2, §5). worldSide is 0 in the showcase,
// so every helper below falls back to the authored 32x32 behaviour.
let worldSide=0,worldTerrain=new Float32Array(0),camX=16,camY=16;
function sideOf():number {return worldSide>0?worldSide:32;}
/** The world heightfield, re-viewed if wasm memory grew since the last look. */
function worldView():Float32Array {
 if(!sim||worldSide===0)return worldTerrain;
 const pointer=sim.sim_world_ptr?sim.sim_world_ptr():0;
 if(pointer&&worldTerrain.buffer!==sim.memory.buffer)worldTerrain=new Float32Array(sim.memory.buffer,pointer,worldSide*worldSide);
 return worldTerrain;
}
const clampTile=(value:number)=>Math.max(0,Math.min(sideOf()-1,Math.floor(value)||0));
const tileOf=(x:number,y:number)=>clampTile(x)+clampTile(y)*sideOf();
function currentKind():number|null {return selected===null||selected*12+4>=entities.length?null:entities[selected*12+4];}
let showcaseTerrain=new Float32Array(0);
/** The active heightfield as a live view: the generated world in a world match,
 *  else the sim's 32x32 showcase grid. Cached, so per-call cost is an index. */
function terrainView():Float32Array {
 if(!sim)return showcaseTerrain;
 if(worldSide>0)return worldView();
 const pointer=sim.sim_terrain_ptr?sim.sim_terrain_ptr():0;
 if(pointer&&showcaseTerrain.buffer!==sim.memory.buffer)showcaseTerrain=new Float32Array(sim.memory.buffer,pointer,1024);
 return showcaseTerrain;
}
/** Terrain height at a tile. Heights are -1 void, 0/0.5/1 land. */
function terrainAt(tile:number):number {
 const view=terrainView();
 return tile<0||tile>=view.length?0:view[tile];
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
const view:HudView={ready:false,match:false,mode:0,outcome:0,player:0,age:0,ageProgress:1,ageCost:0,ageCostCharge:0,alloy:0,charge:0,popUsed:0,popCap:0,selected:null,selectedKind:null,selectedState:-1,tile:0,placementKind:null,placementValid:false};
/** Push the current sim/selection state into the DOM bar. The view object is
 *  reused, so the bar never allocates per frame. */
function syncHud() {
 refreshPlacement();
 view.ready=window.__APP.ready;
 view.match=matchAbi();
 view.mode=simMode();
 view.outcome=simOutcome();
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
 view.placementKind=placementState.active?placementState.kind:null;
 view.placementValid=placementState.valid;
 hud.update(sim,view);
}
function startMatch(faction:0|1) {
 if(!sim||typeof sim.sim_match_init!=='function')return;
 cancelPlacement();
 sim.sim_match_init(seed>>>0,faction===1?1:0);
 yawSteps=0;zoomIndex=1;
 worldTerrain=new Float32Array(0);
 worldSide=typeof sim.sim_world_size==='function'?sim.sim_world_size():0;
 if(worldSide>0) {
  const player=faction===1?1:0;
  camX=sim.sim_base_x?sim.sim_base_x(player):worldSide/2;camY=sim.sim_base_y?sim.sim_base_y(player):worldSide/2;
  renderer.setWorld(worldView(),worldSide,camX,camY);
 }
 minimapInvalidate();
 resetClock();selectDefault();
}
function resetShowcase() {
 if(!sim)return;
 cancelPlacement();
 worldSide=0;worldTerrain=new Float32Array(0);showcaseTerrain=new Float32Array(0);camX=16;camY=16;renderer.setShowcase();minimapInvalidate();
 sim.sim_init(seed>>>0);
 resetClock();selectDefault();
}
function command(op:number,a:number,b:number):number {
 if(placementState.active){
  cancelPlacement();
  if(op===3){syncHud();return 1;}
 }
 if(!sim||typeof sim.sim_command!=='function')return 0;
 const accepted=sim.sim_command(op>>>0,a>>>0,b>>>0);
 refreshEntities();updateSelection();syncHud();
 return accepted?1:0;
}
/** One unpaid player intent. All acceptance, extents and builder ownership come
 * from Rust. Nothing here steps the sim or issues a speculative build command. */
const placementState:PlacementPreview={active:false,kind:null,tx:-1,ty:-1,valid:false};
let placementSelection=0,placementBuilder=0,placementWidth=0,placementDepth=0,placementTick=-1;
let placementPointerX:number|null=null,placementPointerY=0;
function cancelPlacement():void {
 placementState.active=false;placementState.kind=null;placementState.tx=-1;placementState.ty=-1;placementState.valid=false;
 placementSelection=0;placementBuilder=0;placementPointerX=null;placementTick=-1;
 renderer.setPlacement(placementState);
}
function placementTile():number {
 const {tx,ty}=placementState,side=sideOf();
 return tx<0||ty<0||tx>=side||ty>=side?side*side:tx+ty*side;
}
function refreshPlacement(force=false):void {
 if(!placementState.active||!sim)return;
 if(simMode()!==1||simOutcome()!==0||sim.sim_selected_token?.()!==placementSelection||
  !sim.sim_builder_ready?.(placementSelection)||(placementBuilder!==0&&!sim.sim_builder_ready?.(placementBuilder))){cancelPlacement();return;}
 if(!force&&placementTick===tick)return;
 placementTick=tick;
 const valid=sim.sim_can_place?.(placementState.kind!,placementTile())===1;
 const changed=placementState.valid!==valid;placementState.valid=valid;
 if(force||changed)renderer.setPlacement(placementState,placementWidth,placementDepth);
}
function setPlacementTile(tx:number,ty:number):void {
 if(!placementState.active||!sim)return;
 const changed=placementState.tx!==tx||placementState.ty!==ty;
 placementState.tx=tx;placementState.ty=ty;
 if(changed)placementBuilder=sim.sim_build_builder?.(placementTile())??0;
 refreshPlacement(true);
}
function beginPlacement(kind:number):number {
 cancelPlacement();
 if(!sim||selected===null||simMode()!==1||simOutcome()!==0||!sim.sim_can_build?.(kind)){syncHud();return 0;}
 // Older wasm keeps the original fallback. Current wasm always previews first.
 if(!sim.sim_can_place||!sim.sim_build_extent||!sim.sim_selected_token||!sim.sim_build_builder||!sim.sim_builder_ready)return buildNearest(kind);
 const sx=Math.floor(entities[selected*12]),sy=Math.floor(entities[selected*12+1]),side=sideOf();
 let initial=-1;
 // Ask the simulation for a nearby starting candidate (usable without hover).
 for(let radius=0;radius<=26&&initial<0;radius++)for(let dy=-radius;dy<=radius&&initial<0;dy++)for(let dx=-radius;dx<=radius;dx++){
  if(Math.max(Math.abs(dx),Math.abs(dy))!==radius)continue;
  const x=sx+dx,y=sy+dy;
  if(x>=0&&y>=0&&x<side&&y<side&&sim.sim_can_place(kind,x+y*side)){initial=x+y*side;break;}
 }
 // Preserve the old bounded fallback when Rust reports no nearby candidate.
 if(initial<0)return buildNearest(kind);
 placementState.active=true;placementState.kind=kind;
 placementSelection=sim.sim_selected_token();
 placementWidth=sim.sim_build_extent(kind,0);placementDepth=sim.sim_build_extent(kind,1);
 setPlacementTile(initial%side,Math.floor(initial/side));syncHud();return 1;
}
/** Inverse of the orthographic tile projection. Intersect terrain caps from
 * high to low; actor art never diverts a placement onto a building's roof. */
function movePlacement(x:number,y:number):void {
 if(!placementState.active)return;
 placementPointerX=x;placementPointerY=y;
 const rect=canvas.getBoundingClientRect();
 if(x<rect.left||y<rect.top||x>=rect.right||y>=rect.bottom){setPlacementTile(-1,-1);return;}
 const px=(x-rect.left)*RENDER_WIDTH/rect.width,py=(y-rect.top)*RENDER_HEIGHT/rect.height;
 const diff=(px/2-240)*zooms[zoomIndex]/6,base=(py/2-136)*zooms[zoomIndex]/3.4641016;
 const c=Math.round(Math.cos(yawSteps*Math.PI/2)),s=Math.round(Math.sin(yawSteps*Math.PI/2)),side=sideOf();
 for(const z of [1,.5,0]){
  const a=(base+2*z+diff)/2,b=(base+2*z-diff)/2;
  const tx=Math.floor(camX+c*a+s*b),ty=Math.floor(camY-s*a+c*b);
  if(z===0||(tx>=0&&ty>=0&&tx<side&&ty<side&&terrainAt(tx+ty*side)===z)){setPlacementTile(tx,ty);return;}
 }
}
function reprojectPlacement():void {
 if(placementPointerX!==null)movePlacement(placementPointerX,placementPointerY);
}
function worldTap(x:number,y:number):void {
 if(!placementState.active){selectAt(x,y);return;}
 movePlacement(x,y);
 if(!placementState.active||!placementState.valid||!sim)return;
 const accepted=sim.sim_command?.(1,placementState.kind!,placementTile());
 if(accepted)cancelPlacement();
 refreshEntities();updateSelection();syncHud();
}
/** Legacy nearest-site path remains available for old ABI/no-site fallback.
 * The simulation's AI still uses its own unchanged nearest-site planner. */
function buildNearest(kind:number):number {
 if(!sim||typeof sim.sim_command!=='function'||selected===null)return 0;
 const sx=entities[selected*12],sy=entities[selected*12+1];
 const side=sideOf();
 // A bounded window around the builder: the world is 1M tiles, so the search
 // stays local and Rust remains authoritative for the final placement.
 const reach=worldSide>0?26:side;
 const bx=Math.floor(sx),by=Math.floor(sy);
 const tiles:number[]=[];
 for(let y=Math.max(0,by-reach);y<=Math.min(side-1,by+reach);y++)for(let x=Math.max(0,bx-reach);x<=Math.min(side-1,bx+reach);x++){
  const tile=tileOf(x,y);
  if(tiles.includes(tile)||terrainAt(tile)<=0||tileOccupied(tile,selected))continue;
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
/** Screen centre (CSS px) of the first live entity of a kind, or null. Uses the
 *  same forward projection the vertex shader applies (grid 2, magnification
 *  1/zoom, rounded quarter-turn rotation), so a tap on the returned point lands
 *  on that entity's own box. Read-only: nothing is selected or moved. */
function entityScreen(kind:number,faction:number):{x:number;y:number}|null {
 if(!sim)return null;
 let fallback:{x:number;y:number}|null=null;
 for(let i=0;i<entityCount;i++){
  if(entities[i*12+4]!==kind||entities[i*12+9]!==faction)continue;
  const state=entities[i*12+5];
  if(state===State.Death)continue;
  const rect=canvas.getBoundingClientRect();
  if(!rect.width||!rect.height)return null;
  const zoom=zooms[zoomIndex],c=Math.round(Math.cos(yawSteps*Math.PI/2)),s=Math.round(Math.sin(yawSteps*Math.PI/2));
  // The live view centre, so the point is correct on the 10 km map too.
  // Aim at the middle of the body, not at its feet: a tall neighbour in front
  // would otherwise occlude the tap point of a small unit.
  const rise=isBuildingKind(kind)?1.2:.55;
  const dx=entities[i*12]-camX,dy=entities[i*12+1]-camY,z=entities[i*12+2]+rise;
  const rx=dx*c-dy*s,ry=dx*s+dy*c;
  const px=2*(240+6*(rx-ry)/zoom),py=2*(136+3.4641016*(rx+ry)/zoom-6.9282032*z/zoom);
  // The projected centre can miss the drawn body: the renderer's own actor box
  // is the authority on where the pixels are. Scan outwards from the centre and
  // return the first point whose tap really resolves to this entity. pick() is
  // read-only, so the scan changes no state.
  const offsets:[number,number][]=[[0,0]];
  for(let r=4;r<=56;r+=4)for(let a=0;a<10;a++)offsets.push([Math.round(Math.cos(a*Math.PI/5)*r),Math.round(Math.sin(a*Math.PI/5)*r)]);
  const centre={x:rect.left+px*rect.width/RENDER_WIDTH,y:rect.top+py*rect.height/RENDER_HEIGHT};
  if(!fallback)fallback=centre;
  for(const [ox,oy] of offsets) {
   if(renderer.pick(px+ox,py+oy,yawSteps,zoom)!==i)continue;
   return {x:rect.left+(px+ox)*rect.width/RENDER_WIDTH,y:rect.top+(py+oy)*rect.height/RENDER_HEIGHT};
  }
  // This entity is buried under a neighbour's art; try the next one of its kind
  // and remember this centre in case none is reachable.
 }
 return fallback;
}
/**
 * Read-only: the screen point of a world tile centre, through the same projection
 * the entity probe uses. The harness taps known-empty ground with this so that a
 * "a ground tap clears the selection" check never has to guess a screen point,
 * and never goes through the pick it is testing.
 */
function tileScreen(tx:number,ty:number):{x:number;y:number}|null {
 const rect=canvas.getBoundingClientRect();
 if(!rect.width||!rect.height)return null;
 const zoom=zooms[zoomIndex],c=Math.round(Math.cos(yawSteps*Math.PI/2)),s=Math.round(Math.sin(yawSteps*Math.PI/2));
 const side=sideOf();
 const z=worldSide>0&&tx>=0&&ty>=0&&tx<side&&ty<side?Math.max(0,worldView()[Math.floor(ty)*side+Math.floor(tx)]):1;
 const dx=tx-camX,dy=ty-camY;
 const rx=dx*c-dy*s,ry=dx*s+dy*c;
 const px=2*(240+6*(rx-ry)/zoom),py=2*(136+3.4641016*(rx+ry)/zoom-6.9282032*z/zoom);
 if(px<0||py<0||px>RENDER_WIDTH||py>RENDER_HEIGHT)return null;
 return {x:rect.left+px*rect.width/RENDER_WIDTH,y:rect.top+py*rect.height/RENDER_HEIGHT};
}
window.__APP={ready:false,error:null,getState:()=>({touch:touchLayout,yawSteps,zoom:zooms[zoomIndex],selected,entityCount,fps,frameStats:window.__APP.ready?renderer.stats:null,
 mode:simMode(),outcome:simOutcome(),outcomeTick:simOutcomeTick(),player:simPlayer(),age:simAge(),ageProgress:simAgeProgress(),popUsed:simPopUsed(),popCap:simPopCap(),
 alloy:sim?sim.sim_alloy():0,charge:sim?sim.sim_charge():0,selectedKind:currentKind(),actions:hud.actions(),
 worldTiles:worldSide,worldMeters:worldSide*(sim&&typeof sim.sim_metres_per_tile==='function'?sim.sim_metres_per_tile():10),camera:{x:camX,y:camY},minimap:{open:!minimap.classList.contains('off')}}),
 rotate,zoomBy,selectAt,fastForward,startMatch,resetShowcase,command,selectEntity,selectKind,kinds,entityScreen,tileScreen,terrainSample,entityProbe,placement:()=>({...placementState})};
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
 const safeH=innerHeight-read('--safe-t')-read('--safe-b');
 // SCREEN_USE_SPEC: on a landscape touch viewport the interface overlays the
 // world instead of reserving a strip of it. Fitting the 960x540 target into the
 // space the bar leaves costs a third of a phone screen in empty black bars
 // (42.6% measured at 844x390), so there the fit uses the whole viewport and the
 // bar sits over the canvas; elsewhere the bar keeps its own strip. The canvas
 // keeps its aspect and its backing store, and the body clips the overflow.
 const landscapeTouch=touchLayout&&availW>safeH;
 // Fill only when the 960x540 target cannot be shown at native size (a phone).
 // Above 1x the pixel rule wins instead, or the canvas would grow past the safe
 // area: with 44px insets on a tablet, filling asked for 1.14x and the integer
 // step produced a canvas 24px wider than the screen.
 const fill=landscapeTouch&&Math.max(availW/RENDER_WIDTH,safeH/RENDER_HEIGHT)<1;
 const availH=safeH-(fill?0:hudHeight());
 const fit=fill?Math.max(availW/RENDER_WIDTH,safeH/RENDER_HEIGHT):Math.min(availW/RENDER_WIDTH,availH/RENDER_HEIGHT);
 const scale=fit>=1?Math.floor(fit):Math.max(0.1,fit);
 viewport.style.width=`${RENDER_WIDTH*scale}px`;viewport.style.height=`${RENDER_HEIGHT*scale}px`;
 clampMinimap();
}
/** Keep a dragged minimap inside the viewport. A panel moved in portrait keeps
 *  inline pixel offsets, so after a rotation it can end up off-screen; pull it
 *  back instead of leaving the player without it. */
function clampMinimap() {
 if(!minimap||minimap.classList.contains('off'))return;
 if(!minimap.style.left)return;
 const w=minimap.offsetWidth,h=minimap.offsetHeight;
 if(!w||!h)return;
 const x=Math.max(0,Math.min(Math.max(0,innerWidth-w),parseFloat(minimap.style.left)||0));
 const y=Math.max(0,Math.min(Math.max(0,innerHeight-h),parseFloat(minimap.style.top)||0));
 minimap.style.left=`${x}px`;minimap.style.top=`${y}px`;
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
window.addEventListener('keydown',e=>{if(e.key==='Escape'&&placementState.active){e.preventDefault();cancelPlacement();syncHud();}});
canvas.addEventListener('click',e=>{if(mousePanned){mousePanned=false;return;}worldTap(e.clientX,e.clientY);});
let mouseDown=false,mousePanned=false,mouseX=0,mouseY=0;
canvas.addEventListener('pointerdown',e=>{
 if(e.pointerType!=='mouse')return;
 if(placementState.active){movePlacement(e.clientX,e.clientY);return;}
 mouseDown=true;mousePanned=false;mouseX=e.clientX;mouseY=e.clientY;
});
window.addEventListener('pointermove',e=>{
 if(e.pointerType==='mouse'&&placementState.active){movePlacement(e.clientX,e.clientY);return;}
 if(!mouseDown||e.pointerType!=='mouse')return;
 const dx=e.clientX-mouseX,dy=e.clientY-mouseY;mouseX=e.clientX;mouseY=e.clientY;
 if(!mousePanned&&Math.abs(dx)+Math.abs(dy)>3)mousePanned=true;
 if(mousePanned)panBy(dx,dy);
});
window.addEventListener('pointerup',e=>{if(e.pointerType==='mouse')mouseDown=false;});
const activePointers=new Map<number,{x:number;y:number}>();
let downX=0,downY=0,downAt=0,pinched=false,panning=false,pinchStartDist=0,pinchStartZoom=0;
let suppressPointerClick=false;
function resetGesture() {
 pinched=false;panning=false;pinchStartDist=0;pinchStartZoom=0;downX=0;downY=0;downAt=0;
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
 if(placementState.active&&activePointers.size===1)movePlacement(e.clientX,e.clientY);
 if(activePointers.size===2){
  pinched=true;pinchStartZoom=zoomIndex;
  const distance=pointerDistance();pinchStartDist=distance<20?0:distance;
 }
});
canvas.addEventListener('pointermove',e=>{
 const point=activePointers.get(e.pointerId);
 if(e.pointerType==='mouse'||!point)return;
 e.preventDefault();
 // A one-finger drag past the tap threshold pans the world; a short touch that
 // stays inside the threshold still selects (MATCH_SPEC §7).
 const moveX=e.clientX-point.x,moveY=e.clientY-point.y;
 if(!placementState.active&&activePointers.size===1&&!pinched&&(panning||Math.hypot(e.clientX-downX,e.clientY-downY)>12)){panning=panBy(moveX,moveY);}
 point.x=e.clientX;point.y=e.clientY;
 if(placementState.active&&activePointers.size===1&&!pinched)movePlacement(e.clientX,e.clientY);
 if(activePointers.size===2&&pinched&&pinchStartDist>=20){
  const ratio=pointerDistance()/pinchStartDist;
  const steps=Math.round(Math.log(ratio)/Math.log(1.4));
  zoomIndex=Math.max(0,Math.min(3,pinchStartZoom+steps));reprojectPlacement();
 }
});
canvas.addEventListener('pointerup',e=>{
 if(e.pointerType==='mouse'||!activePointers.has(e.pointerId))return;
 e.preventDefault();
 if(activePointers.size===1&&!pinched&&!panning&&Math.hypot(e.clientX-downX,e.clientY-downY)<=12&&e.timeStamp-downAt<=400)worldTap(e.clientX,e.clientY);
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
let researchUI:ReturnType<typeof mountMatchResearch>|null=null;
let previous=0,accumulator=0,windowStart=0,frames=0,tick=0;
function frame(now:number) {
 if(window.__APP.error||!sim)return;
 try {
  if(previous===0){previous=now;windowStart=now;}
  accumulator+=Math.min(now-previous,250);previous=now;
  while(accumulator>=1000/60){sim.sim_step(1000/60);tick++;accumulator-=1000/60;}
  refreshEntities();updateSelection();syncHud();minimapDraw();researchUI?.update();
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
 await renderer.init(canvas,new Float32Array(sim.memory.buffer,sim.sim_terrain_ptr(),1024));renderer.onError(fatal);
 researchUI=mountMatchResearch(sim as unknown as ContentAbi);researchUI.update();
 renderer.kindHealth=(kind:number)=>(sim as unknown as ContentAbi).sim_kind_stat(kind,9);
 requestAnimationFrame(frame);
}
void boot().catch(fatal);
