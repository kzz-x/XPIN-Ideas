import * as THREE from './vendor/three.module.js';
import {GLTFLoader} from './vendor/GLTFLoader.js';
import {pose} from './animation.mjs';
import {makeDotMaterials,SURFACE_STATUS} from './dot-materials.mjs';
import {makeDotShape,makeDotShapeAsync} from './dot-shape-v4.mjs';
import {makeFiberAtlasAsync} from './dot-fiber-atlas.mjs';
import {yieldBuild} from './cooperative-build.mjs';
import {makeTrumpetV6} from './trumpet-v6.mjs';
import {finishLeatherBeret} from './beret-leather-v7.mjs';

export const DEFAULT_DOT_ASSET=globalThis.DOT_COMPONENT_ASSET||new URL('./assets/dot-character.glb',import.meta.url);
export async function loadDot({asset=DEFAULT_DOT_ASSET,manager,onStage=()=>{}}={}){
  const loadStarted=performance.now();
  const gltf=await new GLTFLoader(manager).loadAsync(String(asset));
  onStage('gltf_load_parse',performance.now()-loadStarted);
  const buildStarted=performance.now();
  const dot=await createDotAsync(gltf.scene);
  onStage('character_construct',performance.now()-buildStarted);
  return dot;
}
export async function createDotAsync(sourceScene,options){
  const source=sourceScene.getObjectByName('DOT_HERO_ROOT');
  if(!source)throw Error('Dot asset is missing DOT_HERO_ROOT');
  const sourceAnchor=source.getObjectByName('MOUTHPIECE_FIXED_ANCHOR'),sourceHorn=source.getObjectByName('TRUMPET_ASSEMBLY');
  if(!sourceAnchor||!sourceHorn)throw Error('Dot asset is missing its mouth/trumpet hierarchy');
  await yieldBuild();
  const atlas=await makeFiberAtlasAsync(options),materials=makeDotMaterials({atlas});
  await yieldBuild();
  sourceScene.updateMatrixWorld(true);
  const mouth=sourceAnchor.getWorldPosition(new THREE.Vector3());mouth.z+=.003;
  const axis=new THREE.Vector3(1,0,0).transformDirection(sourceHorn.matrixWorld);
  const shape=await makeDotShapeAsync(mouth,axis,options);
  await yieldBuild();
  return createDot(sourceScene,{materials,shape});
}
/** Renderer/camera/room/audio/storage-independent character. No internal RAF.
 * root: caller-owned placement; update(t,{events,phrases,...}): absolute time.
 * Only idle and trumpet are implemented. Unsupported states fail explicitly.
 */
