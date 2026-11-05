import {SHOT} from './retirement-timing.mjs';
export const smooth=(a,b,t)=>{const u=Math.max(0,Math.min(1,(t-a)/(b-a)));return u*u*(3-2*u)};
export const random=(id,salt)=>{const x=Math.sin(id*127.1+salt*311.7)*43758.5453123;return x-Math.floor(x)};
export function threshold(point,minX,span){const axis=Math.max(0,Math.min(1,(point[0]-minX)/span)),n=Math.sin(point[0]*91.7+point[1]*137.2+point[2]*173.1)*43758.5453;return Math.max(.025,Math.min(.975,.08+.84*(1-axis)+.09*((n-Math.floor(n))-.5)));}
export function progress(time){return smooth(SHOT.musicEnd+.05,SHOT.musicEnd+.80,time)}
export function birthForThreshold(value){let lo=0,hi=1;for(let k=0;k<20;k++){const m=(lo+hi)/2;if(m*m*(3-2*m)<value)lo=m;else hi=m}return SHOT.musicEnd+.05+.75*(lo+hi)/2}
export function sampleGrain(seed,time,out={}){const age=time-seed.birth,life=seed.life;out.alpha=age<0||age>life?0:smooth(0,.028,age)*(1-smooth(life*.65,life,age));const a=Math.max(0,age),drag=1.45,e=Math.exp(-drag*a),q=(1-e)/drag;out.x=seed.origin[0]+seed.velocity[0]*q;out.y=seed.origin[1]+(seed.velocity[1]+9.81/drag)*q-9.81*a/drag;out.z=seed.origin[2]+seed.velocity[2]*q;out.rx=seed.spin[0]*a;out.ry=seed.spin[1]*a;out.rz=seed.spin[2]*a;if(out.y< -1.65)out.alpha=0;return out;}
