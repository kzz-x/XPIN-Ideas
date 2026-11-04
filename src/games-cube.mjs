import * as T from 'three';
import {wordGeometry} from './games-glyphs.mjs';
import {WORDS} from './games-rules.mjs';

const NORMALS = [[0,0,1],[1,0,0],[0,0,-1],[-1,0,0],[0,1,0],[0,-1,0]];
const V = (x=0,y=0,z=0) => new T.Vector3(x,y,z);
const ease = t => t*t*t*(t*(6*t-15)+10);

/** Real R03 r03 outlined/extruded glyphs with a physical, angle-gated glass volume. */
export function createWordCube({root, camera, box, label, line, materials, onCollect}) {
  const holder = new T.Group(); holder.name = '六词 / 磨砂玻璃观察装置'; root.add(holder);
  holder.position.set(-2.35, 1.92, 0);
  const cube = new T.Group(); holder.add(cube);
  const geo = new T.BoxGeometry(2.25,2.25,2.25);
  const glassMaterial = new T.MeshPhysicalMaterial({color:0xd9edff, roughness:.18, metalness:0, transmission:.92, thickness:1.6, ior:1.25, clearcoat:1, clearcoatRoughness:.10, attenuationColor:0xc7e5ff, attenuationDistance:8, depthWrite:false, transparent:true, opacity:.92});
  const glass = new T.Mesh(geo, glassMaterial); glass.name='Real transmissive glass shell'; glass.renderOrder=5; cube.add(glass);
  const frostUniforms = {opacity:{value:.20}};
  const frostMat = new T.ShaderMaterial({uniforms:frostUniforms, transparent:true, depthWrite:false, side:T.FrontSide,
    vertexShader:'varying vec3 p;void main(){p=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader:`varying vec3 p;uniform float opacity;float hash(vec3 q){return fract(sin(dot(q,vec3(12.9898,78.233,45.164)))*43758.5453);}void main(){float g=hash(floor(p*540.));float b=sin(p.x*7.+sin(p.z*9.))*sin(p.y*6.);gl_FragColor=vec4(vec3(.78,.88,1.)+(g-.5)*.05,opacity*(.78+g*.3+b*.08));
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    }`});
  const frost = new T.Mesh(new T.BoxGeometry(2.254,2.254,2.254),frostMat); frost.renderOrder=6; cube.add(frost);
  const edges = new T.LineSegments(new T.EdgesGeometry(new T.BoxGeometry(2.258,2.258,2.258)), new T.LineBasicMaterial({color:0xd0edff, transparent:true, opacity:.64}));
  edges.renderOrder=7; cube.add(edges);
  const word = new T.Group(); word.name = '实体挤出字 / 位于玻璃内部'; cube.add(word);
  const windowUniforms={inverseCube:{value:new T.Matrix4()}};
  const glyphs=WORDS.map((text,index)=>{
    const mats=[0xeaf5ff,0x3a67aa].map(color=>{
      const m=new T.MeshStandardMaterial({color,metalness:.18,roughness:.32,transparent:true,opacity:0,depthWrite:false,depthTest:true});
      m.onBeforeCompile=sh=>{
        sh.uniforms.uInverseCube=windowUniforms.inverseCube;
        sh.uniforms.uWindowFace={value:index};
        sh.vertexShader='varying vec3 vGlyphWorld;\n'+sh.vertexShader;
        sh.vertexShader=sh.vertexShader.replace('#include <worldpos_vertex>','#include <worldpos_vertex>\nvGlyphWorld=(modelMatrix*vec4(transformed,1.)).xyz;');
        sh.fragmentShader='uniform mat4 uInverseCube;uniform int uWindowFace;varying vec3 vGlyphWorld;\n'+sh.fragmentShader;
        sh.fragmentShader=sh.fragmentShader.replace('#include <clipping_planes_fragment>',`#include <clipping_planes_fragment>
          vec3 wp=(uInverseCube*vec4(vGlyphWorld,1.)).xyz;
          vec3 ray=normalize((uInverseCube*vec4(cameraPosition-vGlyphWorld,0.)).xyz);
          vec3 hit=(sign(ray)*1.127-wp)/(ray+vec3(1e-7));
          if(abs(ray.x)<1e-5)hit.x=1e20;if(abs(ray.y)<1e-5)hit.y=1e20;if(abs(ray.z)<1e-5)hit.z=1e20;
          int face=ray.z>0.?0:2;float tt=hit.z;
          if(hit.x<tt){face=ray.x>0.?1:3;tt=hit.x;}
          if(hit.y<tt)face=ray.y>0.?4:5;
          if(face!=uWindowFace)discard;`);
      };
      m.customProgramCacheKey=()=> 'linggan-six-window-'+index;
      return m;
    });
    const g=new T.Mesh(wordGeometry(text),mats);g.name='Internal extruded '+text;g.geometry.computeBoundingBox();
    const size=g.geometry.boundingBox.getSize(V());g.scale.setScalar(Math.min(1.65/size.x,1.24/size.y));
    g.renderOrder=4;word.add(g);return g;
  });
  const footprint = box(3.25,.05,3.25,materials.dark,[-2.35,.04,0],root);
  footprint.name='观察定位面 / 直接位于卷面';
  line([[-3.98,.075,-1.63],[-.72,.075,-1.63],[-.72,.075,1.63],[-3.98,.075,1.63],[-3.98,.075,-1.63]],materials.line,root);
  label(root,'拖动观察 · 清晰停留后自动收词',[-2.35,.09,2.45],4.2,.38,{surface:true,color:'#c4ddff'});
  const trays=[],collected=[];
  for(let i=0;i<6;i++){
    const pos=V(1.12+(i%2)*2.2,.16,-1.65+Math.floor(i/2)*1.7);
    const tray=box(1.95,.14,1.20,materials.dark,pos.toArray(),root);
    line([[-.96,.08,-.58],[.96,.08,-.58],[.96,.08,.58],[-.96,.08,.58],[-.96,.08,-.58]],materials.line,tray);
    label(tray,String(i+1).padStart(2,'0'),[-.72,.10,-.35],.30,.22,{surface:true,color:'#7d9bc3'});
    const solid = new T.Mesh(wordGeometry(WORDS[i]),[materials.white,materials.side]);
    solid.name='Collected solid word '+WORDS[i];solid.scale.setScalar(.72);solid.rotation.x=-Math.PI/2;solid.position.copy(pos).add(V(0,.16,.06));solid.visible=false;root.add(solid);
    trays.push({root:tray,pos});collected.push(solid);
  }
  const velocity=new T.Vector2(),goal=new T.Quaternion();
  let initialized=false,face=0,alpha=0,dwell=0,dwellFace=-1,held=false,helpTurn=false,anim=null,done=[],active=false;
  const flights=[];
  function localCameraQuaternion(){return root.getWorldQuaternion(new T.Quaternion()).invert().multiply(camera.quaternion);}
  function showFace(index){
    root.updateWorldMatrix(true,true);camera.updateWorldMatrix(true,false);
    goal.copy(localCameraQuaternion()).multiply(new T.Quaternion().setFromUnitVectors(V(...NORMALS[index]),V(0,0,1)));
    helpTurn=true;velocity.set(0,0);dwell=0;
  }
  function turn(dx,dy){
    held=true;helpTurn=false;
    const screenQ=localCameraQuaternion(),delta=new T.Quaternion().setFromEuler(new T.Euler(dy*.007,dx*.008,0,'YXZ'));
    cube.quaternion.premultiply(screenQ.clone().multiply(delta).multiply(screenQ.clone().invert())).normalize();
    goal.copy(cube.quaternion);velocity.set(dx*.008,dy*.007);dwell=0;
  }
  function release(){held=false;}
  function collect(index){
    if(done.includes(index))return;
    const target=collected[index];target.visible=true;
    const start=root.worldToLocal(holder.getWorldPosition(V()));
    target.position.copy(start);target.scale.setScalar(.90);target.quaternion.copy(localCameraQuaternion());
    flights.push({index,age:0,start,end:trays[index].pos.clone().add(V(0,.16,.06)),q0:target.quaternion.clone()});
    onCollect(index);
  }
  function setDone(values){
    done=values.slice();
    for(let i=0;i<6;i++)if(!flights.some(f=>f.index===i)){
      collected[i].visible=done.includes(i);collected[i].position.copy(trays[i].pos).add(V(0,.16,.06));collected[i].rotation.set(-Math.PI/2,0,0);collected[i].scale.setScalar(.72);
    }
  }
  function update(dt,time,isActive){
    active=isActive;
    if(active&&!initialized){cube.quaternion.copy(localCameraQuaternion());goal.copy(cube.quaternion);initialized=true;}
    if(helpTurn){cube.quaternion.slerp(goal,1-Math.exp(-5*dt));if(cube.quaternion.angleTo(goal)<.001)helpTurn=false;}
    if(!held&&!helpTurn&&velocity.lengthSq()>.0000001){
      const screenQ=localCameraQuaternion(),q=new T.Quaternion().setFromEuler(new T.Euler(velocity.y*dt*24,velocity.x*dt*24,0,'YXZ'));
      cube.quaternion.premultiply(screenQ.clone().multiply(q).multiply(screenQ.clone().invert())).normalize();velocity.multiplyScalar(Math.exp(-8*dt));
    }
    holder.position.y=1.92+Math.sin(time*.8)*.025;
    root.updateWorldMatrix(true,true);
    const q=cube.getWorldQuaternion(new T.Quaternion()),center=cube.getWorldPosition(V()),toward=camera.position.clone().sub(center).normalize();
    const scores=NORMALS.map(n=>V(...n).applyQuaternion(q).dot(toward)),best=scores.indexOf(Math.max(...scores));
    if(best!==face&&scores[best]>scores[face]+.045){alpha=Math.max(0,alpha-dt*7);if(alpha<.001)face=best;}
    else {const other=Math.max(...scores.filter((_,i)=>i!==face)),a=T.MathUtils.smoothstep(scores[face],.63,.98)*T.MathUtils.smoothstep(scores[face]-other,.015,.18);alpha=T.MathUtils.damp(alpha,a,8,dt);}
    word.quaternion.copy(q.clone().invert()).multiply(camera.quaternion);
    windowUniforms.inverseCube.value.copy(cube.matrixWorld).invert();
    glyphs.forEach((g,i)=>{g.visible=i===face&&alpha>.001;for(const m of g.material)m.opacity=i===face?alpha:0;});
    glassMaterial.roughness=.065+(1-alpha)*.30;frostUniforms.opacity.value=.018+(1-alpha)*.26;
    if(active&&!held&&!helpTurn&&!done.includes(face)&&alpha>.80&&scores[face]>.88&&face===best){
      if(dwellFace!==face){dwellFace=face;dwell=0;}else dwell+=dt;
      if(dwell>=.42){collect(face);dwell=0;}
    }else{dwell=0;dwellFace=-1;}
    const endQ=new T.Quaternion().setFromEuler(new T.Euler(-Math.PI/2,0,0));
    for(let j=flights.length-1;j>=0;j--){const f=flights[j],u=Math.min(1,(f.age+=dt)/1.25),s=ease(u),o=collected[f.index];o.position.lerpVectors(f.start,f.end,s);o.position.y+=Math.sin(Math.PI*s)*1.05;o.quaternion.slerpQuaternions(f.q0,endQ,s);o.scale.setScalar(T.MathUtils.lerp(.90,.72,s));if(u===1)flights.splice(j,1);}
  }
  return {root:holder,cube,glass,turn,release,showFace,setDone,update,
    hit(ray){return ray.intersectObject(glass,false).length>0;},
    helpTarget(index){return {object:holder,face:index};},
    snapshot(){return {face,clarity:alpha,dwell,held,done:[...done],glyphs:glyphs.map(g=>({name:g.name,vertices:g.geometry.attributes.position.count})),flights:flights.length};},
    reset(){initialized=false;velocity.set(0,0);held=false;helpTurn=false;dwell=0;flights.length=0;setDone([]);}
  };
}
