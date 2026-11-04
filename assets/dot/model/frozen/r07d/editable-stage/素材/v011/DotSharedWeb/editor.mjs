import {normalizeEvents,clamp} from './animation.mjs';

const KEY='dot-trumpet-editor-v4', LEGACY_KEYS={v3:'dot-trumpet-editor-v3',v2:'dot-trumpet-editor-v2'};
const SOURCE_OFFSET=37.8, SOURCE_DURATION=51.983333, SHOT_END=8.933333;
const MIN_TIME=-SOURCE_OFFSET, MAX_TIME=SOURCE_DURATION-SOURCE_OFFSET;
const FIELDS=['start','duration','strength','attack','release','horn','direction','variationSeed'];
const OPTIONAL_FIELDS=['direction','variationSeed'];
const PHRASE_FIELDS=['start','end','inhaleStart','inhaleDuration','inhaleStrength','hold','lean','direction','seed'];
const PHRASE_LIMITS={start:[-37.8,14.153333],end:[-37.77,14.183333],inhaleStart:[-37.8,14.153333],inhaleDuration:[.03,1.8],inhaleStrength:[0,1.5],hold:[0,.5],lean:[-1,1],direction:[-1,1],seed:[0,2147483647]};
const LIMITS={start:[MIN_TIME,MAX_TIME],duration:[.02,2],strength:[0,1.5],attack:[.002,.5],release:[.005,1],horn:[0,.4],direction:[-1,1],variationSeed:[0,2147483647]};
const finite=x=>typeof x==='number'&&Number.isFinite(x);

// Preserve authored per-note overrides even with older renderer normalizers.
function normalizeNotes(events){
  const source=new Map(events.map(e=>[e.id,e]));
  return normalizeEvents(events).map(e=>{const original=source.get(e.id)||{};const result={...e};for(const field of OPTIONAL_FIELDS){if(finite(original[field]))result[field]=field==='variationSeed'?Math.round(clamp(original[field],0,2147483647)):clamp(original[field],-1,1);else delete result[field];}if(original.locked===true)result.locked=true;else delete result.locked;return result;});
}
export function validatePhrases(phrases){
  if(!Array.isArray(phrases)||phrases.length>300)throw Error('乐句必须是数组，最多 300 个');
  const ids=new Set();
  return phrases.map((p,i)=>{
    if(!p||typeof p!=='object')throw Error(`乐句 ${i+1} 格式无效`);
    const defaults={start:0,end:1,inhaleStart:-.22,inhaleDuration:.18,inhaleStrength:.8,hold:.04,lean:0,direction:0,seed:41};
    const result={};
    for(const field of PHRASE_FIELDS){const value=p[field]??defaults[field];if(!finite(value))throw Error(`乐句 ${i+1} 的 ${field} 不是有限数字`);result[field]=clamp(value,...PHRASE_LIMITS[field]);}
    result.seed=Math.round(result.seed);
    if(result.end-result.start<.029999)throw Error(`乐句 ${i+1} 的结束必须晚于开始至少 30 ms`);
    result.inhaleDuration=Math.min(result.inhaleDuration,MAX_TIME-result.inhaleStart);
    let id=typeof p.id==='string'&&p.id.length<100?p.id:`phrase-${i}`,base=id,extra=0;
    while(ids.has(id))id=`${base.slice(0,75)}-${i}-${++extra}`;ids.add(id);result.id=id;result.auto=p.auto===true;return result;
  }).sort((a,b)=>a.start-b.start);
}
export function suggestPhrases(events,existing=[],seed=41){
  // Never author the final tail. Suggestions are additive and never rewrite a note.
  const notes=events.filter(e=>e.start>=0&&e.start<7).sort((a,b)=>a.start-b.start),groups=[];
  for(const e of notes){const last=groups.at(-1);if(!last||e.start-last.end>.32)groups.push({start:e.start,end:Math.min(7,e.start+e.duration)});else last.end=Math.min(7,Math.max(last.end,e.start+e.duration));}
  const candidates=[];
  for(let i=0;i<groups.length;i++){
    const group=groups[i];if(group.start>6.97)continue;const previous=groups[i-1],gap=previous?group.start-previous.end:.45;
    const duration=clamp(gap-.10,.08,.48),hold=.04,inhaleStart=group.start-duration-hold;
    const candidate={id:`suggested-${Math.round(group.start*1000)}-${i}`,start:group.start,end:Math.max(group.end,group.start+.03),inhaleStart,inhaleDuration:duration,inhaleStrength:clamp(.6+duration,0,1.15),hold,lean:i%2?-.3:.3,direction:i%2?-.4:.4,seed:(Math.round(seed)+i*67)%2147483647,auto:true};
    const from=inhaleStart,to=candidate.end;
    if([...existing,...candidates].some(p=>from<Math.max(p.end,p.inhaleStart+p.inhaleDuration)+.03&&to>Math.min(p.start,p.inhaleStart)-.03))continue;
    candidates.push(candidate);
  }
  return validatePhrases(candidates);
}

