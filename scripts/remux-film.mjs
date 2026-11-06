import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {ensureOriginalFilm,writeOriginalArchive} from './original-film.mjs';

const run=promisify(execFile),script=fileURLToPath(import.meta.url),defaultRoot=path.resolve(path.dirname(script),'..');
const sha256=data=>createHash('sha256').update(data).digest('hex');
const seconds=(ticks,timeBase)=>Number(ticks)*Number(timeBase.split('/')[0])/Number(timeBase.split('/')[1]);
const near=(a,b)=>Math.abs(a-b)<1e-8;

async function probe(file,ffprobe){
  const {stdout}=await run(ffprobe,['-v','error','-show_streams','-show_packets','-show_data_hash','sha256','-of','json',file],{maxBuffer:32*1024*1024,windowsHide:true});
  return JSON.parse(stdout);
}

function comparePackets(original,fragmented){
  const streams=[];
  for(const kind of ['video','audio']){
    const before=original.streams.find(s=>s.codec_type===kind),after=fragmented.streams.find(s=>s.codec_type===kind);
    if(!before||!after||before.codec_name!==after.codec_name||before.extradata_hash!==after.extradata_hash)throw Error('Codec configuration changed: '+kind);
    const a=original.packets.filter(p=>p.stream_index===before.index),b=fragmented.packets.filter(p=>p.stream_index===after.index);
    if(!a.length||a.length!==b.length)throw Error('Packet count changed: '+kind);
    const shift=seconds(b[0].pts,after.time_base)-seconds(a[0].pts,before.time_base);
    for(let i=0;i<a.length;i++){
      if(a[i].data_hash!==b[i].data_hash||a[i].size!==b[i].size)throw Error('Packet bytes changed: '+kind+' #'+i);
      for(const field of ['pts','dts'])if(!near(seconds(b[i][field],after.time_base)-seconds(a[i][field],before.time_base),shift))throw Error('Nonuniform '+field+' shift: '+kind+' #'+i);
      if(!near(seconds(a[i].duration,before.time_base),seconds(b[i].duration,after.time_base)))throw Error('Packet duration changed: '+kind+' #'+i);
    }
    streams.push({kind,codec:before.codec_name,packets:a.length,timeBase:before.time_base,originalFirstPTS:seconds(a[0].pts,before.time_base),originalFirstDTS:seconds(a[0].dts,before.time_base),remuxShift:shift,allPacketPayloadsEqual:true,allPacketTimestampsEqualAfterOffset:true,packetHashSequenceSHA256:sha256(a.map(p=>p.data_hash).join('\n'))});
  }
  if(!near(streams[0].remuxShift,streams[1].remuxShift))throw Error('Audio/video clocks have different remux offsets');
  return{timestampOffset:-streams[0].remuxShift,streams};
}

/** Repackage the approved H.264/AAC streams; never encode, trim or drop frames.
 * fMP4 has no edit list here. A measured common PTS/DTS displacement is undone
 * by the MSE timestampOffset, preserving negative DTS and AAC priming timing. */
