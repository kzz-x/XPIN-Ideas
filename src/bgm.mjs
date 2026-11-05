// Lossless, sample-clock loop. No ended-event or animation-frame rescheduling.
export const BGM_STORAGE='linggan-bgm-r13';
export function joinIntroLoop(context,intro,loop){
  const buffer=context.createBuffer(intro.numberOfChannels,intro.length+loop.length,intro.sampleRate);
  for(let c=0;c<buffer.numberOfChannels;c++){buffer.getChannelData(c).set(intro.getChannelData(c));buffer.getChannelData(c).set(loop.getChannelData(c),intro.length);}
  return buffer;
}
export function nextMusicalExit(elapsed,intro,loop,gates,guard=.08){
  const safe=elapsed+guard;
  if(safe<intro)return Math.min(intro,Math.ceil(safe/(loop/8))*(loop/8));
  const cycle=Math.floor((safe-intro)/loop),phase=safe-intro-cycle*loop;
  const gate=gates.find(t=>t>=phase);
  return intro+cycle*loop+(gate??loop+gates[0]);
}
export function createBgm({onChange=()=>{},onError=()=>{}}={}){
  let settings={enabled:true,volume:.15};try{settings={...settings,...JSON.parse(localStorage.getItem(BGM_STORAGE)||'{}')};}catch{}
  settings.volume=Math.max(0,Math.min(1,Number(settings.volume)||0));settings.enabled=settings.enabled!==false;
  let context,master,buffers,loading,unlocked=false,active=false,complete=false,masterMuted=false;
  let voice=null,outro=null,epoch=0,offset=0,exitAt=null,mode='intro-loop',finished=false,error=null,starts=0;
  const events=[];
  function emit(){onChange(snapshot());}
  function save(){try{localStorage.setItem(BGM_STORAGE,JSON.stringify(settings));}catch{}emit();}
  function volume(){if(master){const now=context.currentTime;master.gain.cancelAndHoldAtTime(now);master.gain.linearRampToValueAtTime(settings.enabled&&!masterMuted?settings.volume:0,now+.08);}emit();}
  async function unlock(){
    unlocked=true;
    if(!context){context=new (window.AudioContext||window.webkitAudioContext)({sampleRate:48000});master=context.createGain();master.gain.value=settings.enabled&&!masterMuted?settings.volume:0;master.connect(context.destination);}
    await context.resume();
    if(active)await prepare();
  }
  async function prepare(){
    if(!context)return;
    if(!loading)loading=Promise.all([Promise.all(['intro','loop','outro'].map(async name=>{const r=await fetch(`./assets/media/bgm/tank-b-${name}.flac`,{priority:'low'});if(!r.ok)throw Error(`BGM ${name}: ${r.status}`);return r.arrayBuffer();})),fetch('./assets/media/bgm/tank-b-loop.json').then(r=>r.json())]).then(async([data,meta])=>{
      const [intro,loop,outro]=await Promise.all(data.map(x=>context.decodeAudioData(x.slice(0))));
      buffers={intro,loop,outro,joined:joinIntroLoop(context,intro,loop),gates:meta.estimated_phrase_exit_gates.map(g=>g.seconds),meta};
      error=null;emit();
    }).catch(e=>{error=e.message;onError('背景音乐载入失败，请刷新后重试。');});
    await loading;if(active&&!voice&&!outro&&!finished&&buffers)start();emit();
  }
  function node(buffer,at,from=0){const source=context.createBufferSource(),gain=context.createGain();source.buffer=buffer;source.connect(gain);gain.connect(master);const record={source,gain,at,from};return record;}
  function elapsed(){return voice?offset+Math.max(0,context.currentTime-epoch):offset;}
  function phaseOffset(t){const a=buffers.intro.duration,b=buffers.loop.duration;return t<a?t:a+(t-a)%b;}
  function stopRecord(record,fade=.15){if(!record)return;const now=context.currentTime;record.gain.gain.cancelAndHoldAtTime(now);record.gain.gain.linearRampToValueAtTime(0,now+fade);try{record.source.stop(now+fade+.01);}catch{}record.source.onended=()=>{record.source.disconnect();record.gain.disconnect();};}
  function beginOutro(at,from=0,crossfade=false){
    const record=node(buffers.outro,at,from);outro=record;
    if(crossfade){const curve=Float32Array.from({length:65},(_,i)=>Math.sin(i/64*Math.PI/2));record.gain.gain.setValueAtTime(0,at);record.gain.gain.setValueCurveAtTime(curve,at,.12);}
    record.source.start(at,from);
    record.source.onended=()=>{record.source.disconnect();record.gain.disconnect();if(outro!==record)return;outro=null;voice=null;finished=true;mode='done';offset=0;exitAt=null;events.push({event:'outro-ended',at:context.currentTime});emit();};
  }
  function queueEnding(){
    if(!active||!complete||!voice||exitAt!==null||!buffers)return;
    const now=context.currentTime,e=elapsed(),exit=nextMusicalExit(e,buffers.intro.duration,buffers.loop.duration,buffers.gates);
    exitAt=epoch+exit-offset;
    const curve=Float32Array.from({length:65},(_,i)=>Math.cos(i/64*Math.PI/2));
    voice.gain.gain.setValueAtTime(1,exitAt);voice.gain.gain.setValueCurveAtTime(curve,exitAt,.12);voice.source.stop(exitAt+.12);
    const endingVoice=voice;voice.source.onended=()=>{endingVoice.source.disconnect();endingVoice.gain.disconnect();if(voice===endingVoice){voice=null;mode='outro';emit();}};
    beginOutro(exitAt,0,true);events.push({event:'completion-queued',at:now,exitAt,wait:exitAt-now});emit();
  }
  function start(){
    if(!active||!unlocked||!buffers||voice||outro||finished)return;
    const at=context.currentTime+.025;starts++;
    if(mode==='outro'){if(offset>=buffers.outro.duration){finished=true;mode='done';emit();return;}exitAt=at-offset;beginOutro(at,offset);return;}
    const record=node(buffers.joined,at);voice=record;record.source.loop=true;record.source.loopStart=buffers.intro.duration;record.source.loopEnd=buffers.joined.duration;
    record.gain.gain.setValueAtTime(0,at);record.gain.gain.linearRampToValueAtTime(1,at+.28);epoch=at;
    record.source.start(at,phaseOffset(offset));events.push({event:'loop-start',at,offset});queueEnding();emit();
  }
  function leave(){
    if(!active)return;active=false;
    if(exitAt!==null&&context?.currentTime>=exitAt){mode='outro';offset=Math.max(0,context.currentTime-exitAt);}
    else if(voice)offset=elapsed();
    stopRecord(voice);stopRecord(outro);voice=outro=null;exitAt=null;emit();
  }
  function setComplete(value){
    value=!!value;if(value===complete)return;complete=value;
    if(value)queueEnding();
    else if(exitAt!==null||finished||mode==='outro'){
      stopRecord(voice);stopRecord(outro);voice=outro=null;exitAt=null;finished=false;mode='intro-loop';offset=buffers?.intro.duration||0;start();
    }emit();
  }
  function snapshot(){const t=context?.currentTime||0;return{ready:!!buffers,contextState:context?.state||'locked',sampleRate:context?.sampleRate||0,active,enabled:settings.enabled,volume:settings.volume,masterMuted,outputGain:master?.gain.value||0,complete,finished,mode:finished?'done':exitAt!==null&&t>=exitAt?'outro':mode,elapsed:elapsed(),exitAt,wait:exitAt===null?null:Math.max(0,exitAt-t),starts,error,loopStart:voice?.source.loopStart||0,loopEnd:voice?.source.loopEnd||0,loopFrames:buffers?.loop.length||0,events:events.slice(-20)};}
  return {unlock,prepare,leave,setComplete,snapshot,get buffers(){return buffers;},get context(){return context;},
    enter(){active=true;if(unlocked)unlock();emit();},
    setEnabled(value){settings.enabled=!!value;volume();save();if(value)unlock();},
    setVolume(value){settings.volume=Math.max(0,Math.min(1,Number(value)||0));volume();save();},
    setMasterMuted(value){masterMuted=!!value;volume();}
  };
}
