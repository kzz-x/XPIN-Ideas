import * as T from 'three';
export {createResourceShelf} from './resource-shelf.mjs';

// Shared neutral materials. Each rigid assembly is merged per material, while
// hinges and removable trays retain independent, physically meaningful pivots.
const mats={
  shell:new T.MeshStandardMaterial({color:'#747b83',roughness:.57,metalness:.24}),
  light:new T.MeshStandardMaterial({color:'#e6e5da',roughness:.63,metalness:.06}),
  steel:new T.MeshStandardMaterial({color:'#adb4ba',roughness:.38,metalness:.55}),
  dark:new T.MeshStandardMaterial({color:'#343a42',roughness:.76,metalness:.12}),
  rubber:new T.MeshStandardMaterial({color:'#22272d',roughness:.93,metalness:0}),
  paper:new T.MeshStandardMaterial({color:'#ede9da',roughness:.94,metalness:0}),
  paperEdge:new T.MeshStandardMaterial({color:'#c5c1b5',roughness:.95,metalness:0}),
};
const cache=new Map(),v=(x=0,y=0,z=0)=>new T.Vector3(x,y,z),clamp=x=>Math.max(0,Math.min(1,x));
const smooth=x=>{x=clamp(x);return x*x*(3-2*x);};

function roundedShape(w,h,r){
  r=Math.min(r,w/2,h/2);const x=-w/2,y=-h/2,s=new T.Shape();
  s.moveTo(x+r,y);s.lineTo(x+w-r,y);s.quadraticCurveTo(x+w,y,x+w,y+r);
  s.lineTo(x+w,y+h-r);s.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
  s.lineTo(x+r,y+h);s.quadraticCurveTo(x,y+h,x,y+h-r);
  s.lineTo(x,y+r);s.quadraticCurveTo(x,y,x+r,y);return s;
}
function cached(key,make){if(!cache.has(key))cache.set(key,make());return cache.get(key);}
function bevelBox(w,h,d,b=.018){
  b=Math.min(b,w*.18,h*.18,d*.18);
  return cached(`box:${w}:${h}:${d}:${b}`,()=>{
    const g=new T.ExtrudeGeometry(roundedShape(w-2*b,h-2*b,Math.max(.001,b)),{depth:d-2*b,steps:1,bevelEnabled:true,bevelThickness:b,bevelSize:b,bevelSegments:2,curveSegments:3});
    g.translate(0,0,-(d-2*b)/2);return g;
  });
}
function ring(w,d,h,wall=.075,r=.09){
  return cached(`ring:${w}:${d}:${h}:${wall}:${r}`,()=>{
    const b=Math.min(.009,h*.13,wall*.15),s=roundedShape(w-2*b,d-2*b,r);
    const hole=roundedShape(w-2*wall+2*b,d-2*wall+2*b,Math.max(.015,r-wall)).getPoints(3).reverse();
    s.holes.push(new T.Path(hole));
    const g=new T.ExtrudeGeometry(s,{depth:h-2*b,steps:1,bevelEnabled:true,bevelThickness:b,bevelSize:b,bevelSegments:1,curveSegments:6});
    g.rotateX(-Math.PI/2);g.translate(0,b,0);return g;
  });
}
function cylinder(radius,height,segments=12){return cached(`cyl:${radius}:${height}:${segments}`,()=>new T.CylinderGeometry(radius,radius,height,segments));}

