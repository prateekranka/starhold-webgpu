/** Generated atlas geometry plus the pure frame selector.
 *
 * The numbers below are measured from the packed PNG written by
 * `scripts/build-jackal-atlas.py --sheet4x8`; regenerate both together and never
 * hand-edit the rectangle table. The packer emits a real alpha channel: the
 * background is alpha 0 and every opaque texel keeps alpha 255 whatever its RGB.
 * Never reintroduce a colour key here - keying on #10121C destroyed intentional ink.
 *
 * Atlas: eight facing columns x eight pose rows of 49x42 cells (a 47x40 payload
 * box plus a one-texel transparent gutter on every side) = 392x336, one texture.
 * Every stored frame fills the same payload box with the ground pivot at its
 * bottom centre, so no pose can move the feet and no caller may infer a pivot
 * from an opaque bounding box. Offsets are raster pixels at zoom 1.
 * No source PNG is fetched by the runtime.
 */
export const JACKAL_ATLAS_URL=new URL('./jackal-atlas/packed.png',import.meta.url).href;
export const JACKAL_ATLAS_WIDTH=392, JACKAL_ATLAS_HEIGHT=336;
/** One frame's drawing box, and the cell pitch that includes its 1 px gutter. */
export const JACKAL_PAYLOAD_W=47, JACKAL_PAYLOAD_H=40;
export const JACKAL_CELL_W=49, JACKAL_CELL_H=42;

export type JackalSpritePose='idle'|'walk'|'draw'|'released'|'fallen';
/** Pose row order inside every facing column. */
export const JACKAL_POSES=['idle','walk0','walk1','walk2','walk3','draw','released','fallen'] as const;
export interface JackalSpriteFrame {
 readonly facing:number;
 readonly pose:JackalSpritePose;
 readonly width:number;
 readonly height:number;
 readonly offsetX:number;
 readonly offsetY:number;
 readonly uv:readonly [number,number,number,number];
 /** Quarter-turn the standing art clockwise for the temporary fallen pose.
  *  Authored death art exists now, so every authored frame carries turn 0. */
 readonly turn:0|1;
}

/** Measured cells, `JACKAL_CELLS[facing][poseIndex]`, both in Forge order
 *  E,SE,S,SW,W,NW,N,NE and the pose order above. The manifest that carries the
 *  same bytes has atlas sha256 prefix 3414f5f4ccd891c5. The source sheet cell behind every frame is recorded per frame in
 *  jackal-atlas/manifest.json (sourceCell); that manifest is authoritative.
 *   SW/W/NW/N read r0c7 r1c7 r1c6 r1c5 r1c4 r2c6 r2c5 r3c7.
 *
 *  Facing is a documented limitation, not eight measured views: the source sheet
 *  holds two directions only and has no front or back view. E, SE, NE and S share
 *  the right-facing cells; W, SW, NW and N share the left-facing cells. Measured
 *  from the art itself, columns 0-3 carry the right-facing figure and columns
 *  4-7 the left-facing one (bow mass forward of the body centroid, calibrated on
 *  the shipped E/W/SE/SW/N/NE art). */
export const JACKAL_CELLS=[
 [[1,1,47,40], [1,43,47,40], [1,85,47,40], [1,127,47,40], [1,169,47,40], [1,211,47,40], [1,253,47,40], [1,295,47,40]],
 [[50,1,47,40], [50,43,47,40], [50,85,47,40], [50,127,47,40], [50,169,47,40], [50,211,47,40], [50,253,47,40], [50,295,47,40]],
 [[99,1,47,40], [99,43,47,40], [99,85,47,40], [99,127,47,40], [99,169,47,40], [99,211,47,40], [99,253,47,40], [99,295,47,40]],
 [[148,1,47,40], [148,43,47,40], [148,85,47,40], [148,127,47,40], [148,169,47,40], [148,211,47,40], [148,253,47,40], [148,295,47,40]],
 [[197,1,47,40], [197,43,47,40], [197,85,47,40], [197,127,47,40], [197,169,47,40], [197,211,47,40], [197,253,47,40], [197,295,47,40]],
 [[246,1,47,40], [246,43,47,40], [246,85,47,40], [246,127,47,40], [246,169,47,40], [246,211,47,40], [246,253,47,40], [246,295,47,40]],
 [[295,1,47,40], [295,43,47,40], [295,85,47,40], [295,127,47,40], [295,169,47,40], [295,211,47,40], [295,253,47,40], [295,295,47,40]],
 [[344,1,47,40], [344,43,47,40], [344,85,47,40], [344,127,47,40], [344,169,47,40], [344,211,47,40], [344,253,47,40], [344,295,47,40]],
] as const;

