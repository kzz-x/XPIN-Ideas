import {gsap} from '../v011/DotSharedWeb/vendor/gsap/gsap-core.js';

// A paused, seekable environment score. Manual phrases are authoritative;
// missing/deleted phrases simply omit their associated cue. No actor channels.
export function createEncoreCues(score={}) {
 const origin=1.8+(Number.isFinite(score.offset)?score.offset:0);
 const phrases=(score.phrases||[]).map(p=>({id:p.id,start:p.start+origin,end:p.end+origin,inhale:p.inhaleStart+origin}));
 const a=phrases.find(p=>p.id==='phrase-a'),b=phrases.find(p=>p.id==='phrase-b'),c=phrases.find(p=>p.id==='phrase-c');
 const state={wing:0,portal:.04,canopy:0,celebration:0,settle:0};
 const timeline=gsap.timeline({paused:true,defaults:{lazy:false,overwrite:false}});
 const add=(values,time)=>{if(Number.isFinite(time))timeline.to(state,values,Math.max(0,time));};
 add({wing:.3,duration:1.1,ease:'sine.inOut'},1.8);
 if(a)add({portal:.42,duration:1.75,ease:'power1.inOut'},a.start+.3);
 if(b)add({wing:.46,duration:1.9,ease:'sine.inOut'},b.start+.2);
 if(c){add({canopy:.65,duration:1.05,ease:'power2.inOut'},c.inhale-.35);add({celebration:.46,duration:.68,ease:'power2.out'},c.start+.2);add({settle:1,celebration:.13,wing:.28,duration:.75,ease:'sine.inOut'},c.end);}
 gsap.ticker.sleep();
 return {timeline,phrases,gsapVersion:gsap.version,sample(time){if(!Number.isFinite(time))throw Error('Finite seconds required');timeline.seek(Math.max(0,time),true);gsap.ticker.sleep();return Object.fromEntries(Object.entries(state).filter(([,v])=>typeof v==='number'));},dispose(){timeline.kill();gsap.ticker.sleep();}};
}
