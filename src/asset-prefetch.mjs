const pending=new Map();
const queue=[];let active=0;
function background(job){
 return new Promise((resolve,reject)=>{queue.push({job,resolve,reject});drain();});
}
function drain(){
 while(active<2&&queue.length){
  const task=queue.shift();active++;
  Promise.resolve().then(task.job).then(task.resolve,task.reject).finally(()=>{active--;drain();});
 }
}
export function assetBytes(path){
 const url=new URL(path,location.href).href;
 if(!pending.has(url))pending.set(url,background(async()=>{const response=await fetch(url,{priority:'low'});if(!response.ok)throw Error('资源暂未载入：'+response.status);return response.arrayBuffer();}).catch(e=>{pending.delete(url);throw e;}));
 return pending.get(url);
}
export async function assetJSON(path){return JSON.parse(new TextDecoder().decode(await assetBytes(path)));}
export function prefetchProducts(){return Promise.all(['G1','Rubin','SU7','VisionPro'].map(id=>assetBytes(new URL('../assets/products/'+id+'.glb',import.meta.url))));}

// Speculative covers share the bounded background queue with models. Keep the
// decoded images alive until the real cards adopt the same browser-cache URLs.
const pictures=new Map();
export function prefetchImages(paths){
 return Promise.all([...new Set(paths)].filter(Boolean).map(path=>{
  const url=new URL(path,location.href).href;
  if(!pictures.has(url))pictures.set(url,background(async()=>{
   const image=new Image();image.fetchPriority='low';image.decoding='async';image.src=url;await image.decode();return image;
  }).catch(error=>{pictures.delete(url);throw error;}));
  return pictures.get(url);
 }));
}
