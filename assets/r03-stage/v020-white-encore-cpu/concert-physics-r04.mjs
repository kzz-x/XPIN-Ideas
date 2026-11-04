const sat=x=>Math.max(0,Math.min(1,x));
const smooth=(a,b,x)=>{const t=sat((x-a)/(b-a));return t*t*(3-2*t);};
export const GRAVITY=9.81,FLOOR=-1.67;
export function random(i,s=0){let x=Math.imul(i+1,1664525)+Math.imul(s+1,1013904223);x^=x>>>16;x=Math.imul(x,2246822507);x^=x>>>13;return(x>>>0)/4294967295;}
export function sampleBallistic(seed,time,out={}){
 const age=time-seed.start;out.alpha=0;out.age=age;if(age<0||age>=seed.life)return out;
 const d=seed.drag,fall=GRAVITY/d,decay=Math.exp(-d*age),travel=(1-decay)/d;
 out.x=seed.x+(seed.vx-seed.wind)*travel+seed.wind*age;
 out.y=seed.y+(seed.vy+fall)*travel-fall*age;
 out.z=seed.z+seed.vz*travel;
 out.vx=(seed.vx-seed.wind)*decay+seed.wind;out.vy=(seed.vy+fall)*decay-fall;out.vz=seed.vz*decay;
 if(out.y<FLOOR-.04)return out;
 out.alpha=smooth(0,.045,age)*(1-smooth(seed.life*.78,seed.life,age))*smooth(FLOOR-.035,FLOOR+.15,out.y);
 out.rx=seed.phase+age*seed.spinX;out.ry=seed.phase*.7+age*seed.spinY;out.rz=age*seed.spinZ+Math.sin(seed.phase+age*6)*.23;
 return out;
}
export function makeCelebrationSeeds(kind,count,{x=-.57,start=10.35}={}){
 return Array.from({length:count},(_,i)=>{
  const side=i%2?-1:1,h=(s)=>random(i,s),overhead=kind==='ribbon'||i%3===0;
  const seed={start:start+(kind==='spark'?(Math.floor(i/70)%6)*.44+.08*h(1):.15+3.1*h(1)),life:kind==='spark'?1.6+.5*h(2):3.1+1.3*h(2),
   x:x+side*(overhead?(.2+3.7*h(3)):(3.0+.9*h(3))),y:overhead?3.1+1.7*h(4):.20+.4*h(4),z:-1.4+5.2*h(5),
   vx:-side*(overhead?(.2+1.6*h(6)):(3.4+3.8*h(6))),vy:overhead?(-.8-1.3*h(7)):(7.4+2.4*h(7)),vz:(h(8)-.5)*3,
   drag:kind==='spark'?.8+.35*h(9):1.5+1.5*h(9),wind:(h(10)-.5)*.50,
   phase:h(11)*Math.PI*2,spinX:4+7*h(12),spinY:3+6*h(13),spinZ:(h(14)-.5)*13,size:kind==='ribbon'?.6+.55*h(15):.045+.045*h(15)};
  if(kind==='spark'){
   const group=Math.floor(i/70)%6,angle=h(16)*Math.PI*2,speed=2.5+3.9*h(17);
   seed.x=x+[-3.5,2.4,-1.1,3.6,0,-2.8][group];seed.y=[2.5,3.3,3.8,2.0,2.7,1.7][group];seed.z=[-1.0,1.2,-1.7,2.6,3.8,3.2][group];
   seed.vx=Math.cos(angle)*speed;seed.vy=Math.sin(angle)*speed+1.8;seed.vz=(h(18)-.5)*2.6;seed.size=.65+.7*h(19);
  }
  return seed;
 });
}
