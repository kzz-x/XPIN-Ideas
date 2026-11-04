import * as T from 'three';

/** Composite the same live rig over CSS3D cards. No second rig or animation.
 * The original world pass still renders its real cast/contact shadows. */
export function createDotForeground({scene,camera,worldRenderer,root}){
  const layer=30,canvas=document.createElement('canvas');
  canvas.id='dot-foreground';canvas.setAttribute('aria-hidden','true');
  Object.assign(canvas.style,{position:'fixed',inset:'0',width:'100%',height:'100%',zIndex:'14',pointerEvents:'none',display:'none'});
  document.body.append(canvas);
  const renderer=new T.WebGLRenderer({canvas,alpha:true,antialias:true,powerPreference:'high-performance'});
  renderer.setClearColor(0x000000,0);
  renderer.outputColorSpace=worldRenderer.outputColorSpace;
  renderer.toneMapping=worldRenderer.toneMapping;
  renderer.toneMappingExposure=worldRenderer.toneMappingExposure;
  const materials=new Set(),savedMasks=new Map(),size=new T.Vector2();
  root.traverse(o=>{
    savedMasks.set(o,o.layers.mask);o.layers.enable(layer);
    if(o.material)for(const m of Array.isArray(o.material)?o.material:[o.material])materials.add(m);
  });
  scene.traverse(o=>{if(o.isLight){savedMasks.set(o,o.layers.mask);o.layers.enable(layer);}});
  let active=false,width=0,height=0,dpr=0,passes=0;
  function resize(){
    worldRenderer.getSize(size);const next=worldRenderer.getPixelRatio();
    if(width===size.x&&height===size.y&&dpr===next)return;
    width=size.x;height=size.y;dpr=next;renderer.setPixelRatio(dpr);renderer.setSize(width,height,false);
  }
  function setActive(value){active=value;canvas.style.display=active?'block':'none';}
  function renderWorld(render){
    if(!active)return render();
    // Suppress the duplicate beauty pass, retaining the original depth-material
    // shadow pass. Do not leave invisible depth holes behind the foreground rig.
    const saved=[];
    for(const m of materials){saved.push([m,m.colorWrite,m.depthWrite]);m.colorWrite=false;m.depthWrite=false;}
    try{return render();}finally{for(const [m,color,depth]of saved){m.colorWrite=color;m.depthWrite=depth;}}
  }
  function render(){
    if(!active)return;
    resize();
    const background=scene.background,mask=camera.layers.mask;
    try{
      scene.background=null;camera.layers.set(layer);
      renderer.toneMappingExposure=worldRenderer.toneMappingExposure;
      renderer.render(scene,camera);passes++;
    }finally{scene.background=background;camera.layers.mask=mask;}
  }
  return {canvas,renderer,setActive,renderWorld,render,resize,
    snapshot:()=>({active,layer,passes,width,height,dpr,drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,characterCount:1}),
    dispose(){for(const [o,mask]of savedMasks)o.layers.mask=mask;renderer.dispose();canvas.remove();}
  };
}
