import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {planFilmStartup,createFilmTransferMeter} from '../src/film-buffer-plan.mjs';
import {createFilmCache} from '../src/film-cache.mjs';

const MB=1_000_000;
const movie={duration:20,initBytes:100,segments:Array.from({length:20},(_,i)=>({start:i,duration:1,bytes:i>=8&&i<12?3*MB:.1*MB}))};
test('startup planning covers a future bitrate burst, not just the first seconds or average rate',()=>{
 const planned=planFilmStartup(movie,{bytesPerSecond:MB,confident:true});
 assert.ok(planned.seconds>4,'a 12 MB future burst needs more than four low-bitrate seconds');
 let cumulative=movie.initBytes;
 for(const segment of movie.segments){cumulative+=segment.bytes;assert.ok(planned.bytes+planned.rate*Math.max(0,segment.start-2.5)>=cumulative,'every future fragment has a conservative transfer deadline');}
 const fast=planFilmStartup(movie,{bytesPerSecond:20*MB,confident:true});assert.equal(fast.seconds,4);
 assert.equal(planFilmStartup(movie,{bytesPerSecond:Infinity,confident:true}).seconds,20);
 assert.equal(planFilmStartup(movie,{bytesPerSecond:20*MB,confident:false}).seconds,20,'an unmeasured or cached-only link cannot claim fast future transfers');
});

test('the actual high-quality film admits smaller buffers as genuine throughput increases',async()=>{
 const manifest=JSON.parse(await fs.readFile(new URL('../assets/media/film-hd/manifest.json',import.meta.url),'utf8'));
 const plans=[5,10,20,50].map(mbps=>planFilmStartup(manifest,{bytesPerSecond:mbps*1e6/8,confident:true}));
 assert.ok(plans[0].bytes>plans[1].bytes&&plans[1].bytes>plans[2].bytes&&plans[2].bytes>plans[3].bytes);
 assert.equal(plans.at(-1).seconds,4);assert.ok(plans[0].bytes>50*MB,'5 Mbps cannot safely start an 83 MB film from only four seconds');
 for(const planned of plans){let cumulative=manifest.initBytes;for(const segment of manifest.segments){cumulative+=segment.bytes;assert.ok(planned.bytes+planned.rate*Math.max(0,segment.start-2.5)+.001>=cumulative);}}
});

test('throughput counts overlapping requests once and requires two actual network samples',()=>{
 let time=0;const meter=createFilmTransferMeter({now:()=>time});meter.cache(100*MB);
 assert.equal(meter.snapshot().confident,false);assert.equal(meter.snapshot().bytesPerSecond,0);
 meter.start('a');time=500;meter.start('b');meter.add('a',MB);time=1000;meter.end('a');
 assert.equal(meter.snapshot().confident,false);meter.add('b',MB);time=1500;meter.end('b');
 const state=meter.snapshot();assert.equal(state.confident,true);assert.equal(state.bytesPerSecond,2*MB/1.5);assert.equal(state.networkSamples,2);assert.equal(state.cacheBytes,100*MB);
 meter.start('stalled');time=6500;assert.ok(meter.snapshot().bytesPerSecond<state.bytesPerSecond/3,'a currently stalled transfer reduces the forecast');
 meter.end('stalled',{ok:false});
});

test('HTTP-cache transfers cannot establish a network-speed estimate',()=>{
 let time=0;const meter=createFilmTransferMeter({now:()=>time});
 for(const key of ['a','b']){meter.start(key);meter.add(key,2*MB);time++;meter.end(key,{cached:true});}
 assert.equal(meter.snapshot().confident,false);assert.equal(meter.snapshot().networkBytes,0);assert.equal(meter.snapshot().cacheBytes,4*MB);
});

function cacheFixture({blockedWrites=false}={}){
 const values=new Map(),deleted=[];let release;
 const block=blockedWrites?new Promise(resolve=>release=resolve):Promise.resolve();
 const storage={async open(){return{async match(url){return values.get(url)?.clone();},async put(url,response){await block;values.set(url,response);},async delete(url){return values.delete(url);}};},async keys(){return['linggan-film-v1-old','unrelated-cache'];},async delete(name){deleted.push(name);return true;}};
 return{storage,values,deleted,release};
}
const tick=()=>new Promise(resolve=>setImmediate(resolve));
test('content-addressed cache reuses exact bytes and removes only obsolete film caches',async()=>{
 const f=cacheFixture(),cache=createFilmCache({storage:f.storage}),url='https://film.test/segment-abcdef123456.bin';cache.configure('abcdef123456');
 cache.write(url,new Uint8Array([1,2,3]));assert.deepEqual([...new Uint8Array(await cache.read(url,3))],[1,2,3]);
 assert.deepEqual(f.deleted,['linggan-film-v1-old']);assert.equal(cache.snapshot().hits,1);
 assert.equal(await cache.read(url,4),null,'corrupt/truncated cached content falls back to network');
});

test('cache storage can fail or hang without holding later film requests',async()=>{
 let opens=0;const cache=createFilmCache({timeoutMs:10,storage:{open(){opens++;return new Promise(()=>{});}}});cache.configure('abcdef123456');
 assert.equal(await cache.read('https://film.test/segment-abcdef123456.bin',3),null);assert.equal(cache.snapshot().enabled,false);
 assert.equal(await cache.read('https://film.test/segment-fedcba654321.bin',3),null);assert.equal(opens,1);
});

test('slow persistent storage retains at most two pending writes',async()=>{
 const f=cacheFixture({blockedWrites:true}),cache=createFilmCache({storage:f.storage});cache.configure('abcdef123456');
 for(let i=0;i<10;i++)cache.write('https://film.test/segment-'+i+'-abcdef123456.bin',new Uint8Array(3));
 assert.equal(cache.snapshot().pending,2);await tick();f.release();await tick();await tick();assert.equal(cache.snapshot().pending,0);assert.equal(f.values.size,2);
});
