import * as THREE from '../../dot/model/frozen/r07d/editable-stage/素材/v011/DotSharedWeb/vendor/three.module.js';

// Focus falloff for the distant room. Generated from its actual Three meshes,
// cached until the camera/viewport changes. No downloaded image enters the scene.
export function createRoomBackdrop(scene,camera){
  const a=new THREE.WebGLRenderTarget(768,432,{depthBuffer:true,type:THREE.HalfFloatType}),b=new THREE.WebGLRenderTarget(768,432,{depthBuffer:false,type:THREE.HalfFloatType}),c=b.clone();
  const haloA=new THREE.WebGLRenderTarget(256,144,{depthBuffer:false,type:THREE.HalfFloatType}),haloB=haloA.clone(),wideA=haloA.clone(),wideB=haloA.clone();
  const view=new THREE.PerspectiveCamera(),quadScene=new THREE.Scene(),ortho=new THREE.OrthographicCamera(-1,1,1,-1,0,1);
  const material=new THREE.ShaderMaterial({depthTest:false,depthWrite:false,toneMapped:false,uniforms:{source:{value:a.texture},step:{value:new THREE.Vector2()},cut:{value:-1}},
    vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}',
    fragmentShader:'uniform sampler2D source;uniform vec2 step;uniform float cut;varying vec2 vUv;void main(){vec3 c=vec3(0.);float sum=0.;for(int i=-4;i<=4;i++){float x=float(i),w=exp(-x*x/6.);vec3 s=texture2D(source,vUv+step*x).rgb;if(cut>0.)s=max(s-vec3(cut),vec3(0.));c+=s*w;sum+=w;}gl_FragColor=vec4(c/sum,1.);}'});
  const composite=new THREE.ShaderMaterial({depthTest:false,depthWrite:false,toneMapped:false,
    uniforms:{source:{value:c.texture},nearHalo:{value:haloB.texture},wideHalo:{value:wideB.texture}},
    vertexShader:material.vertexShader,
    fragmentShader:'uniform sampler2D source;uniform sampler2D nearHalo;uniform sampler2D wideHalo;varying vec2 vUv;void main(){vec3 c=texture2D(source,vUv).rgb;vec3 h=texture2D(nearHalo,vUv).rgb*.13+texture2D(wideHalo,vUv).rgb*.085;gl_FragColor=vec4(c+h,1.);}'});
  const quad=new THREE.Mesh(new THREE.PlaneGeometry(2,2),material);quadScene.add(quad);let signature='';const settings={maxWidth:640,haloWidth:192,halo:true,blur:.02},size=new THREE.Vector2();
  return {texture:a.texture,settings,invalidate(){signature='';},configure(next={}){let changed=false;for(const k of['maxWidth','haloWidth','halo','blur'])if(next[k]!==undefined&&next[k]!==settings[k]){settings[k]=next[k];changed=true}if(changed)signature='';},update(renderer){
    camera.updateMatrixWorld();renderer.getSize(size);const key=[...camera.matrixWorld.elements,...camera.projectionMatrix.elements,size.x,size.y].join(',');if(key===signature)return;signature=key;
    const w=Math.max(1,Math.round(Math.min(settings.maxWidth,size.x))),h=Math.max(1,Math.round(w*size.y/size.x));for(const t of[a,b,c])t.setSize(w,h);
    const hw=Math.min(settings.haloWidth,w),hh=Math.max(1,Math.round(hw*size.y/size.x));if(settings.halo)for(const t of[haloA,haloB,wideA,wideB])t.setSize(hw,hh);
    view.copy(camera,false);view.layers.set(1);
    const old=renderer.getRenderTarget(),shadow=renderer.shadowMap.autoUpdate;renderer.shadowMap.autoUpdate=false;
    renderer.setRenderTarget(a);renderer.render(scene,view);
    if(!settings.halo){renderer.setRenderTarget(old);renderer.shadowMap.autoUpdate=shadow;return;}
    quad.material=material;material.uniforms.cut.value=-1;
    material.uniforms.source.value=a.texture;material.uniforms.step.value.set(settings.blur/w,0);renderer.setRenderTarget(b);renderer.render(quadScene,ortho);
    material.uniforms.source.value=b.texture;material.uniforms.step.value.set(0,settings.blur/h);renderer.setRenderTarget(c);renderer.render(quadScene,ortho);
    // Cached background-only selective HDR halo. Actor and floor never enter
    // this bright pass, so neither can be washed out by a full-frame bloom.
    material.uniforms.source.value=c.texture;material.uniforms.cut.value=1.5;material.uniforms.step.value.set(1.1/hw,0);renderer.setRenderTarget(haloA);renderer.render(quadScene,ortho);
    material.uniforms.cut.value=-1;material.uniforms.source.value=haloA.texture;material.uniforms.step.value.set(0,1.1/hh);renderer.setRenderTarget(haloB);renderer.render(quadScene,ortho);
    material.uniforms.source.value=haloB.texture;material.uniforms.step.value.set(7./hw,0);renderer.setRenderTarget(wideA);renderer.render(quadScene,ortho);
    material.uniforms.source.value=wideA.texture;material.uniforms.step.value.set(0,7./hh);renderer.setRenderTarget(wideB);renderer.render(quadScene,ortho);
    quad.material=composite;renderer.setRenderTarget(a);renderer.render(quadScene,ortho);quad.material=material;
    renderer.setRenderTarget(old);renderer.shadowMap.autoUpdate=shadow;
  },dispose(){for(const t of[a,b,c,haloA,haloB,wideA,wideB])t.dispose();quad.geometry.dispose();material.dispose();composite.dispose();}};
}
