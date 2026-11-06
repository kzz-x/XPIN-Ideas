const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

export function resourceDetailHTML(resource){
  const url=new URL(resource.href);
  if(url.protocol!=='https:')throw Error('Resource links must use HTTPS');
  const title=escape(resource.title),href=escape(url.href);
  const link=()=>`<a class="resource-link" href="${href}" target="_blank" rel="noopener noreferrer" aria-label="点击访问${title}（飞书，新标签页）"><span>点击访问 · ${title}</span><span aria-hidden="true">↗</span></a>`;
  return `<div class="card-detail" style="display:block"><div class="detail-label">RESOURCE / 资源档案</div><h2>${title}</h2>${link()}<p class="resource-link-note">飞书资源文件夹 · 点击在新页面访问</p><p>${escape(resource.description)}</p>${(resource.body||[]).map(text=>`<p>${escape(text)}</p>`).join('')}${resource.body?.length>=3?link():''}</div>`;
}
