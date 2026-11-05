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
export function createEnding(titleMesh,camera,{onLand=()=>{}}={}){
  const root=new T.Group();root.name='Final message / persistent falling extruded characters';
  const lines=[titleMesh('下一次，',1.45,.24),titleMesh('让你的想法先行。',1.9,.28)];
  lines[0].position.set(-4.7,2.5,0);root.add(...lines);
  root.rotation.x=-Math.PI/2+T.MathUtils.degToRad(35);root.position.set(0,2.05,-189);root.visible=false;
  let start=null,landed=false;const glyphs=[];
  lines.forEach(g=>g.children.filter(m=>m.isMesh).forEach(mesh=>{
    const shadow={value:0},depth=new T.MeshDepthMaterial({depthPacking:T.RGBADepthPacking});
    depth.onBeforeCompile=sh=>{sh.uniforms.uLandingShadow=shadow;sh.fragmentShader='uniform float uLandingShadow;\n'+sh.fragmentShader;sh.fragmentShader=sh.fragmentShader.replace('#include <clipping_planes_fragment>','#include <clipping_planes_fragment>\nif(fract(sin(dot(floor(gl_FragCoord.xy),vec2(12.9898,78.233)))*43758.5453)>uLandingShadow)discard;');};
    depth.customProgramCacheKey=()=> 'r10-landing-shadow';mesh.customDepthMaterial=depth;
    glyphs.push({mesh,base:mesh.position.clone(),index:glyphs.length,fall:new T.Vector3(),shadow,entryNdc:null,landed:false});
  }));
  function begin(time){
    start=time;root.visible=true;root.updateMatrixWorld(true);camera.updateMatrixWorld(true);
    const up=new T.Vector3().setFromMatrixColumn(camera.matrixWorld,1);
    for(const g of glyphs){
      const world=g.mesh.parent.localToWorld(g.base.clone()),view=world.clone().applyMatrix4(camera.matrixWorldInverse),ndc=world.clone().project(camera);
      const distance=(1.38-ndc.y)*Math.max(1,-view.z)*Math.tan(T.MathUtils.degToRad(camera.fov/2))+3;
      const high=world.clone().addScaledVector(up,Math.max(12,distance));g.entryNdc=high.clone().project(camera).toArray();
      g.fall.copy(g.mesh.parent.worldToLocal(high)).sub(g.base);
    }
  }
  function update(scroll,time,reduced){
    if(start===null&&scroll>180)begin(time);
    root.visible=start!==null;if(start===null)return;
    const age=time-start,impacts=[];
    for(const g of glyphs){
      const t=(age-g.index*.10)/1.15,p=sat(t),drop=reduced?0:1-p*p*p;
      g.mesh.position.copy(g.base).addScaledVector(g.fall,drop);
      if(t>1&&!reduced)g.mesh.position.z+=Math.max(0,Math.sin((t-1)*10))*Math.exp(-(t-1)*7)*.24;
      g.mesh.rotation.x=reduced?0:(1-p)*-.20;g.mesh.rotation.y=reduced?0:(1-p)*(g.index%2?-.08:.08);
      g.shadow.value=reduced?1:smooth((p-.24)/.76);g.mesh.castShadow=g.shadow.value>.001;
      if((p===1||reduced)&&!g.landed){g.landed=true;impacts.push({index:g.index,time,count:1});}
    }
    // Large frame gaps / reduced motion get one landing, never a burst of stale hits.
    if(impacts.length>3)onLand({...impacts.at(-1),count:impacts.length});else for(const hit of impacts)onLand(hit);
    landed=age>3.1;
  }
  return{root,update,snapshot:()=>({glyphCount:glyphs.length,started:start!==null,landed,landedGlyphs:glyphs.filter(g=>g.landed).length,visible:root.visible,persistent:true,entryNdc:glyphs.map(g=>g.entryNdc),shadowReveal:glyphs.map(g=>g.shadow.value),positions:glyphs.map(g=>g.mesh.position.toArray())})};
}
