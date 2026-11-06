import test from 'node:test';
import assert from 'node:assert/strict';
import {bindAudioMix,createAudioMix} from '../src/audio-mix.mjs';

test('reduced settings bind and persist all audio channels without the retired authoring controls',t=>{
 class Control extends EventTarget{constructor(channel){super();this.dataset={audioChannel:channel,audioReadout:channel};this.attributes={};this.classList={toggle:(name,value)=>this[name]=value};}setAttribute(name,value){this.attributes[name]=value;}}
 const channels=['sfx','video','bgm'],sliders=channels.map(c=>new Control(c)),readouts=channels.map(c=>new Control(c)),mute=new Control();
 const original=Object.getOwnPropertyDescriptor(globalThis,'document');Object.defineProperty(globalThis,'document',{configurable:true,value:{querySelectorAll:selector=>selector==='[data-audio-channel]'?sliders:readouts,querySelector:selector=>{assert.equal(selector,'#video-mute','retired settings nodes must never be queried');return mute;}}});
 t.after(()=>original?Object.defineProperty(globalThis,'document',original):delete globalThis.document);
 const data=new Map(),mix=createAudioMix({storage:{getItem:key=>data.get(key),setItem:(key,value)=>data.set(key,value)}}),binding=bindAudioMix(mix);
 assert.deepEqual(sliders.map(s=>s.value),['100','15','6']);
 sliders[1].value='42';sliders[1].dispatchEvent(new Event('input'));assert.equal(mix.snapshot().video,.42);assert.equal(readouts[1].textContent,'42%');
 mute.dispatchEvent(new Event('click'));assert.equal(mix.snapshot().video,0);assert.equal(mute.attributes['aria-pressed'],'true');
 mute.dispatchEvent(new Event('click'));assert.equal(mix.snapshot().video,.42);binding.dispose();
});