function batch(parent,name){
  const buckets=new Map();
  function add(geometry,material,p=[0,0,0],r=[0,0,0]){
    const g=geometry.clone();g.applyMatrix4(new T.Matrix4().compose(v(...p),new T.Quaternion().setFromEuler(new T.Euler(...(r??[0,0,0]))),v(1,1,1)));
    const flat=g.index?g.toNonIndexed():g;
    if(!buckets.has(material))buckets.set(material,{positions:[],normals:[],pieces:0});
    const b=buckets.get(material);b.positions.push(...flat.attributes.position.array);b.normals.push(...flat.attributes.normal.array);b.pieces++;
    if(flat!==g)flat.dispose();g.dispose();
  }
  const box=(w,h,d,material,p,r,bevel=.018)=>add(bevelBox(w,h,d,bevel),material,p,r);
  const frame=(w,d,h,wall,material,p,radius=.09)=>add(ring(w,d,h,wall,radius),material,p);
  const pin=(radius,height,material,p,r,segments=12)=>add(cylinder(radius,height,segments),material,p,r);
  function finish(){
    for(const [key,b] of buckets){const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(b.positions,3));g.setAttribute('normal',new T.Float32BufferAttribute(b.normals,3));g.computeBoundingSphere();
      const m=new T.Mesh(g,mats[key]);m.name=`${name} / ${key}`;m.castShadow=true;m.receiveShadow=true;m.userData.constructionPieces=b.pieces;parent.add(m);}
  }
  return {add,box,frame,pin,finish};
}
function mark(parent,label,text,w,h,p,{size=100,color='#303944',rotation=null}={}){
  if(typeof label!=='function')return null;
  const m=label(text,w,h,{size,color});m.name='Resource marking / '+text;m.position.set(...p);if(rotation)m.rotation.set(...rotation);parent.add(m);return m;
}
function stats(group,kind,lid,parts,opened){
  let meshes=0,triangles=0,drawCalls=0,constructionPieces=0;const materials=new Set();
  group.traverse(o=>{if(!o.isMesh)return;meshes++;const n=o.geometry.index?.count??o.geometry.attributes.position.count;triangles+=n/3;drawCalls+=Array.isArray(o.material)?o.geometry.groups.length:1;constructionPieces+=o.userData.constructionPieces||1;for(const m of Array.isArray(o.material)?o.material:[o.material])materials.add(m.uuid);});
  group.updateMatrixWorld(true);const worldBounds=new T.Box3().setFromObject(group);
  return {kind,opened,meshes,drawCalls,triangles,materials:materials.size,constructionPieces,lidRotation:lid?.rotation.toArray().slice(0,3),partsY:parts.map(p=>p.position.y),worldBounds:{min:worldBounds.min.toArray(),max:worldBounds.max.toArray()}};
}

function book(label){
  const group=new T.Group();group.name='Resource book / bound field notebook';const body=batch(group,'Binding, rear board and paper gatherings');
  // Covers stand on the shelf at local y=-.04 (host y=.30 -> deck top .26).
  body.box(1.64,2.2,.066,'dark',[0,1.06,-.224],null,.012);
  body.box(.13,2.2,.50,'dark',[-.785,1.06,0],null,.022);
  body.box(.045,2.13,.39,'shell',[-.705,1.06,-.015],null,.009);
  for(const y of [.35,1.06,1.77])body.box(.15,.065,.515,'shell',[-.79,y,0],null,.009);
  // Actual page geometry, separated by very small recesses along the fore-edge.
  for(let i=0;i<22;i++)body.box(1.48,2.06,.0124,i%5===0?'paperEdge':'paper',[.035,1.055,-.158+i*.0141],null,.0012);
  body.box(.14,.12,.028,'paperEdge',[.52,2.11,.08],null,.004);
  body.finish();
  const lid=new T.Group();lid.name='Book front cover / left binding hinge';lid.position.set(-.82,1.06,.231);group.add(lid);
  const cover=batch(lid,'Chamfered hard cover');
  cover.box(1.64,2.2,.068,'light',[.82,0,0],null,.012);
  cover.box(.018,1.99,.011,'paperEdge',[.17,0,.040],null,.002);
  cover.box(1.43,1.98,.012,'paper',[.86,0,-.041],null,.002);
  cover.box(.32,.028,.012,'dark',[.40,.80,.042],null,.002);
  cover.finish();
  mark(lid,label,'想法\n方法',1.15,.73,[.84,.22,.043],{size:180});
  mark(lid,label,'FIELD NOTES / 01',1.16,.14,[.84,-.74,.043],{size:90,color:'#5e6670'});
  const leaves=[];
  for(let i=0;i<2;i++){const leaf=new T.Group();leaf.name=`Bound opening leaf ${i+1}`;leaf.position.set(-.70,1.055,.163+i*.018);group.add(leaf);const paper=batch(leaf,'Opening leaf');paper.box(1.45,2.05,.012,'paper',[.725,0,0],null,.001);paper.finish();leaves.push(leaf);}
  const parts=[];let opened=0;
  const update=(value)=>{opened=clamp(value);lid.rotation.y=-opened*1.3;leaves.forEach((leaf,i)=>leaf.rotation.y=-opened*(i===0?.12:.31));};
  update(0);return {group,lid,parts,update,snapshot:()=>stats(group,'book',lid,parts,opened)};
}