export async function remuxFilm(selectedRoot=defaultRoot,{ffmpeg='ffmpeg',ffprobe='ffprobe',sourceFile,segmentSeconds=1,stageAt}={}){
  if(!Number.isFinite(segmentSeconds)||segmentSeconds<=0||segmentSeconds>2)throw Error('segmentSeconds must be greater than zero and no more than two seconds');
  const root=path.resolve(selectedRoot),directory=path.join(root,'assets/media/film-hd'),preservedSource=path.join(root,'assets/media/film-hd.mp4'),source=sourceFile?path.resolve(sourceFile):await ensureOriginalFilm(root);
  const originalBytes=await fs.readFile(source),sourceHash=sha256(originalBytes),prefix='film-'+sourceHash.slice(0,12);
  const original=await probe(source,ffprobe),video=original.streams.find(s=>s.codec_type==='video'),audio=original.streams.find(s=>s.codec_type==='audio');
  if(video?.codec_name!=='h264'||audio?.codec_name!=='aac'||audio.profile!=='LC')throw Error('This remux expects the approved H.264 / AAC LC source');
  const temp=await fs.mkdtemp(path.join(os.tmpdir(),'linggan-film-remux-'));
  try{
    await run(ffmpeg,['-hide_banner','-loglevel','warning','-nostdin','-y','-i',source,'-map','0:v:0','-map','0:a:0','-c','copy','-f','hls','-hls_time',String(segmentSeconds),'-hls_list_size','0','-hls_segment_type','fmp4','-hls_flags','independent_segments','-hls_fmp4_init_filename',prefix+'-init.mp4','-hls_segment_filename',prefix+'-%03d.m4s','index.m3u8'],{cwd:temp,windowsHide:true,maxBuffer:1024*1024});
    const playlist=await fs.readFile(path.join(temp,'index.m3u8'),'utf8'),initName=playlist.match(/#EXT-X-MAP:URI="([^"]+)"/)?.[1];
    if(!initName||!playlist.includes('#EXT-X-ENDLIST'))throw Error('Incomplete fMP4 playlist');
    const items=[...playlist.matchAll(/#EXTINF:([\d.]+),[^\n]*\n([^\r\n]+)/g)].map(m=>({duration:Number(m[1]),name:m[2]}));
    if(!items.length)throw Error('No video segments generated');
    const init=await fs.readFile(path.join(temp,initName)),chunks=await Promise.all(items.map(item=>fs.readFile(path.join(temp,item.name))));
    const joined=path.join(temp,'verification-joined.mp4');await fs.writeFile(joined,Buffer.concat([init,...chunks]));
    const fragmented=await probe(joined,ffprobe),verification=comparePackets(original,fragmented);
    const avcC=init.indexOf(Buffer.from('avcC'));
    if(avcC<0||init[avcC+4]!==1)throw Error('Missing AVC decoder configuration');
    const mime=`video/mp4; codecs="avc1.${init.subarray(avcC+5,avcC+8).toString('hex')}, mp4a.40.2"`;
    const segments=[];let start=0;
    for(let i=0;i<items.length;i++){
      const item=items[i],segmentProbe=path.join(temp,'verification-segment.mp4');
      await fs.writeFile(segmentProbe,Buffer.concat([init,chunks[i]]));
      const single=await probe(segmentProbe,ffprobe),stream=single.streams.find(s=>s.codec_type==='video'),packets=single.packets.filter(p=>p.stream_index===stream.index);
      if(!packets[0]?.flags.includes('K'))throw Error('Segment does not begin on an independent video keyframe: '+i);
      const actualStart=Math.min(...packets.map(p=>seconds(p.pts,stream.time_base)))+verification.timestampOffset;
      if(Math.abs(actualStart-start)>1e-5)throw Error('Segment clock disagrees with its playlist: '+i);
      const hash=sha256(chunks[i]);
      segments.push({src:'./fragments/segment-'+String(i).padStart(3,'0')+'-'+hash.slice(0,12)+'.bin',start,duration:item.duration,bytes:chunks[i].length,sha256:hash});
      start=Number((start+item.duration).toFixed(6));
    }
    const manifestPath=path.join(directory,'manifest.json'),manifest=JSON.parse(await fs.readFile(manifestPath,'utf8'));
    const frameRate=Number(video.avg_frame_rate.split('/')[0])/Number(video.avg_frame_rate.split('/')[1]);
    const stageCue=stageAt??manifest.stageAt;
    if(!Number.isFinite(stageCue)||stageCue<0||stageCue>=Number(video.duration))throw Error('Confirm a --stage-at inside the replacement film duration');
    manifest.stageAt=stageCue;
    manifest.version=3;manifest.label=`${video.height}p / ${frameRate} fps · 原始画质`;
    manifest.width=video.width;manifest.height=video.height;manifest.fps=frameRate;manifest.duration=Number(video.duration);
    manifest.sourceFilename=sourceFile?path.basename(source):(manifest.sourceFilename||path.basename(source));
    manifest.file='../film-hd.mp4';manifest.fileBytes=originalBytes.length;manifest.fileSha256=sourceHash;
    // The native-video compatibility path assembles these same source-quality
    // fragments. A second low-resolution encode is never selected or shipped.
    for(const field of ['fallback','mobileFallback','mobileBytes','mobileFps','mobileParts','mobileSha256','fileParts'])delete manifest[field];
    manifest.qualityPolicy='preserve-source';
    manifest.init='./fragments/init-'+sha256(init).slice(0,12)+'.bin';manifest.initBytes=init.length;manifest.initSha256=sha256(init);manifest.segments=segments;
    manifest.streamBytes=manifest.totalBytes=init.length+segments.reduce((sum,item)=>sum+item.bytes,0);manifest.timestampOffset=verification.timestampOffset;manifest.mime=mime;
    manifest.encoding={video:`H.264 ${video.profile} / ${video.width}×${video.height} / ${frameRate} fps / source stream copy`,audio:`AAC ${audio.profile} / ${audio.sample_rate} Hz / ${audio.channels} channels / source stream copy`,videoBitrate:Number(video.bit_rate),audioBitrate:Number(audio.bit_rate),framesRemoved:false,reencoded:false,remux:'stream copy; all encoded video and audio packets retained'};
    manifest.hostingTransport={kind:'progressive-fmp4',originalVideoUnchanged:true,independentVideoSegments:true,targetSegmentSeconds:segmentSeconds,compatibility:'same-fragments-blob'};
    manifest.remuxVerification={sourceSHA256:sourceHash,sourceBytes:originalBytes.length,sourceVideoDuration:Number(video.duration),sourceAudioDuration:Number(audio.duration),sourceAudioTailDiscardSamples:original.packets.filter(p=>p.stream_index===audio.index).at(-1)?.side_data_list?.find(side=>side.side_data_type==='Skip Samples')?.discard_padding||0,...verification};
    const destination=path.join(directory,'fragments');await fs.mkdir(destination,{recursive:true});
    await fs.writeFile(path.resolve(directory,manifest.init),init);
    for(let i=0;i<items.length;i++)await fs.writeFile(path.resolve(directory,segments[i].src),chunks[i]);
    if(source!==preservedSource)await fs.writeFile(preservedSource,originalBytes);
    await writeOriginalArchive(root,originalBytes,{filename:manifest.sourceFilename});
    await fs.writeFile(manifestPath,JSON.stringify(manifest,null,2)+'\n');
    const startup=seconds=>({seconds,segments:segments.filter(item=>item.start<seconds).length,bytes:init.length+segments.filter(item=>item.start<seconds).reduce((sum,item)=>sum+item.bytes,0)});
    return{source:sourceHash,mime,timestampOffset:manifest.timestampOffset,initBytes:init.length,segments:segments.length,streamBytes:manifest.streamBytes,startup:[startup(8),startup(8.04),startup(10)],verification:manifest.remuxVerification};
  }finally{
    const resolved=path.resolve(temp),temporaryRoot=path.resolve(os.tmpdir());
    if(resolved.startsWith(temporaryRoot+path.sep)&&path.basename(resolved).startsWith('linggan-film-remux-'))await fs.rm(resolved,{recursive:true,force:true});
  }
}

if(process.argv[1]&&path.resolve(process.argv[1])===script){
  const args=process.argv.slice(2),options={};let root=defaultRoot;
  for(let i=0;i<args.length;i+=2){
    const value=args[i+1];if(value===undefined)throw Error('Missing value for '+args[i]);
    if(args[i]==='--root')root=value;
    else if(args[i]==='--source')options.sourceFile=value;
    else if(args[i]==='--segment-seconds')options.segmentSeconds=Number(value);
    else if(args[i]==='--stage-at')options.stageAt=Number(value);
    else throw Error('Usage: node scripts/remux-film.mjs [--root <site-root>] [--source <original.mp4>] [--segment-seconds <seconds>] [--stage-at <seconds>]');
  }
  console.log(JSON.stringify(await remuxFilm(root,options),null,2));
}
