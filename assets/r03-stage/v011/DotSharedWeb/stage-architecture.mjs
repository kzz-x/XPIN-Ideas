import * as T from '../../../dot/model/frozen/r07d/editable-stage/素材/v011/DotSharedWeb/vendor/three.module.js';
function rect(path,x,y,w,h,r){path.moveTo(x+r,y);path.lineTo(x+w-r,y);path.quadraticCurveTo(x+w,y,x+w,y+r);path.lineTo(x+w,y+h-r);path.quadraticCurveTo(x+w,y+h,x+w-r,y+h);path.lineTo(x+r,y+h);path.quadraticCurveTo(x,y+h,x,y+h-r);path.lineTo(x,y+r);path.quadraticCurveTo(x,y,x+r,y);return path;}
export function makeScreenFrame(){
 const shape=rect(new T.Shape(),-4.59,-1.545,9.18,3.09,.045);
 const hole=rect(new T.Path(),-4.485,-1.475,8.97,2.95,.025);shape.holes.push(hole);
 const g=new T.ExtrudeGeometry(shape,{depth:.075,bevelEnabled:true,bevelSize:.012,bevelThickness:.012,bevelSegments:2,steps:1,curveSegments:6});g.translate(0,0,-.0375);return g;
}
export function addRoomDetail(add,panel,edge){
 // Subtle architectural recesses on the existing walls, below the screen.
 for(let i=0;i<9;i++){const x=-4+i;
  add(new T.BoxGeometry(.97,.78,.035),panel,'Stage / lower wall inset '+i,[x,-1.49,-5.39]);
  add(new T.BoxGeometry(.006,.8,.015),edge,'Stage / lower wall joint '+i,[x-.49,-1.49,-5.35]);
 }
 add(new T.BoxGeometry(10.8,.065,.085),edge,'Stage / low wall plinth',[0,-1.94,-5.31]);
 for(const x of[-5.43,5.43])for(const z of[-3.9,-1.3,1.3,3.9]){
  add(new T.BoxGeometry(.025,1.07,2.42),panel,'Stage / side inset panel',[x,-.57,z]);
  add(new T.BoxGeometry(.03,.018,2.42),edge,'Stage / inset panel lower reveal',[x,-1.11,z]);
 }
}
