import * as T from '../../dot/model/frozen/r07d/editable-stage/素材/v011/DotSharedWeb/vendor/three.module.js';
import {gsap} from '../v011/DotSharedWeb/vendor/gsap/gsap-core.js';

const hash=(i,s=17)=>{let n=(Math.imul(i+1,1664525)+Math.imul(s,1013904223))|0;n^=n>>>16;n=Math.imul(n,0x7feb352d);n^=n>>>15;return(n>>>0)/4294967296;};
const smooth=T.MathUtils.smoothstep;
function roundedOutline(width,depth,r=.42){
 const s=new T.Shape(),x=width/2,y=depth/2;
 s.moveTo(-x+r,-y);s.lineTo(x-r,-y);s.quadraticCurveTo(x,-y,x,-y+r);s.lineTo(x,y-r);s.quadraticCurveTo(x,y,x-r,y);s.lineTo(-x+r,y);s.quadraticCurveTo(-x,y,-x,y-r);s.lineTo(-x,-y+r);s.quadraticCurveTo(-x,-y,-x+r,-y);return s;
}

/** CPU-prepared v016 candidate. No renderer/asset fetch, no actor or camera edits.
 * Architecture is real geometry; two lights retain the previous lighting budget.
 * Beams/pools are bounded world-space approximations, not volumetric ray marching.
 */
