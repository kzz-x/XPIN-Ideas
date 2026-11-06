import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {releaseFiles} from './release-files.mjs';
import {portablePath,portableText} from './portable-build.mjs';
const root=path.dirname(fileURLToPath(import.meta.url)),dist=path.resolve(root,'dist');
await fs.mkdir(path.join(root,'.openai'),{recursive:true});
if(!dist.startsWith(root+path.sep)||path.basename(dist)!=='dist')throw Error('Unsafe build target');
const {files,css}=await releaseFiles(root);
const destinations=new Set();
for(const item of files){const dest=portablePath(item);if(destinations.has(dest))throw Error('Portable path collision: '+dest);destinations.add(dest);}
const digest=createHash('sha256');
for(const item of [...files,'portable-build.mjs','build.mjs']){digest.update(item);digest.update(await fs.readFile(path.join(root,item)));}
const version=digest.digest('hex').slice(0,12);
await fs.rm(dist,{recursive:true,force:true});await fs.mkdir(dist,{recursive:true});
for(const item of files){if(css.includes(item)||item==='index.html')continue;const dest=path.join(dist,portablePath(item));await fs.mkdir(path.dirname(dest),{recursive:true});if(/\.(?:js|mjs|json|css|svg)$/.test(item))await fs.writeFile(dest,portableText(await fs.readFile(path.join(root,item),'utf8'),{extension:path.extname(item),version}));else await fs.copyFile(path.join(root,item),dest);}
const combined=(await Promise.all(css.map(p=>fs.readFile(path.join(root,p),'utf8')))).join('\n');await fs.writeFile(path.join(dist,'styles-combined.css'),portableText(combined,{extension:'.css',version}));
let html=await fs.readFile(path.join(root,'index.html'),'utf8'),first=true;html=html.replace(/<link rel="stylesheet" href="[^"]+">/g,()=>{if(!first)return'';first=false;return'<link rel="stylesheet" href="./styles-combined.css">';});await fs.writeFile(path.join(dist,'index.html'),portableText(html,{extension:'.html',version}));
async function inventory(dir){let result=[];for(const entry of await fs.readdir(dir,{withFileTypes:true})){const p=path.join(dir,entry.name);if(entry.isDirectory())result.push(...await inventory(p));else result.push({path:path.relative(dist,p).split(path.sep).join('/'),bytes:(await fs.stat(p)).size});}return result;}
const output=await inventory(dist),bytes=output.reduce((n,f)=>n+f.bytes,0);if(bytes>=56000000)throw Error('Website exceeds 56 MB: '+bytes);
const report={version,limitBytes:56000000,bytes,fileCount:output.length,sourceFiles:files,files:output};await fs.writeFile(path.join(root,'.openai/release-files.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify({directory:dist,version,bytes,MB:bytes/1000000,fileCount:output.length,limitMB:56}));
