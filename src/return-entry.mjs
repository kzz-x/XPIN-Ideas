import {restorePlay,STORAGE_KEY} from './games-rules.mjs';

export const RETURN_VISIT_KEY='linggan-scroll-visited-v1';
export function createReturnVisit({storage,now=Date.now}={}){
 try{storage??=globalThis.localStorage;}catch{}
 let eligible=false,source='new',visitedAt=null;
 try{
  const saved=JSON.parse(storage?.getItem(RETURN_VISIT_KEY)||'null');
  if(saved?.scrollVisited===true){eligible=true;source='saved';visitedAt=saved.visitedAt||null;}
  else{
   const old=restorePlay(JSON.parse(storage?.getItem(STORAGE_KEY)||'null'));
   const resources=JSON.parse(storage?.getItem('linggan-resource-seen-r09')||'{}');
   if(old.seen.some(Boolean)||old.done.some(v=>v.length>0)||Object.values(resources||{}).some(v=>v===true)){eligible=true;source='legacy';}
  }
 }catch{}
 return{get eligible(){return eligible;},snapshot:()=>({eligible,source,visitedAt}),markScrollVisited(){eligible=true;visitedAt??=now();source='session';try{storage?.setItem(RETURN_VISIT_KEY,JSON.stringify({version:1,scrollVisited:true,visitedAt}));source='saved';}catch{}return eligible;}};
}

// The long press is a gesture only; readiness never advances this clock.
export class ReturnHold{
 constructor(duration=1000){this.duration=duration;this.reset();}
 reset(){this.held=false;this.startedAt=0;this.progress=0;this.committed=false;}
 press(now){if(this.held||this.committed)return false;this.held=true;this.startedAt=now;this.progress=0;return true;}
 release(){this.held=false;if(!this.committed)this.progress=0;}
 cancel(){if(!this.committed)this.reset();else this.held=false;}
 update(now){if(this.held&&!this.committed){this.progress=Math.max(0,Math.min(1,(now-this.startedAt)/this.duration));if(this.progress===1){this.committed=true;this.held=false;return true;}}return false;}
}
