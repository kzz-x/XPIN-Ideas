import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';

const script=fileURLToPath(import.meta.url),defaultRoot=path.resolve(path.dirname(script),'..');
export const ORIGINAL_PART_BYTES=16*1024*1024;
const hash=data=>createHash('sha256').update(data).digest('hex');
const archiveDirectory=root=>path.join(path.resolve(root),'source-media/film-original');
export async function writeOriginalArchive(selectedRoot,data,{filename='film-hd.mp4'}={}){
 const directory=archiveDirectory(selectedRoot),sha256=hash(data),parts=[];
 await fs.mkdir(directory,{recursive:true});
 for(let offset=0,index=0;offset<data.length;offset+=ORIGINAL_PART_BYTES,index++){
  const bytes=data.subarray(offset,Math.min(offset+ORIGINAL_PART_BYTES,data.length));
  const file=`original-${sha256.slice(0,12)}.part-${String(index+1).padStart(3,'0')}.bin`;
  await fs.writeFile(path.join(directory,file),bytes);
  parts.push({file,bytes:bytes.length,sha256:hash(bytes)});
 }
 const manifest={version:1,filename:path.basename(filename),bytes:data.length,sha256,partBytes:ORIGINAL_PART_BYTES,parts};
 await fs.writeFile(path.join(directory,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
 const checked=await readOriginalArchive(selectedRoot);
 if(!checked.data.equals(data))throw Error('Original film archive differs from the supplied source');
 return manifest;
}
export async function readOriginalArchive(selectedRoot=defaultRoot){
 const directory=archiveDirectory(selectedRoot),manifest=JSON.parse(await fs.readFile(path.join(directory,'manifest.json'),'utf8'));
 if(manifest.version!==1||!Number.isSafeInteger(manifest.bytes)||manifest.bytes<=0||!/^[a-f\d]{64}$/.test(manifest.sha256)||!Array.isArray(manifest.parts)||!manifest.parts.length)throw Error('Invalid original film archive manifest');
 const parts=[];
 for(const part of manifest.parts){
  if(typeof part.file!=='string'||!/^original-[a-f\d]{12}\.part-\d+\.bin$/.test(part.file)||!Number.isSafeInteger(part.bytes)||part.bytes<=0||part.bytes>ORIGINAL_PART_BYTES)throw Error('Invalid original film archive part');
  const data=await fs.readFile(path.join(directory,part.file));
  if(data.length!==part.bytes||hash(data)!==part.sha256)throw Error('Original film archive part failed integrity check: '+part.file);
  parts.push(data);
 }
 const data=Buffer.concat(parts);
 if(data.length!==manifest.bytes||hash(data)!==manifest.sha256)throw Error('Original film archive assembly failed integrity check');
 return{manifest,data};
}
export async function restoreOriginalFilm(selectedRoot=defaultRoot){
 const root=path.resolve(selectedRoot),{manifest,data}=await readOriginalArchive(root),target=path.join(root,'assets/media/film-hd.mp4');
 await fs.mkdir(path.dirname(target),{recursive:true});
 await fs.writeFile(target,data);
 return{path:target,bytes:manifest.bytes,sha256:manifest.sha256};
}
export async function ensureOriginalFilm(selectedRoot=defaultRoot){
 const target=path.join(path.resolve(selectedRoot),'assets/media/film-hd.mp4');
 try{await fs.access(target);return target;}catch(error){if(error.code!=='ENOENT')throw error;}
 return(await restoreOriginalFilm(selectedRoot)).path;
}

if(process.argv[1]&&path.resolve(process.argv[1])===script){
 const args=process.argv.slice(2);
 if(args.length===1&&args[0]==='--restore')console.log(JSON.stringify(await restoreOriginalFilm(),null,2));
 else if(args.length===2&&args[0]==='--archive'){
  const source=path.resolve(args[1]);console.log(JSON.stringify(await writeOriginalArchive(defaultRoot,await fs.readFile(source),{filename:path.basename(source)}),null,2));
 }else throw Error('Usage: node scripts/original-film.mjs --restore | --archive <original.mp4>');
}
