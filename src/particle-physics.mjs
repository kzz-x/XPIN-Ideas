/** Fixed-step semi-implicit Euler. Position is never interpolated along a
 * prescribed path: velocity integrates curl force, drag and target springs. */
export const STEP=1/120;
export function curlField(x,y,z,t,out){
  const a=x*.7-t*.8,b=y*.7+t*.5,c=z*.8+t*.6,d=x*.65+t*.3,e=y*.75+t,f=z*.6-t*.7;
  out[0]=-.7*Math.sin(a)*Math.sin(b)-.8*Math.cos(c)*Math.cos(d);
  out[1]=-.6*Math.sin(e)*Math.sin(f)-.7*Math.cos(a)*Math.cos(b);
  out[2]=-.65*Math.sin(c)*Math.sin(d)-.75*Math.cos(e)*Math.cos(f);return out;
}
export const saturate=x=>Math.max(0,Math.min(1,x));
const easing=x=>{x=saturate(x);return x*x*(3-2*x);};
export class ParticlePhysics{
 constructor(count){this.count=count;this.position=new Float32Array(count*3);this.velocity=new Float32Array(count*3);this.origin=new Float32Array(count*3);this.target=new Float32Array(count*3);this.release=new Float32Array(count);this.settled=new Uint8Array(count);this.clock=0;this.accumulator=0;this.steps=0;this.field=[0,0,0];this.maxSpeed=0;}
 reset(){this.position.set(this.origin);this.velocity.fill(0);this.settled.fill(0);this.clock=0;this.accumulator=0;this.steps=0;this.maxSpeed=0;}
 advance(dt){this.accumulator+=Math.min(.08,Math.max(0,dt));while(this.accumulator>=STEP){this.step(STEP);this.accumulator-=STEP;}return this.snapshot();}
 step(h){
  const t=this.clock+=h,gather=easing((t-2.1)/2.5),lock=easing((t-4.3)/1.4),k=3+gather*145,drag=1.3+gather*23,turbulence=3.6*(1-gather)*(1-lock);
  let maxSpeed=0;
  for(let i=0;i<this.count;i++){
   const j=i*3,age=t-this.release[i];if(age<0)continue;
   if(this.settled[i])continue;
   if(age<h){const x=this.origin[j],y=this.origin[j+1];this.velocity[j]=x*.22+Math.sin(i*2.399)*.8;this.velocity[j+1]=.45+Math.cos(i*.91)*.7;this.velocity[j+2]=1.2+Math.sin(i*.43)*1.2;}
   const x=this.position[j],y=this.position[j+1],z=this.position[j+2];curlField(x*.62,y*.62,z*.62,t*.8,this.field);
   let error=0,speed=0;
   for(let axis=0;axis<3;axis++){
    const n=j+axis,delta=this.target[n]-this.position[n],bound=Math.max(axis===2?3.7:axis===0?10.8:7.5,Math.abs(this.target[n])+2);
    const containment=Math.abs(this.position[n])>bound?-Math.sign(this.position[n])*(Math.abs(this.position[n])-bound)*20:0;
    const force=this.field[axis]*turbulence+delta*k*gather+containment+(axis===1?.16*(1-gather):0);
    this.velocity[n]=(this.velocity[n]+force*h)*Math.exp(-drag*h);this.position[n]+=this.velocity[n]*h;error+=delta*delta;speed+=this.velocity[n]*this.velocity[n];
   }
   maxSpeed=Math.max(maxSpeed,Math.sqrt(speed));
   if(t>5&&error<.000018&&speed<.0016){this.settled[i]=1;this.position.set(this.target.subarray(j,j+3),j);this.velocity.fill(0,j,j+3);}
  }this.maxSpeed=maxSpeed;this.steps++;
 }
 snapshot(){let settled=0,error=0;for(let i=0;i<this.count;i++){settled+=this.settled[i];if(this.clock>this.release[i]){const j=i*3;error=Math.max(error,Math.hypot(this.position[j]-this.target[j],this.position[j+1]-this.target[j+1],this.position[j+2]-this.target[j+2]));}}return {count:this.count,settled,maxTargetError:error,time:this.clock,steps:this.steps,step:STEP,maxSpeed:this.maxSpeed,method:'semi-implicit Euler; analytic divergence-free curl; spring attraction; drag',opacityAnimation:false};}
}
