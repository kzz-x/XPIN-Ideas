(function (global) {
  'use strict';
  var doc = global.document;
  if (!doc || global.bootGuard) return;

  var state = 'loading';
  var message = '';
  var timer = null;
  var observer = null;
  var retryButton = null;
  var initialThree = null;
  try { initialThree = global.__THREE__ == null ? null : global.__THREE__; } catch (_) {}

  function sensitiveParameter(name) {
    return /token|password|passwd|pwd|secret|authorization|credential|api[_-]?key|access[_-]?key|auth[_-]?key|signature|session|^(?:code|key|auth|sig)$/i.test(name);
  }

  function moduleURL(value) {
    var raw = String(value || '');
    if (!raw) return '';
    if (/^(?:data|blob):/i.test(raw)) return '临时脚本';
    try {
      var url = new global.URL(raw, global.location.href);
      url.username = ''; url.password = ''; url.hash = '';
      Array.from(url.searchParams.keys()).forEach(function (name) {
        if (sensitiveParameter(name)) url.searchParams.set(name, '[已隐藏]');
      });
      return url.href;
    } catch (_) {
      raw = raw.split('#')[0].replace(/^(https?:\/\/)[^/@\s]+@/i, '$1');
      var question = raw.indexOf('?');
      if (question < 0) return raw;
      return raw.slice(0, question + 1) + raw.slice(question + 1).split('&').map(function (pair) {
        var equal = pair.indexOf('='), name = equal < 0 ? pair : pair.slice(0, equal);
        try { name = decodeURIComponent(name.replace(/\+/g, ' ')); } catch (_) {}
        return sensitiveParameter(name) ? (equal < 0 ? pair : pair.slice(0, equal)) + '=%5B%E5%B7%B2%E9%9A%90%E8%97%8F%5D' : pair;
      }).join('&');
    }
  }

  function moduleSources() {
    var scripts = [], preloads = [], imports = {};
    var scriptNodes = doc.scripts || (doc.getElementsByTagName ? doc.getElementsByTagName('script') : []);
    for (var i = 0; i < scriptNodes.length; i++) {
      var script = scriptNodes[i], type = String(script.type || '');
      if (script.src) scripts.push({type: type, src: moduleURL(script.src)});
      if (type.toLowerCase() !== 'importmap') continue;
      try {
        var map = JSON.parse(script.textContent || script.innerHTML || '{}').imports || {};
        Object.keys(map).forEach(function (name) {
          if (typeof map[name] !== 'string') return;
          Object.defineProperty(imports, name, {value: moduleURL(map[name]), enumerable: true, writable: true, configurable: true});
        });
      } catch (_) {}
    }
    var links = doc.querySelectorAll ? doc.querySelectorAll('link[rel~="modulepreload"]') : doc.getElementsByTagName ? doc.getElementsByTagName('link') : [];
    for (var j = 0; j < links.length; j++) {
      var link = links[j];
      if (link.href && /(?:^|\s)modulepreload(?:\s|$)/i.test(link.rel || '')) preloads.push({href: moduleURL(link.href)});
    }
    return {scripts: scripts, modulepreloads: preloads, imports: imports};
  }

  function sourceName(value) {
    if (!value) return '';
    try {
      var url = new global.URL(String(value), global.location.href);
      if (url.protocol === 'data:' || url.protocol === 'blob:') return '临时脚本';
      return url.pathname;
    } catch (_) {
      return String(value).split(/[?#]/)[0].replace(/[^/\s]*:[^/@\s]*@/g, '');
    }
  }

  function detail(value) {
    var text = typeof value === 'string' ? value : '';
    text = text.replace(/\b(?:https?|file|blob|data):[^\s"'<>]+|\/\/[^\s"'<>]+/gi, sourceName);
    text = text.replace(/([^\s"'<>?#]+)[?#][^\s"'<>]*/g, '$1');
    text = text.replace(/\b(password|passwd|pwd|token|access_token|api_key|apikey|secret|authorization|credentials?)\s*[:=]\s*[^\s,;]+/gi, '$1=[已隐藏]');
    text = text.replace(/[\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim();
    return text.length > 220 ? text.slice(0, 219) + '…' : text;
  }

  function retry() {
    if (loading()) global.location.reload();
  }

  function bindRetry() {
    var button = doc.getElementById('boot-retry');
    if (!button || button === retryButton) return;
    if (retryButton) retryButton.removeEventListener('click', retry);
    retryButton = button;
    retryButton.addEventListener('click', retry);
  }

  function paint() {
    if (state === 'complete') return;
    bindRetry();
    var label = doc.getElementById('loading-status');
    if (label && message) label.textContent = message;
    if (retryButton && message) retryButton.hidden = false;
  }

  function complete() {
    if (state === 'complete') return;
    state = 'complete';
    if (timer !== null) global.clearTimeout(timer);
    timer = null;
    if (observer) observer.disconnect();
    global.removeEventListener('error', onError, true);
    global.removeEventListener('unhandledrejection', onRejection);
    doc.removeEventListener('DOMContentLoaded', onReady);
    if (retryButton) {
      retryButton.hidden = true;
      retryButton.removeEventListener('click', retry);
      retryButton = null;
    }
  }

  function loading() {
    if (state === 'complete') return false;
    var phase = doc.body && doc.body.dataset && doc.body.dataset.phase;
    if (phase && phase !== 'loading') {
      complete();
      return false;
    }
    return true;
  }

  function fail(summary, reason) {
    if (!loading() || state === 'error') return;
    state = 'error';
    if (timer !== null) global.clearTimeout(timer);
    timer = null;
    var extra = detail(reason);
    message = summary + (extra ? '（' + extra + '）' : '') + '。请检查网络后重试。';
    paint();
  }

  function onError(event) {
    if (!loading()) return;
    var target = event.target;
    if (target && target !== global) {
      var tag = String(target.tagName || '').toUpperCase();
      var moduleLink = tag === 'LINK' && /(?:^|\s)modulepreload(?:\s|$)/i.test(target.rel || '');
      if (tag !== 'SCRIPT' && !moduleLink) return;
      fail('启动文件加载失败', sourceName(target.src || target.href));
      return;
    }
    var reason = event.message || (event.error && event.error.message) || '未提供错误详情';
    var file = sourceName(event.filename);
    fail('画面启动遇到错误', reason + (file ? ' · ' + file : ''));
  }

  function onRejection(event) {
    var reason = event.reason;
    fail('画面启动未能完成', typeof reason === 'string' ? reason : reason && typeof reason.message === 'string' ? reason.message : '未提供错误详情');
  }

  function onReady() {
    if (loading()) paint();
  }

  global.bootGuard = {initialThree: initialThree, moduleSources: moduleSources, complete: complete, fail: function (reason) {
    fail('画面启动未能完成', typeof reason === 'string' ? reason : reason && typeof reason.message === 'string' ? reason.message : '未提供错误详情');
  }};
  if (!loading()) return;
  global.addEventListener('error', onError, true);
  global.addEventListener('unhandledrejection', onRejection);
  doc.addEventListener('DOMContentLoaded', onReady);
  paint();
  if (global.MutationObserver && doc.documentElement) {
    observer = new global.MutationObserver(function () { loading(); });
    observer.observe(doc.documentElement, {attributes: true, subtree: true, attributeFilter: ['data-phase']});
  }
  timer = global.setTimeout(function () {
    timer = null;
    if (!loading() || state === 'error') return;
    state = 'slow';
    message = '画面准备比平时稍慢，可以继续等待，或点击重试。';
    paint();
  }, 60000);
})(typeof window !== 'undefined' ? window : globalThis);
