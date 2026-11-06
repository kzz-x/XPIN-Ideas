const clamp=x=>Math.max(0,Math.min(1,Number(x)||0));
const smooth=x=>{x=clamp(x);return x*x*(3-2*x);};
const OUTPUT_GAIN=.7;
// The same release/gather/lock clocks as the visual solver; finishing uses the
// actual UI refinement, so a slow frame or a resumed tab cannot outrun the image.
export function sandProfile(state={}){
 const time=Math.max(0,Number(state.time)||0),settled=clamp((state.settled||0)/Math.max(1,state.count||0));
 const release=smooth((time-.10)/1.05),gather=smooth((time-2.1)/2.5),lock=smooth((time-4.3)/1.4);
 const motion=clamp((state.maxSpeed||0)/8),refinement=clamp(state.refinement),complete=!!state.ready||refinement>=1;
 const fade=complete?0:1-smooth(refinement),active=(state.count||0)>0?release*fade:0;
 return{time,settled,refinement,complete,gather,lock,motion,
  stage:complete?'complete':refinement>0?'refine':settled>0?'contact':gather>.12?'gather':time>1.3?'travel':'release',
  body:active*(.030+.025*motion)*(1-.47*lock),
  travel:active*(.010+.025*motion)*(1-.82*lock),
  fine:active*(.007+.021*gather)*(1-.72*settled),
  fineInterval:.115-.063*gather,width:.65*(1-.85*lock),rate:.78+.32*motion};
}

export function createSandOpening(context,output){
 let body,fine,job,ready=false,lastTrace=null,seed=201105;const voices=new Set();
 const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 async function load(){
  if(!job)job=Promise.all(['sand-body.wav','sand-fine.wav'].map(async name=>{
   const r=await fetch(new URL('../assets/media/sfx/'+name,import.meta.url));if(!r.ok)throw Error('粒子声音暂未载入');return context.decodeAudioData(await r.arrayBuffer());
  })).then(buffers=>{[body,fine]=buffers;ready=true;}).catch(error=>{job=null;throw error;});return job;
 }
 function start(state){
  if(!ready||sandProfile(state).complete)return null;
  const bus=context.createGain(),soften=context.createWaveShaper(),outputGain=context.createGain(),nodes=new Set(),filters=[];
  // A few natural slate clicks are much louder than the sand bed. Round only
  // this new texture before the approved master; keep the low flow audible.
  const curve=new Float32Array(32769);for(let i=0;i<curve.length;i++){const x=i/(curve.length-1)*2-1;curve[i]=.038*Math.tanh(x*1.35/.038);}
  soften.curve=curve;soften.oversample='4x';bus.gain.value=1;
  // Apply the requested 30% reduction after nonlinear shaping so every sand
  // sample is exactly 70% of its previous output, without changing its motion.
  outputGain.gain.value=OUTPUT_GAIN;bus.connect(soften).connect(outputGain).connect(output);
  function filter(type,hz){const f=context.createBiquadFilter();f.type=type;f.frequency.value=hz;f.Q.value=.65;f.connect(bus);filters.push(f);return f;}
  const low=filter('lowpass',1900),move=filter('bandpass',2100),high=filter('highpass',1800);
  const trace={style:'1 / layered dry sand',startVisual:state.time,startAudio:context.currentTime,updates:[],contacts:0,stop:null};lastTrace=trace;
  let stopped=false,disconnected=false,nextBody=0,nextMove=0,nextFine=0,lastBucket=Math.floor((state.settled||0)/Math.max(1,state.count)*8),lastTime=state.time,lastAdvance=context.currentTime,lastLog=-1;
  function cleanup(){if(stopped&&!nodes.size&&!disconnected){disconnected=true;for(const f of filters)f.disconnect();bus.disconnect();soften.disconnect();outputGain.disconnect();}}
  function grain(buffer,dest,at,duration,gain,rate,pan,visualTime){
   const source=context.createBufferSource(),envelope=context.createGain(),panner=context.createStereoPanner();
   source.buffer=buffer;source.playbackRate.value=rate;panner.pan.value=Math.max(-.7,Math.min(.7,pan));
   const offset=(visualTime*.67+random()*.28)%(buffer.duration-duration*rate-.01);
   envelope.gain.setValueAtTime(0,at);envelope.gain.linearRampToValueAtTime(gain,at+duration*.26);envelope.gain.setValueAtTime(gain,at+duration*.50);envelope.gain.linearRampToValueAtTime(0,at+duration);
   source.connect(envelope).connect(panner).connect(dest);nodes.add(source);
   source.onended=()=>{nodes.delete(source);source.disconnect();envelope.disconnect();panner.disconnect();cleanup();};source.start(at,offset,duration*rate);
  }
  function schedule(next,interval,now,callback){
   if(next<now-.025)next=now+.004;
   let n=0;while(next<now+.03&&n++<3){callback(next);next+=interval;}return next;
  }
  const voice={update(state){
   if(stopped||context.state!=='running')return;const p=sandProfile(state),now=context.currentTime;
   if(p.time>lastTime+.0001){lastAdvance=now;lastTime=p.time;}
   if(p.complete){voice.stop('visual-complete',p);return;}
   const live=now-lastAdvance<.12;bus.gain.setTargetAtTime(live?1:0,now,.018);if(!live)return;
   move.frequency.setTargetAtTime(1100+2600*p.motion,now,.04);
   if(p.body>.0001)nextBody=schedule(nextBody,.075,now,at=>grain(body,low,at,.27,p.body,p.rate,(random()*2-1)*p.width*.45,p.time));
   if(p.travel>.0001)nextMove=schedule(nextMove,.115,now,at=>grain(body,move,at,.19,p.travel,.96+.22*p.motion,Math.sin(p.time*3.4)*p.width,p.time+1.17));
   if(p.fine>.0001)nextFine=schedule(nextFine,p.fineInterval,now,at=>grain(fine,high,at,.070,p.fine*(.75+random()*.25),.9+random()*.25,(random()*2-1)*p.width,p.time));
   const bucket=Math.floor(p.settled*8);if(bucket>lastBucket){lastBucket=bucket;trace.contacts++;grain(fine,low,now+.004,.13,.030*(1-.55*p.refinement),.73,0,p.time);}
   const log=Math.floor(p.time*5);if(log!==lastLog){lastLog=log;trace.updates.push({...p,audioTime:now});if(trace.updates.length>60)trace.updates.shift();}
  },stop(reason='phase-change',p){
   if(stopped)return;stopped=true;const now=context.currentTime;trace.stop={reason,visualTime:p?.time??lastTime,audioTime:now,refinement:p?.refinement};
   bus.gain.cancelAndHoldAtTime(now);bus.gain.linearRampToValueAtTime(0,now+.035);voices.delete(voice);
   // Grains are short and independently owned. A phase change, mute or cancel
   // fades every scheduled node, including lookahead, within 40 milliseconds.
   for(const source of nodes)try{source.stop(now+.04);}catch{}
   cleanup();
  }};voices.add(voice);return voice;
 }
 return{load,start,get ready(){return ready;},snapshot:()=>({style:'1 / layered dry sand',ready,outputGain:OUTPUT_GAIN,voices:voices.size,lastTrace})};
}
