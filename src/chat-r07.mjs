export function createChatPresentation(){
  const chat=document.querySelector('#chat'),send=document.querySelector('#send');
  chat.innerHTML=`<div class="chat-top"><span class="chat-wordmark">灵感工作台</span><span class="chat-code">IDEA / 01</span></div><div class="chat-welcome"><span class="chat-sigil" aria-hidden="true"><img src="./assets/dot/dot-outline-r12.svg" width="58" height="58" alt=""></span><h2>你的AI助理</h2><p>把脑海里的画面告诉我。</p></div><div class="chat-composer"><div class="chat-message"><span id="prompt-text"></span><span class="typing-caret" aria-hidden="true"></span></div><div class="chat-composer-foot"><span class="composer-plus" aria-hidden="true">＋</span><span class="composer-mode">视频创作 <span>⌄</span></span><span class="composer-spacer"></span><span id="send-slot"></span></div></div><div class="send-cue"><span>先有想法，再让工具实现它。</span><span>点击发送 ↗</span></div>`;
  document.querySelector('#send-slot').append(send);
  send.innerHTML='<span class="send-rings" aria-hidden="true"><i></i><i></i><i></i></span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 19 19 5M5 5h14v14"/></svg>';
  send.setAttribute('aria-label','发送：帮我做一个炫酷的视频');
  const icon=chat.querySelector('.chat-sigil img'),ready=icon.decode();
  const text=document.querySelector('#prompt-text'),message='帮我做一个炫酷的视频';let last=-1,phase='';
  return {ready,update(next,age){if(next!==phase){phase=next;if(next==='morph'||next==='intro'){text.textContent='';last=-1;chat.classList.remove('prompt-ready');}}
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
