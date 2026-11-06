import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const script = fs.readFileSync(new URL('../src/boot-guard.js', import.meta.url), 'utf8');

function eventTarget() {
  const listeners = new Map();
  return {
    listeners,
    addEventListener(type, listener, capture = false) {
      const entries = listeners.get(type) || [];
      entries.push({listener, capture});
      listeners.set(type, entries);
    },
    removeEventListener(type, listener) {
      listeners.set(type, (listeners.get(type) || []).filter(entry => entry.listener !== listener));
    },
    dispatch(type, value = {}) {
      const event = {target: this, ...value};
      for (const {listener} of [...(listeners.get(type) || [])]) listener(event);
    }
  };
}

function harness({phase = 'loading', beforeDOM = false, initialThree, scripts, links} = {}) {
  const status = {textContent: '正在准备画面'};
  const retry = {...eventTarget(), hidden: true};
  const elements = new Map(beforeDOM ? [] : [['loading-status', status], ['boot-retry', retry]]);
  const body = {dataset: {phase}};
  const doc = {...eventTarget(), body: beforeDOM ? null : body, documentElement: {}, getElementById: id => elements.get(id) || null};
  const timers = new Map(), observers = [];
  let nextID = 0, now = 0, reloads = 0;
  const global = {
    ...eventTarget(), document: doc, URL,
    location: {href: 'https://example.com/site/', reload() { reloads++; }},
    setTimeout(callback, wait) { const id = ++nextID; timers.set(id, {callback, at: now + wait}); return id; },
    clearTimeout(id) { timers.delete(id); },
    MutationObserver: class {
      constructor(callback) { this.callback = callback; this.active = false; observers.push(this); }
      observe() { this.active = true; }
      disconnect() { this.active = false; }
    }
  };
  if (initialThree !== undefined) global.__THREE__ = initialThree;
  if (scripts) doc.scripts = scripts;
  if (links) doc.querySelectorAll = selector => selector === 'link[rel~="modulepreload"]' ? links : [];
  vm.runInNewContext(script, {window: global, globalThis: global});
  return {
    global, doc, status, retry, timers, observers,
    get reloads() { return reloads; },
    advance(ms) {
      now += ms;
      for (const [id, {callback, at}] of [...timers]) if (at <= now && timers.delete(id)) callback();
    },
    phase(value) {
      body.dataset.phase = value;
      for (const observer of observers) if (observer.active) observer.callback([{attributeName: 'data-phase'}]);
    },
    domReady() {
      doc.body = body;
      elements.set('loading-status', status);
      elements.set('boot-retry', retry);
      doc.dispatch('DOMContentLoaded');
    }
  };
}

test('handled initialization failures show retry immediately and cancel the slow-loading timer', () => {
  const h = harness();
  h.global.bootGuard.fail(new Error('字体 404'));
  assert.match(h.status.textContent, /画面启动未能完成.*字体 404/);
  assert.equal(h.retry.hidden, false);
  assert.equal(h.timers.size, 0);
});

test('classic guard captures failed module scripts and shows the filename without URL secrets', () => {
  const h = harness();
  assert.equal(h.global.listeners.get('error')[0].capture, true);
  let prevented = false;
  h.global.dispatch('error', {target: {tagName: 'SCRIPT', src: 'https://user:secret@cdn.example/src/main.mjs?token=private#fragment'}, preventDefault() { prevented = true; }});
  assert.match(h.status.textContent, /启动文件加载失败.*\/src\/main\.mjs/);
  assert.doesNotMatch(h.status.textContent, /user|secret|cdn\.example|private|fragment|\?/);
  assert.equal(prevented, false);
  assert.equal(h.retry.hidden, false);
  assert.equal(h.timers.size, 0);
  h.retry.dispatch('click');
  assert.equal(h.reloads, 1);
});

