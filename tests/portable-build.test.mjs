import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {portablePath,portableText} from '../portable-build.mjs';

const version='abcdef012345';
const htmlSource=`<html lang="zh-CN"><script type="importmap">{"imports":{"three":"./assets/dot/model/frozen/r07d/editable-stage/素材/v011/DotSharedWeb/vendor/three.module.js","three/addons/":"./assets/vendor/addons/"}}</script><link rel="modulepreload" href="./src/main.mjs"><script type="module" src="./src/main.mjs"></script></html>`;
const transformedHTML=()=>portableText(htmlSource,{extension:'.html',version});
const importMap=html=>JSON.parse(html.match(/<script type="importmap">([\s\S]*?)<\/script>/)[1]).imports;

test('portable entry, modulepreload and exact Three mapping use the same release while addon directory remains a valid prefix',()=>{
  const html=transformedHTML(),map=importMap(html);
  assert.equal(map.three,'./assets/dot/model/frozen/r07d/editable-stage/resources/v011/DotSharedWeb/vendor/three.module.js?v='+version);
  assert.equal(map['three/addons/'],'./assets/vendor/addons/');
  assert.ok(html.includes('href="./src/main.js?v='+version+'"'));
  assert.ok(html.includes('src="./src/main.js?v='+version+'"'));
  assert.ok(html.includes('data-release="'+version+'"'));
});

test('bare Three, relative direct Three and importmap aliases resolve to one module identity',()=>{
  const origin='https://example.test/demo/';
  const app=portableText(`import * as T from 'three'; import {CSS3DObject} from 'three/addons/renderers/CSS3DRenderer.js'; const next=()=>import('./next.mjs');`,{extension:'.mjs',version});
  assert.ok(app.includes("from 'three'"));
  assert.ok(app.includes("from 'three/addons/renderers/CSS3DRenderer.js?v="+version+"'"));
  assert.ok(app.includes("import('./next.js?v="+version+"')"));
  const component=portableText(`import * as T from './vendor/three.module.js';`,{extension:'.mjs',version});
  const direct=component.match(/from '([^']+)'/)[1];
  const componentURL=new URL(portablePath('assets/dot/model/frozen/r07d/editable-stage/素材/v011/DotSharedWeb/dot-component.mjs')+'?v='+version,origin);
  assert.equal(new URL(direct,componentURL).href,new URL(importMap(transformedHTML()).three,origin).href);
});

test('moving a folder segment keeps relative import.meta asset resolution at the same depth',()=>{
  const origin='https://example.test/nested/site/';
  const modulePath='assets/dot/model/frozen/r07d/editable-stage/素材/v011/DotSharedWeb/dot-component.mjs';
  const relative='./assets/dot-character.glb';
  const before=new URL(relative,new URL(modulePath,origin));
  const after=new URL(relative,new URL(portablePath(modulePath)+'?v='+version,origin));
  assert.equal(decodeURI(after.pathname),portablePath(decodeURI(before.pathname)));
  const source=`const asset=new URL('./assets/dot-character.glb',import.meta.url);`;
  assert.equal(portableText(source,{extension:'.mjs',version}),source);
});

test('portable text preserves complete authored chapter copy and card media layout',async()=>{
  const source=await fs.readFile(new URL('../src/content.mjs',import.meta.url),'utf8');
  const text=portableText(source,{extension:'.mjs',version});
  const before=await import(new URL('../src/content.mjs',import.meta.url));
  const after=await import('data:text/javascript;base64,'+Buffer.from(text).toString('base64'));
  assert.deepEqual(after.CHAPTERS.flatMap(c=>[c.title,...c.cards.flatMap(card=>[card.title,...card.body])]),before.CHAPTERS.flatMap(c=>[c.title,...c.cards.flatMap(card=>[card.title,...card.body])]));
  assert.deepEqual(after.RESOURCES,before.RESOURCES);
  assert.deepEqual(after.CHAPTERS.flatMap(c=>c.cards.map(card=>card.media.map(m=>({kind:m.kind,caption:m.caption,after:m.after})))),before.CHAPTERS.flatMap(c=>c.cards.map(card=>card.media.map(m=>({kind:m.kind,caption:m.caption,after:m.after})))));
});
