export class ListeningGate{
 constructor(seconds=2){this.duration=seconds;this.reset();}
 reset(){this.elapsed=0;this.ready=false;this.adjusting=false;this.cooldown=0;}
 adjusted(){this.cooldown=.65;}
 update(dt,{paused=false}={}){dt=Math.max(0,Math.min(.1,dt));this.cooldown=Math.max(0,this.cooldown-dt);if(!paused&&!this.adjusting&&this.cooldown===0)this.elapsed=Math.min(this.duration,this.elapsed+dt);return this.snapshot();}
 snapshot(){return{elapsed:this.elapsed,ready:this.ready,adjusting:this.adjusting,progress:Math.min(this.ready?1:.96,this.elapsed/this.duration),done:this.ready&&this.elapsed>=this.duration};}
}
