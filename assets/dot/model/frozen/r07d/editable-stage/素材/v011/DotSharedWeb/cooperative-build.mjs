// Exact procedural construction, scheduled in short main-thread slices. The
// generator owns all arithmetic and random state; yielding never changes them.
export const yieldBuild=()=>globalThis.scheduler?.yield?globalThis.scheduler.yield():new Promise(resolve=>setTimeout(resolve,0));
export function finishBuild(iterator){let step;do{step=iterator.next();}while(!step.done);return step.value;}
export async function finishBuildAsync(iterator,{budgetMs=4,yieldTask=yieldBuild}={}){
 let started=performance.now();
 for(;;){
  const step=iterator.next();if(step.done)return step.value;
  if(performance.now()-started>=budgetMs){await yieldTask();started=performance.now();}
 }
}
