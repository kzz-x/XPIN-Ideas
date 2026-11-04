export const QUALITY_PROFILES=Object.freeze({
 high:Object.freeze({dprCap:1.5,dofSamples:16,dofScale:1,msaaSamples:4,backdropWidth:768,haloWidth:256,reflectionWidth:512,halo:true,reflection:true}),
 medium:Object.freeze({dprCap:1,dofSamples:8,dofScale:1,msaaSamples:2,backdropWidth:640,haloWidth:192,reflectionWidth:384,halo:true,reflection:true}),
 low:Object.freeze({dprCap:.75,dofSamples:4,dofScale:.5,msaaSamples:0,backdropWidth:480,haloWidth:128,reflectionWidth:256,halo:false,reflection:false})
});
export function qualitySettings(name='medium',{deviceDPR=1,dofEnabled=true,samples}={}){
 const p=QUALITY_PROFILES[name];if(!p)throw Error('Unknown render quality '+name);
 return{...p,name,pixelRatio:Math.min(Math.max(.5,Number(deviceDPR)||1),p.dprCap),dofEnabled:!!dofEnabled,dofSamples:[4,8,16].includes(Number(samples))?Number(samples):p.dofSamples};
}
export function applyRenderQuality(renderer,stage,name,options={}){
 const q=qualitySettings(name,options);renderer.setPixelRatio(q.pixelRatio);
 stage.focus.configure({enabled:q.dofEnabled,samples:q.dofSamples,scale:q.dofScale,msaa:q.msaaSamples});stage.backdrop.configure({maxWidth:q.backdropWidth,haloWidth:q.haloWidth,halo:q.halo});stage.reflection.configure({enabled:q.reflection,width:q.reflectionWidth});return q;
}
