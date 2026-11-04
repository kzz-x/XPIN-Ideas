import * as T from 'three';
import {outlineShapes} from './opening-characters.mjs';
import {ParticlePhysics,saturate} from './particle-physics.mjs';
import {frostedGlass,glassEdges} from './frosted-glass.mjs';
const V=(x=0,y=0,z=0)=>new T.Vector3(x,y,z),smooth=x=>{x=saturate(x);return x*x*(3-2*x);};
const MAX=11000,CHARS='01<>/=+;';
export function createParticleAssembly({scene,camera,glyphs,asciiData}){
 const root=new T.Group();root.name='Physical particles / Chinese surface to functional AI components';scene.add(root);
 const assembled=new T.Group();assembled.name='Welded AI interface / identical particle destination surfaces';root.add(assembled);
 const unit=new T.BoxGeometry(1,1,1),grain=frostedGlass({roughness:.32,transmission:.73,thickness:.11}),ink=new T.MeshStandardMaterial({color:0xe5edf3,roughness:.64,metalness:0});
 const fragments=new T.InstancedMesh(unit,grain,MAX),marks=new T.InstancedMesh(unit,ink,MAX);for(const m of [fragments,marks]){m.instanceMatrix.setUsage(T.DynamicDrawUsage);m.instanceColor=new T.InstancedBufferAttribute(new Float32Array(MAX*3).fill(1),3);m.instanceColor.setUsage(T.DynamicDrawUsage);m.frustumCulled=false;root.add(m);m.count=0;}
 const letterBatches=[];
 for(const c of CHARS){const geo=new T.ExtrudeGeometry(outlineShapes(asciiData[c]),{depth:2,bevelEnabled:false,curveSegments:2,steps:1});geo.computeBoundingBox();const center=geo.boundingBox.getCenter(V());geo.translate(-center.x,-center.y,-1);geo.scale(1/75,1/75,1/75);const mesh=new T.InstancedMesh(geo,ink,Math.ceil(MAX/CHARS.length));mesh.count=0;mesh.frustumCulled=false;mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);root.add(mesh);letterBatches.push(mesh);}
 const dummy=new T.Object3D(),q=new T.Quaternion(),spin=new T.Quaternion(),euler=new T.Euler(),color=new T.Color(),white=new T.Color('#d6e5ef');
 let solver=null,targets=[],parts=[],triangles=[],weights=[],totalArea=0,phase='',baked=false,welded=false,priorWidth=0,priorHeight=0;
 const random=i=>{const v=Math.sin(i*127.1+37.7)*43758.5453;return v-Math.floor(v);};
 function world(x,y,z=0){return V((x/innerWidth*2-1)*Math.tan(T.MathUtils.degToRad(camera.fov/2))*22*camera.aspect,(1-y/innerHeight*2)*Math.tan(T.MathUtils.degToRad(camera.fov/2))*22,-22+z).applyMatrix4(camera.matrixWorld);}
 function units(px){return px/innerHeight*2*Math.tan(T.MathUtils.degToRad(camera.fov/2))*22;}
 function addTarget(x,y,w,h,type,c,z=0){targets.push({x,y,w,h,type,color:new T.Color(c),world:world(x,y,z),z});}
 function surface(rect,c,depth,name,pitch){
  if(rect.width<1||rect.height<1)return;parts.push({rect:{x:rect.x,y:rect.y,width:rect.width,height:rect.height},color:c,depth,name});
  const cols=Math.ceil(rect.width/pitch),rows=Math.ceil(rect.height/pitch),cw=rect.width/cols,ch=rect.height/rows;
  for(let y=0;y<rows;y++)for(let x=0;x<cols;x++)addTarget(rect.x+(x+.5)*cw,rect.y+(y+.5)*ch,cw+.15,ch+.15,0,c,depth);
 }
 function rule(x1,y1,x2,y2,c='#a2bed0',width=.9,z=.14){const length=Math.hypot(x2-x1,y2-y1),n=Math.ceil(length/7);for(let i=0;i<n;i++){const u=(i+.5)/n;addTarget(x1+(x2-x1)*u,y1+(y2-y1)*u,Math.abs(x2-x1)>1?length/n+.2:width,Math.abs(y2-y1)>1?length/n+.2:width,1,c,z);}}
 function rectangle(r,c,width=1,z=.14){rule(r.x,r.y,r.right,r.y,c,width,z);rule(r.right,r.y,r.right,r.bottom,c,width,z);rule(r.right,r.bottom,r.x,r.bottom,c,width,z);rule(r.x,r.bottom,r.x,r.y,c,width,z);}
 function measureTargets(){
  targets=[];parts=[];const portal=document.querySelector('#portal'),chat=document.querySelector('#chat'),composer=chat.querySelector('.chat-composer'),send=document.querySelector('#send');
  const outer=portal.getBoundingClientRect(),input=composer.getBoundingClientRect(),button=send.getBoundingClientRect(),header=chat.querySelector('.chat-top').getBoundingClientRect();
  surface(outer,'#50647b',-.12,'AI panel / structural frosted slab',18);surface(input,'#6d8093',.02,'Prompt composer / inset frosted slab',11);surface(button,'#c7d6df',.10,'Send button / assembled control',6);
  rectangle(outer,'#7a96ac',1);rectangle(input,'#a6bdcd',1);rectangle(button,'#d5e3eb',1,.19);rule(header.x,header.bottom,header.right,header.bottom,'#677d93',.8);
  const walker=document.createTreeWalker(chat,NodeFilter.SHOW_TEXT);let n;
  while(n=walker.nextNode()){
   const value=n.textContent.trim(),el=n.parentElement;if(!value||el.closest('.ascii-orbit,#prompt-text,.typing-caret,svg'))continue;
   const range=document.createRange();range.selectNodeContents(n);const r=range.getBoundingClientRect();if(!r.width||!r.height)continue;
   const st=getComputedStyle(el),c=document.createElement('canvas');c.width=Math.ceil(r.width+4);c.height=Math.ceil(r.height+4);const ctx=c.getContext('2d');ctx.font=`${st.fontWeight} ${st.fontSize} ${st.fontFamily}`;ctx.fillStyle='#fff';ctx.textBaseline='middle';ctx.fillText(value,2,c.height/2);const data=ctx.getImageData(0,0,c.width,c.height).data,pitch=parseFloat(st.fontSize)>=22?2.3:1.8;
   for(let y=pitch/2;y<c.height;y+=pitch)for(let x=pitch/2;x<c.width;x+=pitch)if(data[(Math.floor(y)*c.width+Math.floor(x))*4+3]>90)addTarget(r.x+x-2,r.y+y-2,pitch*.92,pitch*.92,2,st.color,.18);
  }
  // The arrow itself is structural geometry; the live SVG takes over only
  // after this same arrangement has physically settled.
  const bx=button.x+button.width*.28,by=button.y+button.height*.72,ex=button.x+button.width*.72,ey=button.y+button.height*.28,nArrow=14;
  for(let i=0;i<nArrow;i++){const u=i/(nArrow-1);addTarget(bx+(ex-bx)*u,by+(ey-by)*u,1.6,1.6,2,'#162737',.21);}
  if(targets.length>MAX)throw Error('AI assembly exceeds particle capacity');priorWidth=innerWidth;priorHeight=innerHeight;
 }
 function sourceTriangles(){
  triangles=[];weights=[];totalArea=0;scene.updateMatrixWorld(true);
  for(const glyph of glyphs){const p=glyph.mesh.geometry.attributes.position,indices=glyph.mesh.geometry.index;
   for(let i=0;i<(indices?.count||p.count);i+=3){const at=k=>indices?indices.getX(k):k,a=V().fromBufferAttribute(p,at(i)),b=V().fromBufferAttribute(p,at(i+1)),c=V().fromBufferAttribute(p,at(i+2)),area=V().crossVectors(b.clone().sub(a),c.clone().sub(a)).length()/2;if(area<1e-8)continue;totalArea+=area;weights.push(totalArea);triangles.push({a,b,c,glyph});}
  }
 }
 function clearWeld(){for(const c of [...assembled.children]){assembled.remove(c);c.geometry?.dispose();if(c.material)c.material.dispose();}}
 function makeWeld(){
  clearWeld();for(const p of parts){const r=p.rect,g=new T.BoxGeometry(units(r.width),units(r.height),units(p.name.includes('panel')?7:4)),m=frostedGlass({color:p.color,thickness:.16,roughness:.4,transmission:p.name.includes('Send')?.2:.86}),o=new T.Mesh(g,m);o.position.copy(world(r.x+r.width/2,r.y+r.height/2,p.depth-units(2)));o.quaternion.copy(camera.quaternion);o.name=p.name;o.add(glassEdges(g,{opacity:.28}));assembled.add(o);}assembled.visible=false;
 }
 function bake(){
  if(!targets.length||priorWidth!==innerWidth||priorHeight!==innerHeight){measureTargets();makeWeld();}if(!triangles.length)sourceTriangles();scene.updateMatrixWorld(true);solver=new ParticlePhysics(targets.length);
  for(let i=0;i<targets.length;i++){
   const sample=random(i+1)*totalArea;let lo=0,hi=weights.length-1;while(lo<hi){const m=(lo+hi)>>1;if(weights[m]<sample)lo=m+1;else hi=m;}const t=triangles[lo],u=Math.sqrt(random(i+343)),v=random(i+871),local=t.a.clone().multiplyScalar(1-u).addScaledVector(t.b,u*(1-v)).addScaledVector(t.c,u*v);
   solver.release[i]=.12+t.glyph.index*.035+saturate(.5-local.y/3.3)*1.05+random(i+32)*.12;
   const start=local.applyMatrix4(t.glyph.mesh.matrixWorld);solver.origin.set(start.toArray(),i*3);solver.target.set(targets[i].world.toArray(),i*3);
  }solver.reset();baked=true;welded=false;document.body.classList.remove('assembly-ready');
 }
 function matrices(){
  let glassCount=0,inkCount=0;const letters=new Array(CHARS.length).fill(0),time=solver.clock,gather=smooth((time-2.7)/2.1);
  for(let i=0;i<targets.length;i++){
   const t=targets[i],j=i*3,age=time-solver.release[i];if(age<0)continue;
   if(welded&&t.type!==1)continue;
   dummy.position.fromArray(solver.position,j);euler.set(Math.sin(i)*age*.8,Math.cos(i*.7)*age,Math.sin(i*.3)*age*.4);q.setFromEuler(euler);dummy.quaternion.copy(q).slerp(camera.quaternion,gather);
   const flightGlyph=i%7===0&&age>.18&&time<4.1;
   if(flightGlyph){const index=i%CHARS.length,batch=letterBatches[index];dummy.scale.setScalar(.12*(1-.45*gather));dummy.updateMatrix();batch.setMatrixAt(letters[index]++,dummy.matrix);continue;}
   dummy.scale.set(T.MathUtils.lerp(.045,units(t.w),gather),T.MathUtils.lerp(.045,units(t.h),gather),T.MathUtils.lerp(.055,t.type===0?units(4):units(.7),gather));dummy.updateMatrix();
   const batch=t.type===0?fragments:marks,index=t.type===0?glassCount++:inkCount++;batch.setMatrixAt(index,dummy.matrix);color.copy(white).lerp(t.color,gather);batch.setColorAt(index,color);
  }
  for(const [m,n]of [[fragments,glassCount],[marks,inkCount]]){m.count=n;m.instanceMatrix.needsUpdate=true;if(m.instanceColor)m.instanceColor.needsUpdate=true;}
  letterBatches.forEach((m,i)=>{m.count=letters[i];m.instanceMatrix.needsUpdate=true;});
 }
 function update({phase:next,dt=1/60}){
  if(next==='morph'&&phase!=='morph')bake();
  root.visible=['morph','chat','launch'].includes(next);if(next==='intro'){baked=false;welded=false;assembled.visible=false;document.body.classList.remove('assembly-ready');}
  if(baked&&next==='morph'){solver.advance(dt);const state=solver.snapshot();if(state.settled===state.count&&!welded){welded=true;assembled.visible=true;document.body.classList.add('assembly-ready');}matrices();}
  if(baked&&next==='chat'){if(!welded){solver.advance(dt);if(solver.snapshot().settled===solver.count){welded=true;assembled.visible=true;document.body.classList.add('assembly-ready');}matrices();}else if(priorWidth!==innerWidth||priorHeight!==innerHeight){measureTargets();makeWeld();assembled.visible=true;solver=new ParticlePhysics(targets.length);targets.forEach((t,i)=>solver.target.set(t.world.toArray(),i*3));solver.position.set(solver.target);solver.clock=7;matrices();}}
  if(next==='launch')root.visible=false;
  phase=next;return solver?.snapshot();
 }
 function warmup(){measureTargets();sourceTriangles();makeWeld();root.visible=assembled.visible=true;for(const m of [fragments,marks,...letterBatches]){m.count=1;m.setMatrixAt(0,new T.Matrix4());m.instanceMatrix.needsUpdate=true;}return()=>{root.visible=assembled.visible=false;for(const m of [fragments,marks,...letterBatches])m.count=0;};}
 return{root,bake,update,warmup,get ready(){return welded;},snapshot:()=>({...(solver?.snapshot()||{}),ready:welded,components:parts.map(p=>p.name),source:'area-weighted samples of actual extruded Chinese glyph triangles',glyphGeometry:'extruded outline ASCII; no sprites',panelHandoff:'physical target settling then topology weld; no opacity crossfade',targets:targets.length}),dispose(){root.removeFromParent();unit.dispose();grain.dispose();ink.dispose();letterBatches.forEach(m=>m.geometry.dispose());clearWeld();}};
}
