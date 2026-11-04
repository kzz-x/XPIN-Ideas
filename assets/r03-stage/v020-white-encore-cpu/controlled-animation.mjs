/**
 * DOT v4 — breath-led absolute-time animation.
 * No oscillating idle path, no accumulated physics, no per-frame random calls.
 * Time stamps, event duration and manually supplied attack/release remain authoritative.
 */
export const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const number=(v,f)=>Number.isFinite(Number(v))?Number(v):f;
const smooth=x=>{x=clamp(x,0,1);return x*x*(3-2*x)};
const integer=(v,f=0)=>Math.trunc(clamp(number(v,f),-2147483648,2147483647));
const TIME_MIN=-37.8,TIME_MAX=14.183333;
export const DEFAULT_PHRASES=Object.freeze([
 Object.freeze({id:'phrase-a',start:.0929,end:3.065,inhaleStart:-.48,inhaleDuration:.47,inhaleStrength:.8,hold:.10,lean:.35,direction:.4,seed:17,auto:true}),
 Object.freeze({id:'phrase-b',start:3.779,end:6.64,inhaleStart:3.10,inhaleDuration:.56,inhaleStrength:1.15,hold:.119,lean:-.45,direction:-.5,seed:83,auto:true}),
 // This is deliberately a shallow, short breath. The tail is a manual-review candidate.
 Object.freeze({id:'phrase-c-tail-review',start:6.809,end:8.933,inhaleStart:6.65,inhaleDuration:.10,inhaleStrength:.3,hold:.059,lean:.2,direction:.1,seed:121,auto:true})
]);
export function normalizeEvents(events){return (Array.isArray(events)?events:[]).filter(e=>e&&typeof e==='object').map((e,i)=>{
 const result={id:String(e.id??`event-${i}`),start:clamp(number(e.start??e.t,0),TIME_MIN,TIME_MAX),duration:clamp(number(e.duration,.105),.02,2),strength:clamp(number(e.strength,.8),0,1.5),attack:clamp(number(e.attack,.012),.002,.5),release:clamp(number(e.release,.07),.005,1),horn:clamp(number(e.horn,.13),0,.4),locked:e.locked===true};
 if(e.direction!==undefined&&Number.isFinite(Number(e.direction)))result.direction=clamp(Number(e.direction),-1,1);
 if(e.variationSeed!==undefined&&Number.isFinite(Number(e.variationSeed)))result.variationSeed=integer(e.variationSeed);
 return result;
 }).sort((a,b)=>a.start-b.start)}
export function normalizePhrases(phrases){return (Array.isArray(phrases)?phrases:[]).filter(p=>p&&typeof p==='object').map((p,i)=>{
 const start=clamp(number(p.start,0),TIME_MIN,TIME_MAX-.02),end=clamp(number(p.end,start+1),start+.02,TIME_MAX),inhaleStart=clamp(number(p.inhaleStart,start-.45),TIME_MIN,start),space=Math.max(0,start-inhaleStart);
 return {id:String(p.id??`phrase-${i}`),start,end,inhaleStart,inhaleDuration:clamp(number(p.inhaleDuration,.35),.02,1.8),inhaleStrength:clamp(number(p.inhaleStrength,.8),0,1.5),hold:clamp(number(p.hold,Math.max(0,space-number(p.inhaleDuration,.35))),0,.8),lean:clamp(number(p.lean,0),-1,1),direction:clamp(number(p.direction,0),-1,1),seed:integer(p.seed,17+i*29),auto:p.auto===true};
 }).sort((a,b)=>a.start-b.start)}
