// User requested a little leather character. Keep the accepted geometry and
// use the existing fine grain, at lower relief and with restrained reflections.
export function finishLeatherBeret(hat){
 hat.name='Dot / restrained fine-grain black leather beret v007';
 hat.color.set('#151312');hat.roughness=.49;hat.specularIntensity=.36;
 hat.sheen=.08;hat.sheenRoughness=.9;hat.clearcoat=.055;hat.clearcoatRoughness=.5;
 const base=hat.onBeforeCompile;
 hat.onBeforeCompile=shader=>{base(shader);shader.fragmentShader=shader.fragmentShader.replace('*0.000380*dotDetail','*0.000075*dotDetail').replace('*.055*dotDetail','*.025*dotDetail');};
 hat.customProgramCacheKey=()=> 'dot-fine-leather-beret-v007';hat.needsUpdate=true;
}