function toolbox(label){
  const group=new T.Group();group.name='Resource toolbox / hinged equipment case';const body=batch(group,'Case shell, cavity, tray and hardware');
  // Feet reach local -.02: existing host y2.78 meets shelf top y2.76.
  for(const x of [-.97,.97])for(const z of [-.51,.51])body.box(.28,.08,.23,'rubber',[x,.02,z],null,.012);
  body.box(2.48,.10,1.38,'shell',[0,.11,0],null,.022);
  body.frame(2.6,1.5,1.01,.085,'shell',[0,.11,0],.11);
  body.frame(2.62,1.52,.075,.075,'steel',[0,1.075,0],.11);
  body.frame(2.50,1.40,.022,.045,'rubber',[0,1.145,0],.08);
  // Recessed interior remains an open cavity; the removable foam tray has real divisions.
  body.box(2.34,.075,1.23,'rubber',[0,.205,0],null,.012);
  body.frame(2.33,1.23,.13,.055,'dark',[0,.24,0],.06);
  body.box(.065,.33,1.10,'dark',[-.26,.40,0],null,.009);
  body.box(.80,.33,.055,'dark',[-.70,.40,.08],null,.009);
  body.box(1.22,.27,.055,'dark',[.45,.37,-.18],null,.009);
  // A pair of organized inserts makes the internal depth legible when the lid opens.
  body.box(.55,.16,.43,'shell',[-.73,.36,-.32],null,.028);
  body.box(.63,.18,.37,'light',[.45,.37,.25],null,.025);
  for(let i=0;i<3;i++)body.box(.055,.045,.31,'steel',[.25+i*.17,.48,.25],null,.008);
  // Front ribs, protected identity plate, two independently readable latch mechanisms.
  for(const x of [-1.05,1.05])body.box(.09,.79,.036,'steel',[x,.64,.752],null,.012);
  body.box(.94,.28,.032,'dark',[0,.66,.759],null,.018);
  for(const x of [-.70,.70]){
    body.box(.22,.32,.045,'steel',[x,.91,.768],null,.018);
    body.box(.12,.22,.042,'dark',[x,.95,.798],null,.018);
    body.box(.15,.055,.055,'steel',[x,1.065,.802],null,.012);
    body.pin(.034,.025,'dark',[x,.80,.803],[Math.PI/2,0,0]);
    // Rear hinge barrels span the seam; pins run along x.
    for(const dx of [-.11,0,.11])body.pin(.044,.095,'steel',[x+dx,1.17,-.768],[0,0,Math.PI/2]);
    body.box(.28,.16,.038,'steel',[x,1.065,-.764],null,.008);
  }
  body.finish();mark(group,label,'METHOD / KIT',.82,.14,[0,.66,.781],{size:120,color:'#e8e7dd'});
  const lid=new T.Group();lid.name='Toolbox lid / rear hinge';lid.position.set(0,1.18,-.75);group.add(lid);
  const cap=batch(lid,'Shallow folded lid and open U handle');
  cap.frame(2.6,1.5,.155,.075,'light',[0,-.005,.75],.11);
  cap.box(2.50,.060,1.40,'light',[0,.137,.75],null,.014);
  cap.box(2.26,.035,1.16,'dark',[0,.083,.75],null,.012);
  // Real opening below the bridge grip, never a solid rectangular substitute.
  for(const x of [-.38,.38]){cap.box(.13,.21,.16,'steel',[x,.255,.75],null,.024);cap.box(.24,.045,.22,'shell',[x,.186,.75],null,.012);}
  cap.box(.88,.105,.16,'rubber',[0,.391,.75],null,.028);
  for(const x of [-1.06,1.06])cap.box(.065,.025,1.11,'shell',[x,.18,.75],null,.007);
  cap.finish();
  const parts=[];let opened=0;const update=value=>{opened=clamp(value);lid.rotation.x=-opened*1.2;};
  update(0);return {group,lid,parts,update,snapshot:()=>stats(group,'toolbox',lid,parts,opened)};
}

