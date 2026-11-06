import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import * as T from '../assets/dot/model/frozen/r07d/editable-stage/素材/v011/DotSharedWeb/vendor/three.module.js';
import {GLTFLoader} from '../assets/dot/model/frozen/r07d/editable-stage/素材/v011/DotSharedWeb/vendor/GLTFLoader.js';
import {makeFiberAtlasAsync} from '../assets/dot/model/frozen/r07d/editable-stage/素材/v011/DotSharedWeb/dot-fiber-atlas.mjs';
import {makeDotShapeAsync} from '../assets/dot/model/frozen/r07d/editable-stage/素材/v011/DotSharedWeb/dot-shape-v4.mjs';
import {createDot,createDotAsync} from '../assets/dot/model/frozen/r07d/editable-stage/素材/v011/DotSharedWeb/dot-component.mjs';

const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const attributeHash=attribute=>hash(new Uint8Array(attribute.array.buffer,attribute.array.byteOffset,attribute.array.byteLength));
const asset=await fs.readFile(new URL('../assets/dot/model/assets/dot-character.glb',import.meta.url));
const sourceScene=async()=> (await new GLTFLoader().parseAsync(asset.buffer.slice(asset.byteOffset,asset.byteOffset+asset.byteLength),'')).scene;
const yieldTask=()=>new Promise(resolve=>setImmediate(resolve));

test('cooperative fibre construction yields while retaining all 4,194,304 original RGBA bytes',async()=>{
 let yields=0,heartbeat=0;const timer=setInterval(()=>heartbeat++,1);
 const texture=await makeFiberAtlasAsync({budgetMs:0,yieldTask:async()=>{yields++;await yieldTask();}});clearInterval(timer);
 assert.ok(yields>300);assert.ok(heartbeat>0,'other event-loop work runs before the atlas is complete');
 assert.equal(texture.image.data.length,4194304);
 // Captured from the unmodified r33 committed generator, not its async result.
 assert.equal(hash(texture.image.data),'aedee637a57ca3a621d6530c69c414547c625d6b8037777af332253870a8de0e');
 assert.equal(texture.generateMipmaps,true);assert.equal(texture.colorSpace,T.NoColorSpace);
 assert.equal(texture.wrapS,T.RepeatWrapping);assert.equal(texture.wrapT,T.RepeatWrapping);texture.dispose();
});

test('cooperative shape construction preserves the committed body, hat and both eyes byte for byte',async()=>{
 const scene=await sourceScene();scene.updateMatrixWorld(true);
 const mouth=scene.getObjectByName('MOUTHPIECE_FIXED_ANCHOR').getWorldPosition(new T.Vector3());mouth.z+=.003;
 const axis=new T.Vector3(1,0,0).transformDirection(scene.getObjectByName('TRUMPET_ASSEMBLY').matrixWorld);
 let yields=0;const shape=await makeDotShapeAsync(mouth,axis,{budgetMs:0,yieldTask:async()=>{yields++;await yieldTask();}});
 assert.ok(yields>300);
 // SHA-256 for position / normal / UV / index buffers measured with the
 // unmodified generator at commit 51f68a487174f1111cbced02ea30a45ab2fd0ab3.
 const expected={
  body:['9e1e5b5d05c1d55c96a62f5e5bcd331b0630eba70bdc808c74b9c238da44a177','52888e3c5dbedbf6a6a1403203084bf4813471639d40cc661022793af9282ff7','8ab2d0000c0ff8102f6e390d8b35d41e60250920ad5d8b37223c043383b6a54e','15750ae962dd5a5d6092f590ea20fe1374d3ffd59135feac9733d8f9d816128e'],
  hat:['429d351378be91a06ea2b9b99503af446ba72b72c47bd10e14e30452dc047a1e','141694570eba2f08df37897b474c2590a4238fdf08249bafc2af82f3e1396424','aa0cfe551f279a48351eb11dda9c22ecdc112c16f50225a75469d592cfa58ae4','87fa9d7d1ebcff2240f25f992a7879bb13f5cd3a18d491b7a57fba4ebcf816ba'],
  stem:['18adc529afcf628b3f5f74dabe11c5ae7ba1198b409d627817f101ef573916cb','4130860715f8e8765ee747f9c7b6f11aae1b69f1489ac60621d7449bdcc31067','06988966d6b0bb5c36ee85adc5f7204ba0937c8b49f2235ea2337885979f8719','65da62acce792e143f3902fddaea68841fb2f04905b680beaf916944d0c17311'],
  nearEye:['cd187b84842b71c67590eedc646327cc902329ac91d385220528d99dd99ab6a8','8ee32391732f628032f11528ce86bb0694b6ce6c84f468819402f425e9bff06f','b54b5838531b0ca75889f1c5eb045344a1a163ebc5a5468bd9db6ed52b8de980','5e4fa348d7c16d7103ef2e958fd5395c702a27abbef4b8d6a6471600888fa728'],
  farEye:['b1e382d8767d244ad2cd7a49256942a44d86a12bc272fd12b33d207a0fbcf332','1c725f8987467a947a5623e64cc0a47ad7b80774d9bcaf8e944f280a596e8dc6','b54b5838531b0ca75889f1c5eb045344a1a163ebc5a5468bd9db6ed52b8de980','5e4fa348d7c16d7103ef2e958fd5395c702a27abbef4b8d6a6471600888fa728']
 };
 for(const[name,hashes]of Object.entries(expected)){
  const g=shape[name];assert.deepEqual([g.attributes.position,g.attributes.normal,g.attributes.uv,g.index].map(attributeHash),hashes,name);g.dispose();
 }
 assert.deepEqual(shape.body.userData.thicknessSolver,{iterations:509,residual:9.423741109742359e-19});
});

test('the asynchronously prepared complete actor retains every mesh, morph, material and transform',async()=>{
 const before=createDot(await sourceScene()),after=await createDotAsync(await sourceScene(),{yieldTask});
 const geometry=g=>({attributes:Object.fromEntries(Object.entries(g.attributes).map(([k,a])=>[k,attributeHash(a)])),index:g.index&&attributeHash(g.index),morphs:Object.fromEntries(Object.entries(g.morphAttributes).map(([k,attrs])=>[k,attrs.map(attributeHash)]))});
 function actor(dot){const meshes=[];dot.root.updateMatrixWorld(true);dot.root.traverse(o=>{if(!o.isMesh)return;meshes.push({name:o.name,geometry:geometry(o.geometry),matrix:o.matrixWorld.toArray(),castShadow:o.castShadow,receiveShadow:o.receiveShadow,material:(Array.isArray(o.material)?o.material:[o.material]).map(m=>({type:m.type,name:m.name,color:m.color?.toArray(),roughness:m.roughness,metalness:m.metalness,opacity:m.opacity,transparent:m.transparent,depthWrite:m.depthWrite,key:m.customProgramCacheKey()}))});});return{meshes,mouth:dot.mouth.toArray(),axis:dot.axis.toArray(),morphCount:dot.morphs.length,surfaceStatus:dot.surfaceStatus};}
 assert.deepEqual(actor(after),actor(before));before.dispose();after.dispose();
});
