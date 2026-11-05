import {waitFor,yieldTask} from './preparation.mjs';

export function segmentRange(segments,start,seconds){const end=start+seconds;return segments.map((s,i)=>({s,i})).filter(({s})=>s.start<end&&s.start+s.duration>start-.025).map(({i})=>i);}
export function bufferedAhead(video,at=video.currentTime){for(let i=0;i<video.buffered.length;i++)if(video.buffered.start(i)<=at+.08&&video.buffered.end(i)>at)return video.buffered.end(i)-at;return 0;}

/** One decoded video element owns both the film and the physical stage screen. */
export function createFilmMedia(video,{manifestURL,onChange=()=>{},onManifest=()=>{}}){
  let manifest,source,buffer,objectURL,opening,pump,local=false,aborted=false,serial=Promise.resolve(),loaded=new Set(),pending=new Map(),bytes=0,mode='idle',error=null,revision=0;
  const abort=new AbortController(),events=[];
  const record=(event,detail={})=>{events.push({event,at:performance.now(),...detail});if(events.length>80)events.shift();onChange(snapshot());};
  const url=path=>new URL(path,manifestURL).href;
  function snapshot(){return{mode,local,revision,ready:video.readyState>=2,width:video.videoWidth,height:video.videoHeight,duration:video.duration||0,bytes,segmentsReady:loaded.size,segmentsTotal:manifest?.segments.length||0,bufferedAhead:bufferedAhead(video),error,events:[...events]};}
  async function fetchBytes(path){let failure;for(let retry=0;retry<3;retry++){try{const response=await fetch(url(path),{signal:abort.signal});if(!response.ok)throw Error('HTTP '+response.status);const data=await response.arrayBuffer();bytes+=data.byteLength;return data;}catch(e){failure=e;if(aborted||retry===2)throw e;await new Promise(r=>setTimeout(r,250*(retry+1)));}}throw failure;}
  function append(data){const task=serial.then(()=>new Promise((resolve,reject)=>{if(aborted)return reject(new DOMException('Cancelled','AbortError'));const done=()=>{clear();resolve();},fail=()=>{clear();reject(Error('影片分段解码失败'));},clear=()=>{buffer.removeEventListener('updateend',done);buffer.removeEventListener('error',fail);};buffer.addEventListener('updateend',done,{once:true});buffer.addEventListener('error',fail,{once:true});try{buffer.appendBuffer(data);}catch(e){clear();reject(e);}}));serial=task.catch(()=>{});return task;}
  async function chunk(index){if(loaded.has(index))return;if(pending.has(index))return pending.get(index);const task=(async()=>{const data=await fetchBytes(manifest.segments[index].src);await append(data);loaded.add(index);record('segment-ready',{index});})();pending.set(index,task);try{await task;}finally{pending.delete(index);}}
  async function open(){
    if(local)return;if(opening)return opening;
    opening=(async()=>{
      mode='preparing';record('prepare');const response=await fetch(manifestURL,{signal:abort.signal});if(!response.ok)throw Error('影片清单暂未载入');manifest=await response.json();onManifest(manifest);
      video.preload='auto';video.playsInline=true;
      const limited=globalThis.navigator?.connection?.saveData;
      if(limited){mode='720p-compatible';video.src=url(manifest.fallback);video.load();}
      else if(globalThis.MediaSource?.isTypeSupported(manifest.mime)){
        mode='1080p-segments';source=new MediaSource();objectURL=URL.createObjectURL(source);
        const opened=new Promise(resolve=>source.addEventListener('sourceopen',resolve,{once:true}));video.src=objectURL;video.load();await opened;
        buffer=source.addSourceBuffer(manifest.mime);buffer.timestampOffset=manifest.timestampOffset||0;source.duration=manifest.duration;
        await append(await fetchBytes(manifest.init));await chunk(0);
      }else if(video.canPlayType('application/vnd.apple.mpegurl')){mode='1080p-native';video.src=url(manifest.playlist);video.load();}
      else{mode='720p-compatible';video.src=url(manifest.fallback);video.load();}
      await waitFor(()=>video.readyState>=2,{label:'影片首帧',signal:abort.signal});if(mode==='720p-compatible')onManifest({...manifest,label:video.videoHeight+'p · 兼容播放'});record('first-frame-ready');
    })().catch(e=>{error=e.message;record('error');throw e;});return opening;
  }
  async function ensure(at=0,seconds=8){
    if(local){await waitFor(()=>video.readyState>=2,{label:'替换影片'});return;}
    await open();const target=Math.min(at,Math.max(0,manifest.duration-.1)),required=Math.min(seconds,manifest.duration-target);
    if(buffer){for(const i of segmentRange(manifest.segments,target,required+.04))await chunk(i);}
    else if(target>0&&video.paused&&bufferedAhead(video,target)<required-.10){video.currentTime=target+(mode==='1080p-native'?-(manifest.timestampOffset||0):0);}
    await waitFor(()=>bufferedAhead(video,target)>=Math.max(.05,required-.10),{label:'影片缓冲',signal:abort.signal});record('buffer-ready',{at:target,seconds:required});
  }
  function prime(){if(local)return Promise.resolve();if(pump)return pump;pump=(async()=>{await ensure(0,8);for(let i=0;i<manifest.segments.length;i++){await chunkIfNeeded(i);await yieldTask();}if(buffer&&source.readyState==='open'){await serial;source.endOfStream();}record('complete');})().catch(e=>{if(!aborted){error=e.message;record('error');}throw e;});pump.catch(()=>{});return pump;}
  async function chunkIfNeeded(i){if(buffer)await chunk(i);}
  async function useLocal(file){
    const nextURL=URL.createObjectURL(file),probe=document.createElement('video');probe.muted=true;probe.preload='auto';probe.src=nextURL;probe.load();
    try{await waitFor(()=>{if(probe.error)throw Error('浏览器无法读取这份影片，请使用 H.264 / AAC MP4');return probe.readyState>=2;},{label:'替换影片'});}catch(e){URL.revokeObjectURL(nextURL);throw e;}finally{probe.removeAttribute('src');probe.load();}
    aborted=true;abort.abort();await serial.catch(()=>{});video.pause();if(objectURL)URL.revokeObjectURL(objectURL);local=true;mode='local-original';error=null;revision++;
    objectURL=nextURL;video.src=objectURL;video.load();await waitFor(()=>video.readyState>=2,{label:'本机影片'});record('local-ready',{name:file.name});return snapshot();
  }
  for(const name of ['waiting','stalled','playing'])video.addEventListener(name,()=>record(name,{time:video.currentTime}));
  return{open,prime,ensure,useLocal,snapshot,get manifest(){return manifest;},get timeOffset(){return mode==='1080p-native'?-(manifest?.timestampOffset||0):0;},dispose(){aborted=true;abort.abort();video.pause();if(objectURL)URL.revokeObjectURL(objectURL);}};
}
