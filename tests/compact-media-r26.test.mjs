import test from 'node:test';
import assert from 'node:assert/strict';
import {createFilmMedia} from '../src/film-media.mjs';
test('desktop progressive preload deduplicates homepage and playback requests and holds readiness until all bytes arrive',async()=>{
 const previous=globalThis.fetch;let release;const blocked=new Promise(r=>release=r),requests=[],video=new EventTarget();
 Object.assign(video,{currentTime:0,duration:52,readyState:3,videoWidth:1920,videoHeight:1080,buffered:{length:0},load(){},pause(){}});
 globalThis.fetch=async url=>{requests.push(String(url));if(String(url).endsWith('manifest.json'))return new Response(JSON.stringify({file:'film-hd.mp4',fileBytes:3,duration:52,width:1920,height:1080,fps:60,segments:[]}));await blocked;return new Response(new Uint8Array([1,2,3]));};
 const media=createFilmMedia(video,{manifestURL:'https://example.test/manifest.json'});
 try{const homepage=media.prime(),playback=media.preparePlayback();await new Promise(r=>setTimeout(r,20));assert.equal(media.snapshot().complete,false);assert.equal(media.canPlayAt(0),false);assert.equal(media.snapshot().mode,'1080p-file');release();await Promise.all([homepage,playback]);assert.equal(requests.length,2);assert.equal(media.snapshot().complete,true);assert.equal(media.snapshot().bytes,3);assert.equal(media.snapshot().totalBytes,3);assert.equal(media.canPlayAt(0),true);assert.ok(video.src.startsWith('blob:'));await media.prime();assert.equal(requests.length,2);}finally{media.dispose();globalThis.fetch=previous;}
});
