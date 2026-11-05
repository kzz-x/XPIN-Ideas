import test from 'node:test';
import assert from 'node:assert/strict';
import {PresentationTransport} from '../src/transport-r07.mjs';

class Media extends EventTarget {
  constructor(duration){super();Object.assign(this,{duration,currentTime:0,readyState:2,paused:true,seeking:false,ended:false,volume:1,muted:false});}
  play(){this.paused=false;return Promise.resolve();}
  pause(){this.paused=true;}
}
function setup(){const video=new Media(51.9833333333),impact=new Media(5.5);return {video,impact,t:new PresentationTransport(video,impact)};}

test('natural playback retains the entire native opening without restarting the audio',async()=>{
  const {video,t}=setup();await t.start();video.currentTime=35.999;t.update(1/60);assert.equal(t.phase,'film');
  video.currentTime=36.015;t.update(1/60);assert.equal(t.phase,'stage');assert.ok(t.time<.02);assert.equal(video.paused,false);assert.equal(video.currentTime,36.015);
  assert.equal(t.events.filter(e=>e.event==='visual-cut').length,1);t.update(1/60);assert.equal(t.events.filter(e=>e.event==='visual-cut').length,1);
});
test('settings preview starts at the same source frame as the natural stage opening',()=>{
  const {video,t}=setup();t.enterStage(0,{resume:false});assert.equal(t.time,0);assert.equal(t.currentTime,36);assert.equal(video.currentTime,36);assert.equal(t.phase,'stage');
});
test('scrubbing across the revised cut preserves play state while keeping fireworks silent',async()=>{
  const {video,impact,t}=setup();await t.start();t.beginScrub();t.previewScrub(35.5);assert.equal(t.phase,'film');
  t.previewScrub(36.5);assert.equal(t.phase,'stage');assert.equal(t.playing,false);t.endScrub();await Promise.resolve();assert.equal(t.playing,true);assert.equal(video.paused,false);
  t.seek(46.85,{resume:false});assert.equal(impact.paused,true);assert.equal(impact.volume,0);assert.equal(video.currentTime,46.85);assert.equal(t.duration,52.45);
});
