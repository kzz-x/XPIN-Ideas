import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../assets/dot/model/frozen/r07d/editable-stage/素材/v011/DotSharedWeb/vendor/three.module.js';
import {createAHeightField} from '../assets/dot/model/a-surface-field.mjs';

test('the denser triangle index preserves exact surface hits and eye clearance normals',()=>{
 const geometry=new T.SphereGeometry(2,64,48),matrix=new T.Matrix4().makeRotationY(.88),old=createAHeightField(geometry,matrix,56),fast=createAHeightField(geometry,matrix);
 let hits=0;
 for(const roll of [0,.2,-.45])for(let i=0;i<2500;i++){
  const x=(i*137%1009)/1009*4.2-2.1,y=(i*53%1013)/1013*4.2-2.1,a=old.sample(x,y,roll),b=fast.sample(x,y,roll);
  assert.equal(!!a,!!b);if(!a)continue;hits++;for(const key of ['z','nx','ny','nz'])assert.ok(Math.abs(a[key]-b[key])<1e-12,key);
 }
 assert.ok(hits>5000);assert.equal(fast.stats().bins,16384);geometry.dispose();
});
