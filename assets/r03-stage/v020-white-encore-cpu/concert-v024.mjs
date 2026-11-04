import * as T from '../../dot/model/frozen/r07d/editable-stage/素材/v011/DotSharedWeb/vendor/three.module.js';
import {SIDE_BURST_DELAYS,makeSideSparkSeeds,sampleSideSpark,makeColdSparkSeeds,sampleColdSpark,makeSideRibbonSeeds,sampleSideRibbon} from './concert-side-fx-cdx.mjs';

// V024: native, deterministic Three.js scene choreography on the restored v020
// stage. The sprites and procedural masks are world-space light/particle assets,
// NOT full-screen or background replacements; actor/trumpet remain source GLB.
const PI=Math.PI, clamp=x=>Math.max(0,Math.min(1,x));
const ease=(a,b,t)=>{const x=clamp((t-a)/(b-a));return x*x*(3-2*x);};
const envelope=(t,a,b,c,d)=>ease(a,b,t)*(1-ease(c,d,t));
const hash=(i,s=0)=>{let v=Math.imul((i+1)|0,1664525)+Math.imul(s+1,1013904223);v^=v>>>16;v=Math.imul(v,2246822507);v^=v>>>13;return(v>>>0)/4294967295;};
const v=(x,y,z)=>new T.Vector3(x,y,z);
const darkGold='#ffd08b',coldWhite='#cbdff5',champagne='#ffe3b7';
function glowingPlane(color,opacity){return new T.ShaderMaterial({uniforms:{color:{value:new T.Color(color)},intensity:{value:opacity}},vertexShader:`varying vec2 vu;void main(){vu=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,fragmentShader:`varying vec2 vu;uniform vec3 color;uniform float intensity;void main(){float w=abs(vu.x-.5)*2.;float core=exp(-9.*w*w);float along=smoothstep(0.,.14,vu.y)*(1.-smoothstep(.76,1.,vu.y));float a=intensity*core*along;gl_FragColor=vec4(color,a);}`,depthWrite:false,depthTest:true,transparent:true,side:T.DoubleSide,blending:T.AdditiveBlending,toneMapped:false});}
function radialTexture(){const c=document.createElement('canvas');c.width=c.height=128;const x=c.getContext('2d'),g=x.createRadialGradient(64,64,0,64,64,63);g.addColorStop(0,'rgba(255,255,255,1)');g.addColorStop(.1,'rgba(255,255,255,.9)');g.addColorStop(.27,'rgba(255,255,255,.30)');g.addColorStop(.55,'rgba(255,255,255,.05)');g.addColorStop(1,'rgba(255,255,255,0)');x.fillStyle=g;x.fillRect(0,0,128,128);const tex=new T.CanvasTexture(c);tex.colorSpace=T.SRGBColorSpace;return tex;}
function addInstanceLife(mesh,key){
 const life=new T.InstancedBufferAttribute(new Float32Array(mesh.count),1);life.setUsage(T.DynamicDrawUsage);mesh.geometry.setAttribute('aCdxFxLife',life);
 mesh.material.onBeforeCompile=shader=>{
  shader.vertexShader='attribute float aCdxFxLife;varying float vCdxFxLife;\n'+shader.vertexShader;
  shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvCdxFxLife=aCdxFxLife;');
  shader.fragmentShader='varying float vCdxFxLife;\n'+shader.fragmentShader;
  shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\ndiffuseColor.a*=vCdxFxLife;');
 };
 mesh.material.customProgramCacheKey=()=>key;return life;
}
export function createConcertV024(stage,dot,layout){
 const root=new T.Group();root.name='V024 / restored native 3D concert layers';stage.scene.add(root);
 const cx=layout.screen.x,screen=layout.screen,top=screen.y+screen.height/2,deck=-1.67;
 const beamGeo=new T.PlaneGeometry(1,1),beams=[],beamLights=[];
 const beamMatrix=new T.Matrix4(),right=new T.Vector3(),up=new T.Vector3(),forward=new T.Vector3(),target=new T.Vector3(),mid=new T.Vector3();
 const warm=new T.Color('#ffdda7'),cool=new T.Color('#d8eaff');
 // Discreet physical wall grazers recover the depth of the curved matte-metal
 // wings without turning the venue into a bright grey studio.
 const wingLights=[];
 for(const sign of[-1,1])for(let j=0;j<3;j++){
  const p=new T.PointLight(j%2?'#b8d8fa':'#f6d2a4',0,9,2);
  p.name='V024 / curved graphite wing grazing real light';
  p.position.set(cx+sign*(11.8+j*.58),2.4+j*2.6,-.8+j*.4);
  root.add(p);wingLights.push(p);
 }
 for(let i=0;i<22;i++){
  const side=i%2?-1:1,k=Math.floor(i/2),from=v(cx+side*(10.9+(k%4)*.35),9.8+(k%3)*.24,-3.1+(k%4)*1.36);
  const col=k%4===0?champagne:k%3===0?'#c2e0ff':'#e2eefa';
  const mesh=new T.Mesh(beamGeo,glowingPlane(col,.12));mesh.name=`V024 / volumetric feathered beam ${i+1}`;mesh.frustumCulled=false;root.add(mesh);
  const light=i<8?new T.SpotLight(col,3.0,48,.24,.84,1.5):null;
  if(light){light.position.copy(from);light.castShadow=false;light.target.position.set(cx+side*4,-1.4,1);root.add(light,light.target);beamLights.push(light);}
  beams.push({mesh,light,from,side,index:i,k});
 }
 // Stage pool: genuine world-space ground projected halos at slightly different z.
 const poolGeo=new T.PlaneGeometry(1,1),pools=[];
 const poolShader=(color)=>new T.ShaderMaterial({uniforms:{color:{value:new T.Color(color)},power:{value:.45}},vertexShader:`varying vec2 u;void main(){u=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,fragmentShader:`varying vec2 u;uniform vec3 color;uniform float power;void main(){vec2 q=(u-.5)*vec2(2.,2.);float a=power*exp(-3.6*dot(q,q));gl_FragColor=vec4(color,a);}`,transparent:true,depthWrite:false,depthTest:true,blending:T.AdditiveBlending,side:T.DoubleSide,toneMapped:false});
 for(const side of[-1,1])for(let j=0;j<3;j++){
  const pool=new T.Mesh(poolGeo,poolShader(j%2===0?coldWhite:darkGold));pool.rotation.x=-PI/2;pool.position.set(cx+side*(4.2+j*2.6),deck+.028,1.7+j*.45);pool.scale.set(4.4,6.3,1);pool.name='V024 / true floor light footprint';root.add(pool);pools.push(pool);
 }
 const actorPool=new T.Mesh(poolGeo,poolShader('#b8d6ff'));actorPool.rotation.x=-PI/2;actorPool.position.set(-.5,deck+.035,2);actorPool.scale.set(3.6,4.0,1);root.add(actorPool);
 const haloTex=radialTexture(),halos=[];
 for(let k=0;k<7;k++){
  const spr=new T.Sprite(new T.SpriteMaterial({map:haloTex,color:k%3===0?'#ecf5ff':'#ffdb9d',transparent:true,opacity:0,blending:T.AdditiveBlending,depthWrite:false,depthTest:true,toneMapped:false}));
  spr.name='V024 / firework bloom in 3D';spr.position.set(cx+(k%2?-1:1)*(10.45+(k%3)*.5),7.1+(k%3)*.85+(k%2)*.2,-2.7+(k%3)*.42);spr.scale.set(3.5,3.5,1);root.add(spr);halos.push(spr);
 }
 // World-space radial spark trails, intentionally between actor and side wings.
 const fwCount=7*116,fwGeo=new T.CylinderGeometry(.042,.067,1,5),fwMat=new T.MeshBasicMaterial({color:'#fff0cb',transparent:true,opacity:1,blending:T.AdditiveBlending,depthWrite:false,toneMapped:false});
 const fireworks=new T.InstancedMesh(fwGeo,fwMat,fwCount);fireworks.name='V024 / 7 radial firework blooms 812 independently moving streaks';fireworks.instanceMatrix.setUsage(T.DynamicDrawUsage);fireworks.frustumCulled=false;root.add(fireworks);
 const fwSeeds=makeSideSparkSeeds(fwCount),fwLife=addInstanceLife(fireworks,'cdx-v024-side-spark-life-r02');
 const fwPalette=['#ffe2a4','#e7ab5b','#ffc67a','#a9cee9','#d1a05e'];for(let i=0;i<fwCount;i++)fireworks.setColorAt(i,new T.Color(fwPalette[Math.floor(hash(i,39)*fwPalette.length)]));
 const fountainCount=4*155,spGeo=new T.CylinderGeometry(.028,.043,1,5),spMat=new T.MeshBasicMaterial({color:'#ffe3b0',transparent:true,opacity:.91,blending:T.AdditiveBlending,depthWrite:false,toneMapped:false});
 const fountain=new T.InstancedMesh(spGeo,spMat,fountainCount);fountain.name='V024 / four realistic cold spark fountains';fountain.instanceMatrix.setUsage(T.DynamicDrawUsage);fountain.frustumCulled=false;root.add(fountain);
 const fountainSeeds=makeColdSparkSeeds(fountainCount),fountainLife=addInstanceLife(fountain,'cdx-v024-cold-spark-life-r02');
 const paperCount=720,paperGeo=new T.PlaneGeometry(.16,.093),paperMat=new T.MeshStandardMaterial({color:'#ffffff',side:T.DoubleSide,metalness:.62,roughness:.27,transparent:true,opacity:.98,depthWrite:false});
 const confetti=new T.InstancedMesh(paperGeo,paperMat,paperCount);confetti.name='V024 / layered champagne cobalt silver confetti';confetti.frustumCulled=false;confetti.instanceMatrix.setUsage(T.DynamicDrawUsage);root.add(confetti);
 const palette=['#eab768','#ffe5b1','#9eb8d4','#1a53b4','#f9f3df','#ba8850'];for(let i=0;i<paperCount;i++)confetti.setColorAt(i,new T.Color(palette[Math.floor(hash(i,21)*palette.length)]));
 const ribbonsCount=72,ribbonVertices=[],ribbonIndices=[];
 for(let i=0;i<=16;i++){const u=i/16,h=u-.5,w=.055*(.8+.2*Math.sin(i*.66)),s=.20*Math.sin(u*PI*2.4),z=.13*Math.cos(u*PI*2),twist=.8*Math.sin(u*PI*2)+u*1.2;const dx=w*Math.cos(twist),dz=w*Math.sin(twist);ribbonVertices.push(s-dx,h*1.35,z-dz,s+dx,h*1.35,z+dz);if(i<16){const a=2*i;ribbonIndices.push(a,a+1,a+2,a+1,a+3,a+2);}}
 const ribbonGeo=new T.BufferGeometry();ribbonGeo.setAttribute('position',new T.Float32BufferAttribute(ribbonVertices,3));ribbonGeo.setIndex(ribbonIndices);ribbonGeo.computeVertexNormals();
 const ribbonMat=new T.MeshStandardMaterial({color:'#ffffff',side:T.DoubleSide,metalness:.63,roughness:.33,transparent:true,depthWrite:false});
 const ribbons=new T.InstancedMesh(ribbonGeo,ribbonMat,ribbonsCount);ribbons.name='V024 / curling metallic ribbon streamers';ribbons.instanceMatrix.setUsage(T.DynamicDrawUsage);ribbons.frustumCulled=false;root.add(ribbons);
 const ribbonSeeds=makeSideRibbonSeeds(ribbonsCount),ribbonLife=addInstanceLife(ribbons,'cdx-v024-ribbon-life-r02');
 for(let i=0;i<ribbonsCount;i++)ribbons.setColorAt(i,new T.Color(palette[Math.floor(hash(i,98)*palette.length)]));
 const goldDustGeo=new T.IcosahedronGeometry(.034,0),goldDustMat=new T.MeshBasicMaterial({color:'#ffd79c',transparent:true,blending:T.AdditiveBlending,depthWrite:false}),dustCount=180;
 const hornDust=new T.InstancedMesh(goldDustGeo,goldDustMat,dustCount);hornDust.name='V024 / mouthpiece-directed brass dissolution';hornDust.instanceMatrix.setUsage(T.DynamicDrawUsage);root.add(hornDust);
 // The first game level remains completely three-dimensional and is in the SAME scene.
 const game=new T.Group();game.name='V024 / live 3D glass puzzle';root.add(game);
 const base=new T.Mesh(new T.CylinderGeometry(2.55,2.65,.35,96),new T.MeshStandardMaterial({color:'#1b232c',metalness:.78,roughness:.27}));base.position.set(cx+3.0,deck+.31,1.6);game.add(base);
 const ring=new T.Mesh(new T.TorusGeometry(2.2,.042,8,120),new T.MeshBasicMaterial({color:'#ffd9a4',toneMapped:false}));ring.rotation.x=PI/2;ring.position.set(cx+3,deck+.515,1.6);game.add(ring);
 const innerRing=new T.Mesh(new T.TorusGeometry(1.88,.012,6,120),new T.MeshBasicMaterial({color:'#d7e8ff',toneMapped:false}));innerRing.rotation.x=PI/2;innerRing.position.set(cx+3,deck+.522,1.6);game.add(innerRing);
 const upLight=new T.PointLight('#f7ddb0',0,12,2);upLight.position.set(cx+3,.2,1.6);game.add(upLight);
 const cube=new T.Group();cube.name='V024 / physically present frosted cube';cube.position.set(cx+3,1.46,1.6);game.add(cube);
 const volume=new T.Mesh(new T.BoxGeometry(2.10,2.10,2.10),new T.MeshBasicMaterial({color:'#cedeea',transparent:true,opacity:.085,depthWrite:false,side:T.DoubleSide}));volume.name='frosted glass actual internal layer';cube.add(volume);
 const upGlow=new T.Mesh(new T.PlaneGeometry(5.8,5.8),poolShader('#ffe0af'));upGlow.rotation.x=-PI/2;upGlow.position.set(cx+3,deck+.528,1.6);upGlow.material.uniforms.power.value=.60;game.add(upGlow);
 const glassMat=new T.MeshPhysicalMaterial({color:'#c2d8e9',transparent:true,opacity:.43,roughness:.26,metalness:0,transmission:.45,thickness:.7,ior:1.34,clearcoat:.65,clearcoatRoughness:.12,side:T.DoubleSide,depthWrite:false});
 const cubeMesh=new T.Mesh(new T.BoxGeometry(2.18,2.18,2.18),glassMat);cubeMesh.name='translucent actual mesh';cube.add(cubeMesh);
 const edges=new T.LineSegments(new T.EdgesGeometry(cubeMesh.geometry),new T.LineBasicMaterial({color:'#f2dfbf',transparent:true,opacity:.71}));cube.add(edges);
 const inkCanvas=document.createElement('canvas');inkCanvas.width=512;inkCanvas.height=256;const ictx=inkCanvas.getContext('2d');ictx.clearRect(0,0,512,256);ictx.fillStyle='#263647';ictx.font='bold 112px sans-serif';ictx.textAlign='center';ictx.textBaseline='middle';ictx.fillText('灵感',256,130);
 const inkTex=new T.CanvasTexture(inkCanvas);inkTex.colorSpace=T.SRGBColorSpace;
 const textMat=new T.MeshBasicMaterial({map:inkTex,transparent:true,depthWrite:false,opacity:0,side:T.DoubleSide});const textMesh=new T.Mesh(new T.PlaneGeometry(1.65,.76),textMat);textMesh.position.z=.02;cube.add(textMesh);
 // Separate world-space soft footlight and occasional gold spark glints.
 const flashLight=new T.PointLight('#ffd5a2',0,26,1.6);flashLight.position.set(cx,5,3);root.add(flashLight);
 let visibleTime=-1,prevState={};const dummy=new T.Object3D(),quat=new T.Quaternion(),axis=v(0,1,0),basis=new T.Matrix4(),direction=new T.Vector3(),pt=new T.Vector3();
 const set=(mesh,i,x,y,z,rx,ry,rz,sx=1,sy=sx,sz=sx)=>{dummy.position.set(x,y,z);dummy.rotation.set(rx,ry,rz);dummy.scale.set(sx,sy,sz);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);};
 const hidden=(mesh,i)=>{mesh.geometry.getAttribute('aCdxFxLife')?.setX(i,0);dummy.position.set(0,-100,0);dummy.scale.set(0,0,0);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);};
 const sideSample={x:0,y:0,z:0,vx:0,vy:0,vz:0,alpha:0,length:0,width:0,rx:0,ry:0,rz:0,size:1,stretch:1};
 function update(t,{stageSettings=null,cubeYaw,cubePitch,actorWorld=null}={}){
  const setts=stageSettings||{},fx=setts.effects||{},light=clamp(setts.beamStrength??.85),showLights=setts.enabled!==false&&setts.spotsEnabled!==false,spotGain=(setts.spotStrength??.85),stageAmp=(.55+.38*ease(0,2.3,t)+.24*ease(7.1,10.3,t));
  const peak=envelope(t,10.18,10.62,11.85,14.4),ramp=ease(9.75,10.7,t),fall=1-ease(13.1,17.8,t),settle=1-ease(18.8,21.4,t)*.73;
  const lightLevel=showLights?light*stageAmp*settle:0;
  const yawBase=t*.37;
  wingLights.forEach((l,i)=>l.intensity=lightLevel*(4.7+(i%3)*1.9)*(1+.55*peak));
  beams.forEach((b,i)=>{
   const theta=Math.sin(t*(.57+(i%4)*.07)+i*.78)*.72;
   const end=v(cx+b.side*(2.8+(b.k%6)*.88+theta*1.48),-1.43,.5+(i%4)*.68);
   direction.copy(end).sub(b.from);const len=direction.length();up.copy(direction).normalize();mid.copy(end).add(b.from).multiplyScalar(.5);
   right.crossVectors(up,stage.camera.position.clone().sub(mid).normalize()).normalize();if(right.lengthSq()<.0001)right.set(1,0,0);
   forward.crossVectors(right,up).normalize();basis.makeBasis(right,up,forward);b.mesh.quaternion.setFromRotationMatrix(basis);b.mesh.position.copy(mid);b.mesh.scale.set(1.1+(i%4)*.27,len,1);
   b.mesh.material.uniforms.intensity.value=lightLevel*(i%3===0?.24:.17)*(1+.16*Math.sin(t*1.8+i));b.mesh.visible=lightLevel>.018;
   if(b.light){b.light.target.position.copy(end);b.light.target.updateMatrixWorld();b.light.intensity=lightLevel*(3.2+peak*2.2)*spotGain;}
  });
  for(let i=0;i<pools.length;i++)pools[i].material.uniforms.power.value=lightLevel*(.20+peak*.28)*(i%3===1?.6:1);
  if(actorWorld){actorPool.position.x=actorWorld.x;actorPool.position.z=actorWorld.z;}
  actorPool.material.uniforms.power.value=showLights?.17*spotGain*(1+.36*peak):.03;
  // Four distinct peaks, staggered so the spectator can perceive an actual barrage.
  const burstGain=(fx.burst?.enabled===false?0:fx.burst?.strength??1),FW=envelope(t,10.23,10.47,12.8,14.45)*burstGain;
  for(let i=0;i<fwCount;i++){
   const s=sampleSideSpark(fwSeeds[i],t,sideSample);
   if(s.alpha<.001||FW<.005){hidden(fireworks,i);continue;}
   dummy.position.set(cx+s.x,s.y,s.z);pt.set(s.vx,s.vy,s.vz).normalize();quat.setFromUnitVectors(axis,pt);dummy.quaternion.copy(quat);
   dummy.scale.set(s.width,s.length,s.width);dummy.updateMatrix();fireworks.setMatrixAt(i,dummy.matrix);fwLife.setX(i,s.alpha);
  }fireworks.instanceMatrix.needsUpdate=true;fwLife.needsUpdate=true;fwMat.opacity=.70*FW;
  halos.forEach((h,k)=>{const e=t-10.20-SIDE_BURST_DELAYS[k];const a=FW*envelope(e,.05,.20,.65,1.85);h.material.opacity=.18*a;h.scale.setScalar(Math.max(.01,1.6+e*1.25));h.visible=a>.003;});
  // Cold-spark fountains fire from world-space positions at stage wings.
  const fountainGain=(fx.flash?.enabled===false?0:fx.flash?.strength??1),F=envelope(t,10.26,10.48,12.05,14.05)*fountainGain;
  for(let i=0;i<fountainCount;i++){
   const s=sampleColdSpark(fountainSeeds[i],t,sideSample);
   if(s.alpha<.001||s.y<deck||F<.006){hidden(fountain,i);continue;}
   dummy.position.set(cx+s.x,s.y,s.z);pt.set(s.vx,s.vy,s.vz).normalize();quat.setFromUnitVectors(axis,pt);dummy.quaternion.copy(quat);dummy.scale.set(s.width,s.length,s.width);dummy.updateMatrix();fountain.setMatrixAt(i,dummy.matrix);fountainLife.setX(i,s.alpha);
  }fountain.instanceMatrix.needsUpdate=true;fountainLife.needsUpdate=true;spMat.opacity=.65*F;
  // Gold/cobalt confetti: back/middle/front layers with an empty actor region.
  const paperGain=(fx.paper?.enabled===false?0:fx.paper?.strength??1),P=envelope(t,10.30,10.64,13.4,20.2)*paperGain;
  for(let i=0;i<paperCount;i++){
   const side=i%2?-1:1,age=t-10.30-.33*hash(i,63),layer=i%10,depth=layer<6?-3.2+hash(i,31)*2.8:layer<9?1+hash(i,31)*3.3:5.4+hash(i,31)*2.0;
   if(age<0||age>11.1||P<.004){hidden(confetti,i);continue;}
   let x=cx+side*(3.6+hash(i,2)*9.2)+Math.sin(i+age*.77)*(.28+age*.12);
   const y=8.6*hash(i,11)+3.2-age*(.37+hash(i,6)*.30)+.26*Math.sin(age*1.8+i);
   if(Math.abs(x-cx)<2.25&&Math.abs(depth-2.7)<3.5&&y<3.8)x=cx+side*2.5;
   const size=P*(.65+hash(i,9)*.85)*(layer>=9?1.8:1.0);
   set(confetti,i,x,y,depth,age*(.9+hash(i,13)),age*(.73+hash(i,15)*.7),age*1.6+i,size);
  }confetti.instanceMatrix.needsUpdate=true;
  const ribbonGain=(fx.ribbon?.enabled===false?0:fx.ribbon?.strength??1),R=envelope(t,10.4,10.9,14.2,19.6)*ribbonGain;
  for(let i=0;i<ribbonsCount;i++){
   const s=sampleSideRibbon(ribbonSeeds[i],t,sideSample);if(s.alpha<.001||R<.005){hidden(ribbons,i);continue;}
   set(ribbons,i,cx+s.x,s.y,s.z,s.rx,s.ry,s.rz,s.size,s.size*s.stretch,s.size);ribbonLife.setX(i,s.alpha*R);
  }ribbons.instanceMatrix.needsUpdate=true;ribbonLife.needsUpdate=true;
  // Horn dissolve is independent from fireworks and moves toward the mouth.
  const dissolve=ease(13.2,14.55,t),D=envelope(t,13.15,13.4,14.15,15.3);
  for(let i=0;i<dustCount;i++){
   if(D<.005){hidden(hornDust,i);continue;}
   const a=hash(i,16)*PI*2,r=hash(i,31)*1.8,loc=(1-dissolve)*r;
   const x=(actorWorld?.x??cx)+.35+loc*1.45+Math.cos(a)*dissolve*.7;
   const y=(actorWorld?.y??0)+Math.sin(a)*(.18+dissolve*.7)+hash(i,44)*.3;
   const z=(actorWorld?.z??1)+Math.sin(a*2)*.45+dissolve*hash(i,19);
   set(hornDust,i,x,y,z,0,a,0,D*(.5+hash(i,29)*1.5));
  }hornDust.instanceMatrix.needsUpdate=true;goldDustMat.opacity=.93*D;
  flashLight.intensity=7*envelope(t,10.37,10.54,10.75,11.18)+3*envelope(t,11.0,11.16,11.5,11.98);
  // Stage-to-game is spatial and gradual, no screenshot/UI page replacement.
  const gameMix=ease(19.75,23.3,t);game.visible=gameMix>.001;game.scale.setScalar(Math.max(.0001,gameMix));game.position.z=2.0*gameMix;upLight.intensity=5.2*gameMix;
  const yaw=Number.isFinite(Number(cubeYaw))?Number(cubeYaw):t*.25+.7,pitch=Number.isFinite(Number(cubePitch))?Number(cubePitch):.15+Math.sin(t*.27)*.17;
  cube.rotation.set(pitch,yaw,Math.sin(t*.22)*.07);
  const front=Math.abs(Math.cos(yaw)*Math.cos(pitch)),readability=ease(.87,.98,front);
  textMat.opacity=.9*readability*gameMix;glassMat.roughness=.42-.24*readability;
  visibleTime=t;prevState={time:t,peak,beams:beams.filter(x=>x.mesh.visible).length,fireworks:FW,fountains:F,confetti:P,ribbons:R,gameMix,dissolve,readability,engine:'THREE_JS_TRUE_3D'};return prevState;
 }
 function dispose(){root.removeFromParent();const geometries=new Set(),materials=new Set();root.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.material)for(const m of Array.isArray(o.material)?o.material:[o.material])materials.add(m);});for(const g of geometries)g.dispose();for(const m of materials)m.dispose();inkTex.dispose();haloTex.dispose();}
 return{root,beams,game,cube,fireworks,fountain,confetti,ribbons,update,dispose,get state(){return prevState}};
}