export function createStageFinale(stage,layout){
 const root=new T.Group();root.name='Stage design / v016 proscenium candidate';stage.scene.add(root);
 const s=layout.screen,cx=s.x,top=s.y+s.height/2+.12,deckTop=-1.67;
 const dark=new T.Color('#222c3b'),lightDeck=new T.Color('#566273'),wingDark=new T.Color('#171f2b'),wingLight=new T.Color('#647081');
 const deckMaterial=new T.MeshStandardMaterial({color:dark,roughness:.6,metalness:.16});
 const fascia=new T.MeshStandardMaterial({color:'#151d29',roughness:.62,metalness:.24});
 const wingMaterial=new T.MeshStandardMaterial({color:wingDark,roughness:.52,metalness:.28});
 const metal=new T.MeshStandardMaterial({color:'#202a38',roughness:.4,metalness:.7});
 const trim=new T.MeshStandardMaterial({color:'#9f8459',roughness:.35,metalness:.78});
 const warm=new T.MeshBasicMaterial({color:'#b99566',toneMapped:false});
 const cool=new T.MeshBasicMaterial({color:new T.Color('#edcf96').multiplyScalar(1.5),toneMapped:false});
 const lensMaterial=new T.MeshBasicMaterial({color:'#f1d9af',toneMapped:false});
 const add=(geometry,material,name,position,layer=1)=>{const o=new T.Mesh(geometry,material);o.name='Stage design / '+name;o.position.set(...position);o.layers.set(layer);o.receiveShadow=true;root.add(o);return o;};
 const matrix=new T.Matrix4(),quaternion=new T.Quaternion(),scale=new T.Vector3(),euler=new T.Euler(),position=new T.Vector3(),direction=new T.Vector3(),unit=new T.Vector3(),follow=new T.Vector3(),down=new T.Vector3(0,-1,0);
 const instances=(geometry,material,name,transforms,layer=1)=>{const mesh=new T.InstancedMesh(geometry,material,transforms.length);mesh.name='Stage design / '+name;mesh.layers.set(layer);mesh.receiveShadow=true;transforms.forEach((p,i)=>{position.set(...p.position);quaternion.setFromEuler(new T.Euler(...(p.rotation||[0,0,0])));scale.set(...(p.scale||[1,1,1]));matrix.compose(position,quaternion,scale);mesh.setMatrixAt(i,matrix);});root.add(mesh);return mesh;};
 // An integrated apron spanning the screen, rather than a stack of isolated disks.
 for(const [width,depth,bottom,height,material,label] of [[25.8,11.8,-1.97,.12,fascia,'recessed plinth'],[25.4,11.4,-1.85,.145,deckMaterial,'continuous stage apron fascia below live reflection plane']]){
  const g=new T.ExtrudeGeometry(roundedOutline(width,depth),{depth:height,bevelEnabled:true,bevelSegments:1,steps:1,bevelSize:.018,bevelThickness:.012,curveSegments:8});g.rotateX(-Math.PI/2);add(g,material,label,[cx,bottom,0],0);
 }
 const frontPoints=[[-12.68,5.28],[-12.55,5.57],[-12.2,5.69],[0,5.7],[12.2,5.69],[12.55,5.57],[12.68,5.28]].map(([x,z])=>new T.Vector3(cx+x,deckTop-.055,z));
 add(new T.TubeGeometry(new T.CatmullRomCurve3(frontPoints),64,.012,5,false),trim,'continuous champagne apron edge',[0,0,0],0);
 const seams=[];for(let x=-10.8;x<=10.8;x+=2.4)seams.push({position:[cx+x,-1.77,5.715],scale:[.008,.13,.012]});instances(new T.BoxGeometry(1,1,1),fascia,'apron fascia seams',seams,0);
 // Receding side fins and light slits leave the physical 16:9 screen untouched.
 // Every wing ends behind z=.05; the approved left entry passes in front.
 const fins=[],bases=[],slits=[];for(const sign of[-1,1])for(let depth=0;depth<3;depth++){
  const x=cx+sign*(s.width/2+.5+depth*.88),z=s.z+.4+depth*1.75,height=top-deckTop-.12;
  fins.push({position:[x,deckTop+height/2,z],rotation:[0,-sign*.1,0],scale:[.56,height,1.15]});
  bases.push({position:[x,-1.58,z],scale:[.83,.18,1.38]});
  slits.push({position:[x-sign*.285,deckTop+height/2,z+.48],scale:[.027,height*.86,.04]});
 }
 const wingMesh=instances(new T.BoxGeometry(1,1,1),wingMaterial,'receding side-wing blades',fins);
 instances(new T.BoxGeometry(1,1,1),metal,'wing feet',bases);instances(new T.BoxGeometry(1,1,1),warm,'recessed wing light slits',slits);
 // Twin rails and alternating cross braces make the suspension legible.
 const rails=[],webs=[],pillars=[],sideCross=[];const half=s.width/2+1.4;
 for(const z of[s.z+.9,4.6]){
  rails.push({position:[cx,top-.02,z],scale:[half*2,.085,.085]},{position:[cx,top-.38,z],scale:[half*2,.085,.085]});
  for(let x=-half+.2,i=0;x<half-.4;x+=.95,i++)webs.push({position:[cx+x+.35,top-.2,z],rotation:[0,0,(i%2?1:-1)*.46],scale:[.8,.035,.035]});
 }
 for(const sign of[-1,1]){
  pillars.push({position:[cx+sign*half,(top+deckTop)/2,s.z+.8],scale:[.075,top-deckTop,.075]});
  sideCross.push({position:[cx+sign*half,top-.2,(s.z+.8+4.6)/2],scale:[.065,.065,4.6-s.z-.8]});
 }
 instances(new T.BoxGeometry(1,1,1),metal,'lighting bridge rails',rails);instances(new T.BoxGeometry(1,1,1),metal,'truss diagonal web',webs);instances(new T.BoxGeometry(1,1,1),metal,'rear truss uprights',pillars);instances(new T.BoxGeometry(1,1,1),metal,'side suspension rails',sideCross);
 // Discrete floor practicals provide near-view stage context without more lights.
 const housings=[],lenses=[];for(const sign of[-1,1])for(const k of[0,1,2]){housings.push({position:[cx+sign*(2.8+k*3.1),-1.628,.1-k*.72],rotation:[-.2,0,sign*.12],scale:[.34,.07,.18]});lenses.push({position:[cx+sign*(2.8+k*3.1),-1.585,.1-k*.72],scale:[.25,.008,.085]});}
 instances(new T.BoxGeometry(1,1,1),metal,'six low stage practical housings',housings,0);instances(new T.BoxGeometry(1,1,1),cool,'six controlled practical lenses',lenses,0);
 const lights=[],fixtures=[],suspensions=[],cones=[],pools=[];
 const coneGeometry=new T.CylinderGeometry(.025,1,1,24,1,true);coneGeometry.translate(0,-.5,0);
 const beamMaterial=new T.MeshBasicMaterial({color:'#d8e6f3',transparent:true,opacity:0,depthWrite:false,side:T.DoubleSide,blending:T.AdditiveBlending,toneMapped:false});
 const poolGeometry=new T.PlaneGeometry(2,2);poolGeometry.rotateX(-Math.PI/2);
 for(const sign of[-1,1]){
  const light=new T.SpotLight(sign<0?0xffeed6:0xe2eeff,0,40,.24,.75,2);light.name='Stage design / following spotlight '+sign;light.castShadow=false;light.layers.enable(1);root.add(light,light.target);lights.push(light);
  const fixture=add(new T.CylinderGeometry(.18,.23,.5,16),metal,'gimballed follow fixture '+sign,[0,0,0]);fixtures.push(fixture);
  const face=new T.Mesh(new T.CircleGeometry(.16,20),lensMaterial);face.layers.set(1);face.position.set(0,-.255,0);face.rotation.x=Math.PI/2;fixture.add(face);
  const yoke=new T.Mesh(new T.TorusGeometry(.29,.025,6,12,Math.PI),metal);yoke.layers.set(1);yoke.rotation.x=Math.PI/2;fixture.add(yoke);
  const suspension=add(new T.CylinderGeometry(.025,.025,1,6),metal,'rigid follow suspension '+sign,[0,0,0]);suspensions.push(suspension);
  const cone=new T.Mesh(coneGeometry,beamMaterial);cone.name='Stage design / background-only beam '+sign;cone.layers.set(1);cone.visible=false;root.add(cone);cones.push(cone);
  const poolMaterial=new T.ShaderMaterial({transparent:true,depthWrite:false,toneMapped:false,blending:T.AdditiveBlending,uniforms:{uColor:{value:new T.Color(sign<0?'#f1d3a1':'#aec9e3')},uStrength:{value:0}},vertexShader:'varying vec2 vPoolUv;void main(){vPoolUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:'varying vec2 vPoolUv;uniform vec3 uColor;uniform float uStrength;void main(){float r=length(vPoolUv-.5)*2.;float edge=1.-smoothstep(.15,1.,r);gl_FragColor=vec4(uColor,edge*edge*uStrength);}' });
  const pool=add(poolGeometry,poolMaterial,'world-space soft follow footprint '+sign,[0,deckTop+.02,0],0);pools.push(pool);
 }
 const centrePool=pools[0].clone();centrePool.material=pools[0].material.clone();centrePool.material.uniforms.uColor.value.set('#dce7f1');centrePool.name='Stage design / single overhead follow footprint';root.add(centrePool);
 const flash=new T.PointLight(0xffe5c0,0,25,2);flash.name='Stage design / background fixture flash';flash.layers.set(1);flash.position.set(0,5,-2);root.add(flash);
 const paper=new T.InstancedMesh(new T.PlaneGeometry(.08,.12),new T.MeshBasicMaterial({color:'#ffffff',side:T.DoubleSide,toneMapped:false}),96);
 const ribbonGeometry=new T.BufferGeometry(),vertices=[],indices=[];
 for(let i=0;i<=12;i++){const y=(i/12-.5)*.64,x=Math.sin(i*.65)*.045,z=Math.cos(i*.65)*.035;vertices.push(x-.022,y,z,x+.022,y,z);if(i<12){const k=i*2;indices.push(k,k+1,k+2,k+1,k+3,k+2);}}
 ribbonGeometry.setAttribute('position',new T.Float32BufferAttribute(vertices,3));ribbonGeometry.setIndex(indices);ribbonGeometry.computeVertexNormals();
 const ribbon=new T.InstancedMesh(ribbonGeometry,new T.MeshBasicMaterial({color:'#ffffff',side:T.DoubleSide,toneMapped:false}),16);
 const burst=new T.InstancedMesh(new T.OctahedronGeometry(.035),new T.MeshBasicMaterial({color:'#ffffff',toneMapped:false}),64);
 const effects={paper,ribbon,burst},palette=['#b6843d','#829ab5','#d3aa68','#667f9d','#c4a580'],pale=new T.Color('#ddd6c9'),colors=palette.map(c=>new T.Color(c)),color=new T.Color();
 for(const[kind,mesh]of Object.entries(effects)){mesh.name='Stage design / '+kind;mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);mesh.frustumCulled=false;mesh.visible=false;root.add(mesh);for(let i=0;i<mesh.instanceMatrix.count;i++)mesh.setColorAt(i,colors[i%colors.length]);}
 const timeline=gsap.timeline({paused:true});let states={},signature='',disposed=false,lastSignature='',lastContrast=-1;
 function configure(settings){const next=JSON.stringify(settings.effects);if(next===signature)return;signature=next;timeline.clear();states={};for(const[kind,cue]of Object.entries(settings.effects)){const state={progress:0,weight:0};states[kind]=state;timeline.fromTo(state,{progress:0},{progress:1,duration:cue.duration,ease:'none',immediateRender:false},cue.start);if(kind==='flash'){timeline.fromTo(state,{weight:0},{weight:1,duration:cue.duration*.25,ease:'power2.out',immediateRender:false},cue.start);timeline.to(state,{weight:0,duration:cue.duration*.75,ease:'sine.inOut'},cue.start+cue.duration*.25);}}gsap.ticker.sleep();}
 function update(time,settings,{target=[0,0,0],whiteMix=0}={}){
  if(disposed)throw Error('舞台资源已经释放');configure(settings);timeline.seek(Math.max(0,time),true);gsap.ticker.sleep();root.visible=settings.enabled;follow.set(...target);
  const contrast=settings.architectureContrast??.78,particleContrast=settings.particleContrast??.82,particleSize=settings.particleSize??1,fade=smooth(time,1.35,2.15);
  deckMaterial.color.copy(lightDeck).lerp(dark,contrast);wingMaterial.color.copy(wingLight).lerp(wingDark,contrast);
  if(particleContrast!==lastContrast){for(const mesh of Object.values(effects)){for(let i=0;i<mesh.instanceMatrix.count;i++){color.copy(pale).lerp(colors[i%colors.length],particleContrast);mesh.setColorAt(i,color);}mesh.instanceColor.needsUpdate=true;}lastContrast=particleContrast;}
  const footprints=[];
  for(let i=0;i<2;i++){
   const sign=i?1:-1;position.set(sign*settings.lightSpread,settings.lightHeight,4.6);lights[i].position.copy(position);lights[i].target.position.copy(follow);lights[i].target.updateMatrixWorld();lights[i].intensity=settings.enabled&&settings.spotsEnabled?18*settings.spotStrength*fade:0;
   direction.copy(follow).sub(position);quaternion.setFromUnitVectors(down,unit.copy(direction).normalize());fixtures[i].position.copy(position);fixtures[i].quaternion.copy(quaternion);suspensions[i].position.set(position.x,(top+position.y)/2,position.z);suspensions[i].scale.set(1,Math.max(.1,top-position.y),1);
   const t=(deckTop-position.y)/Math.min(-.001,direction.y),hit=position.clone().addScaledVector(direction,t),length=position.distanceTo(hit),radius=Math.tan(.24)*length;
   cones[i].position.copy(position);cones[i].quaternion.copy(quaternion);cones[i].scale.set(radius,length,radius);cones[i].visible=settings.enabled&&settings.spotsEnabled&&settings.beamStrength>0&&fade>0;
   pools[i].position.set(hit.x,deckTop+.02,hit.z);pools[i].scale.set(radius,radius,Math.min(radius*1.8,radius/Math.max(.45,Math.abs(unit.y))));pools[i].material.uniforms.uStrength.value=lights[i].intensity>0?.12*settings.spotStrength*fade:0;pools[i].visible=settings.enabled&&settings.spotsEnabled&&Math.abs(hit.x-cx)<12.1&&Math.abs(hit.z)<5.1;footprints.push(hit.toArray());
  }
  centrePool.position.set(follow.x,deckTop+.024,follow.z);centrePool.scale.set(1.5,1,1.12);centrePool.material.uniforms.uStrength.value=settings.enabled&&settings.spotsEnabled?.23*settings.spotStrength*fade:0;centrePool.visible=settings.enabled&&settings.spotsEnabled;
  beamMaterial.opacity=settings.beamStrength*.12*fade;lensMaterial.color.set(settings.spotsEnabled?'#f1d9af':'#536273');
  const active={},live={},bands={back:0,middle:0,front:0};
  for(const[kind,mesh]of Object.entries(effects)){
   const cue=settings.effects[kind],elapsed=states[kind].progress*cue.duration;active[kind]=settings.enabled&&cue.enabled&&time>=cue.start&&time<cue.start+cue.duration&&cue.strength>0;mesh.visible=active[kind];live[kind]=0;if(!mesh.visible)continue;mesh.count=Math.floor(mesh.instanceMatrix.count*cue.strength);
   for(let i=0;i<mesh.count;i++){
    const sign=i%2?1:-1,u=hash(i,23),v=hash(i,37),band=i%10<7?'back':i%10<9?'middle':'front';
    // Two unequal release waves, not an evenly spaced rain curtain.
    const delay=kind==='burst'?hash(i,81)*.12:(i%5<3?Math.pow(u,1.6)*.17:.25+Math.pow(v,1.3)*.18)*cue.duration;
    const age=elapsed-delay,life=age/(cue.duration-delay);
    if(life<0||life>1){matrix.makeScale(0,0,0);mesh.setMatrixAt(i,matrix);continue;}
    if(kind==='burst'){const speed=3.6+v*1.4;position.set(cx+sign*(3.7-(.8+u*.65)*age),-1.45+speed*age-2.8*age*age,1.4+hash(i,57)*.8);}
    else{
     const depth=band==='back'?-2.8+hash(i,57)*1.4:band==='middle'?.1+hash(i,57)*1.25:2.4+hash(i,57)*.5;
     const fall=kind==='ribbon'?.65:.75,span=band==='front'?2.4+u*.8:kind==='ribbon'?1.8+u*.9:.6+u*3,spawn=kind==='ribbon'?2.7+v*.9:4.2+v*1.8;position.set(cx+sign*span+sign*.12*age,spawn-.35*age-fall*age*age,kind==='ribbon'?-2+hash(i,57)*.8:depth);
     // Keep the clear face/mouth volume open by changing the 3D trajectory.
     if(band==='front'&&position.y<follow.y+1.35&&position.y>follow.y-1.2&&Math.abs(position.x-follow.x)<1.55)position.x=follow.x+sign*1.55;
    }
    euler.set(u*6+age*(kind==='ribbon'?1.8:4.1),v*6+age*2.1,hash(i,91)*6+age*sign*2.4);quaternion.setFromEuler(euler);
    const endSize=1-smooth(life,.84,1),birth=smooth(life,0,.045),size=particleSize*(.7+hash(i,101)*.65)*birth*endSize;
    scale.setScalar(position.y<deckTop+.03?0:size);matrix.compose(position,quaternion,scale);mesh.setMatrixAt(i,matrix);if(scale.x>0){live[kind]++;if(kind!=='burst')bands[band]++;}
   }mesh.instanceMatrix.needsUpdate=true;
  }
  const cue=settings.effects.flash;active.flash=settings.enabled&&cue.enabled&&time>=cue.start&&time<cue.start+cue.duration;flash.intensity=active.flash?states.flash.weight*cue.strength*18:0;
  const dirty=[time,settings.enabled,settings.spotStrength,settings.beamStrength,settings.lightSpread,settings.lightHeight,contrast,particleContrast,...target,whiteMix,signature].join(':');if(dirty!==lastSignature){stage.backdrop.invalidate();lastSignature=dirty;}
  return{time,active,spotIntensities:lights.map(l=>l.intensity),followTarget:follow.toArray(),followFootprints:footprints,flashIntensity:flash.intensity,liveInstanceCounts:live,particleDepthBands:bands,maxInstances:176,newShadowMaps:0,volumetricRayMarch:false,designStatus:'V017_EVIDENCE_LED_STAGE_CORRECTION_NOT_YET_RENDERED'};
 }
 return{root,lights,effects,pools,wingMesh,update,gsapVersion:gsap.version,budget:{paper:96,ribbon:16,burst:64,additionalSpotlights:2,newShadowMaps:0},dispose(){if(disposed)return;disposed=true;timeline.kill();root.removeFromParent();const gs=new Set(),ms=new Set();root.traverse(o=>{if(o.geometry)gs.add(o.geometry);if(o.material)ms.add(o.material);});for(const g of gs)g.dispose();for(const m of ms)m.dispose();for(const l of lights)l.dispose();flash.dispose();gsap.ticker.sleep();}};
}
