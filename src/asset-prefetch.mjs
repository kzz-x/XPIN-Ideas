const pending=new Map();
export function assetBytes(path){
 const url=new URL(path,location.href).href;
 if(!pending.has(url))pending.set(url,fetch(url,{priority:'low'}).then(r=>{if(!r.ok)throw Error('资源暂未载入：'+r.status);return r.arrayBuffer();}).catch(e=>{pending.delete(url);throw e;}));
 return pending.get(url);
}
export async function assetJSON(path){return JSON.parse(new TextDecoder().decode(await assetBytes(path)));}
export function prefetchProducts(){return Promise.all(['G1','Rubin','SU7','VisionPro'].map(id=>assetBytes(new URL('../assets/products/'+id+'.glb',import.meta.url))));}
