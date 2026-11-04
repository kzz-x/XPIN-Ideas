import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

/** Static shelf only. Origin, shelf heights and object contact planes are
 * compatible with the existing resource display; the host positions the group.
 */
export function createResourceShelf(){
  const root=new T.Group();root.name='Resource shelf / folded steel and L-section frame';
  const levels=[.2,2.7,5.3],batches=new Map(),parts={};
  const materials={
    frame:new T.MeshStandardMaterial({color:'#747b81',metalness:.24,roughness:.65}),
    sheet:new T.MeshStandardMaterial({color:'#323840',metalness:.12,roughness:.76}),
    connection:new T.MeshStandardMaterial({color:'#7d8790',metalness:.32,roughness:.62}),
    fastener:new T.MeshStandardMaterial({color:'#959da4',metalness:.70,roughness:.37}),
    dark:new T.MeshStandardMaterial({color:'#11161b',metalness:0,roughness:.91}),
  };
  for(const name of Object.keys(materials))batches.set(name,[]);
  const matrix=new T.Matrix4(),unit=new T.Vector3(1,1,1),up=new T.Vector3(0,1,0);

  function add(material,geometry,position=[0,0,0],rotation=[0,0,0],kind='part'){
    const q=rotation.isQuaternion?rotation:new T.Quaternion().setFromEuler(new T.Euler(...rotation));
    matrix.compose(new T.Vector3(...position),q,unit);geometry.applyMatrix4(matrix);
    if(geometry.index){const flat=geometry.toNonIndexed();geometry.dispose();geometry=flat;}
    geometry.clearGroups();batches.get(material).push(geometry);parts[kind]=(parts[kind]||0)+1;
  }
  function polygon(points){const shape=new T.Shape();points.forEach(([x,y],i)=>i?shape.lineTo(x,y):shape.moveTo(x,y));shape.closePath();return shape;}
  function extrusion(shape,depth,bevel=.003){
    const geometry=new T.ExtrudeGeometry(shape,{depth:depth-2*bevel,bevelEnabled:bevel>0,bevelSize:bevel,bevelThickness:bevel,bevelSegments:1,curveSegments:8,steps:1});
    geometry.translate(0,0,-depth*.5+bevel);return geometry;
  }
  function chamferBox(w,h,d,bevel=.006){
    bevel=Math.min(bevel,w*.2,h*.2,d*.2);
    return extrusion(polygon([[-w*.5+bevel,-h*.5+bevel],[w*.5-bevel,-h*.5+bevel],[w*.5-bevel,h*.5-bevel],[-w*.5+bevel,h*.5-bevel]]),d,bevel);
  }
  function bar(a,b,width,depth,material='frame',kind='beam'){
    const start=new T.Vector3(...a),end=new T.Vector3(...b),direction=end.clone().sub(start);
    add(material,chamferBox(width,direction.length(),depth,.0035),start.add(end).multiplyScalar(.5).toArray(),new T.Quaternion().setFromUnitVectors(up,direction.normalize()),kind);
  }
  function foldedLip(length){
    // Continuous bent-sheet section, including a small inward return at its
    // lower edge. It is not a box with a line drawn over the face.
    const profile=polygon([[0,.038],[.025,.038],[.025,-.096],[.082,-.096],[.082,-.121],[0,-.121]]);
    const geometry=extrusion(profile,length,.0035);geometry.rotateY(Math.PI/2);return geometry;
  }
  function hexagon(radius){return polygon(Array.from({length:6},(_,i)=>[Math.cos(i*Math.PI/3)*radius,Math.sin(i*Math.PI/3)*radius]));}
  function socketHead(){
    const shape=hexagon(.022),hole=new T.Path();
    for(let i=0;i<6;i++){const a=-i*Math.PI/3,x=Math.cos(a)*.008,y=Math.sin(a)*.008;i?hole.lineTo(x,y):hole.moveTo(x,y);}hole.closePath();shape.holes.push(hole);
    return extrusion(shape,.018,.0015);
  }
  function screw(x,y,z,back=false){
    const sign=back?-1:1,rotation=[0,back?Math.PI:0,0];
    const washer=new T.CylinderGeometry(.028,.028,.006,12,1,false);washer.rotateX(Math.PI/2);
    add('connection',washer,[x,y,z+sign*.005],rotation,'washer');
    add('fastener',socketHead(),[x,y,z+sign*.017],rotation,'recessed hex fastener');
    add('dark',extrusion(hexagon(.0077),.002,0),[x,y,z+sign*.008],rotation,'socket floor');
  }

  // Four genuine open L sections. Their outer dimensions remain inside the
  // 12.8 x 2.8 shelf silhouette, and the feet start at the original floor y=0.
  for(const x of [-6.3,6.3])for(const z of [-1,1.3]){
    const yaw=x>0?(z>0?Math.PI/2:Math.PI):(z>0?0:-Math.PI/2);
    const section=polygon([[-.06,-.06],[.06,-.06],[.06,-.036],[-.036,-.036],[-.036,.06],[-.06,.06]]);
    const column=extrusion(section,5.438,.003);column.rotateX(-Math.PI/2);
    add('frame',column,[x,2.781,z],[0,yaw,0],'L-section upright');
    add('dark',chamferBox(.18,.040,.20,.009),[x,.020,z],[0,0,0],'foot pad');
    add('connection',chamferBox(.158,.022,.178,.004),[x,.051,z],[0,0,0],'foot load plate');
    for(const y of levels){
      const back=z<0,faceZ=back?-1.068:1.366;
      add('connection',chamferBox(.158,.18,.012,.003),[x-Math.sign(x)*.025,y-.045,faceZ],[0,0,0],'shelf connection plate');
      for(const dy of [-.05,.05])screw(x-Math.sign(x)*.025,y-.045+dy,faceZ+(back?-.006:.006),back);
    }
  }

  for(const y of levels){
    // Top surfaces are exactly y + .06: .26, 2.76 and 5.36. Structural depth
    // grows downwards so the existing book, toolbox and archive keep contact.
    add('sheet',chamferBox(12.8,.035,2.8,.005),[0,y+.0425,0],[0,0,0],'shelf deck');
    add('sheet',foldedLip(12.772),[0,y,1.394],[0,0,0],'front folded return');
    add('sheet',foldedLip(12.772),[0,y,-1.394],[0,Math.PI,0],'rear folded return');
    for(const sign of [-1,1])add('sheet',foldedLip(2.772),[sign*6.394,y,0],[0,sign*Math.PI/2,0],'side folded return');
    for(const z of [-1,1.3])add('frame',chamferBox(12.55,.095,.075,.006),[0,y-.115,z],[0,0,0],'lower longitudinal beam');
    for(const x of [-3.15,0,3.15])add('frame',chamferBox(.070,.065,2.27,.005),[x,y-.055,.15],[0,0,0],'under-deck cross support');
  }

  // One slender X in each rear bay. They stop short of each deck rather than
  // cutting through the middle shelf, and introduce no decorative diagonals.
  for(const [lower,upper]of [[.39,2.50],[2.91,5.10]]){
    bar([-6.23,lower,-1.065],[6.23,upper,-1.065],.050,.018,'connection','rear tension brace');
    bar([6.23,lower,-1.087],[-6.23,upper,-1.087],.050,.018,'connection','rear tension brace');
    for(const x of [-6.23,6.23])for(const y of [lower,upper]){
      add('connection',chamferBox(.12,.13,.014,.003),[x,y,-1.078],[0,0,0],'brace end tab');
      screw(x,y,-1.087,true);
    }
  }

  let triangles=0,drawCalls=0;
  for(const [name,geometries]of batches){
    if(!geometries.length){materials[name].dispose();continue;}
    const geometry=mergeGeometries(geometries,false);for(const source of geometries)source.dispose();
    if(!geometry)throw Error('Could not merge resource shelf '+name);
    geometry.computeBoundingBox();geometry.computeBoundingSphere();
    const mesh=new T.Mesh(geometry,materials[name]);mesh.name='Shelf / '+({frame:'open uprights and support beams',sheet:'folded sheet decks',connection:'connection plates and rear braces',fastener:'recessed fasteners',dark:'rubber feet and socket recesses'}[name]);
    mesh.castShadow=true;mesh.receiveShadow=true;root.add(mesh);
    triangles+=geometry.attributes.position.count/3;drawCalls++;
  }
  root.userData.component='resource-shelf-r05';
  root.userData.structure={nominalWidth:12.8,nominalDepth:2.8,nominalHeight:5.5,levels:[...levels],contactHeights:levels.map(y=>y+.06),uprightSection:'open L, 0.12 legs / 0.024 wall',parts};
  root.userData.performance={drawCalls,triangles,staticBatches:drawCalls,wireframe:false};
  return root;
}
