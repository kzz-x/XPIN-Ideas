// Serial HTMLMediaElement seeks. The actual currentTime is authoritative;
// a cached export seek must never stand in for a frame after natural playback.
export function createProcessVideoClock(video,{
 fps=30,duration=video.duration,timeoutMs=5000,
 afterSeek=()=>new Promise(requestAnimationFrame),onDecodedFrame=()=>{},
}={}){
 const epsilon=.0005,lastFrame=Math.max(0,duration-1/fps);
 let sequence=0,serial=Promise.resolve(),queued=0,disposed=false;
 let wanted=0,completedSeek=null,frameTime=null,decodedCallbacks=0,callbackId=null;
 const frameTarget=t=>Math.max(0,Math.min(lastFrame,Math.floor(Math.max(0,t)*fps+1e-5)/fps));
 if(video.requestVideoFrameCallback){
  const decoded=(now,metadata)=>{
   if(disposed)return;
   frameTime=metadata.mediaTime;decodedCallbacks++;onDecodedFrame(metadata);
   callbackId=video.requestVideoFrameCallback(decoded);
  };
  callbackId=video.requestVideoFrameCallback(decoded);
 }
 async function seekOne(target){
  if(disposed)throw Error('Disposed S26 video clock');
  video.pause();
  // Playback changes currentTime without changing completedSeek.
  if(video.seeking||Math.abs(video.currentTime-target)>epsilon){
   await new Promise((resolve,reject)=>{
    const clean=()=>{clearTimeout(timer);video.removeEventListener('seeked',done);video.removeEventListener('error',error);};
    const done=()=>{clean();resolve();};
    const error=()=>{clean();reject(Error('S26 seek decode error'));};
    const timer=setTimeout(()=>{clean();reject(Error('S26 seek timed out at '+target));},timeoutMs);
    video.addEventListener('seeked',done);video.addEventListener('error',error);
    try{video.currentTime=target;}catch(error){clean();reject(error);}
   });
  }
  await afterSeek();
  if(disposed)throw Error('Disposed S26 video clock');
  if(video.readyState<2||video.seeking||Math.abs(video.currentTime-target)>epsilon)
   throw Error('S26 current data does not match requested seek '+target);
  completedSeek=target;onDecodedFrame(null);
 }
 async function seek(sourceTime){
  if(disposed)throw Error('Disposed S26 video clock');
  wanted=frameTarget(sourceTime);const id=++sequence,target=wanted;queued++;
  const task=serial.catch(()=>{}).then(async()=>{
   try{if(id===sequence)await seekOne(target);}finally{queued--;}
  });
  serial=task;
  // A later scrubbing request may supersede this one. All callers settle
  // only after the latest serialized request that they observed has settled.
  let observed=task;
  for(;;){await observed;if(observed===serial)break;observed=serial;}
  return snapshot();
 }
 function snapshot(){return{
  sourceTarget:wanted,currentTime:video.currentTime,completedSeek,
  seeking:video.seeking,busy:queued>0,readyState:video.readyState,
  videoFrameCallbackTime:frameTime,decodedCallbacks,
  requestedFramePTSVerified:frameTime!==null&&Math.abs(frameTime-wanted)<.51/fps,
  decodeEvidence:'HTMLMediaElement current data; seeked + render tick. PTS verification is reported separately.',
 };}
 return{seek,snapshot,frameTarget,get busy(){return queued>0;},dispose(){
  disposed=true;sequence++;video.pause();
  if(callbackId!==null&&video.cancelVideoFrameCallback)video.cancelVideoFrameCallback(callbackId);
 }};
}
