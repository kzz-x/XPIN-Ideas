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
test('the accepted B hold gets faster spacing and pitch without increasing its energy',()=>{
 for(const p of [0,.25,.5,.75,1]){
  const next=glassProfile(p),oldInterval=.135*(1-p**1.45)+.019*p**1.45;
  const oldGain=.018+.045*p*p;
  assert.ok(next.interval<=oldInterval*.82);
  assert.ok(next.rate>.72+p*.78);
  assert.ok(next.gain*next.gain/next.interval<=oldGain*oldGain/oldInterval+1e-9);
 }
});
