import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const base=path.dirname(fileURLToPath(import.meta.url));
const sourceMode=process.argv.includes('--source')||process.env.SITE_ROOT==='source';
const root=sourceMode?base:fs.existsSync(path.join(base,'dist/index.html'))?path.join(base,'dist'):base;
const port=Number(process.env.PORT||process.argv.find(arg=>/^\d+$/.test(arg))||4186);
const host=process.env.HOST||'127.0.0.1';
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml','.woff':'font/woff','.woff2':'font/woff2','.mp4':'video/mp4','.m4a':'audio/mp4','.glb':'model/gltf-binary','.gltf':'model/gltf+json','.wasm':'application/wasm','.bin':'application/octet-stream','.md':'text/plain; charset=utf-8'};

export function createStaticServer(directory=root){
 return http.createServer((req,res)=>{
  if(!['GET','HEAD'].includes(req.method)){res.writeHead(405,{Allow:'GET, HEAD'}).end();return;}
  let decoded;
  try{decoded=decodeURIComponent(new URL(req.url,'http://localhost').pathname);}catch{res.writeHead(400).end();return;}
  const file=path.resolve(directory,'.'+decoded+(decoded.endsWith('/')?'index.html':''));
  const relative=path.relative(directory,file);
  if(relative.startsWith('..')||path.isAbsolute(relative)||relative.split(path.sep).some(part=>part.startsWith('.'))){res.writeHead(403).end();return;}
  fs.stat(file,(error,stat)=>{
   if(error||!stat.isFile()){res.writeHead(404).end('Not found');return;}
   const etag=`"${stat.size.toString(16)}-${Math.trunc(stat.mtimeMs).toString(16)}"`;
   const immutable=/[a-f0-9]{10,}.*\.bin$/i.test(file);
   const headers={'Content-Type':types[path.extname(file)]||'application/octet-stream','Accept-Ranges':'bytes','Cache-Control':sourceMode?'no-store':immutable?'public, max-age=31536000, immutable':'public, max-age=0, must-revalidate','ETag':etag,'X-Content-Type-Options':'nosniff'};
   if(req.headers['if-none-match']===etag&&!req.headers.range){res.writeHead(304,headers).end();return;}
   let start=0,end=stat.size-1,status=200;
   if(req.headers.range&&(!req.headers['if-range']||req.headers['if-range']===etag)){
    const match=/^bytes=(\d*)-(\d*)$/.exec(req.headers.range);
    if(!match||(!match[1]&&!match[2])){res.writeHead(416,{'Content-Range':`bytes */${stat.size}`}).end();return;}
    start=match[1]?Number(match[1]):Math.max(0,stat.size-Number(match[2]));
    end=match[1]&&match[2]?Math.min(end,Number(match[2])):end;
    if(start>end||start>=stat.size){res.writeHead(416,{'Content-Range':`bytes */${stat.size}`}).end();return;}
    status=206;headers['Content-Range']=`bytes ${start}-${end}/${stat.size}`;
   }
   headers['Content-Length']=end-start+1;
   res.writeHead(status,headers);
   if(req.method==='HEAD'){res.end();return;}
   const stream=fs.createReadStream(file,{start,end});
   stream.on('error',()=>res.destroy());
   res.on('close',()=>stream.destroy());
   stream.pipe(res);
  });
 });
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 createStaticServer().listen(port,host,()=>process.stdout.write(`Local: http://${host==='0.0.0.0'?'127.0.0.1':host}:${port}\nRoot: ${root}\n`));
}
