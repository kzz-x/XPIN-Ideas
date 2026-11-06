import * as THREE from './vendor/three.module.js';
import {makeFiberAtlas} from './dot-fiber-atlas.mjs';

// Both states use these exact instances. Object-space, derivative-filtered nap.
export const SURFACE_STATUS='short-fibre-v006 / locked v004 body, refined mouth-anchored brass';
const noiseGLSL=`
varying vec3 vDotSurface;
float dotHash(vec3 p){p=fract(p*.3183099+vec3(.13,.27,.41));p*=17.;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}
float dotNoise(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
return mix(mix(mix(dotHash(i),dotHash(i+vec3(1,0,0)),f.x),mix(dotHash(i+vec3(0,1,0)),dotHash(i+vec3(1,1,0)),f.x),f.y),
mix(mix(dotHash(i+vec3(0,0,1)),dotHash(i+vec3(1,0,1)),f.x),mix(dotHash(i+vec3(0,1,1)),dotHash(i+vec3(1,1,1)),f.x),f.y),f.z);}
`;
function microSurface(material,{frequency,height,variation,wrap=0,key}){
  material.onBeforeCompile=shader=>{
    shader.vertexShader='varying vec3 vDotSurface;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvDotSurface = position;');
    shader.fragmentShader=noiseGLSL+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`
#include <color_fragment>
vec3 dotP=vDotSurface*${frequency.toFixed(1)};
float dotFootprint=max(length(dFdx(dotP)),length(dFdy(dotP)));
float dotDetail=1.-smoothstep(.7,2.2,dotFootprint);
float dotNap=dotNoise(dotP*vec3(1.,1.45,1.));
float dotFine=dotNoise(dotP*2.6+vec3(17.,3.,9.));
float dotFineDetail=1.-smoothstep(.7,2.2,dotFootprint*2.6);
diffuseColor.rgb*=1.+(dotNap-.5)*${variation.toFixed(3)}*dotDetail;
`);
    shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>',`
#include <roughnessmap_fragment>
roughnessFactor=clamp(roughnessFactor+(dotNap-.5)*.055*dotDetail,.08,1.);
`);
    shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>',`
#include <normal_fragment_maps>
float dotHeight=((dotNap-.5)+.16*(dotFine-.5)*dotFineDetail)*${height.toFixed(6)}*dotDetail;
vec3 dotDx=dFdx(-vViewPosition),dotDy=dFdy(-vViewPosition);
vec3 dotR1=cross(dotDy,normal),dotR2=cross(normal,dotDx);
float dotDet=dot(dotDx,dotR1);
normal=normalize(max(abs(dotDet),1e-8)*normal-sign(dotDet)*(dFdx(dotHeight)*dotR1+dFdy(dotHeight)*dotR2));
`);
    if(wrap)shader.fragmentShader=shader.fragmentShader.replace('#include <lights_fragment_end>',`
#include <lights_fragment_end>
// Small cloth back-scatter driven by actual lights; no unlit halo.
#if NUM_DIR_LIGHTS > 0
for(int dotLight=0;dotLight<NUM_DIR_LIGHTS;dotLight++){
  float dotBack=max(0.,dot(-geometryNormal,directionalLights[dotLight].direction));
  float dotEdge=pow(1.-max(0.,dot(geometryNormal,geometryViewDir)),2.5);
  reflectedLight.indirectDiffuse+=diffuseColor.rgb*directionalLights[dotLight].color*dotBack*(.012+${wrap.toFixed(3)}*dotEdge);
}
#endif
`);
  };
  material.customProgramCacheKey=()=>key;
}
function shortFibres(material,atlas,key){
  const base=material.onBeforeCompile;
  material.onBeforeCompile=shader=>{
    base(shader);shader.uniforms.dotFiberAtlas={value:atlas};
    shader.vertexShader='varying vec3 vDotRestNormal;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('vDotSurface = position;','vDotSurface = position;vDotRestNormal=normal;');
    shader.fragmentShader=`uniform sampler2D dotFiberAtlas;varying vec3 vDotRestNormal;
