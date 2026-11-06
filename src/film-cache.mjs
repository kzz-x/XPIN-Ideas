/** Optional, content-addressed cache. Storage denial/full disks must never
 * delay or prevent playback; keep at most two writes alive. No service worker
 * owns navigation, so stale application code cannot replace a new release. */
export function createFilmCache({enabled=true,storage=globalThis.caches,timeoutMs=250}={}){
  let cacheJob=null,name='',writes=new Map(),hits=0,stored=0,failures=0,disabled=false;
  async function bounded(job){let timer;try{return await Promise.race([job,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('film cache timeout')),timeoutMs);})]);}finally{clearTimeout(timer);}}
  async function open(){if(!enabled||!storage||!name||disabled)return null;return cacheJob??=bounded(storage.open(name)).catch(()=>{failures++;disabled=true;return null;});}
  return{
    configure(hash){if(!enabled||!storage)return;name='linggan-film-v1-'+String(hash||'').slice(0,16);open().then(async cache=>{if(!cache)return;try{for(const key of await storage.keys())if(key.startsWith('linggan-film-v1-')&&key!==name)await storage.delete(key);}catch{failures++;}}).catch(()=>{});},
    async read(url,expected){if(disabled||!/[a-f0-9]{12,}/i.test(url))return null;try{await bounded(writes.get(url));const cache=await open();if(!cache)return null;const response=await bounded(cache.match(url));if(!response)return null;const data=await bounded(response.arrayBuffer());if(Number.isFinite(expected)&&data.byteLength!==expected){await bounded(cache.delete(url));return null;}hits++;return data;}catch{failures++;disabled=true;return null;}},
    write(url,data){if(!enabled||!storage||disabled||writes.size>=2||!/[a-f0-9]{12,}/i.test(url))return;const job=(async()=>{try{const cache=await open();if(!cache)return;await bounded(cache.put(url,new Response(data,{headers:{'Content-Type':'application/octet-stream','Content-Length':String(data.byteLength)}})));stored++;}catch{failures++;disabled=true;}})().finally(()=>writes.delete(url));writes.set(url,job);},
    snapshot(){return{enabled:enabled&&!!storage&&!disabled,hits,stored,failures,pending:writes.size};}
  };
}