export function createDot(sourceScene,prepared={}){
  const source=sourceScene.getObjectByName('DOT_HERO_ROOT');
  if(!source)throw Error('Dot asset is missing DOT_HERO_ROOT');
  sourceScene.updateMatrixWorld(true);
  const sourceAnchor=source.getObjectByName('MOUTHPIECE_FIXED_ANCHOR');
  const sourceHorn=source.getObjectByName('TRUMPET_ASSEMBLY');
  if(!sourceAnchor||!sourceHorn)throw Error('Dot asset is missing its mouth/trumpet hierarchy');
  const sourceMouth=sourceAnchor.getWorldPosition(new THREE.Vector3());
  const mouth=sourceMouth.clone();mouth.z+=.003;
  const axis=new THREE.Vector3(1,0,0).transformDirection(sourceHorn.matrixWorld);
  const root=new THREE.Group();root.name='DotComponent';
  const motion=new THREE.Group();motion.name='Dot / breath reaction';root.add(motion);
  const deform=new THREE.Group();deform.name='Dot / body deformation';motion.add(deform);
  const hats=new THREE.Group();hats.name='Dot / hat follow';deform.add(hats);
  const closedEyes=new THREE.Group();closedEyes.name='Dot / closed eyes';deform.add(closedEyes);
  const openEyes=new THREE.Group();openEyes.name='Dot / idle eyes';deform.add(openEyes);
  const anchor=new THREE.Group();anchor.name='Dot / fixed mouth anchor';motion.add(anchor);
  const horn=new THREE.Group();horn.name='Dot / trumpet';anchor.add(horn);
  const materials=prepared.materials||makeDotMaterials(),morphs=[];
  finishLeatherBeret(materials.hat);
  const shape=prepared.shape||makeDotShape(mouth,axis);
  const originalMaterials=new Set(),originalGeometries=new Set();
  let body;
  const up=new THREE.Vector3(0,axis.z,-axis.y).normalize();
  function hornRest(v,name){
    if(['MOUTHPIECE_CUP','MOUTHPIECE_RIGID'].includes(name))return v;
    const along=v.dot(axis),vertical=v.dot(up);
    v.addScaledVector(axis,-Math.max(0,along-.24)*.08);
    if(/VALVE/.test(name))v.addScaledVector(up,vertical*.12);
    else if(!/BELL|THROAT/.test(name))v.addScaledVector(up,vertical*-.32);
    return v;
  }
  function finishHorn(g,name,material,restFinished=false){
    const p=g.attributes.position,normals=g.attributes.normal,v=new THREE.Vector3(),n=new THREE.Vector3();
    const verticalScale=/VALVE/.test(name)?1.12:/BELL|THROAT/.test(name)?1:.68;
    if(!restFinished)for(let i=0;i<p.count;i++){
      v.fromBufferAttribute(p,i);const axial=v.dot(axis)>.24?.92:1;
      if(normals&&!['MOUTHPIECE_CUP','MOUTHPIECE_RIGID'].includes(name)){
        n.fromBufferAttribute(normals,i);n.addScaledVector(axis,n.dot(axis)*(1/axial-1));n.addScaledVector(up,n.dot(up)*(1/verticalScale-1));n.normalize().toArray(normals.array,i*3);
      }
      hornRest(v,name).toArray(p.array,i*3);
    }
    p.needsUpdate=true;if(normals)normals.needsUpdate=true;else g.computeVertexNormals();
    const mesh=new THREE.Mesh(g,material);mesh.name=name;mesh.castShadow=true;mesh.receiveShadow=true;horn.add(mesh);
    if(!['MOUTHPIECE_CUP','MOUTHPIECE_RIGID'].includes(name)){
      const b=p.array.slice(),bn=g.attributes.normal.array.slice();
      for(let i=0;i<p.count;i++){
        v.fromBufferAttribute(p,i);let u=THREE.MathUtils.clamp((v.dot(axis)-.24)/2.4,0,1);u=u*u*(3-2*u);
        v.addScaledVector(axis,1.35*u);v.toArray(b,i*3);
        const raw=THREE.MathUtils.clamp((new THREE.Vector3().fromBufferAttribute(p,i).dot(axis)-.24)/2.4,0,1),stretch=1+1.35*6*raw*(1-raw)/2.4;
        n.fromBufferAttribute(g.attributes.normal,i);n.addScaledVector(axis,n.dot(axis)*(1/stretch-1));n.normalize().toArray(bn,i*3);
      }
      g.morphAttributes.position=[new THREE.Float32BufferAttribute(b,3)];
      g.morphAttributes.normal=[new THREE.Float32BufferAttribute(bn,3)];mesh.updateMorphTargets();morphs.push(mesh);
    }
    return mesh;
  }
  function mappedMaterial(name){
    return name==='DOT_Blue_MicroVelour'?materials.body:
      name==='DOT_Black_Satin_Beret'?materials.hat:
      name==='DOT_Eyelids'?materials.eyes:
      name==='Trumpet_Silver_Mouthpiece'?materials.silver:
      name==='Trumpet_Inner_Brass'?materials.inner:materials.gold;
  }
  source.traverse(o=>{
    if(!o.isMesh)return;
    originalGeometries.add(o.geometry);
    for(const m of Array.isArray(o.material)?o.material:[o.material])originalMaterials.add(m);
    const isHorn=!!o.parent&&sourceHorn.getObjectById(o.id)!==undefined;
    if(isHorn&&!['MOUTHPIECE_CUP','MOUTHPIECE_RIGID'].includes(o.name))return;
    let g=o.geometry.clone().applyMatrix4(o.matrixWorld);
    if(isHorn)g.translate(-sourceMouth.x,-sourceMouth.y,-sourceMouth.z);
    const m=Array.isArray(o.material)?o.material.map(v=>mappedMaterial(v.name)):mappedMaterial(o.material.name);
    if(isHorn){
      // v006 preserves the exact rigid cup and mouthpiece; other brass parts
      // are rebuilt below in the final mouth-local rest coordinates.
      if(/^VALVE_BUTTON_/.test(o.name)){
        g.computeBoundingBox();const c=g.boundingBox.getCenter(new THREE.Vector3());g.dispose();
        const profile=[[0,-.017],[.052,-.017],[.073,-.012],[.08,-.005],[.08,.007],[.073,.016],[.055,.021],[0,.021]].map(p=>new THREE.Vector2(...p));
        g=new THREE.LatheGeometry(profile,48);g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),up));g.translate(...c.toArray());
      }
      // Turned collar geometry follows the same mouth-anchored morph as its valve.
      if(/^VALVE_\d$/.test(o.name)){
        const p=g.attributes.position,v=new THREE.Vector3();let a0=Infinity,a1=-Infinity,z=0,x=0;
        for(let i=0;i<p.count;i++){v.fromBufferAttribute(p,i);const h=v.dot(up);a0=Math.min(a0,h);a1=Math.max(a1,h);z+=v.dot(axis);x+=v.x;}
        z/=p.count;x/=p.count;
        for(const [j,h]of[a0+.015,(a0+a1)*.5,a1-.015].entries()){
          const ring=new THREE.TorusGeometry(.073,.0065,6,28);
          ring.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,0,1),up));
          const center=axis.clone().multiplyScalar(z).addScaledVector(up,h);center.x=x;ring.translate(...center.toArray());
          finishHorn(ring,'DETAIL_'+o.name+'_COLLAR_'+j,materials.goldDetail);
        }
      }
      finishHorn(g,o.name,m).userData.sourceGeometry=o.geometry.uuid;
    }else{
      const replacement={DOT_BODY:shape.body,DOT_BERET:shape.hat,DOT_BERET_STEM:shape.stem,DOT_CLOSED_EYE_0:shape.nearEye,DOT_CLOSED_EYE_1:shape.farEye}[o.name];
      if(replacement){g.dispose();g=replacement;}
      const mesh=new THREE.Mesh(g,m);mesh.name=o.name;mesh.userData.sourceGeometry=o.geometry.uuid;mesh.castShadow=true;mesh.receiveShadow=true;
      if(o.name.startsWith('DOT_BERET'))hats.add(mesh);
      else if(o.name.startsWith('DOT_CLOSED_EYE'))closedEyes.add(mesh);
      else{deform.add(mesh);if(o.name==='DOT_BODY')body=mesh;}
    }
  });
  for(const part of makeTrumpetV6(axis,up,materials))finishHorn(part.geometry,part.name,part.material,true);
  horn.rotation.x=.028;
  if(!body)throw Error('Dot asset has no body mesh');
  // Five very thin, dense coverage layers suggest short nap without long hairs.
  // Shared with idle/trumpet, no shadows or per-frame allocation, 0.0055 units max.
  const napGeometry=body.geometry.clone();napGeometry.setAttribute('aDotShell',new THREE.InstancedBufferAttribute(new Float32Array([.2,.4,.6,.8,1]),1));
  const nap=new THREE.InstancedMesh(napGeometry,materials.fuzz,5);nap.name='Dot / subpixel velvet nap';nap.receiveShadow=true;nap.frustumCulled=false;
  for(let i=0;i<5;i++)nap.setMatrixAt(i,new THREE.Matrix4());deform.add(nap);
  // Idle eyes derive their positions from the exact preserved eyelid geometry.
  // No second character model is introduced; only its expression is changed.
  for(const lid of closedEyes.children){
    lid.geometry.computeBoundingBox();const center=lid.geometry.boundingBox.getCenter(new THREE.Vector3());
    const eye=new THREE.Mesh(new THREE.SphereGeometry(1,16,12),materials.eyes);
    eye.position.copy(center);eye.position.z+=.012;eye.scale.set(.060,.086,.035);openEyes.add(eye);
  }
  for(const g of originalGeometries)g.dispose();
  for(const m of originalMaterials)m.dispose();
  let state='trumpet',disposed=false;
  function setState(next){if(!['idle','trumpet'].includes(next))throw Error(`Dot state not implemented: ${next}`);state=next;return api;}
  function update(t,{events=[],phrases=[],amount=.09,drift=1,variationEnabled=true,seed=42,hornScale=1,reducedMotion=false}={}){
    if(disposed)throw Error('Cannot update a disposed Dot');
    const p=state==='idle'?pose(0,[],0,[]):pose(t,events,reducedMotion?.012:amount,phrases,{variationEnabled,seed});
    const d=reducedMotion?.15:THREE.MathUtils.clamp(Number.isFinite(drift)?drift:1,0,1.5);
    deform.scale.set(p.sx,p.sy,p.sz);deform.position.set(p.x,p.y,0);deform.rotation.z=p.roll;
    hats.position.y=p.hatY;hats.rotation.z=p.hatRoll;
    motion.position.set(p.driftX*d,p.driftY*d,p.driftZ*d);
    motion.rotation.set(0,.88+p.yaw*d,p.tilt*d);
    deform.updateMatrix();anchor.position.copy(mouth).applyMatrix4(deform.matrix);
    // A rigid cup follows body roll, but never receives the body's nonuniform scale.
    // Trumpet lift is already in the breath-led whole-body pose; do not rotate a
    // rigid mouthpiece through the face for a decorative independent horn wobble.
    anchor.rotation.set(0,0,p.roll);
    const close=state==='trumpet'?(p.breathPhase==='exhale'?.98:Math.min(.9,p.inhale*.65+p.effort*.7)):0;
    closedEyes.visible=close>.65;openEyes.visible=!closedEyes.visible;
    for(const eye of openEyes.children)eye.scale.y=.086*(1-close*.88);
    horn.visible=state==='trumpet';
    const stretch=THREE.MathUtils.clamp(p.hornAmount*(reducedMotion?.15:(Number.isFinite(hornScale)?hornScale:1)),0,.64);
    for(const m of morphs)m.morphTargetInfluences[0]=stretch;
    root.updateMatrixWorld(true);return p;
  }
  function dispose(){if(disposed)return;disposed=true;
    const gs=new Set();root.traverse(o=>{if(o.geometry)gs.add(o.geometry)});
    for(const g of gs)g.dispose();for(const m of Object.values(materials))m.dispose();root.removeFromParent();
  }
  const api={root,motion,deform,hats,closedEyes,openEyes,anchor,horn,body,mouth,axis,morphs,materials,
    update,setState,dispose,get state(){return state},surfaceStatus:SURFACE_STATUS};
  update(0);return api;
}
