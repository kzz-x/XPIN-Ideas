import {oldStageShadowGain} from './recovery-cues-r01.mjs';
import {makeVolumeGeometry,makeVolumeMaterial} from './recovery-volume-light-r01.mjs';
import * as T from '../../dot/model/frozen/r07d/editable-stage/素材/v011/DotSharedWeb/vendor/three.module.js';
import {SHOT} from './document.mjs';
const sat=x=>Math.max(0,Math.min(1,x)),smooth=(a,b,t)=>{const u=sat((t-a)/(b-a));return u*u*(3-2*u);};

// Approved image 1Ae2EnKgX3KBWZdg2ml102nr-Y570aJhl was inspected as actual pixels.
// Geometry/material preparation only: no claim of a rendered match or browser FPS yet.
export const ANCHOR_ID='0ed5b6a3e2039bef8939a3676efca5b2c18e2315f757a67cd75515588db6a8a3';
function concreteTextures(){
 const size=512,colour=new Uint8Array(size*size*4),surface=new Uint8Array(size*size*4);
 const h=(x,y)=>{let n=Math.imul(x+811,374761393)^Math.imul(y+917,668265263);n=Math.imul(n^(n>>>13),1274126177);return((n^(n>>>16))>>>0)/4294967295;};
 const noise=(x,y)=>{let i=Math.floor(x),j=Math.floor(y),u=x-i,v=y-j;u=u*u*(3-2*u);v=v*v*(3-2*v);return T.MathUtils.lerp(T.MathUtils.lerp(h(i,j),h(i+1,j),u),T.MathUtils.lerp(h(i,j+1),h(i+1,j+1),u),v);};
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const i=(y*size+x)*4,mottle=noise(x/93,y/93)*.5+noise(x/27,y/27)*.29+noise(x/7,y/7)*.21,fine=h(x,y),pit=fine>.994?-.22:0;
  const c=Math.round(197+(mottle-.5)*12+(fine-.5)*5+pit*30),rough=Math.round(191+(mottle-.5)*14+pit*12);
  colour.set([c,Math.max(0,c-2),Math.max(0,c-5),255],i);surface.set([rough,rough,rough,255],i);
 }
 const map=new T.DataTexture(colour,size,size,T.RGBAFormat),rough=new T.DataTexture(surface,size,size,T.RGBAFormat);
 map.colorSpace=T.SRGBColorSpace;rough.colorSpace=T.NoColorSpace;
 for(const t of[map,rough]){t.wrapS=t.wrapT=T.RepeatWrapping;t.repeat.set(12,10);t.generateMipmaps=true;t.minFilter=T.LinearMipmapLinearFilter;t.magFilter=T.LinearFilter;t.anisotropy=4;t.needsUpdate=true;}
 return{map,rough};
}
const beamMaterial=makeVolumeMaterial;
function poolMaterial(){return new T.ShaderMaterial({transparent:true,depthWrite:false,depthTest:true,blending:T.AdditiveBlending,toneMapped:false,
 uniforms:{gain:{value:0}},vertexShader:'varying vec2 v;void main(){v=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
 fragmentShader:'varying vec2 v;uniform float gain;void main(){vec2 p=(v-.5)*2.;float a=exp(-dot(p,p)*4.8)*(1.-smoothstep(.48,1.,length(p)));gl_FragColor=vec4(vec3(1.),a*gain);}'});}

