import * as T from './frozen/r07d/editable-stage/素材/v011/DotSharedWeb/vendor/three.module.js';
/** Read-only height query of A's actual triangle mesh, indexed in its front
 * frame. Rotation is analytic around the front axis; no C body is involved. */
export function createAHeightField(geometry,nativeToFront,resolution=128){
 const a=geometry.attributes.position,index=geometry.index?.array,points=new Float64Array(a.count*3),p=new T.Vector3(),bounds={minX:Infinity,minY:Infinity,maxX:-Infinity,maxY:-Infinity,minZ:Infinity,maxZ:-Infinity};
 for(let i=0;i<a.count;i++){p.fromBufferAttribute(a,i).applyMatrix4(nativeToFront);points.set(p.toArray(),i*3);bounds.minX=Math.min(bounds.minX,p.x);bounds.maxX=Math.max(bounds.maxX,p.x);bounds.minY=Math.min(bounds.minY,p.y);bounds.maxY=Math.max(bounds.maxY,p.y);bounds.minZ=Math.min(bounds.minZ,p.z);bounds.maxZ=Math.max(bounds.maxZ,p.z);}
 const bins=Array.from({length:resolution*resolution},()=>[]),tris=[],sx=resolution/(bounds.maxX-bounds.minX),sy=resolution/(bounds.maxY-bounds.minY),cellX=x=>Math.max(0,Math.min(resolution-1,Math.floor((x-bounds.minX)*sx))),cellY=y=>Math.max(0,Math.min(resolution-1,Math.floor((y-bounds.minY)*sy)));
 for(let k=0;k<(index?.length??a.count);k+=3){const ia=(index?index[k]:k)*3,ib=(index?index[k+1]:k+1)*3,ic=(index?index[k+2]:k+2)*3,ax=points[ia],ay=points[ia+1],az=points[ia+2],bx=points[ib],by=points[ib+1],bz=points[ib+2],cx=points[ic],cy=points[ic+1],cz=points[ic+2],den=(by-cy)*(ax-cx)+(cx-bx)*(ay-cy);if(Math.abs(den)<1e-12)continue;
  let nx=(by-ay)*(cz-az)-(bz-az)*(cy-ay),ny=(bz-az)*(cx-ax)-(bx-ax)*(cz-az),nz=(bx-ax)*(cy-ay)-(by-ay)*(cx-ax),n=Math.hypot(nx,ny,nz),sign=nz<0?-1:1;nx*=sign/n;ny*=sign/n;nz*=sign/n;
  const id=tris.length;tris.push({ax,ay,az,bx,by,bz,cx,cy,cz,inv:1/den,nx,ny,nz});
  const x0=cellX(Math.min(ax,bx,cx)),x1=cellX(Math.max(ax,bx,cx)),y0=cellY(Math.min(ay,by,cy)),y1=cellY(Math.max(ay,by,cy));for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++)bins[y*resolution+x].push(id);
 }
 let queries=0;
 function sample(x,y,roll=0,out={}){queries++;const co=Math.cos(roll),si=Math.sin(roll),u=co*x+si*y,v=-si*x+co*y;if(u<bounds.minX-1e-9||u>bounds.maxX+1e-9||v<bounds.minY-1e-9||v>bounds.maxY+1e-9)return null;let best=-Infinity,hit=null;
  for(const id of bins[cellY(v)*resolution+cellX(u)]){const t=tris[id],wa=((t.by-t.cy)*(u-t.cx)+(t.cx-t.bx)*(v-t.cy))*t.inv,wb=((t.cy-t.ay)*(u-t.cx)+(t.ax-t.cx)*(v-t.cy))*t.inv,wc=1-wa-wb;if(wa< -2e-7||wb< -2e-7||wc< -2e-7)continue;const z=wa*t.az+wb*t.bz+wc*t.cz;if(z>best){best=z;hit=t;}}
  if(!hit)return null;out.z=best;out.nx=co*hit.nx-si*hit.ny;out.ny=si*hit.nx+co*hit.ny;out.nz=hit.nz;return out;
 }
 return {sample,bounds,stats(){return{vertices:a.count,triangles:tris.length,bins:bins.length,maxBin:Math.max(...bins.map(b=>b.length)),queries,source:'historically accepted restored six-petal mesh'};}};
}