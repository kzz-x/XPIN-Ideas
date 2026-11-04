import * as THREE from '../../dot/model/frozen/r07d/editable-stage/素材/v011/DotSharedWeb/vendor/three.module.js';

// Live, bounded, rough planar reflection of the actual scene. No image backdrop.
export function createFloorReflection(scene,camera,floor,y=-2,roomBackground=scene.background,getActorFootprints=null){
  const target=new THREE.WebGLRenderTarget(512,288,{depthBuffer:true,type:THREE.HalfFloatType});
  const blurA=new THREE.WebGLRenderTarget(256,144,{depthBuffer:false,type:THREE.HalfFloatType}),blurB=blurA.clone();
  for(const t of[target,blurA,blurB])t.texture.colorSpace=THREE.NoColorSpace;
  const mirror=new THREE.PerspectiveCamera(),matrix=new THREE.Matrix4();
  const bias=new THREE.Matrix4().set(.5,0,0,.5,0,.5,0,.5,0,0,.5,.5,0,0,0,1);
  const look=new THREE.Vector3(),direction=new THREE.Vector3();
  const blurScene=new THREE.Scene(),blurCamera=new THREE.OrthographicCamera(-1,1,1,-1,0,1);
  const blurMaterial=new THREE.ShaderMaterial({depthTest:false,depthWrite:false,toneMapped:false,
    uniforms:{source:{value:target.texture},step:{value:new THREE.Vector2()}},
    vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}',
    fragmentShader:`uniform sampler2D source;uniform vec2 step;varying vec2 vUv;
      void main(){vec3 c=vec3(0.);float total=0.;for(int i=-6;i<=6;i++){float x=float(i),w=exp(-x*x/18.);c+=texture2D(source,vUv+step*x).rgb*w;total+=w;}gl_FragColor=vec4(c/total,1.);}`});
  const quad=new THREE.Mesh(new THREE.PlaneGeometry(2,2),blurMaterial);blurScene.add(quad);
  const settings={enabled:true,width:384},black=new THREE.DataTexture(new Uint8Array([0,0,0,255]),1,1);black.needsUpdate=true;let floorShader;const encore={centre:new THREE.Vector2(),follow:0,lift:.014,strength:.28};const blueFootprint=new THREE.Vector2(-.46,.55),goldFootprint=new THREE.Vector2(1.7,1.);
  floor.material.onBeforeCompile=shader=>{
    floorShader=shader;shader.uniforms.encoreFollowCentre={value:encore.centre};shader.uniforms.encoreFollowGain={value:encore.follow};shader.uniforms.encoreFloorLift={value:encore.lift};shader.uniforms.encoreReflectionStrength={value:encore.strength};shader.uniforms.dotBlueFootprint={value:blueFootprint};shader.uniforms.dotGoldFootprint={value:goldFootprint};shader.uniforms.dotReflection={value:settings.enabled?blurB.texture:black};shader.uniforms.dotReflectionMatrix={value:matrix};
    shader.vertexShader='uniform mat4 dotReflectionMatrix;varying vec4 vFloorReflection;varying vec3 vFloorWorld;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>',`
#include <project_vertex>
vec4 dotFloorWorld=modelMatrix*vec4(transformed,1.);
vFloorWorld=dotFloorWorld.xyz;vFloorReflection=dotReflectionMatrix*dotFloorWorld;
`);
    shader.fragmentShader='uniform vec2 encoreFollowCentre;uniform float encoreFollowGain,encoreFloorLift,encoreReflectionStrength;uniform vec2 dotBlueFootprint;uniform vec2 dotGoldFootprint;uniform sampler2D dotReflection;varying vec4 vFloorReflection;varying vec3 vFloorWorld;\n'+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>',`
