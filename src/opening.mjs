import * as T from 'three';
import {outlineShapes,createCharacterFlow} from './opening-characters.mjs';

export const OPENING_TIMING=Object.freeze({morph:4.8,portalRevealStart:3.2,portalRevealDuration:1.6});
const clamp=x=>Math.max(0,Math.min(1,x));
const smooth=x=>{x=clamp(x);return x*x*x*(10+x*(-15+6*x));};
const span=(a,b,x)=>smooth((x-a)/(b-a));
const TITLE='想法先行',BACKGROUND='#08142f';

// The host owns the clock and renderer. The drawing, shallow closed bodies and
// travelling character geometry all use the same absolute phase time.
export async function createOpening({canvas}={}){
  if(!canvas)throw Error('Opening requires the host canvas');
  const scene=new T.Scene();scene.background=new T.Color(BACKGROUND);
  const camera=new T.PerspectiveCamera(38,16/9,.1,120);camera.position.set(0,.4,22);camera.lookAt(0,0,0);camera.updateMatrixWorld();
  const [data,asciiData]=await Promise.all(['title-glyphs.json','ascii-outlines.json'].map(async name=>{const r=await fetch(new URL('../assets/type/'+name,import.meta.url));if(!r.ok)throw Error('Missing opening outline '+name);return r.json();}));
  const geometries=[],materials=[],glyphs=[],meshes=[];
  const group=new T.Group();group.name='想法先行 / shallow engineering outlines';group.rotation.set(.018,-.025,0);scene.add(group);
  const ambient=new T.HemisphereLight('#e8f2ff','#182843',2.1);scene.add(ambient);
  const key=new T.DirectionalLight('#f5f5f0',1.05);key.position.set(-3,6,12);scene.add(key);
  const fillLight=new T.DirectionalLight('#aac9ed',.35);fillLight.position.set(5,0,8);scene.add(fillLight);

  function contour(shapes,center,scale,depth,release){
    const segments=[],weights=[];let length=0;
    for(const shape of shapes)for(const curve of [shape,...shape.holes]){const points=curve.getPoints(3);for(let i=0;i<points.length-1;i++){
      const a=points[i],b=points[i+1],d=a.distanceTo(b);if(d<1e-5)continue;
      segments.push((a.x-center.x)*scale,(a.y-center.y)*scale,depth*.5+.008,(b.x-center.x)*scale,(b.y-center.y)*scale,depth*.5+.008);weights.push(length,length+d);length+=d;
    }}
    // A restrained rear contour and a few connecting edges retain honest depth.
    const front=[...segments],frontWeights=[...weights],frontLength=length;
    for(let i=0;i<front.length;i+=6){segments.push(front[i],front[i+1],-depth*.5,front[i+3],front[i+4],-depth*.5);weights.push(frontLength+frontWeights[i/3]*.72,frontLength+frontWeights[i/3+1]*.72);if(i%60===0){segments.push(front[i],front[i+1],-depth*.5,front[i],front[i+1],depth*.5);weights.push(frontLength*.5+frontWeights[i/3],frontLength*.5+frontWeights[i/3]+depth/scale);}}
    const max=Math.max(...weights),geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(segments,3));geometry.setAttribute('aAlong',new T.Float32BufferAttribute(weights.map(v=>v/max),1));geometries.push(geometry);
    const material=new T.ShaderMaterial({transparent:true,depthWrite:false,uniforms:{reveal:{value:0},opacity:{value:1},hold:{value:0},release,tint:{value:new T.Color('#d7e5ed')}},vertexShader:`attribute float aAlong;varying float vAlong;varying float vScan;varying float vDepth;void main(){vAlong=aAlong;vScan=clamp(.5-position.y/3.3,0.,1.);vDepth=position.z;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,fragmentShader:`varying float vAlong;varying float vScan;varying float vDepth;uniform float reveal,opacity,hold,release;uniform vec3 tint;void main(){if(vAlong>reveal||release>vScan+.12)discard;float tip=1.-smoothstep(0.,.025,abs(reveal-vAlong));float scan=1.-smoothstep(.0,.035,abs(release-vScan));vec3 color=mix(tint,vec3(.96,.98,1.),min(.7,tip*.4+hold*.35+scan*.45));gl_FragColor=vec4(color,opacity*(vDepth<0.?.25:1.)*(.76+tip*.24));
#include <tonemapping_fragment>
#include <colorspace_fragment>
}`});materials.push(material);return new T.LineSegments(geometry,material);
  }
  function titleMaterial(options,release){
    const material=new T.MeshStandardMaterial({...options,metalness:0,roughness:.92,transparent:true,opacity:0,depthWrite:false});materials.push(material);
    material.onBeforeCompile=shader=>{
      shader.uniforms.uOpeningRelease=release;
      shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nuniform float uOpeningRelease;varying float vTitleScan;');
      shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
        vTitleScan=clamp(.5-position.y/3.3,0.,1.);
        float peel=smoothstep(vTitleScan,vTitleScan+.12,uOpeningRelease);
        transformed.z+=sin(peel*3.14159265)*.045;
        transformed.x+=peel*.025*position.y;
      `);
      shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nuniform float uOpeningRelease;varying float vTitleScan;');
      shader.fragmentShader=shader.fragmentShader.replace('#include <clipping_planes_fragment>',`#include <clipping_planes_fragment>
        if(uOpeningRelease>vTitleScan+.12)discard;
      `);
    };material.customProgramCacheKey=()=> 'opening-r03-title-scan';return material;
  }
  for(let index=0;index<TITLE.length;index++){
    const char=TITLE[index],shapes=outlineShapes(data[char]),depthUnits=5.5,scale=.0328;
    const geometry=new T.ExtrudeGeometry(shapes,{depth:depthUnits,bevelEnabled:false,steps:1,curveSegments:3});geometry.computeBoundingBox();
    const center=geometry.boundingBox.getCenter(new T.Vector3());geometry.translate(-center.x,-center.y,-depthUnits*.5);geometry.scale(scale,scale,scale);geometry.computeBoundingBox();geometries.push(geometry);
    const release={value:-1};
    const cap=titleMaterial({color:'#edf1ec'},release),side=titleMaterial({color:'#7895b9'},release);
    const placement=new T.Group();placement.name='Title glyph '+char;placement.position.set((index-1.5)*3.52,.68,0);group.add(placement);
    const mesh=new T.Mesh(geometry,[cap,side]);mesh.userData.glyphIndex=index;mesh.name=char+' / shallow front, sides and back';placement.add(mesh);meshes.push(mesh);
    const stroke=contour(shapes,center,scale,depthUnits*scale,release);stroke.name=char+' / engineering contour';placement.add(stroke);
    glyphs.push({index,placement,mesh,cap,side,contour:stroke,release,hover:0});
  }
  let width=1280,height=720,phase='intro',previousPhase='',lastTime=0,hovered=-1,disposed=false;
  const dimensions=()=>{const worldH=2*Math.tan(T.MathUtils.degToRad(camera.fov/2))*22;return{w:(width<=700?width*.92:Math.min(width*.74,700))/width*worldH*camera.aspect,h:(width<=700?330:360)/height*worldH};};
  const flow=createCharacterFlow({scene,camera,data:asciiData,glyphs,dimensions});
  const raycaster=new T.Raycaster(),pointer=new T.Vector2(99,99),ownerWindow=canvas.ownerDocument.defaultView||window;
  function movePointer(event){if(event.pointerType==='touch')return;const rect=canvas.getBoundingClientRect();pointer.set((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1);}
  ownerWindow.addEventListener('pointermove',movePointer,{passive:true});
  function update({time=0,dt=1/60,phase:nextPhase='intro',phaseTime=time,holdProgress=0}={}){
    if(disposed)return;phase=nextPhase;lastTime=time;
    if(phase!==previousPhase){if(phase==='morph')flow.bake();if(phase==='intro')for(const glyph of glyphs){glyph.hover=0;glyph.placement.rotation.set(0,0,0);}previousPhase=phase;}
    const intro=phase==='intro',morph=phase==='morph';
    hovered=-1;
    if(intro&&phaseTime>1.6&&holdProgress<.1){scene.updateMatrixWorld(true);raycaster.setFromCamera(pointer,camera);hovered=raycaster.intersectObjects(meshes,false)[0]?.object.userData.glyphIndex??-1;}
    group.visible=intro||(morph&&phaseTime<1.65);
    for(const glyph of glyphs){
      const elapsed=intro?phaseTime:5,face=span(.8+glyph.index*.10,2.9+glyph.index*.08,elapsed),depth=.02+.98*span(.30+glyph.index*.10,2.8+glyph.index*.08,elapsed);
      glyph.mesh.scale.z=glyph.contour.scale.z=depth;glyph.cap.opacity=face*(.33+holdProgress*.045);glyph.side.opacity=face*.12;glyph.release.value=morph?(phaseTime-.12-glyph.index*.035)/1.12:-1;
      const u=glyph.contour.material.uniforms;u.reveal.value=span(glyph.index*.13,2.1+glyph.index*.11,elapsed);u.opacity.value=.8+holdProgress*.2;u.hold.value=holdProgress;
      if(intro){glyph.hover=T.MathUtils.damp(glyph.hover,hovered===glyph.index?1:0,7,Math.min(.1,Math.max(0,dt)));glyph.placement.rotation.y=glyph.hover*.045;glyph.placement.rotation.x=-glyph.hover*.012;u.opacity.value+=glyph.hover*.12;}
    }
    flow.update({phase,phaseTime,holdProgress});
    const darkness=phase==='black'?1:phase==='launch'?span(2.65,4.35,phaseTime):0;
    scene.background.set(BACKGROUND).multiplyScalar(1-darkness);key.intensity=1.05*(1-darkness);fillLight.intensity=.35*(1-darkness);ambient.intensity=2.1*(1-darkness);
    return{phase,glyphCount:4,particles:flow.stats.count,source:'shallow Chinese outlines and monospaced scan geometry',hovered};
  }
  function resize(w,h){width=Math.max(1,w);height=Math.max(1,h);camera.aspect=width/height;camera.fov=camera.aspect<1.35?T.MathUtils.radToDeg(2*Math.atan(8.2/(22*camera.aspect))):38;camera.updateProjectionMatrix();}
  resize(canvas.clientWidth||1280,canvas.clientHeight||720);update({phase:'intro',phaseTime:0});
  return{scene,camera,update,resize,glyphs,ascii:flow.root,snapshot:()=>({phase,time:lastTime,...flow.stats,background:BACKGROUND,shadow:false,titleDepth:glyphs.map(g=>g.mesh.geometry.boundingBox.max.z-g.mesh.geometry.boundingBox.min.z),maxHoverRadians:.045}),dispose(){if(disposed)return;disposed=true;ownerWindow.removeEventListener('pointermove',movePointer);flow.dispose();for(const g of new Set(geometries))g.dispose();for(const m of new Set(materials))m.dispose();scene.clear();}};
}
