import * as T from 'three';

// These are presentation finishes for the supplied teaching models, not
// assertions about the manufacturers' original materials or colourways.
const FINISHES={
  shell:{color:'#bdc3c5',metalness:.16,roughness:.62},
  silver:{color:'#929ea5',metalness:.38,roughness:.49},
  steel:{color:'#7d8a94',metalness:.42,roughness:.55},
  graphite:{color:'#414a51',metalness:.12,roughness:.72},
  rubber:{color:'#292f34',metalness:.01,roughness:.88},
  glass:{color:'#29343c',metalness:.22,roughness:.3},
  fabric:{color:'#778185',metalness:.02,roughness:.91},
  lens:{color:'#c2cdd2',metalness:.12,roughness:.32},
  board:{color:'#30393f',metalness:.08,roughness:.78},
  silicon:{color:'#5c6972',metalness:.23,roughness:.6},
  carShell:{color:'#aeb8bf',metalness:.32,roughness:.5},
};

export function productFinish(product,original,{special=false}={}){
  const name=original.name||'',c=original.color||new T.Color(.5,.5,.5),l=c.r*.2126+c.g*.7152+c.b*.0722;
  let role=l<.035?'rubber':l<.16?'graphite':l<.58?'silver':'shell';
  if(product==='SU7'){
    if(/Car_body/i.test(name))role='carShell';
    else if(/window/i.test(name))role='glass';
    else if(/wheel|black|radar|inside/i.test(name))role='rubber';
    else if(/interior/i.test(name))role='graphite';
    else if(/backlight/i.test(name))role='graphite';
    else if(/light/i.test(name))role='lens';
    else if(/iron|logo|ChePai/i.test(name))role='steel';
  }else if(product==='Rubin'){
    if(/mask|epoxy|polymer|laminated_body/i.test(name))role='board';
    else if(/pattern/i.test(name))role='silicon';
    else if(/nickel|contact|leadframe/i.test(name))role='steel';
    else if(/metal_top/i.test(name))role='shell';
  }else if(product==='VisionPro'){
    if(special&&l>.12)role='fabric';
    else if(l<.09)role='glass';
  }
  return {role,key:role,parameters:FINISHES[role]};
}

export function makeProductMaterial(finish){
  const material=new T.MeshStandardMaterial({...finish.parameters,side:T.DoubleSide});
  material.name='Industrial study / '+finish.role;
  material.userData.presentationFinish=finish.role;
  return material;
}