test('modulepreload failures are captured while unrelated image failures do not interrupt preparation', () => {
  const h = harness();
  h.global.dispatch('error', {target: {tagName: 'IMG', src: '/optional-image.jpg'}});
  assert.equal(h.status.textContent, '正在准备画面');
  assert.equal(h.retry.hidden, true);
  h.global.dispatch('error', {target: {tagName: 'LINK', rel: 'modulepreload', href: '/src/frame-loop.mjs?version=private'}});
  assert.match(h.status.textContent, /frame-loop\.mjs/);
  assert.doesNotMatch(h.status.textContent, /private/);
});

test('runtime errors and unhandled rejections produce bounded details without suppressing browser diagnostics', () => {
  const runtime = harness();
  runtime.global.dispatch('error', {message: 'Unexpected token', filename: 'https://example.com/src/main.mjs?key=private'});
  assert.match(runtime.status.textContent, /画面启动遇到错误.*Unexpected token.*main\.mjs/);
  assert.doesNotMatch(runtime.status.textContent, /private/);
  const rejection = harness();
  let prevented = false;
  rejection.global.dispatch('unhandledrejection', {reason: new Error('Failed https://reader:private@host/module.mjs?token=hidden password=private ' + 'x'.repeat(500)), preventDefault() { prevented = true; }});
  assert.match(rejection.status.textContent, /画面启动未能完成.*module\.mjs/);
  assert.doesNotMatch(rejection.status.textContent, /reader|private|hidden|token=/);
  assert.ok(rejection.status.textContent.length < 270);
  assert.equal(prevented, false);
  assert.equal(rejection.retry.hidden, false);
});

test('60 seconds offers waiting or retry without falsely reporting failure, and later errors remain visible', () => {
  const h = harness();
  h.advance(59999);
  assert.equal(h.status.textContent, '正在准备画面');
  h.advance(1);
  assert.match(h.status.textContent, /可以继续等待.*重试/);
  assert.doesNotMatch(h.status.textContent, /失败|错误|未能/);
  assert.equal(h.retry.hidden, false);
  h.global.dispatch('error', {message: 'WebGL context unavailable'});
  assert.match(h.status.textContent, /画面启动遇到错误.*WebGL context unavailable/);
});

test('complete cancels the timeout and listeners, and ignores errors after startup', () => {
  const h = harness();
  h.advance(60000);
  h.global.bootGuard.complete();
  const message = h.status.textContent;
  h.global.bootGuard.complete();
  h.global.dispatch('error', {message: 'A later card failed'});
  h.global.dispatch('unhandledrejection', {reason: 'Later video failed'});
  h.advance(60000);
  assert.equal(h.status.textContent, message);
  assert.equal(h.retry.hidden, true);
  assert.equal(h.timers.size, 0);
  assert.equal(h.global.listeners.get('error').length, 0);
  assert.equal(h.global.listeners.get('unhandledrejection').length, 0);
  assert.equal(h.observers[0].active, false);
  h.retry.dispatch('click');
  assert.equal(h.reloads, 0);
});

test('leaving the loading phase completes the guard automatically and cancels its timeout', () => {
  const h = harness();
  h.phase('intro');
  h.advance(60000);
  h.global.dispatch('error', {message: 'Not a boot error'});
  assert.equal(h.status.textContent, '正在准备画面');
  assert.equal(h.retry.hidden, true);
  assert.equal(h.timers.size, 0);
  assert.equal(h.observers[0].active, false);
});

test('errors before DOM readiness are retained and displayed when the loading UI is available', () => {
  const h = harness({beforeDOM: true});
  h.global.dispatch('error', {target: {tagName: 'SCRIPT', src: '/src/main.mjs'}});
  h.domReady();
  h.domReady();
  assert.match(h.status.textContent, /启动文件加载失败.*main\.mjs/);
  assert.equal(h.retry.hidden, false);
  assert.equal(h.retry.listeners.get('click').length, 1);
  h.retry.dispatch('click');
  assert.equal(h.reloads, 1);
});

test('a guard loaded after startup does not install timers or intercept later errors', () => {
  const h = harness({phase: 'intro'});
  assert.equal(h.timers.size, 0);
  assert.equal(h.global.listeners.size, 2);
  assert.equal(h.global.listeners.get('error').length, 0);
  assert.equal(h.global.listeners.get('unhandledrejection').length, 0);
  h.global.dispatch('error', {message: 'Not a boot error'});
  assert.equal(h.retry.hidden, true);
});

