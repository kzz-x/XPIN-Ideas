import {waitFor} from './preparation.mjs';
import {planFilmStartup,createFilmTransferMeter} from './film-buffer-plan.mjs';
import {createFilmCache} from './film-cache.mjs';

export function segmentRange(segments,start,seconds){const end=start+seconds;return segments.map((s,i)=>({s,i})).filter(({s})=>s.start<end&&s.start+s.duration>start-.025).map(({i})=>i);}
export function bufferedAhead(video,at=video.currentTime){for(let i=0;i<video.buffered.length;i++)if(video.buffered.start(i)<=at+.08&&video.buffered.end(i)>at)return video.buffered.end(i)-at;return 0;}
const STARTUP_SECONDS=8;

/** One decoder and original audio clock for film + stage. Supported browsers
 * start from a real buffered window while the same source fills in background. */
export function createFilmMedia(video,{manifestURL,onChange=()=>{},onManifest=()=>{},cacheEnabled=true}={}){
  let manifest,source,buffer,objectURL,opening,pump,local=false,aborted=false,complete=false,serial=Promise.resolve(),loaded=new Set(),pending=new Map(),bytes=0,mode='idle',error=null,revision=0,totalBytes=0,notifiedAt=0;
  const abort=new AbortController(),events=[],partial=new Map(),filePartCache=new Map(),received=new Map(),queue=[],downloads=new Set();
  let activeChunks=0,nextAppendIndex=0,appending=false;
  let preflighting=false,decodeJob,decodeProbe=null,decodeKey='';
  let compatibleJob=null,recoveryJob=null,converting=false,mediaTimeOffset=0;
  const cache=createFilmCache({enabled:cacheEnabled}),meter=createFilmTransferMeter(),fetching=new Map();
  const originalQuality=()=>manifest?.qualityPolicy==='preserve-source';
  const transfer=()=>meter.snapshot();
  const plan=(at=0)=>planFilmStartup(manifest,{...transfer(),at,minimumSeconds:manifest?.delivery?.minimumBufferSeconds??4,safetySeconds:manifest?.delivery?.safetySeconds??2.5,rateMultiplier:manifest?.delivery?.rateMultiplier??.75});
  const concurrency=()=>Math.max(1,Math.min(4,manifest?.delivery?.maxConcurrent||2));
  let deliveryBase=manifestURL;
  const url=path=>new URL(path,deliveryBase).href;
  const record=(event,detail={})=>{events.push({event,at:performance.now(),...detail});if(events.length>80)events.shift();onChange(snapshot());};
  function startupState(downloadProgress){
    const adaptive=originalQuality()&&manifest?.segments?.length,planned=adaptive?plan():null;
    const seconds=planned?.seconds??Math.min(STARTUP_SECONDS,manifest?.duration||video.duration||STARTUP_SECONDS);
    if(mode!=='1080p-segments')return{startupProgress:downloadProgress,startupReady:!!(local||complete)&&video.readyState>=2,playbackReady:!!(local||complete)&&video.readyState>=2,startupBytes:bytes+[...partial.values()].reduce((a,b)=>a+b,0),startupTotalBytes:totalBytes,startupBufferSeconds:seconds};
    const required=[{src:manifest.init,bytes:manifest.initBytes||received.get(manifest.init)||0},...(adaptive?manifest.segments.slice(0,planned.index+1):segmentRange(manifest.segments,0,seconds+.04).map(i=>manifest.segments[i]))];
    const total=required.reduce((sum,item)=>sum+(item.bytes||0),0),downloaded=required.reduce((sum,item)=>sum+Math.min(item.bytes||0,received.get(item.src)||partial.get(item.src)||0),0);
    const ready=!converting&&video.readyState>=2&&bufferedAhead(video,0)>=Math.max(.05,seconds-(adaptive ? .04 : .001));
    return{startupProgress:total?Math.min(1,downloaded/total):0,startupReady:ready,playbackReady:ready,startupBytes:downloaded,startupTotalBytes:total,startupBufferSeconds:seconds,conservativeBytesPerSecond:planned?.rate||0,throughputConfident:planned?.confident||false};
  }
  function snapshot(){const downloading=bytes+[...partial.values()].reduce((a,b)=>a+b,0),downloadProgress=complete?1:Math.max(0,Math.min(1,totalBytes?downloading/totalBytes:0));return{mode,local,revision,complete,bufferComplete:buffer?bufferedAhead(video,0)>=Math.max(.05,(manifest?.duration||Infinity)-.04):complete,preflighting,decodeProbe,downloadProgress,progress:complete?1:Math.min(.99,downloadProgress),...startupState(downloadProgress),transfer:transfer(),cache:cache.snapshot(),converting,ready:video.readyState>=2,width:video.videoWidth,height:video.videoHeight,duration:manifest?.duration||video.duration||0,bytes:downloading,totalBytes,segmentsReady:loaded.size,segmentsTotal:manifest?.segments?.length||0,bufferedAhead:bufferedAhead(video),error,events:[...events]};}
  // Timeout means no incoming bytes, not a total time limit on a slow link.
  function fetchBytes(path){
    if(fetching.has(path))return fetching.get(path);
    const job=fetchBytesOnce(path).finally(()=>fetching.delete(path));fetching.set(path,job);return job;
  }
  async function fetchBytesOnce(path){
    const entry=manifest&&(path===manifest.init?{bytes:manifest.initBytes}:manifest.segments?.find(s=>s.src===path));
    const cached=entry&&await cache.read(url(path),entry.bytes);
    const accept=data=>{const previous=received.get(path)||0;bytes+=data.byteLength-previous;received.set(path,data.byteLength);partial.delete(path);return data;};
    if(cached){meter.cache(cached.byteLength);return accept(cached);}
    let failure;
    for(let retry=0;retry<3;retry++){
      if(aborted||abort.signal.aborted)throw abort.signal.reason||new DOMException('Cancelled','AbortError');
      const request=new AbortController();let timer;
      const cancel=()=>request.abort(abort.signal.reason),watch=()=>{clearTimeout(timer);timer=setTimeout(()=>request.abort(Error('影片下载暂时中断')),45000);};
      abort.signal.addEventListener('abort',cancel,{once:true});partial.set(path,0);const measured=!!entry&&path!==manifest.init;const started=performance.now();if(measured)meter.start(path);
      try{
        watch();const response=await fetch(url(path),{signal:request.signal,priority:'high'});if(!response.ok)throw Error('HTTP '+response.status);
        // Reuse the manifest's actual CDN base and HTTP connection. Repeating
        // the hosting-origin redirect for every binary costs another RTT.
        if(path===manifestURL&&response.url&&/^https?:/.test(response.url))deliveryBase=response.url;
        if(mode==='720p-compatible'&&path===(manifest.mobileFallback||manifest.fallback))totalBytes=Number(response.headers.get('Content-Length'))||totalBytes;
        let data;
        if(response.body?.getReader){
          const reader=response.body.getReader(),parts=[];let count=0;
          for(;;){const {done,value}=await reader.read();if(done)break;parts.push(value);count+=value.byteLength;partial.set(path,Math.max(0,count-(received.get(path)||0)));if(measured)meter.add(path,value.byteLength);watch();if(performance.now()-notifiedAt>200){notifiedAt=performance.now();onChange(snapshot());}}
          const joined=new Uint8Array(count);let at=0;for(const part of parts){joined.set(part,at);at+=part.byteLength;}data=joined.buffer;
        }else{data=await response.arrayBuffer();if(measured)meter.add(path,data.byteLength);}
        if(entry&&Number.isFinite(entry.bytes)&&data.byteLength!==entry.bytes)throw Error('影片分段长度不符');
        if(measured){const timing=globalThis.performance?.getEntriesByName?.(url(path))?.filter(e=>e.startTime>=started-1).at(-1);meter.end(path,{cached:!!timing&&timing.transferSize===0&&timing.decodedBodySize>0});}if(entry)cache.write(url(path),data);
        return accept(data);
      }catch(e){if(measured)meter.end(path,{ok:false});failure=e;partial.delete(path);if(aborted||retry===2)throw e;await new Promise(r=>setTimeout(r,350*(retry+1)));}
      finally{clearTimeout(timer);abort.signal.removeEventListener('abort',cancel);}
    }
    throw failure;
  }
  // Hosting services may limit a single upload. Byte parts are assembled into
  // one original MP4 Blob: there is still one decoder, timebase and audio track.
  // Two requests at a time keep memory/network pressure bounded. Finished
  // parts survive a retry of open(), so one failed part does not restart the film.
  async function fileBlob(parts,path,expectedBytes){
    if(!parts?.length){
      const data=await fetchBytes(path);if(aborted)throw abort.signal.reason;
      return new Blob([data],{type:'video/mp4'});
    }
    const entries=parts.map(part=>typeof part==='string'?{src:part}:part);
    if(entries.some(part=>!part||typeof part.src!=='string'||!part.src))throw Error('影片分块清单无效');
    const ordered=new Array(entries.length);let next=0,failure;
    async function worker(){
      while(!failure&&next<entries.length){
        const index=next++,part=entries[index],key=url(part.src);
        try{
          if(aborted)throw abort.signal.reason||new DOMException('Cancelled','AbortError');
          let data=filePartCache.get(key);
          if(data){const previous=received.get(part.src)||0;bytes+=data.byteLength-previous;received.set(part.src,data.byteLength);}
          else{
            data=await fetchBytes(part.src);
            if(Number.isFinite(part.bytes)&&data.byteLength!==part.bytes)throw Error('影片分块长度不符');
            if(aborted)throw abort.signal.reason;
            filePartCache.set(key,data);
          }
          ordered[index]=data;record('file-part-ready',{index,parts:entries.length});
        }catch(error){failure??=error;}
      }
    }
    await Promise.all(Array.from({length:Math.min(2,entries.length)},worker));
    if(failure)throw failure;
    if(aborted)throw abort.signal.reason||new DOMException('Cancelled','AbortError');
    const result=new Blob(ordered,{type:'video/mp4'});
    if(Number.isFinite(expectedBytes)&&result.size!==expectedBytes)throw Error('影片文件长度不符');
    return result;
  }
  function append(data){
    // MSE writes remain serialized; drainAppends also enforces the global
    // timeline, since late insertion can discard already-buffered B-frames.
    const incoming=Promise.resolve(data);incoming.catch(()=>{});
    const task=serial.then(async()=>{const bytes=await incoming;return new Promise((resolve,reject)=>{if(aborted)return reject(new DOMException('Cancelled','AbortError'));const done=()=>{clear();resolve();},fail=()=>{clear();reject(Error('影片分段解码失败'));},clear=()=>{buffer.removeEventListener('updateend',done);buffer.removeEventListener('error',fail);};buffer.addEventListener('updateend',done,{once:true});buffer.addEventListener('error',fail,{once:true});try{buffer.appendBuffer(bytes);}catch(e){clear();reject(e);}});});serial=task.catch(()=>{});return task;
  }
  function rejectChunks(reason){for(const task of pending.values())task.reject(reason);pending.clear();queue.length=0;}
  function recoverQuota(reason){
    if(recoveryJob)return recoveryJob;
    converting=true;rejectChunks(reason);
    // Publish one recovery promise before waiting on active network requests.
    // Manual seeks arriving during that wait must join it, never enqueue work
    // into the deliberately suspended MSE download/append queue.
    recoveryJob=(async()=>{await Promise.allSettled([...downloads]);await compatible();})().finally(()=>{recoveryJob=null;});
    return recoveryJob;
  }
  function drainAppends(){
    if(aborted||appending)return;
    const task=pending.get(nextAppendIndex);if(!task?.data)return;
    appending=true;
    append(task.data).then(()=>{loaded.add(task.index);nextAppendIndex++;pending.delete(task.index);task.data=null;record('segment-ready',{index:task.index});task.resolve();},reason=>{
      pending.delete(task.index);task.reject(reason);
      if(reason.name==='QuotaExceededError')rejectChunks(reason);
    }).finally(()=>{appending=false;drainAppends();drainChunks();});
  }
  function drainChunks(){
    while(!aborted&&!converting&&activeChunks<concurrency()&&queue.length){
      // Keep raw completed fragments bounded when one earlier request stalls.
      // Timeline writes are always chronological, even for a future seek.
      queue.sort((a,b)=>b.priority-a.priority||a.index-b.index);const eligible=queue.findIndex(task=>task.index<=nextAppendIndex+concurrency()+1);if(eligible<0)break;const [task]=queue.splice(eligible,1);activeChunks++;
      const incoming=fetchBytes(manifest.segments[task.index].src).then(data=>{
        if(pending.get(task.index)!==task||aborted)return;
        task.data=data;drainAppends();
      },reason=>{if(pending.get(task.index)===task){pending.delete(task.index);task.reject(reason);}}).finally(()=>{downloads.delete(incoming);activeChunks--;drainChunks();});
      downloads.add(incoming);
    }
  }
  function chunk(index,priority=0){
    if(loaded.has(index))return Promise.resolve();
    if(pending.has(index)){const task=pending.get(index);task.priority=Math.max(task.priority,priority);return task.promise;}
    if(aborted)return Promise.reject(abort.signal.reason||new DOMException('Cancelled','AbortError'));
    let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;}),task={index,priority,promise,resolve,reject};
    pending.set(index,task);queue.push(task);drainChunks();return promise;
  }
  async function compatible(){
    if(compatibleJob)return compatibleJob;
    compatibleJob=(async()=>{
      converting=true;
      const progressive=!!manifest.init&&manifest.segments?.length>0,original=progressive||!!(manifest.fileParts?.length||manifest.file);
      const oldBuffer=buffer;
      if(!oldBuffer)mode=original?'1080p-compatible':'720p-compatible';
      const parts=progressive?[{src:manifest.init,bytes:manifest.initBytes},...manifest.segments]:original?manifest.fileParts:manifest.mobileParts;
      const expected=progressive?manifest.streamBytes||manifest.totalBytes:original?manifest.fileBytes:manifest.mobileBytes;
      if(!oldBuffer){bytes=0;received.clear();partial.clear();}totalBytes=expected||totalBytes;
      // The same original fragments are assembled only when MSE is unavailable
      // or actually exhausted. Already playing frames remain visible while the
      // original-quality Blob is prepared. No low-resolution rendition exists.
      const data=await fileBlob(parts,original?manifest.file:manifest.mobileFallback||manifest.fallback,expected);
      filePartCache.clear();
      if(aborted)throw abort.signal.reason;
      const previous=objectURL,wasPlaying=!video.paused,at=video.currentTime-mediaTimeOffset,muted=video.muted,volume=video.volume;
      const nextOffset=progressive?-(manifest.timestampOffset||0):0;
      video.pause();objectURL=URL.createObjectURL(data);video.src=objectURL;video.load();buffer=null;source=null;
      await waitFor(()=>{if(video.error)throw Error('浏览器无法解码影片');return video.readyState>=1;},{label:'影片首帧',signal:abort.signal});
      mediaTimeOffset=nextOffset;video.currentTime=Math.max(0,at+mediaTimeOffset);
      await waitFor(()=>{if(video.error)throw Error('浏览器无法解码影片');return !video.seeking&&video.readyState>=2;},{label:'影片首帧',signal:abort.signal});
      video.muted=muted;video.volume=volume;mode=original?'1080p-compatible':'720p-compatible';complete=true;converting=false;error=null;revision++;
      if(previous)URL.revokeObjectURL(previous);
      if(wasPlaying)await video.play();
      onManifest({...manifest,label:original?manifest.label:video.videoHeight+'p / 30 fps · 兼容播放'});record('complete',{originalQuality:original,compatible:true,preservedTime:at});
    })().catch(error=>{converting=false;compatibleJob=null;throw error;});return compatibleJob;
  }
  async function open(){
    if(local)return;if(opening)return opening;
    opening=(async()=>{
      mode='preparing';error=null;record('prepare');manifest=JSON.parse(new TextDecoder().decode(await fetchBytes(manifestURL)));cache.configure(manifest.fileSha256||manifest.remuxVerification?.sourceSHA256);meter.configure(manifest.delivery);onManifest(manifest);
      const codec=/codecs="([^,"]+)/.exec(manifest.mime||'')?.[1]||'avc1.64002a';
      // Capability diagnostics run alongside real loading and never hold the
      // network or silently choose a lower-resolution film.
      try{if(globalThis.navigator?.mediaCapabilities?.decodingInfo)Promise.resolve(navigator.mediaCapabilities.decodingInfo({type:'media-source',video:{contentType:`video/mp4; codecs="${codec}"`,width:manifest.width,height:manifest.height,bitrate:Math.ceil((manifest.fileBytes||manifest.streamBytes||0)*8/(manifest.duration||1))||3000000,framerate:manifest.fps}})).then(capability=>{if(!aborted)record('decode-capability',{supported:capability.supported,smooth:capability.smooth,powerEfficient:capability.powerEfficient});}).catch(()=>{});}catch{}
      const progressive=!!manifest.init&&manifest.segments?.length>0;
      if(!progressive&&(manifest.file||manifest.fileParts?.length)){
        video.preload='auto';video.playsInline=true;
        // Device and network hints may inform diagnostics, never lower quality.
        mode='1080p-file';bytes=0;totalBytes=manifest.fileBytes;const data=await fileBlob(manifest.fileParts,manifest.file,manifest.fileBytes);objectURL=URL.createObjectURL(data);video.src=objectURL;video.load();
        await waitFor(()=>{if(video.error)throw Error('浏览器无法解码影片');return video.readyState>=2;},{label:'影片首帧',signal:abort.signal});complete=true;filePartCache.clear();record('complete');return;
      }
      bytes=0;received.clear();totalBytes=(manifest.initBytes||0)+manifest.segments.reduce((n,s)=>n+(s.bytes||0),0);video.preload='auto';video.playsInline=true;
      if(!globalThis.MediaSource?.isTypeSupported(manifest.mime)){await compatible();return;}
      mode='1080p-segments';source=new MediaSource();objectURL=URL.createObjectURL(source);video.src=objectURL;video.load();
      await waitFor(()=>source.readyState==='open',{timeout:15000,label:'影片解码器',signal:abort.signal});
      buffer=source.addSourceBuffer(manifest.mime);buffer.timestampOffset=manifest.timestampOffset||0;source.duration=manifest.duration;
      await append(await fetchBytes(manifest.init));await chunk(0,20);
      await waitFor(()=>{if(video.error)throw Error('浏览器无法解码影片');return video.readyState>=2;},{label:'影片首帧',signal:abort.signal});record('first-frame-ready');
    })().catch(async e=>{if(aborted)throw e;if(e.name==='QuotaExceededError'){await recoverQuota(e);return;}error=e.message;record('error');opening=null;if(objectURL)URL.revokeObjectURL(objectURL);source=buffer=null;loaded.clear();nextAppendIndex=0;bytes=0;received.clear();throw e;});return opening;
  }
  async function ensure(at=0,seconds=8){
    if(local){await waitFor(()=>video.readyState>=2,{label:'替换影片'});return;}
    await open();const target=Math.min(at,Math.max(0,manifest.duration-.1)),required=Math.min(seconds,manifest.duration-target);
    if(converting){await(recoveryJob||compatibleJob);return;}
    if(buffer){
      const wanted=segmentRange(manifest.segments,target,required+.04),jobs=wanted.map(i=>chunk(i,20)),last=wanted.at(-1)??-1;
      // Fetch a seek target first, but never insert it before an older missing
      // fragment. Filling its prefix preserves open-GOP/B-frame dependencies.
      for(let i=0;i<last;i++)if(!wanted.includes(i))jobs.push(chunk(i));
      try{await Promise.all(jobs);}catch(e){
        if(e.name!=='QuotaExceededError'||aborted)throw e;
        await recoverQuota(e);
      }
    }
    // A local Blob can be sought even before TimeRanges reports the full file.
    if(!buffer&&complete)return;
    await waitFor(()=>bufferedAhead(video,target)>=Math.max(.05,required-.10),{label:'影片缓冲',signal:abort.signal});record('buffer-ready',{at:target,seconds:required});
  }
  function prime(){
    if(local||complete)return Promise.resolve();if(pump)return pump;
    error=null;
    pump=(async()=>{
      await open();if(complete)return;
      // Keep both network slots occupied rather than waiting for pairs. Each
      // promise is observed immediately, and the raw-data lookahead is bounded.
      await Promise.all(manifest.segments.map((_,index)=>chunk(index)));
      if(buffer&&source.readyState==='open'){await serial;source.endOfStream();}complete=true;error=null;record('complete');
    })().catch(async e=>{
      if(e.name==='QuotaExceededError'&&!aborted){await recoverQuota(e);return;}
      if(!aborted){error=e.message;record('error');}pump=null;throw e;
    });pump.catch(()=>{});return pump;
  }
  async function preparePlayback(at=0){
    prime().catch(()=>{});await open();
    if(!originalQuality()||!buffer){await ensure(at,STARTUP_SECONDS);return;}
    // Recalculate as genuine transfers finish. A slow connection is allowed
    // more preparation time instead of forcing low quality or mid-film stalls.
    await waitFor(()=>{
      if(error&&!converting)throw Error(error);
      if(!buffer)return complete&&video.readyState>=2;
      const planned=plan(at),remaining=Math.max(.05,planned.seconds-at-.04);
      return !converting&&video.readyState>=2&&bufferedAhead(video,at)>=remaining;
    },{timeout:600000,label:'影片连续播放缓冲',signal:abort.signal});
    record('sustainable-buffer-ready',{at,seconds:plan(at).seconds,rate:plan(at).rate});
  }
  async function preflightDecode(){
    await preparePlayback();const key=mode+':'+revision;if(decodeKey===key&&decodeProbe)return decodeProbe;if(decodeJob)return decodeJob;
    // A late background caller must never rewind the shared visible film.
    if(!video.paused)return{mode,skipped:true,reason:'playback-active'};
    decodeJob=(async()=>{
      preflighting=true;record('decode-warm-start');const muted=video.muted,volume=video.volume;video.muted=true;video.volume=0;
      const quality=()=>{const q=video.getVideoPlaybackQuality?.();return{total:q?.totalVideoFrames||0,dropped:q?.droppedVideoFrames||0};};
      try{
        video.pause();video.currentTime=0;await waitFor(()=>!video.seeking&&video.readyState>=2,{label:'影片起始帧',timeout:20000});
        const before=quality(),started=performance.now();let samples=0;const probe=globalThis.document?.createElement('canvas');if(probe){probe.width=16;probe.height=9;}const context=probe?.getContext('2d');let sampleTimer;const draw=()=>{if(!preflighting||video.paused)return;if(video.readyState>=2&&context){context.drawImage(video,0,0,16,9);samples++;}sampleTimer=requestAnimationFrame(draw);};await video.play();if(context)draw();
        await waitFor(()=>video.readyState>=2&&video.currentTime>=Math.min(.12,video.duration-.1),{label:'影片解码预热',timeout:10000,signal:abort.signal});video.pause();if(sampleTimer)cancelAnimationFrame(sampleTimer);
        const after=quality();decodeProbe={mode,decodedSamples:samples,presentationHidden:true,frames:after.total-before.total,dropped:after.dropped-before.dropped,seconds:video.currentTime,ms:performance.now()-started};
        // Hidden/occluded video frames are deliberately not presented. Their
        // dropped-frame counter is not evidence of decoder performance.
        decodeKey=mode+':'+revision;video.currentTime=0;await waitFor(()=>!video.seeking&&video.readyState>=2,{label:'影片起始帧',timeout:20000});record('decode-warm-ready',decodeProbe);return decodeProbe;
      }finally{video.pause();video.muted=muted;video.volume=volume;preflighting=false;}
    })();try{return await decodeJob;}finally{decodeJob=null;}
  }
  function canPlayAt(at=video.currentTime){
    if(!(local||complete||buffer))return false;
    const end=Number.isFinite(video.duration)?video.duration:Infinity;if(at>=end-.08)return true;
    return video.readyState>=3&&(!buffer||bufferedAhead(video,at)>=Math.min(.4,end-at-.05));
  }
  async function useLocal(file){
    const nextURL=URL.createObjectURL(file),probe=document.createElement('video');probe.muted=true;probe.preload='auto';probe.src=nextURL;probe.load();
    try{await waitFor(()=>{if(probe.error)throw Error('浏览器无法读取这份影片，请使用 H.264 / AAC MP4');return probe.readyState>=2;},{label:'替换影片'});}catch(e){URL.revokeObjectURL(nextURL);throw e;}finally{probe.removeAttribute('src');probe.load();}
    aborted=true;abort.abort();rejectChunks(abort.signal.reason);filePartCache.clear();await serial.catch(()=>{});video.pause();if(objectURL)URL.revokeObjectURL(objectURL);local=true;complete=true;mode='local-original';error=null;revision++;
    objectURL=nextURL;mediaTimeOffset=0;video.src=objectURL;video.load();await waitFor(()=>video.readyState>=2,{label:'本机影片'});record('local-ready',{name:file.name});return snapshot();
  }
  for(const name of ['waiting','stalled','playing'])video.addEventListener(name,()=>record(name,{time:video.currentTime}));
  return{open,prime,ensure,preparePlayback,preflightDecode,get preflighting(){return preflighting;},canPlayAt,useLocal,snapshot,get manifest(){return manifest;},get timeOffset(){return mediaTimeOffset;},dispose(){aborted=true;abort.abort();rejectChunks(abort.signal.reason);filePartCache.clear();video.pause();if(objectURL)URL.revokeObjectURL(objectURL);}};
}