vec3 dotFibres(vec3 p,vec3 n){
 vec3 w=pow(abs(normalize(n)),vec3(6.));w/=max(w.x+w.y+w.z,.0001);
 return texture2D(dotFiberAtlas,p.yz*.9+vec2(.13,.41)).rgb*w.x
       +texture2D(dotFiberAtlas,p.zx*.9+vec2(.37,.07)).rgb*w.y
       +texture2D(dotFiberAtlas,p.xy*.9+vec2(.61,.29)).rgb*w.z;
}\n`+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('vec3 dotP=',`
vec3 dotFiberChannels=dotFibres(vDotSurface,vDotRestNormal);
float dotFilament=dotFiberChannels.r;
// Closely packed, low-profile fibre coverage; no coarse displacement grooves.
diffuseColor.rgb*=.80+.62*dotFilament+.025*(dotFiberChannels.g-.5);
vec3 dotP=`);
    shader.fragmentShader=shader.fragmentShader.replace(/float dotHeight=[^;]+;/,'float dotHeight=(dotFilament-.34)*.00027+.000035*(dotFiberChannels.b-.5);');
  };
  material.customProgramCacheKey=()=>key;
}
export function makeDotMaterials({atlas=makeFiberAtlas()}={}){
  const body=new THREE.MeshPhysicalMaterial({name:'Dot / dense fine short fibres v005',
    color:'#0965ec',metalness:0,roughness:.94,specularIntensity:.10,
    sheen:.78,sheenColor:'#4d86ff',sheenRoughness:.85});
  microSurface(body,{frequency:148,height:.00010,variation:.018,wrap:.18,key:'dot-short-fibres-base-v005'});
  shortFibres(body,atlas,'dot-short-fibres-v005');
  body.addEventListener('dispose',()=>atlas.dispose());
  const fuzz=body.clone();fuzz.name='Dot / dense subpixel velvet nap';fuzz.transparent=true;fuzz.depthWrite=false;
  microSurface(fuzz,{frequency:148,height:.00010,variation:.018,wrap:.32,key:'dot-velvet-nap-v005'});
  shortFibres(fuzz,atlas,'dot-short-fibres-shell-v005');
  const fuzzSurface=fuzz.onBeforeCompile;
  fuzz.onBeforeCompile=shader=>{
    fuzzSurface(shader);
    shader.vertexShader='attribute float aDotShell;varying float vDotShell;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('vDotSurface = position;','vDotSurface = position;vDotShell=aDotShell;float dotLipFade=smoothstep(.10,.22,distance(position,vec3(.072,.135,.690)));transformed+=normal*.0055*aDotShell*dotLipFade;');
    shader.fragmentShader='varying float vDotShell;\n'+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>',`
float dotFiber=dotFiberChannels.r;
float dotCoverage=smoothstep(.12+.16*vDotShell,.32+.27*vDotShell,dotFiber);
float dotFuzzEdge=pow(1.-max(0.,dot(geometryNormal,geometryViewDir)),2.);
diffuseColor.a*=dotCoverage*mix(.030,.42,dotFuzzEdge);
#include <opaque_fragment>
`);
  };
  const hat=new THREE.MeshPhysicalMaterial({name:'Dot / soft black beret v2',
    color:'#121212',roughness:.54,metalness:0,specularIntensity:.4,
    sheen:.2,sheenColor:'#8e8c8b',sheenRoughness:.85});
  microSurface(hat,{frequency:210,height:.00038,variation:.05,key:'dot-beret-grain-v2'});
  const eyes=new THREE.MeshStandardMaterial({name:'Dot / eyes',color:'#020305',roughness:.57,metalness:0});
  const gold=new THREE.MeshPhysicalMaterial({name:'Dot / warm polished brass v005',
    color:'#f1b45f',metalness:1,roughness:.19,clearcoat:0});
  const goldDetail=new THREE.MeshPhysicalMaterial({name:'Dot / turned brass fittings',
    color:'#d49c51',metalness:1,roughness:.23,clearcoat:0});
  const silver=new THREE.MeshPhysicalMaterial({name:'Dot / silver mouthpiece',
    color:'#e0e6ee',metalness:1,roughness:.19,clearcoat:.1,clearcoatRoughness:.22});
  const inner=new THREE.MeshStandardMaterial({name:'Dot / inner brass',color:'#d79a45',metalness:1,roughness:.25});
  return {body,fuzz,hat,eyes,gold,goldDetail,silver,inner};
}