/** Sim yaw is atan2(dy,dx): +X = E, +Y = S.
 *
 * The art is SCREEN-relative - a right-facing profile - so the camera quarter-turn
 * is part of the heading. This mirrors the renderer's own projection exactly
 * (`rx = x*c - y*s`, `ry = x*s + y*c`, then screen x = rx-ry and screen y = rx+ry
 * squashed by 0.5773503). The squash cancels once the screen y is un-squashed for
 * the octant comparison, leaving the diagonal pair alone.
 *
 * Expected results for world yaw 0 are SE, SW, NW, NE at camera steps 0-3.
 */
export function jackalFacing(yaw:number,cameraQuarterTurn=0):number {
 const a=Number.isFinite(yaw)?yaw:0;
 const q=Number.isFinite(cameraQuarterTurn)?cameraQuarterTurn:0;
 const c=Math.cos(q*Math.PI/2),s=Math.sin(q*Math.PI/2);
 const dx=Math.cos(a),dy=Math.sin(a);
 const rx=dx*c-dy*s,ry=dx*s+dy*c;
 return ((Math.round(Math.atan2(rx+ry,rx-ry)/(Math.PI/4))%8)+8)%8;
}

// Draw and release are authored sheet frames now, not translations of a standing
// crop: pose 5 is the full-draw hold and pose 6 is the frame after release, both
// taken from the attack row of the source sheet. Neither moves the bow socket, so
// the release point the Rust simulation publishes is untouched. Do not reintroduce
// synthetic whole-body translations - they move the socket and cannot pass the
// motion gates in docs/ASH_JACKAL.md.
const poses=JACKAL_CELLS.map((row,facing)=>row.map((cell,pose)=>{
 const [x,y,width,height]=cell;
 const frame:JackalSpriteFrame={facing,pose:JACKAL_POSES[pose] as JackalSpritePose,width,height,
  offsetX:-Math.floor(width/2),offsetY:-height,
  uv:[x/JACKAL_ATLAS_WIDTH,y/JACKAL_ATLAS_HEIGHT,
   (x+width)/JACKAL_ATLAS_WIDTH,(y+height)/JACKAL_ATLAS_HEIGHT] as const,
  turn:0};
 return frame;
}));

/** Only snapshot state, action phase, the simulation tick and the camera turn
 * select a frame. No wall clock, no accumulation, no randomness. */
export function selectJackalFrame(yaw:number,state:number,phase:number,tick:number,cameraQuarterTurn=0):JackalSpriteFrame {
 const frames=poses[jackalFacing(yaw,cameraQuarterTurn)];
 const p=Number.isFinite(phase)?Math.max(0,Math.min(1,phase)):0;
 const t=Math.floor(Number.isFinite(tick)?tick:0);
 if(state===4)return frames[7];              // fallen, authored death frame
 if(state===2){
  if(p<.25)return frames[5];                // D0 winding up: full-draw frame
  if(p<.5)return frames[5];                 // D1 held at full draw
  if(p<.625)return frames[6];               // R0 release
  return frames[6];                         // R1 recovery
 }
 if(state===1||state===6)return frames[1+((Math.floor(t/9)%4)+4)%4];  // walk W0-W3
 return frames[0];                                                    // idle and every fallback
}
