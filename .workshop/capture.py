from pathlib import Path

def edit(path,old,new):
 p=Path(path);s=p.read_text();assert s.count(old)==1,(path,old,s.count(old));p.write_text(s.replace(old,new))

edit('src/renderer.ts',' private disposed=false;',""" private disposed=false;
 private frameTexture:any=null;
 private frameFormat='rgba8unorm';
 private gpuAdapter:any=null;
 /** Explicit readback is used only by tools/captures, never the normal game loop. */
 async captureFrame():Promise<ImageData>{
  if(!this.frameTexture)throw new Error('Render before requesting a capture.');
  const d=this.device,usage=GPUBufferUsage as typeof GPUBufferUsage & {MAP_READ:number};
  const row=Math.ceil(RENDER_WIDTH*4/256)*256;
  const buffer=d.createBuffer({size:row*RENDER_HEIGHT,usage:usage.COPY_DST|usage.MAP_READ});
  try{
   const encoder=d.createCommandEncoder();
   encoder.copyTextureToBuffer({texture:this.frameTexture},{buffer,bytesPerRow:row,rowsPerImage:RENDER_HEIGHT},[RENDER_WIDTH,RENDER_HEIGHT]);
   d.queue.submit([encoder.finish()]);
   await buffer.mapAsync(1);
   const bytes=new Uint8Array(buffer.getMappedRange()),rgba=new Uint8ClampedArray(RENDER_WIDTH*RENDER_HEIGHT*4);
   const bgra=this.frameFormat.startsWith('bgra');
   for(let y=0;y<RENDER_HEIGHT;y++)for(let x=0;x<RENDER_WIDTH;x++){
    const a=y*row+x*4,b=(y*RENDER_WIDTH+x)*4;
    rgba[b]=bytes[a+(bgra?2:0)];rgba[b+1]=bytes[a+1];rgba[b+2]=bytes[a+(bgra?0:2)];rgba[b+3]=bytes[a+3];
   }
   buffer.unmap();return new ImageData(rgba,RENDER_WIDTH,RENDER_HEIGHT);
  }finally{buffer.destroy();}
 }
""")
edit('src/renderer.ts','this.device=await adapter.requestDevice();','this.gpuAdapter=adapter;this.device=await this.gpuAdapter.requestDevice();')
edit('src/renderer.ts',"const format=navigator.gpu.getPreferredCanvasFormat();this.context.configure({device:d,format,alphaMode:'opaque'});", "const format=navigator.gpu.getPreferredCanvasFormat();this.frameFormat=format;const captureUsage=GPUTextureUsage as typeof GPUTextureUsage & {COPY_SRC:number};this.context.configure({device:d,format,alphaMode:'opaque',usage:captureUsage.RENDER_ATTACHMENT|captureUsage.COPY_SRC});")
edit('src/renderer.ts','this.presentPass.colorAttachments[0].view=this.context.getCurrentTexture().createView();','this.frameTexture=this.context.getCurrentTexture();this.presentPass.colorAttachments[0].view=this.frameTexture.createView();')
edit('src/tools/workshop.ts','const renderer=new Renderer();',"""const renderer=new Renderer();
const capturedFrame=document.createElement('canvas');capturedFrame.width=960;capturedFrame.height=540;
const capturedContext=capturedFrame.getContext('2d')!;
let redrawPending=false;""")
edit('src/tools/workshop.ts','if(drawing||disposed||!session)return;drawing=true;',"if(disposed||!session)return;if(drawing){redrawPending=true;return;}drawing=true;")
edit('src/tools/workshop.ts','  await renderer.settled();\n  if(disposed)return;',"""  const image=await renderer.captureFrame();
  if(disposed)return;
  capturedContext.putImageData(image,0,0);""")
edit('src/tools/workshop.ts',"if(rig){const source=element<HTMLCanvasElement>('scene'),native=",'if(rig){const source=capturedFrame,native=')
edit('src/tools/workshop.ts',' }catch(error){fail(error);}finally{drawing=false;}'," }catch(error){fail(error);}finally{drawing=false;if(redrawPending&&!disposed){redrawPending=false;void draw();}}")
edit('src/tools/workshop.ts',"?element<HTMLCanvasElement>('large'):element<HTMLCanvasElement>('scene');const a=document.createElement('a');", "?element<HTMLCanvasElement>('large'):capturedFrame;const a=document.createElement('a');")
# Browser launch is owned by scripts/workshop-gpu.mjs. Do not rewrite its preset
# here: both the isolated GPU probe and all real-pixel assertions must run.
assert "browser=await chromium.launch(browserOptions());" in Path('scripts/workshop-browser.mjs').read_text()
