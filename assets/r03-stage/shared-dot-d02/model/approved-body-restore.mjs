import * as T from '../../../dot/model/frozen/r07d/editable-stage/素材/v011/DotSharedWeb/vendor/three.module.js';
export const SMOOTH_SIX_PARAMETERS=Object.freeze({version:'CDX_SMOOTH_SIX_R06B',lobes:6,amplitude:.055,valleyInset:.018,yScale:.95,halfWidth:1,frontDepth:.96,backDepth:.67,projectionCamera:[0,.20,6.55],eyeHalfSpacingPlane:.2099425416029272,eyePlaneY:.3133904437341425,segments:192,rings:96,source48PointFit:false,definition:'analytic continuous rounded six-petal hexagon; shallow valleys, broad rounded lobes'});
const TAU=2*Math.PI,P=SMOOTH_SIX_PARAMETERS,R=P.halfWidth/(1+P.amplitude),A=(P.frontDepth+P.backDepth)/2,B=(P.frontDepth-P.backDepth)/2,C=new T.Vector3(...P.projectionCamera);
export function smoothSixOutline(a,order=0){
 const u=Math.cos(6*a),v=Math.sin(6*a),w=(1-u)**2/4,wa=3*(1-u)*v,waa=18*(1+u-2*u*u),r=R*(1+P.amplitude*u)-P.valleyInset*w,d=-6*R*P.amplitude*v-P.valleyInset*wa,dd=-36*R*P.amplitude*u-P.valleyInset*waa,c=Math.cos(a),s=Math.sin(a);
 if(order===1)return[d*c-r*s,P.yScale*(d*s+r*c)];
 if(order===2)return[(dd-r)*c-2*d*s,P.yScale*((dd-r)*s+2*d*c)];
 return[r*c,P.yScale*r*s];
}
// Six valleys receive one small analytic inset. At all six peaks, its
// value, first derivative and second derivative are zero. The original broad
// peak positions and curvature remain intact.
// Smooth polynomial deformation of a sphere. The angular harmonic is faded
// by sin(latitude)^6, so it is a regular Cartesian polynomial at both poles.
// z=A*c+B*c*c retains the prior .96/.67 thickness with no front/back join.
export function smoothSixSurface(l,a){
 const q=Math.sin(l),c=Math.cos(l),ca=Math.cos(a),sa=Math.sin(a),h=Math.cos(6*a),ha=Math.sin(6*a),q6=q**6;
 const w=(1-h)**2/4,wa=3*(1-h)*ha,r=R*q*(1+P.amplitude*q6*h)-P.valleyInset*q**13*w,rl=c*(R*(1+7*P.amplitude*q6*h)-13*P.valleyInset*q**12*w),ra=-6*R*P.amplitude*q**7*ha-P.valleyInset*q**13*wa,z=A*c+B*c*c,zl=-q*(A+2*B*c),L=1-z/C.z;
 const x=r*ca,y=P.yScale*r*sa,xl=rl*ca,yl=P.yScale*rl*sa,xa=ra*ca-r*sa,ya=P.yScale*(ra*sa+r*ca);
 const position=new T.Vector3(x*L,C.y+(y-C.y)*L,z);
 let normal;if(l<1e-9)normal=new T.Vector3(0,0,1);else if(Math.PI-l<1e-9)normal=new T.Vector3(0,0,-1);else{
  const dl=new T.Vector3(xl*L-x*zl/C.z,yl*L-(y-C.y)*zl/C.z,zl),da=new T.Vector3(xa*L,ya*L,0);normal=new T.Vector3().crossVectors(dl,da).normalize();
 }
 return{position,normal};
}

export function makeApprovedRawBody(){
 const positions=[],normals=[],uv=[],indices=[],segments=P.segments,rings=P.rings;
 const add=(l,a,u,v)=>{const s=smoothSixSurface(l,a);positions.push(...s.position.toArray());normals.push(...s.normal.toArray());uv.push(u,v);};
 add(0,0,.5,0);for(let j=1;j<rings;j++)for(let i=0;i<segments;i++)add(j/rings*Math.PI,i/segments*TAU,i/segments,j/rings);
 const back=positions.length/3;add(Math.PI,0,.5,1);
 for(let i=0;i<segments;i++)indices.push(0,1+i,1+(i+1)%segments);
 for(let j=0;j<rings-2;j++)for(let i=0;i<segments;i++){const a=1+j*segments+i,b=1+j*segments+(i+1)%segments,c=a+segments,d=b+segments;indices.push(a,c,b,b,c,d);}
 for(let i=0;i<segments;i++)indices.push(back,back-segments+(i+1)%segments,back-segments+i);
 const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));geometry.setAttribute('normal',new T.Float32BufferAttribute(normals,3));geometry.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geometry.setIndex(indices);geometry.computeBoundingBox();geometry.computeBoundingSphere();
 return geometry;
}
export function restoreApprovedBody(dot){
 const raw=makeApprovedRawBody(),M=new T.Matrix4().fromArray([.6599799888598327,.012170601057762902,-.767867253055419,0,.016762949340132657,1.0246975088482118,.03064904201890116,0,.7824106441753877,-.03289790024381948,.6719585696017979,0,-.6158492270350182,-.17789359003556768,-9.084369066400583,1]),rest=new T.Matrix4().makeRotationZ(-.01731024133613258);rest.setPosition(0,-.008984984868468118,0);M.multiply(rest);
 const origin=new T.Vector3((696-836)/1857.7778236958128*9.2,-(512-470.5)/1857.7778236958128*9.2,-9.2),G=new T.Matrix4().makeTranslation(-origin.x,-origin.y,-origin.z).multiply(M),map=G.clone().invert().multiply(new T.Matrix4().makeRotationZ(-8*Math.PI/180)),geometry=raw.clone().applyMatrix4(map),nap=dot.deform.children.find(o=>o.isInstancedMesh);
 geometry.computeBoundingBox();geometry.computeBoundingSphere();const oldBody=dot.body.geometry,oldNap=nap.geometry;dot.body.geometry=geometry;nap.geometry=geometry.clone();nap.geometry.setAttribute('aDotShell',new T.InstancedBufferAttribute(new Float32Array([.2,.4,.6,.8,1]),1));oldBody.dispose();oldNap.dispose();raw.dispose();dot.body.name='DOT_BODY_APPROVED_SIX_PETAL_RESTORED';return {version:'approved-six-petal-restored/r02',source:'approved-body-r06b unchanged analytic geometry',phaseClockwiseDegrees:8,map:map.toArray(),nativeHeight:geometry.boundingBox.max.y-geometry.boundingBox.min.y};
}
