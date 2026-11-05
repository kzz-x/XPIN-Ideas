import * as T from 'three';
export function createFirstGameHints({scene,camera,cube,pieces,slots}){
 const root=new T.Group();root.name='First interaction / rotation and drag guides';scene.add(root);
 const material=new T.LineBasicMaterial({color:0xd5efff,transparent:true,opacity:.8,depthTest:false,depthWrite:false});
 const orbit=new T.Group();root.add(orbit);const points=[];
 for(let i=0;i<=80;i++){const a=.3+i/80*Math.PI*1.66;points.push(new T.Vector3(Math.cos(a)*1.72,Math.sin(a)*1.72,0));}
 const arc=new T.Line(new T.BufferGeometry().setFromPoints(points),material);orbit.add(arc);
 const arrow=new T.Line(new T.BufferGeometry().setFromPoints([points[80].clone().add(new T.Vector3(-.23,.02,0)),points[80],points[80].clone().add(new T.Vector3(.03,.23,0))]),material);orbit.add(arrow);
 const path=new T.Line(new T.BufferGeometry(),material);root.add(path);
 const bead=new T.Mesh(new T.SphereGeometry(.075,10,8),new T.MeshBasicMaterial({color:0xecf8ff,depthTest:false,depthWrite:false}));root.add(bead);
 let mode='hidden',curve=null,signature='';
 function update(time,active,state,busy){
  mode=!busy&&!state.seen[active]&&active===0?'rotate':!busy&&!state.seen[active]&&active===1?'drag':'hidden';
  root.visible=mode!=='hidden';orbit.visible=mode==='rotate';path.visible=mode==='drag';bead.visible=root.visible;if(!root.visible)return;
  material.opacity=.50+.32*(.5+.5*Math.sin(time*3.2));
  if(mode==='rotate'){
   orbit.position.copy(cube.root.getWorldPosition(new T.Vector3()));orbit.quaternion.copy(camera.quaternion);
   const p=points[Math.floor((time*.32%1)*80)].clone().applyQuaternion(orbit.quaternion).add(orbit.position);bead.position.copy(p);
  }else{
   const piece=pieces.find(p=>p.chapter===1&&!p.done),slot=piece&&slots.find(s=>s.chapter===1&&s.id===piece.id);if(!slot){root.visible=false;mode='hidden';return;}
   const a=piece.root.getWorldPosition(new T.Vector3()),b=slot.root.getWorldPosition(new T.Vector3());a.y+=.18;b.y+=.22;
   const key=[...a.toArray(),...b.toArray()].map(n=>n.toFixed(2)).join(',');
   if(signature!==key){signature=key;const mid=a.clone().lerp(b,.5);mid.y+=1.65;curve=new T.QuadraticBezierCurve3(a,mid,b);path.geometry.dispose();path.geometry=new T.BufferGeometry().setFromPoints(curve.getPoints(60));}
   bead.position.copy(curve.getPoint((time*.48)%1));
  }
 }
 return{update,snapshot:()=>({mode,visible:root.visible}),dispose(){root.removeFromParent();arc.geometry.dispose();arrow.geometry.dispose();path.geometry.dispose();bead.geometry.dispose();material.dispose();bead.material.dispose();}};
}
