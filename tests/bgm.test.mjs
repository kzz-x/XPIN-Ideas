import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {nextMusicalExit} from '../src/bgm.mjs';
const meta=JSON.parse(readFileSync(new URL('../assets/media/bgm/tank-b-loop.json',import.meta.url))),intro=meta.intro.duration_seconds,loop=meta.loop.duration_seconds,gates=meta.estimated_phrase_exit_gates.map(g=>g.seconds);
test('completion always chooses a future authored exit with scheduling guard',()=>{
  for(let ms=0;ms<Math.ceil((intro+loop*3)*1000);ms++){
    const t=ms/1000,next=nextMusicalExit(t,intro,loop,gates);
    assert.ok(next>=t+.08-1e-8);assert.ok(next-t<7.01);
    if(next>intro+1e-6){const phase=(next-intro)%loop;assert.ok(gates.some(g=>Math.abs(g-phase)<1e-6)||phase<1e-6);}
  }
});
test('completion near a loop end crosses into the next loop, never hard cuts',()=>{
  const elapsed=intro+loop-.03,exit=nextMusicalExit(elapsed,intro,loop,gates);
  assert.ok(Math.abs(exit-(intro+loop+gates[0]))<1e-8);
});
test('source uses exact supplied integer sample ranges',()=>{
  assert.equal(meta.sample_rate,48000);assert.equal(meta.loop.frames,2618947);assert.equal(meta.intro.frames,778108);assert.equal(meta.outro.frames,898954);
  assert.equal(meta.loop.duration_seconds*meta.sample_rate,meta.loop.frames);
});
