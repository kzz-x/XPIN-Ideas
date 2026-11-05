import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as T from '../assets/dot/model/frozen/r07d/editable-stage/素材/v011/DotSharedWeb/vendor/three.module.js';
import {createStageScreen,stageWhiteMix} from '../src/stage-screen.mjs';
import {PresentationTransport} from '../src/transport-r07.mjs';
import {CONFIG} from '../src/config.mjs';

class Media extends EventTarget{
  constructor(duration=51.983333){super();Object.assign(this,{duration,currentTime:0,readyState:2,paused:true,seeking:false,ended:false,volume:1,muted:false,playCount:0,pauseCount:0,videoWidth:1920,videoHeight:1080});}
  play(){this.playCount++;this.paused=false;return Promise.resolve();}
  pause(){this.pauseCount++;this.paused=true;}
}

test('film-to-white starts on Dot entry, takes two seconds, and reverses smoothly when seeking',()=>{
  assert.equal(stageWhiteMix(-1),0);assert.equal(stageWhiteMix(1),0);assert.equal(stageWhiteMix(2),.5);
  for(const t of [3,10.35,15.7,18.15])assert.equal(stageWhiteMix(t),1);
  let previous=0;for(let i=0;i<=300;i++){const value=stageWhiteMix(i/100);assert.ok(value>=previous&&value<=1);previous=value;}
  assert.equal(stageWhiteMix(2),.5);
});

test('impact never loads or plays through unlock, natural playback, seeks, resume, scrub and mute',async()=>{
  const film=new Media(),impact=new Media(5.5),transport=new PresentationTransport(film,impact);
  assert.equal(CONFIG.stage.impactEnabled,false);assert.equal(impact.src,undefined);
  await transport.unlock();await transport.start();film.currentTime=36.01;transport.update(.016);film.currentTime=46.85;transport.update(.016);
  assert.equal(transport.phase,'stage');assert.equal(film.paused,false);assert.equal(film.currentTime,46.85);
  transport.pause();await transport.resume();transport.seek(48,{resume:true});await Promise.resolve();
  transport.beginScrub();transport.previewScrub(47);transport.endScrub();await Promise.resolve();
  impact.dispatchEvent(new Event('loadedmetadata'));transport.setMuted(true);transport.setMuted(false);transport.restoreVolumes();
  assert.equal(impact.playCount,0);assert.equal(impact.paused,true);assert.equal(impact.volume,0);assert.ok(film.playCount>0);
  assert.equal(transport.duration,54.15);transport.dispose();
});

test('stage screen owns no process video and does not interrupt the shared soundtrack',async()=>{
  const previous={HTMLVideoElement:globalThis.HTMLVideoElement,location:globalThis.location,document:globalThis.document,source:globalThis.DOT_STAGE_OPENING_SOURCE};
  globalThis.HTMLVideoElement=Media;globalThis.location={href:'https://example.test/',origin:'https://example.test'};
  globalThis.document={createElement(){throw Error('Stage must not create process media');}};
  const film=new Media();film.currentTime=36;film.paused=false;
  globalThis.DOT_STAGE_OPENING_SOURCE={kind:'video',status:'approved',element:film,uri:'https://example.test/film.mp4',inPoint:36,fps:60};
  const material=new T.MeshBasicMaterial({color:'#ffffff',map:new T.Texture(),toneMapped:false});let invalidations=0;
  const stage={screenMat:material,backdrop:{invalidate(){invalidations++;}}};
  try{
    const screen=await createStageScreen(stage,{fadeStart:0,fadeDuration:1.25});
    assert.equal(screen.video,undefined);assert.equal(screen.update(0).whiteMix,0);
    assert.equal(screen.update(.625).whiteMix,.5);assert.equal(screen.update(10.35).whiteMix,1);
    assert.equal((await screen.seekExact(.625)).whiteMix,.5);screen.pause();assert.equal(film.paused,false);assert.equal(film.currentTime,36);
    const snapshot=screen.update(19.25);assert.equal(snapshot.processVideoLoaded,false);assert.equal(snapshot.whiteRadiance,1);assert.equal(snapshot.openingSource.sharedDecoder,true);
    film.videoWidth=1080;film.videoHeight=1920;screen.update(.5);assert.ok(screen.uniforms.uOpeningScale.value.x<1);
    const shader={uniforms:{},fragmentShader:'#include <map_fragment>'};material.onBeforeCompile(shader,{});
    assert.ok(shader.fragmentShader.includes('mix(openingFrame,vec3(uWhiteRadiance),uWhiteMix)'));assert.ok(!shader.fragmentShader.includes('uProcessVideo'));assert.equal(material.toneMapped,false);
    screen.dispose();assert.equal(film.pauseCount,0);assert.equal(film.playCount,0);assert.ok(invalidations>0);
  }finally{globalThis.HTMLVideoElement=previous.HTMLVideoElement;globalThis.location=previous.location;globalThis.document=previous.document;globalThis.DOT_STAGE_OPENING_SOURCE=previous.source;material.dispose();}
});

test('active integration no longer waits on process media or dims white, and retains concert visuals',()=>{
  const main=readFileSync(new URL('../src/main.mjs',import.meta.url),'utf8');
  const stage=readFileSync(new URL('../src/stage-r03.mjs',import.meta.url),'utf8');
  const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
  assert.ok(!main.includes('dot.source.media.video'));assert.ok(!stage.includes('stage-process-r03.mp4'));assert.ok(!stage.includes('media.video.pause'));
  assert.ok(!stage.includes('uWhiteRadiance.value=T.MathUtils.lerp'));assert.ok(stage.includes('concert.update(time'));assert.ok(stage.includes('dissolve.update(time)'));
  assert.ok(!html.includes('src="./assets/media/stage-impact-r03.m4a"'));
});
