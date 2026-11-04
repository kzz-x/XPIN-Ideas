/** Deterministic piecewise quintic Hermite motion. Every joint shares p/v/a;
 * interior joint velocities are not forced to zero as in v012 stop/settle clips.
 */
export function makeC2Track(knots,{tension=.8,startVelocity,endVelocity,startAcceleration,endAcceleration}={}){
 const ks=knots.map(k=>({time:k.time,p:k.value.slice(),specifiedV:k.velocity?.slice(),specifiedA:k.acceleration?.slice()}));if(ks.length<2)throw Error('C2 track requires two knots');const dim=ks[0].p.length;
 for(let i=0;i<ks.length;i++){
  const k=ks[i];if(i&&k.time<=ks[i-1].time)throw Error('Non-increasing C2 knot times');
  k.v=Array(dim).fill(0);k.a=Array(dim).fill(0);
  if(i>0&&i<ks.length-1){const before=ks[i-1],after=ks[i+1],a=k.time-before.time,b=after.time-k.time;for(let d=0;d<dim;d++){k.v[d]=tension*(after.p[d]-before.p[d])/(a+b);k.a[d]=2*((after.p[d]-k.p[d])/b-(k.p[d]-before.p[d])/a)/(a+b);}}
  if(i===0){if(startVelocity)k.v=startVelocity.slice();if(startAcceleration)k.a=startAcceleration.slice();}
  if(i===ks.length-1){if(endVelocity)k.v=endVelocity.slice();if(endAcceleration)k.a=endAcceleration.slice();}
  if(k.specifiedV)k.v=k.specifiedV.slice();if(k.specifiedA)k.a=k.specifiedA.slice();
 }
 const segments=[];
 for(let i=0;i<ks.length-1;i++){
  const a=ks[i],b=ks[i+1],dt=b.time-a.time,c=[];
  for(let d=0;d<dim;d++){const c0=a.p[d],c1=a.v[d]*dt,c2=.5*a.a[d]*dt*dt,D=b.p[d]-c0-c1-c2,V=b.v[d]*dt-c1-2*c2,A=b.a[d]*dt*dt-2*c2;c.push([c0,c1,c2,10*D-4*V+.5*A,-15*D+7*V-A,6*D-3*V+.5*A]);}
  segments.push({start:a.time,end:b.time,dt,c});
 }
 function sample(t){
  if(t<ks[0].time)return{position:ks[0].p.slice(),velocity:Array(dim).fill(0),acceleration:Array(dim).fill(0)};
  if(t>ks.at(-1).time)return{position:ks.at(-1).p.slice(),velocity:Array(dim).fill(0),acceleration:Array(dim).fill(0)};
  const s=segments.find(s=>t<=s.end)||segments.at(-1),u=(t-s.start)/s.dt,position=[],velocity=[],acceleration=[];
  for(const c of s.c){position.push(c[0]+u*(c[1]+u*(c[2]+u*(c[3]+u*(c[4]+u*c[5])))));velocity.push((c[1]+u*(2*c[2]+u*(3*c[3]+u*(4*c[4]+u*5*c[5]))))/s.dt);acceleration.push((2*c[2]+u*(6*c[3]+u*(12*c[4]+u*20*c[5])))/(s.dt*s.dt));}
  return{position,velocity,acceleration};
 }
 return{sample,knots:ks,segments};
}