vec2 dotUv=vFloorReflection.xy/vFloorReflection.w;
float dotGrain=sin(vFloorWorld.x*291.+sin(vFloorWorld.z*317.))*sin(vFloorWorld.z*249.+vFloorWorld.x*37.);
float dotFloorFootprint=max(length(dFdx(vFloorWorld.xz)),length(dFdy(vFloorWorld.xz)))*300.;
dotGrain*=1.-smoothstep(.3,1.5,dotFloorFootprint);
vec3 dotMirror=texture2D(dotReflection,dotUv+vec2(dotGrain,-dotGrain)*.00055).rgb;
// Bound HDR screen radiance before the artistic rough-floor reflectance;
// keep the reflected screen visible without making a second luminous panel.
dotMirror=dotMirror/(vec3(1.)+dotMirror*.85);
float dotFloorFade=1.-smoothstep(18.,42.,distance(vFloorWorld,vec3(0.,-1.67,-4.)));
// Art-directed matte indirect illumination; suppresses grazing mirror glare.
float dotScreenBounce=exp(-pow((vFloorWorld.z+5.)/4.,2.));
outgoingLight*=.90;
outgoingLight+=vec3(.018,.020,.023)*dotScreenBounce;
outgoingLight+=dotMirror*encoreReflectionStrength*dotFloorFade;
// A broad, low-energy pool in the actual floor shader, driven by root mass
// motion, not local high-frequency breathing. No extra transparent plane.
vec2 encoreUV=(vFloorWorld.xz-encoreFollowCentre)/vec2(2.1,3.4);
outgoingLight+=vec3(.8,.86,1.)*encoreFloorLift*(.32+.68*dotScreenBounce);
outgoingLight+=vec3(1.,.91,.76)*encoreFollowGain*exp(-dot(encoreUV,encoreUV)*1.5);
outgoingLight*=1.+dotGrain*.035;
// Low-energy blue/brass diffuse bounce below the floating objects.
vec2 dotBlue=(vFloorWorld.xz-dotBlueFootprint)/vec2(1.15,3.);
vec2 dotGold=(vFloorWorld.xz-dotGoldFootprint)/vec2(.85,3.);
outgoingLight+=vec3(.0003,.002,.025)*exp(-dot(dotBlue,dotBlue));
outgoingLight+=vec3(.014,.006,.001)*exp(-dot(dotGold,dotGold));
#include <opaque_fragment>
`);
  };
  floor.material.customProgramCacheKey=()=> 'dot-white-encore-live-floor-v020';
  function render(renderer,drawScene=null){
    const paint=(view)=>drawScene?drawScene(renderer,view):renderer.render(scene,view);
    if(getActorFootprints){const p=getActorFootprints();blueFootprint.set(p.blue.x,p.blue.z);goldFootprint.set(p.gold.x,p.gold.z);}
    if(!settings.enabled){paint(camera);return;}
    const width=settings.width,height=Math.max(1,Math.round(width/camera.aspect));target.setSize(width,height);blurA.setSize(Math.round(width/2),Math.round(height/2));blurB.setSize(blurA.width,blurA.height);
    camera.updateMatrixWorld();mirror.copy(camera,false);mirror.layers.enable(1);mirror.position.copy(camera.position);mirror.position.y=2*y-camera.position.y;
    camera.getWorldDirection(direction);look.copy(camera.position).add(direction);look.y=2*y-look.y;
    mirror.up.set(0,-1,0);mirror.lookAt(look);mirror.updateMatrixWorld();
    matrix.copy(bias).multiply(mirror.projectionMatrix).multiply(mirror.matrixWorldInverse);
    const oldTarget=renderer.getRenderTarget(),oldShadow=renderer.shadowMap.autoUpdate;
    const background=scene.background;scene.background=roomBackground;
    const floorWasVisible=floor.visible;floor.visible=false;renderer.setRenderTarget(target);paint(mirror);floor.visible=floorWasVisible;scene.background=background;renderer.shadowMap.autoUpdate=false;
    blurMaterial.uniforms.source.value=target.texture;blurMaterial.uniforms.step.value.set(2.2/blurA.width,0);renderer.setRenderTarget(blurA);renderer.render(blurScene,blurCamera);
    blurMaterial.uniforms.source.value=blurA.texture;blurMaterial.uniforms.step.value.set(0,2.2/blurA.height);renderer.setRenderTarget(blurB);renderer.render(blurScene,blurCamera);
    renderer.setRenderTarget(oldTarget);paint(camera);renderer.shadowMap.autoUpdate=oldShadow;
  }
  return {render,settings,encore,releaseBuffers(){for(const t of[target,blurA,blurB]){t.setSize(1,1);t.dispose();}},configure(next={}){if(Array.isArray(next.encoreFollowCentre)&&next.encoreFollowCentre.length===2&&next.encoreFollowCentre.every(Number.isFinite))encore.centre.fromArray(next.encoreFollowCentre);for(const[key,source]of[["follow","encoreFollowGain"],["lift","encoreFloorLift"],["strength","encoreReflectionStrength"]])if(Number.isFinite(next[source]))encore[key]=Math.max(0,Math.min(key==="strength"?.55:.12,next[source]));if(floorShader){floorShader.uniforms.encoreFollowGain.value=encore.follow;floorShader.uniforms.encoreFloorLift.value=encore.lift;floorShader.uniforms.encoreReflectionStrength.value=encore.strength;}if(typeof next.enabled==='boolean')settings.enabled=next.enabled;if(Number.isFinite(next.width))settings.width=Math.max(128,Math.min(512,Math.round(next.width)));if(floorShader)floorShader.uniforms.dotReflection.value=settings.enabled?blurB.texture:black;},dispose(){black.dispose();for(const t of[target,blurA,blurB])t.dispose();quad.geometry.dispose();blurMaterial.dispose();}};
}
