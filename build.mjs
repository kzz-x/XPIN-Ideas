import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {releaseFiles} from './release-files.mjs';
const root=path.dirname(fileURLToPath(import.meta.url)),dist=path.resolve(root,'dist');
await fs.mkdir(path.join(root,'.openai'),{recursive:true});
if(!dist.startsWith(root+path.sep)||path.basename(dist)!=='dist')throw Error('Unsafe build target');
const {files,css}=await releaseFiles(root);
await fs.rm(dist,{recursive:true,force:true});await fs.mkdir(dist,{recursive:true});
for(const item of files){if(css.includes(item)||item==='index.html')continue;const dest=path.join(dist,item);await fs.mkdir(path.dirname(dest),{recursive:true});await fs.copyFile(path.join(root,item),dest);}
const combined=(await Promise.all(css.map(p=>fs.readFile(path.join(root,p),'utf8')))).join('\n');await fs.writeFile(path.join(dist,'styles-combined.css'),combined);
let html=await fs.readFile(path.join(root,'index.html'),'utf8'),first=true;html=html.replace(/<link rel="stylesheet" href="[^"]+">/g,()=>{if(!first)return'';first=false;return'<link rel="stylesheet" href="./styles-combined.css">';});await fs.writeFile(path.join(dist,'index.html'),html);
async function inventory(dir){let result=[];for(const entry of await fs.readdir(dir,{withFileTypes:true})){const p=path.join(dir,entry.name);if(entry.isDirectory())result.push(...await inventory(p));else result.push({path:path.relative(dist,p).split(path.sep).join('/'),bytes:(await fs.stat(p)).size});}return result;}
const output=await inventory(dist),bytes=output.reduce((n,f)=>n+f.bytes,0);
// Keep the approved film's original bytes. Bound the rest of the site instead
// of treating an arbitrary whole-site budget as a reason to re-encode it.
const film=JSON.parse(await fs.readFile(path.join(root,'assets/media/film-hd/manifest.json'),'utf8'));
const filmPaths=new Set([film.init,...(film.segments||[]).map(s=>s.src)].filter(Boolean).map(src=>path.posix.normalize('assets/media/film-hd/'+src)));
const filmBytes=output.filter(f=>filmPaths.has(f.path)).reduce((sum,f)=>sum+f.bytes,0),nonFilmBytes=bytes-filmBytes,nonFilmLimitBytes=32_000_000;
if(nonFilmBytes>nonFilmLimitBytes)throw Error('Non-film assets exceed the 32 MB budget: '+nonFilmBytes);
if(film.segments?.length&&filmBytes!==film.streamBytes)throw Error('The release must contain exactly one complete original-quality film stream');
if(output.some(file=>file.bytes>25*1024*1024))throw Error('A runtime asset exceeds 25 MiB; split its transport without re-encoding');
const report={bytes,filmBytes,nonFilmBytes,nonFilmLimitBytes,fileCount:output.length,sourceFiles:files,files:output};await fs.writeFile(path.join(root,'.openai/release-files.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify({directory:dist,bytes,MB:bytes/1000000,filmBytes,nonFilmBytes,fileCount:output.length}));