function project(label){
  const group=new T.Group();group.name='Resource project / serviceable three-layer archive';const base=batch(group,'Project chassis, feet and locating hardware');
  for(const x of [-1.05,1.05])for(const z of [-.57,.57])base.box(.25,.075,.22,'rubber',[x,-.0025,z],null,.012);
  base.box(2.57,.09,1.57,'dark',[0,.075,0],null,.016);
  base.frame(2.7,1.7,.30,.085,'shell',[0,.10,0],.12);
  base.frame(2.64,1.64,.038,.065,'steel',[0,.385,0],.105);
  base.box(1.05,.19,.028,'dark',[0,.245,.854],null,.012);
  for(const x of [-1.08,1.08])for(const z of [-.59,.59]){base.pin(.045,.34,'steel',[x,.37,z]);base.pin(.074,.035,'dark',[x,.222,z]);}
  base.finish();mark(group,label,'PROJECT / 03',.94,.12,[0,.245,.874],{size:120,color:'#e8e7dd'});
  const parts=[];
  for(let i=0;i<3;i++){
    const tray=new T.Group();tray.name=['Project lower carrier / routing assembly','Project upper carrier / component archive','Project lid / shallow protective cap'][i];tray.position.y=.55+i*.28;group.add(tray);parts.push(tray);
    const b=batch(tray,tray.name),w=2.50-i*.18,d=1.55-i*.12;
    if(i<2){
      b.frame(w,d,.20,.065,'shell',[0,-.10,0],.08);b.box(w-.13,.035,d-.13,'dark',[0,-.063,0],null,.009);
      for(const x of [-w/2+.13,w/2-.13])for(const z of [-d/2+.13,d/2-.13])b.pin(.045,.055,'steel',[x,.12,z]);
      if(i===0){
        b.box(.97,.075,.79,'shell',[-.43,.015,0],null,.016);b.box(.58,.045,.48,'dark',[-.43,.075,0],null,.012);
        for(let k=0;k<7;k++)for(const side of [-1,1])b.box(.034,.025,.14,'steel',[-.70+k*.09,.09,side*.32],null,.003);
        b.box(.06,.15,1.23,'shell',[.28,.015,0],null,.008);
        for(let k=0;k<3;k++)b.box(.56,.09,.20,'light',[.66,.02,-.38+k*.37],null,.016);
      }else{
        for(const x of [-.68,0,.68]){b.box(.53,.10,.91,'light',[x,.015,0],null,.022);b.box(.29,.018,.16,'shell',[x,.078,.25],null,.006);}
        for(const x of [-.34,.34])b.box(.035,.15,1.12,'shell',[x,.005,0],null,.005);
      }
    }else{
      b.frame(w,d,.16,.065,'light',[0,-.10,0],.08);b.box(w-.10,.055,d-.10,'light',[0,.073,0],null,.013);
      b.box(w-.25,.028,d-.25,'dark',[0,.017,0],null,.008);
      for(const x of [-.78,.78])b.box(.26,.022,.06,'shell',[x,.113,.40],null,.005);
      b.box(.72,.022,.028,'shell',[0,.113,-.30],null,.004);
    }
    b.finish();
  }
  const lid=parts[2];mark(lid,label,'SOURCE / EDIT / BUILD',1.63,.15,[0,.113,.05],{size:100,color:'#414b55',rotation:[-Math.PI/2,0,0]});
  let opened=0;const update=value=>{opened=clamp(value);const unfold=smooth((opened-.3)/.7);parts.forEach((part,i)=>{part.position.y=.55+i*.28+smooth(clamp(unfold*1.5-i*.18))*(i+1)*.45;});};
  update(0);return {group,lid,parts,update,snapshot:()=>({...stats(group,'project',lid,parts,opened),layerOpen:smooth((opened-.3)/.7),hostClearance:'host pulls forward 2.45 before layers rise'})};
}

export function createResourceModel(kind,{label}={}){
  if(kind==='book')return book(label);
  if(kind==='toolbox')return toolbox(label);
  if(kind==='project')return project(label);
  throw new Error(`Unknown resource kind: ${kind}`);
}
