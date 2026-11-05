import * as T from'../../dot/model/frozen/r07d/editable-stage/素材/v011/DotSharedWeb/vendor/three.module.js';import{makeEnvironment}from'../v011/DotSharedWeb/stage.mjs';import{createRoomBackdrop}from'../v013-stage-bridge/content-backdrop.mjs';import{createFloorReflection}from'./encore-floor-reflection-r06.mjs';import{createStageFocus}from'../v013-stage-bridge/screen-aware-focus.mjs';import{applyLightingCandidate}from'../lighting-cpu/candidate/lighting-adjustment.mjs';

/** A new staging copy using accepted actor/material/light resources. No renderer

 * is created here. Missing universe is only permitted for CPU geometry checks.

 */

export function createBridgeStage(dot,{layout,universe=null,aspect=16/9}={}){

 if(!layout?.screen)throw Error('Bridge layout not calibrated');const s=layout.screen;if(Math.abs(s.width/s.height-16/9)>1e-12)throw Error('Physicalscreen mustbe16:9');const scene=new T.Scene();scene.background=new T.Color('#010204');scene.environment=globalThis.DOT_PREWARM_ENVIRONMENT||makeEnvironment();scene.environmentIntensity=.58;const camera=new T.PerspectiveCamera(layout.fov,aspect,.05,140);camera.position.set(...layout.fullscreen.position);camera.lookAt(...layout.fullscreen.target);

 const room=new T.MeshStandardMaterial({color:'#080c12',roughness:.7,metalness:.14}),structure=new T.MeshStandardMaterial({color:'#10151b',roughness:.8,metalness:.02}),ceiling=new T.MeshStandardMaterial({color:'#303b48',roughness:.88,metalness:.02}),floorMat=new T.MeshStandardMaterial({color:'#030405',roughness:.65,metalness:.04});for(const m of[room,structure,ceiling,floorMat]){m.envMap=scene.environment;m.envMapIntensity=m===ceiling?.035:.015;}

 const add=(g,m,name,p,layer=1)=>{const o=new T.Mesh(g,m);o.name=name;o.position.set(...p);o.layers.set(layer);o.receiveShadow=true;if(name.includes('rear side wing')||name==='Bridge / ceiling'){o.material=m.clone();o.material.color.set('#18202b');o.material.emissive.set('#000000');o.material.emissiveIntensity=0;}scene.add(o);return o;};const width=s.width+2,top=s.y+s.height/2+.7,roomHeight=top+2,cx=s.x;

 const floor=add(new T.PlaneGeometry(width+20,58),floorMat,'Bridge / matte stage floor',[cx,-1.67,21],0);floor.rotation.x=-Math.PI/2;add(new T.BoxGeometry(width,roomHeight,.15),room,'Bridge / rear wall',[cx,roomHeight/2-2,s.z-.3]);add(new T.BoxGeometry(width,.12,53),ceiling,'Bridge / ceiling',[cx,top,21]);

 // Rear wings endbefore z=.1; the floating left-entry path passes IN FRONT of

 // their open ends, not through a solid full-length sidewall.

 for(const side of[-1,1]){const x=cx+side*width/2;add(new T.BoxGeometry(.15,roomHeight,5.6),room,'Bridge / rear side wing '+side,[x,roomHeight/2-2,s.z+2.5]);add(new T.BoxGeometry(.06,.025,53),structure,'Bridge / floor perspective edge '+side,[x,-1.98,21],0);}

 for(const[g,name,pos]of[[new T.BoxGeometry(s.width+.28,.14,.16),'top',[cx,s.y+s.height/2+.07,s.z-.04]],[new T.BoxGeometry(s.width+.28,.14,.16),'bottom',[cx,s.y-s.height/2-.07,s.z-.04]],[new T.BoxGeometry(.14,s.height,.16),'left',[cx-s.width/2-.07,s.y,s.z-.04]],[new T.BoxGeometry(.14,s.height,.16),'right',[cx+s.width/2+.07,s.y,s.z-.04]]])add(g,structure,'Bridge / screen frame '+name,pos);

 const screenMat=new T.MeshBasicMaterial({color:universe?'#ffffff':'#000000',map:universe?.texture||null,toneMapped:false});const screen=add(new T.PlaneGeometry(s.width,s.height),screenMat,'Bridge / exact16:9 universe screen',[s.x,s.y,s.z]);screen.layers.enable(0);screen.userData.actualDepthForDOF=true;screen.userData.inputStatus=universe?'AUTHORIZED_TEMP_MEDIA_NOT_FINAL':'BLOCKED_MISSING_AUTHORIZED_INPUT';

 function instances(g,name,positions){const o=new T.InstancedMesh(g,structure,positions.length),m=new T.Matrix4();o.name=name;o.layers.set(1);positions.forEach((p,i)=>o.setMatrixAt(i,m.makeTranslation(...p)));scene.add(o);return o;}

 instances(new T.BoxGeometry(width-.2,.065,.06),'Bridge / ceiling depth cues',[s.z,0,5.2,10.4,15.6,20.8,26,31.2,36.4,41.6].map(z=>[cx,top-.1,z]));instances(new T.BoxGeometry(.07,.07,53),'Bridge / ceiling long cues',[-.48,-.24,0,.24,.48].map(x=>[cx+x*width,top-.1,21]));

 const hemi=new T.HemisphereLight(0xc1d2e6,0x070a10,.12);hemi.layers.enable(1);scene.add(hemi);const fill=new T.DirectionalLight(0xe4edff,.65);fill.name='Bridge / accepted front fill, translating shadowrig';fill.castShadow=true;Object.assign(fill.shadow.camera,{left:-3.5,right:4,top:3.5,bottom:-3,near:.5,far:18});fill.shadow.mapSize.set(1024,1024);fill.shadow.normalBias=.006;fill.shadow.bias=-.0002;scene.add(fill,fill.target);const rim=new T.DirectionalLight(0xd6eaff,4);rim.position.set(2.5,3,-5);scene.add(rim);const side=new T.DirectionalLight(0xaac9ff,.8);side.position.set(-4,1,-3);scene.add(side);const bounce=new T.PointLight(0xe5e9ef,38,20,2);bounce.layers.set(1);bounce.position.set(0,3,-4.7);scene.add(bounce);

 dot.root.position.set(...layout.actorPlacement);dot.root.scale.set(...layout.actorScale);scene.add(dot.root);scene.updateMatrixWorld(true);dot.body.geometry.computeBoundingBox();const bodyCentre=dot.body.geometry.boundingBox.getCenter(new T.Vector3()),blue=new T.Vector3(),gold=new T.Vector3(),keyVector=new T.Vector3(2.4,4.6,3.8),bell=dot.horn.children.find(o=>o.name.includes('BELL'))||dot.horn.children[0];bell.geometry.computeBoundingBox();const bellCentre=bell.geometry.boundingBox.getCenter(new T.Vector3());

 function updateLighting(){blue.copy(bodyCentre).applyMatrix4(dot.body.matrixWorld);gold.copy(bellCentre).applyMatrix4(bell.matrixWorld);fill.target.position.copy(blue);fill.position.copy(blue).add(keyVector);fill.target.updateMatrixWorld();fill.updateMatrixWorld();}

 const roomBackground=scene.background,backdrop=createRoomBackdrop(scene,camera),reflection=createFloorReflection(scene,camera,floor,-1.67,roomBackground,()=>({blue,gold})),focus=createStageFocus(camera,{displayScreen:{enabled:!!universe?.texture&&universe.displayReferred!==false,z:s.z,minX:s.x-s.width/2,maxX:s.x+s.width/2,minY:s.y-s.height/2,maxY:s.y+s.height/2}}),lighting=applyLightingCandidate({scene},dot,{enabled:true,bodyEnvironmentScale:.55});let revision=-1;const frameStats={calls:0,triangles:0};

 function updateUniverse(time){if(!universe)return{blocked:true,time};const state=universe.update(time);if(universe.revision!==revision){revision=universe.revision;backdrop.invalidate();}return state;}

 // Render the real room and accepted actor with independent light lists,

 // preserving the same colour/depth target and ordinary 3D occlusion.

 function drawMixed(renderer,view){

  const mask=view.layers.mask,autoClear=renderer.autoClear,bg=scene.background,shadow=renderer.shadowMap.autoUpdate;

  try{view.layers.set(0);renderer.shadowMap.autoUpdate=false;renderer.render(scene,view);

   renderer.autoClear=false;scene.background=null;view.layers.set(2);renderer.shadowMap.autoUpdate=true;renderer.shadowMap.needsUpdate=true;renderer.render(scene,view);

  }finally{view.layers.mask=mask;renderer.autoClear=autoClear;scene.background=bg;renderer.shadowMap.autoUpdate=shadow;}

 }

 function render(renderer){if(!universe)throw Error('MISSING_APPROVED_UNIVERSE_INPUT');const auto=renderer.info.autoReset;renderer.info.autoReset=false;renderer.info.reset();scene.background=globalThis.DOT_GAME_TRANSITION_ALPHA?null:roomBackground;focus.render(renderer,()=>reflection.render(renderer,drawMixed));Object.assign(frameStats,renderer.info.render);renderer.info.autoReset=auto;}



 function dispose(){lighting.dispose();focus.dispose();backdrop.dispose();reflection.dispose();dot.dispose();scene.environment.dispose();const gs=new Set(),ms=new Set();scene.traverse(o=>{if(o.geometry)gs.add(o.geometry);if(o.material)for(const m of Array.isArray(o.material)?o.material:[o.material])ms.add(m);});for(const g of gs)g.dispose();for(const m of ms)m.dispose();}

 updateLighting();return{scene,camera,dot,floor,screen,screenMat,fill,rim,hemi,focus,backdrop,reflection,frameStats,universe,updateUniverse,updateLighting,render,dispose};

}
