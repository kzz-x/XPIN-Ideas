import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../assets/dot/model/frozen/r07d/editable-stage/素材/v011/DotSharedWeb/vendor/three.module.js';
import {screenLines} from '../src/screen-lines.mjs';

test('continuous strokes retain every original segment in one instanced draw and do not change hit testing',()=>{
 const positions=[-4,0,1,4,0,1,4,0,1,4,3,1],line=screenLines(T,positions,{width:1.1,opacity:.54});
 assert.equal(line.geometry.instanceCount,2);assert.equal(line.geometry.index.count,6);
 assert.deepEqual([...line.geometry.attributes.lineStart.array],[-4,0,1,4,0,1]);
 assert.deepEqual([...line.geometry.attributes.lineEnd.array],[4,0,1,4,3,1]);
 assert.equal(line.geometry.boundingBox.min.x,-4);assert.equal(line.geometry.boundingBox.max.y,3);
 // The shader maps quad x to the screen normal and y to line direction.
 // Both triangles must face the viewer for every diagonal orientation.
 const quad=line.geometry.attributes.position,index=line.geometry.index;
 for(const angle of [0,.2,1,2.6,4.2]){const dx=Math.cos(angle),dy=Math.sin(angle),project=i=>{const x=quad.getX(i),y=quad.getY(i);return[-dy*x+dx*y,dx*x+dy*y];};for(let n=0;n<6;n+=3){const[a,b,c]=[0,1,2].map(k=>project(index.getX(n+k)));assert.ok((b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0])>0);}}
 const hits=[];line.raycast(null,hits);assert.deepEqual(hits,[]);
 line.onBeforeRender({getSize:vector=>vector.set(1440,900)});
 assert.deepEqual(line.material.uniforms.resolution.value.toArray(),[1440,900]);
 line.material.opacity=.3;line.onBeforeRender({getSize:vector=>vector.set(720,900)});
 assert.equal(line.material.uniforms.opacity.value,.3);assert.equal(line.material.uniforms.strokeWidth.value,1.1);
 assert.equal(line.material.depthWrite,false);line.geometry.dispose();line.material.dispose();
});
