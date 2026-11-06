// The frame callback owns whether another animated frame is needed. A settled
// native article can stop requesting frames and wake on the next UI event.
export function createFrameLoop({onFrame,onWake=()=>{},request=globalThis.requestAnimationFrame?.bind(globalThis),cancel=globalThis.cancelAnimationFrame?.bind(globalThis),now=()=>performance.now(),hidden=false}={}){
  let queued=null,dispatching=false,callbacks=0,wakes=0;
  function schedule(){
    if(hidden||queued!==null)return;
    queued=request(timestamp=>{
      queued=null;
      if(hidden)return;
      callbacks++;dispatching=true;
      try{onFrame(timestamp);}finally{dispatching=false;}
    });
  }
  function wake(){
    if(hidden)return;
    if(queued===null&&!dispatching){wakes++;onWake(now());}
    schedule();
  }
  function setHidden(value){
    if(hidden===!!value)return;
    hidden=!!value;
    if(hidden){if(queued!==null)cancel(queued);queued=null;}
    else wake();
  }
  return{schedule,wake,setHidden,snapshot:()=>({queued:queued!==null,hidden,callbacks,wakes})};
}
