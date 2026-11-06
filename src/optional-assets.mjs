// Nonessential presentation assets may improve the first frame, but must not
// prevent it. Callers keep all model, glyph and film preparation outside this.
export function boundedOptional(job,{name='optional-asset',timeoutMs=2000,onIssue=()=>{}}={}){
 const wait=Number.isFinite(timeoutMs)&&timeoutMs>=0?timeoutMs:2000;
 return new Promise(resolve=>{
  let finished=false,timer;
  const errorOf=reason=>{
   if(reason instanceof Error)return reason;
   try{return new Error(reason?.message||String(reason));}catch{return new Error('可选资源未能准备完成');}
  };
  function finish(status,value){
   if(finished)return;finished=true;clearTimeout(timer);
   const result={name,status};
   if(status==='ready')result.value=value;else result.error=errorOf(value);
   resolve(result);
   if(status!=='ready'&&typeof onIssue==='function'){
    // Diagnostics are optional too. Handle an async reporter immediately so a
    // reporting failure cannot become a new unhandled boot-time rejection.
    try{Promise.resolve(onIssue(result)).catch(()=>{});}catch{}
   }
  }
  timer=setTimeout(()=>finish('timeout',new Error(name+'准备超时，可继续使用默认效果')),wait);
  try{
   const value=typeof job==='function'?job():job;
   // Both handlers are installed in this call, even if the asset later times
   // out. Its eventual rejection can never escape as unhandledrejection.
   Promise.resolve(value).then(value=>finish('ready',value),error=>finish('failed',error));
  }catch(error){finish('failed',error);}
 });
}
