import * as T from 'three';
import {yieldTask} from './preparation.mjs';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {PRODUCT_IDS} from './games-rules.mjs';
import {productFinish,makeProductMaterial} from './product-finishes.mjs';

const V=(x=0,y=0,z=0)=>new T.Vector3(x,y,z);
const ease=t=>t*t*t*(t*(6*t-15)+10);

function mergeParts(parts) {
  const out=new T.BufferGeometry();
  for(const key of ['position','normal']){
    const data=new Float32Array(parts.reduce((sum,g)=>sum+g.attributes.position.count*3,0));let at=0;
    for(const g of parts){data.set(g.attributes[key].array,at);at+=g.attributes.position.count*3;}
    out.setAttribute(key,new T.BufferAttribute(data,3));
  }
  out.computeBoundingBox();out.computeBoundingSphere();return out;
}

/** Uses the actual supplied S11 product volumes; faults are explicitly teaching demonstrations. */
export function createProductCarousel({root,camera,box,label,line,materials,onRepair,onTurn,onFeedback}) {
  const platter=new T.Group();platter.name='四产品 / 连续机械转盘';root.add(platter);
  const metal=new T.MeshStandardMaterial({color:0x242b31,metalness:.18,roughness:.75});
  const brushed=new T.MeshStandardMaterial({color:0x8d989f,metalness:.36,roughness:.58});
  const disc=new T.Mesh(new T.CylinderGeometry(4.9,4.9,.18,96),metal);disc.position.y=.1;disc.receiveShadow=true;root.add(disc);
  const rim=new T.Mesh(new T.TorusGeometry(4.84,.025,8,128),brushed);rim.rotation.x=Math.PI/2;rim.position.y=.21;root.add(rim);
  for(let j=0;j<48;j++){const a=j/48*Math.PI*2,len=j%4===0?.28:.13;line([[Math.sin(a)*(4.55-len),.205,Math.cos(a)*(4.55-len)],[Math.sin(a)*4.55,.205,Math.cos(a)*4.55]],materials.line,root);}
  const axis=new T.Mesh(new T.CylinderGeometry(.7,.7,.32,48),materials.dark);axis.position.y=.24;platter.add(axis);
  const axisTop=new T.Mesh(new T.CylinderGeometry(.42,.42,.04,48),brushed);axisTop.position.y=.42;platter.add(axisTop);
  const models=[],loads=[],errors=[],mounts=[];
  const loadingLabels=[],identityLabels=[];
  let disposed=false,index=0,angle=0,targetAngle=0,turn=null,repair=null,done=[],active=false;
  for(let k=0;k<4;k++){
    const a=k*Math.PI/2,g=new T.Group();g.position.set(Math.sin(a)*2.45,.22,Math.cos(a)*2.45);g.rotation.y=a;platter.add(g);mounts.push(g);
    const ll=label(g,'模型载入中',[0,.2,0],2.4,.35,{surface:true,color:'#a8bdd5'});loadingLabels.push(ll);
    identityLabels.push(label(g,PRODUCT_IDS[k],[0,.10,1.65],2.4,.46,{surface:true,color:'#b9d0e9'}));
    loads.push(loadProduct(k,g));
  }
  label(root,'点击模型的问题位置 · 观察修正',[0,.10,6.0],6.8,.50,{surface:true,color:'#c4d3e7',font:70});
  label(root,'结构 / 接地 / 贴合 / 装配 · 教学示意',[0,.08,-7.70],9.5,.54,{surface:true,color:'#e1eaf2',font:70});
  const ring=new T.Mesh(new T.RingGeometry(.18,.235,48),new T.MeshBasicMaterial({color:0xffcf79,transparent:true,opacity:.9,side:T.DoubleSide,depthTest:false}));ring.renderOrder=20;ring.visible=false;root.add(ring);
  const target=new T.Mesh(new T.SphereGeometry(.38,12,8),new T.MeshBasicMaterial({visible:false}));target.name='产品问题命中区域';root.add(target);
  const guide=line([[0,0,0],[0,0,0]],materials.goldLine,root);guide.renderOrder=19;
  const title=label(root,'',[0,.8,3.8],4.8,.46,{color:'#ffe0a0',font:70});title.visible=false;
  const faultNames=['右臂部件错位','车轮没有接地','头带贴合关系','存储堆栈装配'];
  const fallbackNames=['结构接地演示','车轮没有接地','贴合接地演示','板卡接地演示'];

  async function loadProduct(k,mount) {
    const id=PRODUCT_IDS[k];
    try {
      const gltf=await new GLTFLoader().loadAsync(new URL('../assets/products/'+id+'.glb',import.meta.url).href);
      if(disposed)return;
      const source=gltf.scene;source.updateWorldMatrix(true,true);
      const bounds=new T.Box3().setFromObject(source),center=bounds.getCenter(V()),size=bounds.getSize(V());
      const scale=(k===0?2.45:k===1?3.75:k===2?2.55:2.65)/Math.max(size.x,size.y,size.z);
      const normalization=new T.Matrix4().makeScale(scale,scale,scale).multiply(new T.Matrix4().makeTranslation(-center.x,-bounds.min.y,-center.z));
      const bucket=new Map();
      const sourceMeshes=[];source.traverse(o=>{if(o.isMesh)sourceMeshes.push(o);});
      for(const o of sourceMeshes){await yieldTask();
        let p=o,lineage='';while(p){lineage+=' '+p.name;p=p.parent;}
        const materialsIn=Array.isArray(o.material)?o.material:[o.material];
        const groups=o.geometry.groups.length?o.geometry.groups:[{start:0,count:o.geometry.index?.count||o.geometry.attributes.position.count,materialIndex:0}];
        for(const group of groups){
          const geom=o.geometry.index?o.geometry.toNonIndexed():o.geometry.clone(),start=group.start||0,count=Math.min(group.count,geom.attributes.position.count-start);
          const part=new T.BufferGeometry();
          for(const key of ['position','normal'])if(geom.attributes[key])part.setAttribute(key,new T.Float32BufferAttribute(geom.attributes[key].array.slice(start*3,(start+count)*3),3));
          part.applyMatrix4(new T.Matrix4().multiplyMatrices(normalization,o.matrixWorld));if(!part.attributes.normal)part.computeVertexNormals();part.computeBoundingBox();
          const b=part.boundingBox,mid=b.getCenter(V());
          const special=(k===0&&/right.*(elbow|wrist|hand)/i.test(lineage))||(k===2&&b.getSize(V()).z>.65&&mid.z<-.12)||(k===3&&/HBM4_stack_1(?:\D|$)/i.test(lineage));
          const original=materialsIn[group.materialIndex]||materialsIn[0],finish=productFinish(id,original,{special});
          const key=finish.key+'_'+special;
          if(!bucket.has(key))bucket.set(key,{special,parts:[],material:makeProductMaterial(finish)});
          bucket.get(key).parts.push(part);geom.dispose();
        }
      }
      const model=new T.Group();model.name=id+' / 用户提供的真实轻量模型';model.rotation.y=[-Math.PI/2,-.4,.4,0][k];mount.add(model);
      const payload=new T.Group();payload.name='完整产品体';model.add(payload);
      const partGroup=new T.Group();partGroup.name='可修正真实子件';payload.add(partGroup);
      for(const b of bucket.values()){
        const m=new T.Mesh(mergeParts(b.parts),b.material);m.castShadow=m.receiveShadow=true;(b.special?partGroup:payload).add(m);for(const g of b.parts)g.dispose();
      }
      const partBounds=new T.Box3().setFromObject(partGroup),hasPart=!partBounds.isEmpty();
      let moving,offset,faultCenter,kind;
      model.updateWorldMatrix(true,true);
      if(k===1){moving=payload;offset=V(0,.32,0);faultCenter=V(1.10,.14,.60);kind='ground-contact';}
      else if(hasPart){
        moving=partGroup;offset=k===0?V(-.22,0,.19):k===2?V(0,0,.36):V(0,.36,0);
        const localBounds=new T.Box3();partGroup.traverse(o=>{if(o.isMesh)localBounds.union(o.geometry.boundingBox);});faultCenter=localBounds.getCenter(V());kind='source-submesh';
      }else{
        moving=payload;offset=V(0,.3,0);faultCenter=V(0,.14,.55);kind='ground-contact-fallback';
        errors.push(id+': specific submesh absent; explicitly marked ground-contact teaching demonstration');
      }
      const fix=done.includes(k)?1:0;moving.position.copy(offset).multiplyScalar(1-fix);
      models[k]={id,root:model,payload,moving,offset,faultCenter,kind,fix,hasPart,ready:true};
      loadingLabels[k].visible=false;
      source.traverse(o=>{if(o.isMesh){o.geometry.dispose();for(const m of(Array.isArray(o.material)?o.material:[o.material]))m.dispose();}});
    }catch(error){
      errors.push(id+': '+error.message);loadingLabels[k].userData.setText?.('模型未载入');onFeedback?.({type:'warning',text:id+' 模型未载入，可以稍后重试此关。'});
    }
  }
  function worldFault(){
    const m=models[index];if(!m)return null;
    const p=m.faultCenter.clone();
    // Whole-payload contact faults already include the offset in payload.matrixWorld.
    if(m.moving!==m.payload)p.add(m.offset.clone().multiplyScalar(1-m.fix));
    m.payload.localToWorld(p);return p;
  }
  function setDone(values,product=0){
    done=values.slice();
    if(!repair)for(let k=0;k<models.length;k++){const m=models[k];if(m){m.fix=done.includes(k)?1:0;m.moving.position.copy(m.offset).multiplyScalar(1-m.fix);}}
    if(!turn&&index!==product){index=product;angle=targetAngle=-index*Math.PI/2;platter.rotation.y=angle;}
  }
  function repairCurrent({assisted=false}={}){
    const m=models[index];if(!m||done.includes(index)||repair||turn)return false;
    repair={index,age:0,assisted,start:m.fix,marked:false};return true;
  }
  function nextProduct(){
    if(index>=3||turn||repair)return false;
    const to=index+1;turn={from:angle,to:targetAngle-Math.PI/2,age:0,index:to};targetAngle=turn.to;return true;
  }
  function update(dt,time,isActive){
    active=isActive;
    if(repair){
      const r=repair,m=models[r.index],u=Math.min(1,(r.age+=dt)/1.35);m.fix=T.MathUtils.lerp(r.start,1,ease(u));m.moving.position.copy(m.offset).multiplyScalar(1-m.fix);
      if(u===1&&!r.marked){r.marked=true;onRepair(r.index,r.assisted);}
      if(r.age>=2.0){repair=null;if(index<3)nextProduct();}
    }
    if(turn){
      const u=Math.min(1,(turn.age+=dt)/2.25);angle=T.MathUtils.lerp(turn.from,turn.to,ease(u));platter.rotation.y=angle;
      if(u===1){index=turn.index;turn=null;onTurn(index);}
    }
    for(let k=0;k<mounts.length;k++){
      const front=Math.max(0,Math.cos(k*Math.PI/2+angle)),s=.62+.38*front;mounts[k].scale.setScalar(s);
      identityLabels[k].visible=front>.78&&!turn;
    }
    root.updateWorldMatrix(true,true);
    const p=worldFault(),show=!!p&&active&&!done.includes(index)&&!turn&&!repair;
    ring.visible=target.visible=guide.visible=title.visible=show;
    if(p){
      root.worldToLocal(p);ring.position.copy(p);target.position.copy(p);
      ring.quaternion.copy(root.getWorldQuaternion(new T.Quaternion()).invert()).multiply(camera.quaternion);
      const pulse=1+Math.sin(time*2.2)*.065;ring.scale.setScalar(pulse);
      // Keep the diagnosis in a reserved front margin, clear of the model volume.
      const a=guide.geometry.attributes.position;a.setXYZ(0,p.x,p.y,p.z);a.setXYZ(1,0,.42,4.72);a.needsUpdate=true;
      title.position.set(0,.68,5.02);title.quaternion.copy(ring.quaternion);
      title.userData.setText?.(models[index]?.kind==='ground-contact-fallback'?fallbackNames[index]:faultNames[index]);
    }
  }
  function pick(ray){
    if(!active||turn||repair||done.includes(index))return null;
    if(ray.intersectObject(target,false).length)return {kind:'product',correct:true,index};
    const m=models[index];if(m&&ray.intersectObject(m.root,true).length)return {kind:'product',correct:false,index};
    return null;
  }
  return {root:platter,loads,update,setDone,pick,repairCurrent,nextProduct,
    get busy(){return !!turn||!!repair;},get current(){return index;},get ready(){return !!models[index];},
    target(){return worldFault();},
    reset(){repair=null;turn=null;index=0;angle=targetAngle=0;platter.rotation.y=0;setDone([],0);},
    snapshot(){return{index,angle,busy:!!turn||!!repair,errors:[...errors],models:PRODUCT_IDS.map((id,k)=>({id,loaded:!!models[k],faultKind:models[k]?.kind,fixed:models[k]?.fix,vertices:models[k]?(()=>{let n=0;models[k].root.traverse(o=>{if(o.isMesh)n+=o.geometry.attributes.position.count;});return n;})():0}))};},
    dispose(){disposed=true;}
  };
}
