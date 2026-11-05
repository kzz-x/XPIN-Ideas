import {waitFor,yieldTask} from './preparation.mjs';

export function segmentRange(segments,start,seconds){const end=start+seconds;return segments.map((s,i)=>({s,i})).filter(({s})=>s.start<end&&s.start+s.duration>start-.025).map(({i})=>i);}
export function bufferedAhead(video,at=video.currentTime){for(let i=0;i<video.buffered.length;i++)if(video.buffered.start(i)<=at+.08&&video.buffered.end(i)>at)return video.buffered.end(i)-at;return 0;}
export function preferCompatible({connection=globalThis.navigator?.connection,memory=globalThis.navigator?.deviceMemory,cores=globalThis.navigator?.hardwareConcurrency,mobile=!!globalThis.matchMedia?.('(pointer:coarse)')?.matches&&(globalThis.innerWidth||Infinity)<1100}={}){
  return mobile||!!connection?.saveData||/^(slow-2g|2g|3g)$/.test(connection?.effectiveType)||memory>0&&memory<=4||cores>0&&cores<=4;
}

/** One decoder and original audio clock for film + stage. The short film is
 * fully downloaded before playback, so changing network speed cannot outrun it. */
export function createFilmMedia(video,{manifestURL,onChange=()=>{},onManifest=()=>{}}){
  let manifest,source,buffer,objectURL,opening,pump,local=false,aborted=false,complete=false,serial=Promise.resolve(),loaded=new Set(),pending=new Map(),bytes=0,mode='idle',error=null,revision=0,totalBytes=0,notifiedAt=0;
  const abort=new AbortController(),events=[],partial=new Map();
  let preflighting=false,decodeJob,decodeProbe=null,decodeKey='';
  const url=path=>new URL(path,manifestURL).href;
  const record=(event,detail={})=>{events.push({event,at:performance.now(),...detail});if(events.length>80)events.shift();onChange(snapshot());};
  function snapshot(){const downloading=bytes+[...partial.values()].reduce((a,b)=>a+b,0);return{mode,local,revision,complete,preflighting,decodeProbe,progress:complete?1:Math.min(.99,totalBytes?downloading/totalBytes:0),ready:video.readyState>=2,width:video.videoWidth,height:video.videoHeight,duration:video.duration||0,bytes:downloading,totalBytes,segmentsReady:loaded.size,segmentsTotal:manifest?.segments.length||0,bufferedAhead:bufferedAhead(video),error,events:[...events]};}
  // Timeout means no incoming bytes, not a total time limit on a slow link.
  async function fetchBytes(path){
    let failure;
    for(let retry=0;retry<3;retry++){
      const request=new AbortController();let timer;
      const cancel=()=>request.abort(abort.signal.reason),watch=()=>{clearTimeout(timer);timer=setTimeout(()=>request.abort(Error('影片下载暂时中断')),45000);};
      abort.signal.addEventListener('abort',cancel,{once:true});partial.set(path,0);
      try{
        watch();const response=await fetch(url(path),{signal:request.signal});if(!response.ok)throw Error('HTTP '+response.status);
        if(mode==='720p-compatible'&&path===(manifest.mobileFallback||manifest.fallback))totalBytes=Number(response.headers.get('Content-Length'))||totalBytes;
        let data;
        if(response.body?.getReader){
          const reader=response.body.getReader(),parts=[];let count=0;
          for(;;){const {done,value}=await reader.read();if(done)break;parts.push(value);count+=value.byteLength;partial.set(path,count);watch();if(performance.now()-notifiedAt>200){notifiedAt=performance.now();onChange(snapshot());}}
          const joined=new Uint8Array(count);let at=0;for(const part of parts){joined.set(part,at);at+=part.byteLength;}data=joined.buffer;
        }else data=await response.arrayBuffer();
        bytes+=data.byteLength;partial.delete(path);return data;
      }catch(e){failure=e;partial.delete(path);if(aborted||retry===2)throw e;await new Promise(r=>setTimeout(r,350*(retry+1)));}
      finally{clearTimeout(timer);abort.signal.removeEventListener('abort',cancel);}
    }
    throw failure;
  }
  function append(data){const task=serial.then(()=>new Promise((resolve,reject)=>{if(aborted)return reject(new DOMException('Cancelled','AbortError'));const done=()=>{clear();resolve();},fail=()=>{clear();reject(Error('影片分段解码失败'));},clear=()=>{buffer.removeEventListener('updateend',done);buffer.removeEventListener('error',fail);};buffer.addEventListener('updateend',done,{once:true});buffer.addEventListener('error',fail,{once:true});try{buffer.appendBuffer(data);}catch(e){clear();reject(e);}}));serial=task.catch(()=>{});return task;}
  async function chunk(index){if(loaded.has(index))return;if(pending.has(index))return pending.get(index);const task=(async()=>{const data=await fetchBytes(manifest.segments[index].src);await append(data);loaded.add(index);record('segment-ready',{index});})();pending.set(index,task);try{await task;}finally{pending.delete(index);}}
  async function compatible(){
    mode='720p-compatible';bytes=0;totalBytes=manifest.mobileBytes||0;partial.clear();
    // Full local data also works where MediaSource/preload is unavailable.
    const data=await fetchBytes(manifest.mobileFallback||manifest.fallback),previous=objectURL;
    objectURL=URL.createObjectURL(new Blob([data],{type:'video/mp4'}));video.src=objectURL;video.load();if(previous)URL.revokeObjectURL(previous);
    buffer=null;source=null;complete=true;
    await waitFor(()=>{if(video.error)throw Error('浏览器无法解码影片');return video.readyState>=2;},{label:'影片首帧',signal:abort.signal});
    onManifest({...manifest,label:video.videoHeight+'p / 30 fps · 兼容播放'});record('complete');
  }
  async function open(){
    if(local)return;if(opening)return opening;
    opening=(async()=>{
      mode='preparing';error=null;record('prepare');manifest=JSON.parse(new TextDecoder().decode(await fetchBytes(manifestURL)));onManifest(manifest);
      let capability=null;try{if(globalThis.navigator?.mediaCapabilities?.decodingInfo)capability=await Promise.race([navigator.mediaCapabilities.decodingInfo({type:'media-source',video:{contentType:'video/mp4; codecs="avc1.64002a"',width:manifest.width,height:manifest.height,bitrate:12000000,framerate:manifest.fps}}),new Promise(resolve=>setTimeout(()=>resolve(null),1200))]);}catch{}
      if(capability)record('decode-capability',{supported:capability.supported,smooth:capability.smooth,powerEfficient:capability.powerEfficient});
      bytes=0;totalBytes=manifest.segments.reduce((n,s)=>n+(s.bytes||0),0);video.preload='auto';video.playsInline=true;
      if(preferCompatible()||capability?.supported===false||capability?.smooth===false||!globalThis.MediaSource?.isTypeSupported(manifest.mime)){await compatible();return;}
      mode='1080p-segments';source=new MediaSource();objectURL=URL.createObjectURL(source);video.src=objectURL;video.load();
      await waitFor(()=>source.readyState==='open',{timeout:15000,label:'影片解码器',signal:abort.signal});
      buffer=source.addSourceBuffer(manifest.mime);buffer.timestampOffset=manifest.timestampOffset||0;source.duration=manifest.duration;
      await append(await fetchBytes(manifest.init));await chunk(0);
      await waitFor(()=>{if(video.error)throw Error('浏览器无法解码影片');return video.readyState>=2;},{label:'影片首帧',signal:abort.signal});record('first-frame-ready');
    })().catch(e=>{if(aborted)throw e;error=e.message;record('error');opening=null;if(objectURL)URL.revokeObjectURL(objectURL);source=buffer=null;loaded.clear();bytes=0;throw e;});return opening;
  }
  async function ensure(at=0,seconds=8){
    if(local){await waitFor(()=>video.readyState>=2,{label:'替换影片'});return;}
    await open();const target=Math.min(at,Math.max(0,manifest.duration-.1)),required=Math.min(seconds,manifest.duration-target);
    if(buffer){for(const i of segmentRange(manifest.segments,target,required+.04))await chunk(i);}
    // A local Blob can be sought even before TimeRanges reports the full file.
    if(!buffer&&complete)return;
    await waitFor(()=>bufferedAhead(video,target)>=Math.max(.05,required-.10),{label:'影片缓冲',signal:abort.signal});record('buffer-ready',{at:target,seconds:required});
  }
  function prime(){
    if(local||complete)return Promise.resolve();if(pump)return pump;
    pump=(async()=>{
      await open();if(complete)return;
      // Bound concurrency to leave room for character, card and sound loading.
      for(let i=0;i<manifest.segments.length;i+=2){await Promise.all([i,i+1].filter(i=>i<manifest.segments.length).map(chunk));await yieldTask();}
      if(buffer&&source.readyState==='open'){await serial;source.endOfStream();}complete=true;error=null;record('complete');
    })().catch(async e=>{
      if(e.name==='QuotaExceededError'&&!aborted){await Promise.allSettled([...pending.values()]);await compatible();return;}
      if(!aborted){error=e.message;record('error');}pump=null;throw e;
    });pump.catch(()=>{});return pump;
  }
  async function preparePlayback(at=0){await prime();await ensure(at,Math.min(8,Math.max(.05,(manifest?.duration||video.duration)-at)));}
  async function preflightDecode(){
    await preparePlayback();const key=mode+':'+revision;if(decodeKey===key&&decodeProbe)return decodeProbe;if(decodeJob)return decodeJob;
    decodeJob=(async()=>{
      preflighting=true;record('decode-warm-start');const muted=video.muted,volume=video.volume;video.muted=true;video.volume=0;
      const quality=()=>{const q=video.getVideoPlaybackQuality?.();return{total:q?.totalVideoFrames||0,dropped:q?.droppedVideoFrames||0};};
      try{
        video.pause();video.currentTime=0;await waitFor(()=>!video.seeking&&video.readyState>=2,{label:'影片起始帧',timeout:20000});
        const before=quality(),started=performance.now();let samples=0;const probe=globalThis.document?.createElement('canvas');if(probe){probe.width=16;probe.height=9;}const context=probe?.getContext('2d');let sampleTimer;const draw=()=>{if(!preflighting||video.paused)return;if(video.readyState>=2&&context){context.drawImage(video,0,0,16,9);samples++;}sampleTimer=requestAnimationFrame(draw);};await video.play();if(context)draw();
        await waitFor(()=>video.currentTime>=Math.min(2.5,video.duration-.1),{label:'影片解码预热',timeout:30000});video.pause();if(sampleTimer)cancelAnimationFrame(sampleTimer);
        const after=quality();decodeProbe={mode,decodedSamples:samples,presentationHidden:true,frames:after.total-before.total,dropped:after.dropped-before.dropped,seconds:video.currentTime,ms:performance.now()-started};
        // Hidden/occluded video frames are deliberately not presented. Their
        // dropped-frame counter is not evidence of decoder performance.
        decodeKey=mode+':'+revision;video.currentTime=0;await waitFor(()=>!video.seeking&&video.readyState>=2,{label:'影片起始帧',timeout:20000});record('decode-warm-ready',decodeProbe);return decodeProbe;
      }finally{video.pause();video.muted=muted;video.volume=volume;preflighting=false;}
    })();try{return await decodeJob;}finally{decodeJob=null;}
  }
  function canPlayAt(at=video.currentTime){
    if(!(local||complete))return false;
    const end=Number.isFinite(video.duration)?video.duration:Infinity;if(at>=end-.08)return true;
    return video.readyState>=3&&(!buffer||bufferedAhead(video,at)>=Math.min(.4,end-at-.05));
  }
  async function useLocal(file){
    const nextURL=URL.createObjectURL(file),probe=document.createElement('video');probe.muted=true;probe.preload='auto';probe.src=nextURL;probe.load();
    try{await waitFor(()=>{if(probe.error)throw Error('浏览器无法读取这份影片，请使用 H.264 / AAC MP4');return probe.readyState>=2;},{label:'替换影片'});}catch(e){URL.revokeObjectURL(nextURL);throw e;}finally{probe.removeAttribute('src');probe.load();}
    aborted=true;abort.abort();await serial.catch(()=>{});video.pause();if(objectURL)URL.revokeObjectURL(objectURL);local=true;complete=true;mode='local-original';error=null;revision++;
    objectURL=nextURL;video.src=objectURL;video.load();await waitFor(()=>video.readyState>=2,{label:'本机影片'});record('local-ready',{name:file.name});return snapshot();
  }
  for(const name of ['waiting','stalled','playing'])video.addEventListener(name,()=>record(name,{time:video.currentTime}));
  return{open,prime,ensure,preparePlayback,preflightDecode,get preflighting(){return preflighting;},canPlayAt,useLocal,snapshot,get manifest(){return manifest;},get timeOffset(){return 0;},dispose(){aborted=true;abort.abort();video.pause();if(objectURL)URL.revokeObjectURL(objectURL);}};
}
