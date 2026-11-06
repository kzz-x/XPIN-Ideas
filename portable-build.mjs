// Preserve the editable ESM tree while emitting URLs understood by simple hosts.
export function portablePath(value,{version}={}){
  value=value.replace(/(^|\/)素材\//g,'$1resources/').replace(/\.mjs(?=$|[?#])/g,'.js');
  return version?value.replace(/^assets\//,`assets-${version}/`):value;
}

function versioned(value,version){
  return /\.js$/.test(value)?`${value}?v=${version}`:value;
}

function moduleSpecifier(value,version){
  // Keep Three's identity bound to the document importmap even when a host
  // redirects an importing module to a different CDN parent URL.
  if(/(?:^|\/)three\.module\.js(?:[?#].*)?$/.test(value))return 'three';
  if(/(?:^|\/)three\.core\.js(?:[?#].*)?$/.test(value))return 'three/core';
  return versioned(value,version);
}

export function portableText(text,{extension,version,sourcePath='index.html'}){
  text=text.replaceAll('/素材/','/resources/').replaceAll('/%E7%B4%A0%E6%9D%90/','/resources/');
  if(version){
    const parentDepth=Math.max(0,sourcePath.replaceAll('\\','/').split('/').length-1),insideAssets=sourcePath.replaceAll('\\','/').startsWith('assets/');
    // Match URL starts in quoted JS/JSON/HTML strings and CSS url(...), rather
    // than every nested /assets/ segment. Modules moved inside assets retain
    // their own ./assets/ and ./model/assets/ relative directories.
    text=text.replace(/(['"`(]\s*)((?:(?:\.\.\/)+|\.\/|\/)?assets\/)/g,(match,open,prefix)=>{
      const parents=(prefix.match(/\.\.\//g)||[]).length;
      const rootAbsolute=prefix.startsWith('/');
      if(insideAssets&&!rootAbsolute&&parents!==parentDepth)return match;
      return open+prefix.replace(/assets\/$/,`assets-${version}/`);
    });
  }
  // Only file suffixes change; authored card prose and the source files stay intact.
  text=text.replace(/\.mjs(?=['"?#])/g,'.js');
  if(extension==='.js'||extension==='.mjs'){
    text=text.replace(/(\bfrom\s*|\bimport\s*\(\s*|\bimport\s*)(['"])([^'"\n]+)\2/g,
      (_,prefix,quote,specifier)=>prefix+quote+moduleSpecifier(specifier,version)+quote);
  }
  if(extension==='.html'){
    text=text.replace(/(<script type="importmap">)([\s\S]*?)(<\/script>)/,(_,open,json,close)=>{
      const map=JSON.parse(json);
      if(typeof map.imports.three==='string')map.imports['three/core']=map.imports.three.replace(/three\.module\.js(?:[?#].*)?$/,'three.core.js');
      for(const key of Object.keys(map.imports))map.imports[key]=versioned(map.imports[key],version);
      return open+JSON.stringify(map)+close;
    });
    text=text.replace(/((?:src|href)=")(\.\/[^"\n]+\.js)(")/g,
      (_,prefix,url,end)=>prefix+versioned(url,version)+end);
    text=text.replace('<html lang="zh-CN">',`<html lang="zh-CN" data-release="${version}">`);
  }
  return text;
}
