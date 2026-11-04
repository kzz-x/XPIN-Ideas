// One measureDraw/recordDraw call represents one logical frame submitted by the caller.
// Counts are not rAF ticks, compositor presentation, process memory, or a smoothness guarantee.
const finite=v=>Number.isFinite(v)?v:null;
function ring(cap){const a=new Array(cap);let n=0,at=0;return{push(v){a[at]=v;at=(at+1)%cap;n=Math.min(n+1,cap);},values(){return Array.from({length:n},(_,i)=>a[(at-n+i+cap)%cap]);}};}
function stats(values){const a=values.filter(Number.isFinite).sort((x,y)=>x-y),n=a.length;return{samples:n,median:n?a[Math.ceil(n*.5)-1]:null,p95:n?a[Math.ceil(n*.95)-1]:null,p99:n?a[Math.ceil(n*.99)-1]:null,max:n?a[n-1]:null,mean:n?a.reduce((x,y)=>x+y,0)/n:null,over50ms:a.filter(x=>x>50).length,over100ms:a.filter(x=>x>100).length};}
export function createRuntimeProbe(label,{maxSamples=1800,gpuEvery=8,maxGpuQueries=6,gpuTimeoutMs=10000,memoryEvery=120,now=()=>globalThis.performance.now(),Observer=globalThis.PerformanceObserver}={}){
 const cap=Math.max(16,Math.min(10000,Math.floor(maxSamples)||1800)),frames=ring(cap),gpu=ring(cap),marks=ring(80),memory=ring(32),long=ring(160),changes=ring(128),sessions=new Set(),byRenderer=new WeakMap(),observers=[];
 const born=now();let disposed=false,suspended=false,currentPhase='loading',lastSubmit=null,submitted=0,attempts=0,active=null,gpuDropped=0,gpuDisjoint=0,supportedContexts=0;
 gpuEvery=Math.max(1,Math.floor(gpuEvery)||8);maxGpuQueries=Math.max(1,Math.min(16,Math.floor(maxGpuQueries)||6));memoryEvery=Math.max(1,Math.floor(memoryEvery)||120);changes.push({at:born,phase:currentPhase});
 function phase(name){if(disposed)return currentPhase;name=String(name||'unspecified');if(name!==currentPhase){currentPhase=name;changes.push({at:now(),phase:name});}return currentPhase;}
 function phaseAt(at){const a=changes.values();for(let i=a.length-1;i>=0;i--)if(a[i].at<=at)return a[i].phase;return 'unknown';}
 function assertLive(){if(disposed)throw Error('Runtime probe disposed');}
 function drop(s,item){try{s.gl.deleteQuery(item.query);}catch{}gpuDropped++;}
 function getSession(renderer){
  if(!renderer?.getContext)return null;if(byRenderer.has(renderer))return byRenderer.get(renderer);
  let s=null;try{const gl=renderer.getContext(),ext=gl?.getExtension?.('EXT_disjoint_timer_query_webgl2');if(ext&&gl.createQuery&&gl.getQueryParameter&&gl.beginQuery)s={gl,ext,pending:[],active:null};}catch{}
  byRenderer.set(renderer,s);if(s){sessions.add(s);supportedContexts++;}return s;
 }
 function pollGpu(){if(disposed)return;for(const s of sessions){
  try{if(s.gl.isContextLost?.()){for(const item of s.pending)drop(s,item);s.pending.length=0;continue;}
   const disjoint=!!s.gl.getParameter(s.ext.GPU_DISJOINT_EXT);if(disjoint){gpuDisjoint++;for(const item of s.pending)drop(s,item);s.pending.length=0;continue;}
   for(let i=s.pending.length-1;i>=0;i--){const item=s.pending[i];if(s.gl.getQueryParameter(item.query,s.gl.QUERY_RESULT_AVAILABLE)){
     const ns=s.gl.getQueryParameter(item.query,s.gl.QUERY_RESULT),ms=ns/1e6;s.pending.splice(i,1);s.gl.deleteQuery(item.query);if(Number.isFinite(ms)&&ms>=0){item.row.gpuMs=ms;gpu.push({at:item.row.at,phase:item.row.phase,ms});}else gpuDropped++;
    }else if(now()-item.at>gpuTimeoutMs){s.pending.splice(i,1);drop(s,item);}}
  }catch{for(const item of s.pending)drop(s,item);s.pending.length=0;}
 }}
 function beginGpu(renderer){
  const s=getSession(renderer);
  if(!s||s.active||s.pending.length>=maxGpuQueries)return null;
  let query=null;
  try{
   if(s.gl.isContextLost?.()||s.gl.getParameter(s.ext.GPU_DISJOINT_EXT))return null;
   if(s.gl.getQuery?.(s.ext.TIME_ELAPSED_EXT,s.gl.CURRENT_QUERY))return null;
   query=s.gl.createQuery();if(!query)return null;
   s.gl.beginQuery(s.ext.TIME_ELAPSED_EXT,query);s.active=query;return{s,query};
  }catch{if(query)drop(s,{query});return null;}
 }
 function memorySample(renderer,at){const info=renderer?.info,heap=globalThis.performance?.memory;memory.push({at,phase:currentPhase,geometries:finite(info?.memory?.geometries),textures:finite(info?.memory?.textures),programs:info?.programs?.length??null,canvasPixels:renderer?.domElement?renderer.domElement.width*renderer.domElement.height:null,jsHeapEstimate:heap?{used:finite(heap.usedJSHeapSize),total:finite(heap.totalJSHeapSize),limit:finite(heap.jsHeapSizeLimit)}:null});}
 function recordDraw({phase:nextPhase=currentPhase,at=now(),cpuMs=null,renderer=null,submitted:didSubmit=true,gpuToken=null}={}){
  assertLive();phase(nextPhase);attempts++;const row={at,phase:currentPhase,submitted:!!didSubmit,cpuMs:finite(cpuMs),intervalMs:null,gpuMs:null,drawCalls:finite(renderer?.info?.render?.calls),triangles:finite(renderer?.info?.render?.triangles)};
  if(didSubmit){if(!suspended&&lastSubmit!==null&&at>=lastSubmit)row.intervalMs=at-lastSubmit;lastSubmit=suspended?null:at;submitted++;if(submitted===1||submitted%memoryEvery===0)memorySample(renderer,at);}
  frames.push(row);if(gpuToken){const{s,query}=gpuToken;s.active=null;try{s.gl.endQuery(s.ext.TIME_ELAPSED_EXT);if(didSubmit)s.pending.push({query,row,at:now()});else drop(s,{query});}catch{drop(s,{query});}}
  return row;
 }
 function beginDraw({phase:nextPhase=currentPhase,renderer=null}={}){assertLive();if(active)throw Error('Nested draw probe is unsupported');phase(nextPhase);pollGpu();const token={at:now(),phase:currentPhase,renderer,gpuToken:(attempts+1)%gpuEvery===0?beginGpu(renderer):null};active=token;return token;}
 function endDraw(token,{submitted:didSubmit=true}={}){if(disposed)return null;if(token!==active)throw Error('Draw token does not belong to active frame');active=null;return recordDraw({...token,cpuMs:now()-token.at,submitted:didSubmit});}
 function measureDraw(fn,options={}){const token=beginDraw(options);let ok=false;try{const value=fn();if(value&&typeof value.then==='function')throw Error('measureDraw requires a synchronous render-submit callback');ok=true;return value;}finally{endDraw(token,{submitted:ok});}}
 function mark(name,detail=null){if(disposed)return;marks.push({at:now(),phase:currentPhase,name:String(name),detail});}
 function setSuspended(v){if(disposed||!!v===suspended)return;suspended=!!v;lastSubmit=null;mark(suspended?'suspend':'resume');}
 function snapshot(){pollGpu();const f=frames.values(),firstAt=f[0]?.at??Infinity,g=gpu.values().filter(x=>x.at>=firstAt),p=[...new Set(f.map(r=>r.phase))],interval=stats(f.filter(r=>r.submitted).map(r=>r.intervalMs));return{
  label:String(label),disposed,suspended,elapsedWallMs:now()-born,attemptedDraws:attempts,submittedFrames:submitted,retainedFrames:f.length,activeSampledSubmitRateHz:interval.mean>0?1000/interval.mean:null,
  intervalMs:interval,cpuSubmitMs:stats(f.map(r=>r.cpuMs)),gpuTimeMs:stats(g.map(r=>r.ms)),gpu:{supportedContexts,pending:[...sessions].reduce((n,s)=>n+s.pending.length,0),droppedQueries:gpuDropped,disjointPolls:gpuDisjoint,every:gpuEvery},
  phases:p.map(name=>{const a=f.filter(r=>r.phase===name);return{phase:name,retainedSubmittedFrames:a.filter(r=>r.submitted).length,intervalMs:stats(a.map(r=>r.intervalMs)),cpuSubmitMs:stats(a.map(r=>r.cpuMs)),gpuTimeMs:stats(g.filter(r=>r.phase===name).map(r=>r.ms))};}),marks:marks.values(),memory:memory.values(),longTasks:long.values(),
  scope:{frames:'Caller-declared logical render submissions; not rAF ticks or compositor presentation',cpu:'Synchronous draw callback duration; not complete frame CPU unless caller wraps it',gpu:'Optional asynchronous WebGL2 elapsed query, sampled; unsupported/unavailable is null',memory:'Three.js object counts plus optional Chromium JS heap estimate; not process RAM or GPU VRAM',longTasks:'Browser entries attributed to the phase active at entry start, not proof of causality',validation:'Runtime observations only; no device-wide or zero-stutter guarantee'}
 };}
 if(Observer){const types=Observer.supportedEntryTypes||[];for(const type of ['longtask','long-animation-frame'])if(types.includes(type))try{const o=new Observer(list=>{if(disposed)return;for(const e of list.getEntries())long.push({type,startTime:e.startTime,duration:e.duration,blockingDuration:finite(e.blockingDuration),phase:phaseAt(e.startTime)});});o.observe({type,buffered:true});observers.push(o);}catch{}}
 function dispose(){if(disposed)return;disposed=true;for(const o of observers)o.disconnect();for(const s of sessions){if(s.active){try{s.gl.endQuery(s.ext.TIME_ELAPSED_EXT);}catch{}drop(s,{query:s.active});s.active=null;}for(const item of s.pending)drop(s,item);s.pending.length=0;}sessions.clear();active=null;}
 return{phase,mark,recordDraw,beginDraw,endDraw,measureDraw,pollGpu,setSuspended,snapshot,dispose};
}
