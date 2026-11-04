import * as T from '../../../../../../../../../dot/model/frozen/r07d/editable-stage/素材/v011/DotSharedWeb/vendor/three.module.js';
import {mergeGeometries} from '../../../../../../../../v011/DotSharedWeb/vendor/BufferGeometryUtils.js';

/* Sculpt specification, in the approved 1672 x 941 design view.
 * This is a closed, rounded 3D mesh, not a card or a camera-facing shader.
 * The design-view transform is baked back into character rest coordinates at
 * construction. No live camera, screenshot, texture or render state is used.
 * Back depth is inferred because the two references are not a turnaround.
 */
const bodyToDesign=new T.Matrix4().fromArray([
 .6599799888598327,.012170601057762902,-.767867253055419,0,
 .016762949340132657,1.0246975088482118,.03064904201890116,0,
 .7824106441753877,-.03289790024381948,.6719585696017979,0,
 -.6158492270350182,-.17789359003556768,-9.084369066400583,1]);
const designToBody=bodyToDesign.clone().invert();
const hatRest=new T.Matrix4().makeRotationZ(-.01731024133613258);
hatRest.setPosition(0,-.008984984868468118,0);
const bodyToHat=hatRest.clone().invert();
const focal=1857.7778236958128,halfW=836,halfH=470.5;
const ray=(x,y)=>new T.Vector3((x-halfW)/focal,-(y-halfH)/focal,-1);
const unproject=(x,y,z)=>ray(x,y).multiplyScalar(-z);
const TAU=Math.PI*2;

export const SHAPE_SPEC={
 version:'v004 / continuous volume',
 bodyCenter:[696,512],ellipse:[194,180],frontDepth:.96,backDepth:.67,
 bodyOutline:[
  [747,323],[783,330],[818,350],[844,381],[857,418],[866,448],
  [883,474],[894,502],[896,530],[889,556],[870,580],[845,599],
  [834,627],[820,655],[797,678],[770,691],[738,695],[707,688],
  [677,675],[652,678],[621,679],[590,671],[565,653],[550,628],
  [543,600],[537,572],[520,548],[504,524],[496,499],[498,476],
  [507,450],[521,426],[540,408],[579,383],[635,352],[694,331]
 ],
 hatCenter:[650,335],hatEllipse:[174,59,.42],hatFrontDepth:.43,hatBackDepth:.29,
 hatOutline:[
  [491,385],[509,348],[550,311],[602,279],[658,258],[715,247],
  [767,249],[797,263],[809,286],[801,313],[779,340],[738,367],
  [686,390],[631,409],[574,422],[529,422],[502,409]
 ],
 eyeNear:[[755,438],[765,451],[783,453],[787,430]],
 eyeFar:[[840,418],[845,430],[853,435],[854,418]]
};

// A smooth radial boundary and a monotone interior map. Lobes fade towards
// the front/back poles, so the silhouette's concavities do not become seams.
function section(points,center,ellipse){
 const curve=new T.CatmullRomCurve3(points.map(([x,y])=>new T.Vector3(x-center[0],center[1]-y,0)),true,'centripetal');
 const samples=curve.getPoints(4096).slice(0,-1).map(v=>({angle:(Math.atan2(v.y,v.x)+TAU)%TAU,r:v.length()})).sort((a,b)=>a.angle-b.angle);
 const count=2048,table=[];let j=0;
 for(let k=0;k<count;k++){
  const a=k/count*TAU;while(j+1<samples.length&&samples[j+1].angle<a)j++;
  let lo=samples[j],hi=samples[(j+1)%samples.length];
  if(a<samples[0].angle){lo={angle:samples.at(-1).angle-TAU,r:samples.at(-1).r};hi=samples[0];}
  else if(hi.angle<lo.angle)hi={angle:hi.angle+TAU,r:hi.r};
  table.push(T.MathUtils.lerp(lo.r,hi.r,(a-lo.angle)/(hi.angle-lo.angle)));
 }
 function boundary(a){
  const u=((a/TAU)%1+1)%1*count,i=Math.floor(u),t=u-i;
  const v=k=>table[(k+count)%count],a0=v(i-1),a1=v(i),a2=v(i+1),a3=v(i+2);
  return .5*((2*a1)+(-a0+a2)*t+(2*a0-5*a1+4*a2-a3)*t*t+(-a0+3*a1-3*a2+a3)*t*t*t);
 }
 const base=a=>1/Math.sqrt((Math.cos(a-(ellipse[2]||0))/ellipse[0])**2+(Math.sin(a-(ellipse[2]||0))/ellipse[1])**2);
 const radius=(r,a)=>r*(base(a)+(boundary(a)-base(a))*r**4);
 const xy=(r,a)=>[center[0]+radius(r,a)*Math.cos(a),center[1]-radius(r,a)*Math.sin(a)];
 function parameter(x,y){
  const dx=x-center[0],dy=center[1]-y,a=Math.atan2(dy,dx),d=Math.hypot(dx,dy);
  let lo=0,hi=1;for(let n=0;n<35;n++){const m=(lo+hi)/2;if(radius(m,a)<d)lo=m;else hi=m;}
  return {r:(lo+hi)/2,a};
 }
 return {xy,parameter};
}

