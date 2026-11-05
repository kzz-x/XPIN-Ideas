import test from 'node:test';
import assert from 'node:assert/strict';
import {createFilmMedia} from '../src/film-media.mjs';

test('decoder warmup awaits all bytes, runs silently, rewinds, restores audio and is cached',async()=>{
 const fetchBefore=globalThis.fetch,mseBefore=globalThis.MediaSource;
 let release;const blocked=new Promise(resolve=>release=resolve),states=[],video=new EventTarget();
 Object.assign(video,{duration:52,currentTime:0,readyState:3,videoWidth:1280,videoHeight:720,muted:false,volume:.15,paused:true,seeking:false,buffered:{length:0},playCount:0,load(){},pause(){this.paused=true;},play(){assert.equal(this.muted,true);assert.equal(this.volume,0);this.paused=false;this.playCount++;this.currentTime=2.55;return Promise.resolve();},getVideoPlaybackQuality(){return{totalVideoFrames:this.playCount*77,droppedVideoFrames:0};}});
 globalThis.MediaSource=undefined;
 globalThis.fetch=async url=>{if(String(url).endsWith('manifest.json'))return new Response(JSON.stringify({duration:52,segments:[],mobileFallback:'film.mp4',mobileBytes:3}));await blocked;return new Response(new Uint8Array([1,2,3]),{headers:{'Content-Length':'3'}});};
 const media=createFilmMedia(video,{manifestURL:'https://example.test/manifest.json',onChange:s=>states.push(s)});
 try{
  const task=media.preflightDecode();await new Promise(r=>setTimeout(r,20));assert.equal(video.playCount,0);release();const result=await task;
  assert.equal(result.frames,77);assert.equal(result.dropped,0);assert.equal(video.currentTime,0);assert.equal(video.paused,true);assert.equal(video.volume,.15);assert.equal(video.muted,false);assert.equal(media.preflighting,false);
  assert.ok(states.some(s=>s.preflighting));await media.preflightDecode();assert.equal(video.playCount,1);
 }finally{media.dispose();globalThis.fetch=fetchBefore;globalThis.MediaSource=mseBefore;}
});
