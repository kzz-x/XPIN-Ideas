import {ACTIONS,sampleMotion} from '../assets/dot/index.mjs';

const durations=Object.fromEntries(ACTIONS.map(a=>[a.id,a.duration]));durations.response=2.15;
const ambient=['sway','look','curious','greet','inspect','happy','orbit','discover'];
const hover=['attention','curious','greet','shy'];
const clicks=['response','celebrate','discover','greet','happy','beckon','dodge','dash'];
export function createCompanionActions(rig){
  let current=null,now=0,nextAmbient=5,ambientIndex=0,hoverIndex=0,clickIndex=0,lastHover=-10;
  const events=[];
  function start(id,reason){current={id,reason,start:now,duration:durations[id]||3};events.push({...current});if(events.length>32)events.shift();return id;}
  function trigger(reason='click',id){
    if(reason==='hover'){if(now-lastHover<2.5||current?.reason==='click')return null;lastHover=now;}
    if(current&&reason==='ambient')return null;
    return start(id||(reason==='hover'?hover[hoverIndex++%hover.length]:clicks[clickIndex++%clicks.length]),reason);
  }
  function sample(time){
    now=time;
    if(current&&time-current.start>=current.duration){current=null;nextAmbient=time+3.4+(ambientIndex%3)*.7;}
    if(!current&&time>=nextAmbient)start(ambient[ambientIndex++%ambient.length],'ambient');
    const id=current?.id||'idle',local=current?Math.max(0,time-current.start):time*.9;
    const frame=rig.capturePose(id,local),motion=sampleMotion(id==='response'?'idle':id,local);
    frame.frontMix=1;frame.hornAlpha=0;
    // Preserve complete unwrapped turns from the supplied library; easing a
    // 2π turn back to zero would reverse the character at the end of the action.
    const u=current?Math.min(1,local/current.duration):.5,weight=current?Math.sin(Math.PI*Math.min(1,u/.14))**2:1;
    const envelope=current?Math.min(1,local/.22,(current.duration-local)/.3):1;
    const offset=(motion.position||[0,0,0]).map(v=>v*.5*Math.max(0,envelope));
    return {frame,offset,id,reason:current?.reason||'idle',local,weight};
  }
  return{trigger,sample,reset(time=now){current=null;now=time;nextAmbient=time+2.5;},snapshot:()=>({current:current?{...current}:null,events:[...events]})};
}
