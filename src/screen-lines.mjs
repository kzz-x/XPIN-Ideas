// Independent screen-space strokes. One instanced draw replaces a line batch;
// its width is in CSS pixels and its edge coverage is analytic at every angle.
// No extra framebuffer, supersampling pass, or change to the scene geometry.
export function screenLines(T, positions, {color=0xc7d9e5,opacity=.5,width=1.1}={}) {
  if (positions.length % 6) throw Error('Screen lines require start/end triples');
  const count=positions.length/6,starts=new Float32Array(count*3),ends=new Float32Array(count*3);
  for(let i=0;i<count;i++) { starts.set(positions.slice(i*6,i*6+3),i*3); ends.set(positions.slice(i*6+3,i*6+6),i*3); }
  const geometry=new T.InstancedBufferGeometry();
  geometry.setAttribute('position',new T.Float32BufferAttribute([-1,-1,0,1,-1,0,-1,1,0,1,1,0],3));
  // Screen axes are (normal, direction), whose determinant is negative.
  // Reverse the quad winding so its visible face points towards the camera.
  geometry.setIndex([0,2,1,2,3,1]);
  geometry.setAttribute('lineStart',new T.InstancedBufferAttribute(starts,3));
  geometry.setAttribute('lineEnd',new T.InstancedBufferAttribute(ends,3));
  geometry.instanceCount=count;
  geometry.boundingBox=new T.Box3();
  const point=new T.Vector3();for(let i=0;i<positions.length;i+=3)geometry.boundingBox.expandByPoint(point.fromArray(positions,i));
  geometry.boundingSphere=geometry.boundingBox.getBoundingSphere(new T.Sphere());
  const material=new T.ShaderMaterial({
    uniforms:{diffuse:{value:new T.Color(color)},opacity:{value:opacity},strokeWidth:{value:width},resolution:{value:new T.Vector2(1,1)}},
    transparent:true,depthWrite:false,toneMapped:false,
    vertexShader:`
      attribute vec3 lineStart; attribute vec3 lineEnd;
      uniform vec2 resolution; uniform float strokeWidth;
      varying vec2 vOffset; varying float vLength; varying float vVisible;
      void main(){
        vec4 start=modelViewMatrix*vec4(lineStart,1.0),end=modelViewMatrix*vec4(lineEnd,1.0);
        float nearZ=projectionMatrix[3][2]/(projectionMatrix[2][2]-1.0);
        vVisible=(start.z>-nearZ&&end.z>-nearZ)?0.0:1.0;
        if(start.z>-nearZ&&end.z<=-nearZ)start=mix(start,end,(-nearZ-start.z)/(end.z-start.z));
        if(end.z>-nearZ&&start.z<=-nearZ)end=mix(end,start,(-nearZ-end.z)/(start.z-end.z));
        vec4 a=projectionMatrix*start,b=projectionMatrix*end;
        vec2 delta=(b.xy/b.w-a.xy/a.w)*resolution*.5;
        float len=length(delta);vec2 direction=delta/max(len,.0001),normal=vec2(-direction.y,direction.x);
        float extent=strokeWidth*.5+1.0,side=position.x,along=position.y;
        vec4 clip=along<0.0?a:b;
        clip.xy+=(normal*side+direction*along)*extent*2.0/resolution*clip.w;
        gl_Position=clip;vOffset=vec2(side*extent,along<0.0?-extent:len+extent);vLength=len;
      }`,
    fragmentShader:`
      uniform vec3 diffuse; uniform float opacity; uniform float strokeWidth;
      varying vec2 vOffset; varying float vLength; varying float vVisible;
      void main(){
        if(vVisible<.5)discard;
        float cap=max(max(-vOffset.y,vOffset.y-vLength),0.0);
        float distanceToLine=length(vec2(vOffset.x,cap));
        float coverage=1.0-smoothstep(strokeWidth*.5-.5,strokeWidth*.5+.5,distanceToLine);
        if(coverage<.001)discard;
        gl_FragColor=vec4(diffuse,opacity*coverage);
        #include <colorspace_fragment>
      }`
  });
  // Match LineBasicMaterial's public colour/opacity controls used by hover.
  material.color=material.uniforms.diffuse.value;
  material.opacity=opacity;
  const mesh=new T.Mesh(geometry,material);mesh.name='Continuous screen-space edges';
  mesh.onBeforeRender=renderer=>{renderer.getSize(material.uniforms.resolution.value);material.uniforms.opacity.value=material.opacity;};
  // Strokes are decoration. Keep physical surface hit testing unchanged.
  mesh.raycast=()=>{};
  return mesh;
}
