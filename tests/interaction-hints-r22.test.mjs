import test from 'node:test';
import assert from 'node:assert/strict';
import {createBubbleEmphasis} from '../src/bubble-emphasis.mjs';
import {progress,birthForThreshold} from '../assets/dot/effects/horn-dissolve-math-r05.mjs';
test('new dialogue pulses while already visible, and a newly shown bubble gets attention once',()=>{
 const played=[];let sounds=0;const element={animate:(frames,options)=>{played.push({frames,options});return{cancel(){}};}};
 const cue=createBubbleEmphasis(element,{reduced:()=>false,onCue:()=>sounds++});
 cue.announce();cue.update(false);assert.equal(played.length,0);cue.update(true);cue.update(true);assert.equal(played.length,1);
 cue.announce();cue.update(true);assert.equal(played.length,2);cue.update(false);cue.update(true);assert.equal(played.length,3);assert.equal(sounds,3);
});
test('reduced-motion dialogue uses colour emphasis without a scaling animation',()=>{
 let frames;const cue=createBubbleEmphasis({animate:f=>{frames=f;return{cancel(){}};}},{reduced:()=>true});cue.update(true);assert.ok(frames.every(f=>!f.transform));
});
test('the horn is retired within 0.45 seconds of the actual music ending, with consistent grain births',()=>{
 assert.equal(progress(14.809),0);assert.equal(progress(14.809+.45),1);assert.equal(progress(14.809+.25),.5);
 for(const threshold of [.1,.25,.5,.75,.9])assert.ok(Math.abs(progress(birthForThreshold(threshold))-threshold)<.00001);
});
