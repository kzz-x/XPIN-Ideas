from pathlib import Path
import re,json,base64,hashlib
D=Path(__file__).resolve().parents[1];S=D;E=D/'evidence';M=D/'preview/modules';M.mkdir(exist_ok=True)
IMPORT=re.compile(r'''(?m)(?:^|(?<=[;}]))[ \t]*(?P<prefix>(?:\b(?:import|export)\s*[\w$*{},\s]*\bfrom\s*|\bimport\s*))(?P<quote>["'])(?P<spec>[^"']+)(?P=quote)''')
def masked(raw):
 s=re.sub(r'/\*.*?\*/',lambda m:''.join('\n'if c=='\n'else' 'for c in m[0]),raw,flags=re.S)
 return re.sub(r'(?m)^[ \t]*//.*$',lambda m:' '*len(m[0]),s)
registry={};codes={};origins={};deps={}
def module(p):
 p=p.resolve()
 if p in registry:return registry[p]
 id='m'+str(len(registry)).zfill(3)+'.mjs';registry[p]=id;origins[id]=p.relative_to(S).as_posix();raw=p.read_text('utf-8-sig');edits=[];dependencies=[]
 for m in IMPORT.finditer(masked(raw)):
  spec=m['spec'];assert spec.startswith('.'),('external',p,spec);target=(p.parent/spec).resolve();assert target.is_file(),(p,spec);dep=module(target);dependencies.append(dep);edits.append((m.start('spec'),m.end('spec'),'./'+dep))
 code=raw
 for a,b,v in reversed(edits):code=code[:a]+v+code[b:]
 codes[id]=code;deps[id]=dependencies;return id
entry=module(S/'preview/viewer-app.mjs')
for p in M.glob('m[0-9][0-9][0-9].mjs'):
 if p.name not in codes:p.unlink()
for id,code in codes.items():(M/id).write_text(code,encoding='utf-8')
payload={'version':'D02_ACCEPTED_SHARED_r01','modules':codes,'entry':entry,'asset':base64.b64encode((S/'model/assets/dot-character.glb').read_bytes()).decode(),'data':json.loads((S/'model/data.json').read_text('utf8')),'contract':json.loads((S/'model/FUSION_CONTRACT.json').read_text('utf8')),'reference':'','newReferences':[]}
loader=r'''(async()=>{const p=JSON.parse(document.getElementById('payload').textContent),urls={},visiting=new Set();function url(id){if(urls[id])return urls[id];if(visiting.has(id))throw Error('模块循环：'+id);visiting.add(id);const source=p.modules[id];if(!source)throw Error('缺少内嵌模块：'+id);const code=source.replace(/(\bfrom\s*|\bimport\s*)(["'])(\.\/m\d+\.mjs)\2/g,(m,a,q,s)=>a+q+url(s.slice(2))+q);urls[id]=URL.createObjectURL(new Blob([code],{type:'text/javascript'}));visiting.delete(id);return urls[id];}
globalThis.DOT_COMPONENT_ASSET='data:model/gltf-binary;base64,'+p.asset;globalThis.DOT_FUSION_DATA=p.data;globalThis.DOT_FUSION_CONTRACT=p.contract;globalThis.DOT_FUSION_REFERENCE=p.reference;globalThis.DOT_FUSION_NEW_REFERENCES=p.newReferences;globalThis.DOT_FUSION_RESOURCE_REPORT={moduleCount:Object.keys(p.modules).length,modelCount:1,base:'accepted-six-petal+A-surfaces-hat-trumpet',CModelIncluded:false,externalFetchAllowed:false,assetBytes:atob(p.asset).length};
const nativeFetch=globalThis.fetch.bind(globalThis);globalThis.fetch=(request,options)=>{const address=typeof request==='string'?request:request?.url||String(request);if(!/^(data:|blob:)/.test(address))return Promise.reject(Error('离线预览缺少内嵌资源：'+address.slice(0,140)));return nativeFetch(request,options);};addEventListener('pagehide',()=>Object.values(urls).forEach(u=>URL.revokeObjectURL(u)),{once:true});await import(url(p.entry));document.getElementById('payload').remove();})().catch(e=>{document.getElementById('loading').hidden=true;document.getElementById('error').hidden=false;document.getElementById('error').textContent='预览未能载入：'+e.message;console.error(e);});'''
text=(S/'preview/viewer-template.html').read_text('utf-8').replace('<!--PAYLOAD-->','<script type="application/json" id="payload">'+json.dumps(payload,ensure_ascii=False,separators=(',',':')).replace('<','\\u003c')+'</script><script>'+loader+'</script>')
out=D/'Dot_D02_正式模型_动作库_粒子退场_r01.html';out.write_text(text,encoding='utf-8');manifest={'version':payload['version'],'entry':entry,'moduleOrigins':origins,'dependencies':deps,'modelCount':1,'CModelCodeExcluded':True,'runtimeModule':next(k for k,v in origins.items()if v=='runtime/accepted-driver.mjs'),'html':{'name':out.name,'bytes':out.stat().st_size,'sha256':hashlib.sha256(out.read_bytes()).hexdigest()},'browser':'not_run_prior_file_restriction','gpuUsed':False};(E/'BUILD_MANIFEST.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8');print(json.dumps({'status':'built','modules':len(codes),**manifest['html']},ensure_ascii=False))