import * as T from 'three';
import {outlineShapes} from './opening-characters.mjs';
import {createParticleAssembly} from './opening-assembly.mjs';
import {createOpeningGrid} from './opening-grid.mjs';
import {frostedGlass,glassEnvironment} from './frosted-glass.mjs';
export const OPENING_TIMING=Object.freeze({morph:6.1,portalRevealStart:0,portalRevealDuration:0});
const BACKGROUND='#08142f',TITLE='想法先行';
export async function createOpening({canvas}){
 const scene=new T.Scene();scene.background=new T.Color(BACKGROUND);glassEnvironment(scene);
 const camera=new T.PerspectiveCamera(38,16/9,.1,120);camera.position.set(0,.4,22);camera.lookAt(0,0,0);camera.updateMatrixWorld();
 const [data,asciiData]=await Promise.all(['title-glyphs.json','ascii-outlines.json'].map(name=>fetch(new URL('../assets/type/'+name,import.meta.url)).then(r=>r.json())));
 scene.add(new T.HemisphereLight(0xe5eef6,0x172b45,1.6));const key=new T.DirectionalLight(0xe5eff5,1.8);key.position.set(-5,7,9);scene.add(key);const fill=new T.DirectionalLight(0x89acc8,.8);fill.position.set(6,-1,4);scene.add(fill);
 const group=new T.Group();group.name='Thick frosted Chinese letters / inertial full-turn controls';scene.add(group);const glyphs=[],meshes=[];
 const common=`varying vec3 vTitleLocal;uniform float uPeel;float peelRank(vec3 p){vec2 cell=floor(p.xy/.075);return clamp(.5-p.y/3.3,0.,1.)+.12*fract(sin(dot(cell,vec2(127.1,311.7)))*43758.5453);}`;
 for(let index=0;index<TITLE.length;index++){
  const shapes=outlineShapes(data[TITLE[index]]),geometry=new T.ExtrudeGeometry(shapes,{depth:10,steps:1,bevelEnabled:true,bevelThickness:.55,bevelSize:.55,bevelSegments:2,curveSegments:5});geometry.computeBoundingBox();const center=geometry.boundingBox.getCenter(new T.Vector3());geometry.translate(-center.x,-center.y,-center.z);geometry.scale(.0328,.0328,.0328);geometry.computeBoundingBox();
  const release={value:-1},material=frostedGlass({color:0xc7dae5,roughness:.39,transmission:.84,thickness:.47,envMapIntensity:.9});
  material.onBeforeCompile=sh=>{sh.uniforms.uPeel=release;sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vTitleLocal;').replace('#include <begin_vertex>','#include <begin_vertex>\nvTitleLocal=position;');sh.fragmentShader=sh.fragmentShader.replace('#include <common>','#include <common>\n'+common).replace('#include <clipping_planes_fragment>','#include <clipping_planes_fragment>\nif(uPeel>=0.&&uPeel>peelRank(vTitleLocal))discard;');};material.customProgramCacheKey=()=> 'r08-frosted-physical-peel';
  const placement=new T.Group();placement.position.set((index-1.5)*3.52,.68,0);group.add(placement);const mesh=new T.Mesh(geometry,material);mesh.name=TITLE[index]+' / actual refractive volume';mesh.userData.glyphIndex=index;placement.add(mesh);meshes.push(mesh);
  const edgeMat=new T.ShaderMaterial({transparent:true,depthWrite:false,uniforms:{uPeel:release},vertexShader:'varying vec3 vTitleLocal;void main(){vTitleLocal=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:common+'void main(){if(uPeel>=0.&&uPeel>peelRank(vTitleLocal))discard;gl_FragColor=vec4(.68,.81,.89,.62);}'});const edge=new T.LineSegments(new T.EdgesGeometry(geometry,35),edgeMat);placement.add(edge);
  glyphs.push({index,placement,mesh,release,angle:0,velocity:0,goal:0,turns:0,lastKick:-100});
 }
 const grid=createOpeningGrid({scene,camera,asciiData}),flow=createParticleAssembly({scene,camera,glyphs,asciiData});const pointer=new T.Vector2(99,99),ray=new T.Raycaster();let previousPhase='',phase='intro',hovered=-1,previousHover=-1,lastX=0,pointerDX=0,lastTime=0;
 function move(e){const rect=canvas.getBoundingClientRect();pointer.set((e.clientX-rect.left)/rect.width*2-1,1-(e.clientY-rect.top)/rect.height*2);pointerDX=e.clientX-lastX;lastX=e.clientX;grid.pointer(e.clientX,e.clientY);}
 window.addEventListener('pointermove',move,{passive:true});
 function update({time=0,dt=1/60,phase:next='intro',phaseTime=0,holdProgress=0}){
  phase=next;lastTime=time;if(next==='intro'&&previousPhase!==next){for(const g of glyphs){g.angle=g.velocity=g.goal=0;g.placement.rotation.set(0,0,0);}previousHover=-1;}
  hovered=-1;if(next==='intro'&&holdProgress<.1){scene.updateMatrixWorld(true);ray.setFromCamera(pointer,camera);hovered=ray.intersectObjects(meshes,false)[0]?.object.userData.glyphIndex??-1;if(hovered>=0&&hovered!==previousHover&&time-glyphs[hovered].lastKick>2.1){const g=glyphs[hovered],direction=pointerDX<0?-1:1;g.goal+=direction*Math.PI*2;g.velocity+=direction*(1.6+Math.min(3,Math.abs(pointerDX)*.05));g.turns++;g.lastKick=time;}previousHover=hovered;}
  if(next==='intro')for(const g of glyphs){const sub=Math.min(.05,dt)/3;for(let i=0;i<3;i++){g.velocity+=(g.goal-g.angle)*25*sub;g.velocity*=Math.exp(-5.8*sub);g.angle+=g.velocity*sub;}g.placement.rotation.y=g.angle;g.placement.rotation.z=Math.sin(g.angle)*.025;}
  const state=flow.update({phase:next,dt});const physicalTime=state?.time||0;
  group.visible=next==='intro'||(next==='morph'&&physicalTime<1.6);for(const g of glyphs)g.release.value=next==='morph'?(physicalTime-.12-g.index*.035)/1.05:-1;
  grid.update({time,dt,phase:next,holdProgress});const dark=next==='black'?1:next==='launch'?T.MathUtils.smoothstep(phaseTime,2.65,4.35):0;scene.background.set(BACKGROUND).multiplyScalar(1-dark);previousPhase=next;
  return state;
 }
 function resize(w,h){camera.aspect=w/h;camera.fov=camera.aspect<1.35?T.MathUtils.radToDeg(2*Math.atan(8.2/(22*camera.aspect))):38;camera.updateProjectionMatrix();camera.updateMatrixWorld();}
 resize(innerWidth,innerHeight);
 let prepared=false;
 async function prepare(renderer){
  const portal=document.querySelector('#portal'),chat=document.querySelector('#chat');
  const prior=[portal.style.display,chat.style.display,portal.style.visibility,document.body.dataset.phase];
  portal.style.visibility='hidden';portal.style.display=chat.style.display='block';document.body.dataset.phase='morph';
  const finish=flow.warmup();
  portal.style.display=prior[0];chat.style.display=prior[1];portal.style.visibility=prior[2];document.body.dataset.phase=prior[3];
  const warmCamera=camera.clone();warmCamera.layers.enable(29);
  try{await renderer.compileAsync(scene,warmCamera);}finally{finish();prepared=true;}
 }

 return{scene,camera,glyphs,ascii:flow.root,update,resize,prepare,get prepared(){return prepared;},get ready(){return flow.ready;},snapshot:()=>({phase,time:lastTime,background:BACKGROUND,titleDepth:glyphs.map(g=>g.mesh.geometry.boundingBox.max.z-g.mesh.geometry.boundingBox.min.z),glyphs:glyphs.map(g=>({angle:g.angle,velocity:g.velocity,goal:g.goal,turns:g.turns})),glass:{transmission:.84,roughness:.39,thickness:.47},grid:grid.snapshot(),particles:flow.snapshot()}),dispose(){window.removeEventListener('pointermove',move);flow.dispose();grid.dispose();group.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});scene.clear();}};
}
