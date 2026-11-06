// Preserve the editable ESM tree while emitting URLs understood by simple hosts.
export function portablePath(value){
  return value.replace(/(^|\/)素材\//g,'$1resources/').replace(/\.mjs(?=$|[?#])/g,'.js');
}

function versioned(value,version){
  return /\.js$/.test(value)?`${value}?v=${version}`:value;
}

export function portableText(text,{extension,version}){
  text=text.replaceAll('/素材/','/resources/').replaceAll('/%E7%B4%A0%E6%9D%90/','/resources/');
  // Only file suffixes change; authored card prose and the source files stay intact.
  text=text.replace(/\.mjs(?=['"?#])/g,'.js');
  if(extension==='.js'||extension==='.mjs'){
    text=text.replace(/(\bfrom\s*|\bimport\s*\(\s*|\bimport\s*)(['"])([^'"\n]+)\2/g,
      (_,prefix,quote,specifier)=>prefix+quote+versioned(specifier,version)+quote);
  }
  if(extension==='.html'){
    text=text.replace(/(<script type="importmap">)([\s\S]*?)(<\/script>)/,(_,open,json,close)=>{
      const map=JSON.parse(json);
      for(const key of Object.keys(map.imports))map.imports[key]=versioned(map.imports[key],version);
      return open+JSON.stringify(map)+close;
    });
    text=text.replace(/((?:src|href)=")(\.\/[^"\n]+\.js)(")/g,
      (_,prefix,url,end)=>prefix+versioned(url,version)+end);
    text=text.replace('<html lang="zh-CN">',`<html lang="zh-CN" data-release="${version}">`);
  }
  return text;
}
