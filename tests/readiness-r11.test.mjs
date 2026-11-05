import test from 'node:test';
import assert from 'node:assert/strict';
import {segmentRange,bufferedAhead} from '../src/film-media.mjs';
import {PresentationTransport} from '../src/transport-r07.mjs';

class Media extends EventTarget{
  constructor(duration=51.983333){super();Object.assign(this,{duration,currentTime:0,readyState:2,paused:true,seeking:false,ended:false,volume:1,muted:false});}
  play(){this.paused=false;return Promise.resolve();}pause(){this.paused=true;}
}
test('buffer readiness rejects a gap even when later segments have downloaded',()=>{
  const ranges=[[0,5],[8,14]],video={currentTime:6,buffered:{length:2,start:i=>ranges[i][0],end:i=>ranges[i][1]}};
  assert.equal(bufferedAhead(video),0);assert.equal(bufferedAhead(video,2),3);assert.equal(bufferedAhead(video,10),4);
});
test('seeking to the handoff requests the boundary keyframe and following segments',()=>{
  const segments=Array.from({length:26},(_,i)=>({start:i*2,duration:i===25?1.983333:2}));
  assert.deepEqual(segmentRange(segments,35.9,3),[17,18,19]);
  assert.deepEqual(segmentRange(segments,50.5,8),[25]);
});
test('an unprepared stage holds the current film frame instead of revealing an empty scene',async()=>{
  let ready=false;const video=new Media(),t=new PresentationTransport(video,new Media(5.5),{canEnterStage:()=>ready});
  await t.start();video.currentTime=36.01;t.update(1/60);assert.equal(t.phase,'film');assert.equal(video.paused,true);assert.equal(t.waitingAt,'stage');
  ready=true;t.update(1/60);await Promise.resolve();t.update(1/60);assert.equal(t.phase,'stage');assert.equal(video.paused,false);assert.equal(video.currentTime,36.01);
});
test('skipping waits for the full scroll readiness and then completes the handoff once',()=>{
  let ready=false,departures=0;const t=new PresentationTransport(new Media(),new Media(5.5),{canDepart:()=>ready,onDeparture:()=>departures++});
  t.skipFilm();assert.equal(departures,0);assert.equal(t.waitingAt,'scroll');ready=true;t.update(1/60);t.update(1/60);assert.equal(departures,1);assert.equal(t.phase,'departure');
});
test('scrubbing beyond the cut while stage shaders are pending keeps the film visible, including while paused',async()=>{
  let ready=false,entries=0;const v=new Media(),t=new PresentationTransport(v,new Media(5),{canEnterStage:()=>ready,onStage:()=>entries++});
  await t.start();t.seek(40,{resume:false});t.update(.016);assert.equal(t.phase,'film');assert.equal(entries,0);
  ready=true;t.update(.016);assert.equal(t.phase,'stage');assert.equal(entries,1);assert.equal(t.playing,false);assert.equal(v.currentTime,40);
});
test('the playback clock advances when a busy browser delivers seeked several frames late',async()=>{
  const v=new Media(),t=new PresentationTransport(v,new Media(5));await t.start();v.seeking=true;t.seek(1,{resume:true});await Promise.resolve();v.currentTime=1.18;v.seeking=false;v.dispatchEvent(new Event('seeked'));t.update(.016);assert.equal(t.pendingSeek,null);assert.equal(t.currentTime,1.18);
});
test('native streaming timestamp offset preserves the original edit cue and audio position',()=>{
  const offset=1/30,video=new Media(51.983333+offset),t=new PresentationTransport(video,new Media(5.5),{getMediaOffset:()=>offset});
  t.seek(36,{resume:false});assert.ok(Math.abs(video.currentTime-(36+offset))<1e-9);assert.equal(t.currentTime,36);assert.ok(Math.abs(t.filmDuration-51.983333)<1e-9);
});
