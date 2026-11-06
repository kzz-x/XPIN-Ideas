import test from 'node:test';
import assert from 'node:assert/strict';
import {createFrameLoop} from '../src/frame-loop.mjs';

function harness(){
  const pending=new Map(),frames=[],wakes=[];let id=0,clock=0,animate=false,loop;
  loop=createFrameLoop({request:fn=>{pending.set(++id,fn);return id;},cancel:id=>pending.delete(id),now:()=>clock,onWake:at=>wakes.push(at),onFrame:at=>{frames.push(at);if(animate)loop.schedule();}});
  return{loop,pending,frames,wakes,setAnimate:value=>animate=value,advance(time){clock=time;const entries=[...pending];pending.clear();for(const [,fn]of entries)fn(time);},setClock:time=>clock=time};
}
test('settled reading stops requesting frames and a later input resets its frame clock once',()=>{
  const h=harness();h.loop.wake();h.loop.wake();assert.equal(h.pending.size,1);h.advance(16);assert.equal(h.pending.size,0);
  h.setClock(20000);h.loop.wake();h.loop.wake();assert.deepEqual(h.wakes,[0,20000]);h.advance(20016);assert.deepEqual(h.frames,[16,20016]);
});
test('animated frames stay continuous while background visibility cancels work and resumes without stale elapsed time',()=>{
  const h=harness();h.setAnimate(true);h.loop.wake();h.advance(16);h.advance(32);assert.deepEqual(h.wakes,[0]);assert.equal(h.pending.size,1);
  h.loop.setHidden(true);assert.equal(h.pending.size,0);h.loop.wake();assert.equal(h.pending.size,0);h.advance(10000);assert.deepEqual(h.frames,[16,32]);
  h.loop.setHidden(false);assert.deepEqual(h.wakes,[0,10000]);h.advance(10016);assert.deepEqual(h.frames,[16,32,10016]);assert.equal(h.pending.size,1);
});
