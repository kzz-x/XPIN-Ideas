import fs from 'node:fs/promises';
import path from 'node:path';
export async function releaseFiles(root){
 const html=await fs.readFile(path.join(root,'index.html'),'utf8'),map=JSON.parse(html.match(/<script type="importmap">([\s\S]*?)<\/script>/)[1]).imports;
 const found=new Set(),queue=['index.html'],css=[...html.matchAll(/<link rel="stylesheet" href="([^"]+)"/g)].map(m=>m[1].replace(/^\.\//,''));
 async function add(value,parent='index.html',must=false){
  if(!value||/^(?:https?:|data:|blob:|#)/.test(value))return;
  for(const [prefix,target]of Object.entries(map))if(value===prefix||prefix.endsWith('/')&&value.startsWith(prefix)){value=target+value.slice(prefix.length);parent='index.html';break;}
  const choices=[];if(value.startsWith('./assets/'))choices.push(value.slice(2));
  choices.push(path.posix.normalize(path.posix.join(path.posix.dirname(parent),value)));
  for(let rel of choices){rel=decodeURIComponent(rel.split(/[?#]/)[0]).replace(/\\/g,'/');if(rel.startsWith('../')||path.isAbsolute(rel))continue;try{if((await fs.stat(path.join(root,rel))).isFile()){if(!found.has(rel))queue.push(rel);return;}}catch{}}
  if(must&&(value.startsWith('.')||value.includes('/')))throw Error('Missing imported file: '+parent+' -> '+value);
 }
 for(const rel of ['assets/media/film-hd/manifest.json','assets/media/bgm/stream/manifest.json','assets/vendor/MESHOPT-LICENSE.md','assets/vendor/THREE-LICENSE.txt','assets/products/S11-source-licenses.txt','assets/dot/licenses/THREE-LICENSE.txt','assets/media/sfx/CREDITS.md'])await add('./'+rel);
 for(const name of await fs.readdir(path.join(root,'assets/products')))if(name.endsWith('.glb'))await add('./assets/products/'+name);
 for(const name of await fs.readdir(path.join(root,'assets/media/sfx')))if(/\.(wav|json)$/.test(name))await add('./assets/media/sfx/'+name);
 for(const name of await fs.readdir(path.join(root,'assets/game-logos')))await add('./assets/game-logos/'+name);
 for(const name of await fs.readdir(path.join(root,'assets/type')))await add('./assets/type/'+name);
 const content=await fs.readFile(path.join(root,'src/content.mjs'),'utf8');for(const m of content.matchAll(/picture\('([^']+)'\)/g))await add('./assets/process/'+m[1]);
 while(queue.length){
  const rel=queue.shift();if(found.has(rel))continue;found.add(rel);if(!/\.(?:html|css|mjs|js|json|svg)$/.test(rel))continue;
  const text=await fs.readFile(path.join(root,rel),'utf8');
  if(/\.(mjs|js)$/.test(rel))for(const m of text.matchAll(/(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s*)(['"])([^'"]+)\1/g))await add(m[2],rel,true);
  if(rel.endsWith('.html'))for(const m of text.matchAll(/(?:src|href)="([^"]+)"/g))await add(m[1],rel);
  if(rel.endsWith('.css'))for(const m of text.matchAll(/url\(['"]?([^)'"\s]+)['"]?\)/g))await add(m[1],rel);
  if(/\.(mjs|js)$/.test(rel))for(const m of text.matchAll(/['"]([^'"\n]+\.(?:json|svg|png|jpe?g|webp|glb|wav|m4a|mp4|woff2?)(?:[?#][^'"\n]*)?)['"]/g))await add(m[1],rel);
  if(rel==='assets/media/film-hd/manifest.json'){const m=JSON.parse(text);for(const v of [m.file,m.mobileFallback,m.fallback])await add(v,rel,true);}
  if(rel==='assets/media/bgm/stream/manifest.json')for(const t of Object.values(JSON.parse(text).tracks))for(const c of t.chunks)await add(c.src,rel,true);
 }
 return{files:[...found].sort(),css};
}
