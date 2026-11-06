export function deploymentCheck({version,files}){
 const inventory=JSON.stringify(files.map(({path,bytes})=>({path,bytes}))).replaceAll('<','\\u003c');
 return {
  html:`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>灵感先行 · 部署检查</title><style>body{max-width:1000px;margin:48px auto;padding:0 20px;background:#111820;color:#e6edf5;font:15px/1.7 system-ui,sans-serif}button{padding:10px 16px;margin:0 10px 14px 0;cursor:pointer}table{width:100%;border-collapse:collapse}td,th{text-align:left;border-bottom:1px solid #344454;padding:7px;overflow-wrap:anywhere}td:first-child{width:100px}.failed{color:#ff9e9e}.ok{color:#9fe5bb}#summary{white-space:pre-wrap}a{color:#9ac8ff}</style><h1>部署资源检查</h1><p>版本 ${version}。此页只检查当前站点的文件，不修改网站或上传任何内容。</p><button id="run">检查全部运行文件</button><button id="copy" disabled>复制检查结果</button><a href="./">返回网站</a><p id="summary" role="status">点击开始，将检查 ${files.length} 个文件的 HTTP 状态与长度。</p><table><thead><tr><th>结果</th><th>文件</th><th>详情</th></tr></thead><tbody id="results"></tbody></table><script src="./deployment-check.js?v=${version}"></script></html>`,
  js:`'use strict';
const release=${JSON.stringify(version)},files=${inventory};
const summary=document.getElementById('summary'),rows=document.getElementById('results'),run=document.getElementById('run'),copy=document.getElementById('copy');
let report=null;
run.addEventListener('click',async()=>{
 run.disabled=true;copy.disabled=true;rows.replaceChildren();const results=[];let cursor=0;
 const check=async()=>{while(cursor<files.length){const item=files[cursor++],url=new URL(item.path,location.href);url.searchParams.set('v',release);let result={path:item.path,expectedBytes:item.bytes};const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),20000);
  try{const response=await fetch(url,{method:'HEAD',cache:'no-store',signal:controller.signal});const length=response.headers.get('content-length'),type=response.headers.get('content-type')||'';result={...result,status:response.status,type,reportedBytes:length===null?null:Number(length)};result.ok=response.ok&&(!item.path.endsWith('.js')||/javascript/.test(type))&&(!type.toLowerCase().includes('text/html')||item.path.endsWith('.html'));result.detail=!response.ok?'HTTP '+response.status:!result.ok?'文件类型错误：'+type:length!==null&&Number(length)!==item.bytes?'长度不同（服务器可能压缩），需核对':'可访问';}
  catch(error){result={...result,ok:false,status:0,detail:error.name==='AbortError'?'请求超时':error.message};}finally{clearTimeout(timer);}
  results.push(result);const tr=document.createElement('tr');tr.className=result.ok?'ok':'failed';for(const text of [result.ok?'通过':'失败',item.path,result.detail]){const td=document.createElement('td');td.textContent=text;tr.append(td);}rows.append(tr);summary.textContent='已检查 '+results.length+' / '+files.length+'，失败 '+results.filter(r=>!r.ok).length;}};
 try{await Promise.all([check(),check(),check(),check()]);const failed=results.filter(r=>!r.ok);report={release,site:location.origin,checked:results.length,failed:failed.length,results};summary.textContent=failed.length?'检查完成：'+failed.length+' 个文件不可用。请复制结果；404 表示文件未发布到对应路径，403 表示访问受到限制。':'检查完成：全部 '+results.length+' 个运行文件可访问。随后仍需打开网站验证画面与播放。';copy.disabled=false;}finally{run.disabled=false;}
});
copy.addEventListener('click',async()=>{if(!report)return;try{await navigator.clipboard.writeText(JSON.stringify(report,null,2));copy.textContent='已复制';}catch{summary.textContent=JSON.stringify(report,null,2);}});
`
 };
}
