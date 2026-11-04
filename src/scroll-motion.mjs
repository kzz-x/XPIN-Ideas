import * as T from 'three';
const sat=x=>Math.max(0,Math.min(1,x)),smooth=x=>{x=sat(x);return x*x*x*(10+x*(-15+6*x));};
export function resourcePhases(t){return{extract:smooth(t/.65),open:smooth((t-.65)/.65),emerge:smooth((t-1.3)/.6),read:smooth((t-1.9)/.95)};}
export const RESOURCE_DURATION=2.85;
export function createTitleMotion(title){
  const letters=title.children.filter(o=>o.isMesh).map((mesh,index)=>({mesh,index,base:mesh.position.clone(),offset:0,velocity:0,delay:-1}));
  let last=-10,hits=0;
  return {title,letters,trigger(mesh,time){if(time-last<.65)return;last=time;hits++;const at=Math.max(0,letters.findIndex(l=>l.mesh===mesh));for(const l of letters)l.delay=time+Math.abs(l.index-at)*.045;},
    update(dt,time){for(const l of letters){if(l.delay>=0&&time>=l.delay){l.velocity+=2.3;l.delay=-1;}l.velocity+=(-120*l.offset-12*l.velocity)*Math.min(dt,.03);l.offset+=l.velocity*Math.min(dt,.03);l.mesh.position.copy(l.base);l.mesh.position.z+=l.offset;l.mesh.rotation.x=-l.offset*.24;l.mesh.rotation.y=l.offset*.12;}},
    snapshot:()=>({title:title.userData.typography3D.text,hits,offsets:letters.map(l=>l.offset)})};
}
export function createEnding(titleMesh){
  const root=new T.Group();root.name='Final message / falling extruded characters';
  const lines=[titleMesh('下一次，',1.45,.24),titleMesh('让你的想法先行。',1.9,.28)];
  lines[0].position.set(-4.7,2.5,0);lines[1].position.set(0,0,0);root.add(...lines);
  root.rotation.x=-Math.PI/2+T.MathUtils.degToRad(35);root.position.set(0,2.05,-189);
  let start=null,landed=false;const glyphs=[];
  lines.forEach(g=>g.children.filter(m=>m.isMesh).forEach(mesh=>glyphs.push({mesh,base:mesh.position.clone(),index:glyphs.length})));
  function update(scroll,time,reduced){
    root.visible=scroll>180;if(scroll<176){start=null;landed=false;}if(root.visible&&start===null)start=time;
    const age=start===null?0:time-start;
    for(const g of glyphs){const t=(age-g.index*.085)/.72,p=sat(t);let drop=reduced?0:6*(1-p*p);if(t>=1&&!reduced)drop=Math.max(0,Math.sin((t-1)*9))*Math.exp(-(t-1)*6)*.36;g.mesh.position.copy(g.base);g.mesh.position.z+=drop;g.mesh.rotation.x=reduced?0:(1-p)*-.20;g.mesh.rotation.y=reduced?0:(1-p)*(g.index%2?-.08:.08);}
    landed=age>2.4;
  }
  return{root,update,snapshot:()=>({glyphCount:glyphs.length,landed,visible:root.visible,positions:glyphs.map(g=>g.mesh.position.z)})};
}
