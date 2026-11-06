import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {releaseFiles} from '../release-files.mjs';

const root=fileURLToPath(new URL('../',import.meta.url)),directory=path.join(root,'assets/media/film-hd');
const sha256=data=>createHash('sha256').update(data).digest('hex');
const manifest=JSON.parse(await fs.readFile(path.join(directory,'manifest.json'),'utf8'));

test('the real progressive film init and every independently keyed fragment have verified bytes and a continuous source timeline',async()=>{
  const init=await fs.readFile(path.resolve(directory,manifest.init));
  assert.equal(init.length,manifest.initBytes);assert.equal(sha256(init),manifest.initSha256);
  const avcC=init.indexOf(Buffer.from('avcC'));
  assert.equal(manifest.mime,`video/mp4; codecs="avc1.${init.subarray(avcC+5,avcC+8).toString('hex')}, mp4a.40.2"`);
  assert.equal(manifest.segments.length,26);let end=0,total=init.length;
  for(const segment of manifest.segments){
    assert.ok(Math.abs(segment.start-end)<1e-6);assert.ok(segment.duration>0&&segment.duration<=2.000001);
    assert.match(segment.src,/[a-f\d]{12}\.bin$/);
    const data=await fs.readFile(path.resolve(directory,segment.src));
    assert.equal(data.length,segment.bytes);assert.equal(sha256(data),segment.sha256);
    assert.ok(data.indexOf(Buffer.from('moof'))>=0);assert.ok(data.indexOf(Buffer.from('mdat'))>=0);
    assert.ok(data.length<5*1024*1024);
    end=segment.start+segment.duration;total+=data.length;
  }
  assert.ok(Math.abs(end-manifest.duration)<1e-6);assert.equal(total,manifest.streamBytes);assert.equal(total,manifest.totalBytes);
  const proof=manifest.remuxVerification;
  assert.equal(proof.sourceBytes,15862306);assert.equal(proof.sourceSHA256,manifest.fileSha256);
  const original=await fs.readFile(path.join(root,'assets/media/film-hd.mp4'));
  assert.equal(original.length,proof.sourceBytes);assert.equal(sha256(original),proof.sourceSHA256);
  assert.equal(proof.streams.find(stream=>stream.kind==='video').packets,3119);
  assert.equal(proof.streams.find(stream=>stream.kind==='audio').packets,2438);
  assert.equal(manifest.timestampOffset,-1/30);
  for(const stream of proof.streams){assert.equal(stream.allPacketPayloadsEqual,true);assert.equal(stream.allPacketTimestampsEqualAfterOffset,true);assert.ok(Math.abs(stream.remuxShift+manifest.timestampOffset)<1e-10);}
});

test('the actual release includes progressive film and mobile byte parts, omits duplicate HD film, and stays below 56 MB',async()=>{
  const {files}=await releaseFiles(root),set=new Set(files),filmDir='assets/media/film-hd/';
  for(const src of [manifest.init,...manifest.segments.map(segment=>segment.src),...manifest.mobileParts.map(part=>part.src)])assert.ok(set.has(path.posix.normalize(filmDir+src)));
  assert.ok(!set.has('assets/media/film-hd.mp4'));assert.ok(!set.has('assets/media/film-mobile.mp4'));
  for(const part of manifest.fileParts)assert.ok(!set.has(path.posix.normalize(filmDir+part.src)));
  const bytes=(await Promise.all(files.map(async file=>(await fs.stat(path.join(root,file))).size))).reduce((sum,size)=>sum+size,0);
  assert.ok(bytes<56_000_000,'release uses '+bytes+' bytes');
  // The 40 ms ensure margin intentionally includes the keyframe at eight
  // seconds: five segments prepare ten seconds without downloading the film.
  const startup=manifest.segments.filter(segment=>segment.start<8.04);
  assert.equal(startup.length,5);assert.equal(startup.at(-1).start+startup.at(-1).duration,10);
  assert.ok(manifest.initBytes+startup.reduce((sum,segment)=>sum+segment.bytes,0)<3_000_000);
});
