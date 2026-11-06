import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {ORIGINAL_PART_BYTES,writeOriginalArchive,readOriginalArchive,restoreOriginalFilm,ensureOriginalFilm} from '../scripts/original-film.mjs';

async function workspace(t){
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'linggan-original-archive-test-'));
 t.after(async()=>{const resolved=path.resolve(root),temporaryRoot=path.resolve(os.tmpdir());if(resolved.startsWith(temporaryRoot+path.sep)&&path.basename(resolved).startsWith('linggan-original-archive-test-'))await fs.rm(resolved,{recursive:true,force:true});});
 return root;
}
test('original source chunks reassemble every byte and restore a missing editable MP4',async t=>{
 const root=await workspace(t),original=Buffer.alloc(ORIGINAL_PART_BYTES+257);
 for(let i=0;i<original.length;i++)original[i]=(i*137+(i>>>12))&255;
 const manifest=await writeOriginalArchive(root,original,{filename:'original source.mp4'});
 assert.equal(manifest.parts.length,2);assert.equal(manifest.parts[0].bytes,ORIGINAL_PART_BYTES);assert.equal(manifest.parts[1].bytes,257);
 assert.equal(manifest.sha256,createHash('sha256').update(original).digest('hex'));
 await assert.rejects(fs.stat(path.join(root,'assets/media/film-hd.mp4')),{code:'ENOENT'});
 assert.deepEqual((await readOriginalArchive(root)).data,original);
 const restored=await ensureOriginalFilm(root);
 assert.deepEqual(await fs.readFile(restored),original);
 assert.equal(await ensureOriginalFilm(root),restored);
});
test('a corrupted original part fails before restoration can overwrite a local source',async t=>{
 const root=await workspace(t),original=Buffer.from('original encoded movie bytes');
 const manifest=await writeOriginalArchive(root,original),restored=await restoreOriginalFilm(root);
 const sentinel=Buffer.from('local source remains untouched after failed validation');await fs.writeFile(restored.path,sentinel);
 const part=path.join(root,'source-media/film-original',manifest.parts[0].file),corrupt=await fs.readFile(part);corrupt[3]^=255;await fs.writeFile(part,corrupt);
 await assert.rejects(readOriginalArchive(root),/part failed integrity check/);
 await assert.rejects(restoreOriginalFilm(root),/part failed integrity check/);
 assert.deepEqual(await fs.readFile(restored.path),sentinel);
});
