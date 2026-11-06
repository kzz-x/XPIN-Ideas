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

function harness({phase = 'loading', beforeDOM = false} = {}) {
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