export function validateProject(input){
  if(!input||typeof input!=='object'||!Array.isArray(input.events)||input.events.length>2000)throw Error('需要包含最多 2000 个事件的 JSON');
  if(input.sourceOffset!==undefined&&(!finite(input.sourceOffset)||Math.abs(input.sourceOffset-SOURCE_OFFSET)>.0001))throw Error('音频零点不一致：此镜头以原片 37.8 秒为零');
  const used=new Set();
  const raw=input.events.map((e,i)=>{
    if(!e||typeof e!=='object')throw Error(`事件 ${i+1} 格式无效`);
    const result={...e,start:e.start??e.t??0};
    for(const field of FIELDS)if(result[field]!==undefined&&!finite(result[field]))throw Error(`事件 ${i+1} 的 ${field} 不是有限数字`);
    if(e.locked!==undefined&&typeof e.locked!=='boolean')throw Error(`事件 ${i+1} 的 locked 需要布尔值`);
    result.start=clamp(result.start,MIN_TIME,MAX_TIME);
    let id=typeof e.id==='string'&&e.id.length<120?e.id:`event-${i}`;
    const base=id;let suffix=0;while(used.has(id))id=`${base.slice(0,90)}-${i}-${++suffix}`;
    used.add(id);result.id=id;return result;
  });
  const offset=input.offset??0;
  if(!finite(offset))throw Error('整体偏移必须是有限数字');
  const loop=input.loop??[0,SHOT_END];
  if(!Array.isArray(loop)||loop.length!==2||!loop.every(finite)||loop[0]<MIN_TIME||loop[1]>MAX_TIME||loop[1]-loop[0]<.03)throw Error('循环范围无效：终点须晚于起点至少 30 ms，且在原片内');
  const seed=input.seed??41;if(!finite(seed))throw Error('全局种子必须是有限整数');
  if(input.variationEnabled!==undefined&&typeof input.variationEnabled!=='boolean')throw Error('受控变化开关需要布尔值');
  if(input.autoBreathsEnabled!==undefined&&typeof input.autoBreathsEnabled!=='boolean')throw Error('建议呼吸开关需要布尔值');
  return {version:4,source:'PR-original-audio',sourceOffset:SOURCE_OFFSET,events:normalizeNotes(raw),phrases:validatePhrases(input.phrases??[]),variationEnabled:input.variationEnabled??true,autoBreathsEnabled:input.autoBreathsEnabled??true,seed:Math.round(clamp(seed,0,2147483647)),offset:clamp(offset,-1,1),loop:[...loop]};
}

