const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

export function mediaFigure(item, index) {
  const caption = escape(item.caption);
  let content;
  if (item.kind === 'video') {
    content = `<video controls playsinline preload="none" poster="${escape(item.poster)}" data-media-src="${escape(item.src)}" aria-label="${caption}"></video>`;
  } else if (item.kind === 'interactive') {
    content = `<div class="interactive-preview"><img src="${escape(item.poster)}" alt="${caption}"><button type="button" data-interactive-src="${escape(item.src)}">打开动作原型 ↗</button></div>`;
  } else {
    content = `<img src="${escape(item.src)}" alt="${caption}" ${index ? 'loading="lazy"' : ''} decoding="async">`;
  }
  return `<figure class="editorial-media media-${escape(item.kind || 'image')}" data-media-index="${index}">${content}<figcaption>${caption}</figcaption></figure>`;
}

export function cardDetailHTML(card) {
  const media = card.media || [{src:card.image, caption:card.title, after:0}];
  const at = position => media.map((item, index) => item.after === position ? mediaFigure(item, index) : '').join('');
  const paragraphs = (card.body || []).map((text, index) => `${/^\[.*占位：/.test(text) ? '' : `<p>${escape(text)}</p>`}${at(index + 1)}`).join('');
  return `<div class="detail-label">${escape(card.label || card.subtitle)}</div><h2>${escape(card.title)}</h2>${at(0)}${paragraphs}`;
}

export function prepareCardMedia(element) {
  for (const video of element.querySelectorAll('video[data-media-src]')) {
    if (!video.hasAttribute('src')) video.src = video.dataset.mediaSrc;
  }
}

export function stopCardMedia(element) {
  element?.querySelectorAll('video').forEach(video => video.pause());
  element?.querySelectorAll('.interactive-preview iframe').forEach(frame => {
    frame.remove();
  });
}

export function bindCardMedia(element) {
  element.querySelectorAll('[data-interactive-src]').forEach(button => button.addEventListener('click', event => {
    event.stopPropagation();
    const host = button.parentElement;
    if (host.querySelector('iframe')) return;
    const frame = document.createElement('iframe');
    frame.src = button.dataset.interactiveSrc;
    frame.title = 'Dot 球体动作原型';
    frame.setAttribute('sandbox', 'allow-scripts');
    frame.setAttribute('loading', 'lazy');
    host.append(frame);
  }));
}
