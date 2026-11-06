import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createStaticServer} from '../server.mjs';

test('portable hosting serves JS MIME, byte ranges, subdirectories and validated cache',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'linggan-hosting-'));
 await fs.mkdir(path.join(root,'nested'));
 await fs.writeFile(path.join(root,'nested/index.html'),'<h1>Ready</h1>');
 await fs.writeFile(path.join(root,'app.mjs'),'export const ready=true;');
 await fs.writeFile(path.join(root,'film-123456789abc.part-01.bin'),Buffer.from([0,1,2,3,4,5,6,7]));
 const server=createStaticServer(root);await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const base='http://127.0.0.1:'+server.address().port;
 try{
  assert.equal(await(await fetch(base+'/nested/')).text(),'<h1>Ready</h1>');
  const js=await fetch(base+'/app.mjs');assert.match(js.headers.get('content-type'),/javascript/);await js.arrayBuffer();
  const url=base+'/film-123456789abc.part-01.bin';
  const head=await fetch(url,{method:'HEAD'});assert.equal(head.headers.get('content-length'),'8');assert.match(head.headers.get('cache-control'),/immutable/);
  const cached=await fetch(url,{headers:{'If-None-Match':head.headers.get('etag')}});assert.equal(cached.status,304);
  const partial=await fetch(url,{headers:{Range:'bytes=2-4'}});assert.equal(partial.status,206);assert.equal(partial.headers.get('content-range'),'bytes 2-4/8');assert.deepEqual([...new Uint8Array(await partial.arrayBuffer())],[2,3,4]);
  const suffix=await fetch(url,{headers:{Range:'bytes=-2'}});assert.deepEqual([...new Uint8Array(await suffix.arrayBuffer())],[6,7]);
  assert.equal((await fetch(url,{headers:{Range:'bytes=99-'}})).status,416);
  assert.equal((await fetch(base+'/.private')).status,403);
 }finally{await new Promise(resolve=>server.close(resolve));await fs.rm(root,{recursive:true,force:true});}
});