function hash(value){let h=2166136261;for(let i=0;i<value.length;i++)h=Math.imul(h^value.charCodeAt(i),16777619);h^=h>>>16;h=Math.imul(h,0x7feb352d);h^=h>>>15;h=Math.imul(h,0x846ca68b);return(h^(h>>>16))>>>0}
const randomAt=(seed,salt)=>(hash(String(seed)+':'+salt)+.5)/4294967296;
function eventPhrase(e,phrases){for(const p of phrases)if(e.start>=p.start-.002&&e.start<=p.end)return p;return null}
function articulation(e,phrase,options){
 const varied=options.variationEnabled!==false&&!e.locked;
 const seed=hash(`${integer(options.seed,42)}|${phrase?.seed??0}|${e.id}|${e.variationSeed??0}`);
 const kind=varied?Math.floor(randomAt(seed,1)*3):1;
 const strengthScale=varied?.91+.18*randomAt(seed,2):1;
 const attackScale=varied?.88+.24*randomAt(seed,3):1;
 const releaseScale=varied?.90+.20*randomAt(seed,4):1;
 const direction=e.direction??clamp((phrase?.direction??0)+(varied?(randomAt(seed,5)-.5)*.38:0),-1,1);
 return {kind,strengthScale,attack:Math.min(e.attack*attackScale,e.duration*.45),release:e.release*releaseScale,direction,varied};
}
function noteWeight(d,e,a){
 if(d<0||d>=e.duration)return 0;
 const attack=a.attack,release=Math.min(a.release,e.duration-attack),holdEnd=e.duration-release;
 if(d<attack){const u=clamp(d/attack,0,1);return a.kind===0?1-(1-u)**3:a.kind===2?smooth(u)**.72:smooth(u)}
 if(d<holdEnd){const u=(d-attack)/Math.max(.001,holdEnd-attack);return a.kind===0?1-.16*u:a.kind===2?1-.055*u:1}
 const u=clamp((d-holdEnd)/Math.max(.001,release),0,1),tail=1-smooth(u);
 const sustainEnd=holdEnd>attack+.001?(a.kind===0?.84:a.kind===2?.945:1):1;
 return sustainEnd*(a.kind===0?tail*tail:a.kind===2?Math.sqrt(tail):tail);
}
/** Legacy-compatible raw manual envelope: no seeded articulation or breath layer. */
export function envelope(t,events,delay=0){let p=0,horn=0;for(const e of events){const a={kind:1,attack:Math.min(e.attack,e.duration*.45),release:e.release};const w=noteWeight(t-e.start-delay,e,a)*e.strength;p=Math.max(p,w);horn=Math.max(horn,w*e.horn)}return {p,horn}}
function eventMotion(t,events,phrases,options){let p=0,lag=0,horn=0,dirSum=0,dirWeight=0,rebound=0,after=0;
 for(const e of events){const d=t-e.start;if(d<0||d>e.duration+.34)continue;const a=articulation(e,eventPhrase(e,phrases),options),amp=e.strength*a.strengthScale,w=noteWeight(d,e,a)*amp,l=noteWeight(d-.027,e,a)*amp;
  p=Math.max(p,w);lag=Math.max(lag,l);horn=Math.max(horn,w*e.horn);
  // One damped follow-through lobe, not a spring or repeating oscillation.
  const r=d-e.duration;if(r>=0&&r<.22){const u=r/.22;rebound+=4*u*(1-u)*Math.exp(-u*3)*amp*(a.kind===2?1.18:a.kind===0?.84:1)}
  // A short impulse tail feeds centre-of-mass recoil while notes are tightly packed.
  let tail=0;if(d>=0&&d<.34){const q=d/.075;tail=q*Math.exp(1-q)*amp;after+=tail}
  const directionalWeight=w+.16*tail;dirSum+=directionalWeight*a.direction;dirWeight+=directionalWeight;
 }
 return {p:clamp(p,0,1.6),lag:clamp(lag,0,1.6),horn:clamp(horn,0,.64),direction:dirWeight>1e-12?dirSum/dirWeight:0,rebound:clamp(rebound,0,1.3),after:clamp(after,0,1.8)};
}
function phraseSchedule(p,previous){
 // Never insert a full breath inside an occupied preceding phrase. A short gap becomes a sip.
 const begin=Math.max(p.inhaleStart,previous?.end??-Infinity),available=Math.max(0,p.start-begin);
 const hold=Math.min(p.hold,available*.65),duration=Math.max(0,Math.min(p.inhaleDuration,available-hold));
 const end=Math.min(p.start-hold,begin+duration);
 return {begin,end,duration:Math.max(0,end-begin),hold,amplitude:p.inhaleStrength*Math.min(1,Math.sqrt(duration/.40))};
}
function airConsumed(t,p,events){const duration=Math.max(.02,p.end-p.start),progress=clamp((t-p.start)/duration,0,1);let total=0,used=0;
 for(const e of events){if(e.start<p.start-.002||e.start>=p.end)continue;const d=Math.min(e.duration,p.end-e.start),energy=d*e.strength;if(energy<=0)continue;total+=energy;used+=energy*smooth((t-e.start)/Math.max(.002,d))}
 return total>0?clamp(.82*used/total+.18*progress,0,1):smooth(progress);
}
function breathMotion(t,events,phrases){let selected=null,schedule=null,selectedIndex=-1;
 for(let i=0;i<phrases.length;i++){const p=phrases[i],q=phraseSchedule(p,phrases[i-1]);if(t>=q.begin&&t<=p.end+.48){selected=p;schedule=q;selectedIndex=i}}
 if(!selected)return {volume:0,inhale:0,exhale:0,phase:'idle',direction:0,lean:0,driftX:0,driftY:0,driftZ:0,yaw:0,tilt:0};
 const p=selected,q=schedule,amp=q.amplitude;let load=0,consumed=0,inhale=0,exhale=0,phase='idle',fade=1;
 if(t<p.start){load=q.duration>0?smooth((t-q.begin)/q.duration):0;inhale=load*amp;phase=t<q.end?'inhale':'hold';}
 else if(t<=p.end){consumed=airConsumed(t,p,events);load=Math.pow(1-consumed,.72);inhale=amp*(1-smooth((t-p.start)/.095));exhale=smooth((t-p.start)/.08);phase='exhale';}
 else{consumed=1;exhale=1;fade=1-smooth((t-p.end)/.48);phase=fade>0?'recover':'idle';}
 // Inhale increases the air reservoir. Successive notes spend it; gaps do not reset the body.
 const volume=amp*(load-.08*consumed)*fade,spent=consumed*amp*fade,loaded=load*amp*fade,lean=p.lean;
 const result={volume,inhale,exhale:exhale*fade,phase,direction:p.direction,lean,
  driftX:p.direction*(-.092*loaded+.035*spent),
  driftY:.104*loaded-.024*spent,
  driftZ:-.042*loaded+.015*spent,
  yaw:-.042*p.direction*loaded+.020*p.direction*spent,
  tilt:(.060*lean-.020)*loaded-.024*lean*spent};
 // Carry the preceding exhale's settling position into the next breath for 80 ms.
 // This removes a centre-of-mass jump at short phrase gaps without making a new oscillator.
 const previous=phrases[selectedIndex-1];
 if(previous&&t>=previous.end&&t<previous.end+.48&&t<q.begin+.08){const prevSchedule=phraseSchedule(previous,phrases[selectedIndex-2]),carryWeight=(1-smooth((t-q.begin)/.08))*(1-smooth((t-previous.end)/.48)),carry=carryWeight*prevSchedule.amplitude;result.exhale=Math.max(result.exhale,carryWeight);result.volume-=.08*carry;result.driftX+=.035*previous.direction*carry;result.driftY-=.024*carry;result.driftZ+=.015*carry;result.yaw+=.020*previous.direction*carry;result.tilt-=.024*previous.lean*carry;}
 return result;
}
/**
 * phrases=[] really means no authored breath phrases, never an invisible auto-regeneration.
 * Callers wanting the initial A/B/C draft explicitly pass normalizePhrases(DEFAULT_PHRASES).
 */
