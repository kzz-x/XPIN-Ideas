import * as T from '../../dot/model/frozen/r07d/editable-stage/素材/v011/DotSharedWeb/vendor/three.module.js';

// Bounded real-depth gather after the live scene render. A broad focal band
// keeps the face and the instrument sharp; foreground/background can defocus.
// No reference image or pre-rendered frame is used.
export function createStageFocus(camera,{displayScreen=null}={}){
 const depth=new T.DepthTexture(1,1,T.UnsignedIntType);
 const target=new T.WebGLRenderTarget(1,1,{type:T.HalfFloatType,depthTexture:depth,depthBuffer:true});
 target.samples=0;
 const scene=new T.Scene(),ortho=new T.OrthographicCamera(-1,1,1,-1,0,1),size=new T.Vector2();
 const settings={strength:.8,distance:8.55,width:1.7,enabled:true,samples:8,scale:1,msaa:0},sceneStats={triangles:0,calls:0};
 const worldScreenPlane=new T.Plane(new T.Vector3(0,0,1),-(displayScreen?.z||0)),screenPlaneView=worldScreenPlane.clone();
 const material=new T.ShaderMaterial({depthTest:false,depthWrite:false,toneMapped:true,
  uniforms:{screenIsDisplay:{value:displayScreen?.enabled?1:0},screenPlaneView:{value:new T.Vector4()},cameraProjectionInverse:{value:new T.Matrix4()},viewToWorld:{value:new T.Matrix4()},screenXY:{value:new T.Vector4(displayScreen?.minX||0,displayScreen?.minY||0,displayScreen?.maxX||0,displayScreen?.maxY||0)},source:{value:target.texture},sceneDepth:{value:depth},texel:{value:new T.Vector2(1,1)},cameraNear:{value:camera.near},cameraFar:{value:camera.far},focusDistance:{value:settings.distance},focusWidth:{value:settings.width},strength:{value:settings.strength},sampleCount:{value:8}},
  vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}',
  fragmentShader:`uniform float screenIsDisplay;uniform vec4 screenPlaneView;uniform mat4 cameraProjectionInverse;uniform mat4 viewToWorld;uniform vec4 screenXY;uniform sampler2D source;uniform sampler2D sceneDepth;uniform vec2 texel;uniform float cameraNear,cameraFar,focusDistance,focusWidth,strength;uniform int sampleCount;varying vec2 vUv;
  #include <common>
  float viewDepth(vec2 uv){float z=texture2D(sceneDepth,uv).x;return cameraNear*cameraFar/(cameraFar-z*(cameraFar-cameraNear));}
  float coc(float d){return min(1.,max(0.,abs(d-focusDistance)-focusWidth)/3.5)*strength*14.;}
  float displayScreenPixel(vec2 uv,float d){vec4 p=cameraProjectionInverse*vec4(uv*2.-1.,1.,1.);vec3 ray=p.xyz/p.w;float den=dot(screenPlaneView.xyz,ray);if(abs(den)<1e-6)return 0.;float t=-screenPlaneView.w/den;vec3 world=(viewToWorld*vec4(ray*t,1.)).xyz;float inside=step(screenXY.x,world.x)*step(screenXY.y,world.y)*step(world.x,screenXY.z)*step(world.y,screenXY.w);return screenIsDisplay*inside*step(0.,t)*(1.-step(.04,abs(d+ray.z*t)));}
  void main(){float d=viewDepth(vUv),r=coc(d);vec4 centre=texture2D(source,vUv);float coverage=centre.a;vec3 c=centre.rgb/max(coverage,.00001);
    if(r>.25&&coverage>.001){vec3 sum=centre.rgb;float weight=coverage;for(int i=0;i<16;i++){
      if(i>=sampleCount)break;float f=float(i)+.5,angle=f*2.39996323;vec2 q=vUv+vec2(cos(angle),sin(angle))*sqrt(f/float(sampleCount))*r*texel;
      float sd=viewDepth(q),sr=coc(sd);float w=(sd<d-.5&&sr<r*.7)?0.:1.;vec4 tap=texture2D(source,q);sum+=tap.rgb*w;weight+=tap.a*w;
    }c=sum/max(weight,.00001);}
    gl_FragColor=vec4(c,coverage);
    #include <tonemapping_fragment>
    // Display-referred placeholder keeps original colors; classification uses
    // actual3Dplane/depth, never a painted mask on the actor. HDRproviders useACES.
    if(displayScreenPixel(vUv,d)>.5)gl_FragColor.rgb=c;
    #include <colorspace_fragment>
    // The live RT is premultiplied by normal blending. Tone-map straight colour
    // above, then restore premultiplied output for the transparent browser canvas.
    gl_FragColor.rgb*=coverage;
  }`});
 const quad=new T.Mesh(new T.PlaneGeometry(2,2),material);scene.add(quad);
 function configure(next={}){
  if(Number.isFinite(next.strength))settings.strength=T.MathUtils.clamp(next.strength,0,1);
  if(Number.isFinite(next.distance))settings.distance=T.MathUtils.clamp(next.distance,.1,camera.far);
  if(Number.isFinite(next.width))settings.width=T.MathUtils.clamp(next.width,.25,20);
  if(typeof next.enabled==='boolean')settings.enabled=next.enabled;
  if([4,8,16].includes(next.samples))settings.samples=next.samples;
  if(Number.isFinite(next.scale))settings.scale=T.MathUtils.clamp(next.scale,.5,1);
  if([0,2,4].includes(next.msaa)&&settings.msaa!==next.msaa){settings.msaa=next.msaa;target.samples=next.msaa;target.dispose();}
  material.uniforms.sampleCount.value=settings.samples;
  material.uniforms.strength.value=settings.strength;material.uniforms.focusDistance.value=settings.distance;material.uniforms.focusWidth.value=settings.width;
 }
 function render(renderer,draw){
  if(!settings.enabled||settings.strength===0){draw();Object.assign(sceneStats,renderer.info.render);return;}
  camera.updateMatrixWorld();screenPlaneView.copy(worldScreenPlane).applyMatrix4(camera.matrixWorldInverse);material.uniforms.screenPlaneView.value.set(screenPlaneView.normal.x,screenPlaneView.normal.y,screenPlaneView.normal.z,screenPlaneView.constant);material.uniforms.cameraProjectionInverse.value.copy(camera.projectionMatrixInverse);material.uniforms.viewToWorld.value.copy(camera.matrixWorld);
  renderer.getDrawingBufferSize(size);const w=Math.max(1,Math.round(size.x*settings.scale)),h=Math.max(1,Math.round(size.y*settings.scale));if(target.width!==w||target.height!==h)target.setSize(w,h);
  material.uniforms.texel.value.set(1/w,1/h);material.uniforms.cameraNear.value=camera.near;material.uniforms.cameraFar.value=camera.far;
  const old=renderer.getRenderTarget();renderer.setRenderTarget(target);draw();Object.assign(sceneStats,renderer.info.render);renderer.setRenderTarget(old);renderer.render(scene,ortho);
 }
 return{configure,render,settings,sceneStats,releaseBuffers(){target.setSize(1,1);target.dispose();},dispose(){target.dispose();depth.dispose();quad.geometry.dispose();material.dispose();}};
}
