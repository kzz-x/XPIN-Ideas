import{validateProject}from'../v011/DotSharedWeb/editor.mjs';
import{ROOT_KNOTS}from'../v013-stage-bridge/bridge-director.mjs';
// Preserve the established source-audio in-point and the original performed
// gesture/camera track; derive the tail and handoff from actual media metadata.
export const SHOT={min:-.75,audioStart:36,dotOrigin:1.8,fps:60,performanceEnd:644/60,impactStart:10.35,impactDuration:5.5};
export function configureAudioDuration(duration){
 if(!Number.isFinite(duration)||duration<=SHOT.audioStart)throw Error('原音乐时长无效');
 Object.assign(SHOT,{sourceDuration:duration,containerMusicEnd:duration-SHOT.audioStart,musicEnd:Math.min(duration-SHOT.audioStart,13.9),audibleCueBasis:'full mix last sample above -80dBFS 13.840583s + guard; original audio bytes preserved'});
 SHOT.pullStart=SHOT.musicEnd+1;SHOT.pullEnd=SHOT.pullStart+4.6;
 SHOT.speechStart=SHOT.pullStart+.75;SHOT.speechEnd=SHOT.speechStart+6.4;
 SHOT.gameStart=SHOT.speechEnd-.25;SHOT.gameEnd=SHOT.gameStart+4.2;
 SHOT.max=SHOT.end=SHOT.gameEnd+1.5;return SHOT;
}
configureAudioDuration(globalThis.DOT_STAGE_AUDIO_METADATA?.duration??51.98333333333333);
export const SCHEMA='dot-motion-workbench-v1';
const copy=value=>JSON.parse(JSON.stringify(value));
export const CONTROL_GROUPS=[
 {title:'身体与小号',fields:[['motion.bodyAmount','局部反应',0,1.7,.01],['motion.inhaleGain','吸气膨胀',0,2,.01],['motion.exhaleGain','吹气收缩',0,2,.01],['motion.hornGain','小号形变',0,2,.01],['motion.localDrift','呼吸微移',0,1.5,.01],['project.offset','吹奏整体偏移（秒）',-1,1,.001]]},
 {title:'整体飘动',fields:[['flight.tempo','飘动节奏',0,2,.01],['flight.phase','路径时间偏移（秒）',-2,2,.01],['flight.amplitudeX','左右幅度',0,2,.01],['flight.amplitudeY','上下幅度',0,2,.01],['flight.amplitudeZ','前后幅度',0,2,.01],['flight.offsetX','位置 · 左右',-8,8,.01],['flight.offsetY','位置 · 高低',-3,3,.01],['flight.offsetZ','位置 · 前后',-4,4,.01],['flight.bankGain','倾身幅度',0,2,.01],['flight.tiltOffset','额外侧倾（度）',-25,25,.1],['flight.yawOffset','额外转向（度）',-25,25,.1]]},
 {title:'镜头与景深',fields:[['camera.tempo','推进节奏',.3,2,.01],['camera.push','推进距离',0,1.2,.01],['camera.frameX','取景 · 水平',-3,3,.01],['camera.frameY','取景 · 高度',-3,3,.01],['camera.fovDelta','视角调整（度）',-10,25,.1],['camera.dofStrength','景深强度',0,1.25,.01],['camera.dofWidth','清晰范围',.3,3,.01],['camera.focusOffset','焦点偏移',-4,4,.01],['camera.manualDistance','手动焦距',.5,40,.01]]},
 {title:'白屏与舞台',fields:[['screen.fadeStart','白屏开始（秒）',0,SHOT.musicEnd,.01],['screen.fadeDuration','白屏渐变（秒）',.1,4,.01],['screen.whiteRadiance','屏幕发光',1,2.5,.01],['stage.floorReflection','台面反射',0,.55,.001],['stage.spotStrength','追光强度',0,1.5,.01],['stage.beamStrength','光束可见度',0,1,.01],['stage.lightSpread','灯位左右间距',4,10,.1],['stage.lightHeight','灯位高度',4,10,.1],['stage.architectureContrast','台口 / 侧翼明暗',0,1,.01],['stage.particleContrast','纸片色彩深度',0,1,.01],['stage.particleSize','纸片尺寸',.6,1.6,.01]]}
];
const ranges=new Map(CONTROL_GROUPS.flatMap(g=>g.fields.map(([path,,min,max])=>[path,[min,max]])));
const boolPaths=['flight.enabled','camera.dollyEnabled','camera.dofEnabled','camera.autoFocus','screen.whiteEnabled','stage.enabled','stage.spotsEnabled','stage.directorEnabled'];
export const EFFECT_LABELS={paper:'飘落纸片',ribbon:'飘带',burst:'两侧礼花',flash:'灯位闪光'};
export function getPath(object,path){return path.split('.').reduce((o,k)=>o?.[k],object);}
export function setPath(object,path,value){const keys=path.split('.');if(keys.some(k=>['__proto__','prototype','constructor'].includes(k)))throw Error('无效参数路径');const last=keys.pop();let o=object;for(const k of keys){if(!o[k]||typeof o[k]!=='object')throw Error('参数路径不存在');o=o[k];}o[last]=value;}
const finite=(x,label)=>{if(typeof x!=='number'||!Number.isFinite(x))throw Error(label+' 必须是有限数字');return x;};
const bound=(x,a,b)=>Math.max(a,Math.min(b,x));
export function makeDefaults(project){return{schema:SCHEMA,version:1,project:copy(project),playhead:0,
 motion:{bodyAmount:1,inhaleGain:1,exhaleGain:1,hornGain:1,localDrift:1},
 flight:{enabled:true,tempo:1,phase:0,amplitudeX:1,amplitudeY:1,amplitudeZ:1,offsetX:0,offsetY:0,offsetZ:0,bankGain:1,tiltOffset:0,yawOffset:0,knots:ROOT_KNOTS.map(k=>({time:k.time,value:[...k.value]}))},
 camera:{dollyEnabled:true,tempo:1,push:1,frameX:0,frameY:0,fovDelta:0,dofEnabled:true,dofStrength:1,dofWidth:1,focusOffset:0,autoFocus:true,manualDistance:8.55},
 screen:{whiteEnabled:true,fadeStart:14.1,fadeDuration:1.25,whiteRadiance:1.8},
 stage:{enabled:true,spotsEnabled:true,directorEnabled:true,floorReflection:.28,spotStrength:.85,beamStrength:.78,lightSpread:7.5,lightHeight:6.4,architectureContrast:.78,particleContrast:.82,particleSize:1,effects:{paper:{enabled:true,start:10.25,duration:5.8,strength:.94},ribbon:{enabled:true,start:10.45,duration:5,strength:.9},burst:{enabled:true,start:10.26,duration:1.75,strength:1},flash:{enabled:true,start:10.48,duration:.22,strength:1}}},
 view:{quality:'medium',dofSamples:8},transport:{loopEnabled:false,loop:[0,SHOT.end],rate:1}};}
