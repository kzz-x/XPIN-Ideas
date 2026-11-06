/** The movie's future byte curve, rather than its average bitrate, decides
 * how much must be present before starting. A burst near the middle of the
 * film must also meet its deadline on the currently measured connection. */
export function planFilmStartup(manifest,{bytesPerSecond=0,confident=false,at=0,minimumSeconds=4,safetySeconds=2.5,rateMultiplier=.75}={}){
  const segments=manifest?.segments||[],duration=Number(manifest?.duration)||0,init=manifest?.initBytes||0;
  if(!segments.length)return{bytes:manifest?.fileBytes||manifest?.mobileBytes||0,seconds:duration,index:-1,rate:0,confident:false};
  const start=Math.max(0,Math.min(at,duration)),minimumEnd=Math.min(duration,start+minimumSeconds);
  const rate=confident&&Number.isFinite(bytesPerSecond)&&bytesPerSecond>0?bytesPerSecond*Math.max(.1,Math.min(.9,rateMultiplier)):0;
  let cumulative=init,required=init;
  for(const segment of segments){
    cumulative+=segment.bytes;
    if(segment.start<minimumEnd-.001)required=Math.max(required,cumulative);
    required=Math.max(required,cumulative-rate*Math.max(0,segment.start-start-safetySeconds));
  }
  cumulative=init;
  for(let i=0;i<segments.length;i++){
    const segment=segments[i];cumulative+=segment.bytes;
    if(cumulative+.001>=required)return{bytes:cumulative,seconds:Math.min(duration,segment.start+segment.duration),index:i,rate,confident:rate>0};
  }
  return{bytes:cumulative,seconds:duration,index:segments.length-1,rate,confident:rate>0};
}

function transferRate(entries,now){
  if(!entries.length)return 0;
  const spans=entries.map(e=>[e.start,e.end??now]).sort((a,b)=>a[0]-b[0]);let elapsed=0,from=spans[0][0],to=spans[0][1];
  for(const [a,b]of spans.slice(1)){if(a<=to)to=Math.max(to,b);else{elapsed+=to-from;from=a;to=b;}}elapsed+=to-from;
  return entries.reduce((n,e)=>n+e.bytes,0)/Math.max(.001,elapsed/1000);
}

/** Aggregate overlapping requests once; two connections do not double the
 * available bandwidth. Explicit disk-cache hits never enter these samples. */
export function createFilmTransferMeter({now=()=>performance.now()}={}){
  const active=new Map(),completed=[];let networkBytes=0,cacheBytes=0,cacheHits=0,minimumSamples=2;
  return{
    configure({minimumNetworkSamples=2}={}){minimumSamples=Math.max(2,Math.min(6,minimumNetworkSamples));},
    start(key){active.set(key,{start:now(),bytes:0});},
    add(key,bytes){const entry=active.get(key);if(entry){entry.bytes+=bytes;networkBytes+=bytes;}},
    end(key,{cached=false,ok=true}={}){const entry=active.get(key);if(!entry)return;active.delete(key);entry.end=now();if(cached){networkBytes-=entry.bytes;cacheBytes+=entry.bytes;cacheHits++;}else if(ok&&entry.bytes)completed.push(entry);if(completed.length>100)completed.shift();},
    cache(bytes){cacheBytes+=bytes;cacheHits++;},
    snapshot(){const current=[...active.values()],all=[...completed,...current],recent=[...completed.slice(-4),...current],time=now();return{bytesPerSecond:Math.min(transferRate(all,time),transferRate(recent,time)),confident:completed.length>=minimumSamples,networkSamples:completed.length,networkBytes,cacheBytes,cacheHits};}
  };
}
