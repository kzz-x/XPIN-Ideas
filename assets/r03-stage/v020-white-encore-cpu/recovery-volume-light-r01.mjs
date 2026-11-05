import * as T from '../../dot/model/frozen/r07d/editable-stage/素材/v011/DotSharedWeb/vendor/three.module.js';

/** Bounded cone volume, with a camera ray integrated through its density.
 * This replaces the former camera-facing white shaft planes. */
export function makeVolumeGeometry(){return new T.CylinderGeometry(.5,.018,1,64,1,true);}
export function makeVolumeMaterial(){
 return new T.ShaderMaterial({transparent:true,depthWrite:false,depthTest:true,side:T.BackSide,blending:T.AdditiveBlending,toneMapped:false,
  uniforms:{gain:{value:0},time:{value:0},beamFrom:{value:new T.Vector3()},beamTo:{value:new T.Vector3()},beamWidth:{value:1},floorY:{value:-1.67}},
  vertexShader:'varying vec3 volumeWorld;void main(){vec4 w=modelMatrix*vec4(position,1.);volumeWorld=w.xyz;gl_Position=projectionMatrix*viewMatrix*w;}',
  fragmentShader:`varying vec3 volumeWorld;uniform vec3 beamFrom,beamTo;uniform float beamWidth,gain,time,floorY;
void main(){
 vec3 delta=beamTo-beamFrom;float len=length(delta);vec3 axis=delta/max(len,.001);
 vec3 ray=volumeWorld-cameraPosition;float distanceToExit=length(ray);ray/=max(distanceToExit,.001);
 vec3 centre=(beamFrom+beamTo)*.5,oc=cameraPosition-centre;
 float radius=sqrt(len*len*.25+beamWidth*beamWidth*.25),b=dot(oc,ray),disc=b*b-dot(oc,oc)+radius*radius;
 if(disc<=0.)discard;
 float nearT=max(0.,-b-sqrt(disc)),farT=min(distanceToExit,-b+sqrt(disc));
 // Clip to the actual finite cone before integration. Sampling its much larger
 // enclosing sphere left most taps empty and produced visible density bands.
 vec3 origin=cameraPosition-beamFrom;
 float h0=dot(origin,axis),hd=dot(ray,axis);
 if(abs(hd)>.00001){float t0=-h0/hd,t1=(len-h0)/hd;nearT=max(nearT,min(t0,t1));farT=min(farT,max(t0,t1));}
 float r0=beamWidth*.018,k=(beamWidth*.5-r0)/max(len,.001),rAtOrigin=r0+k*h0;
 vec3 perpendicularOrigin=origin-axis*h0,perpendicularRay=ray-axis*hd;
 float qa=dot(perpendicularRay,perpendicularRay)-k*k*hd*hd;
 float qb=dot(perpendicularOrigin,perpendicularRay)-rAtOrigin*k*hd;
 float qc=dot(perpendicularOrigin,perpendicularOrigin)-rAtOrigin*rAtOrigin;
 if(qa>.00001){float coneDisc=qb*qb-qa*qc;if(coneDisc<=0.)discard;float root=sqrt(coneDisc);nearT=max(nearT,(-qb-root)/qa);farT=min(farT,(-qb+root)/qa);}
 if(ray.y<-.00001)farT=min(farT,(floorY+.005-cameraPosition.y)/ray.y);
 if(farT<=nearT)discard;
 float stepSize=(farT-nearT)/24.,integral=0.;
 for(int i=0;i<24;i++){
  vec3 p=cameraPosition+ray*(nearT+(float(i)+.5)*stepSize)-beamFrom;
  float h=dot(p,axis),u=h/max(len,.001),width=mix(r0,beamWidth*.5,clamp(u,0.,1.));
  float radial=length(p-axis*h)/max(width,.001);
  float inside=step(0.,u)*step(u,1.);
  float density=exp(-radial*radial*3.4)*(1.-smoothstep(.80,1.,radial));
  float ends=smoothstep(0.,.025,u)*(1.-smoothstep(.94,1.,u));
  float haze=.94+.06*sin(p.x*1.7+p.y*2.3+p.z*1.1-time*.12);
  float groundFade=smoothstep(floorY,floorY+.25,p.y+beamFrom.y);
  integral+=inside*density*ends*haze*groundFade*stepSize;
 }
 float proxyFade=smoothstep(floorY+.015,floorY+.5,volumeWorld.y);
 float a=min(.26,(1.-exp(-integral*.22))*gain*2.1)*proxyFade;
 if(a<.00003)discard;gl_FragColor=vec4(vec3(1.),a);
}`});
}
