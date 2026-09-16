"""Temporary assertion-checked integration; removed after verification."""
from pathlib import Path
import json

def edit(path,old,new):
 p=Path(path);text=p.read_text();assert text.count(old)==1,(path,old,text.count(old));p.write_text(text.replace(old,new))

p=Path('src/renderer.ts');p.write_text("import {drawAshJackal,type JackalVariant} from './assets/ash-jackal';\n"+p.read_text())
edit(str(p),'export class Renderer {','''export class Renderer {
 authoritativeActors=false;
 jackalVariant:JackalVariant='field';
 showInterface=true;
 kindHealth:((kind:number)=>number)|null=null;
 private disposed=false;
 setReviewWorld(terrain:Float32Array,side:number,cx:number,cy:number) {
  if(side<33||terrain.length!==side*side)throw new Error('Invalid review terrain');
  this.terrain=terrain;this.terrainSide=side;this.setView(cx,cy);
  this.worldStarts=[];this.worldRoutes=[];this.worldOutcrops=[];
  this.bakedX=NaN;this.bakedY=NaN;this.bakedZoom=-1;this.authoritativeActors=true;
 }
 async settled():Promise<void>{await this.device?.queue.onSubmittedWorkDone();}
 dispose():void{this.disposed=true;this.context?.unconfigure();this.device?.destroy();}
''')
edit(str(p),'setWorld(terrain:Float32Array,side:number,cx:number,cy:number) {','setWorld(terrain:Float32Array,side:number,cx:number,cy:number) {\n   this.authoritativeActors=true;')
edit(str(p),'setShowcase() {','setShowcase() {\n   this.authoritativeActors=false;')
edit(str(p),'this.device.lost.then((info:any)=>callback(`WebGPU device lost: ${info.message}`));','this.device.lost.then((info:any)=>{if(!this.disposed)callback(`WebGPU device lost: ${info.message}`);});')
edit(str(p),'const ox=combat?(id%3-1)*.24:0,oy=combat?(Math.floor(id/3)%3-1)*.24:0;','const offset=combat&&!(this.authoritativeActors&&k===30);\n  const ox=offset?(id%3-1)*.24:0,oy=offset?(Math.floor(id/3)%3-1)*.24:0;')
edit(str(p),'private wave2Unit(e:Float32Array,o:number,id:number) {','''private wave2Unit(e:Float32Array,o:number,id:number) {
  if(this.authoritativeActors&&e[o+4]===30){
   drawAshJackal(this,e[o],e[o+1],e[o+2],id,{state:e[o+5],phase:e[o+6],tick:Math.round(this.time*60),cooldown:e[o+11]},this.jackalVariant);
   return;
  }''')
edit(str(p),'this.ambient(this.time);','if(this.showInterface)this.ambient(this.time);')
edit(str(p),'this.hud(e,alloy,charge);','if(this.showInterface)this.hud(e,alloy,charge);')
edit(str(p),'const max=maxHealth[e[o+4]]??180;','const max=this.kindHealth?.(e[o+4])??maxHealth[e[o+4]]??180;')
edit(str(p),'if(k===50){const color=','''if(k===50&&sub===30&&this.authoritativeActors){
   this.strut(x,y,z,-dx*.36,-dy*.36,0,.035,26,-1,3);
   this.box(x,y,z,.08,.08,.075,32+27);return;
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
 'verify:workshop':'cargo test --manifest-path sim/Cargo.toml --features workshop && npm run build && npm run wasm:workshop && bash scripts/build-baseline.sh && npm run test:workshop',
});p.write_text(json.dumps(data,indent=2)+'\n')
p=Path('.gitignore');p.write_text(p.read_text()+'\n# Disposable development outputs\ntools/sim.workshop.wasm\ntools/revision.json\nworkshop-evidence/\n')
p=Path('lab.html');text=p.read_text();assert '<body>' in text;p.write_text(text.replace('<body>','<body>\n<a href="/tools/" style="display:inline-block;padding:16px;color:inherit">Open connected Starhold Workshop →</a>',1))
p=Path('src/tools/workshop.css');p.write_text(p.read_text().replace('#large{width:384px;height:336px}','').replace('#large{width:256px;height:224px}','')+'\n.research-graph-scroll{overflow:auto;max-width:100%;margin:20px 0;border:1px solid #394654}.research-graph{display:block;width:100%;min-width:530px;height:auto}.research-graph a:focus{outline:2px solid #a2ddd0}#rig-pair{max-width:100%}\n')
p=Path('src/research-panel.css');p.write_text(p.read_text()+'\n.research-graph-scroll{overflow:auto;max-width:100%;margin:20px 0;border:1px solid #394654}.research-graph{display:block;width:100%;min-width:530px;height:auto}.research-graph a:focus{outline:2px solid #a2ddd0}\n')
p=Path('src/research-panel.ts');p.write_text("import {researchGraph} from './research-graph';\n"+p.read_text())
edit(str(p),'<div class="research-groups">','${researchGraph(nodes,all,s)}<div class="research-groups">')
edit(str(p),'<article class="research-node state-${status}"','<article id="research-${n.id}" class="research-node state-${status}"')
# Research review has its own bounded 120s clock, while encounters stop at 30s.
edit('src/tools/runtime.ts','step(ticks=1):void {','step(ticks=1,limit=1800):void {')
edit('src/tools/runtime.ts','const remaining=Math.max(0,1800-this.sim.sim_lab_tick())','const remaining=Math.max(0,Math.min(7200,Math.max(1800,limit))-this.sim.sim_lab_tick())')
p=Path('src/tools/workshop.ts');text=p.read_text();start=" element('play').onclick=()=>{playing=!playing;";i=text.index(start);j=text.index('\n',i);text=text[:i]+text[j:]
text=text.replace('session.step(ticks);','session.step(ticks,view===\'research\'?7200:1800);').replace('session.step();','session.step(1,view===\'research\'?7200:1800);')
text=text.replace('session.sim.sim_lab_tick()>=1800','session.sim.sim_lab_tick()>=(view===\'research\'?7200:1800)')
text=text.replace('/ 30s · ${m.shots}','/ ${view===\'research\'?120:30}s · ${m.shots}')
text=text.replace('selected=actor.index;','selected=actor.handle;')
text=text.replace('if(rig){const construction=',"if(!rig&&selected!==null){for(let i=0;i<data.length/12;i++)data[i*12+8]=session.sim.sim_actor_handle(i)===selected?1:0;}\n  if(rig){const construction=")
p.write_text(text)
p=Path('scripts/workshop-browser.mjs');text=p.read_text();text=text.replace("assert.ok((await page.locator('[data-node=\"203\"] button').textContent()).includes('remaining'));","assert.equal(await page.locator('[data-node=\"203\"] button').textContent(),'Completed');")
text=text.replace('// The interactive timeline is capped at 30s, so the second job is still in flight.','// Research review advances its separate bounded 120s timeline.')
p.write_text(text)
# Release event coordinates identify the actual emitter, rather than the actor's feet.
edit('sim/src/actors.rs','self.actor_event(2,id,target,damage);','''let previous_count=self.actors.event_count;
        self.actor_event(2,id,target,damage);
        if self.actors.event_count>previous_count {
            let offset=previous_count*EVENT_STRIDE+5;
            self.actors.events[offset..offset+3].copy_from_slice(&socket);
        }''')