export function createConcertVenue(stage,layout,finale){
 const root=new T.Group();root.name='CDX r06 / approved stage anchor / prepared geometry';stage.scene.add(root);
 const s=layout.screen,cx=s.x,deck=-1.67,top=s.y+s.height/2+.82,half=s.width/2+2.65;
 stage.scene.children.filter(o=>o.isLight&&(o.layers.mask&1)).forEach(o=>o.layers.enable(2));
 const savedRimLayer=stage.rim?.layers.mask;if(stage.rim){stage.rim.layers.set(2);stage.camera.layers.enable(2);stage.dot?.root.traverse(o=>{if(o.isMesh)o.layers.set(2);});}
 const hidden=[];stage.scene.traverse(o=>{if(o.name.startsWith('Bridge /')&&(/rear wall|rear side wing|ceiling|screen frame/.test(o.name))){hidden.push([o,o.visible]);o.visible=false;}});
 const charcoal=new T.MeshStandardMaterial({color:'#151514',roughness:.72,metalness:.18,envMapIntensity:.07});
 const satin=new T.MeshStandardMaterial({color:'#34312c',roughness:.48,metalness:.60,envMapIntensity:.085});
 const casing=new T.MeshStandardMaterial({color:'#181919',roughness:.38,metalness:.52});
 for(const m of [charcoal,satin,casing]){m.envMap=stage.scene.environment;m.envMapIntensity=m===satin?.085:m===charcoal?.07:.12;}
 const led=new T.MeshBasicMaterial({color:'#f4e7d3',toneMapped:false});
 const add=(g,m,name,p)=>{const o=new T.Mesh(g,m);o.name='CDX r06 / '+name;o.position.set(...p);o.receiveShadow=true;root.add(o);return o;};
 const inst=(g,m,name,list)=>{const o=new T.InstancedMesh(g,m,list.length),d=new T.Object3D();o.name='CDX r06 / '+name;list.forEach((p,i)=>{d.position.set(...p);d.updateMatrix();o.setMatrixAt(i,d.matrix);});o.receiveShadow=true;root.add(o);return o;};

 // A finite deck exposes actual stair treads instead of burying them under an infinite plane.
 stage.floor.geometry.dispose();stage.floor.geometry=new T.PlaneGeometry(half*2+3,21.6);stage.floor.position.z=2.5;
 const texture=concreteTextures(),old=stage.floor.material,hook=old.onBeforeCompile;
 const floor=new T.MeshPhysicalMaterial({color:'#66615a',map:texture.map,roughness:.72,roughnessMap:texture.rough,bumpMap:texture.rough,bumpScale:.006,metalness:.045,clearcoat:.06,clearcoatRoughness:.64,envMap:stage.scene.environment,envMapIntensity:.12});
 floor.onBeforeCompile=hook;floor.customProgramCacheKey=()=> 'CDX-r06-anchor-concrete-live-reflection';stage.floor.material=floor;old.dispose();
 for(let i=0;i<3;i++)add(new T.BoxGeometry(half*2+3+i*.25,.13,.66),[casing,casing,floor,casing,casing,casing],'front apron step '+i,[cx,deck-.065-i*.13,13.63+i*.66]);

 add(new T.BoxGeometry(half*2+.5,top-deck+.5,.42),charcoal,'solid rear proscenium',[cx,(top+deck)/2,s.z-.44]);
 add(new T.BoxGeometry(half*2+.5,.48,17.6),charcoal,'enclosed ceiling',[cx,top+.22,3.0]);
 for(const side of[-1,1])add(new T.BoxGeometry(.48,top-deck+.5,17.6),charcoal,'solid side enclosure '+side,[cx+side*half,(top+deck)/2,3.0]);
 const fins=[],sideFins=[],strips=[];
 for(const side of[-1,1]){
  for(let i=0;i<16;i++)fins.push([cx+side*(s.width/2+.32+i*.145),(top+deck)/2,s.z+.04]);
  for(let i=0;i<38;i++)sideFins.push([cx+side*(half-.27),(top+deck)/2,s.z+.3+i*.405]);
  for(let i=0;i<5;i++)strips.push([cx+side*(half-.31),(top+deck)/2,-4.55+i*2.7]);
 }
 inst(new T.BoxGeometry(.065,top-deck,.20),satin,'front fluted metal returns',fins);
 inst(new T.BoxGeometry(.13,top-deck,.065),satin,'depth fluted side walls',sideFins);
 inst(new T.BoxGeometry(.018,top-deck-.35,.028),led,'recessed architectural strips',strips);
 add(new T.BoxGeometry(s.width+.40,.22,.36),casing,'screen top deep bezel',[cx,s.y+s.height/2+.11,s.z-.04]);
 add(new T.BoxGeometry(s.width+.40,.20,.36),casing,'screen lower deep bezel',[cx,s.y-s.height/2-.10,s.z-.04]);
 for(const side of[-1,1])add(new T.BoxGeometry(.20,s.height,.36),casing,'screen side deep bezel '+side,[cx+side*(s.width/2+.10),s.y,s.z-.04]);
 add(new T.BoxGeometry(s.width-.25,.022,.040),led,'ceiling cove strip',[cx,top-.20,s.z+.35]);
 const ambient=new T.HemisphereLight('#eeebe5','#151617',.30);root.add(ambient);

 // Moving heads are physical fixtures. Camera-facing tapered haze is an explicit
 // bounded volumetric approximation; real spots and floor footprints share targets.
 const fixtures=[],beams=[],planes=makeVolumeGeometry(),floorPlane=new T.PlaneGeometry(1,1);
 const origin=new T.Vector3(),target=new T.Vector3(),mid=new T.Vector3(),right=new T.Vector3(),up=new T.Vector3(),axis=new T.Vector3(),view=new T.Vector3(),basis=new T.Matrix4();
 for(let i=0;i<16;i++){
  const side=i%2?1:-1,row=Math.floor(i/2),position=new T.Vector3(cx+side*(row<2?half-1.4:half-.6),row<2?top-.6:top-1.9-(row%3)*1.65,row<2?1.8+row*4.2:-3.9+(row-2)*1.8);
  const fixture=new T.Group();fixture.name='CDX r06 / real moving head '+i;fixture.position.copy(position);root.add(fixture);
  const housing=new T.Mesh(new T.CylinderGeometry(.19,.24,.48,16),casing);housing.rotation.x=Math.PI/2;fixture.add(housing);
  const lens=new T.Mesh(new T.CircleGeometry(.145,24),new T.MeshBasicMaterial({color:'#ffffff',toneMapped:false}));lens.position.z=.247;fixture.add(lens);
  for(const sign of[-1,1]){const arm=new T.Mesh(new T.BoxGeometry(.06,.40,.30),casing);arm.position.set(sign*.26,.04,-.02);fixture.add(arm);}
  const beam=new T.Mesh(planes,beamMaterial());beam.frustumCulled=false;beam.name='Recovery r01 / integrated white cone volume '+i;root.add(beam);
  const pool=new T.Mesh(floorPlane,poolMaterial());pool.rotation.x=-Math.PI/2;pool.name='CDX r06 / tracked floor footprint '+i;root.add(pool);
  const light=i<4?new T.SpotLight('#ffffff',0,45,.16,.8,2):null;if(light){light.position.copy(position);light.castShadow=false;root.add(light,light.target);}
  fixtures.push(fixture);beams.push({from:position,beam,pool,light,index:i,side});
 }
 function setBeam(mesh,from,to,width,gain,time){up.copy(to).sub(from);const length=up.length();if(length<1e-5){mesh.visible=false;return;}up.multiplyScalar(1/length);mid.copy(from).lerp(to,.5);view.copy(stage.camera.position).sub(mid);right.crossVectors(up,view);if(right.lengthSq()<1e-8)right.set(1,0,0);right.normalize();axis.crossVectors(right,up).normalize();basis.makeBasis(right,up,axis);mesh.quaternion.setFromRotationMatrix(basis);mesh.position.copy(mid);mesh.scale.set(width,length,width);mesh.material.uniforms.beamFrom.value.copy(from);mesh.material.uniforms.beamTo.value.copy(to);mesh.material.uniforms.beamWidth.value=width;mesh.material.uniforms.gain.value=gain;mesh.material.uniforms.time.value=time;mesh.visible=gain>.0001;}

 const contactMaterial=new T.ShaderMaterial({transparent:true,depthWrite:false,depthTest:true,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1,uniforms:{opacity:{value:0}},vertexShader:'varying vec2 v;void main(){v=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:'varying vec2 v;uniform float opacity;void main(){vec2 q=(v-.5)*2.;float a=exp(-dot(q,q)*4.8)*(1.-smoothstep(.65,1.,length(q)));gl_FragColor=vec4(vec3(.012,.013,.015),a*opacity);}'});
 const contact=new T.Mesh(new T.PlaneGeometry(1,1),contactMaterial);contact.name='CDX r06b / soft actor contact';contact.rotation.x=-Math.PI/2;contact.renderOrder=1;root.add(contact);const actorBox=new T.Box3();
 function update(time,actor,settings={},project={events:[],offset:0}){
  if(finale?.legacyRoot)finale.legacyRoot.visible=false;if(finale?.root)finale.root.visible=false;
  if(stage.dot?.body){actorBox.setFromObject(stage.dot.body);const gap=Math.max(0,actorBox.min.y-deck);contact.position.set(actor.x,deck+.004,actor.z);contact.scale.set(1.65+gap*.7,1.3+gap*.6,1);contactMaterial.uniforms.opacity.value=.42*Math.exp(-gap*1.1)*oldStageShadowGain(time);contact.visible=oldStageShadowGain(time)>0;}
  const reduced=!!globalThis.DOT_REDUCED_LIGHTING||!!settings.reducedLighting;
  const audible=Number.isFinite(globalThis.DOT_AUDIBLE_MUSIC_END)?globalThis.DOT_AUDIBLE_MUSIC_END:SHOT.musicEnd;
  const extinction=1-smooth(audible,audible+1.35,time),on=smooth(.65,2,time)*extinction,gain=(settings.beamStrength??.78)*(reduced?.48:1);
  let beat=0,eventIndex=-1;for(let n=0;n<(project.events||[]).length;n++){const e=project.events[n],age=time-(e.start+SHOT.dotOrigin+(project.offset||0));if(age>=0&&age<.30){const q=e.strength*Math.exp(-age/.13);if(q>beat){beat=q;eventIndex=n;}}}
  for(const b of beams){const i=b.index,motionTime=Math.min(time,audible),pace=reduced?.28:.65,pan=Math.sin(motionTime*pace+i*.91),sweep=Math.sin(motionTime*pace*.68+i*1.41);
   target.set(cx+pan*(reduced?4.0:8.7),deck+.008,4.5+sweep*5.5);
   const relay=(i===((eventIndex+16)%16)||i===(eventIndex+7+16)%16)?beat:0;
   const climax=smooth(10.35+i*.105,11.8+i*.105,motionTime),pulse=time<audible&&!reduced?climax*smooth(.72,.98,.5+.5*Math.sin(motionTime*(21+i%4*1.8)+i*1.73)):0;
   const strength=on*gain*(.080+(reduced?.012:.045)*relay+.13*pulse),width=2.1+.9*(.5+.5*Math.sin(motionTime*.32+i));
   setBeam(b.beam,b.from,target,width,strength,motionTime);fixtures[i].lookAt(target);
   b.pool.position.copy(target);b.pool.scale.set(width*1.7,2.0+Math.abs(b.from.z-target.z)*.22,1);b.pool.material.uniforms.gain.value=on*(.055+relay*.045+pulse*.025)*(reduced?.5:1);b.pool.visible=on>.001;
   if(b.light){b.light.target.position.copy(target);b.light.intensity=on*(32+relay*12+pulse*18)*(reduced?.55:1);}
  }
  return{oldStageShadowGain:oldStageShadowGain(time),oldStageContactOpacity:contactMaterial.uniforms.opacity.value,anchorSHA256:ANCHOR_ID,movingWhiteHeads:16,realSweepLights:4,independentFollowspot:false,headFollowspotRemoved:true,volumeMethod:'bounded physical cone geometry; 12-sample camera-ray density integration',motionFrozenAfterMusic:true,strobeIndividualHeads:true,floorLightFootprints:16,architecturalFinCount:fins.length+sideFins.length,concreteBump:true,roughLiveReflection:true,beat,relayEvent:eventIndex,reducedLighting:reduced,lightsExtinction:extinction,audibleCueSource:Number.isFinite(globalThis.DOT_AUDIBLE_MUSIC_END)?'explicit reviewed audible end':'container-end fallback; audible review pending'};
 }
 return{root,follow:null,contact,update,dispose(){for(const[o,visible]of hidden)o.visible=visible;if(stage.rim&&savedRimLayer!==undefined)stage.rim.layers.mask=savedRimLayer;root.removeFromParent();const gs=new Set(),ms=new Set();root.traverse(o=>{if(o.geometry)gs.add(o.geometry);if(o.material)for(const m of Array.isArray(o.material)?o.material:[o.material])ms.add(m);});for(const g of gs)g.dispose();for(const m of ms)if(m!==floor)m.dispose();texture.map.dispose();texture.rough.dispose();}};
}
