from pathlib import Path
import shutil,json,hashlib,re
R=Path(__file__).resolve().parents[1];B=Path(r'D:\codex任务打包\Dot_D_六瓣轮廓_正侧眼睛_r02_20261031');S=R/'model';S.mkdir(exist_ok=True)
exclude={'modules','probe.mjs','build.py','audit.py','package.py','prepare.py','verify.mjs','loader-validation.js','fusion-app.mjs','fusion-template.html','fusion-lights.mjs'}
shutil.copytree(B/'source',S,dirs_exist_ok=True,ignore=lambda p,n:[x for x in n if x in exclude or x=='__pycache__'])
for n in ['runtime','effects','evidence','preview','handoff']: (R/n).mkdir(exist_ok=True)
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
lock={'id':'Dot/D02/ACCEPTED/20261031','status':'MODEL_FORM_MATERIALS_POSE_ACCEPTED','userDecision':'很好，定了，正式使用到所有dot场景里面','source':str(B),'geometryBodyNativeSHA256':'d43780179da068f359574341950c2b2ae353bec5c169a5dc566f99223fbffb74','approvedRawSHA256':'a6822dec04141bd86623c00348d727073ec21ef9d1db39efe5925cf8e65f6ac0','scope':'body+nap, A materials/hat/24 real horn morphs, front/side eye rules and response pose; retirement effect separately restored','files':{p.relative_to(S).as_posix():{'bytes':p.stat().st_size,'sha256':sha(p)}for p in S.rglob('*')if p.is_file()},'originalR02Artifacts':json.loads((B/'evidence/LOCAL_DELIVERY_MANIFEST.json').read_text('utf-8'))['items']}
(R/'ACCEPTED_MODEL_LOCK.json').write_text(json.dumps(lock,ensure_ascii=False,indent=2),encoding='utf-8')
old=Path(r'D:\codex任务打包\DotStage_r07d_recovery_r02_20261030\project\editable-stage\素材\v020-white-encore-cpu')
for n in ['horn-dissolve-r05.mjs','horn-dissolve-math-r05.mjs']:
 raw=(old/n).read_text('utf-8');(R/'evidence'/('HISTORICAL_'+n+'.txt')).write_bytes((old/n).read_bytes());raw=raw.replace("'../v011/DotSharedWeb/vendor/three.module.js'", "'../model/frozen/r07d/editable-stage/素材/v011/DotSharedWeb/vendor/three.module.js'").replace("'./document.mjs'","'./retirement-timing.mjs'");(R/'effects'/n).write_text(raw,encoding='utf-8')
(R/'effects/retirement-timing.mjs').write_text("export const SHOT=Object.freeze({musicEnd:14.809});\n",encoding='utf-8')
(R/'evidence/PARTICLE_SOURCE.json').write_text(json.dumps({'source':str(old),'files':{n:sha(old/n)for n in ['horn-dissolve-r05.mjs','horn-dissolve-math-r05.mjs']},'recipe':'original 768 real-surface grains + per-fragment discard; no whole-horn opacity fade','musicEnd':14.809,'dissolve':[14.859,16.359],'visibilityEnd':16.459,'gpuVerified':False},ensure_ascii=False,indent=2),encoding='utf-8')
# Mechanically expose the accepted frame math / commit separately; physical model
# and all eye/source modules above remain byte-frozen.
v=(S/'fusion-runtime.mjs').read_text('utf-8')
v=re.sub(r"(from\s*['\"])\./",r'\1../model/',v)
v=re.sub(r"^import \{makeDefaults\}.*\n",'',v,flags=re.M);v=re.sub(r"^import \{gsap\}.*\n",'',v,flags=re.M);v=v.replace('gsap.ticker.sleep();export {T};',"import {DEFAULT_DOCUMENT} from './default-document.mjs';\nexport {T};")
v=v.replace('export async function loadFusion','export async function loadAcceptedModel').replace('doc=makeDefaults(data.project)','doc=JSON.parse(JSON.stringify(data?.motion?data:DEFAULT_DOCUMENT))')
v=v.replace("eyeOverride='auto'}={}","eyeOverride='auto',capture=false}={}").replace("if(!camera)throw Error('Camera required for A eye surface binding');dot.mouth.copy(mouthRest);", "if(!camera&&!capture)throw Error('Actual camera required before posing accepted Dot');")
a=v.index('  dot.deform.position.set',v.index(' function sample('));e=v.index('\n }\n function dispose',a);commit=v[a:e];v=v[:a]+"  const frame={p,id,local,t,isPerformance,bodyRoll,hatLift,hatTilt,frontMix,hornAlpha,closed,blinkOpen,phase,actionIds,eyeOverride};if(capture)return frame;return commitFrame(frame,{camera,scene,light,eyeOverride});\n }\n function commitFrame(frame,{camera,scene=null,light='stage',eyeOverride=frame.eyeOverride||'auto',bindEyes=true}={}){\n  dot.mouth.copy(mouthRest);let {p,id,local,t,isPerformance,bodyRoll,hatLift,hatTilt,frontMix,hornAlpha,closed,blinkOpen,phase,actionIds}=frame;\n"+commit+v[e:]
a=v.index('for(const [m,rest]of hornMaterials){const transparent=');e=v.index('\n  if(scene)',a);v=v[:a]+"for(const [m,rest]of hornMaterials){if(m.transparent!==rest.transparent){m.transparent=rest.transparent;m.needsUpdate=true;}m.opacity=rest.opacity;m.depthWrite=rest.depthWrite;}"+v[e:]
v=v.replace('const eyes=eyeAdapter.update({mix:frontMix,bodyRoll,closed,blinkOpen,camera});',"const eyes=bindEyes?eyeAdapter.update({mix:frontMix,bodyRoll,closed,blinkOpen,camera}):null;")
v=v.replace('sample,snapshot:()=>last','sample,commitFrame,snapshot:()=>last')
(R/'runtime/accepted-driver.mjs').write_text(v,encoding='utf-8');print(json.dumps({'root':str(R),'frozenFiles':len(lock['files']),'modelLock':'ACCEPTED_MODEL_LOCK.json','derivativeFrameAPI':True},ensure_ascii=False))