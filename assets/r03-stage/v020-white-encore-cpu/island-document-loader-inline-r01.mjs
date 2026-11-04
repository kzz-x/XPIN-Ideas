// The complete trusted island document comes from this one HTML's resource
// pool. srcdoc inherits this document's origin, including direct file: opens.
export function createIslandDocumentLoader(frame,_source,{timeoutMs=30000}={}){
 const provider=globalThis.DOT_SINGLE_RESOURCES;
 if(!provider?.createIslandLease)throw Error('单文件内嵌首关资源缺失');
 let promise=null,resolve,reject,lease=null,timer=0,disposed=false,settled=false;
 const state={mode:'embedded-srcdoc',source:'embedded:island-v06.2',phase:'idle',startedAt:0,bytes:0,error:''};
 function fail(error){if(settled)return;settled=true;clearTimeout(timer);state.phase=disposed?'disposed':'failed';state.error=error.message;reject?.(error);}
 function onLoad(){if(!promise||settled||disposed)return;try{if(!frame.contentDocument?.querySelector('#xpin-mods'))return;settled=true;clearTimeout(timer);state.phase='document-loaded';state.loadedMs=performance.now()-state.startedAt;resolve({...state});}catch(error){fail(error);}}
 function onError(){fail(Error('内嵌首关文档未能启动'));}
 frame.addEventListener('load',onLoad);frame.addEventListener('error',onError);
 return{start(){if(disposed)return Promise.reject(new DOMException('Island load disposed','AbortError'));if(promise)return promise;promise=new Promise((a,b)=>{resolve=a;reject=b;});state.startedAt=performance.now();state.phase='creating-srcdoc';try{lease=provider.createIslandLease();state.bytes=lease.bytes;state.scope=lease.scope;timer=setTimeout(()=>fail(new DOMException('内嵌首关准备超时','TimeoutError')),timeoutMs);frame.srcdoc=lease.html;state.phase='navigating-srcdoc';}catch(error){fail(error);}return promise;},snapshot:()=>({...state}),dispose(){if(disposed)return;disposed=true;if(promise&&!settled)fail(new DOMException('Island load disposed','AbortError'));clearTimeout(timer);frame.removeEventListener('load',onLoad);frame.removeEventListener('error',onError);lease?.release();lease=null;state.phase='disposed';}};
}
