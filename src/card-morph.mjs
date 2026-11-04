const clamp=x=>Math.max(0,Math.min(1,x)),ease=x=>{x=clamp(x);return x*x*(3-2*x);},mix=(a,b,t)=>a+(b-a)*t;
function box(node,parent){let x=0,y=0,o=node;while(o&&o!==parent){x+=o.offsetLeft;y+=o.offsetTop;o=o.offsetParent;}return{x,y,w:node.offsetWidth,h:node.offsetHeight};}
// The same visible picture and title travel between their two real DOM layouts.
// Only secondary text reveals after the card has risen; there is no content swap.
export function createCardMorph(el){
  const preview=document.createElement('div');preview.className='card-preview';
  for(const child of [...el.children])if(!child.classList.contains('card-detail'))preview.append(child);
  el.prepend(preview);const detail=el.querySelector('.card-detail');
  const image=preview.querySelector('.card-image'),heading=preview.querySelector('h2'),destination=detail.querySelector('figure img')||detail.querySelector('.comparison'),targetHeading=detail.querySelector('h2');
  const layer=document.createElement('div');layer.className='card-morph-layer';
  const travelingImage=image.cloneNode(),travelingHeading=heading.cloneNode(true);
  travelingImage.className='traveling-image';travelingHeading.className='traveling-title';layer.append(travelingImage,travelingHeading);el.append(layer);
  let prepared=false,startImage,startTitle,startFont,startLine,startWeight,progress=0;
  function prepare(){
    // At rest the preview always has the original 640 x 420 design coordinates.
    startImage=box(image,el);startTitle=box(heading,el);const s=getComputedStyle(heading);startFont=parseFloat(s.fontSize);startLine=parseFloat(s.lineHeight);startWeight=s.fontWeight;
    travelingImage.src=image.src;prepared=true;detail.scrollTop=0;
  }
  function place(node,a,b,t){Object.assign(node.style,{left:mix(a.x,b.x,t)+'px',top:mix(a.y,b.y,t)+'px',width:mix(a.w,b.w,t)+'px',height:mix(a.h,b.h,t)+'px'});}
  function update(p){
    progress=p;if(!prepared&&p>0)prepare();
    const width=el.offsetWidth,scale=width/640;
    preview.style.transform=`scale(${scale})`;el.style.setProperty('--reading',p);
    const traveling=p>0&&p<1;el.classList.toggle('morphing',traveling);layer.style.display=traveling?'block':'none';
    detail.style.visibility=p>0?'visible':'hidden';detail.style.pointerEvents=p===1?'auto':'none';
    preview.style.opacity=String(1-ease(p/.42));detail.style.opacity=String(ease((p-.28)/.65));
    if(!traveling)return;
    const scaled=r=>({x:r.x*scale,y:r.y*scale,w:r.w*scale,h:r.h*scale});
    const a=box(destination,el),b=box(targetHeading,el),style=getComputedStyle(targetHeading),t=ease(p);
    place(travelingImage,scaled(startImage),a,t);place(travelingHeading,scaled(startTitle),b,t);
    Object.assign(travelingHeading.style,{fontSize:mix(startFont*scale,parseFloat(style.fontSize),t)+'px',lineHeight:mix(startLine*scale,parseFloat(style.lineHeight),t)+'px',fontWeight:startWeight});
  }
  return {prepare,update,beginClose(){if(destination.tagName==='IMG'){travelingImage.src=destination.src;image.src=destination.src;}detail.scrollTop=0;},get progress(){return progress;},reset(){prepared=false;update(0);}};
}
