// The approved balance; r23 applies the revised video default once.
export const AUDIO_MIX_DEFAULTS=Object.freeze({sfx:1,video:.15,bgm:.06});
export const AUDIO_MIX_STORAGE='linggan-audio-mix-r15';
export const VIDEO_DEFAULT_REVISION='linggan-video-default-r23';
export function normalizeAudioMix(value={}){
 return Object.fromEntries(Object.entries(AUDIO_MIX_DEFAULTS).map(([key,fallback])=>[key,Number.isFinite(Number(value[key]))?Math.max(0,Math.min(1,Number(value[key]))):fallback]));
}
export function createAudioMix({storage=globalThis.localStorage}={}){
 let current={...AUDIO_MIX_DEFAULTS};try{const saved=JSON.parse(storage?.getItem(AUDIO_MIX_STORAGE)||'null');if(saved)current=normalizeAudioMix(saved);}catch{}
 // Apply the new video default once, keeping the two independently tuned channels.
 try{if(storage?.getItem(VIDEO_DEFAULT_REVISION)!=='15'){current.video=AUDIO_MIX_DEFAULTS.video;storage?.setItem(AUDIO_MIX_STORAGE,JSON.stringify(current));storage?.setItem(VIDEO_DEFAULT_REVISION,'15');}}catch{current.video=AUDIO_MIX_DEFAULTS.video;}
 const listeners=new Set();
 const snapshot=()=>({...current});
 return{snapshot,set(key,value){if(!(key in AUDIO_MIX_DEFAULTS))throw Error('Unknown audio channel');current=normalizeAudioMix({...current,[key]:value});try{storage?.setItem(AUDIO_MIX_STORAGE,JSON.stringify(current));}catch{}for(const fn of listeners)fn(snapshot());return snapshot();},
  subscribe(fn){listeners.add(fn);return()=>listeners.delete(fn);},
  describe(){const v=snapshot();return `音效 ${Math.round(v.sfx*100)}% / 视频 ${Math.round(v.video*100)}% / 网页BGM ${Math.round(v.bgm*100)}%`;}
 };
}
export function bindAudioMix(mix){
 const controller=new AbortController(),options={signal:controller.signal};let previousVideo=mix.snapshot().video||AUDIO_MIX_DEFAULTS.video;
 const sliders=[...document.querySelectorAll('[data-audio-channel]')];
 function paint(){const value=mix.snapshot();if(value.video>0)previousVideo=value.video;for(const input of sliders){const n=Math.round(value[input.dataset.audioChannel]*100);input.value=String(n);input.setAttribute('aria-valuetext',n+'%');}for(const o of document.querySelectorAll('[data-audio-readout]'))o.textContent=Math.round(value[o.dataset.audioReadout]*100)+'%';const button=document.querySelector('#video-mute');button.classList.toggle('is-muted',value.video===0);button.setAttribute('aria-pressed',String(value.video===0));button.setAttribute('aria-label',value.video===0?'取消影片静音':'静音影片');button.title='影片音量 '+Math.round(value.video*100)+'%';}
 for(const input of sliders)input.addEventListener('input',()=>mix.set(input.dataset.audioChannel,Number(input.value)/100),options);
 document.querySelector('#video-mute').addEventListener('click',()=>mix.set('video',mix.snapshot().video>0?0:previousVideo),options);
 const unsubscribe=mix.subscribe(paint);paint();return{paint,dispose(){controller.abort();unsubscribe();}};
}
