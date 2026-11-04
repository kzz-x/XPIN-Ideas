import * as THREE from '../../../dot/model/frozen/r07d/editable-stage/素材/v011/DotSharedWeb/vendor/three.module.js';
import {createFloorReflection} from './stage-reflection.mjs';
import {createRoomBackdrop} from './stage-background.mjs';
import {createStageFocus} from './stage-focus.mjs';
import {makeScreenFrame,addRoomDetail} from './stage-architecture.mjs';

// Camera/room only. Reusable actor, surfaces and breath remain in the component.
export function makeEnvironment(){
  const w=1024,h=512,a=new Float32Array(w*h*4);
  const softRect=(x,y,cx,cy,hx,hy,edge)=>(1-THREE.MathUtils.smoothstep(Math.abs(x-cx),hx-edge,hx+edge))*(1-THREE.MathUtils.smoothstep(Math.abs(y-cy),hy-edge,hy+edge));
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
    const phi=(x/w-.5)*Math.PI*2,theta=(y/h-.5)*Math.PI;
    const dx=Math.cos(phi)*Math.cos(theta),dy=Math.sin(theta),dz=Math.sin(phi)*Math.cos(theta);
    let r=.13,g=.135,b=.15;
    const add=(energy,red,green,blue)=>{r+=energy*red;g+=energy*green;b+=energy*blue;};
    // HDR radiance from feathered sources: long gradients rather than white bars.
    if(dz<-.001){const t=-5.2/dz,px=dx*t,py=dy*t+.2;
      add(4.1*softRect(px,py,0,.49,4.475,1.47,.30),.97,.98,1.);}
    if(dz>.001){const t=4.8/dz,px=dx*t,py=dy*t+.2;
      add(4.2*softRect(px,py,-2.1,2.5,1.6,1.85,.75),1.,.93,.77);
      add(3.1*softRect(px,py,3.65,1.1,1.05,2.7,.85),1.,.97,.91);
      add(.75*softRect(px,py,.3,-1.9,3.2,.85,.7),1.,.85,.63);}
    const i=(y*w+x)*4;a[i]=r;a[i+1]=g;a[i+2]=b;a[i+3]=1;
  }
  const texture=new THREE.DataTexture(a,w,h,THREE.RGBAFormat,THREE.FloatType);
  texture.colorSpace=THREE.LinearSRGBColorSpace;texture.mapping=THREE.EquirectangularReflectionMapping;texture.needsUpdate=true;return texture;
}
export function createStage(dot,{aspect=16/9}={}){
  const scene=new THREE.Scene();scene.background=new THREE.Color('#010204');
  scene.environment=makeEnvironment();scene.environmentIntensity=.58;
  const camera=new THREE.PerspectiveCamera(THREE.MathUtils.radToDeg(.4960882531059941),aspect,.05,80);
  camera.position.set(.1,.65,9.6);camera.lookAt(.08,.18,0);
  const room=new THREE.MeshStandardMaterial({color:'#080c12',roughness:.7,metalness:.14});
  const structure=new THREE.MeshStandardMaterial({color:'#10151b',roughness:.8,metalness:.02});
  const ceiling=new THREE.MeshStandardMaterial({color:'#303b48',roughness:.88,metalness:.02});
  const panel=new THREE.MeshStandardMaterial({color:'#121a24',roughness:.83,metalness:.04});panel.envMap=scene.environment;panel.envMapIntensity=.018;
  const floorMat=new THREE.MeshStandardMaterial({color:'#030405',roughness:.65,metalness:.04});
  for(const material of[room,structure,ceiling,floorMat]){material.envMap=scene.environment;material.envMapIntensity=material===ceiling?.035:.015;}
  function add(geometry,material,name,position){const o=new THREE.Mesh(geometry,material);o.name=name;o.position.set(...position);o.receiveShadow=true;if(name!=='Stage / dark rough floor')o.layers.set(1);scene.add(o);return o;}
  const floor=add(new THREE.PlaneGeometry(18,22),floorMat,'Stage / dark rough floor',[0,-2,-2]);floor.rotation.x=-Math.PI/2;
  add(new THREE.BoxGeometry(11.1,6.8,.15),room,'Stage / back wall',[0,1.3,-5.5]);
  add(makeScreenFrame(),structure,'Stage / bevelled screen frame',[0,.49,-5.29]);
  const screenMat=new THREE.MeshBasicMaterial({color:'#fbfcff',toneMapped:false});
  screenMat.color.setRGB(4,4.1,4.3);
  add(new THREE.PlaneGeometry(8.95,2.94),screenMat,'Stage / luminous screen',[0,.49,-5.2]);
  const glow=new THREE.ShaderMaterial({transparent:true,depthWrite:false,toneMapped:false,
    vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader:'varying vec2 vUv;void main(){vec2 q=max(abs(vUv-.5)-vec2(.485,.455),vec2(0.));float a=.12*exp(-length(q/vec2(.015,.045))*3.);gl_FragColor=vec4(.85,.92,1.,a);}'});
  add(new THREE.PlaneGeometry(9.18,3.16),glow,'Stage / restrained screen edge spill',[0,.49,-5.23]);
  add(new THREE.BoxGeometry(11.1,.12,15),ceiling,'Stage / ceiling',[0,2.35,-2]);
  for(const x of[-5.55,5.55]){
    add(new THREE.BoxGeometry(.15,6.8,15),room,'Stage / side wall',[x,1.3,-2]);
    for(const z of[-5.2,-2.6,0,2.6,5.2])add(new THREE.BoxGeometry(.12,5,.13),structure,'Stage / wall rib',[x-Math.sign(x)*.09,.5,z]);
    for(const y of[-1.15,.05,1.35])add(new THREE.BoxGeometry(.13,.035,15),structure,'Stage / wall reveal',[x-Math.sign(x)*.1,y,-2]);
  }
  for(const x of[-5.35,-4.6,0,4.6,5.35])add(new THREE.BoxGeometry(.07,.07,14.8),structure,'Stage / ceiling grid long',[x,2.26,-2]);
  for(const z of[-5.2,-2.6,0,2.6,5.2])add(new THREE.BoxGeometry(11,.065,.06),structure,'Stage / ceiling grid cross',[0,2.26,z]);
  for(const x of[-5.35,5.35])add(new THREE.BoxGeometry(.16,5,.22),structure,'Stage / screen side column',[x,.5,-5.15]);
  addRoomDetail(add,panel,structure);
  const hemi=new THREE.HemisphereLight(0xc1d2e6,0x070a10,.35);hemi.layers.enable(1);scene.add(hemi);
  const fill=new THREE.DirectionalLight(0xe4edff,1.9);fill.name='Stage / soft front fill';fill.position.set(-3.8,3.3,5.2);fill.castShadow=true;
  Object.assign(fill.shadow.camera,{left:-3.5,right:4,top:3.5,bottom:-3,near:.5,far:18});fill.shadow.mapSize.set(1024,1024);fill.shadow.normalBias=.006;fill.shadow.bias=-.0002;fill.shadow.radius=5;scene.add(fill);
  const lowFill=new THREE.DirectionalLight(0xc8dcff,.32);lowFill.position.set(3,-.6,4);scene.add(lowFill);
  const rim=new THREE.DirectionalLight(0xd6eaff,3.6);rim.name='Stage / screen backlight';rim.position.set(2.5,3,-5);scene.add(rim);
  const side=new THREE.DirectionalLight(0xaac9ff,.7);side.position.set(-4,1,-3);scene.add(side);
  const screenBounce=new THREE.PointLight(0xe5e9ef,38,14,2);screenBounce.layers.set(1);screenBounce.position.set(0,.8,-4.7);scene.add(screenBounce);
  dot.root.position.set(-.46,-.045,.55);dot.root.scale.setScalar(.98);scene.add(dot.root);
  const roomBackground=scene.background,backdrop=createRoomBackdrop(scene,camera),reflection=createFloorReflection(scene,camera,floor,-2,roomBackground),focus=createStageFocus(camera);
  function render(renderer){scene.background=roomBackground;backdrop.update(renderer);scene.background=backdrop.texture;focus.render(renderer,()=>reflection.render(renderer));}
  function dispose(){focus.dispose();backdrop.dispose();reflection.dispose();dot.dispose();scene.environment.dispose();
    const gs=new Set(),ms=new Set();scene.traverse(o=>{if(o.geometry)gs.add(o.geometry);if(o.material)for(const m of Array.isArray(o.material)?o.material:[o.material])ms.add(m)});
    for(const g of gs)g.dispose();for(const m of ms)m.dispose();
  }
  return {scene,camera,dot,fill,rim,screenMat,focus,render,dispose};
}
