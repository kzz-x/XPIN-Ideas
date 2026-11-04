import * as T from 'three';
import {SVGLoader} from 'three/addons/loaders/SVGLoader.js';

const TAU=Math.PI*2, clamp=x=>Math.max(0,Math.min(1,x));
const smooth=x=>{x=clamp(x);return x*x*x*(10+x*(-15+6*x));};
const span=(a,b,x)=>smooth((x-a)/(b-a));
const random=(i,s=1)=>{const n=Math.sin(i*127.1+s*311.7)*43758.5453123;return n-Math.floor(n);};
export const CHARACTER_COUNT=480;
export const CHARACTER_SET='01{}[]<>/=+;AGXZ';

export function outlineShapes(record,loader=new SVGLoader()){
  const rule=/^F0/.test(record.path)?'evenodd':'nonzero',path=record.path.replace(/^F[01]\s*/,'');
  return loader.parse(`<svg xmlns="http://www.w3.org/2000/svg"><path fill="#fff" fill-rule="${rule}" transform="scale(1,-1)" d="${path}"/></svg>`).paths.flatMap(p=>p.toShapes());
}

// A closed extrusion for every ASCII symbol. No canvas, texture atlas,
// camera-facing plane, or per-frame geometry allocation is involved.
export function createCharacterFlow({scene,camera,data,glyphs,dimensions}){
  const root=new T.Group();root.name='480 closed 3D ASCII bodies / two braided streams';scene.add(root);
  const batches=[],particles=[],geometries=[],materials=[],loader=new SVGLoader();
  const dummy=new T.Object3D(),q=new T.Quaternion(),identity=new T.Quaternion(),euler=new T.Euler();
  const current=new T.Vector3(),velocity=new T.Vector3(),v1=new T.Vector3(),v2=new T.Vector3(),v3=new T.Vector3();
  const geometryStats=[];

  function material(color,metalness,roughness){
    const mat=new T.MeshStandardMaterial({color,metalness,roughness,transparent:true,depthWrite:true});
    mat.onBeforeCompile=shader=>{
      shader.vertexShader=shader.vertexShader.replace('#include <common>',`#include <common>
attribute vec4 aFlex;
varying float vBodyOpacity;
vec3 bendBody(vec3 p){
  float a=aFlex.y*p.y,c=cos(a),s=sin(a);
  return vec3(c*p.x+s*p.z,p.y*aFlex.z,-s*p.x+c*p.z+aFlex.x*(p.y*p.y-.12));
}
vec3 bendNormal(vec3 p,vec3 n){
  float a=aFlex.y*p.y,c=cos(a),s=sin(a);
  float xr=c*p.x+s*p.z,zr=-s*p.x+c*p.z;
  vec3 dx=vec3(c,0.,-s),dy=vec3(aFlex.y*zr,aFlex.z,-aFlex.y*xr+2.*aFlex.x*p.y),dz=vec3(s,0.,c);
  return normalize(n.x*cross(dy,dz)+n.y*cross(dz,dx)+n.z*cross(dx,dy));
}`);
      shader.vertexShader=shader.vertexShader.replace('#include <beginnormal_vertex>','#include <beginnormal_vertex>\nobjectNormal=bendNormal(position,objectNormal);');
      shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\ntransformed=bendBody(position);vBodyOpacity=aFlex.w;');
      shader.fragmentShader='varying float vBodyOpacity;\n'+shader.fragmentShader;
      shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\nif(vBodyOpacity<.003)discard;diffuseColor.a*=vBodyOpacity;');
    };
    mat.customProgramCacheKey=()=>`opening-r02-real-body-${color}`;materials.push(mat);return mat;
  }
  const cap=material('#f5f5f0',.15,.34),side=material('#9a9da2',.40,.38);
  for(let charIndex=0;charIndex<CHARACTER_SET.length;charIndex++){
    const char=CHARACTER_SET[charIndex],shapes=outlineShapes(data[char],loader);
    const geometry=new T.ExtrudeGeometry(shapes,{depth:14,bevelEnabled:true,bevelThickness:1.15,bevelSize:.7,bevelSegments:2,steps:3,curveSegments:3});
    geometry.computeBoundingBox();const center=geometry.boundingBox.getCenter(new T.Vector3());geometry.translate(-center.x,-center.y,-7);geometry.scale(1/75,1/75,1/75);geometry.computeBoundingBox();geometries.push(geometry);
    const count=Math.ceil((CHARACTER_COUNT-charIndex)/CHARACTER_SET.length),flex=new T.InstancedBufferAttribute(new Float32Array(count*4),4);flex.setUsage(T.DynamicDrawUsage);geometry.setAttribute('aFlex',flex);
    const mesh=new T.InstancedMesh(geometry,[cap,side],count);mesh.name=`ASCII ${char} / front, beveled sides, back`;mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);mesh.frustumCulled=false;root.add(mesh);
    const batch={mesh,flex,char,count};batches.push(batch);
    geometryStats.push({char,vertices:geometry.attributes.position.count,depth:geometry.boundingBox.max.z-geometry.boundingBox.min.z,groups:geometry.groups.length});
    for(let slot=0;slot<count;slot++){
      const id=charIndex+slot*CHARACTER_SET.length;if(id>=CHARACTER_COUNT)continue;
      const glyph=Math.floor(id/(CHARACTER_COUNT/4)),local=id%(CHARACTER_COUNT/4),pod=Math.floor(local/5),member=local%5;
      particles.push({id,glyph,pod,member,batch,slot,source:new T.Vector3(),start:new T.Vector3(),destination:new T.Vector3(),c1:new T.Vector3(),c2:new T.Vector3(),rotation:new T.Quaternion(),delay:0,size:.215+random(id,5)*.055,side:pod%2?1:-1});
    }
  }
  particles.sort((a,b)=>a.id-b.id);

  for(const glyph of glyphs){
    const pos=glyph.mesh.geometry.attributes.position,triangles=[];let area=0;
    for(let i=0;i<pos.count;i+=3){
      v1.fromBufferAttribute(pos,i);v2.fromBufferAttribute(pos,i+1);v3.fromBufferAttribute(pos,i+2);
      const cross=v2.clone().sub(v1).cross(v3.clone().sub(v1)),weight=cross.length()*.5*(cross.z<0?.32:1);
      if(weight<1e-8)continue;area+=weight;triangles.push({a:v1.clone(),b:v2.clone(),c:v3.clone(),limit:area});
    }
    for(const p of particles.filter(p=>p.glyph===glyph.index)){
      const at=random(p.id,2)*area;let lo=0,hi=triangles.length-1;while(lo<hi){const mid=(lo+hi)>>1;if(triangles[mid].limit<at)lo=mid+1;else hi=mid;}
      const tri=triangles[lo],u=Math.sqrt(random(p.id,3)),v=random(p.id,4);
      p.source.copy(tri.a).multiplyScalar(1-u).addScaledVector(tri.b,u*(1-v)).addScaledVector(tri.c,u*v);
      // Each five-character group shares a flow direction and a small time
      // separation: visible trailing bodies, not duplicated translucent planes.
      p.delay=.12+glyph.index*.13+(1-clamp(.5+p.source.x*.18+p.source.y*.12))*.76+p.member*.018;
      if(p.id%12===0)p.size*=1.32;
    }
  }
  let baked=false;
  function target(p){
    const {w,h}=dimensions(),j=p.id;
    // Structured lines form the future content and input rail. They are not a
    // perimeter point cloud; the host's matching portal receives the bodies.
    if(j<288){const row=Math.floor(j/36),col=j%36;p.destination.set(-w*.405+col*w*.0223,h*.27-row*h*.062,-.14+(row%3)*.08);}
    else if(j<432){const k=j-288,row=Math.floor(k/48),col=k%48;p.destination.set(-w*.412+col*w*.0175,-h*.36+(row-1)*h*.033,.1+row*.045);}
    else{const k=j-432,row=Math.floor(k/24),col=k%24;p.destination.set(-w*.40+col*w*.026,h*.413-row*h*.028,-.05);}
  }
  function bake(){
    scene.updateMatrixWorld(true);
    for(const p of particles){
      const glyph=glyphs[p.glyph];p.start.copy(p.source).applyMatrix4(glyph.mesh.matrixWorld);glyph.mesh.getWorldQuaternion(p.rotation);target(p);
      const s=p.side,podPhase=p.pod*.47+p.glyph*.7,radius=.75+Math.sin(podPhase)*.14;
      p.c1.set(p.start.x*.92+s*.7,s*(3.45+radius*.35)+p.start.y*.22,s>0?2.45+radius*.25:-.65-radius*.25);
      p.c2.set(p.start.x*.45+p.destination.x*.55-s*.8,s*(3.15+radius*.25)+p.destination.y*.23,s>0?1.1:2.55+radius*.25);
    }baked=true;
  }
  function update({phase,phaseTime,holdProgress=0}){
    if(phase==='intro')baked=false;
    const active=(phase==='morph'&&phaseTime<4.02)||(phase==='intro'&&holdProgress>.82);root.visible=active;
    if(!active)return;
    if(phase==='morph'&&!baked)bake();
    const hold=span(.82,1,holdProgress),fade=1-span(3.05,3.95,phaseTime);
    if(phase==='intro')scene.updateMatrixWorld(true);
    for(const p of particles){
      const narrow=camera.aspect<.9;
      let alpha=0,bend=0,twist=0,stretch=1,scale=p.size*(narrow?1.5:1);
      if(phase==='intro'){
        const glyph=glyphs[p.glyph];current.copy(p.source).applyMatrix4(glyph.mesh.matrixWorld);glyph.mesh.getWorldQuaternion(dummy.quaternion);
        alpha=hold*(p.member===0?.74:.26);scale*=.72;
      }else{
        const raw=clamp((phaseTime-p.delay)/3.45),u=smooth(raw),v=1-u,bell=Math.sin(Math.PI*u);
        current.copy(p.start).multiplyScalar(v*v*v).addScaledVector(p.c1,3*v*v*u).addScaledVector(p.c2,3*v*u*u).addScaledVector(p.destination,u*u*u);
        velocity.copy(p.c1).sub(p.start).multiplyScalar(3*v*v).addScaledVector(v1.copy(p.c2).sub(p.c1),6*v*u).addScaledVector(v2.copy(p.destination).sub(p.c2),3*u*u);
        const roll=Math.atan2(velocity.y,Math.abs(velocity.x)+.01)*.18*bell;
        euler.set(Math.sin(p.pod*.3)*bell*.26,p.side*bell*(.48+(p.id%12===0?.55:.12*Math.sin(p.pod))),roll+Math.sin(u*Math.PI*2)*.10);
        q.setFromEuler(euler);dummy.quaternion.copy(p.rotation).slerp(identity,span(.65,1,u)).multiply(q);
        bend=p.side*bell*.20;twist=p.side*bell*(.36+Math.sin(p.pod)*.08);stretch=1+bell*.20;
        alpha=span(p.delay-.045,p.delay+.2,phaseTime)*fade;
        scale*=(1+.08*bell)*(1-.45*span(.52,.92,u));
      }
      if(narrow&&p.id%2)alpha=0;
      dummy.position.copy(current);dummy.scale.setScalar(scale);dummy.updateMatrix();p.batch.mesh.setMatrixAt(p.slot,dummy.matrix);p.batch.flex.setXYZW(p.slot,bend,twist,stretch,alpha);
    }
    for(const batch of batches){batch.mesh.instanceMatrix.needsUpdate=true;batch.flex.needsUpdate=true;}
  }
  return {root,bake,update,particles,stats:{count:CHARACTER_COUNT,geometryStats,geometry:'closed bevelled extrusions',deformation:'per-instance analytic bend/twist/stretch with inverse-transpose normals',atlas:false,billboard:false},dispose(){for(const b of batches)b.mesh.dispose();for(const g of geometries)g.dispose();for(const m of materials)m.dispose();scene.remove(root);}};
}
