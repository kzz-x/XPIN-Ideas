// Calibrated after the user's three channel faders, including native film audio.
export const MASTER_BOOST_DB=8;
export const OPENING_TRIM_DB=-5;
export const MASTER_CEILING_DB=-2;
export const dbToGain=db=>Math.pow(10,db/20);

export function makeSafetyCurve(size=65537){
 const curve=new Float32Array(size),ceiling=dbToGain(MASTER_CEILING_DB),knee=.68;
 for(let i=0;i<size;i++){
  const x=i/(size-1)*2-1,a=Math.abs(x);
  curve[i]=Math.sign(x)*(a<=knee?a:knee+(ceiling-knee)*Math.tanh((a-knee)/(ceiling-knee)));
 }
 return curve;
}

export function createAudioMaster(context){
 const input=context.createGain(),boost=context.createGain(),compressor=context.createDynamicsCompressor(),output=context.createWaveShaper();
 boost.gain.value=dbToGain(MASTER_BOOST_DB);
 compressor.threshold.value=-3;compressor.knee.value=3;compressor.ratio.value=20;compressor.attack.value=.001;compressor.release.value=.09;
 output.curve=makeSafetyCurve();output.oversample='4x';
 input.connect(boost).connect(compressor).connect(output);output.connect(context.destination);
 const media=new WeakMap();let sources=0;
 return{input,output,
  connectMediaElement(element){if(media.has(element))return media.get(element);const node=context.createMediaElementSource(element);node.connect(input);media.set(element,node);sources++;return node;},
  snapshot:()=>({boostDb:MASTER_BOOST_DB,ceilingDb:MASTER_CEILING_DB,openingTrimDb:OPENING_TRIM_DB,mediaSources:sources,reductionDb:compressor.reduction})
 };
}
