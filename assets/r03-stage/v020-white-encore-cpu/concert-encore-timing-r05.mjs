import {makeCelebrationSeeds,random} from './concert-physics-r04.mjs';
// Keep all 1108 identities, geometry, velocities, drag and gravity. A bounded
// cohort now celebrates at the ACTUAL full musical ending instead of all
// particles having hit the floor by the old 10.733-second performance cut.
export function makeEncoreSeeds(kind,count,{musicEnd,...options}={}){
 if(!Number.isFinite(musicEnd))throw Error('Actual music end is required for encore timing');
 return makeCelebrationSeeds(kind,count,options).map((seed,id)=>{
  const result={...seed,id,originalStart:seed.start,lateEncoreCohort:false};
  if(kind==='paper'&&id%4===3){result.start=musicEnd-.45+random(id,201);result.lateEncoreCohort=true;}
  if(kind==='ribbon'&&id%3===2){result.start=musicEnd-.4+.9*random(id,202);result.lateEncoreCohort=true;}
  if(kind==='spark'){
   const group=Math.floor(id/70)%6;
   if(group>=4){result.start=musicEnd-.35+(group-4)*.55+.08*random(id,203);result.lateEncoreCohort=true;}
  }
  return result;
 });
}
