import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';

const scriptPath=fileURLToPath(import.meta.url);
const defaultRoot=path.resolve(path.dirname(scriptPath),'..');
const hash=data=>createHash('sha256').update(data).digest('hex');
const PART_BYTES=4*1024*1024;

function inside(root,value){
  const target=path.resolve(root,value);
  if(target!==root&&!target.startsWith(root+path.sep))throw Error('Media path leaves the selected site root');
  return target;
}

/** Byte-preserving hosting transport. Originals remain untouched in source.
 * Running against an extracted dist/ also works when only its parts remain. */
export async function splitHostingMedia(selectedRoot=defaultRoot,{partBytes=PART_BYTES}={}){
  if(!Number.isInteger(partBytes)||partBytes<1||partBytes>PART_BYTES)throw Error('partBytes must be between 1 and 4 MiB');
  const root=path.resolve(selectedRoot),manifestPath=inside(root,'assets/media/film-hd/manifest.json');
  const directory=path.dirname(manifestPath),manifest=JSON.parse(await fs.readFile(manifestPath,'utf8'));
  const report=[];
  for(const {name,fileField,partsField,sizeField,hashField}of[
    {name:'film-hd',fileField:'file',partsField:'fileParts',sizeField:'fileBytes',hashField:'fileSha256'},
    {name:'film-mobile',fileField:'mobileFallback',partsField:'mobileParts',sizeField:'mobileBytes',hashField:'mobileSha256'}
  ]){
    const original=manifest[fileField]||(name==='film-mobile'?manifest.fallback:null);
    let data;
    if(original){
      const originalPath=inside(root,path.relative(root,path.resolve(directory,original)));
      try{data=await fs.readFile(originalPath);}catch(error){if(error.code!=='ENOENT')throw error;}
    }
    if(!data){
      if(!manifest[partsField]?.length)throw Error('Missing original and existing byte parts for '+name);
      const chunks=[];
      for(const part of manifest[partsField]){
        const src=typeof part==='string'?part:part.src;
        const partPath=inside(root,path.relative(root,path.resolve(directory,src))),chunk=await fs.readFile(partPath);
        if(part.bytes!==undefined&&part.bytes!==chunk.length)throw Error('Existing part length mismatch: '+src);
        if(part.sha256&&part.sha256!==hash(chunk))throw Error('Existing part hash mismatch: '+src);
        chunks.push(chunk);
      }
      data=Buffer.concat(chunks);
      if(manifest[sizeField]!==data.length||manifest[hashField]&&manifest[hashField]!==hash(data))throw Error('Existing film assembly mismatch: '+name);
    }
    const originalHash=hash(data),parts=[];
    const destination=inside(root,path.relative(root,path.join(directory,'parts')));await fs.mkdir(destination,{recursive:true});
    for(let offset=0,index=0;offset<data.length;offset+=partBytes,index++){
      const chunk=data.subarray(offset,Math.min(data.length,offset+partBytes));
      const filename=`${name}-${originalHash.slice(0,12)}.part-${String(index+1).padStart(3,'0')}.bin`,target=inside(root,path.relative(root,path.join(destination,filename)));
      await fs.writeFile(target,chunk);
      const written=await fs.readFile(target);
      if(!written.equals(chunk))throw Error('Written part failed byte comparison: '+filename);
      parts.push({src:'./parts/'+filename,bytes:chunk.length,sha256:hash(chunk)});
    }
    const assembled=Buffer.concat(await Promise.all(parts.map(part=>fs.readFile(path.resolve(directory,part.src)))));
    if(!assembled.equals(data)||hash(assembled)!==originalHash)throw Error('Reassembled film differs from original: '+name);
    manifest[partsField]=parts;manifest[sizeField]=data.length;manifest[hashField]=originalHash;
    report.push({name,bytes:data.length,sha256:originalHash,parts:parts.length,largestPartBytes:Math.max(...parts.map(p=>p.bytes)),assemblyMatchesOriginal:true});
  }
  manifest.hostingTransport={kind:'ordered-binary-parts',partBytes,originalVideoUnchanged:true};
  await fs.writeFile(manifestPath,JSON.stringify(manifest,null,2)+'\n');
  return{root,manifest:manifestPath,files:report};
}

if(process.argv[1]&&path.resolve(process.argv[1])===scriptPath){
  const args=process.argv.slice(2);
  if(args.length&&!(args.length===2&&args[0]==='--root'))throw Error('Usage: node scripts/split-hosting-media.mjs [--root <site-root>]');
  console.log(JSON.stringify(await splitHostingMedia(args.length?args[1]:defaultRoot),null,2));
}