export function pose(t,events,intensity=.09,phrases=[],options={variationEnabled:true,seed:42}){
 t=number(t,0);events=Array.isArray(events)?events:[];phrases=Array.isArray(phrases)?phrases:[];options=options&&typeof options==='object'?options:{};
 const n=eventMotion(t,events,phrases,options),b=breathMotion(t,events,phrases),amount=clamp(number(intensity,.09),0,.16),p=n.p,back=n.rebound,dir=n.direction;
 const sx=clamp(1+amount*(.95*b.volume-.46*p+.10*back),.85,1.22),sy=clamp(1+amount*(1.10*b.volume-.38*p-.055*back),.85,1.24),sz=clamp(1+amount*(.70*b.volume+.06*p),.90,1.18);
 // The whole-body path is entirely breath and air-jet reaction, not clock-driven sine drift.
 return {sx,sy,sz,
  x:amount*(-.19*p-.05*n.after+.05*back),y:amount*(.07*p-.045*back),roll:amount*(-.18*p*(.8+.25*dir)+.055*back),
  hatY:.015*b.inhale+.013*(n.lag-p)+.007*back,hatRoll:.025*b.lean*b.inhale+.018*(n.lag-p)*(1+.3*dir),
  horn:1+n.horn,hornAmount:n.horn,flare:1+.035*p,effort:p,
  driftX:b.driftX-.028*n.after*(1+.16*dir),driftY:b.driftY-.009*n.after+.006*back,
  driftZ:b.driftZ+.006*n.after*dir,yaw:b.yaw-.010*p*dir,
  tilt:b.tilt-.013*n.after*(.8+.3*dir)+.004*back,
  inhale:b.inhale,exhale:b.exhale,breathPhase:b.phase,hornLift:.078*b.inhale+.025*b.lean*b.inhale-.018*p+.006*back,
  air:b.volume,articulationDirection:dir};
}

/** Editable breath volume and note squash; default gains reproduce original pose. */
export function controlledPose(t,events,intensity,phrases,options,controls={}){
 const result=pose(t,events,intensity,phrases,options),n=eventMotion(t,events,phrases,options),b=breathMotion(t,events,phrases),amount=clamp(number(intensity,.09),0,.16),inhale=clamp(number(controls.inhaleGain,1),0,2),exhale=clamp(number(controls.exhaleGain,1),0,2),volume=b.volume*(b.volume>=0?inhale:exhale),p=n.p*exhale,back=n.rebound*exhale;
 result.sx=clamp(1+amount*(.95*volume-.46*p+.10*back),.85,1.22);
 result.sy=clamp(1+amount*(1.10*volume-.38*p-.055*back),.85,1.24);
 result.sz=clamp(1+amount*(.70*volume+.06*p),.90,1.18);
 return result;
}
