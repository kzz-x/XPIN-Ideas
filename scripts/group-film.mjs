import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';

const hash=data=>createHash('sha256').update(data).digest('hex');
/** Coalesce existing fMP4 boxes, including their original clocks. No muxer or
 * encoder touches the packets. The original boundaries allow a smaller host
 * envelope later without remuxing or duplicating a second rendition. */
export async function groupFilm(root,{maxBytes=8*1024*1024,delivery={}}={}){
 if(!Number.isSafeInteger(maxBytes)||maxBytes<3*1024*1024||maxBytes>24*1024*1024)throw Error('Invalid film delivery envelope');
 const dir=path.join(root,'assets/media/film-hd'),file=path.join(dir,'manifest.json');
 const manifest=JSON.parse(await fs.readFile(file,'utf8')),pieces=[],before=createHash('sha256');
 const init=await fs.readFile(path.resolve(dir,manifest.init));before.update(init);
 for(const segment of manifest.segments){
  const data=await fs.readFile(path.resolve(dir,segment.src));
  if(data.length!==segment.bytes||hash(data)!==segment.sha256)throw Error('Invalid original segment: '+segment.src);
  before.update(data);let offset=0;
  for(const piece of segment.fragments||[{start:segment.start,duration:segment.duration,bytes:segment.bytes,sha256:segment.sha256}]){
   const bytes=data.subarray(offset,offset+piece.bytes);offset+=piece.bytes;
   if(bytes.length!==piece.bytes||hash(bytes)!==piece.sha256)throw Error('Invalid fMP4 boundary');
   pieces.push({...piece,data:bytes});
  }
  if(offset!==data.length)throw Error('Unaccounted film bytes');
 }
 const groups=[];let current=[],bytes=0;
 function flush(){if(current.length){groups.push(current);current=[];bytes=0;}}
 for(const [index,piece] of pieces.entries()){if(piece.bytes>maxBytes)throw Error('Original GOP exceeds this host envelope');if(bytes+piece.bytes>maxBytes)flush();current.push(piece);bytes+=piece.bytes;if(index===0)flush();}flush();
 const after=createHash('sha256');after.update(init);const segments=[];await fs.mkdir(path.join(dir,'fragments'),{recursive:true});
 for(const [index,group] of groups.entries()){
  const data=Buffer.concat(group.map(p=>p.data));after.update(data);const sha256=hash(data),src='./fragments/group-'+String(index).padStart(3,'0')+'-'+sha256.slice(0,12)+'.bin';
  await fs.writeFile(path.resolve(dir,src),data);
  segments.push({src,start:group[0].start,duration:Number(group.reduce((n,p)=>n+p.duration,0).toFixed(6)),bytes:data.length,sha256,fragments:group.map(({data,...piece})=>piece)});
 }
 const previousHash=before.digest('hex'),streamHash=after.digest('hex');if(previousHash!==streamHash)throw Error('Film byte sequence changed');
 const priorCount=manifest.segments.length;manifest.segments=segments;manifest.streamSHA256=streamHash;
 manifest.hostingTransport={...manifest.hostingTransport,kind:'grouped-progressive-fmp4',maxTransportBytes:maxBytes,originalFragmentCount:pieces.length,originalVideoUnchanged:true,byteSequenceVerified:true};
 manifest.delivery={maxConcurrent:3,minimumBufferSeconds:10,safetySeconds:7,rateMultiplier:.65,minimumNetworkSamples:3,...manifest.delivery,...delivery};
 await fs.writeFile(file,JSON.stringify(manifest,null,2)+'\n');
 return{previousRequests:priorCount,requests:segments.length,bytes:manifest.streamBytes,streamSHA256:streamHash,unchanged:true,delivery:manifest.delivery};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');console.log(JSON.stringify(await groupFilm(root)));
}
