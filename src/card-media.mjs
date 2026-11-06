const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const observers = new WeakMap();
const dimensions = item => item.width && item.height ? ` width="${item.width}" height="${item.height}"` : '';

export function mediaFigure(item, index) {
  const caption = escape(item.caption);
  let content;
  if (item.kind === 'video') {
    content = `<video controls playsinline preload="none"${dimensions(item)} data-media-poster="${escape(item.poster)}" data-media-src="${escape(item.src)}" aria-label="${caption}"></video>`;
  } else {
    content = `<img data-media-src="${escape(item.src)}"${dimensions(item)} alt="${caption}" decoding="async">`;
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
  observers.get(element)?.disconnect();
  const detail = element.querySelector('.card-detail');
  const activate = node => {
    if (node.dataset.mediaPoster) node.poster = node.dataset.mediaPoster;
    if (node.dataset.mediaSrc && !node.hasAttribute('src')) node.src = node.dataset.mediaSrc;
  };
  const pending = [...detail.querySelectorAll('img[data-media-src],video[data-media-src]')];
  if (typeof IntersectionObserver === 'undefined') { pending.forEach(activate); return; }
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      activate(entry.target);
      observer.unobserve(entry.target);
    });
  }, {root:detail,rootMargin:'240px 0px'});
  pending.forEach(node => observer.observe(node));
  observers.set(element, observer);
}

export function stopCardMedia(element) {
  if (!element) return;
  observers.get(element)?.disconnect();
  observers.delete(element);
  element.querySelectorAll('video').forEach(video => {
    if (!video.hasAttribute('src')) return;
    video.dataset.resumeTime = String(video.currentTime || 0);
    video.pause();
    video.removeAttribute('src');
    video.load();
  });
  element.querySelectorAll('img[data-media-src]').forEach(img => img.removeAttribute('src'));
}

export function bindCardMedia(element) {
  element.querySelectorAll('video').forEach(video => video.addEventListener('loadedmetadata', () => {
    const at = Number(video.dataset.resumeTime || 0);
    if (at > 0 && at < video.duration - .1) video.currentTime = at;
  }));
}
