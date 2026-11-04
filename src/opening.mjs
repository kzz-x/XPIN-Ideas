import * as T from 'three';
import {outlineShapes,createCharacterFlow} from './opening-characters.mjs';

export const OPENING_TIMING=Object.freeze({morph:4.8,portalRevealStart:3.2,portalRevealDuration:1.6});
const clamp=x=>Math.max(0,Math.min(1,x));
const smooth=x=>{x=clamp(x);return x*x*x*(10+x*(-15+6*x));};
const span=(a,b,x)=>smooth((x-a)/(b-a));
const TITLE='想法先行';

// The host alone owns the clock, canvas, renderer and RAF. The title and all
// travelling glyphs are closed, light-responsive geometric objects.
export async function createOpening({canvas}={}){
  if(!canvas)throw Error('Opening requires the host canvas');
  const scene=new T.Scene();scene.background=new T.Color('#081641');
  const camera=new T.PerspectiveCamera(38,16/9,.1,120);camera.position.set(0,.4,22);camera.lookAt(0,0,0);camera.updateMatrixWorld();
  const [data,asciiData]=await Promise.all(['title-glyphs.json','ascii-outlines.json'].map(async name=>{const r=await fetch(new URL('../assets/type/'+name,import.meta.url));if(!r.ok)throw Error('Missing opening outline '+name);return r.json();}));
  const geometries=[],materials=[],glyphs=[],meshes=[];
  const group=new T.Group();group.name='想法先行 / four individually cast and bevelled bodies';group.rotation.set(.075,-.10,-.012);scene.add(group);
  const ambient=new T.HemisphereLight('#e4efff','#12204b',1.25);scene.add(ambient);
  const key=new T.DirectionalLight('#fff9ed',3.6);key.position.set(-3,5.8,11.5);key.castShadow=true;key.shadow.mapSize.set(1024,1024);Object.assign(key.shadow.camera,{left:-12,right:12,top:7,bottom:-7,near:.5,far:35});key.shadow.bias=-.0002;key.shadow.normalBias=.015;key.shadow.radius=3;key.shadow.intensity=.5;scene.add(key);
  const fill=new T.DirectionalLight('#a5c7ff',1.15);fill.position.set(7,1,5);scene.add(fill);
  const rim=new T.DirectionalLight('#9abaff',2.8);rim.position.set(2,3,-3);scene.add(rim);
  const plateGeometry=new T.PlaneGeometry(70,44,30,20),platePosition=plateGeometry.attributes.position;
  for(let i=0;i<platePosition.count;i++){const x=platePosition.getX(i),y=platePosition.getY(i);platePosition.setZ(i,-.006*x*x+.0025*y*y);}plateGeometry.computeVertexNormals();geometries.push(plateGeometry);
  const plateMaterial=new T.MeshStandardMaterial({color:'#051daa',metalness:.12,roughness:.71});materials.push(plateMaterial);
  plateMaterial.onBeforeCompile=shader=>{
    shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec2 vPanel;').replace('#include <begin_vertex>','#include <begin_vertex>\nvPanel=position.xy;');
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying vec2 vPanel;').replace('#include <color_fragment>',`#include <color_fragment>
      float field=exp(-dot((vPanel-vec2(-4.,3.))*vec2(.065,.09),(vPanel-vec2(-4.,3.))*vec2(.065,.09)));
      float vignette=1.-smoothstep(4.,24.,length(vPanel*vec2(.65,1.)));
      diffuseColor.rgb*=.30+.42*field+.28*vignette;
    `);
  };
  plateMaterial.customProgramCacheKey=()=> 'opening-r02-curved-cobalt';
  const plate=new T.Mesh(plateGeometry,plateMaterial);plate.name='Curved cobalt receiving surface';plate.position.z=-1.5;plate.receiveShadow=true;scene.add(plate);

  function contour(shapes,center,scale,depth){
    const segments=[],weights=[];let length=0;
    for(const shape of shapes)for(const curve of [shape,...shape.holes]){const points=curve.getPoints(3);for(let i=0;i<points.length-1;i++){
      const a=points[i],b=points[i+1],d=a.distanceTo(b);if(d<1e-5)continue;
      segments.push((a.x-center.x)*scale,(a.y-center.y)*scale,depth*.5+.025,(b.x-center.x)*scale,(b.y-center.y)*scale,depth*.5+.025);weights.push(length,length+d);length+=d;
    }}
    const initial=[...segments],frontLength=length;
    for(let i=0;i<initial.length;i+=6){segments.push(initial[i],initial[i+1],-depth*.5,initial[i+3],initial[i+4],-depth*.5);weights.push(frontLength+weights[i/3]*.72,frontLength+weights[i/3+1]*.72);if(i%24===0){segments.push(initial[i],initial[i+1],-depth*.5,initial[i],initial[i+1],depth*.5);weights.push(frontLength*.5+weights[i/3],frontLength*.5+weights[i/3]+depth/scale);}}
    const max=Math.max(...weights),geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(segments,3));geometry.setAttribute('aAlong',new T.Float32BufferAttribute(weights.map(v=>v/max),1));geometries.push(geometry);
    const material=new T.ShaderMaterial({transparent:true,depthWrite:false,uniforms:{reveal:{value:0},opacity:{value:1},hold:{value:0}},vertexShader:'attribute float aAlong;varying float vAlong;void main(){vAlong=aAlong;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:'varying float vAlong;uniform float reveal,opacity,hold;void main(){if(vAlong>reveal)discard;float tip=1.-smoothstep(0.,.04,abs(reveal-vAlong));vec3 color=mix(vec3(.43,.64,1.),vec3(.95,.98,1.),tip*.65+hold*.3);gl_FragColor=vec4(color,opacity*(.65+tip*.35));}'});materials.push(material);return new T.LineSegments(geometry,material);
  }
  function titleMaterial(options,release){
    const material=new T.MeshPhysicalMaterial({...options,transparent:true,opacity:0});materials.push(material);
    material.onBeforeCompile=shader=>{
      shader.uniforms.uOpeningRelease=release;
      shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nuniform float uOpeningRelease;varying vec3 vOriginalTitle;');
      shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
        vOriginalTitle=position;
        float sweep=1.-clamp(.5+position.x*.18+position.y*.12,0.,1.);
        float peel=smoothstep(sweep,sweep+.22,uOpeningRelease);
        transformed.z+=sin(peel*3.14159265)*.18*(position.y+1.7);
        transformed.x+=peel*.065*position.y;
      `);
      shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nuniform float uOpeningRelease;varying vec3 vOriginalTitle;');
      shader.fragmentShader=shader.fragmentShader.replace('#include <clipping_planes_fragment>',`#include <clipping_planes_fragment>
        float sweep=1.-clamp(.5+vOriginalTitle.x*.18+vOriginalTitle.y*.12,0.,1.);
        if(uOpeningRelease>sweep+.23)discard;
      `);
    };material.customProgramCacheKey=()=> 'opening-r02-title-peel';return material;
  }
  const xs=[-5.35,-1.81,1.72,5.23],ys=[.66,.94,.57,.78],zs=[.06,.24,-.12,.10],ry=[-.09,.06,-.035,.105],rz=[-.029,.012,-.018,.022],scales=[1.025,.965,1.015,.985];
  for(let index=0;index<TITLE.length;index++){
    const char=TITLE[index],shapes=outlineShapes(data[char]),depthUnits=24.5,scale=.0328;
    const geometry=new T.ExtrudeGeometry(shapes,{depth:depthUnits,bevelEnabled:true,bevelSegments:3,steps:2,bevelSize:1.05,bevelThickness:1.05,curveSegments:3});geometry.computeBoundingBox();
    const center=geometry.boundingBox.getCenter(new T.Vector3());geometry.translate(-center.x,-center.y,-depthUnits*.5);geometry.scale(scale,scale,scale);geometry.computeBoundingBox();geometries.push(geometry);
    const release={value:-1};
    const cap=titleMaterial({color:'#f5f5f0',metalness:.17,roughness:.27,clearcoat:.34,clearcoatRoughness:.22},release);
    const side=titleMaterial({color:'#8d99ab',metalness:.70,roughness:.28,clearcoat:.14},release);
    const placement=new T.Group();placement.name='Independent title glyph '+char;placement.position.set(xs[index],ys[index],zs[index]);placement.rotation.set(0,ry[index],rz[index]);placement.scale.setScalar(scales[index]);group.add(placement);
    const mesh=new T.Mesh(geometry,[cap,side]);mesh.userData.glyphIndex=index;mesh.name=char+' / front, bevel, side, back';mesh.receiveShadow=true;
    const depthMaterial=new T.MeshDepthMaterial({depthPacking:T.RGBADepthPacking});depthMaterial.onBeforeCompile=cap.onBeforeCompile;depthMaterial.customProgramCacheKey=()=> 'opening-r02-title-peel-depth';mesh.customDepthMaterial=depthMaterial;materials.push(depthMaterial);placement.add(mesh);meshes.push(mesh);
    const stroke=contour(shapes,center,scale,depthUnits*scale);stroke.name=char+' / engineering contour';placement.add(stroke);
    glyphs.push({index,placement,mesh,cap,side,contour:stroke,release,baseY:ry[index],baseZ:rz[index],rotationStart:-100,rotationFrom:ry[index],rotationTo:ry[index]});
  }
  let width=1280,height=720,phase='intro',previousPhase='',lastTime=0,hovered=-1,disposed=false;
  const dimensions=()=>{const worldH=2*Math.tan(T.MathUtils.degToRad(camera.fov/2))*22;return{w:(width<=700?width*.92:Math.min(width*.74,700))/width*worldH*camera.aspect,h:(width<=700?330:360)/height*worldH};};
  const flow=createCharacterFlow({scene,camera,data:asciiData,glyphs,dimensions});
  const raycaster=new T.Raycaster(),pointer=new T.Vector2(99,99),ownerWindow=canvas.ownerDocument.defaultView||window;
  function movePointer(event){if(event.pointerType==='touch')return;const rect=canvas.getBoundingClientRect();pointer.set((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1);}
  ownerWindow.addEventListener('pointermove',movePointer,{passive:true});
  function update({time=0,dt=1/60,phase:nextPhase='intro',phaseTime=time,holdProgress=0}={}){
    if(disposed)return;phase=nextPhase;lastTime=time;
    if(phase!==previousPhase){
      if(phase==='morph')flow.bake();
      if(phase==='intro')for(const glyph of glyphs){glyph.rotationStart=-100;glyph.placement.rotation.set(0,glyph.baseY,glyph.baseZ);}
      previousPhase=phase;
    }
    const intro=phase==='intro',morph=phase==='morph';
    if(intro&&phaseTime>1.6&&holdProgress<.1){scene.updateMatrixWorld(true);raycaster.setFromCamera(pointer,camera);const next=raycaster.intersectObjects(meshes,false)[0]?.object.userData.glyphIndex??-1;if(next!==hovered&&next>=0){const glyph=glyphs[next];if(time-glyph.rotationStart>2.5){glyph.rotationStart=time;glyph.rotationFrom=glyph.placement.rotation.y;glyph.rotationTo=glyph.baseY+Math.PI*2;}}hovered=next;}
    group.visible=intro||(morph&&phaseTime<1.7);
    for(const glyph of glyphs){
      const elapsed=intro?phaseTime:5,fill=span(.68+glyph.index*.12,2.55+glyph.index*.12,elapsed),depth=.015+.985*span(.30+glyph.index*.10,2.82+glyph.index*.10,elapsed);
      glyph.mesh.scale.z=glyph.contour.scale.z=depth;glyph.cap.opacity=glyph.side.opacity=fill;glyph.mesh.castShadow=(intro&&fill>.2)||(morph&&phaseTime<1.7);glyph.release.value=morph?(phaseTime-.12-glyph.index*.13)/.76:-1;
      const u=glyph.contour.material.uniforms;u.reveal.value=span(glyph.index*.15,2.05+glyph.index*.13,elapsed);u.opacity.value=(1-fill*.76)*(morph?1-span(.05,.65,phaseTime):1);u.hold.value=holdProgress;
      glyph.cap.emissive.set('#9bbef0');glyph.cap.emissiveIntensity=holdProgress*.17;
      if(intro&&glyph.rotationStart>-50){const p=smooth((time-glyph.rotationStart)/3.7);glyph.placement.rotation.y=T.MathUtils.lerp(glyph.rotationFrom,glyph.rotationTo,p);glyph.placement.rotation.z=glyph.baseZ+Math.sin(p*Math.PI*2)*.028;if(p===1){glyph.placement.rotation.y=glyph.baseY;glyph.rotationStart=-100;}}
    }
    flow.update({phase,phaseTime,holdProgress});
    const darkness=phase==='black'?1:phase==='launch'?span(2.65,4.35,phaseTime):0;
    scene.background.set('#081641').multiplyScalar(1-darkness);plate.visible=darkness<.9999;plateMaterial.color.set('#051daa').multiplyScalar(1-darkness);
    key.position.set(-3+Math.sin(time*.16)*.8,5.8+Math.cos(time*.13)*.3,11.5);key.intensity=3.6*(1-darkness);fill.intensity=1.15*(1-darkness);rim.intensity=2.8*(1-darkness);ambient.intensity=1.25*(1-darkness);
    return{phase,glyphCount:4,particles:flow.stats.count,source:'closed Chinese and ASCII outline extrusions',hovered};
  }
  function resize(w,h){width=Math.max(1,w);height=Math.max(1,h);camera.aspect=width/height;camera.fov=camera.aspect<1.35?T.MathUtils.radToDeg(2*Math.atan(8.2/(22*camera.aspect))):38;camera.updateProjectionMatrix();}
  resize(canvas.clientWidth||1280,canvas.clientHeight||720);update({phase:'intro',phaseTime:0});
  return{scene,camera,update,resize,glyphs,ascii:flow.root,snapshot:()=>({phase,time:lastTime,...flow.stats,titleDepth:glyphs.map(g=>g.mesh.geometry.boundingBox.max.z-g.mesh.geometry.boundingBox.min.z)}),dispose(){if(disposed)return;disposed=true;ownerWindow.removeEventListener('pointermove',movePointer);flow.dispose();for(const g of new Set(geometries))g.dispose();for(const m of new Set(materials))m.dispose();key.shadow.map?.dispose();scene.clear();}};
}
