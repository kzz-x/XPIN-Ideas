import './main.mjs';
import {SHOT} from './document.mjs';

const editor=window.DOT_EDITOR;
document.title='灵感先行 · Dot舞台与五岛 · D02统一候选';
const css=document.createElement('style');css.textContent=`
.concert-strip{border-top:1px solid #40454a;background:#171d23;padding:12px 18px;display:flex;gap:8px;align-items:center;flex-wrap:wrap}.concert-strip button{font:12px system-ui;color:#edf1f4;background:#2c3741;border:1px solid #596674;padding:8px 12px;border-radius:5px;cursor:pointer}.concert-strip small{color:#aab7c3}
.concert-caption{position:absolute;z-index:5;bottom:4%;left:50%;transform:translateX(-50%);max-width:90%;width:max-content;padding:8px 18px;border:1px solid #fff2;border-radius:12px;background:#0c141dcc;color:#fff;font:600 clamp(14px,1.5vw,22px)/1.6 system-ui;box-sizing:border-box;text-align:center;pointer-events:none;backdrop-filter:blur(10px)}
.game-handoff{position:absolute;left:50%;bottom:8%;transform:translateX(-50%);z-index:6;border:1px solid #e9eff188;border-radius:13px;background:#e4e8e3;color:#25313b;padding:12px 28px;font:600 17px system-ui;cursor:pointer}.concert-caption[hidden],.game-handoff[hidden]{display:none!important}
.stage-preflight{position:absolute;z-index:7;top:10px;left:50%;transform:translateX(-50%);background:#1a202acc;color:#ecdcba;padding:5px 14px;font:12px system-ui;border-radius:6px}#stage{position:relative}body.clean .concert-strip{display:none}
`;document.head.append(css);
const strip=document.createElement('section');strip.className='concert-strip';
strip.innerHTML='<button id="concertPlay">从头播放完整演出</button><button data-time="1.8">舞台揭示</button><button data-time="8.2">持续推近</button><button data-time="11.8">特写与礼花</button><button id="afterMusic">音乐后留一秒</button><button id="pullEnd">缓慢后拉</button><button id="gamePoint">游戏过场</button><button id="orbitReset">还原机位</button><small id="stageMusicRead"></small>';
document.querySelector('.preview-column').append(strip);
strip.querySelector('#stageMusicRead').textContent=`完整音源保留 · 乐尾cue ${SHOT.musicEnd.toFixed(3)} 秒 · 后拉 ${SHOT.pullStart.toFixed(3)} 秒 · 定稿角色与原小号形变 · 待GPU验收`;
const stage=document.getElementById('stage'),caption=document.createElement('div'),handoff=document.createElement('button');
const openingNotice=document.createElement('div');openingNotice.className='stage-preflight';openingNotice.textContent='源码候选：S25开场待当前S24尾画；S26/27尚未动态验收。';stage.append(openingNotice);
caption.className='concert-caption';caption.hidden=true;caption.textContent='接下来，咱们通过几个小游戏，来回顾一下创作过程吧~';
handoff.className='game-handoff';handoff.textContent='开始小游戏';handoff.hidden=true;stage.append(caption,handoff);
handoff.onclick=()=>{stage.dispatchEvent(new CustomEvent('idea-first:game-handoff',{bubbles:true,detail:{source:'Dot-CDX-r05',time:editor.transport.time}}));handoff.textContent='准备进入游戏';};
const exportGain=Math.pow(10,(globalThis.DOT_STAGE_AUDIO_METADATA?.mixGainDB??-3)/20);
const impact=new Audio(window.DOT_IMPACT_AUDIO||'assets/finale_impact.m4a');impact.preload='auto';impact.volume=.78*exportGain;document.getElementById('audio').volume=exportGain;
let impactPending=false,impactDisposed=false;window.DOT_STAGE_AUX_AUDIO={pause({rewind=false}={}){impact.pause();if(rewind)impact.currentTime=0;},dispose(){if(impactDisposed)return;impactDisposed=true;impact.pause();impact.removeAttribute('src');impact.load();}};
window.DOT_3D_ORBIT={yaw:0,pitch:0};window.DOT_CONCERT_CUBE_ROTATION={};
window.DOT_CONCERT_UI_UPDATE=(time,concert)=>{
 const source=concert.openingSource;openingNotice.textContent=source?.placeholder?'独立预览 · S25开场占位，当前S24尾画待替换':source?.approved?'独立预览 · 本轮舞台与音乐尚待完整验收':'独立预览 · S25屏幕源为待审候选';
 caption.hidden=time<SHOT.speechStart||time>=SHOT.speechEnd;
 handoff.hidden=true;
 impact.volume=window.DOT_CONCERT_MUTE?0:.78*exportGain;
 const local=time-SHOT.impactStart,active=local>=0&&local<SHOT.impactDuration;
 if(!editor.transport.playing||!active){impact.pause();return;}
 if(Math.abs(impact.currentTime-local)>.12)impact.currentTime=local;
 if(!impactDisposed&&impact.paused&&!impactPending){impactPending=true;impact.play().catch(()=>{}).finally(()=>impactPending=false);}
};
const seek=async time=>{await editor.loadPreview();editor.seek(time);};
strip.querySelectorAll('[data-time]').forEach(button=>button.onclick=()=>seek(Number(button.dataset.time)).catch(e=>alert(e.message)));
strip.querySelector('#afterMusic').onclick=()=>seek(SHOT.musicEnd+.5).catch(e=>alert(e.message));
strip.querySelector('#pullEnd').onclick=()=>seek(SHOT.pullEnd).catch(e=>alert(e.message));
strip.querySelector('#gamePoint').onclick=()=>seek(SHOT.gameEnd).catch(e=>alert(e.message));
strip.querySelector('#concertPlay').onclick=async()=>{try{await editor.loadPreview();editor.seek(0);await editor.transport.play();}catch(e){alert(e.message);}};
strip.querySelector('#orbitReset').onclick=()=>{window.DOT_3D_ORBIT={yaw:0,pitch:0};if(editor.preview)if(editor.preview)editor.renderAt(editor.transport.time);};
let drag=false,lastX=0,lastY=0;
stage.addEventListener('pointerdown',event=>{if(!event.shiftKey||event.target.tagName!=='CANVAS')return;drag=true;lastX=event.clientX;lastY=event.clientY;stage.setPointerCapture(event.pointerId);});
stage.addEventListener('pointermove',event=>{if(!drag)return;const orbit=window.DOT_3D_ORBIT;orbit.yaw=Math.max(-1.2,Math.min(1.2,orbit.yaw+(event.clientX-lastX)*.005));orbit.pitch=Math.max(-.55,Math.min(.55,orbit.pitch+(event.clientY-lastY)*.005));lastX=event.clientX;lastY=event.clientY;editor.renderAt(editor.transport.time);});
stage.addEventListener('pointerup',()=>drag=false);stage.addEventListener('pointercancel',()=>drag=false);
window.addEventListener('pagehide',()=>window.DOT_STAGE_AUX_AUDIO?.dispose(),{once:true});

const reduceButton=document.createElement('button');reduceButton.textContent='减弱灯光';reduceButton.setAttribute('aria-pressed','false');strip.append(reduceButton);reduceButton.onclick=()=>{window.DOT_REDUCED_LIGHTING=!window.DOT_REDUCED_LIGHTING;reduceButton.setAttribute('aria-pressed',String(window.DOT_REDUCED_LIGHTING));if(editor.preview)editor.renderAt(editor.transport.time);};
