const clamp=x=>Math.max(0,Math.min(1,Number(x)||0));
// Both gestures use the selected B recording. A narrowing gap, shorter grains
// and rising playback rate make acceleration audible without raising the mix.
export function glassProfile(progress,kind='hold',settled=0){
 const p=clamp(progress),hold=kind==='hold',curve=p**1.45;
 return{progress:p,interval:(hold?.135:.125)*(1-curve)+(hold?.019:.021)*curve,
  rate:(hold?.72:.76)+p*(hold?.78:.64),duration:(hold?.105:.14)*(1-p)+.055*p,
  gain:((hold?.018:.039)+(hold?.045:.026)*p*p)*(1-.88*clamp((settled-.65)/.35)),
  width:.55*(1-.78*p),air:(hold?.001:.003)+(hold?.012:.004)*p*p};
}

export function createGlassOpening(context,output){
 let bank,air,grains,ready=false,seed=181105,loadJob;const voices=new Set(),stats={hold:[],particles:[]};
 const level=.8; // About 2 dB below B's initial runtime calibration; master stays unchanged.
 const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 async function load(){
  if(!loadJob)loadJob=(async()=>{
   const read=async name=>{const r=await fetch(new URL('../assets/media/sfx/'+name,import.meta.url));if(!r.ok)throw Error('开场声音暂未载入');return r;};
   const [a,b,c]=await Promise.all([read('glass-b-bank.wav').then(r=>r.arrayBuffer()),read('glass-b-air.wav').then(r=>r.arrayBuffer()),read('glass-b.json').then(r=>r.json())]);
   [bank,air]=await Promise.all([context.decodeAudioData(a),context.decodeAudioData(b)]);grains=c.grains;ready=true;
  })().catch(error=>{loadJob=null;throw error;});return loadJob;
 }
 function grain(bus,nodes,at,profile,intensity=1){
  const g=grains[Math.floor(random()*grains.length)],source=context.createBufferSource(),gain=context.createGain(),pan=context.createStereoPanner();
  const rate=profile.rate*(.93+random()*.14),duration=Math.min(g.duration/rate,profile.duration),level=profile.gain*intensity*(.75+random()*.25);
  source.buffer=bank;source.playbackRate.value=rate;pan.pan.value=(random()*2-1)*profile.width;
  gain.gain.setValueAtTime(0,at);gain.gain.linearRampToValueAtTime(level,at+.006);gain.gain.setValueAtTime(level,at+duration*.45);gain.gain.linearRampToValueAtTime(0,at+duration);
  source.connect(gain).connect(pan).connect(bus);nodes.add(source);
  source.onended=()=>{nodes.delete(source);source.disconnect();gain.disconnect();pan.disconnect();};source.start(at,g.offset,duration*rate);return source;
 }
 function start(kind){
  if(!ready)return null;
  const bus=context.createGain(),bed=context.createBufferSource(),bedGain=context.createGain(),nodes=new Set();let next=context.currentTime+.006,stopped=false,lastBucket=-1;
  bus.gain.setValueAtTime(0,context.currentTime);bus.gain.linearRampToValueAtTime(level,context.currentTime+.02);bus.connect(output);
  bed.buffer=air;bed.loop=true;bed.playbackRate.value=.65;bedGain.gain.value=0;bed.connect(bedGain).connect(bus);bed.start();nodes.add(bed);
  const voice={update(progress,{settled=0,motion=1}={}){
   if(stopped||context.state!=='running')return;const p=glassProfile(progress,kind,settled),now=context.currentTime;
   bedGain.gain.setTargetAtTime(p.air*(.25+.75*clamp(motion))*(1-clamp(settled)),now,.04);bed.playbackRate.setTargetAtTime(.65+p.progress*.5,now,.035);
   if(next<now-.025)next=now+.004; // Never catch up missed frames with a burst.
   const bucket=Math.min(20,Math.floor(p.progress*20));if(bucket!==lastBucket){lastBucket=bucket;stats[kind].push({progress:p.progress,interval:p.interval,rate:p.rate,at:now});if(stats[kind].length>80)stats[kind].shift();}
   if(settled>.985)return;
   let count=0;while(next<now+.035&&count++<4){grain(bus,nodes,next,p);next+=p.interval*(.9+random()*.2);}
  },stop(){
   if(stopped)return;stopped=true;const now=context.currentTime;bus.gain.cancelAndHoldAtTime(now);bus.gain.linearRampToValueAtTime(0,now+.035);
   for(const n of nodes)try{n.stop(now+.04);}catch{}bed.onended=()=>{bed.disconnect();bedGain.disconnect();bus.disconnect();};voices.delete(voice);
  }};voices.add(voice);return voice;
 }
 function accent(type,intensity=1){
  if(!ready)return false;const bus=context.createGain(),nodes=new Set(),now=context.currentTime+.004;
  bus.gain.value=level;bus.connect(output);const p={...glassProfile(1,'particles'),gain:type==='assembly'?.047:.035,width:.12,duration:.13,rate:type==='assembly'?.78:1.35};
  for(let i=0;i<3;i++)grain(bus,nodes,now+i*.027,p,intensity*(1-i*.23));
  const last=[...nodes].at(-1),ended=last.onended;last.onended=()=>{ended();bus.disconnect();};return true;
 }
 return{load,start,accent,get ready(){return ready;},stop(){for(const v of [...voices])v.stop();},snapshot:()=>({style:'B / fine glass grains',ready,voices:voices.size,hold:[...stats.hold],particles:[...stats.particles]})};
}