export function normalizeDocument(input,defaults){
 if(!input||typeof input!=='object')throw Error('需要参数 JSON 对象');
 if(input.schema!==SCHEMA){if(Array.isArray(input.events)){const d=copy(defaults);d.project=validateProject(input);return d;}throw Error('不是本调节台参数或原人工节奏 JSON');}
 const out=copy(defaults);out.project=validateProject(input.project);
 for(const[path,[min,max]]of ranges){const value=getPath(input,path);if(value!==undefined)setPath(out,path,bound(finite(value,path),min,max));}
 for(const path of boolPaths){const value=getPath(input,path);if(value!==undefined){if(typeof value!=='boolean')throw Error(path+' 需要开关值');setPath(out,path,value);}}
 for(const kind of Object.keys(EFFECT_LABELS)){const source=input.stage?.effects?.[kind];if(!source)continue;const effect=out.stage.effects[kind];if(typeof source.enabled!=='boolean')throw Error('庆祝效果开关无效');effect.enabled=source.enabled;effect.start=bound(finite(source.start,'效果时间'),0,SHOT.max);effect.duration=bound(finite(source.duration,'效果时长'),.05,6);effect.strength=bound(finite(source.strength,'效果强度'),0,1);}
 const knots=input.flight?.knots??out.flight.knots;if(!Array.isArray(knots)||knots.length<2||knots.length>40)throw Error('路径需要2–40个关键点');
 out.flight.knots=knots.map((k,i)=>{const time=finite(k.time,'路径时间');if(!Array.isArray(k.value)||k.value.length!==3)throw Error('路径位置需要XYZ');const value=k.value.map(v=>bound(finite(v,'路径位置'),-30,30));if(time<0||time>SHOT.performanceEnd||i&&time-knots[i-1].time<.04)throw Error('路径关键点需按时间排列且相隔至少40毫秒');return{time,value};});
 if(Math.abs(out.flight.knots[0].time)>1e-8||Math.abs(out.flight.knots.at(-1).time-SHOT.performanceEnd)>1e-8)throw Error('路径首尾时间需保留主段边界');
 out.playhead=bound(finite(input.playhead??0,'播放位置'),SHOT.min,SHOT.max);
 const tr=input.transport??out.transport;if(typeof tr.loopEnabled!=='boolean'||!Array.isArray(tr.loop)||tr.loop.length!==2)throw Error('循环参数无效');const[a,b]=tr.loop.map(v=>finite(v,'循环时间'));if(a<SHOT.min||b>SHOT.max||b-a<.03)throw Error('循环起止需在镜头范围内且至少30毫秒');out.transport={loopEnabled:tr.loopEnabled,loop:[a,b],rate:bound(finite(tr.rate??1,'播放倍率'),.25,2)};
 const view=input.view??out.view;if(!['low','medium','high'].includes(view.quality)||![4,8,16].includes(view.dofSamples))throw Error('预览质量参数无效');out.view={quality:view.quality,dofSamples:view.dofSamples};return out;
}
export function createDocumentStore(defaults){
 const baseline=copy(defaults);let doc=normalizeDocument(defaults,defaults),undo=[],redo=[],transaction=null;
 return{get document(){return doc},get defaults(){return copy(baseline)},get canUndo(){return undo.length>0},get canRedo(){return redo.length>0},begin(){if(!transaction)transaction=JSON.stringify(doc);},
  apply(next,{remember=true}={}){const before=JSON.stringify(doc),candidate=normalizeDocument(next,baseline);if(remember&&!transaction&&before!==JSON.stringify(candidate)){undo.push(before);if(undo.length>50)undo.shift();redo=[];}doc=candidate;return doc;},
  commit(){if(transaction&&transaction!==JSON.stringify(doc)){undo.push(transaction);if(undo.length>50)undo.shift();redo=[];}transaction=null;},cancel(){if(transaction)doc=JSON.parse(transaction);transaction=null;return doc;},
  undo(){if(!undo.length)return doc;redo.push(JSON.stringify(doc));doc=JSON.parse(undo.pop());transaction=null;return doc;},redo(){if(!redo.length)return doc;undo.push(JSON.stringify(doc));doc=JSON.parse(redo.pop());transaction=null;return doc;},
  restoreMotion(){const next=copy(doc);for(const key of['project','motion','flight','camera'])next[key]=copy(baseline[key]);return this.apply(next);},serialize(playhead){return JSON.stringify({...doc,playhead:playhead??doc.playhead},null,2);},import(text){if(typeof text!=='string'||text.length>2*1024*1024)throw Error('参数文件不能超过2MB');return this.apply(JSON.parse(text));}};
}
export function addEvent(document,localTime){const d=copy(document);let n=0;while(d.project.events.some(e=>e.id==='manual-'+n))n++;d.project.events.push({id:'manual-'+n,start:localTime-SHOT.dotOrigin-d.project.offset,duration:.105,strength:.8,attack:.012,release:.07,horn:.13});return{document:d,id:'manual-'+n};}
export const cloneDocument=copy;
