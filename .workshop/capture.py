from pathlib import Path

def edit(path,old,new):
 p=Path(path);s=p.read_text();assert s.count(old)==1,(path,old,s.count(old));p.write_text(s.replace(old,new))

edit('src/tools/workshop.ts','const renderer=new Renderer();',"""const renderer=new Renderer();
// Copy in the rendering task, before the current WebGPU canvas texture expires.
// This retained bitmap also makes later PNG exports independent of presentation.
const capturedFrame=document.createElement('canvas');capturedFrame.width=960;capturedFrame.height=540;
const capturedContext=capturedFrame.getContext('2d')!;
let redrawPending=false;""")
edit('src/tools/workshop.ts','if(drawing||disposed||!session)return;drawing=true;',"if(disposed||!session)return;if(drawing){redrawPending=true;return;}drawing=true;")
edit('src/tools/workshop.ts','  await renderer.settled();\n  if(disposed)return;',"""  capturedContext.clearRect(0,0,960,540);
  capturedContext.drawImage(element<HTMLCanvasElement>('scene'),0,0);
  if(disposed)return;""")
edit('src/tools/workshop.ts',"if(rig){const source=element<HTMLCanvasElement>('scene'),native=",'if(rig){const source=capturedFrame,native=')
edit('src/tools/workshop.ts',' }catch(error){fail(error);}finally{drawing=false;}',"""  await renderer.settled();
 }catch(error){fail(error);}finally{drawing=false;if(redrawPending&&!disposed){redrawPending=false;void draw();}}""")
edit('src/tools/workshop.ts',"?element<HTMLCanvasElement>('large'):element<HTMLCanvasElement>('scene');const a=document.createElement('a');", "?element<HTMLCanvasElement>('large'):capturedFrame;const a=document.createElement('a');")
