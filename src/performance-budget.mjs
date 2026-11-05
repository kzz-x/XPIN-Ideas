export function constrainedDevice({memory=globalThis.navigator?.deviceMemory,cores=globalThis.navigator?.hardwareConcurrency}={}){
  return memory>0&&memory<=4||cores>0&&cores<=4;
}
export function nextRasterScale(samples,scale,secondsSinceChange){
  if(samples.length<60)return scale;
  const ordered=[...samples].sort((a,b)=>a-b),p75=ordered[Math.floor(ordered.length*.75)],p90=ordered[Math.floor(ordered.length*.9)];
  if(p75>26&&secondsSinceChange>2&&scale>.55)return Math.max(.55,scale-.12);
  if(p90<18.4&&secondsSinceChange>25&&scale<1)return Math.min(1,scale+.04);
  return scale;
}
