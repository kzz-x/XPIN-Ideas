import test from 'node:test';
import assert from 'node:assert/strict';
import {sandProfile} from '../src/sand-sound.mjs';
import {ParticlePhysics} from '../src/particle-physics.mjs';
const state=(time,extra={})=>({time,count:100,settled:0,maxSpeed:4,refinement:0,ready:false,...extra});

test('sand layers start with actual release and move from travel into gathering',()=>{
 assert.equal(sandProfile(state(.05)).body,0);
 const travel=sandProfile(state(1.7)),gather=sandProfile(state(3.7));
 assert.ok(travel.body>0&&travel.travel>0&&travel.fine>0);
 assert.equal(travel.stage,'travel');assert.equal(gather.stage,'gather');
 assert.ok(gather.fine>travel.fine&&gather.fineInterval<travel.fineInterval);
 const still=sandProfile(state(2,{maxSpeed:0}));assert.ok(still.travel<travel.travel);
});
test('real settling narrows the stereo image, refinement fades all layers, completion is silent',()=>{
 const active=sandProfile(state(3.5)),refine=sandProfile(state(5.5,{settled:100,refinement:.7})),done=sandProfile(state(5.8,{settled:100,refinement:1,ready:true}));
 assert.ok(refine.width<active.width*.3);
 for(const layer of ['body','travel','fine']){assert.ok(refine[layer]<active[layer]);assert.equal(done[layer],0);}
 assert.equal(done.complete,true);assert.equal(done.stage,'complete');
 assert.equal(sandProfile({time:3,count:0}).body,0);
});
test('sound state follows the solver at 30 and 120 fps, independent of wall-clock playback duration',()=>{
 function run(fps,slow=1){const sim=new ParticlePhysics(8);for(let i=0;i<8;i++){sim.origin.set([i*.1,1,0],i*3);sim.target.set([i*.1,-1,-1],i*3);}sim.reset();let landedAt=null,result;
  for(let wall=0;wall<20;wall+=1/fps){const s=sim.advance(slow/fps);if(s.settled===s.count&&landedAt===null)landedAt=s.time;result=sandProfile({...s,refinement:landedAt===null?0:Math.min(1,(s.time-landedAt)/.72)});if(result.complete)return{wall,visual:s.time,result};}throw Error('Never settled');}
 const normal=run(120),coarse=run(30),slow=run(120,.5);
 assert.ok(Math.abs(normal.visual-coarse.visual)<.07);
 assert.ok(Math.abs(normal.visual-slow.visual)<.03);
 assert.ok(slow.wall>normal.wall*1.95);
 assert.equal(slow.result.body,0);
});