function closedSurface(profile,zAt,{segments=192,rings=96,hat=false}={}){
 const positions=[],uv=[],indices=[];
 const add=(r,a,h,u,v)=>{const [x,y]=profile.xy(r,a);const p=unproject(x,y,zAt(x,y,h)).applyMatrix4(designToBody);if(hat)p.applyMatrix4(bodyToHat);positions.push(...p.toArray());uv.push(u,v);};
 add(0,0,1,.5,0);
 for(let j=1;j<rings;j++)for(let i=0;i<segments;i++)add(Math.sin(j/rings*Math.PI),i/segments*TAU,Math.cos(j/rings*Math.PI),i/segments,j/rings);
 const back=positions.length/3;add(0,0,-1,.5,1);
 for(let i=0;i<segments;i++)indices.push(0,1+i,1+(i+1)%segments);
 for(let j=0;j<rings-2;j++)for(let i=0;i<segments;i++){
  const a=1+j*segments+i,b=1+j*segments+(i+1)%segments,c=a+segments,d=b+segments;indices.push(a,c,b,b,c,d);
 }
 for(let i=0;i<segments;i++)indices.push(back,back-segments+(i+1)%segments,back-segments+i);
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals();g.computeBoundingBox();g.computeBoundingSphere();return g;
}

// Finite-element Poisson thickness: -Laplacian(u)=4, u=0 on the outline.
// Unlike a radial loft, this spreads boundary curvature smoothly through the
// entire front. sqrt(u) gives a rounded tangent at the joined front/back edge.
function smoothThickness(profile,center,ellipse,segments=192,rings=48){
 const points=[[0,0]],radii=[0],faces=[];
 for(let j=1;j<=rings;j++){
  const r=Math.sin(j/rings*Math.PI/2);radii.push(r);
  for(let i=0;i<segments;i++){const p=profile.xy(r,i/segments*TAU);points.push([(p[0]-center[0])/ellipse[0],(center[1]-p[1])/ellipse[1]]);}
 }
 for(let i=0;i<segments;i++)faces.push([0,1+i,1+(i+1)%segments]);
 for(let j=0;j<rings-1;j++)for(let i=0;i<segments;i++){
  const a=1+j*segments+i,b=1+j*segments+(i+1)%segments,c=a+segments,d=b+segments;faces.push([a,c,b],[b,c,d]);
 }
 const n=1+(rings-1)*segments,diag=new Float64Array(n),rhs=new Float64Array(n),neighbors=Array.from({length:n},()=>new Map());
 function edge(a,b,w){
  if(a<n){diag[a]+=w;if(b<n)neighbors[a].set(b,(neighbors[a].get(b)||0)-w);}
  if(b<n){diag[b]+=w;if(a<n)neighbors[b].set(a,(neighbors[b].get(a)||0)-w);}
 }
 for(const tri of faces){
  const [ia,ib,ic]=tri,[a,b,c]=tri.map(i=>points[i]);
  const area2=Math.abs((b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]));
  for(const i of tri)if(i<n)rhs[i]+=area2*2/3;
  const cot=(p,q,r)=>((p[0]-r[0])*(q[0]-r[0])+(p[1]-r[1])*(q[1]-r[1]))/area2;
  edge(ia,ib,.5*cot(a,b,c));edge(ib,ic,.5*cot(b,c,a));edge(ic,ia,.5*cot(c,a,b));
 }
 const ids=[],weights=[],offsets=[0];for(const row of neighbors){for(const [id,w]of row){ids.push(id);weights.push(w);}offsets.push(ids.length);}
 const u=new Float64Array(points.length),r=rhs.slice(),z=new Float64Array(n),p=new Float64Array(n),ap=new Float64Array(n);
 let rz=0;for(let i=0;i<n;i++){z[i]=p[i]=r[i]/diag[i];rz+=r[i]*z[i];}
 let iterations=0;
 for(;iterations<1200&&rz>1e-18;iterations++){
  let pap=0;for(let i=0;i<n;i++){let a=diag[i]*p[i];for(let k=offsets[i];k<offsets[i+1];k++)a+=weights[k]*p[ids[k]];ap[i]=a;pap+=p[i]*a;}
  const alpha=rz/pap;let next=0;
  for(let i=0;i<n;i++){u[i]+=alpha*p[i];r[i]-=alpha*ap[i];z[i]=r[i]/diag[i];next+=r[i]*z[i];}
  const beta=next/rz;for(let i=0;i<n;i++)p[i]=z[i]+beta*p[i];rz=next;
 }
 let max=0;for(const value of u)max=Math.max(max,value);
 const sample=(x,y)=>{
  const {r,a}=profile.parameter(x,y),angle=((a/TAU)%1+1)%1*segments,i=Math.floor(angle),f=angle-i;
  let j=0;while(j<rings-1&&radii[j+1]<r)j++;
  const v=k=>k===0?u[0]:T.MathUtils.lerp(u[1+(k-1)*segments+i],u[1+(k-1)*segments+(i+1)%segments],f);
  return Math.sqrt(Math.max(0,T.MathUtils.lerp(v(j),v(j+1),(r-radii[j])/(radii[j+1]-radii[j]))/max));
 };
 return {sample,iterations,residual:rz};
}

