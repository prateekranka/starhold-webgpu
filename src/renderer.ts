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
 let p=origin+vertex*size;
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
 count=0;staticCount=0;worldCount=0;selected:number|null=null;
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
 private makeTerrain() {
  for(let y=0;y<32;y++)for(let x=0;x<32;x++) {
   const h=this.ground(x,y),hash=((x*374761393+y*668265263)^(x*y*1274126177))>>>0;
   if((x<2||x>29||y<2||y>29)&&hash%4===0)continue;
   this.box(x+.5,y+.5,-3.5-(hash%3)*.4,.99,.99,h+3.5+(hash%3)*.4,h<0?3:hash%7===0?29:4);
   if(hash%3===0)this.box(x+.25,y+.35,h+.012,.36,.15,.025,hash%2?5:3);
   if(hash%17===0)this.box(x+.6,y+.65,h+.025,.18,.32,.045,29);
  }
  const roads=[[7,25,11,20],[11,20,13,18],[13,18,14,18],[8,23,8,17],[18,16,18.5,14],[18.5,14,24,14],[16,13,18.5,14],[18,20,22,22]];
  for(const r of roads){const length=Math.hypot(r[2]-r[0],r[3]-r[1]);for(let t=0;t<length;t+=.65){const x=r[0]+(r[2]-r[0])*t/length,y=r[1]+(r[3]-r[1])*t/length;this.box(x,y,this.ground(x,y)+.035,.59,.85,.045,6);}}
  for(let i=0;i<24;i++){const x=7+(i*17%59)/10,y=3+(i*7%40)/10,z=this.ground(x,y);this.box(x,y,z,.28+(i%3)*.1,.35, .6+(i%5)*.35,30);this.box(x,y,z+.6+(i%5)*.35,.13,.13,.16,31);}
  for(let i=0;i<16;i++){const x=19+(i*13%80)/10,y=24+(i*7%45)/10;this.box(x,y,this.ground(x,y),.08,.15,.3,21);this.box(x+.13,y,this.ground(x,y),.07,.1,.19,20);}
  for(let i=0;i<4;i++){const x=20+i*1.4,y=28;this.box(x,y,this.ground(x,y),.55,.65,.7+(i%2)*.3,4);}
  this.staticCount=this.count;
 }
 private building(e:Float32Array,o:number,id:number) {
  const x=e[o],y=e[o+1],z=e[o+2],k=e[o+4],p=e[o+10],phase=e[o+6];
  const w=k===10?4:k===12||k===16?2:3,depth=k===15?2:w;
  this.box(x+.3,y+.3,z+.01,w+.6,depth+.6,.03,2);
  this.box(x,y,z,w+.25,depth+.25,.22,7,id);
  if(p<1){
   for(let a=-1;a<=1;a+=2)for(let b=-1;b<=1;b+=2){this.box(x+a*w*.44,y+b*depth*.44,z+.22,.13,.13,Math.max(.4,Math.floor(p*6)*.5),21,id);this.box(x+a*w*.44,y+b*depth*.44,z+.3,.2,.2,.1,18,id);}
   this.box(x+w*.65,y,z,.2,.2,3.7,21,id);this.box(x+w*.25,y,z+3.6,w*.8,.13,.13,22,id);this.box(x,y,z+1.2+phase*2,.045,.045,2.3-phase*2,20,id);this.box(x,y,z+1.1+phase*2,.3,.3,.2,21,id);
   for(let a=0;a<3;a++)this.box(x-w*.7,y+.6*a,z,.4,.4,.4,21,id);
   if(p<.2)return;
  }
  if(k===10){
   this.box(x,y,z+.22,3.8,3.8,1.7,8,id);this.box(x,y,z+1.92,3.9,3.9,.25,7,id);this.box(x,y,z+2.17,2.8,2.8,.6,12,id);this.box(x,y,z+2.77,3.,3.,.2,8,id);
   this.box(x,y,z+2.97,1.25,1.25,1.2,8,id);this.box(x,y,z+4.17,1.45,1.45,.25,12,id);
   for(let a=-1;a<=1;a+=2)for(let b=-1;b<=1;b+=2){this.box(x+a*1.65,y+b*1.65,z+.22,.45,.45,2.4,8,id);this.box(x+a*1.65,y+b*1.65,z+2.62,.48,.48,.16,12,id);this.box(x+a*1.65,y+b*1.65,z+2.78,.06,.06,.5,22,id);}
   this.box(x-.38,y,z+4.42,.08,.08,.6,22,id);this.box(x+.38,y,z+4.42,.08,.08,.6,22,id);this.box(x,y,z+4.4,.82,.09,.09,21,id);
   this.box(x,y+1.92,z+.24,.8,.08,1.25,10,id);this.box(x+.55,y+1.95,z+.8,.15,.1,.6,22,id);
   for(let j=-1;j<=1;j+=2){this.box(x+j*1.2,y+1.96,z+1.,.16,.08,.5,21,id);this.box(x+1.96,y+j*.9,z+.8,.08,.2,.5,21,id);}
   this.box(x-1.1,y+2,z+1.6,.55,.08,1.2,12,id);this.box(x-1.1,y+2.06,z+2.1,.12,.04,.3,22,id);
  } else if(k===12){
   this.box(x,y,z+.22,1.8,1.8,.35,12,id);for(let a=-1;a<=1;a+=2){this.box(x+a*.8,y,z+.4,.25,.6,2.8,8,id);this.box(x,y+a*.8,z+.4,.6,.25,.6,8,id);}
   const bob=Math.floor(phase*4)%2*.08;this.box(x,y,z+.7+bob,.65,.65,2.1,17,id);this.box(x,y,z+2.8+bob,.3,.3,.65,18,id);this.box(x,y,z+3.45+bob,.1,.1,.3,18,id);
  } else if(k===16){
   const levels=p<.5?1:p<.85?2:3;for(let j=0;j<levels;j++){this.box(x,y,z+.22+j*.85,1.65-j*.25,1.65-j*.25,.85,12,id);this.box(x,y,z+.92+j*.85,1.8-j*.25,1.8-j*.25,.15,8,id);}
   for(let a=-1;a<=1;a+=2)this.box(x+a*.67,y,z+.22,.22,.7,levels*.85+.35,8,id);
   if(p>=.85){this.box(x,y,z+3.,.55,.55,.55,17,id);this.box(x+Math.cos(e[o+3])*.55,y+Math.sin(e[o+3])*.55,z+3.15,.5,.25,.2,18,id);this.box(x-.7,y,z+3.,.08,.08,.9,22,id);this.box(x+.7,y,z+3.,.08,.08,.9,22,id);}
  } else if(k===15){
   for(let a=-1;a<=1;a++){this.box(x+a*.95,y,z+.22,.85,1.7,p<.5?.7:1.35,8,id);if(p>=.5){this.box(x+a*.95,y,z+1.57,.95,1.85,.22,8,id);this.box(x+a*.95,y,z+1.8,.65,1.2,.22,12,id);this.box(x+a*.95,y+.87,z+.7,.17,.05,.45,22,id);}}
  } else {
   const height=k===11?1.3:2.;
   for(let a=-1;a<=1;a+=2){this.box(x+a*1.25,y,z+.22,.35,2.7,p<.5?.8:height,8,id);for(let b=-1;b<=1;b++)this.box(x+a*1.35,y+b,z+.22,.3,.35,p<.5?1.1:height+.2,8,id);}
   this.box(x,y-1.25,z+.22,2.5,.35,p<.5?.6:height,12,id);
   if(p>=.5){this.box(x,y,z+height+.22,2.8,2.8,.25,8,id);this.box(x,y,z+height+.47,2.5,2.6,.25,12,id);this.box(x,y-.35,z+height+.72,2.5,1.5,.2,13,id);}
   if(k===11){this.box(x,y+.8,z+1.9,3.5,.25,.22,21,id);this.box(x+1.6,y+.8,z,.16,.16,2.,21,id);for(let i=0;i<3;i++)this.box(x-.7+i*.6,y+.8,z+.22,.45,.45,.5,21,id);}
   if(k===13&&p>=.5){this.box(x,y+1.4,z+.22,1.4,.1,1.4,10,id);this.box(x,y+1.48,z+1.7,.45,.1,.5,21,id);}
   if(k===14&&p>=.5){this.box(x-.7,y-.5,z+2.5,.5,.5,1.,5,id);this.box(x+.7,y+1.4,z+.25,.85,.12,1.1,25,id);this.box(x+.7,y+1.48,z+.3,.45,.08,.7,27,id);for(let i=0;i<4;i++){const q=(phase+i*.25)%1;this.box(x-.7+q*.3,y-.5,z+3.5+q*1.8,.25+q*.35,.25+q*.35,.3,3);}}
  }
 }
 private unit(e:Float32Array,o:number,id:number) {
  const x=e[o],y=e[o+1],z=e[o+2],k=e[o+4],phase=e[o+6],state=e[o+5],moving=state===1||state===6;
  const gait=moving?(phase<.5?-.1:.1):0,enemy=e[o+9]===1;
  this.box(x+.2,y+.15,this.ground(x,y)+.045,k===24?1.4:.65,k===24?.8:.5,.02,2);
  if(k===24){this.box(x,y,z,1.8,.8,.25,8,id);this.box(x,y,z+.25,1.25,.6,.3,12,id);this.box(x-.85,y,z,.25,1.2,.25,8,id);this.box(x+.85,y,z,.25,1.2,.25,8,id);this.box(x,y,z+.55,.45,.4,.25,21,id);this.box(x-.6,y,z-.1,.2,.3,.12,18,id);return;}
  if(k===21||k===31){const scale=k===31?1.5:1;for(let a=-1;a<=1;a+=2)for(let b=-1;b<=1;b++)this.box(x+a*.55*scale,y+b*.4+gait*a,z,.14,.16,.45*scale,enemy?24:5,id);this.box(x,y,z+.35*scale,.95*scale,1.2,.35*scale,enemy?25:12,id);this.box(x,y,z+.7*scale,.65,.65,.3,enemy?26:21,id);return;}
  const h=k===23?1.15:k===22?1.:.7;
  this.box(x-.15,y+gait,z,.15,.22,.25,enemy?24:10,id);this.box(x+.15,y-gait,z,.15,.22,.25,enemy?24:10,id);
  this.box(x,y,z+.25,.48,.38,h*.5,enemy?24:12,id);this.box(x,y,z+.25+h*.5,.42,.4,.27,enemy?25:8,id);
  this.box(x,y+.22,z+.31+h*.5,.24,.05,.08,enemy?26:17,id);
  if(k===22)this.box(x-.3,y+.12,z+.25,.18,.5,.6,21,id);
  if(k===23)this.box(x+.3,y,z+.6,.12,.85,.12,8,id);
  if(k===20){this.box(x,y-.25,z+.3,.35,.2,.4,12,id);if(e[o+10]>0)this.box(x+.32,y,z+.45,.3,.3,.3,21,id);if(state===3&&phase<.16){this.box(x+.4,y+.1,z+.5,.15,.15,.15,18);this.box(x+.6,y+.2,z+.65,.09,.09,.09,22);}}
  if(state===2&&phase<.1)this.box(x+Math.cos(e[o+3])*.5,y+Math.sin(e[o+3])*.5,z+.7,.24,.2,.2,enemy?27:22);
 }
 private rect(x:number,y:number,w:number,h:number,c:number) {this.box(x+w/2,y+h/2,0,w,h,0,c,-1,1);}
 private text(value:string,x:number,y:number,color=9) {for(let i=0;i<value.length;i++){const g=glyphs[value[i]]||glyphs[' '];for(let p=0;p<g.pixels.length;p++)if(g.pixels[p])this.rect(x+p%g.width,y+Math.floor(p/g.width),1,1,color);x+=g.width+1;}}
 private hud(e:Float32Array,alloy:number,charge:number) {
  const o=this.selected===null?-1:this.selected*12;
  const kind=o<0?-1:e[o+4],hp=o<0?-1:Math.round(e[o+7]*100),job=o<0?-1:e[o+5],progress=o<0?-1:Math.floor(e[o+10]*100);
  if(alloy!==this.hudAlloy||charge!==this.hudCharge||o!==this.hudSelection||kind!==this.hudKind||hp!==this.hudHealth||job!==this.hudJob||progress!==this.hudProgress){const start=this.count;this.rect(8,6,464,14,0);this.rect(8,19,464,1,5);this.text('STARHOLD',11,9);this.text('ALLOY '+alloy,300,9,22);this.text('CHARGE '+charge,389,9,18);
   for(let j=0;j<4;j++){this.rect(370+j*25,244,22,20,5);this.rect(371+j*25,245,20,18,1);this.text(j===0?'<':j===1?'>':j===2?'-':'+',379+j*25,251);}
   if(o>=0){this.rect(8,240,160,25,5);this.rect(9,241,158,23,0);this.text(names[e[o+4]]||'COLONY',12,243);this.rect(12,252,151,3,3);this.rect(12,252,Math.floor(151*e[o+7]),3,13);const max=e[o+4]===10?1500:e[o+4]===16?900:e[o+4]<20?600:e[o+4]===20?70:e[o+4]===23?110:e[o+4]===30?80:180;this.text('HP '+Math.round(e[o+7]*max)+' '+(jobs[e[o+5]]||'IDLE')+(e[o+5]===5?' '+Math.floor(e[o+10]*100)+'%':''),12,257,7);}
   this.hudCount=this.count-start;for(let i=0;i<this.hudCount*8;i++)this.hudData[i]=this.data[start*8+i];this.hudAlloy=alloy;this.hudCharge=charge;this.hudSelection=o;this.hudKind=kind;this.hudHealth=hp;this.hudJob=job;this.hudProgress=progress;
  }else{for(let i=0;i<this.hudCount*8;i++)this.data[this.count*8+i]=this.hudData[i];this.count+=this.hudCount;}
 }
 render(e:Float32Array,n:number,yaw:number,zoom:number,alloy:number,charge:number) {
  this.count=this.staticCount;this.selected=null;
  for(let id=0;id<n;id++){const o=id*12,k=e[o+4];if(e[o+8]===1)this.selected=id;if(k>=10&&k<20)this.building(e,o,id);else if(k>=20&&k<=31)this.unit(e,o,id);else if(k===40){this.box(e[o],e[o+1],e[o+2],.5,.6,1.+id%3*.25,30);this.box(e[o]+.2,e[o+1]-.1,e[o+2],.22,.25,1.6,31);}else if(k===41){this.box(e[o],e[o+1],e[o+2],.28,.28,.18,8);this.box(e[o],e[o+1],e[o+2]-.12,.12,.12,.12,17);}else if(k===50){this.box(e[o],e[o+1],e[o+2],.17,.17,.17,e[o+9]===1?27:18);this.box(e[o]-Math.cos(e[o+3])*.25,e[o+1]-Math.sin(e[o+3])*.25,e[o+2],.12,.12,.12,e[o+9]===1?26:17);}}
  if(this.selected!==null){const o=this.selected*12,r=e[o+4]<20?(e[o+4]===10?2.5:1.8):.6;for(let j=0;j<16;j++){const a=j*Math.PI/8;this.box(e[o]+Math.cos(a)*r,e[o+1]+Math.sin(a)*r,e[o+2]+.06,.18,.18,.035,22);}}
  // Parent phases drive sparse, discrete cloth and dust poses without render RNG.
  const phase=e[6];
  this.box(14.2,17.9,.7,.07,.07,2.8,21);
  this.box(14.2+.32,17.9+(phase<.5?0:.1),2.6,.65,.06,.6,12);
  for(let j=0;j<3;j++){const q=(phase+j/3)%1;this.box(20+j*2+q,26+j*.5,this.ground(20+j*2,26+j*.5)+.1,.55,.08,.035,20);}
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