test('initial Three registration is captured without changing or creating the global marker', () => {
  const existing = harness({initialThree: '186'});
  assert.equal(existing.global.bootGuard.initialThree, '186');
  assert.equal(existing.global.__THREE__, '186');
  existing.global.__THREE__ = 'later-registration';
  assert.equal(existing.global.bootGuard.initialThree, '186');
  const absent = harness();
  assert.equal(absent.global.bootGuard.initialThree, null);
  assert.equal(Object.hasOwn(absent.global, '__THREE__'), false);
});

test('module sources keep full release identities while removing URL credentials and sensitive query values', () => {
  const scripts = [
    {type: '', src: 'https://user:private@example.com/site/boot-guard.js?v=release30&token=hidden'},
    {type: 'module', src: './src/main.js?v=release30&theme=blue'},
    {type: 'importmap', textContent: JSON.stringify({imports: {three: './assets/three.module.js?v=release30&api_key=private', 'three/addons/': './assets/addons/'}})}
  ];
  const links = [{rel: 'modulepreload', href: './assets/three.core.js?v=release30&signature=private'}, {rel: 'stylesheet', href: './style.css'}];
  const h = harness({scripts, links}), sources = h.global.bootGuard.moduleSources();
  assert.equal(sources.scripts.length, 2);
  assert.equal(new URL(sources.scripts[0].src).searchParams.get('v'), 'release30');
  assert.equal(new URL(sources.scripts[0].src).searchParams.get('token'), '[已隐藏]');
  assert.equal(new URL(sources.scripts[0].src).username, '');
  assert.equal(new URL(sources.scripts[0].src).password, '');
  assert.equal(sources.scripts[1].src, 'https://example.com/site/src/main.js?v=release30&theme=blue');
  assert.equal(new URL(sources.imports.three).searchParams.get('api_key'), '[已隐藏]');
  assert.equal(sources.imports['three/addons/'], 'https://example.com/site/assets/addons/');
  assert.equal(sources.modulepreloads.length, 1);
  assert.equal(new URL(sources.modulepreloads[0].href).searchParams.get('signature'), '[已隐藏]');
  assert.doesNotMatch(JSON.stringify(sources), /private|hidden|user:/);
});

test('module snapshots are fresh objects and never mutate document nodes, import maps or the Three marker', () => {
  const scripts = [{type: 'module', src: './main.js?v=r30'}, {type: 'importmap', textContent: '{"imports":{"three":"./three.js?v=r30"}}'}];
  const links = [{rel: 'modulepreload', href: './core.js?v=r30'}], before = JSON.stringify({scripts, links});
  const h = harness({initialThree: '186', scripts, links}), first = h.global.bootGuard.moduleSources();
  first.scripts[0].src = 'mutated'; first.modulepreloads[0].href = 'mutated'; first.imports.three = 'mutated';
  const next = h.global.bootGuard.moduleSources();
  assert.equal(next.scripts[0].src, 'https://example.com/site/main.js?v=r30');
  assert.equal(next.modulepreloads[0].href, 'https://example.com/site/core.js?v=r30');
  assert.equal(next.imports.three, 'https://example.com/site/three.js?v=r30');
  assert.equal(JSON.stringify({scripts, links}), before);
  assert.equal(h.global.__THREE__, '186');
});

test('module diagnostics tolerate missing DOM collection APIs and malformed import maps', () => {
  const minimal = harness();
  assert.equal(JSON.stringify(minimal.global.bootGuard.moduleSources()), '{"scripts":[],"modulepreloads":[],"imports":{}}');
  const broken = harness({scripts: [{type: 'importmap', textContent: 'not json'}, {type: 'module', src: './main.js?v=r30'}]});
  assert.equal(broken.global.bootGuard.moduleSources().scripts.length, 1);
  assert.equal(JSON.stringify(broken.global.bootGuard.moduleSources().imports), '{}');
  broken.global.bootGuard.fail('font failed');
  assert.match(broken.status.textContent, /font failed/);
});
