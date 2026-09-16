"""Temporary, assertion-checked integration of reviewed shared-runtime hooks."""
from pathlib import Path
import json

def edit(path, old, new):
    p=Path(path);text=p.read_text()
    assert text.count(old)==1, (path,old,text.count(old))
    p.write_text(text.replace(old,new))

p=Path('src/renderer.ts')
p.write_text("import {drawAshJackal,type JackalVariant} from './assets/ash-jackal';\n"+p.read_text())
edit(str(p),'export class Renderer {','''export class Renderer {
 authoritativeActors=false;
 jackalVariant:JackalVariant='field';
 showInterface=true;
 kindHealth:((kind:number)=>number)|null=null;
 private disposed=false;
 /** Disposable previews reuse the production terrain, actor, shading and picking paths. */
 setReviewWorld(terrain:Float32Array,side:number,cx:number,cy:number) {
  if(side<33||terrain.length!==side*side)throw new Error('Invalid review terrain');
  this.terrain=terrain;this.terrainSide=side;this.setView(cx,cy);
  this.worldStarts=[];this.worldRoutes=[];this.worldOutcrops=[];
  this.bakedX=NaN;this.bakedY=NaN;this.bakedZoom=-1;
  this.authoritativeActors=true;
 }
 async settled():Promise<void>{await this.device?.queue.onSubmittedWorkDone();}
 dispose():void{this.disposed=true;this.context?.unconfigure();this.device?.destroy();}
''')
edit(str(p),'setWorld(terrain:Float32Array,side:number,cx:number,cy:number) {','setWorld(terrain:Float32Array,side:number,cx:number,cy:number) {\n   this.authoritativeActors=true;')
edit(str(p),'setShowcase() {','setShowcase() {\n   this.authoritativeActors=false;')
edit(str(p),"this.device.lost.then((info:any)=>callback(`WebGPU device lost: ${info.message}`));","this.device.lost.then((info:any)=>{if(!this.disposed)callback(`WebGPU device lost: ${info.message}`);});")
edit(str(p),'const ox=combat?(id%3-1)*.24:0,oy=combat?(Math.floor(id/3)%3-1)*.24:0;','const offset=combat&&!(this.authoritativeActors&&k===30);\n  const ox=offset?(id%3-1)*.24:0,oy=offset?(Math.floor(id/3)%3-1)*.24:0;')
edit(str(p),'private wave2Unit(e:Float32Array,o:number,id:number) {','''private wave2Unit(e:Float32Array,o:number,id:number) {
  if(this.authoritativeActors&&e[o+4]===30){
   drawAshJackal(this,e[o],e[o+1],e[o+2],id,{state:e[o+5],phase:e[o+6],tick:Math.round(this.time*60),cooldown:e[o+11]},this.jackalVariant);
   return;
  }''')
edit(str(p),'this.ambient(this.time);','if(this.showInterface)this.ambient(this.time);')
edit(str(p),'this.hud(e,alloy,charge);','if(this.showInterface)this.hud(e,alloy,charge);')
edit(str(p),'const max=maxHealth[e[o+4]]??180;','const max=this.kindHealth?.(e[o+4])??maxHealth[e[o+4]]??180;')
# A matching arrow replaces the legacy three-dot tracer only for real match Jackals.
edit(str(p),'if(k===50){const color=', '''if(k===50&&sub===30&&this.authoritativeActors){
   this.strut(x,y,z,-dx*.36,-dy*.36,0,.035,26,-1,3);
   this.box(x,y,z,.08,.08,.075,32+27);
   return;
  }
  if(k===50){const color=''')

p=Path('src/main.ts');p.write_text("import {mountMatchResearch} from './research-panel';\nimport type {ContentAbi} from './content-api';\n"+p.read_text())
edit(str(p),'let previous=0,accumulator=0,windowStart=0,frames=0,tick=0;','let researchUI:ReturnType<typeof mountMatchResearch>|null=null;\nlet previous=0,accumulator=0,windowStart=0,frames=0,tick=0;')
edit(str(p),'refreshEntities();updateSelection();syncHud();minimapDraw();','refreshEntities();updateSelection();syncHud();minimapDraw();researchUI?.update();')
edit(str(p),'renderer.onError(fatal);requestAnimationFrame(frame);','''renderer.onError(fatal);
 researchUI=mountMatchResearch(sim as unknown as ContentAbi);researchUI.update();
 renderer.kindHealth=(kind:number)=>(sim as unknown as ContentAbi).sim_kind_stat(kind,9);
 requestAnimationFrame(frame);''')

p=Path('package.json');data=json.loads(p.read_text());data['scripts'].update({
 'wasm:workshop':'bash scripts/build-workshop-wasm.sh',
 'dev:tools':'npm run wasm && npm run wasm:workshop && vite --port 5199 --strictPort',
 'test:workshop':'node --experimental-strip-types --test tests/workshop.test.mjs',
 'test:workshop:browser':'node scripts/workshop-browser.mjs',
});p.write_text(json.dumps(data,indent=2)+'\n')
p=Path('.gitignore');p.write_text(p.read_text()+'\n# Disposable development outputs\ntools/sim.workshop.wasm\ntools/revision.json\nworkshop-evidence/\n')
p=Path('lab.html');text=p.read_text();assert '<body>' in text;text=text.replace('<body>','<body>\n<a href="/tools/" style="display:inline-block;padding:16px;color:inherit">Open connected Starhold Workshop →</a>',1);p.write_text(text)
# The candidate comparison uses native raster pixels, without silently changing its caption on mobile.
p=Path('src/tools/workshop.css');text=p.read_text().replace('#large{width:384px;height:336px}','').replace('#large{width:256px;height:224px}','');p.write_text(text)
p=Path('src/tools/workshop.ts');text=p.read_text();start=" element('play').onclick=()=>{playing=!playing;";i=text.index(start);j=text.index('\n',i);text=text[:i]+text[j:];p.write_text(text)
