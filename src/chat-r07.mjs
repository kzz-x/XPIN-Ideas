export function createChatPresentation(){
  const chat=document.querySelector('#chat'),send=document.querySelector('#send');
  chat.innerHTML=`<div class="chat-top"><span class="chat-wordmark">灵感工作台</span><span class="chat-code">IDEA / 01</span></div><div class="chat-welcome"><span class="chat-sigil" aria-hidden="true">[ ✳ ]</span><h2>想法，正在发生。</h2><p>把脑海里的画面告诉我。</p></div><div class="chat-composer"><div class="chat-message"><span id="prompt-text"></span><span class="typing-caret" aria-hidden="true"></span></div><div class="chat-composer-foot"><span class="composer-plus" aria-hidden="true">＋</span><span class="composer-mode">视频创作 <span>⌄</span></span><span class="composer-spacer"></span><span id="send-slot"></span></div></div><div class="send-cue"><span>先有想法，再让工具接住它。</span><span>点击发送 ↗</span></div>`;
  document.querySelector('#send-slot').append(send);
  send.innerHTML='<span class="ascii-orbit" aria-hidden="true"></span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 19 19 5M5 5h14v14"/></svg>';
  send.setAttribute('aria-label','发送：帮我做一个炫酷的视频');
  const orbit=send.querySelector('.ascii-orbit'),glyphs='[]{}+/=<>:;*';
  for(let ring=0;ring<3;ring++){
    const outline=document.createElement('span');outline.className='ascii-square';outline.style.setProperty('--ring',ring);outline.style.setProperty('--ring-delay',`${-ring*.7}s`);
    for(let i=0;i<24;i++){
      const side=Math.floor(i/6),u=(i%6)/6,xy=side===0?[u,0]:side===1?[1,u]:side===2?[1-u,1]:[0,1-u];
      const el=document.createElement('i');el.textContent=glyphs[(i*7+ring*3)%glyphs.length];el.style.left=`${xy[0]*100}%`;el.style.top=`${xy[1]*100}%`;outline.append(el);
    }
    orbit.append(outline);
  }
  const text=document.querySelector('#prompt-text'),message='帮我做一个炫酷的视频';let last=-1,phase='';
  return {update(next,age){if(next!==phase){phase=next;if(next==='morph'||next==='intro'){text.textContent='';last=-1;chat.classList.remove('prompt-ready');}}
    if(next==='chat'){const count=Math.min(message.length,Math.max(0,Math.floor((age-.35)/.095)));if(count!==last){text.textContent=message.slice(0,count);last=count;}chat.classList.toggle('prompt-ready',count===message.length);}
  }};
}

export function createCinemaControls({transport,getPhase}){
  const controls=document.querySelector('#transport');let last=performance.now(),drag=false,keyboard=false;
  function reveal(){last=performance.now();document.body.classList.remove('cinema-idle');}
  window.addEventListener('pointermove',reveal,{passive:true});window.addEventListener('pointerdown',()=>{keyboard=false;reveal();},{passive:true});window.addEventListener('keydown',()=>{keyboard=true;reveal();});
  controls.addEventListener('pointerdown',()=>{drag=true;});window.addEventListener('pointerup',()=>{drag=false;reveal();});window.addEventListener('pointercancel',()=>{drag=false;reveal();});
  controls.addEventListener('focusin',reveal);
  document.querySelector('#film').addEventListener('dblclick',()=>{if(document.fullscreenElement)document.exitFullscreen?.();else document.documentElement.requestFullscreen?.().catch(()=>{});});
  return{reveal,update(){const watch=['film','stage','transition'].includes(getPhase()),focus=keyboard&&controls.contains(document.activeElement);document.body.classList.toggle('cinema',watch);document.body.classList.toggle('cinema-idle',watch&&transport.playing&&!transport.isScrubbing&&!drag&&!focus&&performance.now()-last>1900);}};
}
