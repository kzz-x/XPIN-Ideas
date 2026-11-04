import {makeRecoverySeeds,actorProtection,foregroundVisibility} from './recovery-celebration-r01.mjs';
import * as T from '../../dot/model/frozen/r07d/editable-stage/素材/v011/DotSharedWeb/vendor/three.module.js';
import {createConcertV024} from './concert-v024.mjs';
import {createConcertVenue} from './concert-venue-r06.mjs';
import {sampleBallistic,random,FLOOR} from './concert-physics-r04.mjs';
import {makeEncoreSeeds} from './concert-encore-timing-r05.mjs';
import {SHOT} from './document.mjs';
const PI=Math.PI,sat=x=>Math.max(0,Math.min(1,x));
const smooth=(a,b,t)=>{const u=sat((t-a)/(b-a));return u*u*(3-2*u);};
function life(mesh,key){
 const a=new T.InstancedBufferAttribute(new Float32Array(mesh.count),1);a.setUsage(T.DynamicDrawUsage);mesh.geometry.setAttribute('aCdxLife',a);
 mesh.material.onBeforeCompile=shader=>{shader.vertexShader='attribute float aCdxLife;varying float vCdxLife;\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvCdxLife=aCdxLife;');shader.fragmentShader='varying float vCdxLife;\n'+shader.fragmentShader;shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\ndiffuseColor.a*=vCdxLife;');};
 mesh.material.customProgramCacheKey=()=>key;return a;
}
function ribbonGeometry(){
 const p=[],uv=[],idx=[],n=24;
 for(let i=0;i<=n;i++){const u=i/n,a=u*PI*2.7,x=.07*Math.sin(a),z=.045*Math.cos(a),y=(u-.5)*.75;for(const side of[-1,1]){p.push(x+side*.021,y,z);uv.push((side+1)/2,u);}}
 for(let i=0;i<n;i++){const a=i*2;idx.push(a,a+1,a+2,a+1,a+3,a+2);}
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(idx);g.computeVertexNormals();return g;
}
export function createConcertRevision(stage,dot,layout,finale){
 // Reuse the already supplied true-3D pedestal/frosted cube. Its old answer
 // card and old celebration/lighting stay disabled: this branch exposes only
 // a game handoff, without deciding the independent game's content.
 const legacy=createConcertV024(stage,dot,layout);legacy.root.visible=false;
 const root=new T.Group();root.name='CDX r04 / full-frustum celebration with gravity';stage.scene.add(root);
 const game=legacy.game,cube=legacy.cube;game.removeFromParent();root.add(game);game.visible=false;
 const upLights=[];game.traverse(o=>{if(o.isLight)upLights.push(o);if(o.isMesh&&o.material?.map)o.visible=false;});
 for(const light of upLights){light.removeFromParent();root.add(light);light.intensity=0;}
 const venue=createConcertVenue(stage,layout,finale);
 const paperSeeds=makeRecoverySeeds('paper',640,{musicEnd:SHOT.musicEnd}),sparkSeeds=makeRecoverySeeds('spark',420,{musicEnd:SHOT.musicEnd}),ribbonSeeds=makeRecoverySeeds('ribbon',48,{musicEnd:SHOT.musicEnd});
 const allSeeds=[...paperSeeds,...sparkSeeds,...ribbonSeeds],celebrationStart=Math.min(...allSeeds.map(s=>s.start)),celebrationEnd=Math.max(...allSeeds.map(s=>s.start+s.life));
 const paperMat=new T.MeshStandardMaterial({color:'#ffffff',roughness:.65,metalness:.12,transparent:true,opacity:1,depthWrite:false,side:T.DoubleSide});
 const ribbonsMat=new T.MeshStandardMaterial({color:'#e6d6ac',roughness:.40,metalness:.43,transparent:true,opacity:1,depthWrite:false,side:T.DoubleSide});
 const sparkMat=new T.MeshBasicMaterial({color:'#ffe9c8',transparent:true,opacity:1,blending:T.AdditiveBlending,depthWrite:false,toneMapped:false});
 const paper=new T.InstancedMesh(new T.PlaneGeometry(1,.58),paperMat,paperSeeds.length),ribbons=new T.InstancedMesh(ribbonGeometry(),ribbonsMat,ribbonSeeds.length),sparks=new T.InstancedMesh(new T.CylinderGeometry(.009,.011,1,4),sparkMat,sparkSeeds.length);
 const sets=[[paper,paperSeeds,life(paper,'cdx-r04-gravity-paper'),'paper'],[ribbons,ribbonSeeds,life(ribbons,'cdx-r04-gravity-ribbons'),'ribbon'],[sparks,sparkSeeds,life(sparks,'cdx-r04-short-sparks'),'spark']];
 for(const [mesh,,]of sets){mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);mesh.frustumCulled=false;root.add(mesh);}
 const palette=['#dfb956','#eee8d8','#cfdae2','#d6a660','#3e6fbd'];
 for(let i=0;i<paper.count;i++)paper.setColorAt(i,new T.Color(palette[Math.floor(random(i,77)*palette.length)]));paper.instanceColor.needsUpdate=true;
 const dummy=new T.Object3D(),sample={},Y=new T.Vector3(0,1,0),velocity=new T.Vector3();
 function update(time,{stageSettings={},actorWorld=new T.Vector3(),cubeYaw,cubePitch,project={events:[],offset:0}}={}){
  const venueState=venue.update(time,actorWorld,stageSettings,project),visible={paper:0,ribbon:0,spark:0},protection=actorProtection(dot,stage.camera);
  for(const [mesh,seeds,alpha,kind]of sets){
   mesh.visible=time>=celebrationStart&&time<=celebrationEnd;
   if(!mesh.visible)continue;
   for(let i=0;i<seeds.length;i++){
    const seed=seeds[i],s=sampleBallistic(seed,time,sample);s.alpha*=foregroundVisibility(s,protection);
    if(s.alpha<=.001){dummy.position.set(0,FLOOR-50,0);dummy.scale.setScalar(0);dummy.quaternion.identity();alpha.setX(i,0);}
    else{
     visible[kind]++;dummy.position.set(s.x,s.y,s.z);alpha.setX(i,s.alpha);
     if(kind==='spark'){velocity.set(s.vx,s.vy,s.vz);const speed=velocity.length();dummy.quaternion.setFromUnitVectors(Y,speed>1e-6?velocity.multiplyScalar(1/speed):Y);dummy.scale.set(seed.size,Math.min(.26,Math.max(.035,speed*.020)),seed.size);}
     else{dummy.rotation.set(s.rx,s.ry,s.rz);dummy.scale.setScalar(seed.size);if(kind==='paper')dummy.scale.y*=.65+random(i,92)*.6;}
    }
    dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);
   }
   mesh.instanceMatrix.needsUpdate=true;alpha.needsUpdate=true;
   mesh.visible=visible[kind]>0;
  }
  const gameMix=smooth(SHOT.gameStart,SHOT.gameEnd,time);game.visible=gameMix>.001;game.scale.setScalar(Math.max(.0001,gameMix));
  for(const light of upLights)light.intensity=gameMix*4.8;
  cube.rotation.set(Number.isFinite(cubePitch)?cubePitch:.15+Math.sin(time*.27)*.08,Number.isFinite(cubeYaw)?cubeYaw:time*.20+.7,.04*Math.sin(time*.22));
  return{time,...venueState,visibleParticles:visible,totalCelebrationInstances:1108,gravityMetersPerSecondSquared:9.81,randomRespawn:false,encoreTimedFromActualMusicEnd:true,lateEncoreCohortCount:316,celebrationStart:6,depthLayers:['back','middle','front'],actorForegroundProtected:true,gameMix,gameIsHandoffOnly:true,pullStart:SHOT.pullStart,musicEnd:SHOT.musicEnd,engine:'THREE_JS_TRUE_3D'};
 }
 function prepareCompile({includeGame=true}={}){const objects=[...(includeGame?[game]:[]),...sets.map(s=>s[0])],save=objects.map(o=>o.visible);for(const o of objects)o.visible=true;return()=>objects.forEach((o,i)=>o.visible=save[i]);}
 return{root,game,cube,venue,update,prepareCompile,dispose(){venue.dispose();legacy.dispose();root.removeFromParent();const gs=new Set(),ms=new Set();root.traverse(o=>{if(o.geometry)gs.add(o.geometry);if(o.material)for(const m of Array.isArray(o.material)?o.material:[o.material])ms.add(m);});for(const g of gs)g.dispose();for(const m of ms)m.dispose();}};
}
