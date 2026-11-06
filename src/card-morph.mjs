const clamp=x=>Math.max(0,Math.min(1,x)),ease=x=>{x=clamp(x);return x*x*(3-2*x);},mix=(a,b,t)=>a+(b-a)*t;
function box(node,parent){let x=0,y=0,o=node;while(o&&o!==parent){x+=o.offsetLeft;y+=o.offsetTop;o=o.offsetParent;}return{x,y,w:node.offsetWidth,h:node.offsetHeight};}
export function createCardMorph(el){
  const preview=document.createElement('div');preview.className='card-preview';
  for(const child of [...el.children])if(!child.classList.contains('card-detail')&&!child.classList.contains('card-read-hint'))preview.append(child);
  el.prepend(preview);const detail=el.querySelector('.card-detail');
  const image=preview.querySelector('.card-image'),heading=preview.querySelector('h2'),destination=detail.querySelector('figure img')||detail.querySelector('figure video')||detail.querySelector('.comparison'),targetHeading=detail.querySelector('h2');
  const layer=document.createElement('div');layer.className='card-morph-layer';
  const travelingImage=image.cloneNode(),travelingHeading=heading.cloneNode(true);
  travelingImage.className='traveling-image';travelingHeading.className='traveling-title';layer.append(travelingImage,travelingHeading);el.append(layer);
  let prepared=false,startImage,startTitle,startFont,startLine,startWeight,endImage,endTitle,endFont,endLine,endWeight,progress=0,lastProgress=-1,lastWidth=-1,revealToken=0,revealTimer;
  function leaveReading(){revealToken++;clearTimeout(revealTimer);el.classList.remove('reader-revealing');detail.style.transition='none';detail.style.opacity='0';}
  function measureEnd(){endImage=box(destination,el);endTitle=box(targetHeading,el);const s=getComputedStyle(targetHeading);endFont=parseFloat(s.fontSize);endLine=parseFloat(s.lineHeight);endWeight=s.fontWeight;}
  function prepare(){
    leaveReading();lastProgress=-1;startImage=box(image,el);startTitle=box(heading,el);
    const s=getComputedStyle(heading);startFont=parseFloat(s.fontSize);startLine=parseFloat(s.lineHeight);startWeight=parseFloat(s.fontWeight)||650;
    // Measure final typography once. No per-frame layout/line wrapping or
    // replacement of body text while a transformed card is still moving.
    const old={width:el.style.width,height:el.style.height},focused=el.classList.contains('focused');
    el.classList.add('focused');el.style.width=(innerWidth<700?340:640)+'px';el.style.height=(innerWidth<700?640:420)+'px';measureEnd();
    Object.assign(el.style,old);if(!focused)el.classList.remove('focused');
    travelingImage.src=image.src;prepared=true;detail.scrollTop=0;
  }
  function place(node,a,b,t){Object.assign(node.style,{left:mix(a.x,b.x,t)+'px',top:mix(a.y,b.y,t)+'px',width:mix(a.w,b.w,t)+'px',height:mix(a.h,b.h,t)+'px'});}
  function finishTravel(){el.classList.remove('morphing');layer.style.display='none';}
  function update(p){
    const width=el.offsetWidth;if(p===lastProgress&&width===lastWidth)return;
    if(!prepared&&p>0)prepare();lastProgress=p;lastWidth=width;progress=p;
    const scale=width/640;preview.style.transform='scale('+scale+')';el.style.setProperty('--reading',p);
    const moving=p>0;el.classList.toggle('morphing',moving);layer.style.display=moving?'block':'none';
    detail.style.visibility=moving?'visible':'hidden';detail.style.pointerEvents='none';detail.style.opacity='0';
    preview.style.opacity=String(1-ease(p/.42));if(!moving)return;
    const scaled=r=>({x:r.x*scale,y:r.y*scale,w:r.w*scale,h:r.h*scale}),t=ease(p);
    place(travelingImage,scaled(startImage),endImage,t);place(travelingHeading,scaled(startTitle),endTitle,t);
    Object.assign(travelingHeading.style,{fontSize:mix(startFont*scale,endFont,t)+'px',lineHeight:mix(startLine*scale,endLine,t)+'px',fontWeight:String(mix(startWeight,parseFloat(endWeight)||700,t))});
  }
  function commitReading(){
    const token=++revealToken;clearTimeout(revealTimer);
    measureEnd();place(travelingImage,endImage,endImage,1);place(travelingHeading,endTitle,endTitle,1);
    Object.assign(travelingHeading.style,{fontSize:endFont+'px',lineHeight:endLine+'px',fontWeight:endWeight});
    el.classList.add('morphing');layer.style.display='block';detail.style.visibility='visible';detail.style.pointerEvents='auto';detail.style.opacity='0';
    // The title and image remain continuous until the native reader has had
    // two paints. Then body copy fades in and the identical originals take over.
    requestAnimationFrame(()=>requestAnimationFrame(()=>{
      if(token!==revealToken||!el.classList.contains('native-reading'))return;
      el.classList.add('reader-revealing');detail.style.transition='opacity .18s ease';detail.style.opacity='1';
      revealTimer=setTimeout(()=>{if(token!==revealToken)return;finishTravel();el.classList.remove('reader-revealing');detail.style.transition='none';},200);
    }));
  }
  return {prepare,update,commitReading,leaveReading,beginClose(){leaveReading();if(destination.tagName==='IMG'){travelingImage.src=destination.src;image.src=destination.src;}detail.scrollTop=0;},get progress(){return progress;},reset(){leaveReading();prepared=false;lastProgress=-1;update(0);}};
}
