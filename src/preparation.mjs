export const yieldTask=()=>globalThis.scheduler?.yield?globalThis.scheduler.yield():new Promise(resolve=>setTimeout(resolve,0));
export const nextPaint=()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
export const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
export function waitFor(test,{timeout=45000,label='资源',signal}={}){
  return new Promise((resolve,reject)=>{const start=performance.now();const tick=()=>{if(signal?.aborted)return reject(new DOMException('Cancelled','AbortError'));try{if(test())return resolve();}catch(e){return reject(e);}if(performance.now()-start>timeout)return reject(Error(label+'准备超时，请重试'));setTimeout(tick,80);};tick();});
}
