import {RESEARCH_LABELS,requirements,escapeMarkup as e,type ResearchNode,type ContentAbi} from './content-api';
/** Authored layout coordinates are presentation only; all edges come from Rust prerequisites. */
const POSITIONS:Readonly<Record<number,readonly [number,number]>>={
 100:[90,55],101:[90,175],105:[90,295],102:[350,55],103:[350,175],104:[350,295],
 200:[90,55],201:[90,175],205:[90,295],202:[350,55],203:[270,220],204:[440,220],
};
export function researchGraph(nodes:ResearchNode[],all:ResearchNode[],sim:ContentAbi):string {
 const position=(n:ResearchNode)=>POSITIONS[n.id]??[90+(n.index%3)*170,55+Math.floor(n.index/3)*110];
 const edges=nodes.flatMap(n=>requirements(n,all).map(parent=>{
  const [x1,y1]=position(parent),[x2,y2]=position(n);
  return `<path d="M ${x1} ${y1+25} L ${x2} ${y2-25}" fill="none" stroke="#637482" stroke-width="2"/>`;
 })).join('');
 return `<div class="research-graph-scroll" aria-label="Prerequisite map"><svg class="research-graph" viewBox="0 0 530 365" role="img" aria-label="Research branches. Links focus the corresponding research details."><rect x="0" y="0" width="530" height="365" fill="#111922"/>${edges}${nodes.map(n=>{
  const [x,y]=position(n),status=sim.sim_research_status(n.id),color=status===7?'#89c9b6':status===9?'#dfb677':status===8?'#e9d298':'#718394';
  return `<a href="#research-${n.id}" aria-label="Inspect ${e(RESEARCH_LABELS[n.id]?.[0]??n.id)}"><rect x="${x-75}" y="${y-34}" width="150" height="80" fill="transparent"/><circle cx="${x}" cy="${y}" r="25" fill="#243241" stroke="${color}" stroke-width="2"/><text x="${x}" y="${y+5}" text-anchor="middle" fill="${color}" font-size="14">${n.exclusive?'◇':status===7?'✓':n.age+1}</text><text x="${x}" y="${y+47}" text-anchor="middle" fill="${color}" font-size="11">${e(RESEARCH_LABELS[n.id]?.[0]??n.id)}</text></a>`;
 }).join('')}</svg></div>`;
}
