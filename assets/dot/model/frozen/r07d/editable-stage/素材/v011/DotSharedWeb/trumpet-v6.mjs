import * as T from './vendor/three.module.js';

// All dimensions are mouth-anchor local scene units. A=horn axis, H=up,
// S=depth. Continuous swept centre lines and a double-sided thin bell profile.
// No animation, camera, body or mouthpiece geometry lives in this builder.
export function makeTrumpetV6(axis,up,materials){
 const side=new T.Vector3().crossVectors(up,axis).normalize(),parts=[];
 const p=(a,h,s=0)=>axis.clone().multiplyScalar(a).addScaledVector(up,h).addScaledVector(side,s);
 const basis=new T.Matrix4().makeBasis(side,up,axis);
 function add(g,name,material=materials.gold){g.computeBoundingBox();parts.push({geometry:g,name,material});return g;}
 function lathe(profile,a,s,name,material=materials.gold,vertical=true){
  const g=new T.LatheGeometry(profile.map(([r,h])=>new T.Vector2(r,h)),64);
  g.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),vertical?up:axis));
  g.translate(...p(a,0,s).toArray());return add(g,name,material);
 }
 function curve(start,commands){const c=new T.CurvePath();let q=p(...start);
  for(const cmd of commands){const e=p(...cmd.at(-1));c.add(cmd.length===1?new T.LineCurve3(q,e):new T.CubicBezierCurve3(q,p(...cmd[0]),p(...cmd[1]),e));q=e;}return c;}
 function tube(start,commands,r,name,segments=128,material=materials.gold){return add(new T.TubeGeometry(curve(start,commands),segments,r,24,false),name,material);}
 function collar(a,h,s,along,name,r=.041){
  const g=new T.LatheGeometry([[r-.004,-.016],[r,-.016],[r+.002,-.012],[r+.002,.012],[r,.016],[r-.004,.016]].map(v=>new T.Vector2(...v)),48);
  g.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),along));g.translate(...p(a,h,s).toArray());return add(g,name,materials.goldDetail);
 }
 // Leadpipe enters a broad tangent U bend and returns to valve one. The
 // straight and bent spans are one sweep, so they cannot form hard butt seams.
 tube([.205,0,0],[[[1.50,0,0]],[[1.76,0,0],[1.80,-.33,0],[1.53,-.33,0]],[[.88,-.33,0]],[[.70,-.33,0],[.70,-.18,-.055],[.875,-.18,-.055]]],.035,'TRUMPET_LEADPIPE',192);
 // The bell tail leaves valve three, loops behind the block and rises into
 // the flared throat with matching centre and tangents.
 tube([1.252,-.32,.035],[[[.67,-.32,.14]],[[.35,-.32,.14],[.35,.13,.15],[.68,.13,.15]],[[1.42,.13,.15]]],.040,'TRUMPET_RETURN',144);
 collar(.28,0,0,axis,'LEAD_RECEIVER',.040);
 collar(1.48,0,0,axis,'TUNING_SLIDE_SLEEVE_A',.040);
 collar(1.48,-.33,0,axis,'TUNING_SLIDE_SLEEVE_B',.040);
 // Thin continuous bell wall: outer surface, rolled rim, inner return.
 // Radius grows with slope continuity from the existing tubular throat.
 const profile=[],L=.84,R=.414,t0=1.42;
 const radius=t=>.040+(R-.040)*Math.pow(t,3.8);
 for(let i=0;i<=64;i++){const t=i/64;profile.push([radius(t),t0+L*t]);}
 // Rolled edge is a small round bead, rather than a thick cut cone.
 for(let i=1;i<=12;i++){const a=i/12*Math.PI;profile.push([R-.007+.007*Math.cos(a),t0+L+.007*Math.sin(a)]);}
 for(let i=63;i>=0;i--){const t=i/64;profile.push([radius(t)-.014,t0+L*t]);}
 profile.push([.040,t0]);
 const bell=new T.LatheGeometry(profile.map(v=>new T.Vector2(...v)),96);
 bell.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),axis));bell.translate(...p(0,.13,.15).toArray());
 bell.clearGroups();const band=96*6;bell.addGroup(0,64*band,0);bell.addGroup(64*band,12*band,0);bell.addGroup(76*band,(profile.length-1-76)*band,1);
 add(bell,'TRUMPET_DOUBLE_WALL_BELL',[materials.gold,materials.inner]);
 // Each valve body has turned shoulders/end caps built into one profile.
 for(let i=0;i<3;i++){
  const a=.8748+i*.1886,s=-.055;
  lathe([[0,-.483],[.060,-.483],[.071,-.480],[.074,-.473],[.074,-.461],[.066,-.454],[.063,-.443],[.063,-.225],[.065,-.220],[.065,-.211],[.063,-.205],[.063,.047],[.066,.057],[.073,.060],[.075,.066],[.075,.080],[.071,.087],[.059,.090],[.027,.090],[.027,.098],[0,.098]],a,s,'VALVE_'+i);
  // Short inset piston stems and gently domed touch buttons.
  lathe([[0,.096],[.019,.096],[.021,.100],[.021,.198],[.019,.202],[0,.202]],a,s,'VALVE_STEM_'+i,materials.silver);
  lathe([[0,.195],[.040,.195],[.053,.198],[.057,.204],[.057,.215],[.053,.223],[.040,.228],[0,.230]],a,s,'VALVE_BUTTON_'+i);
  const h=-.23-i*.022,reach=.22+i*.035;
  tube([a,h,s+.04],[[[a,h,reach]],[[a,h,reach+.095],[a+.085,h-.11,reach+.095],[a+.085,h-.11,reach]],[[a,h-.11,s+.04]]],.025,'VALVE_SLIDE_'+i,72);
  collar(a,h,.11,side,'SLIDE_FERRULE_'+i,.030);
 }
 // Small structural stays terminate inside actual pipes, not in free space.
 tube([.65,-.01,0],[[[.65,-.32,.12]]],.010,'PIPE_BRACE_068',8,materials.goldDetail);
 tube([1.36,-.01,0],[[[1.36,.13,.15]]],.010,'PIPE_BRACE_155',8,materials.goldDetail);
 // Open finger hook attached to the leadpipe; no floating torus.
 tube([1.30,.028,0],[[[1.285,.15,0],[1.35,.20,0],[1.40,.16,0]]],.010,'FINGER_RING',48);
 return parts;
}