export function makeDotShape(mouth,axis){
 const s=SHAPE_SPEC,bodyProfile=section(s.bodyOutline,s.bodyCenter,s.ellipse);
 const thickness=smoothThickness(bodyProfile,s.bodyCenter,s.ellipse);
 // Fit the entire smooth front surface's depth and tilt to the existing cup's
 // tangent plane. No local pin, Gaussian dent, seam, or detached muzzle.
 const contact=mouth.clone().addScaledVector(axis,-.004).applyMatrix4(bodyToDesign);
 const normal=axis.clone().applyMatrix3(new T.Matrix3().getNormalMatrix(bodyToDesign)).normalize();
 const planeZ=(x,y)=>-normal.dot(contact)/normal.dot(ray(x,y));
 const mx=halfW+contact.x/-contact.z*focal,my=halfH-contact.y/-contact.z*focal;
 const bulge=(x,y)=>s.frontDepth*thickness.sample(x,y);
 const dx=((planeZ(mx+.1,my)-planeZ(mx-.1,my))-(bulge(mx+.1,my)-bulge(mx-.1,my)))/.2;
 const dy=((planeZ(mx,my+.1)-planeZ(mx,my-.1))-(bulge(mx,my+.1)-bulge(mx,my-.1)))/.2;
 const constant=contact.z-bulge(mx,my);
 const zAt=(x,y,h)=>constant+dx*(x-mx)+dy*(y-my)+(h>=0?s.frontDepth:-s.backDepth)*thickness.sample(x,y);
 const body=closedSurface(bodyProfile,zAt);
 const surface=(x,y)=>{const {r}=bodyProfile.parameter(x,y);return unproject(x,y,zAt(x,y,Math.sqrt(Math.max(0,1-r*r)))).applyMatrix4(designToBody);};
 function lid(points,radius){
  const c=new T.CubicBezierCurve(...points.map(p=>new T.Vector2(...p)));
  const positions=c.getPoints(64).map(p=>{
   const v=surface(p.x,p.y),du=surface(p.x+.1,p.y).sub(v),dv=surface(p.x,p.y-.1).sub(v),n=new T.Vector3().crossVectors(du,dv).normalize();return v.addScaledVector(n,radius*.65);
  });
  const curve=new T.CatmullRomCurve3(positions),tube=new T.TubeGeometry(curve,64,radius,16,false),caps=[positions[0],positions.at(-1)].map(p=>new T.SphereGeometry(radius,20,12).translate(...p.toArray()));
  const g=mergeGeometries([tube,...caps]);for(const a of[tube,...caps])a.dispose();g.computeBoundingBox();return g;
 }
 const hatProfile=section(s.hatOutline,s.hatCenter,s.hatEllipse);
 // A convex crown and a smaller rounded underside share one watertight surface.
 const hatZ=(x,y,h)=>-8.91+.00125*(y-335)+(h>=0?s.hatFrontDepth:s.hatBackDepth)*h;
 const hat=closedSurface(hatProfile,hatZ,{segments:160,rings:64,hat:true});
 const stemPoint=unproject(633,255,hatZ(633,272,Math.sqrt(1-hatProfile.parameter(633,272).r**2))+.006).applyMatrix4(designToBody).applyMatrix4(bodyToHat);
 const stem=new T.SphereGeometry(.064,32,20).scale(.96,1.05,.96).translate(...stemPoint.toArray());stem.computeBoundingBox();
 body.userData.thicknessSolver={iterations:thickness.iterations,residual:thickness.residual};
 return {body,hat,stem,nearEye:lid(s.eyeNear,.0185),farEye:lid(s.eyeFar,.0145),spec:s};
}
