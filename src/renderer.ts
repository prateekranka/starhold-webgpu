import {palette, names, jobs} from './kinds';
import {glyphs} from './font';
const MAX=8000, STRIDE=8;
const colors=palette.map(h=>[parseInt(h.slice(0,2),16)/255,parseInt(h.slice(2,4),16)/255,parseInt(h.slice(4,6),16)/255]);
const paletteWGSL=`const palette = array<vec3f,32>(${colors.map(c=>`vec3f(${c.join(',')})`).join(',')});`;
const geometryWGSL=paletteWGSL+`
struct Camera { rotation:vec2f, magnification:f32, padding:f32 }
@group(0) @binding(0) var<uniform> camera:Camera;
struct Out { @builtin(position) position:vec4f, @location(0) color:vec3f }
@vertex fn vs(@location(0) vertex:vec3f,@location(1) shade:f32,@location(2) origin:vec3f,@location(3) size:vec3f,@location(4) color:f32,@location(5) screen:f32)->Out {
 var o:Out;
 var v=vertex;
 if screen < -0.5 {v=vec3f(vertex.xy*select(1.,select(.55,.08,screen < -1.5),vertex.z>.5),vertex.z);}
 let p=origin+v*size;
 if screen>0.5 {o.position=vec4f(p.x/240.-1.,1.-p.y/135.,0.0001,1.);o.color=palette[u32(color)];}
 else {
 let d=p.xy-vec2f(16.);
 let r=vec2f(d.x*camera.rotation.x-d.y*camera.rotation.y,d.x*camera.rotation.y+d.y*camera.rotation.x);
 let pixel=round(vec2f(240.+6.*(r.x-r.y)*camera.magnification,136.+(3.4641016*(r.x+r.y)-6.9282032*p.z)*camera.magnification));
 o.position=vec4f(pixel.x/240.-1.,1.-pixel.y/135.,0.5-((r.x+r.y)*0.5773503+p.z*0.5773503)/128.,1.);
 o.color=palette[u32(max(0.,color-shade))];
 } return o;
}
@fragment fn fs(i:Out)->@location(0) vec4f {return vec4f(i.color,1.);}
`;
const postWGSL=paletteWGSL+`
@group(0) @binding(0) var scene:texture_2d<f32>;
@vertex fn vs(@builtin(vertex_index) i:u32)->@builtin(position) vec4f {
 let p=array<vec2f,3>(vec2f(-1.,-1.),vec2f(3.,-1.),vec2f(-1.,3.));return vec4f(p[i],0.,1.);
}
@fragment fn fs(@builtin(position) p:vec4f)->@location(0) vec4f {
 let c=textureLoad(scene,vec2i(p.xy),0).rgb;var best=palette[0];var distance=100.;
 for(var i=0u;i<32u;i++){let delta=c-palette[i];let d=dot(delta,delta);if d<distance {distance=d;best=palette[i];}}
 return vec4f(best,1.);
}`;
export class Renderer {
 readonly data=new Float32Array(MAX*STRIDE);
 readonly owners=new Int32Array(MAX);
 readonly camera=new Float32Array([1,0,1,0]);
 readonly stats={drawCalls:2,triangles:0};
 time=0;count=0;staticCount=0;worldCount=0;selected:number|null=null;
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
  face([-.5,.5,0],[-.5,-.5,0],[-.5,-.5,1],[-.5,.5,1],1);
  face([.5,-.5,0],[.5,.5,0],[.5,.5,1],[.5,-.5,1],2);
  face([-.5,.5,0],[.5,.5,0],[.5,-.5,0],[-.5,-.5,0],2);
  this.vertex=d.createBuffer({size:mesh.length*4,usage:GPUBufferUsage.VERTEX|GPUBufferUsage.COPY_DST});d.queue.writeBuffer(this.vertex,0,new Float32Array(mesh));
  this.buffer=d.createBuffer({size:this.data.byteLength,usage:GPUBufferUsage.VERTEX|GPUBufferUsage.COPY_DST});
  this.uniform=d.createBuffer({size:16,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});
  const module=d.createShaderModule({code:geometryWGSL});
  this.pipeline=d.createRenderPipeline({layout:'auto',vertex:{module,entryPoint:'vs',buffers:[{arrayStride:16,attributes:[{shaderLocation:0,offset:0,format:'float32x3'},{shaderLocation:1,offset:12,format:'float32'}]},{arrayStride:32,stepMode:'instance',attributes:[{shaderLocation:2,offset:0,format:'float32x3'},{shaderLocation:3,offset:12,format:'float32x3'},{shaderLocation:4,offset:24,format:'float32'},{shaderLocation:5,offset:28,format:'float32'}]}]},fragment:{module,entryPoint:'fs',targets:[{format:'rgba8unorm'}]},primitive:{topology:'triangle-list'},depthStencil:{format:'depth24plus',depthWriteEnabled:true,depthCompare:'less-equal'}});
  this.group=d.createBindGroup({layout:this.pipeline.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:this.uniform}}]});
  const scene=d.createTexture({size:[480,270],format:'rgba8unorm',usage:GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.TEXTURE_BINDING});
  const depth=d.createTexture({size:[480,270],format:'depth24plus',usage:GPUTextureUsage.RENDER_ATTACHMENT});
  const postModule=d.createShaderModule({code:postWGSL});this.post=d.createRenderPipeline({layout:'auto',vertex:{module:postModule,entryPoint:'vs'},fragment:{module:postModule,entryPoint:'fs',targets:[{format}]},primitive:{topology:'triangle-list'}});
  const sceneView=scene.createView();this.postGroup=d.createBindGroup({layout:this.post.getBindGroupLayout(0),entries:[{binding:0,resource:sceneView}]});
  this.scenePass={colorAttachments:[{view:sceneView,clearValue:{r:16/255,g:18/255,b:28/255,a:1},loadOp:'clear',storeOp:'store'}],depthStencilAttachment:{view:depth.createView(),depthClearValue:1,depthLoadOp:'clear',depthStoreOp:'discard'}};
  this.presentPass={colorAttachments:[{view:null,loadOp:'clear',storeOp:'store',clearValue:{r:16/255,g:18/255,b:28/255,a:1}}]};
  this.terrain.set(terrain);this.makeTerrain();
 }
 onError(callback:(message:string)=>void) {this.device.addEventListener('uncapturederror',(e:any)=>callback(e.error.message));this.device.lost.then((info:any)=>callback(`WebGPU device lost: ${info.message}`));}
 box(x:number,y:number,z:number,sx:number,sy:number,sz:number,color:number,owner=-1,screen=0) {
  if(this.count>=MAX) return;
  const i=this.count*8;this.data[i]=x;this.data[i+1]=y;this.data[i+2]=z;this.data[i+3]=sx;this.data[i+4]=sy;this.data[i+5]=sz;this.data[i+6]=color;this.data[i+7]=screen;this.owners[this.count++]=owner;
 }
 ground(x:number,y:number) {return this.terrain[Math.max(0,Math.min(31,Math.floor(y)))*32+Math.max(0,Math.min(31,Math.floor(x)))];}
 private shard(x:number,y:number,z:number,h:number,c=30,owner=-1) {
  this.box(x,y,z,.38,.48,h,c,owner,-2);
  this.box(x+.25,y+.12,z,.24,.25,h*.56,c-1,owner,-2);
 }
 private makeTerrain() {
  // Broken outer contour and staggered basalt columns avoid the old square plate.
  for(let y=0;y<32;y++)for(let x=0;x<32;x++) {
   const h=this.ground(x,y),hash=((x*374761393+y*668265263)^(x*y*1274126177))>>>0;
   const edge=x<2||x>29||y<2||y>29;
   if(edge&&(hash%5<3)||x<5&&y<9||x<7&&y<3||x>28&&y>27)continue;
   const bottom=-3.5-(hash%5)*.35;
   this.box(x+.5,y+.5,bottom,.98,.98,h-bottom,h<0?3:hash%11===0?29:4);
   if((x+y)%3===0)this.box(x+.3,y+.42,h+.014,.47,.3,.025,hash%3===0?29:5);
   if(hash%13===0)this.box(x+.64,y+.65,h+.03,.28,.22,.1,3);
   // Exposed vertical seams and projecting shelves use the cliff family only.
   if(y===31||x===31||this.ground(x+1,y)<h||this.ground(x,y+1)<h||edge){
    this.box(x+.87,y+.83,bottom+.4,.17,.18,h-bottom-.6,hash%2?2:3);
    if(hash%3===0)this.box(x+.55,y+.64,bottom+1.1,.9,.92,.2,4);
   }
  }
  const roads=[[7,25,5,25],[8.5,23,11,20],[11,20,13,18],[13,18,16,18.6],[8,21.5,8,17],[8,17,6.7,17],[18.5,16,18.5,14],[18.5,14,24,14],[16,13,18.5,14],[18,20,22,22],[24,14,27,12],[19,22,19,25]];
  for(const r of roads){const length=Math.hypot(r[2]-r[0],r[3]-r[1]);for(let t=0;t<length;t+=.6){const x=r[0]+(r[2]-r[0])*t/length,y=r[1]+(r[3]-r[1])*t/length;for(let lane=-1;lane<=1;lane++){const xx=x+lane*.43*(r[3]-r[1])/length,yy=y-lane*.43*(r[2]-r[0])/length;this.box(xx,yy,this.ground(xx,yy)+.04,.42,.46,.04,(Math.floor(t*10)+lane)%4===0?5:6);}}}
  for(let i=0;i<34;i++){const x=7+(i*17%59)/10,y=3+(i*7%40)/10;this.shard(x,y,this.ground(x,y),.6+i%5*.37);}
  for(let i=0;i<20;i++){const x=2.4+(i*19%54)/10,y=20+(i*23%83)/10;if(x>5.1&&y<25)continue;this.shard(x,y,this.ground(x,y),.45+(i%4)*.45);}
  // Low ruined arch feet and scattered masonry frame the foreground route.
  for(let i=0;i<5;i++){const x=19+i*1.75,y=27.8-i%2*.3,z=this.ground(x,y);this.box(x,y,z,.68,.65,.65+i%2*.2,4);this.box(x+.65,y+.2,z,.42,.5,.3,5);if(i%2===0){this.box(x,y,z+.65,.35,.42,.45,5);this.box(x+.24,y,z+1.05,.65,.45,.15,4);}}
  for(let i=0;i<18;i++){const x=3+(i*43%263)/10,y=3+(i*71%263)/10;if(x>8&&x<23&&y>9&&y<24)continue;this.box(x,y,this.ground(x,y),.3+i%3*.1,.35,.2+i%3*.15,4);}
  for(let i=0;i<7;i++){const x=26.8+i%3*1.2,y=3+i*1.25,z=this.ground(x,y);this.box(x,y,z,.6,.6,1.1+i%3*.45,3);this.box(x,y,z+1.1+i%3*.45,.75,.75,.22,5);}
  this.staticCount=this.count;
 }
 private building(e:Float32Array,o:number,id:number) {
  const x=e[o],y=e[o+1],z=e[o+2],k=e[o+4],p=e[o+10],phase=e[o+6];
  const w=k===10||k===17?4:k===12||k===16?2:3,depth=k===15?2:k===17?3:w;
  this.box(x+.2,y+.25,z+.01,w+.5,depth+.5,.035,2);
  this.box(x,y,z,w+.2,depth+.2,.19,7,id);
  this.box(x,y,z+.19,w-.12,depth-.12,.12,11,id);
  if(p<1){
   const h=p<.2?.35:p<.5?1.4:2.8;
   for(let a=-1;a<=1;a+=2)for(let b=-1;b<=1;b+=2){this.box(x+a*w*.44,y+b*depth*.44,z+.3,.16,.16,h,7,id);this.box(x+a*w*.44,y+b*depth*.44,z+.3+h,.22,.22,.12,22,id);}
   if(p>=.2){for(let level=0;level<2;level++){this.box(x,y-depth*.44,z+.8+level*.85,w,.1,.1,21,id);this.box(x+w*.44,y,z+.8+level*.85,.1,depth,.1,20,id);}}
   this.crane(x+w*.65,y-.25,z,w*.75,3.9,phase,id);
   for(let a=0;a<2;a++)this.crate(x-w*.65,y+.7*a,z,.45,id);
   if(p<.2)return;
  }
  if(k===10){
   this.box(x,y,z+.3,3.7,3.7,1.45,11,id);
   for(let a=-1;a<=1;a+=2)for(let b=-1;b<=1;b+=2){this.box(x+a*1.65,y+b*1.65,z+.3,.45,.45,2.1,8,id);this.box(x+a*1.65,y+b*1.65,z+2.4,.5,.5,.2,8,id);this.box(x+a*1.65,y+b*1.65,z+2.6,.08,.08,.45,22,id);}
   this.box(x,y,z+1.75,3.9,3.9,.22,8,id);
   this.box(x,y,z+1.97,2.8,2.8,.8,12,id);
   this.box(x,y,z+2.77,3.,3.,.2,8,id);
   this.box(x,y,z+2.97,1.3,1.3,1.2,8,id);
   this.box(x,y,z+3.0,.78,1.36,1.05,11,id);
   this.box(x,y,z+4.17,1.4,1.4,.2,12,id);
   for(let a=-1;a<=1;a+=2){this.box(x+a*.38,y,z+4.35,.09,.1,.65,22,id);this.box(x+a*1.1,y+1.88,z+.35,.27,.13,1.25,8,id);this.box(x+1.88,y+a*1.1,z+.35,.13,.27,1.25,8,id);}
   this.box(x,y,z+4.35,.8,.1,.1,21,id);
   this.box(x,y+1.9,z+.2,.72,.1,1.3,1,id);this.box(x,y+1.96,z+.3,.12,.04,.45,26,id);
   for(let j=0;j<3;j++)this.box(x,y+2.05+j*.21,z,.9,.25,.3-j*.08,7,id);
   for(let j=-1;j<=1;j+=2){this.box(x+j*1.35,y+1.9,z+.8,.16,.09,.45,22,id);this.box(x+1.9,y+j*.9,z+.85,.08,.18,.5,22,id);}
   this.banner(x-.9,y+1.98,z+2.3,phase,id);
   this.banner(x+1.98,y+.85,z+2.3,phase+.3,id);
  } else if(k===12){
   this.box(x,y,z+.3,1.8,1.8,.3,12,id,-1);
   for(let j=0;j<6;j++){const a=j*Math.PI/3;this.box(x+Math.cos(a)*.8,y+Math.sin(a)*.8,z+.25,.45,.45,.45,8,id);}
   if(p>=.2)for(let a=-1;a<=1;a+=2)this.box(x+a*.8,y,z+.55,.24,.46,p<.5?1.3:2.5,8,id);
   if(p>=.5){const bob=Math.floor(phase*4)%2*.08;this.shard(x,y,z+.65+bob,2.9,17,id);for(let j=0;j<3;j++){this.box(x,y,z+.85+j*.65,.75,.75,.12,16,id);this.box(x-.18,y+.26,z+.9+j*.65,.08,.08,.48,Math.floor(phase*4)===j?18:17,id);}this.box(x,y,z+3.55,.1,.1,.4,18,id);}
  } else if(k===16){
   const levels=p<.5?1:p<.85?2:3;
   for(let j=0;j<levels;j++){this.box(x,y,z+.3+j*.85,1.65-j*.28,1.65-j*.28,.72,11,id);this.box(x,y,z+.98+j*.85,1.8-j*.28,1.8-j*.28,.15,8,id);}
   // Incomplete cheeks remain separate: empty upper volume and exposed cross ribs.
   for(let a=-1;a<=1;a+=2){this.box(x+a*(p<.85?.86:.62),y,z+.3,.24,.65,levels*.85+.35,8,id);this.box(x+a*.6,y-.25,z+.3,.13,.13,levels*.85+.6,7,id);}
   if(p>=.5){this.box(x,y-.2,z+2.12,1.25,.14,.13,21,id);this.box(x,y,z+2.3,.38,.38,.3,16,id);}
   if(p>=.85){const dx=Math.cos(e[o+3]),dy=Math.sin(e[o+3]);this.box(x,y,z+3.,.5,.5,.55,12,id);for(let j=0;j<4;j++)this.box(x+dx*j*.23,y+dy*j*.23,z+3.2,.23,.23,.2,j===3?18:16,id);for(let a=-1;a<=1;a+=2)this.box(x+a*.66,y,z+3.,.08,.08,.95,22,id);}
  } else if(k===15){
   for(let a=-1;a<=1;a++){this.box(x+a*.98,y,z+.3,.87,1.7,.25,12,id);for(let b=-1;b<=1;b+=2)this.box(x+a*.98,y+b*.68,z+.55,.8,.16,p<.5?.55:1.25,7,id);if(p>=.5){this.box(x+a*.98,y,z+.55,.8,1.5,1.1,8,id);this.box(x+a*.98,y,z+1.65,.95,1.8,.25,8,id,-1);this.box(x+a*.98,y,z+1.9,.58,1.05,.14,12,id);this.box(x+a*.98,y+.79,z+.85,.19,.07,.45,19,id);this.box(x+a*.98,y+.84,z+.9,.1,.04,.3,22,id);this.box(x+a*.98,y+1.,z+1.45,.88,.5,.1,12,id);}}
   if(p>=.85)this.box(x+1.15,y-.6,z+2,.06,.06,.5,22,id);
  } else if(k===17){
   // Open landing deck, crescent edge and independent control hut.
   for(let j=-2;j<=2;j++)if(p>=(j+3)*.08)this.box(x+j*.7,y,z+.3,.62,2.5,.1,11,id);
   if(p>=.5){for(let a=-1;a<=1;a+=2){this.box(x+a*1.8,y,z+.4,.25,2.7,.3,8,id);this.box(x,y+a*1.3,z+.4,3.4,.23,.3,8,id);}this.box(x-1.2,y-.7,z+.4,.9,.9,1.1,12,id);this.box(x-1.2,y-.7,z+1.5,1.,1.,.18,8,id);this.box(x-1.2,y-.23,z+.95,.5,.08,.3,17,id);this.crane(x+1.5,y-.9,z,1.5,2.5,phase,id);}
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
    this.box(x,y+1.34,z+.3,1.25,.18,1.3,1,id);this.box(x,y+1.45,z+.35,.9,.12,.95,25,id);this.box(x,y+1.53,z+.4,.45,.1,.65,27,id);this.box(x,y+1.8,z+.21,.5,.6,.06,26,id);
    for(let j=0;j<8;j++){const a=(j/8+phase)*Math.PI*2;this.box(x+1.48,y+Math.cos(a)*.55,z+1.+Math.sin(a)*.55,.2,.24,.24,21,id);}
    for(let j=0;j<5;j++){const q=(phase+j/5)%1;this.box(x-.7+q*.5,y-.6,z+3.1+q*1.5,.25+Math.floor(q*3)*.17,.25+Math.floor(q*3)*.17,.25, q<.5?5:3);}}
  }
  if(p>=.85&&k!==12&&k!==16){for(let j=0;j<2;j++)this.crate(x+w*.5+.3,y+.6*j,z,.38,id);}
 }
 private crate(x:number,y:number,z:number,size:number,id=-1) {
  this.box(x,y,z,size,size,size,21,id);this.box(x,y,z+size,size*.18,size+.025,.03,22,id);this.box(x+size*.5,y,z+.03,.025,size*.15,size*.9,19,id);
 }
 private banner(x:number,y:number,z:number,phase:number,id:number) {
  this.box(x,y,z-.6,.07,.07,1.2,21,id);this.box(x+.35,y+(Math.floor(phase*3)%2)*.08,z-.35,.68,.07,.65,12,id);this.box(x+.3,y+.05,z-.2,.09,.04,.2,22,id);
 }
 private crane(x:number,y:number,z:number,w:number,h:number,phase:number,id:number) {
  this.box(x,y,z,.17,.17,h,20,id);this.box(x-w*.5,y,z+h,w+.15,.18,.18,22,id);const lift=.8+Math.floor(phase*6)/6*(h-1.2);this.box(x-w*.8,y,z+lift,.05,.05,h-lift,19,id);this.box(x-w*.8,y,z+lift-.15,.2,.2,.16,22,id);this.box(x-w*.8,y,z+lift-.55,.42,.42,.4,12,id);
 }
 private unit(e:Float32Array,o:number,id:number) {
  const x=e[o],y=e[o+1],z=e[o+2],k=e[o+4],phase=e[o+6],state=e[o+5],moving=state===1||state===6;
  const gait=moving?(phase<.5?-.16:.16):0,enemy=e[o+9]===1,dx=Math.cos(e[o+3]),dy=Math.sin(e[o+3]);
  this.box(x,y,this.ground(x,y)+.045,k===24?1.6:k===31?1.4:.65,k===24?.8:.5,.025,2);
  if(k===24){this.box(x,y,z,1.8,.8,.25,11,id);this.box(x,y,z+.25,1.25,.6,.25,12,id);for(let a=-1;a<=1;a+=2){this.box(x+a*.85,y,z,.25,1.25,.3,8,id);this.box(x+a*.75,y-.55,z+.1,.22,.4,.2,7,id);this.box(x+a*.6,y-.5,z-.05,.16,.25,.1,phase<.5?17:18,id);}this.box(x,y+.4,z+.15,1.4,.18,.15,8,id);this.box(x-.4,y,z+.5,.35,.4,.15,3,id);if(e[o+10]>0)this.crate(x+.2,y,z+.5,.45,id);if(state===7){this.box(x,y,z-1.,.04,.04,1.,21,id);this.crate(x,y,z-1.3,.35,id);}return;}
  if(k===21){for(let a=-1;a<=1;a+=2)for(let b=-1;b<=1;b++){this.box(x+a*.58,y+b*.4+gait*a,z,.15,.2,.4,4,id);this.box(x+a*.43,y+b*.4,z+.35,.4,.17,.16,21,id);}this.box(x,y,z+.45,1.15,1.2,.35,12,id);this.box(x,y+.55,z+.5,.65,.18,.25,8,id);for(let j=0;j<2;j++)if(e[o+10]>j*8)this.crate(x+(j-.5)*.5,y,z+.8,.45,id);this.box(x-.3,y+.4,z+.8,.07,.07,.35,22,id);return;}
  if(k===31){for(let a=-1;a<=1;a+=2){this.box(x+a*.65,y+.15+gait*a,z,.28,.5,.2,24,id);this.box(x+a*.65,y+.15+gait*a,z+.2,.18,.2,.9,25,id);this.box(x+a*.65,y-.2,z+1.,.2,.65,.18,24,id);this.box(x+a*.52,y-.4,z+1.1,.2,.2,.75,25,id);}this.box(x,y,z+1.5,1.5,1.3,.75,24,id,-1);this.box(x-.45,y,z+1.7,.22,1.4,.65,25,id);this.box(x,y+.66,z+1.6,.65,.09,.35,26,id);for(let j=0;j<4;j++)this.box(x+dx*j*.22,y+dy*j*.22,z+1.9,.32,.3,.25,j===3?26:23,id);if(state===2&&phase<.12)this.box(x+dx*.85,y+dy*.85,z+1.9,.35,.35,.25,27);return;}
  const h=k===23?1.45:k===22?1.3:k===30?1.05:.94;
  this.box(x-.15,y+gait,z,.18,.26,.33,enemy?23:10,id);this.box(x+.15,y-gait,z,.18,.26,.33,enemy?23:10,id);
  if(k===23)this.box(x,y-.17,z+.3,.62,.18,.85,11,id,-1);
  this.box(x,y,z+.33,.48,.4,h-.56,enemy?24:12,id);
  this.box(x,y,z+h-.23,.46,.43,.27,enemy?25:8,id,enemy?-2:0);
  this.box(x+dx*.23,y+dy*.23,z+h-.15,.19,.15,.08,enemy?26:17,id);
  if(k===22||k===23){this.box(x-.3,y,z+h-.52,.24,.46,.18,8,id);this.box(x+.3,y,z+h-.52,.24,.46,.18,8,id);}
  if(k===22){this.box(x-.36,y+.14,z+.4,.18,.55,.62,21,id);this.box(x-.37,y+.17,z+.51,.2,.2,.3,22,id);}
  if(k===20){this.box(x,y-.27,z+.38,.36,.22,.4,11,id);if(e[o+10]>0)this.crate(x-.35,y,z+.4,.28+Math.min(4,e[o+10])*.03,id);
   const strike=(state===3||state===8)&&phase<.22,lift=state===3||state===8?(phase<.45?.28:-.1):0;
   this.box(x+dx*.32,y+dy*.32,z+.55,.2,.2,.17,7,id);this.box(x+dx*.5,y+dy*.5,z+.55+lift,.11,.12,.42,21,id);this.box(x+dx*.5,y+dy*.5,z+.9+lift,.35,.14,.1,7,id);
   if(strike){this.box(x+dx*.6,y+dy*.6,z+.5,.15,.15,.15,18);this.box(x+dx*.7+.1,y+dy*.7,z+.68,.1,.1,.1,22);}
  }else{
   const reach=k===23?1.05:.65,recoil=state===2&&phase<.12?.14:0;
   for(let j=0;j<3;j++){const q=.25+j*reach/3-recoil;this.box(x+dx*q,y+dy*q,z+h-.48,.18,.18,.15,k===23?8:enemy?23:10,id);}
   if(k===30){this.box(x,y-.28,z+.5,.3,.4,.35,24,id,-2);this.box(x+dx*.65,y+dy*.65,z+.35,.11,.11,.3,23,id);}
   if(state===2&&(phase<.075||k===23&&phase>.8)){const q=reach+.15;this.box(x+dx*q,y+dy*q,z+h-.46,.22,.22,.18,enemy?27:k===23?18:22);if(phase<.045)this.box(x+dx*(q+.18),y+dy*(q+.18),z+h-.46,.12,.12,.12,9);}
  }
 }
 private effects(e:Float32Array,o:number) {
  const x=e[o],y=e[o+1],z=e[o+2],k=e[o+4],sub=e[o+10],age=e[o+11],dx=Math.cos(e[o+3]),dy=Math.sin(e[o+3]);
  if(k===50){const color=sub===30||sub===31?26:sub===22?22:17;
   const steps=sub===23?9:sub===31?5:3;
   for(let j=steps-1;j>=0;j--){const q=j*(sub===23?.3:.16);this.box(x-dx*q,y-dy*q,z-(sub===31?j*.035:0),j===0?.2:.12,j===0?.2:.12,.12,j===0?(sub===31?27:sub===22?9:18):color);}
   if(sub===31)this.box(x,y,this.ground(x,y)+.05,.22,.22,.02,2);
  }else if(k===51){const r=.12+Math.floor(age*12)*.18;for(let j=0;j<6;j++){const a=j*Math.PI/3;this.box(x+Math.cos(a)*r,y+Math.sin(a)*r,z+.08,.12,.12,.12,age<.12?sub===31?27:18:20);}}
  else if(k===52){this.box(x,y,z,.48,.45,.2,sub>=30?23:4);this.box(x+.28,y+.12,z,.2,.2,.14,sub>=30?24:7);}
 }
 private ambient(t:number) {
  for(let j=0;j<16;j++){const x=18.8+j*17%81/10,y=25+j*11%37/10,z=this.ground(x,y),sway=Math.floor(t/1.4+j)%2*.12;this.box(x+sway,y,z,.07,.1,.25,21);this.box(x+.17+sway,y+.08,z,.07,.1,.35,20);this.box(x-.13,y,z,.08,.1,.18,21);}
  for(let j=0;j<3;j++){const q=(t/5+j/3)%1;for(let a=0;a<6;a++)this.box(19+j*2+q*2+a*.2,26+j*.6,this.ground(19+j*2,26+j*.6)+.12,.13,.09,.035,a%3===0?21:20);}
  for(let j=0;j<12;j++){const q=(t/(7+j%3*2)+j*.27)%1,x=7+j*17%58/10+q*.4,y=3+j*7%40/10;this.box(x,y,1.5+q*.6,.07,.07,.08,30);}
  for(let j=0;j<8;j++){if((Math.floor(t*5)+j*3)%18>1)continue;const x=7+j*17%59/10,y=3+j*7%40/10;this.box(x,y,this.ground(x,y)+.6+j%5*.37,.11,.11,.08,31);}
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
  if(alloy!==this.hudAlloy||charge!==this.hudCharge||o!==this.hudSelection||kind!==this.hudKind||hp!==this.hudHealth||job!==this.hudJob||progress!==this.hudProgress){const start=this.count;this.rect(8,6,464,14,0);this.rect(8,19,464,1,5);this.text('STARHOLD',11,9);this.text('ALLOY '+alloy,300,9,22);this.text('CHARGE '+charge,389,9,18);
   for(let j=0;j<4;j++){this.rect(370+j*25,244,22,20,5);this.rect(371+j*25,245,20,18,1);this.buttonGlyph(j,376+j*25,249);}
   if(o>=0){this.rect(8,240,160,25,5);this.rect(9,241,158,23,0);this.text(names[e[o+4]]||'COLONY',12,243);this.rect(12,252,151,3,3);this.rect(12,252,Math.floor(151*e[o+7]),3,13);const max=e[o+4]===10?1500:e[o+4]===16?900:e[o+4]<20?600:e[o+4]===20?70:e[o+4]===23?110:e[o+4]===30?80:180;this.text('HP '+Math.round(e[o+7]*max)+' '+(jobs[e[o+5]]||'IDLE')+(e[o+5]===5?' '+Math.floor(e[o+10]*100)+'%':''),12,257,7);}
   this.hudCount=this.count-start;for(let i=0;i<this.hudCount*8;i++)this.hudData[i]=this.data[start*8+i];this.hudAlloy=alloy;this.hudCharge=charge;this.hudSelection=o;this.hudKind=kind;this.hudHealth=hp;this.hudJob=job;this.hudProgress=progress;
  }else{for(let i=0;i<this.hudCount*8;i++)this.data[this.count*8+i]=this.hudData[i];this.count+=this.hudCount;}
 }
 render(e:Float32Array,n:number,yaw:number,zoom:number,alloy:number,charge:number,tick:number) {
  this.time=tick/60;this.count=this.staticCount;this.selected=null;
  for(let id=0;id<n;id++){const o=id*12,k=e[o+4];if(e[o+8]===1)this.selected=id;
   if(k>=10&&k<20)this.building(e,o,id);
   else if(k>=20&&k<=31)this.unit(e,o,id);
   else if(k===40){const h=e[o+10]>0?1.3+id%3*.35:e[o+11]*1.4;this.shard(e[o],e[o+1],e[o+2],Math.max(.08,h));}
   else if(k===41){this.box(e[o],e[o+1],e[o+2],.3,.3,.18,8);this.box(e[o],e[o+1],e[o+2]-.12,.12,.12,.12,17);}
   else if(k>=50)this.effects(e,o);
  }
  if(this.selected!==null){const o=this.selected*12,r=e[o+4]<20?(e[o+4]===10?2.5:e[o+4]===16?1.5:1.8):.65;for(let j=0;j<24;j++){if(j%3===Math.floor(e[6]*2))continue;const a=j*Math.PI/12;this.box(e[o]+Math.cos(a)*r,e[o+1]+Math.sin(a)*r,this.ground(e[o],e[o+1])+.08,.2,.2,.035,22);}}
  this.ambient(this.time);
  this.worldCount=this.count;this.hud(e,alloy,charge);
  this.camera[0]=Math.round(Math.cos(yaw*Math.PI/2));this.camera[1]=Math.round(Math.sin(yaw*Math.PI/2));this.camera[2]=1/zoom;
  const d=this.device;d.queue.writeBuffer(this.uniform,0,this.camera);d.queue.writeBuffer(this.buffer,0,this.data.buffer,0,this.count*32);
  const encoder=d.createCommandEncoder();const pass=encoder.beginRenderPass(this.scenePass);pass.setPipeline(this.pipeline);pass.setBindGroup(0,this.group);pass.setVertexBuffer(0,this.vertex);pass.setVertexBuffer(1,this.buffer);pass.draw(36,this.count);pass.end();
  this.presentPass.colorAttachments[0].view=this.context.getCurrentTexture().createView();const post=encoder.beginRenderPass(this.presentPass);post.setPipeline(this.post);post.setBindGroup(0,this.postGroup);post.draw(3);post.end();d.queue.submit(this.commands(encoder.finish()));this.stats.triangles=this.count*12+1;
 }
 private commandList:any[]=[null];
 private commands(command:any) {this.commandList[0]=command;return this.commandList;}
 pick(px:number,py:number,yaw:number,zoom:number):number|null {
  // Orthographic screen ray. Intersect the very same component boxes submitted
  // to the depth buffer; static terrain can occlude the selectable geometry.
  const c=Math.round(Math.cos(yaw*Math.PI/2)),s=Math.round(Math.sin(yaw*Math.PI/2));
  const diff=(px-240)*zoom/6,sum=(py-136)*zoom/3.4641016+100;
  const a=(sum+diff)/2,b=(sum-diff)/2;
  const ox=16+c*a+s*b,oy=16-s*a+c*b,oz=50,dx=-c-s,dy=s-c,dz=-1;
  let best=Infinity,owner=-1;
  for(let i=0;i<this.worldCount;i++){const o=i*8;if(this.data[o+7])continue;let near=0,far=Infinity;
   for(let axis=0;axis<3;axis++){const origin=axis===0?ox:axis===1?oy:oz,dir=axis===0?dx:axis===1?dy:dz;let min=this.data[o+axis]-(axis<2?this.data[o+3+axis]/2:0),max=min+this.data[o+3+axis];if(this.owners[i]>=0&&this.data[o+3]<1&&this.data[o+4]<1){min-=.12;max+=.12;}if(dir===0){if(origin<min||origin>max){far=-1;break;}}else{let t1=(min-origin)/dir,t2=(max-origin)/dir;if(t1>t2){const t=t1;t1=t2;t2=t;}near=Math.max(near,t1);far=Math.min(far,t2);}}
   if(near<=far&&near<best){best=near;owner=this.owners[i];}
  }return owner<0?null:owner;
 }
}
