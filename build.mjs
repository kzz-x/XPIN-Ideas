import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {releaseFiles} from './release-files.mjs';
const root=path.dirname(fileURLToPath(import.meta.url)),dist=path.resolve(root,'dist');
if(!dist.startsWith(root+path.sep)||path.basename(dist)!=='dist')throw Error('Unsafe build target');
const {files,css}=await releaseFiles(root);
await fs.rm(dist,{recursive:true,force:true});await fs.mkdir(dist,{recursive:true});
for(const item of files){if(css.includes(item)||item==='index.html')continue;const dest=path.join(dist,item);await fs.mkdir(path.dirname(dest),{recursive:true});await fs.copyFile(path.join(root,item),dest);}
const combined=(await Promise.all(css.map(p=>fs.readFile(path.join(root,p),'utf8')))).join('\n');await fs.writeFile(path.join(dist,'styles-combined.css'),combined);
let html=await fs.readFile(path.join(root,'index.html'),'utf8'),first=true;html=html.replace(/<link rel="stylesheet" href="[^"]+">/g,()=>{if(!first)return'';first=false;return'<link rel="stylesheet" href="./styles-combined.css">';});await fs.writeFile(path.join(dist,'index.html'),html);
async function inventory(dir){let result=[];for(const entry of await fs.readdir(dir,{withFileTypes:true})){const p=path.join(dir,entry.name);if(entry.isDirectory())result.push(...await inventory(p));else result.push({path:path.relative(dist,p).split(path.sep).join('/'),bytes:(await fs.stat(p)).size});}return result;}
const output=await inventory(dist),bytes=output.reduce((n,f)=>n+f.bytes,0);if(bytes>=40000000)throw Error('Website exceeds 40 MB: '+bytes);
const report={limitBytes:40000000,bytes,fileCount:output.length,sourceFiles:files,files:output};await fs.writeFile(path.join(root,'.openai/release-files.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify({directory:dist,bytes,MB:bytes/1000000,fileCount:output.length,limitMB:40}));
