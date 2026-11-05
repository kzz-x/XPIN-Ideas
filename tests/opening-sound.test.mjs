import test from 'node:test';
import assert from 'node:assert/strict';
import {glassProfile} from '../src/opening-sound.mjs';

for(const kind of ['hold','particles'])test(`${kind}: audible acceleration follows progress without needing a louder master`,()=>{
 const values=Array.from({length:21},(_,i)=>glassProfile(i/20,kind));
 for(let i=1;i<values.length;i++){
  assert.ok(values[i].interval<values[i-1].interval);
  assert.ok(values[i].rate>values[i-1].rate);
  assert.ok(values[i].duration<=values[i-1].duration);
 }
 assert.ok(values[0].interval/values.at(-1).interval>5.5);
 assert.ok(values.at(-1).gain<.07);
});
test('settled particles fade and narrow to the centre while invalid progress stays bounded',()=>{
 assert.ok(glassProfile(1,'particles',1).gain<glassProfile(1,'particles',0).gain*.15);
 assert.ok(glassProfile(1).width<glassProfile(0).width*.25);
 assert.deepEqual(glassProfile(-4),glassProfile(0));
 assert.deepEqual(glassProfile(4),glassProfile(1));
 assert.deepEqual(glassProfile(NaN),glassProfile(0));
});