export function createEditor(audio,onsets,wave,phraseDefaults=[]){
  const $=s=>document.querySelector(s);
  const defaults=Array.isArray(phraseDefaults)?{phrases:phraseDefaults}:phraseDefaults||{};
  let project=validateProject({events:onsets.events,phrases:defaults.phrases||[],variationEnabled:defaults.variationEnabled??true,autoBreathsEnabled:defaults.autoBreathsEnabled??true,seed:defaults.seed??41}), selected=null, selectedPhrase=null, undo=[], redo=[];
  let running=false,context=false,introView=false,dirty=true,drag=null,playRequest=0,lastUiFrame=NaN,legacy={},uid=0;
  let savedMessage='自动初稿已载入；结尾请人工精调',savedState='success';
  try{
    const saved=localStorage.getItem(KEY);
    if(saved){project=validateProject(JSON.parse(saved));savedMessage='已恢复此浏览器的 v4 乐句与人工节奏';introView=project.loop[0]===-.55;}
    for(const [version,key] of Object.entries(LEGACY_KEYS)){const old=localStorage.getItem(key);if(old)try{const data=JSON.parse(old);validateProject(data);legacy[version]=data;}catch{}}
  }catch{savedMessage='本地记录不可用或无效；已保留自动初稿，请导出 JSON 备份';savedState='error';}
  const cv=$('#wave'),ctx=cv.getContext('2d'),playhead=$('#playhead');
  const snapshot=()=>JSON.stringify(project);
  const current=()=>audio.currentTime-SOURCE_OFFSET;
  const range=()=>context?[MIN_TIME,MAX_TIME]:[introView?-.55:0,SHOT_END];
  function message(text,state='success'){const el=$('#saveState');el.textContent=text;el.dataset.state=state;}
  function persist(){try{localStorage.setItem(KEY,snapshot());message('已保存到此浏览器 · 跨设备请导出 JSON');}catch{message('本地存储不可用；编辑仍保留在当前页面，请导出 JSON','error');}}
  function remember(before=snapshot()){undo.push(before);if(undo.length>100)undo.shift();redo=[];}
  function restore(data,{save=true}={}){project=validateProject(typeof data==='string'?JSON.parse(data):data);selected=null;selectedPhrase=null;introView=project.loop[0]===-.55;refresh();if(save)persist();}
  function mergeLegacy(data){return {...data,phrases:data.phrases??project.phrases,variationEnabled:data.variationEnabled??project.variationEnabled,autoBreathsEnabled:data.autoBreathsEnabled??project.autoBreathsEnabled,seed:data.seed??project.seed};}
  function sorted(){project.events.sort((a,b)=>a.start-b.start);project.phrases.sort((a,b)=>a.start-b.start);}
  function changed(){sorted();refresh();persist();}
  function pause(){playRequest++;audio.pause();running=false;$('#play').textContent='▶ 播放';}
  function seek(t){
    if(!Number.isFinite(t))return;
    const duration=Number.isFinite(audio.duration)&&audio.duration>0?Math.min(SOURCE_DURATION,audio.duration):SOURCE_DURATION;
    audio.currentTime=clamp(t+SOURCE_OFFSET,0,Math.max(0,duration-.001));lastUiFrame=NaN;updateHead();
  }
  function selectedEvent(){return project.events.find(e=>e.id===selected);}
  function currentPhrase(){return project.phrases.find(p=>p.id===selectedPhrase);}
  function choosePhrase(id,{seekTo=true}={}){selectedPhrase=project.phrases.some(p=>p.id===id)?id:null;if(selectedPhrase){$('#phrasePanel').open=true;if(seekTo){pause();seek(currentPhrase().inhaleStart);}}refresh();}
  function choose(id,{seekTo=true}={}){
    selected=project.events.some(e=>e.id===id)?id:null;
    if(selected){$('#eventPanel').open=true;if(seekTo){pause();seek(selectedEvent().start);}}
    refresh();
  }
  function refresh(){
    const list=$('#events');list.innerHTML='';
    for(const e of project.events){const option=document.createElement('option');option.value=e.id;option.textContent=`${e.start.toFixed(3)} s · ${Math.round(e.start*60)} f · ${e.strength.toFixed(2)}`;list.append(option);}
    list.value=selected||'';
    const e=selectedEvent();
    for(const name of FIELDS){const input=$('#e_'+name);input.disabled=!e;input.value=e&&finite(e[name])?Number(e[name].toFixed(4)):'';}
    $('#frame').disabled=!e;$('#frame').value=e?Math.round(e.start*60):'';
    $('#copy').disabled=!e;$('#delete').disabled=!e;$('#e_locked').disabled=!e;$('#e_locked').checked=e?.locked===true;
    $('#selectionRead').textContent=e?`${e.start.toFixed(3)} s · ${Math.round(e.start*60)} f`:'选择一个事件';
    $('#eventCount').textContent=`${project.events.length} 音符 / ${project.phrases.length} 乐句`;
    const phraseList=$('#phrases');phraseList.innerHTML='';for(const p of project.phrases){const option=document.createElement('option');option.value=p.id;option.textContent=`${p.start.toFixed(2)}–${p.end.toFixed(2)} s${p.auto?' · 建议':' · 人工'}`;phraseList.append(option);}phraseList.value=selectedPhrase||'';
    const phrase=currentPhrase();for(const name of PHRASE_FIELDS){const input=$('#p_'+name);input.disabled=!phrase;input.value=phrase?Number(phrase[name].toFixed(4)):'';}
    $('#copyPhrase').disabled=!phrase;$('#deletePhrase').disabled=!phrase;$('#phraseSelectionRead').textContent=phrase?`吸 ${phrase.inhaleStart.toFixed(2)} s → 吹 ${phrase.start.toFixed(2)} s`:'先吸气，再吹奏';
    $('#variationEnabled').checked=project.variationEnabled;$('#variationSeed').value=project.seed;$('#autoBreaths').checked=project.autoBreathsEnabled;$('#suggestBreaths').disabled=!project.autoBreathsEnabled;
    $('#offset').value=Math.round(project.offset*1000);
    $('#loopA').value=Number(project.loop[0].toFixed(6));$('#loopB').value=Number(project.loop[1].toFixed(6));
    $('#undo').disabled=!undo.length;$('#redo').disabled=!redo.length;dirty=true;
  }
  function add(t){
    if(project.events.length>=2000){message('已达 2000 个事件上限，请先删除不需要的事件','error');return;}
    remember();const e={...normalizeNotes([{start:clamp(t,MIN_TIME,MAX_TIME)}])[0],id:`manual-${Date.now()}-${++uid}`};
    project.events.push(e);selected=e.id;$('#eventPanel').open=true;changed();
  }
  function applyNumber(el,callback){const value=String(el.value??'').trim(),number=Number(value);if(!value||!Number.isFinite(number)){message('请输入有效数字；原值未更改','error');refresh();return;}callback(number);}
  $('#events').onchange=e=>choose(e.target.value);
  for(const name of FIELDS)$('#e_'+name).onchange=e=>{const target=selectedEvent();if(!target)return;if(OPTIONAL_FIELDS.includes(name)&&String(e.target.value??'').trim()===''){remember();delete target[name];changed();return;}applyNumber(e.target,n=>{let value=clamp(n,...LIMITS[name]);if(name==='variationSeed')value=Math.round(value);if(value===target[name]){refresh();return;}remember();target[name]=value;project.events=normalizeNotes(project.events);changed();});};
  $('#e_locked').onchange=e=>{const target=selectedEvent();if(!target)return;remember();if(e.target.checked)target.locked=true;else delete target.locked;changed();};
  $('#frame').onchange=e=>applyNumber(e.target,n=>{const target=selectedEvent();if(!target)return;remember();target.start=clamp(Math.round(n)/60,MIN_TIME,MAX_TIME);changed();});
  $('#add').onclick=()=>add(current());
  $('#delete').onclick=()=>{if(!selected)return;remember();project.events=project.events.filter(e=>e.id!==selected);selected=null;changed();};
  $('#copy').onclick=()=>{const e=selectedEvent();if(!e)return;if(project.events.length>=2000){message('事件上限为 2000','error');return;}remember();const copy={...e,id:`copy-${Date.now()}-${++uid}`,start:clamp(e.start+.15,MIN_TIME,MAX_TIME)};project.events.push(copy);selected=copy.id;changed();};
  $('#undo').onclick=()=>{if(!undo.length)return;pause();redo.push(snapshot());restore(undo.pop());};
  $('#redo').onclick=()=>{if(!redo.length)return;pause();undo.push(snapshot());restore(redo.pop());};
  $('#export').onclick=()=>{const link=document.createElement('a');const url=URL.createObjectURL(new Blob([snapshot()],{type:'application/json'}));link.href=url;link.download='DOT_乐句与人工节奏_v4.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);message('已准备 JSON 下载；请保留文件以便跨设备继续编辑');};
  $('#import').onchange=async e=>{
    const input=e.target,file=input.files?.[0];if(!file)return;
    try{if(file.size>2*1024*1024)throw Error('JSON 不能超过 2 MB');const result=validateProject(mergeLegacy(JSON.parse(await file.text())));pause();remember();restore(result);message('已导入节奏 JSON · 可以撤销');}
    catch(error){message('导入失败，当前编辑未更改：'+error.message,'error');}
    finally{input.value='';}
  };
  for(const version of ['v3','v2']){const button=$('#restoreV'+version.slice(1));button.hidden=!legacy[version];button.onclick=()=>{if(!legacy[version]||!confirm(`导入此浏览器的 ${version} 编辑？旧记录不变；缺失的呼吸设置将沿用当前值，可以撤销。`))return;pause();remember();restore(mergeLegacy(legacy[version]));message(`已导入 ${version}，保留当前呼吸与旧版原记录；可以撤销`);};}
  $('#draft').onclick=()=>{if(!confirm('恢复音符自动初稿？不修改现有乐句与呼吸。结尾仍需人工调整，可以撤销；建议先导出。'))return;pause();remember();project.events=normalizeNotes(onsets.events);selected=null;changed();};
  $('#phrases').onchange=e=>choosePhrase(e.target.value);
  function checkBreathOverlap(){const p=currentPhrase();if(!p)return;const i=project.phrases.indexOf(p),previous=project.phrases[i-1];if(p.inhaleStart+p.inhaleDuration+p.hold>p.start+.002||(previous&&p.inhaleStart<previous.end-.002))message('吸气间隙不足：实际动作会按可用间隙压缩；请调整呼吸或前后乐句范围','error');}
  for(const name of PHRASE_FIELDS)$('#p_'+name).onchange=e=>applyNumber(e.target,n=>{const target=currentPhrase();if(!target)return;const next={...target,[name]:name==='seed'?Math.round(clamp(n,...PHRASE_LIMITS[name])):clamp(n,...PHRASE_LIMITS[name]),auto:false};try{const normalized=validatePhrases([next])[0];remember();Object.assign(target,normalized);changed();checkBreathOverlap();}catch(error){message(error.message,'error');refresh();}});
  $('#addPhrase').onclick=()=>{if(project.phrases.length>=300){message('最多 300 个乐句','error');return;}pause();remember();const start=clamp(current(),MIN_TIME+.22,MAX_TIME-.1);const p={id:`phrase-manual-${Date.now()}-${++uid}`,start,end:Math.min(start+.8,MAX_TIME),inhaleStart:start-.22,inhaleDuration:.18,inhaleStrength:.8,hold:.04,lean:0,direction:0,seed:project.seed,auto:false};project.phrases.push(p);selectedPhrase=p.id;$('#phrasePanel').open=true;changed();};
  $('#copyPhrase').onclick=()=>{const p=currentPhrase();if(!p||project.phrases.length>=300)return;remember();const delta=Math.min(.4,MAX_TIME-Math.max(p.end,p.inhaleStart+p.inhaleDuration));const copy={...p,id:`phrase-copy-${Date.now()}-${++uid}`,start:p.start+delta,end:p.end+delta,inhaleStart:p.inhaleStart+delta,auto:false};project.phrases.push(copy);selectedPhrase=copy.id;changed();};
  $('#deletePhrase').onclick=()=>{if(!selectedPhrase)return;remember();project.phrases=project.phrases.filter(p=>p.id!==selectedPhrase);selectedPhrase=null;changed();};
  $('#autoBreaths').onchange=e=>{remember();project.autoBreathsEnabled=e.target.checked;changed();message(project.autoBreathsEnabled?'建议呼吸已启用；全部原记录保留':'建议呼吸已暂停；人工乐句继续生效，建议数据未删除');};
  $('#variationEnabled').onchange=e=>{remember();project.variationEnabled=e.target.checked;changed();};
  $('#variationSeed').onchange=e=>applyNumber(e.target,n=>{remember();project.seed=Math.round(clamp(n,0,2147483647));changed();});
  $('#suggestBreaths').onclick=()=>{if(!project.autoBreathsEnabled){message('先开启建议呼吸再生成；现有建议数据仍保留');return;}if(!confirm('只为尚未覆盖的乐句建议吸气？不会改动现有呼吸或任何音符；最后 7.0–8.933 秒不自动处理，可以撤销。'))return;const additions=suggestPhrases(project.events,project.phrases,project.seed).slice(0,300-project.phrases.length);if(!additions.length){message('没有未覆盖的乐句；现有呼吸和人工结尾均未改动');return;}remember();project.phrases=validatePhrases([...project.phrases,...additions]);changed();message(`新增 ${additions.length} 个吸气建议；原有编辑未改动，请试听后手调`);};
  $('#offset').onchange=e=>applyNumber(e.target,n=>{remember();project.offset=clamp(n/1000,-1,1);changed();});
  function changeLoop(a,b){
    if(!finite(a)||!finite(b)||a<MIN_TIME||b>MAX_TIME||b-a<.03){message('循环范围无效；终点须晚于起点至少 30 ms，且在原片内','error');refresh();return;}
    remember();project.loop=[a,b];changed();
  }
  for(const id of ['loopA','loopB'])$('#'+id).onchange=()=>{const a=$('#loopA').value,b=$('#loopB').value;changeLoop(String(a).trim()?Number(a):NaN,String(b).trim()?Number(b):NaN);};
  $('#tailLoop').onclick=()=>{pause();introView=false;changeLoop(7,SHOT_END);$('#loop').checked=true;$('#rate').value='.5';audio.playbackRate=.5;seek(7);};
  $('#introLoop').onclick=()=>{pause();introView=true;changeLoop(-.55,SHOT_END);$('#loop').checked=true;seek(-.55);};
  $('#shotLoop').onclick=()=>{pause();introView=false;changeLoop(0,SHOT_END);$('#loop').checked=true;seek(0);};
  $('#play').onclick=async()=>{
    if(running){pause();return;}
    if(current()<project.loop[0]||current()>=project.loop[1]-.01)seek(project.loop[0]);
    const request=++playRequest;
    try{await audio.play();if(request!==playRequest)return;running=true;$('#play').textContent='Ⅱ 播放中';}
    catch{if(request===playRequest){running=false;message('播放受阻；请再次点击播放或检查音频加载','error');}}
  };
  $('#pause').onclick=pause;$('#restart').onclick=()=>{pause();seek(project.loop[0]);};
  $('#rate').onchange=e=>{const rate=Number(e.target.value);if([.25,.5,.75,1].includes(rate))audio.playbackRate=rate;};
  $('#mute').onchange=e=>audio.muted=e.target.checked;
  $('#volume').oninput=e=>{const volume=Number(e.target.value);if(finite(volume))audio.volume=clamp(volume,0,1);};
  audio.volume=.65;audio.preservesPitch=true;
  $('#context').onchange=e=>{context=e.target.checked;dirty=true;lastUiFrame=NaN;updateHead();};
  $('#scrub').oninput=e=>{pause();seek(Number(e.target.value));};
  function position(e){const rect=cv.getBoundingClientRect(),[a,b]=range();return a+clamp((e.clientX-rect.left)/Math.max(1,rect.width),0,1)*(b-a);}
  function nearest(t){const [a,b]=range(),threshold=(b-a)*9/Math.max(1,cv.clientWidth);let hit=null,distance=threshold;for(const e of project.events){const d=Math.abs(e.start-t);if(d<distance){hit=e;distance=d;}}return hit;}
  function laneAt(e){const rect=cv.getBoundingClientRect();const y=finite(e.clientY)?e.clientY-(rect.top||0):70;return y>=19&&y<32?'inhale':y>=32&&y<46?'phrase':'note';}
  function hitPhrase(t,kind){const[a,b]=range(),pad=(b-a)*6/Math.max(1,cv.clientWidth);let hit=null,distance=Infinity;for(const p of project.phrases){const from=kind==='inhale'?p.inhaleStart:p.start,to=kind==='inhale'?p.inhaleStart+p.inhaleDuration:p.end;if(t>=from-pad&&t<=to+pad&&Math.abs(t-from)<distance){hit=p;distance=Math.abs(t-from);}}return hit;}
  cv.onpointerdown=e=>{
    if(e.button!==undefined&&e.button!==0)return;
    pause();const t=position(e),kind=laneAt(e);
    if(kind!=='note'){
      const hit=hitPhrase(t,kind);
      if(hit){choosePhrase(hit.id,{seekTo:false});drag={kind,id:hit.id,original:{...hit},grab:t-(kind==='inhale'?hit.inhaleStart:hit.start),before:snapshot(),pointerId:e.pointerId};seek(kind==='inhale'?hit.inhaleStart:hit.start);cv.setPointerCapture?.(e.pointerId);}
      else seek(t);
      return;
    }
    const hit=nearest(t);
    if(hit){choose(hit.id);drag={kind:'note',id:hit.id,start:hit.start,before:snapshot(),pointerId:e.pointerId};cv.setPointerCapture?.(e.pointerId);}
    else seek(t);
  };
  cv.onpointermove=e=>{
    if(!drag)return;
    if(drag.kind==='note'){
      const target=project.events.find(x=>x.id===drag.id);if(!target)return;
      target.start=Math.round(position(e)*1000)/1000;seek(target.start);dirty=true;
      $('#e_start').value=target.start;$('#frame').value=Math.round(target.start*60);$('#selectionRead').textContent=`${target.start.toFixed(3)} s · ${Math.round(target.start*60)} f`;
    }else{
      const target=project.phrases.find(x=>x.id===drag.id);if(!target)return;
      if(drag.kind==='inhale')target.inhaleStart=clamp(Math.round((position(e)-drag.grab)*1000)/1000,MIN_TIME,MAX_TIME-target.inhaleDuration);
      else{const base=drag.original,delta=clamp(position(e)-drag.grab-base.start,MIN_TIME-Math.min(base.start,base.inhaleStart),MAX_TIME-Math.max(base.end,base.inhaleStart+base.inhaleDuration));target.start=base.start+delta;target.end=base.end+delta;target.inhaleStart=base.inhaleStart+delta;}
      target.auto=false;seek(drag.kind==='inhale'?target.inhaleStart:target.start);dirty=true;
      for(const field of ['start','end','inhaleStart'])$('#p_'+field).value=Number(target[field].toFixed(4));
      $('#phraseSelectionRead').textContent=`吸 ${target.inhaleStart.toFixed(2)} s → 吹 ${target.start.toFixed(2)} s`;
    }
  };
  cv.onpointerup=()=>{
    if(!drag)return;const pending=drag;drag=null;
    if(snapshot()!==pending.before){remember(pending.before);changed();if(pending.kind!=='note')checkBreathOverlap();}else refresh();
    if(cv.hasPointerCapture?.(pending.pointerId))cv.releasePointerCapture?.(pending.pointerId);
  };
  cv.onpointercancel=()=>{if(!drag)return;const pending=drag;drag=null;project=validateProject(JSON.parse(pending.before));if(pending.kind==='note'){selected=pending.id;seek(pending.start);}else{selectedPhrase=pending.id;seek(pending.original.inhaleStart);}refresh();};
  cv.ondblclick=e=>{const t=position(e),kind=laneAt(e);if(kind!=='note'){const p=hitPhrase(t,kind);if(p)choosePhrase(p.id);return;}const hit=nearest(t);if(hit){choose(hit.id);return;}pause();add(t);seek(t);};
  function draw(){
    if(!dirty||!ctx)return;dirty=false;
    const dpr=Math.min(globalThis.devicePixelRatio||1,2),cssWidth=Math.max(1,cv.clientWidth),cssHeight=cv.clientHeight||112;
    const width=Math.round(cssWidth*dpr),height=Math.round(cssHeight*dpr);
    if(cv.width!==width)cv.width=width;if(cv.height!==height)cv.height=height;
    const [a,b]=range(),x=t=>(t-a)/(b-a)*width,mid=height*.72;
    ctx.clearRect(0,0,width,height);ctx.fillStyle='#111113';ctx.fillRect(0,0,width,height);
    ctx.fillStyle='#24231f';ctx.fillRect(x(project.loop[0]),0,x(project.loop[1])-x(project.loop[0]),height);
    const step=context?5:1;
    ctx.font=`${9*dpr}px ui-monospace,monospace`;ctx.textBaseline='top';ctx.lineWidth=dpr;
    for(let t=Math.ceil(a/step)*step;t<=b;t+=step){const px=x(t);ctx.strokeStyle='#ffffff0b';ctx.beginPath();ctx.moveTo(px,19*dpr);ctx.lineTo(px,height);ctx.stroke();ctx.fillStyle='#77746c';ctx.fillText(`${t}s`,px+4*dpr,5*dpr);}
    ctx.strokeStyle='#727775';ctx.lineWidth=dpr;ctx.beginPath();
    const peaks=wave.peaks||[],duration=wave.duration||SOURCE_DURATION;
    for(let px=0;px<cssWidth;px++){
      const absolute=a+px/cssWidth*(b-a)+SOURCE_OFFSET,next=a+(px+1)/cssWidth*(b-a)+SOURCE_OFFSET;
      const start=clamp(Math.floor(absolute/duration*peaks.length),0,Math.max(0,peaks.length-1));
      const end=clamp(Math.ceil(next/duration*peaks.length),start+1,peaks.length);let v=0;
      for(let i=start;i<end;i++)v=Math.max(v,Number(peaks[i])||0);
      const h=clamp(v,0,1)*height*.20;ctx.moveTo(px*dpr,mid-h);ctx.lineTo(px*dpr,mid+h);
    }
    ctx.stroke();
    for(const p of project.phrases){const active=p.id===selectedPhrase,inactive=p.auto&&!project.autoBreathsEnabled;const from=x(p.inhaleStart),to=x(p.inhaleStart+p.inhaleDuration);ctx.fillStyle=inactive?'#303639':active?'#78aaa5':'#36534f';ctx.fillRect(from,20*dpr,Math.max(dpr,to-from),10*dpr);ctx.fillStyle=inactive?'#383633':active?'#d6bc89':'#655942';ctx.fillRect(x(p.start),34*dpr,Math.max(dpr,x(p.end)-x(p.start)),9*dpr);ctx.fillStyle=inactive?'#505758':active?'#bce6df':'#628680';ctx.fillRect(from,19*dpr,2*dpr,12*dpr);ctx.fillStyle=inactive?'#57534c':active?'#f0d59c':'#94805c';ctx.fillRect(x(p.start),33*dpr,2*dpr,11*dpr);}
    for(const e of project.events){if(e.start<a||e.start>b)continue;const active=e.id===selected,px=x(e.start);if(active){ctx.fillStyle='#d9bd8522';ctx.fillRect(px,48*dpr,Math.max(dpr,x(e.start+e.duration)-px),height-48*dpr);}ctx.strokeStyle=active?'#e2c48c':e.locked?'#b1a1aa':'#879ca1';ctx.lineWidth=(active?2:1)*dpr;ctx.beginPath();ctx.moveTo(px,48*dpr);ctx.lineTo(px,height);ctx.stroke();ctx.fillStyle=active?'#e2c48c':'#879ca1';ctx.fillRect(px-2*dpr,48*dpr,4*dpr,4*dpr);}
  }
  function updateHead(){
    const time=current(),[a,b]=range(),percent=(time-a)/(b-a)*100;
    playhead.style.display=percent<0||percent>100?'none':'';playhead.style.left=`${clamp(percent,0,100)}%`;
    const scrub=$('#scrub');scrub.min=a;scrub.max=b;if(Number(scrub.value)!==time)scrub.value=time;
    const frame=Math.floor(time*60);
    if(frame!==lastUiFrame){$('#timeRead').textContent=`${time.toFixed(3)} s / ${Math.round(time*60)} f`;$('#timeRead').title=`原片 ${audio.currentTime.toFixed(3)} 秒 · 60 fps`;lastUiFrame=frame;}
  }
  function update(){
    if(running&&current()>=project.loop[1]){
      if($('#loop').checked)seek(project.loop[0]);else{pause();seek(project.loop[1]);}
    }
    updateHead();draw();
  }
  const resize=()=>{dirty=true;};
  if(typeof ResizeObserver!=='undefined'){const observer=new ResizeObserver(resize);observer.observe(cv);}
  else globalThis.addEventListener?.('resize',resize);
  audio.addEventListener('loadedmetadata',()=>{if(!running)seek(0);});
  audio.addEventListener('ended',()=>{if($('#loop').checked&&running){seek(project.loop[0]);audio.play().catch(()=>{pause();message('循环播放受阻，请点击播放','error');});}else pause();});
  audio.addEventListener('error',()=>{pause();message('原音频加载失败，请检查 assets/context-original.m4a 是否完整','error');});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();});
  document.addEventListener('keydown',e=>{
    const tag=e.target?.tagName?.toLowerCase();if(['input','textarea','select','button'].includes(tag)||e.target?.isContentEditable)return;
    if(e.key===' '&&!e.repeat){e.preventDefault();if(running)pause();else $('#play').onclick();}
    else if(e.key.toLowerCase()==='m'&&!e.repeat&&!e.ctrlKey&&!e.metaKey){e.preventDefault();add(current());}
    else if(e.key.toLowerCase()==='h'&&!e.repeat&&!e.ctrlKey&&!e.metaKey){e.preventDefault();$('#clean').click();}
    else if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();pause();seek(current()+(e.key==='ArrowRight'?1:-1)*(e.shiftKey?10:1)/60);}
    else if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();(e.shiftKey?$('#redo'):$('#undo')).onclick();}
  });
  if(audio.readyState)seek(0);refresh();message(savedMessage,savedState);update();
  return {update,get time(){return current()-project.offset},get events(){return project.events},get running(){return running},get selected(){return selected},get selectedPhrase(){return selectedPhrase},get phrases(){return project.phrases},get variationEnabled(){return project.variationEnabled},get autoBreathsEnabled(){return project.autoBreathsEnabled},get seed(){return project.seed},pause,seek,invalidate:resize,get snapshot(){return JSON.parse(snapshot())}};
}
