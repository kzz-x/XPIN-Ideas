/** CPU-prepared lighting isolation/candidate; deliberately NOT wired into v011.
 * No renderer, RAF, movement, texture mask or new shader. Visual acceptance pending.
 */
export const LONG_SHADOW_CASTERS=Object.freeze(['MOUTHPIECE_RIGID','TRUMPET_LEADPIPE','LEAD_RECEIVER']);
export const LIGHTING_CANDIDATE=Object.freeze({
 enabled:false,
 suppressLongTubeShadows:true,
 bodyEnvironmentScale:.55,
 status:'CPU_PREPARED_UNRENDERED_NOT_APPROVED'
});
export function applyLightingCandidate(stage,dot,{enabled=false,suppressLongTubeShadows=true,bodyEnvironmentScale=.55}={}){
 if(!stage?.scene||!dot?.horn||!dot?.materials?.body||!dot?.materials?.fuzz)throw Error('Missing accepted Dot/stage interfaces');
 if(!Number.isFinite(bodyEnvironmentScale)||bodyEnvironmentScale<.25||bodyEnvironmentScale>1)throw Error('Body environment scale must be .25..1');
 if(enabled&&!stage.scene.environment)throw Error('Accepted stage environment missing');
 const casters=[];dot.horn.traverse(o=>{if(o.isMesh)casters.push([o,o.castShadow]);});
 const surfaces=[dot.materials.body,dot.materials.fuzz],original=surfaces.map(m=>({map:m.envMap,intensity:m.envMapIntensity}));
 if(enabled){
  // Pixel-informed R2: suppress the long stem/leadpipe/receiver projection;
  // KEEP cup contact, bell/valves, hat and body shadow participation.
  if(suppressLongTubeShadows)for(const [mesh]of casters)if(LONG_SHADOW_CASTERS.includes(mesh.name))mesh.castShadow=false;
  // This local Three renderer overrides envMapIntensity with scene intensity
  // while material.envMap is null. Explicitly bind the SAME accepted scene HDR
  // to these two materials; scale its effective .58 radiance, not global scene.
  // Albedo/sheen/roughness/fibre atlas/normals and rim/key lights unchanged.
  surfaces.forEach((m,i)=>{m.envMap=original[i].map||stage.scene.environment;m.envMapIntensity=(original[i].map?original[i].intensity:stage.scene.environmentIntensity)*bodyEnvironmentScale;m.needsUpdate=true;});
 }
 let disposed=false;return{status:enabled?'CPU_CANDIDATE_ACTIVE_NOT_VISUALLY_VERIFIED':'DISABLED_BASELINE',settings:{enabled,suppressLongTubeShadows,bodyEnvironmentScale,preservedCupContactShadow:true},dispose(){if(disposed)return;disposed=true;for(const [mesh,cast]of casters)mesh.castShadow=cast;if(enabled)surfaces.forEach((m,i)=>{m.envMap=original[i].map;m.envMapIntensity=original[i].intensity;m.needsUpdate=true;});}};
}
