// Deterministic CPU samplers for the existing side effects. No extra particles,
// render loop, scene, camera, assets or GPU work. Caller reuses one output object.
const clamp=x=>Math.max(0,Math.min(1,x));
const smooth=(a,b,t)=>{const x=clamp((t-a)/(b-a));return x*x*(3-2*x);};
const hash=(i,s=0)=>{let v=Math.imul((i+1)|0,1664525)+Math.imul(s+1,1013904223);v^=v>>>16;v=Math.imul(v,2246822507);v^=v>>>13;return(v>>>0)/4294967295;};
export const SIDE_BURST_DELAYS=[0,.15,.32,.52,.73,.93,1.13];
export function makeSideSparkSeeds(count){
 return Array.from({length:count},(_,i)=>{
  const burst=Math.floor(i/116),n=i%116,a=(n+.35*hash(i,17))/116*Math.PI*2,speed=2.5+hash(i,12)*2.8;
  return{start:10.20+SIDE_BURST_DELAYS[burst]+.05*(hash(i,70)-.5),life:1.85+.75*hash(i,71),
   x:(burst%2?-1:1)*(10.45+(burst%3)*.5),y:7.1+(burst%3)*.85+(burst%2)*.2,z:-2.7+(burst%3)*.42,
   vx:Math.cos(a)*speed,vy:Math.sin(a)*speed,vz:.15*Math.sin(a*3+burst)*speed,
   drag:.75+.25*hash(i,72),gravity:1.0+.25*hash(i,73),width:.20+.45*hash(i,44),shutter:.025+.045*hash(i,3),energy:.45+.55*hash(i,74)};
 });
}
export function sampleSideSpark(s,t,o){
 const age=t-s.start;o.alpha=0;if(age<=0||age>=s.life)return o;
 const decay=Math.exp(-s.drag*age),travel=(1-decay)/s.drag;
 o.x=s.x+s.vx*travel;o.y=s.y+s.vy*travel-.5*s.gravity*age*age;o.z=s.z+s.vz*travel;
 o.vx=s.vx*decay;o.vy=s.vy*decay-s.gravity*age;o.vz=s.vz*decay;
 o.alpha=smooth(0,.035,age)*(1-smooth(s.life*.25,s.life,age))*s.energy;
 const speed=Math.hypot(o.vx,o.vy,o.vz);
 o.length=Math.max(.055,Math.min(.50,speed*s.shutter))*(.35+.65*(1-age/s.life));o.width=s.width*Math.sqrt(o.alpha);return o;
}
export function makeColdSparkSeeds(count){
 return Array.from({length:count},(_,i)=>{
  const jet=Math.floor(i/155),side=jet<2?-1:1,vy=8+2.4*hash(i,8),gravity=8.8;
  return{start:10.23+(jet%2)*.12+1.7*hash(i,41),life:2*vy/gravity*.96,
   x:side*(9.2+(jet%2)*1.85),y:-1.49,z:1.8+(jet%2)*.8,
   vx:-side*(.15+.55*hash(i,18))+(hash(i,61)-.5)*.44,vy,vz:(hash(i,77)-.5)*.45,
   gravity,width:.30+.30*hash(i,22),shutter:.018+.014*hash(i,34)};
 });
}
export function sampleColdSpark(s,t,o){
 const age=t-s.start;o.alpha=0;if(age<=0||age>=s.life)return o;
 o.x=s.x+s.vx*age;o.y=s.y+s.vy*age-.5*s.gravity*age*age;o.z=s.z+s.vz*age;
 o.vx=s.vx;o.vy=s.vy-s.gravity*age;o.vz=s.vz;
 o.alpha=smooth(0,.035,age)*(1-smooth(s.life*.35,s.life,age));
 o.length=Math.min(.28,Math.max(.045,Math.hypot(o.vx,o.vy,o.vz)*s.shutter));o.width=s.width*Math.sqrt(o.alpha);return o;
}
export function makeSideRibbonSeeds(count){
 return Array.from({length:count},(_,i)=>({start:10.45+(i%5)*.12+.35*hash(i,81),life:7.5+1.5*hash(i,82),side:i%2?-1:1,
  x:(i%2?-1:1)*(4.0+hash(i,3)*7.9),y:6.3+hash(i,9)*4.1,z:i%4===0?5.8:-(.7+hash(i,12)*2.4),
  phase:hash(i,83)*Math.PI*2,speed:.25+.22*hash(i,23),size:.55+.55*hash(i,31),stretch:.8+.3*hash(i,84)}));
}
export function sampleSideRibbon(s,t,o){
 const age=t-s.start;o.alpha=0;if(age<=0||age>=s.life)return o;
 const phase=s.phase;o.x=s.x+s.side*.08*age+.38*Math.sin(phase+age*1.5)+.12*Math.sin(age*3+phase);
 o.y=s.y-s.speed*age-.13*age*age+.18*Math.sin(phase+age*1.1);o.z=s.z+.16*Math.sin(phase+age*.8);
 o.rx=.4*Math.sin(phase+age*.9);o.ry=phase+age*.5;o.rz=s.side*.5+.8*Math.sin(phase+age*.65);
 o.alpha=smooth(0,.25,age)*(1-smooth(s.life*.65,s.life,age));o.size=s.size;o.stretch=s.stretch;return o;
}
