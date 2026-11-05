import test from 'node:test';
import assert from 'node:assert/strict';
import {createAudioMix,AUDIO_MIX_STORAGE,VIDEO_DEFAULT_REVISION} from '../src/audio-mix.mjs';
test('video migrates once to 15 percent while independently adjusted effects and music survive',()=>{
 const map=new Map([[AUDIO_MIX_STORAGE,JSON.stringify({sfx:.72,video:.12,bgm:.035})]]),storage={getItem:k=>map.get(k),setItem:(k,v)=>map.set(k,v)};
 const mix=createAudioMix({storage});assert.deepEqual(mix.snapshot(),{sfx:.72,video:.15,bgm:.035});assert.equal(map.get(VIDEO_DEFAULT_REVISION),'15');
 mix.set('video',.22);assert.deepEqual(createAudioMix({storage}).snapshot(),{sfx:.72,video:.22,bgm:.035});
});
test('a read-only browser store still applies the new video default without breaking the other channels',()=>{
 const storage={getItem:k=>k===AUDIO_MIX_STORAGE?JSON.stringify({sfx:.8,video:.25,bgm:.02}):null,setItem(){throw Error('Read only');}};
 assert.deepEqual(createAudioMix({storage}).snapshot(),{sfx:.8,video:.15,bgm:.02});
});
