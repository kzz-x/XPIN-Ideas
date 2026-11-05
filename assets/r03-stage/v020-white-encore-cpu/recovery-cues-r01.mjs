import {SHOT} from './document.mjs';
const clamp=x=>Math.max(0,Math.min(1,x));
export const smooth=(a,b,t)=>{const x=clamp((t-a)/(b-a));return x*x*x*(10+x*(-15+6*x));};
export function recoveryCues(time){
 const backgroundPhase=Math.max(0,(time-SHOT.islandStart)/1.3),backgroundProgress=clamp(backgroundPhase),backgroundMix=smooth(0,1,backgroundProgress);
 return {backgroundPhase,backgroundProgress,backgroundMix,oldStageShadowGain:1-backgroundMix,
  musicEnd:SHOT.musicEnd,pullStart:SHOT.pullStart,pullEnd:SHOT.pullEnd,
  hornDissolveStart:SHOT.musicEnd+.05,hornGone:SHOT.musicEnd+.80,
  eyeFront:smooth(SHOT.musicEnd+.05,SHOT.musicEnd+.80,time),
  speaking:time>=SHOT.speechStart&&time<SHOT.speechEnd,
  islandStart:SHOT.islandStart,transferStart:SHOT.transferStart,
  colourStart:SHOT.colourStart,colourEnd:SHOT.colourEnd,
  colourMix:backgroundMix,
  transferMix:smooth(SHOT.transferStart,SHOT.gameEnd,time),
  uiEarliest:SHOT.gameEnd,celebrationStart:6,
 };
}

/** Public cross-scene contract. Same albedo; only received-light context blends.
 * These numbers are inputs, not a claim that unlike scene lights match pixels. */
export function handoffAppearance(time){
 const p=recoveryCues(time).colourMix;
 return {version:'dot-handoff-appearance/1',albedo:'#397efb',mix:p,
  environmentIntensity:.319+(1.1-.319)*p,
  bodyGain:.74+(.5-.74)*p,hatGain:.74+(.35-.74)*p,
  hatSaturation:1+(.15-1)*p,frontOnly:true};
}

export const oldStageShadowGain=time=>recoveryCues(time).oldStageShadowGain;
