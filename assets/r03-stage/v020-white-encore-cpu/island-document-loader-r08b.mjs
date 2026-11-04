// Use normal same-origin navigation first. Only an uncommitted about:blank
// navigation gets one bounded fetch/Blob attempt. Original HTML bytes stay intact.
export function createIslandDocumentLoader(frame,source,{timeoutMs=30000,fallbackAfterMs=3000,fetcher=fetch}={}){
 const url=new URL(source,location.href);
 if(url.origin!==location.origin||!['http:','https:'].includes(url.protocol))throw Error('Island package requires this project’s same-origin HTTP server');
 const controller=new AbortController(),parentDocument=frame.ownerDocument||globalThis.document;
 let promise=null,resolveStart,rejectStart,objectURL='',disposed=false,settled=false,timer=0,fallbackTimer=0;
 const state={mode:'url',source:url.href,phase:'idle',startedAt:0,bytes:0,error:''};
 const clear=()=>{clearTimeout(timer);clearTimeout(fallbackTimer);timer=fallbackTimer=0;};
 function fail(error){if(settled)return;settled=true;clear();state.phase=disposed?'disposed':'failed';state.error=error.message;controller.abort(error);rejectStart(error);}
 const currentURL=()=>frame.contentWindow?.location.href||'about:blank';
 function onLoad(){
  if(!promise||settled||disposed)return;
  try{
   const current=currentURL().split('#')[0],wanted=objectURL||url.href.split('#')[0];
   if(current!==wanted)return;
   settled=true;clear();state.phase='document-loaded';state.loadedMs=performance.now()-state.startedAt;resolveStart({...state});
  }catch(error){fail(error);}
 }
 const onError=()=>fail(Error('Island frame navigation failed'));
 const onPolicy=event=>{
  if(!/^(frame-src|child-src|default-src)$/.test(event.effectiveDirective))return;
  if([url.href,url.origin,objectURL].includes(event.blockedURI)||(objectURL&&event.blockedURI==='blob'))fail(Error('Island frame blocked by the page content security policy'));
 };
 frame.addEventListener('load',onLoad);frame.addEventListener('error',onError);parentDocument?.addEventListener?.('securitypolicyviolation',onPolicy);
 async function fallback(){
  if(settled||disposed)return;
  try{
   if(currentURL()!=='about:blank')return;
   state.mode='same-origin-fetch-blob';state.phase='fetching';state.fallbackMs=performance.now()-state.startedAt;
   frame.src='about:blank';const at=performance.now();
   const response=await fetcher(url.href,{mode:'same-origin',credentials:'same-origin',signal:controller.signal});
   if(!response.ok)throw Error('Island package HTTP '+response.status);
   if(response.url&&new URL(response.url).origin!==location.origin)throw Error('Island package redirected outside this project origin');
   const mime=response.headers.get('content-type')||'';
   if(!/^text\/html(?:;|$)/i.test(mime))throw Error('Island package must be served as text/html; received '+mime);
   const blob=await response.blob();
   if(disposed||settled||controller.signal.aborted)return;
   if(!blob.size)throw Error('Island package was empty');
   state.bytes=blob.size;state.fetchMs=performance.now()-at;objectURL=URL.createObjectURL(blob);state.phase='navigating-blob';frame.src=objectURL;
  }catch(error){fail(error);}
 }
 function start(){
  if(disposed)return Promise.reject(new DOMException('Island load disposed','AbortError'));
  if(promise)return promise;
  state.startedAt=performance.now();state.phase='navigating-url';
  promise=new Promise((resolve,reject)=>{resolveStart=resolve;rejectStart=reject;});
  timer=setTimeout(()=>fail(new DOMException('Island document initialization timeout ('+state.phase+')','TimeoutError')),timeoutMs);
  fallbackTimer=setTimeout(fallback,fallbackAfterMs);frame.src=url.href;return promise;
 }
 return{start,snapshot:()=>({...state}),dispose(){if(disposed)return;disposed=true;if(promise&&!settled)fail(new DOMException('Island load disposed','AbortError'));clear();controller.abort();frame.removeEventListener('load',onLoad);frame.removeEventListener('error',onError);parentDocument?.removeEventListener?.('securitypolicyviolation',onPolicy);if(objectURL){URL.revokeObjectURL(objectURL);objectURL='';}state.phase='disposed';}};
}
