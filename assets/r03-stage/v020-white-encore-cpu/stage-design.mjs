import * as T from '../../dot/model/frozen/r07d/editable-stage/素材/v011/DotSharedWeb/vendor/three.module.js';
import {createStageFinale as createLegacyFinale} from './legacy-finale.mjs';
import {createEncoreCues} from './encore-cues.mjs';

// V019 direction implemented as a separate CPU candidate. No new lights or
// reflection passes. Actor/camera/mouth/note sources remain locked to v018.
export function createStageFinale(stage,layout){
 const legacy=createLegacyFinale(stage,layout),root=new T.Group();root.name='White Encore / curved proscenium CPU candidate';stage.scene.add(root);
 const s=layout.screen,cx=s.x,deckTop=-1.67,top=s.y+s.height/2;
 const originalBridge=[];stage.scene.traverse(o=>{if(o.isMesh&&o.name.startsWith('Bridge /')&&o!==stage.floor&&o!==stage.screen)originalBridge.push([o,o.visible]);});
 const keep=new Set(Object.values(legacy.effects));
 // Reuse existing fixture housings, their children, spot targets and optional
 // celebration system; replace the box fins, truss and separate oval pools.
 legacy.root.traverse(o=>{if(o.isMesh&&(o.name.includes('gimballed follow fixture')||o.name.includes('rigid follow suspension')))o.traverse(child=>keep.add(child));});
 const hidden=[];legacy.root.traverse(o=>{if(o.isMesh&&!keep.has(o))hidden.push(o);});
 const shell=new T.MeshStandardMaterial({color:'#202b3b',metalness:.24,roughness:.49,emissive:'#111b2c',emissiveIntensity:.03});
 const inner=new T.MeshStandardMaterial({color:'#536273',metalness:.3,roughness:.43,emissive:'#1a2b43',emissiveIntensity:.05});
 const fascia=new T.MeshStandardMaterial({color:'#1b2532',metalness:.38,roughness:.45});
 const wall=new T.MeshStandardMaterial({color:'#080d16',roughness:.8,metalness:.08});
 const trim=new T.MeshStandardMaterial({color:'#9c825e',metalness:.72,roughness:.36,emissive:'#c69b5c',emissiveIntensity:.04});
 const cove=new T.MeshBasicMaterial({color:'#f4dbb2',toneMapped:false});
 const meshes=[],collisionShells=[];
 const add=(g,m,name,position=[0,0,0],layer=1)=>{const mesh=new T.Mesh(g,m);mesh.name='White Encore / '+name;mesh.position.set(...position);mesh.layers.set(layer);mesh.receiveShadow=true;root.add(mesh);meshes.push(mesh);return mesh;};
 // Smooth closed, constant-thickness quarter-ellipse shells. Normals are
 // analytic; caps have their own normals, avoiding faceted broad highlights.
 function curvedWing(sign,width,depth,z0,height,material,edge,name){
  const positions=[],normals=[],N=64,thickness=.1,y0=deckTop;
  const profile=i=>{const q=i/N*Math.PI/2,n=new T.Vector3(-sign*depth*Math.cos(q),0,width*Math.sin(q)).normalize(),p=new T.Vector3(edge+sign*width*(1-Math.cos(q)),y0,z0+depth*Math.sin(q));return {p,n};};
  const triangle=(a,b,c,na,nb,nc)=>{if(new T.Vector3().subVectors(b,a).cross(new T.Vector3().subVectors(c,a)).dot(na.clone().add(nb).add(nc))<0){[b,c]=[c,b];[nb,nc]=[nc,nb];}for(const[p,n]of[[a,na],[b,nb],[c,nc]]){positions.push(...p.toArray());normals.push(...n.toArray());}};
  const quad=(a,b,c,d,na,nb,nc,nd)=>{triangle(a,b,c,na,nb,nc);triangle(a,c,d,na,nc,nd);};
  for(let i=0;i<N;i++){
   const A=profile(i),B=profile(i+1),at=A.p.clone().add(new T.Vector3(0,height,0)),bt=B.p.clone().add(new T.Vector3(0,height,0));
   const ab=A.p.clone().addScaledVector(A.n,-thickness),bb=B.p.clone().addScaledVector(B.n,-thickness),abt=ab.clone().add(new T.Vector3(0,height,0)),bbt=bb.clone().add(new T.Vector3(0,height,0));
   quad(A.p,B.p,bt,at,A.n,B.n,B.n,A.n);quad(ab,abt,bbt,bb,A.n.clone().negate(),A.n.clone().negate(),B.n.clone().negate(),B.n.clone().negate());
   const up=new T.Vector3(0,1,0),down=up.clone().negate();quad(at,bt,bbt,abt,up,up,up,up);quad(A.p,ab,bb,B.p,down,down,down,down);
  }
  for(const i of[0,N]){const A=profile(i),p=A.p,q=p.clone().addScaledVector(A.n,-thickness),pt=p.clone().add(new T.Vector3(0,height,0)),qt=q.clone().add(new T.Vector3(0,height,0));const n=i===0?new T.Vector3(0,0,-1):new T.Vector3(sign,0,0);quad(p,pt,qt,q,n,n,n,n);}
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setAttribute('normal',new T.Float32BufferAttribute(normals,3));g.computeBoundingBox();g.computeBoundingSphere();const mesh=add(g,material,name);collisionShells.push(mesh);return mesh;
 }
 const edge=s.width/2+.14;
 for(const sign of[-1,1]){
  curvedWing(sign,1.12,1.6,s.z+.04,top-deckTop+.6,shell,cx+sign*edge,'outer curved wing '+sign);
  curvedWing(sign,.6,.92,s.z+.14,top-deckTop+.18,inner,cx+sign*(edge+.07),'inner curved return '+sign);
  // Thin recessed cove, not a luminous architectural slab.
  add(new T.CylinderGeometry(.011,.011,top-deckTop-.15,8),cove,'warm vertical cove '+sign,[cx+sign*(edge+.13),(top+deckTop)/2-.075,s.z+.23]);
 }
 // Shallow continuous arch; the screen is never intersected by the canopy.
 const arch=new T.Shape(),half=edge+1.12,base=top+.2;
 arch.moveTo(-half,base);arch.quadraticCurveTo(0,base+.85,half,base);arch.lineTo(half,base+.28);arch.quadraticCurveTo(0,base+1.13,-half,base+.28);arch.closePath();
 const canopy=add(new T.ExtrudeGeometry(arch,{depth:.64,bevelEnabled:true,bevelSegments:3,bevelSize:.025,bevelThickness:.025,curveSegments:48}),shell,'shallow arched canopy',[cx,0,s.z-.12]);
 const archPoints=[];for(let i=0;i<=64;i++){const u=i/64,x=(u*2-1)*half,y=base+1.7*u*(1-u);archPoints.push(new T.Vector3(cx+x,y-.04,s.z+.57));}
 add(new T.TubeGeometry(new T.CatmullRomCurve3(archPoints),96,.012,6,false),trim,'canopy champagne cove');
 add(new T.BoxGeometry(s.width+4.6,top-deckTop+2,.18),wall,'recessed dark rear wall',[cx,(top+deckTop)/2+.5,s.z-.45]);
 // One continuous reflective top, with a finite apron underneath.
 const floor=stage.floor,oldGeometry=floor.geometry;floor.geometry=new T.PlaneGeometry(26.3,19.0);floor.position.set(cx,deckTop,3.52);floor.material.color.set('#0c1521');floor.material.roughness=.38;floor.material.metalness=.44;floor.material.envMapIntensity=.11;oldGeometry.dispose();
 add(new T.BoxGeometry(26.3,.24,19.0),fascia,'single apron fascia',[cx,deckTop-.145,3.52],0);
 add(new T.BoxGeometry(26.3,.022,.026),trim,'restrained front lip',[cx,deckTop-.016,13.02],0);
 let cues=createEncoreCues(),signature='',disposed=false;
 function configureProject(project){const next=JSON.stringify({offset:project?.offset,phrases:project?.phrases});if(next===signature)return;signature=next;cues.dispose();cues=createEncoreCues(project);}
 function update(time,settings,context={}){
  if(disposed)throw Error('Stage disposed');
  const result=legacy.update(time,settings,context),enabled=!!settings.enabled,weights=settings.directorEnabled===false?{wing:0,portal:0,canopy:0,celebration:0,settle:0}:cues.sample(time);
  root.visible=enabled;for(const o of hidden)o.visible=false;for(const[o,visible]of originalBridge)o.visible=enabled?false:visible;
  const contrast=settings.architectureContrast??.78;
  shell.color.set('#536273').lerp(new T.Color('#182333'),contrast);inner.color.set('#8190a0').lerp(new T.Color('#3a4b62'),contrast);
  shell.emissiveIntensity=.025+weights.wing*.11;inner.emissiveIntensity=.035+weights.portal*.2;
  trim.emissiveIntensity=.03+weights.canopy*.18;cove.color.set('#f4dbb2').multiplyScalar(.3+weights.portal*.6+weights.canopy*.25);
  const mass=context.massTarget??context.target??[0,0,0],velocity=context.rootVelocity??[0,0,0],centre=[mass[0]-velocity[0]*.08,mass[2]-velocity[2]*.08];
  stage.reflection.configure({encoreFollowCentre:centre,encoreFollowGain:0,encoreFloorLift:enabled?.008+weights.wing*.004+weights.canopy*.004:0,encoreReflectionStrength:settings.floorReflection??.055});
  return {...result,designStatus:'V024_STAGE_NATIVE_THREE_TESTED_WEBGL',environmentWeights:weights,massFollowCentre:centre,continuousFloor:true,separateOvalPools:false,actorLightingUnchanged:true,architectureMeshes:meshes.length};
 }
 return {...legacy,root,legacyRoot:legacy.root,architecture:meshes,collisionShells,configureProject,update,budget:{...legacy.budget,extraDirectLights:0,extraReflectionPasses:0,curvedWings:4,architectureMeshes:meshes.length},dispose(){if(disposed)return;disposed=true;cues.dispose();legacy.dispose();for(const[o,visible]of originalBridge)o.visible=visible;root.removeFromParent();const gs=new Set(),ms=new Set();root.traverse(o=>{if(o.geometry)gs.add(o.geometry);if(o.material)ms.add(o.material);});for(const g of gs)g.dispose();for(const m of ms)m.dispose();}};
}
