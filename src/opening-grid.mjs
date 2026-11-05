import * as T from 'three';
import {outlineShapes} from './opening-characters.mjs';
export function createOpeningGrid({scene,camera,asciiData}){
 const root=new T.Group();root.name='Fine engineering grid / pointer-driven surface waves';scene.add(root);
 const points=[],major=[];function segment(x1,y1,x2,y2,m){points.push(x1,y1,-2.4,x2,y2,-2.4);major.push(m,m);}
 for(let x=-20;x<=20.01;x+=.4)for(let y=-26;y<26;y+=.25)segment(x,y,x,y+.25,Math.abs(x/2-Math.round(x/2))<.01?1:0);
 for(let y=-26;y<=26.01;y+=.4)for(let x=-20;x<20;x+=.25)segment(x,y,x+.25,y,Math.abs((y+26)/2-Math.round((y+26)/2))<.01?1:0);
 const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(points,3));geo.setAttribute('aMajor',new T.Float32BufferAttribute(major,1));
 const ripples=Array.from({length:8},()=>new T.Vector4(99,99,-100,0)),uniforms={time:{value:0},ripples:{value:ripples},opacity:{value:1}};
 const material=new T.ShaderMaterial({uniforms,transparent:true,depthWrite:false,vertexShader:`attribute float aMajor;uniform float time;uniform vec4 ripples[8];varying float major;varying float wave;void main(){vec3 p=position;wave=0.;for(int i=0;i<8;i++){float age=max(0.,time-ripples[i].z),r=length(p.xy-ripples[i].xy);float w=sin(r*8.-age*9.)*exp(-abs(r-age*2.4)*1.5)*exp(-age*.85)*ripples[i].w;wave+=w;p.z+=w*.32;p.xy+=normalize(p.xy-ripples[i].xy+vec2(.001))*w*.045;}major=aMajor;gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}`,fragmentShader:`uniform float opacity;varying float major;varying float wave;void main(){gl_FragColor=vec4(vec3(.27,.39,.51)+abs(wave)*.1,(.095+major*.06+abs(wave)*.10)*opacity);}`});
 const grid=new T.LineSegments(geo,material);root.add(grid);
 const symbols='{}[]<>/=+;AGXZ01',batches=[],particles=[],dummy=new T.Object3D(),count=192;
 const random=i=>{const n=Math.sin(i*127.1+87.3)*43758.5453;return n-Math.floor(n);};
 for(const symbol of symbols){
  const g=new T.ExtrudeGeometry(outlineShapes(asciiData[symbol]),{depth:1.1,bevelEnabled:false,curveSegments:2});
  g.computeBoundingBox();const c=g.boundingBox.getCenter(new T.Vector3());g.translate(-c.x,-c.y,-c.z);g.scale(1/75,1/75,1/75);
  const mat=new T.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:.9,depthWrite:false});
  const mesh=new T.InstancedMesh(g,mat,count);mesh.count=0;mesh.frustumCulled=false;mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);root.add(mesh);batches.push(mesh);
 }
 for(let id=0;id<count;id++){
  const base=new T.Vector3(random(id+1)*30-15,random(id+301)*20-10,-2.1);
  particles.push({id,k:Math.floor(random(id+701)*symbols.length),base,pos:base.clone(),velocity:new T.Vector3(),nextChange:random(id+901)*2,changes:0});
 }
 let backgroundWidth=0,backgroundHeight=0,masked=0;const projected=new T.Vector3();
 let now=0,index=0,last=new T.Vector2(99,99),lastEmit=-100;
 function pointer(x,y){const p=new T.Vector3(x/innerWidth*2-1,1-y/innerHeight*2,.5).unproject(camera),dir=p.sub(camera.position).normalize(),hit=camera.position.clone().addScaledVector(dir,(-2.4-camera.position.z)/dir.z);const distance=last.distanceTo(new T.Vector2(hit.x,hit.y));if(now-lastEmit>.055&&distance>.06){ripples[index++%8].set(hit.x,hit.y,now,Math.min(.65,distance*.35));lastEmit=now;}last.set(hit.x,hit.y);}
 function screen(x,y){const h=2*Math.tan(T.MathUtils.degToRad(camera.fov/2))*22;return new T.Vector3((x/innerWidth-.5)*h*camera.aspect,(.5-y/innerHeight)*h,-22).applyMatrix4(camera.matrixWorld);}
 function update({time,dt,holdProgress=0,phase}){
  now=time;uniforms.time.value=time;root.visible=['intro','morph','chat'].includes(phase);if(!root.visible)return;
  const r=document.querySelector('#hold').getBoundingClientRect(),send=document.querySelector('#send').getBoundingClientRect();masked=0;
  if(backgroundWidth!==innerWidth||backgroundHeight!==innerHeight){
   const first=!backgroundWidth;backgroundWidth=innerWidth;backgroundHeight=innerHeight;
   for(const p of particles){p.base.copy(screen(random(p.id+1)*innerWidth,random(p.id+301)*innerHeight));p.base.z=-2.1;if(first)p.pos.copy(p.base);}
  }
  const pixelUnit=2*Math.tan(T.MathUtils.degToRad(camera.fov/2))*22/innerHeight;
  const counts=new Array(symbols.length).fill(0);
  for(const p of particles){
   if(time>=p.nextChange){p.changes++;p.k=Math.floor(random(p.id+91*p.changes+1101)*symbols.length);p.nextChange=time+.35+random(p.id+67*p.changes)*2.3;}
   const caught=phase==='intro'&&random(p.id+51)<Math.min(1,holdProgress*1.35);
   // Each body has an independent attractor and a decaying swirl, never a grid.
   const u=random(p.id+1401),v=random(p.id+1701),angle=time*(1.1+u)+p.id*2.399;
   const sx=r.x+r.width*(.08+.84*u)+Math.cos(angle)*(1-holdProgress)*22;
   const sy=r.y+r.height*(.12+.76*v)+Math.sin(angle)*8;
   const target=caught?screen(sx,sy):p.base;
   const step=Math.min(.033,dt),force=target.clone().sub(p.pos).multiplyScalar(caught?65:14);
   p.velocity.addScaledVector(force,step).multiplyScalar(Math.exp(-(caught?13:6)*step));p.pos.addScaledVector(p.velocity,step);
   if(phase!=='intro'&&send.width>0){projected.copy(p.pos).project(camera);const px=(projected.x*.5+.5)*innerWidth,py=(.5-projected.y*.5)*innerHeight;if(px>send.left-10&&px<send.right+10&&py>send.top-10&&py<send.bottom+10){masked++;continue;}}
   dummy.position.copy(p.pos);dummy.position.z+=caught?0:Math.sin(time*.7+p.id)*.025;
   dummy.quaternion.copy(camera.quaternion);dummy.rotateZ(caught?Math.sin(time+p.id)*.25:Math.sin(p.id)*.12);
   dummy.scale.setScalar(pixelUnit*(caught?8+u*3:7.5+u*2.5));dummy.updateMatrix();
   const i=counts[p.k]++;batches[p.k].setMatrixAt(i,dummy.matrix);batches[p.k].setColorAt(i,new T.Color(caught?0x91aabc:0x304a65));
  }
  batches.forEach((b,k)=>{b.count=counts[k];b.instanceMatrix.needsUpdate=true;if(b.instanceColor)b.instanceColor.needsUpdate=true;});

 }
 return{root,pointer,update,snapshot:()=>({sendMasked:masked,ripples:index,backgroundCharacters:particles.length,characterSet:symbols,changes:particles.reduce((n,p)=>n+p.changes,0),gridSegments:points.length/6,holdCapture:'same background character bodies attracted into the button'}),dispose(){root.removeFromParent();geo.dispose();material.dispose();for(const b of batches){b.geometry.dispose();b.material.dispose();}}};
}
