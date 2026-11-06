import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {releaseFiles} from '../release-files.mjs';
import {readOriginalArchive} from '../scripts/original-film.mjs';

const root=fileURLToPath(new URL('../',import.meta.url)),directory=path.join(root,'assets/media/film-hd');
const sha256=data=>createHash('sha256').update(data).digest('hex');
const manifest=JSON.parse(await fs.readFile(path.join(directory,'manifest.json'),'utf8'));

test('the real progressive film init and every independently keyed fragment have verified bytes and a continuous source timeline',async()=>{
  const init=await fs.readFile(path.resolve(directory,manifest.init));
  assert.equal(init.length,manifest.initBytes);assert.equal(sha256(init),manifest.initSha256);
  const avcC=init.indexOf(Buffer.from('avcC'));
  assert.equal(manifest.mime,`video/mp4; codecs="avc1.${init.subarray(avcC+5,avcC+8).toString('hex')}, mp4a.40.2"`);
  assert.ok(manifest.segments.length>0);let end=0,total=init.length;
  for(const segment of manifest.segments){
    assert.ok(Math.abs(segment.start-end)<1e-6);assert.ok(segment.duration>0);
    assert.match(segment.src,/[a-f\d]{12}\.bin$/);
    const data=await fs.readFile(path.resolve(directory,segment.src));
    assert.equal(data.length,segment.bytes);assert.equal(sha256(data),segment.sha256);
    assert.ok(data.indexOf(Buffer.from('moof'))>=0);assert.ok(data.indexOf(Buffer.from('mdat'))>=0);
    assert.ok(data.length<=25*1024*1024);
    end=segment.start+segment.duration;total+=data.length;
  }
  assert.ok(Math.abs(end-manifest.duration)<1e-6);assert.equal(total,manifest.streamBytes);assert.equal(total,manifest.totalBytes);
  const proof=manifest.remuxVerification;
  assert.equal(proof.sourceBytes,manifest.fileBytes);assert.equal(proof.sourceSHA256,manifest.fileSha256);
  const {data:original,manifest:archive}=await readOriginalArchive(root);
  assert.equal(manifest.sourceFilename,archive.filename);
  assert.equal(original.length,proof.sourceBytes);assert.equal(sha256(original),proof.sourceSHA256);
  assert.equal(proof.streams.find(stream=>stream.kind==='video').packets,Math.round(manifest.duration*manifest.fps));
  assert.ok(proof.streams.find(stream=>stream.kind==='audio').packets>0);
  assert.ok(manifest.width>0&&manifest.height>0&&manifest.fps>0);
  assert.ok(manifest.stageAt>=0&&manifest.stageAt<manifest.duration);
  assert.equal(manifest.encoding.reencoded,false);assert.equal(manifest.qualityPolicy,'preserve-source');
  for(const stream of proof.streams){assert.equal(stream.allPacketPayloadsEqual,true);assert.equal(stream.allPacketTimestampsEqualAfterOffset,true);assert.ok(Math.abs(stream.remuxShift+manifest.timestampOffset)<1e-10);}
});

test('the actual release includes only the new original-quality fragments, without a second or downgraded film copy',async()=>{
  const {files}=await releaseFiles(root),set=new Set(files),filmDir='assets/media/film-hd/';
  for(const src of [manifest.init,...manifest.segments.map(segment=>segment.src)])assert.ok(set.has(path.posix.normalize(filmDir+src)));
  assert.ok(!set.has('assets/media/film-hd.mp4'));assert.ok(!set.has('assets/media/film-mobile.mp4'));
  assert.ok(!files.some(file=>file.startsWith('source-media/')));
  assert.ok(!files.some(file=>file.includes('film-hd/parts/')));
  for(const field of ['mobileFallback','mobileParts','mobileBytes','fallback','fileParts'])assert.equal(manifest[field],undefined);
  const bytes=(await Promise.all(files.map(async file=>(await fs.stat(path.join(root,file))).size))).reduce((sum,size)=>sum+size,0);
  // Film quality is not constrained by the old 56 MB package target. Keep the
  // remaining site bounded and prove that the full encoded stream is shipped.
  assert.ok(bytes>=manifest.streamBytes);assert.ok(bytes-manifest.streamBytes<32_000_000,'non-film assets use '+(bytes-manifest.streamBytes)+' bytes');
  assert.ok(Math.abs(manifest.streamBytes-manifest.fileBytes)<200_000);
  const allFragments=files.filter(file=>file.startsWith(filmDir+'fragments/'));
  assert.equal(allFragments.length,manifest.segments.length+1);
});
