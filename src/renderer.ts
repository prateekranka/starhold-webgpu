import {palette, names, jobs} from './kinds';
import {glyphs} from './font';
const MAX=8000, STRIDE=8;
export const RENDER_WIDTH=960, RENDER_HEIGHT=540;
const GRID=2;
const CONTOUR_TILE=16, CONTOUR_COLUMNS=Math.ceil(RENDER_WIDTH/CONTOUR_TILE), CONTOUR_ROWS=Math.ceil(RENDER_HEIGHT/CONTOUR_TILE);
const colors=palette.map(h=>[parseInt(h.slice(0,2),16)/255,parseInt(h.slice(2,4),16)/255,parseInt(h.slice(4,6),16)/255]);
const paletteWGSL=`const palette = array<vec3f,32>(${colors.map(c=>`vec3f(${c.join(',')})`).join(',')});`;
const geometryWGSL=paletteWGSL+`
const resolution=vec2f(${RENDER_WIDTH}.,${RENDER_HEIGHT}.);
const grid=${GRID}.;
struct Camera { rotation:vec2f, magnification:f32, padding:f32 }
@group(0) @binding(0) var<uniform> camera:Camera;
struct Out { @builtin(position) position:vec4f, @location(0) color:vec3f, @location(1) unit:f32, @location(2) rim:vec2f }
@vertex fn vs(@location(0) vertex:vec3f,@location(1) shade:f32,@location(2) origin:vec3f,@location(3) size:vec3f,@location(4) color:f32,@location(5) screen:f32,@location(6) actor:vec4f)->Out {
 var o:Out;
 let pigment=color%32.;o.unit=floor((color%32768.)/32.);
 // 18/19 mark combat composites; 17 identifies the worker/skiff contour.
 let combat=floor(color/32768.);o.rim=vec2f(select(0.,1.,combat>=18.),0.);
 var v=vertex;
 if screen < -0.5 && screen > -2.5 {v=vec3f(vertex.xy*select(1.,select(.55,.08,screen < -1.5),vertex.z>.5),vertex.z);}
 var p=origin+v*size;
 // Project an extruded footprint onto its terrain plane, away from the
 // screen-space upper-left key. Rotate the offset back into world space.
 if screen == -3. {
  let offset=vec2f(.5,-.1)*vertex.z*size.z;
  p=origin+vec3f(vertex.xy*size.xy+vec2f(
   offset.x*camera.rotation.x+offset.y*camera.rotation.y,
   -offset.x*camera.rotation.y+offset.y*camera.rotation.x),0.);
 }
 if screen == -4. {p=origin;}
 if screen>0.5 {let hud=p.xy*grid/(resolution*.5);o.position=vec4f(hud.x-1.,1.-hud.y,0.0001,1.);o.color=palette[u32(pigment)];}
 else {
 let d=p.xy-vec2f(16.);
 let r=vec2f(d.x*camera.rotation.x-d.y*camera.rotation.y,d.x*camera.rotation.y+d.y*camera.rotation.x);
 var projected=vec2f(6.*(r.x-r.y),3.4641016*(r.x+r.y)-6.9282032*p.z);
 if combat>=18. {
  let a=actor.xy-vec2f(16.);
  let ar=vec2f(a.x*camera.rotation.x-a.y*camera.rotation.y,a.x*camera.rotation.y+a.y*camera.rotation.x);
  let anchor=vec2f(6.*(ar.x-ar.y),3.4641016*(ar.x+ar.y)-6.9282032*actor.z);
  projected=anchor+(projected-anchor)*vec2f(1.4,actor.w);
 }
 var pixel=round(vec2f(240.,136.)*grid+projected*camera.magnification*grid);
 // Emissive details are opaque 1–2 raster pixels, independent of zoom.
 if screen == -4. {pixel+=vertex.xy*size.xy;}
 let ndc=pixel/(resolution*.5);
 o.position=vec4f(ndc.x-1.,1.-ndc.y,0.5-((r.x+r.y)*0.5773503+p.z*0.5773503)/128.,1.);
 // Never shade across palette families (teal feet formerly became ivory,
 // violet soil became orange, and gold cargo became cyan).
 let family=select(select(select(select(select(select(0.,4.,pigment>=4.),10.,pigment>=10.),15.,pigment>=15.),19.,pigment>=19.),23.,pigment>=23.),28.,pigment>=28.);
 // Face IDs carry world normals. Lighting follows camera yaw so the visible
 // left wall is always mid-value and the right wall dark; tops retain base.
 var normal=vec2f(0.);
 if shade==1. {normal=vec2f(0.,-1.);}
 if shade==2. {normal=vec2f(0.,1.);}
 if shade==3. {normal=vec2f(-1.,0.);}
 if shade==4. {normal=vec2f(1.,0.);}
 let rotated=vec2f(normal.x*camera.rotation.x-normal.y*camera.rotation.y,
  normal.x*camera.rotation.y+normal.y*camera.rotation.x);
 var steps=select(1.,2.,rotated.x-rotated.y>0.);
 if shade==0. {steps=0.;}
 if shade==5. {steps=2.;}
 // Reserve hot family endpoints for tiny explicit cores, never broad faces.
 let hot=pigment==9. || pigment==18. || pigment==22. || pigment==27. || pigment==31.;
 let base=pigment-select(0.,1.,hot);
 o.color=palette[u32(max(family,base-steps))];
 if screen == -3. || screen == -4. {o.color=palette[u32(pigment)];}
 if screen == -4. {o.unit=1.;o.rim=vec2f(0.);}
 } return o;
}
struct Fragment { @location(0) color:vec4f, @location(1) mask:vec4f }
@fragment fn fs(i:Out)->Fragment {var f:Fragment;f.color=vec4f(i.color,1.);f.mask=vec4f(i.unit,i.position.z,i.rim);return f;}
`;
const postWGSL=paletteWGSL+`
@group(0) @binding(0) var scene:texture_2d<f32>;
@group(0) @binding(1) var silhouette:texture_2d<f32>;
@group(0) @binding(2) var contourTiles:texture_2d<u32>;
@vertex fn vs(@builtin(vertex_index) i:u32)->@builtin(position) vec4f {
 let p=array<vec2f,3>(vec2f(-1.,-1.),vec2f(3.,-1.),vec2f(-1.,3.));return vec4f(p[i],0.,1.);
}
@fragment fn fs(@builtin(position) p:vec4f)->@location(0) vec4f {
 let pixel=vec2i(p.xy);let center=textureLoad(silhouette,pixel,0);
 // Conservative CPU occupancy skips neighbor walks outside actor/effect
 // bounds. The palette nearest-color search below remains the final pass.
 let occupied=textureLoad(contourTiles,pixel/${CONTOUR_TILE},0).r;
 // Per-entity contours also separate overlapping combatants. Mask 1 belongs
 // to projectiles/rings: preserve their color even beside an enlarged hull.
 // Ink surrounds each composite, including actor boundaries.
 if occupied!=0u && center.r!=1. {for(var axis=0;axis<4;axis++) {
  let offsets=array<vec2i,4>(vec2i(-1,0),vec2i(1,0),vec2i(0,-1),vec2i(0,1));
  let neighbor=textureLoad(silhouette,clamp(pixel+offsets[axis],vec2i(0),vec2i(${RENDER_WIDTH-1},${RENDER_HEIGHT-1})),0);
  let tolerance=select(0.,0.002,center.r==0.);
  if neighbor.r>0.5 && neighbor.r!=center.r && neighbor.g<center.g+tolerance {return vec4f(palette[0],1.);}
 }}
 // Dilate the UNION of the actor's visible parts, never individual boxes.
 // Eight neighbors close diagonal seams into one continuous #10121C backing.
 // At actor/actor contacts use two pixels on the rear actor and one on the
 // front actor: a three-pixel ink gutter, with depth and effect masks intact.
 if (occupied&2u)!=0u && center.r!=1. {
  for(var dy=-2;dy<=2;dy++) {for(var dx=-2;dx<=2;dx++) {
   if dx==0 && dy==0 {continue;}
   let distance=max(abs(dx),abs(dy));
   let neighbor=textureLoad(silhouette,clamp(pixel+vec2i(dx,dy),vec2i(0),vec2i(${RENDER_WIDTH-1},${RENDER_HEIGHT-1})),0);
   if neighbor.b==0. || neighbor.r==center.r {continue;}
   if distance==1 && neighbor.g<center.g+select(0.,0.002,center.r==0.) {
    return vec4f(palette[0],1.);
   }
   if center.b>0. && (distance==1 || neighbor.g<center.g) {
    return vec4f(palette[0],1.);
   }
  }}
 }
 let c=textureLoad(scene,pixel,0).rgb;var best=palette[0];var distance=100.;
 for(var i=0u;i<32u;i++){let delta=c-palette[i];let d=dot(delta,delta);if d<distance {distance=d;best=palette[i];}}
 return vec4f(best,1.);
}`;
export class Renderer {
 readonly data=new Float32Array(MAX*STRIDE);
 readonly owners=new Int32Array(MAX);
 private actorData=new Float32Array(MAX*4);
 private actorBuffer:any;
 readonly camera=new Float32Array([1,0,1,0]);
 readonly stats={drawCalls:2,triangles:0};
 time=0;count=0;staticCount=0;worldCount=0;selected:number|null=null;
 private emissiveCount=0;private staticEmissiveCount=0;
 private contourData=new Uint8Array(256*CONTOUR_ROWS);
 private contourUpload:any;
 private contourLayout={bytesPerRow:256,rowsPerImage:CONTOUR_ROWS};
 private contourSize={width:CONTOUR_COLUMNS,height:CONTOUR_ROWS,depthOrArrayLayers:1};
 private device:any;private context:any;private pipeline:any;private post:any;private vertex:any;private buffer:any;private uniform:any;private group:any;private postGroup:any;
 private scenePass:any;private presentPass:any;
 private hudAlloy=-1;private hudCharge=-1;private hudSelection=-2;private hudKind=-1;private hudHealth=-1;private hudJob=-1;private hudProgress=-1;private hudData=new Float32Array(24000);private hudCount=0;
 private terrain=new Float32Array(1024);
 async init(canvas:HTMLCanvasElement,terrain:Float32Array) {
  if(!navigator.gpu) throw new Error('WebGPU is unavailable. Open Starhold in a WebGPU-capable browser with hardware acceleration enabled.');
  const adapter=await navigator.gpu.requestAdapter({powerPreference:'high-performance'});
  if(!adapter) throw new Error('No WebGPU adapter is available. Enable hardware acceleration and Vulkan support.');
  this.device=await adapter.requestDevice();
  const d=this.device;this.context=canvas.getContext('webgpu');
  const format=navigator.gpu.getPreferredCanvasFormat();this.context.configure({device:d,format,alphaMode:'opaque'});
  const mesh:number[]=[];
  const face=(a:number[],b:number[],c:number[],e:number[],shade:number)=>{for(const v of [a,b,c,a,c,e])mesh.push(...v,shade);};
  face([-.5,-.5,1],[.5,-.5,1],[.5,.5,1],[-.5,.5,1],0);
  face([-.5,-.5,0],[.5,-.5,0],[.5,-.5,1],[-.5,-.5,1],1);
  face([.5,.5,0],[-.5,.5,0],[-.5,.5,1],[.5,.5,1],2);
  face([-.5,.5,0],[-.5,-.5,0],[-.5,-.5,1],[-.5,.5,1],3);
  face([.5,-.5,0],[.5,.5,0],[.5,.5,1],[.5,-.5,1],4);
  face([-.5,.5,0],[.5,.5,0],[.5,-.5,0],[-.5,-.5,0],5);
  this.vertex=d.createBuffer({size:mesh.length*4,usage:GPUBufferUsage.VERTEX|GPUBufferUsage.COPY_DST});d.queue.writeBuffer(this.vertex,0,new Float32Array(mesh));
  this.buffer=d.createBuffer({size:this.data.byteLength,usage:GPUBufferUsage.VERTEX|GPUBufferUsage.COPY_DST});
  this.actorBuffer=d.createBuffer({size:this.actorData.byteLength,usage:GPUBufferUsage.VERTEX|GPUBufferUsage.COPY_DST});
  this.uniform=d.createBuffer({size:16,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});
  const module=d.createShaderModule({code:geometryWGSL});
  this.pipeline=d.createRenderPipeline({layout:'auto',vertex:{module,entryPoint:'vs',buffers:[{arrayStride:16,attributes:[{shaderLocation:0,offset:0,format:'float32x3'},{shaderLocation:1,offset:12,format:'float32'}]},{arrayStride:32,stepMode:'instance',attributes:[{shaderLocation:2,offset:0,format:'float32x3'},{shaderLocation:3,offset:12,format:'float32x3'},{shaderLocation:4,offset:24,format:'float32'},{shaderLocation:5,offset:28,format:'float32'}]},{arrayStride:16,stepMode:'instance',attributes:[{shaderLocation:6,offset:0,format:'float32x4'}]}]},fragment:{module,entryPoint:'fs',targets:[{format:'rgba8unorm'},{format:'rgba16float'}]},primitive:{topology:'triangle-list'},depthStencil:{format:'depth24plus',depthWriteEnabled:true,depthCompare:'less-equal'}});
  this.group=d.createBindGroup({layout:this.pipeline.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:this.uniform}}]});
  const scene=d.createTexture({size:[RENDER_WIDTH,RENDER_HEIGHT],format:'rgba8unorm',usage:GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.TEXTURE_BINDING});
  const silhouette=d.createTexture({size:[RENDER_WIDTH,RENDER_HEIGHT],format:'rgba16float',usage:GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.TEXTURE_BINDING});
  const depth=d.createTexture({size:[RENDER_WIDTH,RENDER_HEIGHT],format:'depth24plus',usage:GPUTextureUsage.RENDER_ATTACHMENT});
  const textureUsage=GPUTextureUsage as typeof GPUTextureUsage & {COPY_DST:number};
  const contourTiles=d.createTexture({size:[CONTOUR_COLUMNS,CONTOUR_ROWS],format:'r8uint',usage:textureUsage.TEXTURE_BINDING|textureUsage.COPY_DST});
  this.contourUpload={texture:contourTiles};
  const postModule=d.createShaderModule({code:postWGSL});this.post=d.createRenderPipeline({layout:'auto',vertex:{module:postModule,entryPoint:'vs'},fragment:{module:postModule,entryPoint:'fs',targets:[{format}]},primitive:{topology:'triangle-list'}});
  const sceneView=scene.createView(),silhouetteView=silhouette.createView();this.postGroup=d.createBindGroup({layout:this.post.getBindGroupLayout(0),entries:[{binding:0,resource:sceneView},{binding:1,resource:silhouetteView},{binding:2,resource:contourTiles.createView()}]});
  this.scenePass={colorAttachments:[{view:sceneView,clearValue:{r:16/255,g:18/255,b:28/255,a:1},loadOp:'clear',storeOp:'store'},{view:silhouetteView,clearValue:{r:0,g:1,b:0,a:1},loadOp:'clear',storeOp:'store'}],depthStencilAttachment:{view:depth.createView(),depthClearValue:1,depthLoadOp:'clear',depthStoreOp:'discard'}};
  this.presentPass={colorAttachments:[{view:null,loadOp:'clear',storeOp:'store',clearValue:{r:16/255,g:18/255,b:28/255,a:1}}]};
  this.terrain.set(terrain);this.makeTerrain();
 }
 onError(callback:(message:string)=>void) {this.device.addEventListener('uncapturederror',(e:any)=>callback(e.error.message));this.device.lost.then((info:any)=>callback(`WebGPU device lost: ${info.message}`));}
 box(x:number,y:number,z:number,sx:number,sy:number,sz:number,color:number,owner=-1,screen=0) {
  if(this.count>=MAX) return;
  const i=this.count*8;this.data[i]=x;this.data[i+1]=y;this.data[i+2]=z;this.data[i+3]=sx;this.data[i+4]=sy;this.data[i+5]=sz;this.data[i+6]=color;this.data[i+7]=screen;this.owners[this.count++]=owner;
 }
 ground(x:number,y:number) {return this.terrain[Math.max(0,Math.min(31,Math.floor(y)))*32+Math.max(0,Math.min(31,Math.floor(x)))];}
 private emissive(x:number,y:number,z:number,color:number,owner=-1,w=1,h=2) {
  // At most 2,048 hot world pixels (<0.4% of 960×540), before occlusion.
  // HUD glyphs retain their existing size and palette; broad world faces use
  // the next darker entry. Fixed storage and no extra draw or blend pass.
  if(this.emissiveCount>=512)return;
  this.emissiveCount++;this.box(x,y,z,w,h,0,color,owner,-4);
 }
 private shadow(x:number,y:number,w:number,d:number,h:number) {
  this.box(x,y,this.ground(x,y)+.09,w,d,h,2,-1,-3);
 }
 private shard(x:number,y:number,z:number,h:number,c=30,owner=-1) {
  this.box(x,y,z,.62,.65,h,c,owner,-2);
  this.box(x+.25,y+.12,z,.24,.25,h*.56,c-1,owner,-2);
  this.emissive(x,y,z+h,c<19?18:31,owner);
 }
 private makeTerrain() {
  // Broken outer contour and staggered basalt columns avoid the old square plate.
  for(let y=0;y<32;y++)for(let x=0;x<32;x++) {
   const h=this.ground(x,y),hash=((x*374761393+y*668265263)^(x*y*1274126177))>>>0;
   const edge=x<2||x>29||y<2||y>29;
   if(edge&&(hash%5<3)||x<5&&y<9||x<7&&y<3||x>28&&y>27)continue;
   const bottom=-3.5-(hash%5)*.35;
   const rim=edge||x<4||y>28||x>28||this.ground(x+1,y)<h||this.ground(x,y+1)<h;
   this.box(x+.5,y+.5,bottom,rim?.84:1,rim?.88:1,h-bottom-.16,2);
   this.box(x+.5,y+.5,h-.16,rim?.94:1,rim?.96:1,.16,h<0?3:hash%11<3?28:4);
   if(rim){
    this.box(x+.5,y+.5,h-.22,1.04,1.02,.22,hash%4===0?5:4);
    this.box(x+.78,y+.84,bottom+.2,.18,.12,h-bottom-.5,3);
    if(hash%2===0)this.box(x+.5,y+.5,h-1.2,.94,.96,.18,4);
   }
   if(hash%7===0){this.box(x+.3,y+.42,h+.014,.65,.42,.025,hash%3===0?29:5);this.box(x+.52,y+.51,h+.017,.32,.24,.027,hash%3===0?29:5);}
   if(hash%29===0)this.box(x+.36,y+.4,h+.045,.54,.06,.025,3);
   if(hash%31===0)this.box(x+.64,y+.65,h+.03,.4,.32,.14,3);
   // Exposed vertical seams and projecting shelves use the cliff family only.
   if(y===31||x===31||this.ground(x+1,y)<h||this.ground(x,y+1)<h||edge){
    this.box(x+.87,y+.83,bottom+.4,.17,.18,h-bottom-.6,hash%2?2:3);
    if(hash%3===0)this.box(x+.55,y+.64,bottom+1.1,.9,.92,.2,4);
   }
   // The exposed face projects beyond the cap: ribs cannot disappear inside
   // the solid terrain column. Alternate short ledges break the vertical bands.
   for(let side=0;side<2;side++){
    if(!(edge||side===0&&this.ground(x+1,y)<h||side===1&&this.ground(x,y+1)<h))continue;
    const faceBottom=edge?bottom:Math.max(bottom,this.ground(x+(side===0?1:0),y+(side===1?1:0))-1.1);
    for(let rib=0;rib<3;rib++){
     const along=.18+rib*.31,xx=x+(side===0?1.015:along),yy=y+(side===1?1.015:along);
     const top=h-.28-(hash+rib)%3*.13;
     this.box(xx,yy,faceBottom,side===0?.12:.16,side===1?.12:.16,top-faceBottom,(hash+rib)%2?5:4);
     if((hash+rib)%3===0)this.box(xx,yy,top-.8,side===0?.25:.26,side===1?.25:.26,.14,5);
    }
   }
  }
  const roads=[[7,25,5,25],[8.5,23,11,20],[11,20,13,18],[13,18,16,18.6],[8,21.5,8,17],[8,17,6.7,17],[18.5,16,18.5,14],[18.5,14,24,14],[16,13,18.5,14],[18,20,22,22],[24,14,27,12],[19,22,19,25],[30.4,3,29.5,8],[29.5,8,28.5,12]];
  for(const r of roads){const length=Math.hypot(r[2]-r[0],r[3]-r[1]);for(let t=0;t<length;t+=.5){const x=r[0]+(r[2]-r[0])*t/length,y=r[1]+(r[3]-r[1])*t/length;for(let lane=-1;lane<=1;lane++){const xx=x+lane*.46*(r[3]-r[1])/length,yy=y-lane*.46*(r[2]-r[0])/length;this.box(xx,yy,this.ground(xx,yy)+.045,.51,.5,.035,(Math.floor(t*10)+lane)%5===0?5:6);}}}
  for(let i=0;i<34;i++){const x=7+(i*17%59)/10,y=3+(i*7%40)/10;this.shard(x,y,this.ground(x,y),.6+i%5*.37);}
  for(let i=0;i<20;i++){const x=2.4+(i*19%54)/10,y=20+(i*23%83)/10;if(x>5.1&&y<25)continue;this.shard(x,y,this.ground(x,y),.9+(i%4)*.55,31);}
  // Low ruined arch feet and scattered masonry frame the foreground route.
  for(let i=0;i<5;i++){const x=19+i*1.75,y=27.8-i%2*.3,z=this.ground(x,y);this.box(x,y,z,.68,.65,.65+i%2*.2,4);this.box(x+.65,y+.2,z,.42,.5,.3,5);if(i%2===0){this.box(x,y,z+.65,.35,.42,.45,5);this.box(x+.24,y,z+1.05,.65,.45,.15,4);}}
  for(let i=0;i<18;i++){const x=3+(i*43%263)/10,y=3+(i*71%263)/10;if(x>8&&x<23&&y>9&&y<24)continue;this.box(x,y,this.ground(x,y),.3+i%3*.1,.35,.2+i%3*.15,4);}
  for(let i=0;i<7;i++){const x=26.8+i%3*1.2,y=3+i*1.25,z=this.ground(x,y);this.box(x,y,z,.6,.6,1.1+i%3*.45,3);this.box(x,y,z+1.1+i%3*.45,.75,.75,.22,5);}
  this.staticCount=this.count;this.staticEmissiveCount=this.emissiveCount;
 }
 private building(e:Float32Array,o:number,id:number) {
  const x=e[o],y=e[o+1],z=e[o+2],k=e[o+4],p=e[o+10],phase=e[o+6];
  const w=k===10||k===17?4:k===12||k===16?2:3,depth=k===15?2:k===17?3:w;
  const height=k===10?5:k===12||k===16?4:k===13||k===14?3:2.5;
  this.shadow(x,y,w+.2,depth+.2,p<.2?.35:p<.5?1.4:p<.85?2.8:height);
  this.box(x,y,z,w+.2,depth+.2,.19,7,id);
  this.box(x,y,z+.19,w-.12,depth-.12,.12,11,id);
  if(p<1){
   const h=p<.2?.35:p<.5?1.4:2.8;
   for(let a=-1;a<=1;a+=2)for(let b=-1;b<=1;b+=2){this.box(x+a*w*.44,y+b*depth*.44,z+.3,.16,.16,h,7,id);this.box(x+a*w*.44,y+b*depth*.44,z+.3+h,.22,.22,.12,22,id);}
   if(p>=.2){for(let level=0;level<2;level++){this.box(x,y-depth*.44,z+.8+level*.85,w,.1,.1,21,id);this.box(x+w*.44,y,z+.8+level*.85,.1,depth,.1,20,id);}}
   this.crane(x+w*.65,y-.25,z,w*.75,3.9,phase,id,.45+p*2.9);
   if(p>=.2){
    const weld=(this.time+id*.37)%1.2;
    if(weld<.2)for(let j=0;j<4;j++)this.box(x+w*.46+j*.1,y+depth*.44+(j%2)*.13,z+.5+p*2+j*.11,.13,.13,.13,j%2?22:18);
    // Narrow access ladder and horizontal scaffold ties leave the volume open.
    for(let j=0;j<6;j++)this.box(x-w*.47,y+depth*.5,z+.45+j*.36,.42,.12,.09,20,id);
   }
   for(let a=0;a<2;a++)this.crate(x-w*.65,y+.7*a,z,.45,id);
   if(p<.2)return;
  }
  if(k===10){
   this.box(x,y,z+.3,3.7,3.7,1.45,7,id);
   this.box(x,y+1.86,z+.42,3.4,.08,.85,11,id);
   this.box(x+1.86,y,z+.42,.08,3.4,.85,11,id);
   for(let j=-1;j<=1;j++)for(let side=0;side<2;side++){
    this.box(x+(side?1.82:j*1.25),y+(side?j*1.25:1.82),z+.3,side?.48:.35,side?.35:.48,1.65,8,id);
    this.box(x+(side?2.02:j*1.25),y+(side?j*1.25:2.02),z+.2,.45,.45,.45,7,id);
   }
   for(let a=-1;a<=1;a+=2)for(let b=-1;b<=1;b+=2){this.box(x+a*1.65,y+b*1.65,z+.3,.45,.45,2.1,8,id);this.box(x+a*1.65,y+b*1.65,z+2.4,.5,.5,.2,8,id);this.box(x+a*1.65,y+b*1.65,z+2.6,.08,.08,.45,22,id);}
   this.box(x,y,z+1.75,3.9,3.9,.22,8,id);
   this.box(x,y,z+1.97,2.8,2.8,.8,7,id);
   this.box(x,y,z+2.1,2.35,2.35,.6,12,id);
   for(let a=-1;a<=1;a+=2){this.box(x+a*1.27,y+1.27,z+1.97,.27,.27,1.,8,id);this.box(x+1.27,y+a*1.27,z+1.97,.27,.27,1.,8,id);}
   this.box(x,y,z+2.77,3.,3.,.2,8,id);
   this.box(x,y,z+2.97,1.45,1.45,1.2,8,id);
   this.box(x,y,z+3.0,.78,1.36,1.05,11,id);
   this.box(x,y,z+4.17,1.4,1.4,.2,12,id);
   for(let a=-1;a<=1;a+=2){this.box(x+a*.38,y,z+4.35,.09,.1,.65,22,id);this.box(x+a*1.1,y+1.88,z+.35,.27,.13,1.25,8,id);this.box(x+1.88,y+a*1.1,z+.35,.13,.27,1.25,8,id);}
   this.box(x,y,z+4.35,.8,.1,.1,21,id);
   this.box(x,y+1.9,z+.2,.72,.1,1.3,1,id);this.box(x,y+1.96,z+.3,.12,.04,.45,26,id);
   for(let j=0;j<3;j++)this.box(x,y+2.05+j*.21,z,.9,.25,.3-j*.08,7,id);
   for(let j=-1;j<=1;j+=2){this.box(x+j*1.35,y+1.9,z+.8,.16,.09,.45,22,id);this.box(x+1.9,y+j*.9,z+.85,.08,.18,.5,22,id);this.emissive(x+j*1.35,y+1.96,z+1.05,22,id);this.emissive(x+1.95,y+j*.9,z+1.1,22,id);}
   this.banner(x-.9,y+1.98,z+2.3,phase,id);
   this.banner(x+1.98,y+.85,z+2.3,phase+.3,id);
  } else if(k===12){
   this.box(x,y,z+.3,1.8,1.8,.3,12,id,-1);
   for(let j=0;j<6;j++){const a=j*Math.PI/3;this.box(x+Math.cos(a)*.8,y+Math.sin(a)*.8,z+.25,.45,.45,.45,8,id);}
   if(p>=.2)for(let a=-1;a<=1;a+=2)this.box(x+a*.8,y,z+.55,.24,.46,p<.5?1.3:2.5,8,id);
   if(p>=.5){const bob=Math.floor(phase*4)%2*.08;this.shard(x,y,z+.65+bob,2.9,17,id);for(let j=0;j<3;j++){this.box(x,y,z+.85+j*.65,.75,.75,.12,16,id);this.box(x-.18,y+.26,z+.9+j*.65,.08,.08,.48,17,id);this.emissive(x-.18,y+.31,z+1.14+j*.65,Math.floor(phase*4)===j?18:17,id);}this.emissive(x,y,z+3.75,18,id);}
  } else if(k===16){
   const levels=p<.5?1:p<.85?2:3;
   for(let j=0;j<levels;j++){if(p>=.85||j===0)this.box(x,y,z+.3+j*.85,1.65-j*.28,1.65-j*.28,.72,12,id);
    else {this.box(x,y-.52,z+.3+j*.85,1.35,.18,.72,11,id);this.box(x-.52,y,z+.3+j*.85,.18,1.2,.72,7,id);}this.box(x,y,z+.98+j*.85,1.8-j*.28,1.8-j*.28,.15,8,id);}
   // Incomplete cheeks remain separate: empty upper volume and exposed cross ribs.
   for(let a=-1;a<=1;a+=2){this.box(x+a*(p<.85?.96:.62),y,z+.3,.32,.7,levels*.85+.35,8,id);this.box(x+a*.6,y-.25,z+.3,.13,.13,levels*.85+.6,7,id);}
   if(p>=.5){this.box(x,y-.2,z+2.12,1.25,.14,.13,21,id);this.box(x,y,z+2.3,.38,.38,.3,16,id);}
   if(p>=.85){const dx=Math.cos(e[o+3]),dy=Math.sin(e[o+3]);this.box(x,y,z+3.,.5,.5,.55,12,id);for(let j=0;j<4;j++)this.box(x+dx*j*.23,y+dy*j*.23,z+3.2,.23,.23,.2,j===3?18:16,id);for(let a=-1;a<=1;a+=2)this.box(x+a*.66,y,z+3.,.08,.08,.95,22,id);
    for(let j=0;j<3;j++)this.box(x+.43,y+.24,z+2.35+j*.2,.13,.16,.12,phase>j/3?17:15,id);
    this.emissive(x+dx*.74,y+dy*.74,z+3.3,18,id);
    if(e[o+5]===2&&phase<.035)this.emissive(x+dx*.85,y+dy*.85,z+3.31,18,-1,2,2);}
  } else if(k===15){
   for(let a=-1;a<=1;a++){this.box(x+a*.98,y,z+.3,.87,1.7,.25,12,id);for(let b=-1;b<=1;b+=2)this.box(x+a*.98,y+b*.68,z+.55,.8,.16,p<.5?.55:1.25,7,id);if(p>=.5){this.box(x+a*.98,y,z+.55,.8,1.5,1.1,8,id);this.box(x+a*.98,y,z+1.65,.95,1.8,.25,8,id,-1);this.box(x+a*.98,y,z+1.9,.58,1.05,.14,12,id);this.box(x+a*.98,y+.79,z+.85,.19,.07,.45,19,id);this.box(x+a*.98,y+.84,z+.9,.1,.04,.3,22,id);this.box(x+a*.98,y+1.,z+1.45,.88,.5,.1,12,id);}}
   if(p>=.5)for(let a=-1;a<=1;a++)this.emissive(x+a*.98,y+.89,z+1.05,22,id);
   if(p>=.85)this.box(x+1.15,y-.6,z+2,.06,.06,.5,22,id);
  } else if(k===17){
   // Open landing deck, crescent edge and independent control hut.
   for(let j=-2;j<=2;j++)if(p>=(j+3)*.08)this.box(x+j*.7,y,z+.3,.62,2.5,.1,11,id);
   if(p>=.5){for(let a=-1;a<=1;a+=2){this.box(x+a*1.8,y,z+.4,.25,2.7,.3,8,id);this.box(x,y+a*1.3,z+.4,3.4,.23,.3,8,id);}this.box(x-1.2,y-.7,z+.4,.9,.9,1.1,12,id);this.box(x-1.2,y-.7,z+1.5,1.,1.,.18,8,id);this.box(x-1.2,y-.23,z+.95,.5,.08,.3,17,id);this.crane(x+1.5,y-.9,z,1.5,2.5,phase,id);}
   if(p>=.5)this.emissive(x-1.2,y-.17,z+1.1,18,id,2,1);
   if(p>=.85)for(let j=0;j<8;j++)this.box(x-1.3+j*.37,y+1.18,z+.72,.19,.1,.035,j===Math.floor(phase*8)?22:20,id);
  } else if(k===11){
   for(let a=-1;a<=1;a+=2){this.box(x+a*1.25,y,z+.3,.38,2.7,p<.5?.7:1.25,11,id);for(let j=-1;j<=1;j++)this.box(x+a*1.42,y+j,z+.3,.16,.22,1.4,7,id);}
   this.box(x,y-1.25,z+.3,2.5,.35,1.3,11,id);
   if(p>=.5){for(let a=-1;a<=1;a+=2)this.box(x+a*1.1,y,z+1.6,.9,2.8,.17,12,id);this.box(x,y-1.,z+1.6,2.7,.65,.17,13,id);this.box(x,y+.4,z+1.75,3.1,.7,.15,21,id);this.crane(x+1.6,y+.4,z,3.1,2.,phase,id);}
   for(let j=0;j<4;j++)this.crate(x-1.+j*.62,y+.9+(j%2)*.8,z+.2,.48,id);
  } else if(k===13){
   this.box(x,y,z+.3,2.7,2.7,p<.5?.35:1.5,11,id);
   for(let a=-1;a<=1;a+=2)for(let j=-1;j<=1;j++)this.box(x+a*1.36,y+j,z+.3,.22,.25,1.8,8,id);
   if(p>=.5){for(let j=0;j<4;j++)this.box(x,y,z+1.85+j*.22,3.05,2.9-j*.6,.22,j===3?13:12,id);this.box(x,y,z+2.74,3.15,.16,.14,7,id);for(let a=-1;a<=1;a+=2){this.box(x+a*.48,y+1.38,z+.3,.64,.12,1.3,1,id);this.box(x+a*.83,y+1.43,z+.3,.16,.18,1.4,8,id);}this.box(x,y+1.5,z+1.7,.42,.1,.5,22,id);}
   if(p>=.85)this.banner(x-1.4,y-1.,z+3.1,phase,id);
  } else if(k===14){
   this.box(x,y,z+.3,2.7,2.6,p<.5?.5:1.4,4,id);
   for(let a=-1;a<=1;a+=2)this.box(x+a*1.3,y,z+.3,.25,2.6,1.8,8,id);
   if(p>=.5){this.box(x,y,z+1.7,2.8,2.7,.22,7,id);this.box(x-.7,y-.6,z+1.9,.55,.6,1.1,4,id);this.box(x-.7,y-.6,z+2.95,.68,.7,.15,7,id);this.box(x+.65,y-.5,z+1.9,.4,.4,.85,7,id);this.box(x+.65,y-.5,z+2.75,.4,.4,.15,22,id);
    this.box(x,y+1.34,z+.3,1.25,.18,1.3,1,id);this.box(x,y+1.45,z+.35,.9,.12,.95,25,id);this.box(x,y+1.53,z+.4,.45,.1,.65,27,id);this.box(x,y+1.8,z+.21,.5,.6,.06,26,id);this.emissive(x,y+1.6,z+.73,27,id,2,2);
    for(let j=0;j<8;j++){const a=(j/8+phase)*Math.PI*2;this.box(x+1.48,y+Math.cos(a)*.55,z+1.+Math.sin(a)*.55,.2,.24,.24,21,id);}
    for(let j=0;j<5;j++){const q=(this.time/2+j/5)%1,size=.32+Math.floor(q*3)*.24;this.box(x-.7+q*.95,y-.6+q*.25,z+3.1+q*2.1,size,size,.28+q*.2,q<.65?6:4);}}
  }
  if(p>=.85&&k!==12&&k!==16){for(let j=0;j<2;j++)this.crate(x+w*.5+.3,y+.6*j,z,.38,id);}
 }
 private crate(x:number,y:number,z:number,size:number,id=-1) {
  this.box(x,y,z,size,size,size,21,id);this.box(x,y,z+size,size*.18,size+.025,.03,22,id);this.box(x+size*.5,y,z+.03,.025,size*.15,size*.9,19,id);
 }
 private banner(x:number,y:number,z:number,phase:number,id:number) {
  const pose=Math.floor((this.time/1.8+phase)*3)%3;
  this.box(x,y,z-.6,.11,.11,1.35,21,id);this.box(x+.42,y+pose*.1,z-.35,.84,.13,.72,12,id);this.box(x+.82,y+pose*.15,z-.3-pose*.08,.28,.14,.52,13,id);this.box(x+.3,y+.11,z-.2,.13,.08,.24,22,id);
 }
 private crane(x:number,y:number,z:number,w:number,h:number,phase:number,id:number,assembly=-1) {
  this.box(x,y,z,.17,.17,h,20,id);this.box(x-w*.5,y,z+h,w+.15,.18,.18,22,id);const lift=assembly<0?.8+Math.floor(phase*6)/6*(h-1.2):assembly+Math.floor(phase*3)*.12;this.box(x-w*.8,y,z+lift,.05,.05,h-lift,19,id);this.box(x-w*.8,y,z+lift-.15,.2,.2,.16,22,id);this.box(x-w*.8,y,z+lift-.55,.42,.42,.4,12,id);this.box(x-w*.8+.12,y,z+lift-.13,.12,.12,.24,22,id);
 }
 private unit(e:Float32Array,o:number,id:number,yaw:number,zoom:number) {
  const kind=e[o+4];
  const jitter=kind===21||kind===22||kind===23||kind===30||kind===31;
  this.shadow(e[o]+(jitter?(id%3-1)*.24:0),e[o+1]+(jitter?(Math.floor(id/3)%3-1)*.24:0),kind===31?2:kind===24?1.8:kind===20?.55:1.15,kind===31?1.6:kind===24?1.2:.8,kind===24?3:kind===20?1:1.8);
  const start=this.count;
  this.unitParts(e,o,id);
  const k=e[o+4],friendly=k>=20&&k<=24;
  const combat=k===21||k===22||k===23||k===30||k===31;
  const scale=k===24?1.12:k===20?1:1.22;
  const growth=k===21||k===22||k===23?1.28:1;
  const c=Math.cos(e[o+3]),sn=Math.sin(e[o+3]);
  // Fixed nine-slot world jitter, radius <= sqrt(2)*.24 = .3395 tiles.
  // The current ABI exposes packed entity indices as renderer IDs.
  const ox=combat?(id%3-1)*.24:0,oy=combat?(Math.floor(id/3)%3-1)*.24:0;
  const cx=Math.round(Math.cos(yaw*Math.PI/2)),cy=Math.round(Math.sin(yaw*Math.PI/2));
  let top=Infinity,bottom=-Infinity;
  for(let i=start;i<this.count;i++){
   const q=i*8,owned=this.owners[i]===id,bodyGrowth=owned?growth:1;
   const dx=(this.data[q]-e[o])*scale*bodyGrowth,dy=(this.data[q+1]-e[o+1])*scale*bodyGrowth;
   this.data[q]=e[o]+dx*c-dy*sn+(owned?ox:0);this.data[q+1]=e[o+1]+dx*sn+dy*c+(owned?oy:0);
   const core=this.data[q+7]===-4;
   if(!core){this.data[q+3]*=scale*bodyGrowth;this.data[q+4]*=scale*bodyGrowth;}
   this.data[q+5]*=bodyGrowth;
   if(owned){
    this.data[q+6]+=32*(id+2)+32768*(combat?(friendly?18:19):friendly?17:0);
    if(combat&&!core){
     const y=3.4641016*((cx+cy)*this.data[q]+(cx-cy)*this.data[q+1])-6.9282032*this.data[q+2];
     const half=1.7320508*(this.data[q+3]+this.data[q+4]);
     top=Math.min(top,y-half-6.9282032*this.data[q+5]);bottom=Math.max(bottom,y+half);
    }
   }
  }
  if(combat){
   // Grow the complete screen silhouette 40%; cap its conservative projected
   // box height at 32 raster pixels (16 logical), including closest zoom.
   // Original world depth, action effects and selection rings are untouched.
   const vertical=Math.min(1.4,16*zoom/(bottom-top));
   for(let i=start;i<this.count;i++)if(this.owners[i]===id){
    const q=i*4;this.actorData[q]=e[o]+ox;this.actorData[q+1]=e[o+1]+oy;
    this.actorData[q+2]=e[o+2];this.actorData[q+3]=vertical;
   }
  }
 }
 private unitParts(e:Float32Array,o:number,id:number) {
  const x=e[o],y=e[o+1],z=e[o+2],k=e[o+4],phase=e[o+6],state=e[o+5],moving=state===1||state===6;
  const gait=moving?(phase<.5?-.16:.16):0;
  if(k===24){this.box(x,y,z,1.8,.8,.25,13,id);this.box(x,y,z+.25,1.25,.6,.25,14,id);for(let a=-1;a<=1;a+=2){this.box(x+a*.85,y,z,.25,1.25,.3,8,id);this.box(x+a*.75,y-.55,z+.1,.22,.4,.2,7,id);this.box(x+a*.6,y-.5,z-.05,.16,.25,.1,phase<.5?17:18,id);}this.box(x,y+.4,z+.15,1.4,.18,.15,8,id);this.box(x-.4,y,z+.5,.35,.4,.15,3,id);if(e[o+10]>0)this.crate(x+.2,y,z+.5,.45,id);if(state===7){this.box(x,y,z-1.,.04,.04,1.,21,id);this.crate(x,y,z-1.3,.35,id);}return;}
  // Brief numeric roles: 21 tall lancer, 22 wing/disc, 23 rifle knight.
  // Keep the simulation's existing kind names, cargo and action fields intact.
  const attacking=state===2,recoil=attacking&&phase<.18?.23:0;
  if(k===21||k===23){
   const brace=attacking?.34:.23;
   for(let side=-1;side<=1;side+=2){
    this.box(x+gait*side,y+side*brace,z,.28,.24,.42,10,id);
    this.box(x-.16,y+side*brace,z,.48,.25,.16,11,id);
   }
   // Wide planted cloak hem narrows to a high ivory crest.
   this.box(x-.12-recoil,y,z+.28,.72,.84,1.03,13,id,-1);
   this.box(x-recoil,y,z+.67,.5,.5,.76,10,id);
   this.box(x-recoil,y,z+.7,.53,.53,.27,14,id);
   this.box(x-recoil,y,z+1.1,.53,.53,.22,14,id);
   this.box(x-recoil,y,z+1.32,.42,.44,.16,0,id);
   this.box(x-recoil,y,z+1.48,.36,.38,.27,8,id,-2);
   this.box(x+.19-recoil,y,z+1.52,.16,.22,.14,18,id);
   for(let side=-1;side<=1;side+=2)this.box(x-recoil,y+side*.3,z+1.02,.46,.27,.26,8,id);
   // Side-mounted barrel has a continuous large fill and a long tip.
   this.box(x+.38-recoil,y+.32,z+.96,.92,.2,.2,10,id);
   this.box(x+.95-recoil,y+.32,z+.99,.14,.08,.14,22,id);
   if(k===21&&e[o+10]>0)this.crate(x-.36,y-.24,z+.55,.38,id);
   if(attacking&&e[o+11]>.8)this.emissive(x+1.23-recoil,y+.32,z+1.11,k===23?18:22,id,2,2);
   return;
  }
  if(k===22){
   // Low teal hub and swept wings, ivory tips, split landing feet.
   const spread=attacking?.16:0;
   for(let side=-1;side<=1;side+=2){
    this.box(x-.12+gait*side,y+side*.4,z,.35,.25,.24,10,id);
    this.box(x-.15-recoil,y+side*(.49+spread),z+.42,.63,.68,.22,14,id);
    this.box(x-.15-recoil,y+side*(.49+spread),z+.65,.18,.68,.08,10,id);
    this.box(x-.35-recoil,y+side*(.85+spread),z+.44,.4,.3,.16,8,id);
   }
   this.box(x-recoil,y,z+.28,.75,.76,.4,13,id,-1);
   this.box(x+.12-recoil,y,z+.67,.48,.5,.12,0,id);
   this.box(x+.22-recoil,y,z+.79,.35,.38,.23,8,id,-1);
   this.box(x-recoil,y,z+.88,.13,.13,.04,17,id);
   this.box(x+.65-recoil,y,z+.78,.65,.22,.2,10,id);
   this.box(x+.95-recoil,y,z+.81,.14,.08,.14,22,id);
   if(attacking&&e[o+11]>.8)this.emissive(x+.98-recoil,y,z+.95,22,id,2,2);
   return;
  }
  if(k===30){
   // Four feet, two separated rear hocks, red wedge and long heat muzzle.
   // The body stays low; the raised red shoulder makes a forward-leaning arch.
   const lunge=attacking?(phase<.18?-.18:.12):0;
   for(let side=-1;side<=1;side+=2){
    this.box(x-.52+gait*side,y+side*.38,z,.29,.23,.23,0,id);
    this.box(x-.56+gait*side,y+side*.38,z+.19,.19,.22,.43,25,id);
    this.box(x-.38,y+side*.36,z+.51,.42,.23,.23,25,id);
    this.box(x+.35+lunge-gait*side,y+side*.33,z,.23,.22,.51,25,id);
   }
   this.box(x-.12+lunge,y,z+.48,.98,.67,.48,25,id,-1);
   this.box(x+.19+lunge,y,z+.72,.65,.65,.55,25,id,-2);
   this.box(x+.44+lunge,y,z+.66,.62,.46,.32,23,id);
   this.box(x+.62+lunge,y,z+.74,.3,.36,.28,25,id);
   this.box(x+.75+lunge,y,z+.72,.44,.29,.22,23,id);
   this.box(x+.99+lunge,y,z+.76,.18,.1,.16,27,id);
   this.box(x-.19+lunge,y,z+.97,.2,.66,.12,23,id);
   this.box(x-.64,y,z+.66,.45,.23,.2,25,id,-2);
   if(attacking&&e[o+11]>.72)this.emissive(x+1.1+lunge,y,z+.84,27,id,2,2);
   return;
  }
  if(k===31){
   // Heavy low chassis: broad armored rails and a stepped siege gun.
   const brace=attacking?.12:0;
   for(let side=-1;side<=1;side+=2){
    this.box(x,y+side*(.62+brace),z,1.54,.36,.32,0,id);
    this.box(x-.1,y+side*(.6+brace),z+.3,1.5,.34,.38,25,id,-1);
   }
   this.box(x-.14-recoil,y,z+.46,1.65,1.25,.59,25,id,-1);
   this.box(x-.43-recoil,y,z+.94,.75,.97,.2,25,id,-1);
   this.box(x+.41-recoil,y,z+.67,.76,.61,.4,23,id);
   this.box(x+.53-recoil,y,z+.8,.46,.43,.29,26,id);
   this.box(x+.84-recoil,y,z+.79,.78,.28,.25,23,id);
   this.box(x+1.2-recoil,y,z+.85,.18,.1,.16,27,id);
   this.box(x-.2-recoil,y,z+1.06,.2,1.25,.12,23,id);
   this.box(x+.22-recoil,y,z+.98,.47,.5,attacking?.8:.55,25,id,-2);
   if(attacking&&e[o+11]>.88)this.emissive(x+1.27-recoil,y,z+.95,27,id,2,2);
   return;
  }
  // Riveter: compact round hood and backpack, with a warm face/tool cluster.
  this.box(x-.15,y+gait-.12,z,.2,.24,.25,10,id);
  this.box(x+.15,y-gait+.12,z,.2,.24,.25,10,id);
  this.box(x,y,z+.24,.5,.46,.43,14,id,-1);
  this.box(x,y-.27,z+.3,.36,.22,.4,13,id);
  this.box(x,y,z+.65,.49,.46,.28,8,id,-1);
  this.box(x+.23,y,z+.69,.19,.2,.14,22,id);
  if(e[o+10]>0)this.crate(x-.35,y,z+.3,.28+Math.min(4,e[o+10])*.03,id);
  const working=state===3||state===8,strike=working&&phase<.22;
  const lift=working?(phase<.45?.28:-.1):0;
  this.box(x+.32,y,z+.45,.2,.2,.17,7,id);
  this.box(x+.5,y,z+.45+lift,.14,.14,.36,21,id);
  this.box(x+.5,y,z+.75+lift,.35,.16,.12,22,id);
  if(strike){this.box(x+.6,y,z+.4,.15,.15,.15,18);this.box(x+.8,y,z+.58,.1,.1,.1,22);}
 }

 private effects(e:Float32Array,o:number) {
  const x=e[o],y=e[o+1],z=e[o+2],k=e[o+4],sub=e[o+10],age=e[o+11],dx=Math.cos(e[o+3]),dy=Math.sin(e[o+3]);
  if(k===50){const color=sub===30||sub===31?26:sub===22?22:17;
   const steps=sub===30?3:sub===23?7:sub===31?5:4;
   for(let j=steps-1;j>=0;j--){const q=j*(sub===30?.48:.26);this.box(x-dx*q,y-dy*q,z-(sub===31?j*.035:0),.13,.13,.115,32+color);}
   this.emissive(x,y,z+.12,32+(sub===30||sub===31?27:sub===22?22:18),-1,2,1);
   if(sub===31)this.box(x,y,this.ground(x,y)+.05,.22,.22,.02,2);
  }else if(k===51){
   const blast=sub===31,r=.18+Math.floor(age*12)*(blast?.23:.1);
   if(age<.2)this.box(x,y,z,.38,.38,.46,32+(blast?27:9),-1,-2);
   for(let j=0;j<6;j++){const a=j*Math.PI/3;this.box(x+Math.cos(a)*r,y+Math.sin(a)*r,z+.08+(j%2)*.16,.24,.24,.23,32+(age<.25?(sub===30||blast?26:18):20));}
   if(blast&&age>.2)for(let j=0;j<5;j++)this.box(x+(j-2)*r*.45,y+(j%2)*.4,this.ground(x,y)+.1,.3,.35,.12,age<.5?5:4);
  }
  else if(k===52){this.box(x,y,z,.48,.45,.2,sub>=30?23:4);this.box(x+.28,y+.12,z,.2,.2,.14,sub>=30?24:7);}
 }
 private ambient(t:number) {
  for(let j=0;j<16;j++){const x=18.8+j*17%81/10,y=25+j*11%37/10,z=this.ground(x,y),sway=Math.floor(t/1.4+j)%2*.18;this.box(x+sway,y,z,.13,.12,.38,21);this.box(x+.2+sway,y+.08,z,.12,.13,.48,20);this.box(x-.18,y,z,.13,.12,.27,21);}
  for(let j=0;j<3;j++){const q=(t/5+j/3)%1;for(let a=0;a<9;a++)this.box(19+j*2+q*2+a*.24,26+j*.6+(a%3)*.09,this.ground(19+j*2,26+j*.6)+.15,.18,.16,.05,a%3===0?21:20);}
  for(let j=0;j<12;j++){const q=(t/(7+j%3*2)+j*.27)%1,x=7+j*17%58/10+q*.4,y=3+j*7%40/10;this.box(x,y,1.5+q*.6,.07,.07,.08,30);}
  for(let j=0;j<8;j++){if((Math.floor(t*5)+j*3)%18>5)continue;const x=7+j*17%59/10,y=3+j*7%40/10;this.box(x,y,this.ground(x,y)+.6+j%5*.37,.18,.18,.15,18);}
  const warning=t>=33&&(t-33)%30<3&&Math.floor(t*2)%2===0;
  for(let j=0;j<3;j++){const x=29+j*.65,y=4+j*.6;this.box(x,y,this.ground(x,y)+.15,.18,.18,.4,warning?22:19);}
  // Freighter and haze remain behind the north rim at every discrete camera yaw.
  const q=t%45;if(q<9){const x=3+q*1.1,y=1.;this.box(x,y,3.2,2.,.45,.25,4);this.box(x-.6,y,3.45,.55,.5,.18,5);this.box(x-1.2,y,3.2,.18,.2,.12,21);}
 }
 private rect(x:number,y:number,w:number,h:number,c:number) {this.box(x+w/2,y+h/2,0,w,h,0,c,-1,1);}
 private text(value:string,x:number,y:number,color=9) {for(let i=0;i<value.length;i++){const g=glyphs[value[i]]||glyphs[' '];for(let p=0;p<g.pixels.length;p++)if(g.pixels[p])this.rect(x+p%g.width,y+Math.floor(p/g.width),1,1,color);x+=g.width+1;}}
 private buttonGlyph(kind:number,x:number,y:number) {
  if(kind>=2){this.rect(x,y+4,10,2,9);if(kind===3)this.rect(x+4,y,2,10,9);return;}
  const mirror=kind===1;for(let row=0;row<10;row++)for(let col=0;col<10;col++){
   const c=mirror?9-col:col;
   if((row<6&&c>=3-row&&c<=3)||(row>=3&&row<=5&&c>=3&&c<=7)||(row>=5&&row<=8&&c>=7&&c<=8))this.rect(x+col,y+row,1,1,9);
  }
 }
 private hud(e:Float32Array,alloy:number,charge:number) {
  const o=this.selected===null?-1:this.selected*12;
  const kind=o<0?-1:e[o+4],hp=o<0?-1:Math.round(e[o+7]*100),job=o<0?-1:e[o+5],progress=o<0?-1:Math.floor(e[o+10]*100);
  if(alloy!==this.hudAlloy||charge!==this.hudCharge||o!==this.hudSelection||kind!==this.hudKind||hp!==this.hudHealth||job!==this.hudJob||progress!==this.hudProgress){const start=this.count;this.rect(8,6,464,14,0);this.rect(8,19,464,1,5);this.text('STARHOLD',11,9);this.rect(287,12,4,5,20);this.rect(292,12,4,5,21);this.rect(290,8,4,4,22);this.text('ALLOY '+alloy,300,9,22);this.rect(379,9,5,8,16);this.rect(381,7,2,11,18);this.text('CHARGE '+charge,389,9,18);
   for(let j=0;j<4;j++){this.rect(370+j*25,244,22,20,5);this.rect(371+j*25,245,20,18,1);this.buttonGlyph(j,376+j*25,249);}
   if(o>=0){this.rect(8,242,134,23,5);this.rect(9,243,132,21,0);this.text(names[e[o+4]]||'COLONY',12,244);this.rect(12,252,125,3,3);this.rect(12,252,Math.floor(125*e[o+7]),3,13);const max=e[o+4]===10?1500:e[o+4]===16?900:e[o+4]<20?600:e[o+4]===20?70:e[o+4]===23?110:e[o+4]===24?150:e[o+4]===30?80:e[o+4]===31?240:180;this.text('HP '+Math.round(e[o+7]*max)+' '+(jobs[e[o+5]]||'IDLE')+(e[o+5]===5?' '+Math.floor(e[o+10]*100)+'%':''),12,257,7);}
   this.hudCount=this.count-start;for(let i=0;i<this.hudCount*8;i++)this.hudData[i]=this.data[start*8+i];this.hudAlloy=alloy;this.hudCharge=charge;this.hudSelection=o;this.hudKind=kind;this.hudHealth=hp;this.hudJob=job;this.hudProgress=progress;
  }else{for(let i=0;i<this.hudCount*8;i++)this.data[this.count*8+i]=this.hudData[i];this.count+=this.hudCount;}
 }
 private markContours(yaw:number,zoom:number) {
  this.contourData.fill(0);
  const c=Math.round(Math.cos(yaw*Math.PI/2)),s=Math.round(Math.sin(yaw*Math.PI/2));
  const horizontal=6*GRID/zoom,vertical=3.4641016*GRID/zoom,height=6.9282032*GRID/zoom;
  for(let i=0;i<this.worldCount;i++){
   const q=i*8,color=this.data[q+6],core=this.data[q+7]===-4;
   if(Math.floor((color%32768)/32)===0&&!core)continue;
   const x=this.data[q]-16,y=this.data[q+1]-16,rx=x*c-y*s,ry=x*s+y*c;
   let px=240*GRID+horizontal*(rx-ry),py=136*GRID+vertical*(rx+ry)-height*this.data[q+2];
   const combat=Math.floor(color/32768)>=18;
   let halfX=horizontal*(this.data[q+3]+this.data[q+4])*.5;
   let halfY=vertical*(this.data[q+3]+this.data[q+4])*.5,rise=height*this.data[q+5];
   if(combat){
    const a=i*4,ax=this.actorData[a]-16,ay=this.actorData[a+1]-16;
    const arx=ax*c-ay*s,ary=ax*s+ay*c;
    const anchorX=240*GRID+horizontal*(arx-ary),anchorY=136*GRID+vertical*(arx+ary)-height*this.actorData[a+2];
    px=anchorX+(px-anchorX)*1.4;py=anchorY+(py-anchorY)*this.actorData[a+3];
    halfX*=1.4;halfY*=this.actorData[a+3];rise*=this.actorData[a+3];
   }
   if(core){halfX=this.data[q+3]*.5;halfY=this.data[q+4]*.5;rise=0;}
   // Four raster pixels cover rounding plus the complete two-pixel contour.
   const left=Math.max(0,Math.floor((px-halfX-4)/CONTOUR_TILE)),right=Math.min(CONTOUR_COLUMNS-1,Math.floor((px+halfX+4)/CONTOUR_TILE));
   const top=Math.max(0,Math.floor((py-halfY-rise-4)/CONTOUR_TILE)),bottom=Math.min(CONTOUR_ROWS-1,Math.floor((py+halfY+4)/CONTOUR_TILE));
   for(let row=top;row<=bottom;row++)for(let col=left;col<=right;col++)this.contourData[row*256+col]|=combat?3:1;
  }
 }
 render(e:Float32Array,n:number,yaw:number,zoom:number,alloy:number,charge:number,tick:number) {
  this.time=tick/60;this.count=this.staticCount;this.emissiveCount=this.staticEmissiveCount;this.selected=null;
  for(let id=0;id<n;id++){const o=id*12,k=e[o+4];if(e[o+8]===1)this.selected=id;
   if(k>=10&&k<20)this.building(e,o,id);
   else if(k>=20&&k<=31)this.unit(e,o,id,yaw,zoom);
   else if(k===40){const h=e[o+10]>0?1.3+id%3*.35:e[o+11]*1.4;this.shard(e[o],e[o+1],e[o+2],Math.max(.08,h*1.4),31);}
   else if(k===41){this.box(e[o],e[o+1],e[o+2],.38,.36,.23,40);this.box(e[o],e[o+1],e[o+2]-.16,.18,.18,.14,18);}
   else if(k>=50)this.effects(e,o);
  }
  if(this.selected!==null){const o=this.selected*12,r=e[o+4]<20?(e[o+4]===10?2.5:e[o+4]===16?1.5:1.8):e[o+4]===20?.65:e[o+4]===31?1.65:1.35;for(let j=0;j<24;j++){if(j%3===Math.floor(this.time/.6)%2)continue;const a=j*Math.PI/12;this.box(e[o]+Math.cos(a)*r,e[o+1]+Math.sin(a)*r,this.ground(e[o],e[o+1])+.08,.2,.2,.035,54);}}
  this.ambient(this.time);
  this.worldCount=this.count;this.hud(e,alloy,charge);
  this.markContours(yaw,zoom);
  this.camera[0]=Math.round(Math.cos(yaw*Math.PI/2));this.camera[1]=Math.round(Math.sin(yaw*Math.PI/2));this.camera[2]=1/zoom;
  const d=this.device;d.queue.writeBuffer(this.uniform,0,this.camera);d.queue.writeBuffer(this.buffer,0,this.data.buffer,0,this.count*32);d.queue.writeBuffer(this.actorBuffer,0,this.actorData.buffer,0,this.count*16);
  d.queue.writeTexture(this.contourUpload,this.contourData,this.contourLayout,this.contourSize);
  const encoder=d.createCommandEncoder();const pass=encoder.beginRenderPass(this.scenePass);pass.setPipeline(this.pipeline);pass.setBindGroup(0,this.group);pass.setVertexBuffer(0,this.vertex);pass.setVertexBuffer(1,this.buffer);pass.setVertexBuffer(2,this.actorBuffer);pass.draw(36,this.count);pass.end();
  this.presentPass.colorAttachments[0].view=this.context.getCurrentTexture().createView();const post=encoder.beginRenderPass(this.presentPass);post.setPipeline(this.post);post.setBindGroup(0,this.postGroup);post.draw(3);post.end();d.queue.submit(this.commands(encoder.finish()));this.stats.triangles=this.count*12+1;
 }
 private commandList:any[]=[null];
 private commands(command:any) {this.commandList[0]=command;return this.commandList;}
 pick(px:number,py:number,yaw:number,zoom:number):number|null {
  // Orthographic screen ray. Intersect the very same component boxes submitted
  // to the depth buffer; static terrain can occlude the selectable geometry.
  const c=Math.round(Math.cos(yaw*Math.PI/2)),s=Math.round(Math.sin(yaw*Math.PI/2));
  const diff=(px/GRID-240)*zoom/6,sum=(py/GRID-136)*zoom/3.4641016+100;
  const a=(sum+diff)/2,b=(sum-diff)/2;
  const ox=16+c*a+s*b,oy=16-s*a+c*b,oz=50,dx=-c-s,dy=s-c,dz=-1;
  let best=Infinity,owner=-1;
  for(let i=0;i<this.worldCount;i++){const o=i*8;if(this.data[o+7]>0||this.data[o+7]<=-3)continue;let near=0,far=Infinity;
   for(let axis=0;axis<3;axis++){const origin=axis===0?ox:axis===1?oy:oz,dir=axis===0?dx:axis===1?dy:dz;let min=this.data[o+axis]-(axis<2?this.data[o+3+axis]/2:0),max=min+this.data[o+3+axis];if(this.owners[i]>=0&&this.data[o+3]<1&&this.data[o+4]<1){min-=.12;max+=.12;}if(dir===0){if(origin<min||origin>max){far=-1;break;}}else{let t1=(min-origin)/dir,t2=(max-origin)/dir;if(t1>t2){const t=t1;t1=t2;t2=t;}near=Math.max(near,t1);far=Math.min(far,t2);}}
   if(near<=far&&near<best){best=near;owner=this.owners[i];}
  }return owner<0?null:owner;
 }
}
