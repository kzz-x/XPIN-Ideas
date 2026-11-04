import * as T from 'three';
import {SVGLoader} from 'three/addons/loaders/SVGLoader.js';

const clamp=x=>Math.max(0,Math.min(1,x));
const smooth=x=>{x=clamp(x);return x*x*x*(10+x*(-15+6*x));};
const span=(a,b,x)=>smooth((x-a)/(b-a));
export const CHARACTER_COUNT=192;
export const CHARACTER_SET='01<>/=+;';

export function outlineShapes(record,loader=new SVGLoader()){
  const rule=/^F0/.test(record.path)?'evenodd':'nonzero',path=record.path.replace(/^F[01]\s*/,'');
  return loader.parse(`<svg xmlns="http://www.w3.org/2000/svg"><path fill="#fff" fill-rule="${rule}" transform="scale(1,-1)" d="${path}"/></svg>`).paths.flatMap(p=>p.toShapes());
}

// Closed, shallow outline meshes retain front, side and back geometry. Their
// regular grid, phase offsets and gentle spatial shear replace random scatter.
export function createCharacterFlow({scene,camera,data,glyphs,dimensions}){
  const root=new T.Group();root.name='192 monospaced 3D characters / scan, shear, gather';scene.add(root);
  const batches=[],particles=[],geometries=[],materials=[],loader=new SVGLoader();
  const dummy=new T.Object3D(),q=new T.Quaternion(),identity=new T.Quaternion(),euler=new T.Euler();
  const current=new T.Vector3(),v1=new T.Vector3(),v2=new T.Vector3(),v3=new T.Vector3();
  const geometryStats=[];
  function material(color){
    const mat=new T.MeshStandardMaterial({color,metalness:0,roughness:.94,transparent:true,depthWrite:false});
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
    mat.customProgramCacheKey=()=>`opening-r03-scan-body-${color}`;materials.push(mat);return mat;
  }
  const cap=material('#bcdbee'),side=material('#718ba7');
  for(let charIndex=0;charIndex<CHARACTER_SET.length;charIndex++){
    const char=CHARACTER_SET[charIndex],shapes=outlineShapes(data[char],loader),depth=.9;
    const geometry=new T.ExtrudeGeometry(shapes,{depth,bevelEnabled:false,steps:1,curveSegments:2});
    geometry.computeBoundingBox();const center=geometry.boundingBox.getCenter(new T.Vector3());geometry.translate(-center.x,-center.y,-depth*.5);geometry.scale(1/75,1/75,1/75);geometry.computeBoundingBox();geometries.push(geometry);
    const count=Math.ceil((CHARACTER_COUNT-charIndex)/CHARACTER_SET.length),flex=new T.InstancedBufferAttribute(new Float32Array(count*4),4);flex.setUsage(T.DynamicDrawUsage);geometry.setAttribute('aFlex',flex);
    const mesh=new T.InstancedMesh(geometry,[cap,side],count);mesh.name=`ASCII ${char} / shallow closed outline`;mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);mesh.frustumCulled=false;root.add(mesh);
    const batch={mesh,flex,char,count};batches.push(batch);
    geometryStats.push({char,vertices:geometry.attributes.position.count,depth:geometry.boundingBox.max.z-geometry.boundingBox.min.z,groups:geometry.groups.length});
    for(let slot=0;slot<count;slot++){
      const id=charIndex+slot*CHARACTER_SET.length;if(id>=CHARACTER_COUNT)continue;
      const glyph=Math.floor(id/48),local=id%48,row=Math.floor(local/8),col=glyph*8+local%8;
      particles.push({id,glyph,local,row,col,batch,slot,source:new T.Vector3(),start:new T.Vector3(),rail:new T.Vector3(),destination:new T.Vector3(),rotation:new T.Quaternion(),delay:0,size:.25});
    }
  }
  particles.sort((a,b)=>a.id-b.id);

  function contains(point,a,b,c){
    const ab=(b.x-a.x)*(point.y-a.y)-(b.y-a.y)*(point.x-a.x),bc=(c.x-b.x)*(point.y-b.y)-(c.y-b.y)*(point.x-b.x),ca=(a.x-c.x)*(point.y-c.y)-(a.y-c.y)*(point.x-c.x);
    return (ab>=-1e-8&&bc>=-1e-8&&ca>=-1e-8)||(ab<=1e-8&&bc<=1e-8&&ca<=1e-8);
  }
  for(const glyph of glyphs){
    const geometry=glyph.mesh.geometry,pos=geometry.attributes.position,box=geometry.boundingBox,triangles=[],grid=[];
    for(let i=0;i<pos.count;i+=3){v1.fromBufferAttribute(pos,i);v2.fromBufferAttribute(pos,i+1);v3.fromBufferAttribute(pos,i+2);if(Math.abs(v1.z-box.max.z)<1e-5&&Math.abs(v2.z-box.max.z)<1e-5&&Math.abs(v3.z-box.max.z)<1e-5)triangles.push([v1.clone(),v2.clone(),v3.clone()]);}
    // Regular samples are accepted only on the actual Chinese face. Sorted
    // rows allow the source to dissolve with the same top-to-bottom scan.
    for(let row=0;row<20;row++)for(let col=0;col<20;col++){
      const point=new T.Vector3(T.MathUtils.lerp(box.min.x,box.max.x,(col+.5)/20),T.MathUtils.lerp(box.max.y,box.min.y,(row+.5)/20),box.max.z+.018);
      if(triangles.some(([a,b,c])=>contains(point,a,b,c)))grid.push(point);
    }
    if(!grid.length)throw Error('Opening source has no face samples');
    for(const p of particles.filter(p=>p.glyph===glyph.index)){
      p.source.copy(grid[Math.min(grid.length-1,Math.floor((p.local+.5)/48*grid.length))]);
      p.delay=.12+glyph.index*.035+clamp(.5-p.source.y/3.3)*1.12;
    }
  }
  let baked=false;
  function target(p){
    const {w,h}=dimensions();
    // Keep column and row order through the whole gather: no crossed streams.
    // The top row resolves into the header, the bottom into the input rail.
    const rows=[.405,.23,.10,-.03,-.16,-.36];
    p.destination.set(-w*.415+p.col*w*.0268,h*rows[p.row],(p.row%2)*.025);
  }
  function bake(){
    scene.updateMatrixWorld(true);
    for(const p of particles){
      const glyph=glyphs[p.glyph];p.start.copy(p.source).applyMatrix4(glyph.mesh.matrixWorld);glyph.mesh.getWorldQuaternion(p.rotation);target(p);
      p.rail.set((p.col-15.5)*.385,1.86-p.row*.475,(p.row%3-1)*.22);
    }baked=true;
  }
  function update({phase,phaseTime,holdProgress=0}){
    if(phase==='intro')baked=false;
    const active=(phase==='morph'&&phaseTime<4.15)||(phase==='intro'&&holdProgress>.88);root.visible=active;
    if(!active)return;
    if(phase==='morph'&&!baked)bake();
    const hold=span(.88,1,holdProgress),fade=1-span(3.05,4.10,phaseTime);
    if(phase==='intro')scene.updateMatrixWorld(true);
    for(const p of particles){
      const narrow=camera.aspect<.9;
      let alpha=0,bend=0,twist=0,stretch=1,scale=p.size*(narrow?1.65:1);
      if(phase==='intro'){
        const glyph=glyphs[p.glyph];current.copy(p.source).applyMatrix4(glyph.mesh.matrixWorld);glyph.mesh.getWorldQuaternion(dummy.quaternion);
        alpha=hold*(p.row===0?.48:.05);scale*=.85;
      }else{
        const extract=span(p.delay,p.delay+.85,phaseTime),gather=span(1.65+p.row*.045,3.65+p.row*.035,phaseTime),flight=Math.sin(Math.PI*extract)*(1-gather);
        current.copy(p.start).lerp(p.rail,extract).lerp(p.destination,gather);
        // One gentle shear travels through each whole row. The sequence has
        // depth and real vertex deformation but characters remain legible.
        current.x+=Math.sin(Math.PI*gather)*(.24-p.row*.08);
        current.z+=flight*.65+Math.sin(Math.PI*gather)*(p.row%2?.32:-.25);
        const shear=flight*.13+Math.sin(Math.PI*gather)*.08;
        euler.set(-flight*.045,shear,(p.row-2.5)*flight*.003);q.setFromEuler(euler);
        dummy.quaternion.copy(p.rotation).slerp(identity,extract).multiply(q);
        bend=flight*.024;twist=shear*.18;stretch=1+flight*.035;
        alpha=span(p.delay-.045,p.delay+.16,phaseTime)*fade*(p.col%8===0?1:p.col%4===0?.88:.72)*(p.row%3===0?.78:1);
        scale*=1-.16*gather;
      }
      dummy.position.copy(current);dummy.scale.setScalar(scale);dummy.updateMatrix();p.batch.mesh.setMatrixAt(p.slot,dummy.matrix);p.batch.flex.setXYZW(p.slot,bend,twist,stretch,alpha);
    }
    for(const batch of batches){batch.mesh.instanceMatrix.needsUpdate=true;batch.flex.needsUpdate=true;}
  }
  return {root,bake,update,particles,stats:{count:CHARACTER_COUNT,geometryStats,geometry:'closed shallow outline extrusions',deformation:'row-coherent scan/shear/gather with analytic bend and normals',atlas:false,billboard:false,layout:'32 columns / 6 scan rows',sourceSampling:'regular grid on actual title faces'},dispose(){for(const b of batches)b.mesh.dispose();for(const g of geometries)g.dispose();for(const m of materials)m.dispose();scene.remove(root);}};
}

