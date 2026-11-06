import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {portablePath,portableText} from '../portable-build.mjs';
import {releaseFiles} from '../release-files.mjs';

const version='abcdef012345';
const htmlSource=`<html lang="zh-CN"><script type="importmap">{"imports":{"three":"./assets/dot/model/frozen/r07d/editable-stage/素材/v011/DotSharedWeb/vendor/three.module.js","three/addons/":"./assets/vendor/addons/"}}</script><link rel="modulepreload" href="./src/main.mjs"><script type="module" src="./src/main.mjs"></script></html>`;
const transformedHTML=()=>portableText(htmlSource,{extension:'.html',version});
const importMap=html=>JSON.parse(html.match(/<script type="importmap">([\s\S]*?)<\/script>/)[1]).imports;

test('portable entry, modulepreload and exact Three mapping use the same release while addon directory remains a valid prefix',()=>{
  const html=transformedHTML(),map=importMap(html);
  assert.equal(map.three,'./assets-'+version+'/dot/model/frozen/r07d/editable-stage/resources/v011/DotSharedWeb/vendor/three.module.js?v='+version);
  assert.equal(map['three/core'],'./assets-'+version+'/dot/model/frozen/r07d/editable-stage/resources/v011/DotSharedWeb/vendor/three.core.js?v='+version);
  assert.equal(map['three/addons/'],'./assets-'+version+'/vendor/addons/');
  assert.ok(html.includes('href="./src/main.js?v='+version+'"'));
  assert.ok(html.includes('src="./src/main.js?v='+version+'"'));
  assert.ok(html.includes('data-release="'+version+'"'));
});

test('bare Three, relative direct Three and importmap aliases resolve to one module identity',()=>{
  const origin='https://example.test/demo/';
  const app=portableText(`import * as T from 'three'; import {CSS3DObject} from 'three/addons/renderers/CSS3DRenderer.js'; const next=()=>import('./next.mjs');`,{extension:'.mjs',version});
  assert.ok(app.includes("from 'three'"));
  assert.ok(app.includes("from 'three/addons/renderers/CSS3DRenderer.js?v="+version+"'"));
  assert.ok(app.includes("import('./next.js?v="+version+"')"));
  const component=portableText(`import * as T from './vendor/three.module.js';`,{extension:'.mjs',version});
  const direct=component.match(/from '([^']+)'/)[1];
  assert.equal(direct,'three');
  assert.equal(new URL(importMap(transformedHTML())[direct],origin).href,new URL(importMap(transformedHTML()).three,origin).href);
});

test('all literal Three imports and core re-exports are document aliases, including pre-versioned dynamic URLs',()=>{
  const source=`import * as T from './vendor/three.module.js'; export {Vector3} from '../vendor/three.core.js?v=older'; const a=import('https://cdn.test/pkg/three.module.js?cache=old'); const b=import('./three.core.js#old');`;
  const result=portableText(source,{extension:'.mjs',version});
  assert.ok(result.includes("from 'three'"));
  assert.ok(result.includes("from 'three/core'"));
  assert.ok(result.includes("import('three')"));
  assert.ok(result.includes("import('three/core')"));
  assert.doesNotMatch(result,/vendor\/|cdn\.test|older|cache=old|#old/);
});

test('the real release module closure has a single Three module/core identity even with CDN module parents',async()=>{
  const root=fileURLToPath(new URL('../',import.meta.url)),{files}=await releaseFiles(root),documents=new Map();
  const sourceHTML=await fs.readFile(path.join(root,'index.html'),'utf8');
  const map=importMap(portableText(sourceHTML,{extension:'.html',version})),documentURL='https://site.example.test/demo/index.html';
  for(const file of files.filter(p=>/\.(?:mjs|js)$/.test(p)))documents.set(portablePath(file,{version}),portableText(await fs.readFile(path.join(root,file),'utf8'),{extension:path.extname(file),version,sourcePath:file}));
  const imports=/\b(?:from\s*|import\s*\(\s*|import\s*)(['"])([^'"\n]+)\1/g;
  const resolve=(specifier,parent)=>{
    if(Object.hasOwn(map,specifier))return new URL(map[specifier],documentURL).href;
    for(const key of Object.keys(map))if(key.endsWith('/')&&specifier.startsWith(key))return new URL(map[key]+specifier.slice(key.length),documentURL).href;
    if(specifier.startsWith('.')||specifier.startsWith('/'))return new URL(specifier,parent).href;
    return null;
  };
  const threeURLs=new Set(),coreURLs=new Set();let directEdges=0,coreEdges=0;
  for(const [file,text]of documents){
    const parent=new URL(file+'?v='+version,new URL('.',documentURL));
    for(const match of text.matchAll(imports)){
      const specifier=match[2];
      assert.doesNotMatch(specifier,/(?:^|\/)three\.(?:module|core)\.js(?:[?#]|$)/,file+' keeps a parent-relative Three import');
      const target=resolve(specifier,parent),url=target&&new URL(target);
      if(url&&url.origin===new URL(documentURL).origin&&/\.js$/.test(url.pathname)){
        const local=decodeURIComponent(url.pathname.slice('/demo/'.length));
        assert.ok(documents.has(local),file+' -> '+specifier+' missing from closure');
      }
      if(specifier!=='three'&&specifier!=='three/core')continue;
      if(specifier==='three'){threeURLs.add(target);directEdges++;}else{coreURLs.add(target);coreEdges++;}
      for(const foreignParent of ['https://cdn.example.test/cache/'+file+'?v='+version,'https://another-cdn.test/rewrite/entry.js'])assert.equal(resolve(specifier,foreignParent),target,file+' changes Three identity under a CDN parent');
    }
  }
  assert.ok(directEdges>30,'inspect actual main, addons, Dot and stage imports');
  assert.ok(coreEdges>=2,'inspect actual Three internal import and export');
  assert.equal(threeURLs.size,1);assert.equal(coreURLs.size,1);
  assert.equal([...coreURLs][0],[...threeURLs][0].replace('three.module.js','three.core.js'));
});

test('moving a folder segment keeps relative import.meta asset resolution at the same depth',()=>{
  const origin='https://example.test/nested/site/';
  const modulePath='assets/dot/model/frozen/r07d/editable-stage/素材/v011/DotSharedWeb/dot-component.mjs';
  const relative='./assets/dot-character.glb';
  const before=new URL(relative,new URL(modulePath,origin));
  const after=new URL(relative,new URL(portablePath(modulePath,{version})+'?v='+version,origin));
  assert.equal(decodeURI(after.pathname),new URL(portablePath(decodeURI(before.pathname).slice('/nested/site/'.length),{version}),origin).pathname);
  const source=`const asset=new URL('./assets/dot-character.glb',import.meta.url);`;
  assert.equal(portableText(source,{extension:'.mjs',version,sourcePath:modulePath}),source);
});

test('portable text preserves complete authored chapter copy and card media layout',async()=>{
  const source=await fs.readFile(new URL('../src/content.mjs',import.meta.url),'utf8');
  const text=portableText(source,{extension:'.mjs',version,sourcePath:'src/content.mjs'});
  const before=await import(new URL('../src/content.mjs',import.meta.url));
  const after=await import('data:text/javascript;base64,'+Buffer.from(text).toString('base64'));
  assert.deepEqual(after.CHAPTERS.flatMap(c=>[c.title,...c.cards.flatMap(card=>[card.title,...card.body])]),before.CHAPTERS.flatMap(c=>[c.title,...c.cards.flatMap(card=>[card.title,...card.body])]));
  assert.deepEqual(after.RESOURCES,before.RESOURCES);
  assert.deepEqual(after.CHAPTERS.flatMap(c=>c.cards.map(card=>card.media.map(m=>({kind:m.kind,caption:m.caption,after:m.after})))),before.CHAPTERS.flatMap(c=>c.cards.map(card=>card.media.map(m=>({kind:m.kind,caption:m.caption,after:m.after})))));
});

test('only the top-level assets tree is versioned, with source-relative nested assets preserved',()=>{
  assert.equal(portablePath('assets/dot/model/assets/dot-character.glb',{version}),'assets-'+version+'/dot/model/assets/dot-character.glb');
  assert.equal(portablePath('model/assets/model.glb',{version}),'model/assets/model.glb');
  assert.equal(portablePath('assets/example.png'),'assets/example.png');
  const source=`const a='./assets/a.png',b='../assets/b.png',c='assets/c.png',d='/assets/d.png',e='./model/assets/e.glb';const f=\`./assets/media/bgm/tank-b-\${name}.flac\`;`;
  const result=portableText(source,{extension:'.mjs',version,sourcePath:'src/example.mjs'});
  for(const name of ['a','b','c','d'])assert.ok(result.includes('assets-'+version+'/'+name+'.png'));
  assert.ok(result.includes('`./assets-'+version+'/media/bgm/tank-b-${name}.flac`'));
  assert.ok(result.includes("'./model/assets/e.glb'"));
  assert.equal(portableText(`const a='./assets/a.glb',b='../assets/b.glb',c='../../assets/c.glb';`,{extension:'.mjs',version,sourcePath:'assets/model/index.mjs'}),`const a='./assets/a.glb',b='../assets/b.glb',c='../../assets-${version}/c.glb';`);
  assert.equal(portableText(`a{background:url( /assets/a.png )}b{background:url(assets/b.png)}`,{extension:'.css',version,sourcePath:'styles.css'}),`a{background:url( /assets-${version}/a.png )}b{background:url(assets-${version}/b.png)}`);
});

test('real CSS/fonts, card media, BGM and film manifests close under the versioned assets root',async()=>{
  const root=fileURLToPath(new URL('../',import.meta.url)),{files}=await releaseFiles(root);
  const outputs=new Set(files.map(file=>portablePath(file,{version})));
  assert.equal(outputs.size,files.length,'renaming must not collide');
  assert.ok(![...outputs].some(file=>file.startsWith('assets/')));
  const source=async file=>fs.readFile(path.join(root,file),'utf8');
  const transform=async file=>portableText(await source(file),{extension:path.extname(file),version,sourcePath:file});
  const doc='https://site.example.test/demo/index.html';
  const local=(url,parent=doc)=>decodeURIComponent(new URL(url,parent).pathname.slice('/demo/'.length));
  const exists=(url,parent=doc)=>assert.ok(outputs.has(local(url,parent)),url+' is missing relative to '+parent);
  const html=await transform('index.html');
  for(const match of html.matchAll(/(?:src|href)=["']([^"']+)["']/g)){
    const url=match[1];if(url.startsWith('./assets-'+version+'/'))exists(url);
  }
  let fonts=0;
  for(const file of files.filter(file=>file.endsWith('.css'))){
    const css=await transform(file),parent=new URL(portablePath(file,{version}),new URL('.',doc));
    for(const match of css.matchAll(/url\(\s*['"]?([^\s)'"\n]+)['"]?\s*\)/g)){
      const url=match[1];if(/^(?:data:|https?:|#)/.test(url))continue;
      exists(url,parent);if(/\.woff2?(?:[?#]|$)/.test(url))fonts++;
    }
  }
  assert.ok(fonts>=2,'check the actual heading/body fonts');
  const content=await import('data:text/javascript;base64,'+Buffer.from(await transform('src/content.mjs')).toString('base64'));
  const original=await import(new URL('../src/content.mjs',import.meta.url));
  const expectedMedia=original.CHAPTERS.flatMap(c=>c.cards.flatMap(card=>card.media.flatMap(item=>['src','poster'].map(key=>item[key]).filter(url=>url?.startsWith('./assets/'))))).length;
  let media=0;
  for(const chapter of content.CHAPTERS)for(const card of chapter.cards)for(const item of card.media)for(const key of ['src','poster'])if(item[key]?.startsWith('./assets-'+version+'/')){exists(item[key]);media++;}
  assert.equal(media,expectedMedia,'check every actual card image/video/poster URL');
  assert.ok(media>30,'the real card asset set is populated');
  const bgmFile='assets/media/bgm/stream/manifest.json',bgm=JSON.parse(await transform(bgmFile));
  const bgmParent=new URL(portablePath(bgmFile,{version}),new URL('.',doc));
  assert.ok((await transform('src/bgm-stream.mjs')).includes('./assets-'+version+'/media/bgm/stream/manifest.json'));
  assert.equal(bgm.tracks.intro.src,'intro.m4a');
  for(const track of Object.values(bgm.tracks))for(const chunk of track.chunks)exists(chunk.src,bgmParent);
  exists(bgm.tracks.intro.src,bgmParent);
  const filmFile='assets/media/film-hd/manifest.json',film=JSON.parse(await transform(filmFile));
  const filmParent=new URL(portablePath(filmFile,{version}),new URL('.',doc));
  assert.ok((await transform('src/config.mjs')).includes('./assets-'+version+'/media/film-hd/manifest.json'));
  for(const key of ['fileParts','mobileParts']){
    assert.ok(film[key].length>0,'the logical full film uses an explicit assembly recipe');
    for(const chunk of film[key])exists(chunk.src,filmParent);
  }
  // The full .mp4 logical names are assembled in memory from these unchanged
  // binary parts; releaseFiles intentionally omits the monolithic originals.
  assert.equal(film.fileParts.reduce((sum,part)=>sum+part.bytes,0),film.fileBytes);
  assert.equal(film.mobileParts.reduce((sum,part)=>sum+part.bytes,0),film.mobileBytes);
  for(const file of files.filter(file=>/^assets\/.*\.json$/.test(file))){
    const json=await transform(file);JSON.parse(json.replace(/^\uFEFF/,''));
    assert.doesNotMatch(json,/['"](?:\.\/|\.\.\/|\/)?assets\//,file+' has a stale top-level assets URL');
  }
  // Scan the actual text closure as well as the named media APIs. Prefix URLs
  // are used by product/type/SFX loaders; an existing descendant proves their
  // renamed directory remains in the release. Dynamic template suffixes are
  // covered by the runtime-specific manifest/card checks above.
  let references=0;
  const omitted=new Set([
    'assets-'+version+'/media/film-mobile.mp4', // assembled from mobileParts
    'assets-'+version+'/dot/model/frozen/r07d/editable-stage/resources/v011/DotSharedWeb/assets/dot-character.glb', // unused deep component default; the rig passes model/assets explicitly
  ]);
  for(const file of files.filter(file=>/\.(?:mjs|js|html|css|json)$/.test(file))){
    const text=await transform(file),parent=new URL(portablePath(file,{version}),new URL('.',doc));
    for(const match of text.matchAll(/['"`]((?:(?:\.\.\/)+|\.\/|\/)?assets(?:-[a-f\d]+)?\/[^'"`\n]*)/g)){
      const url=match[1];if(url.includes('${'))continue;
      const target=local(url,(!file.startsWith('assets/')&&!url.startsWith('../'))?doc:parent);
      if(omitted.has(target))continue;
      assert.ok(outputs.has(target)||[...outputs].some(output=>output.startsWith(target)),file+' -> '+url+' is outside the release closure');
      references++;
    }
  }
  assert.ok(references>60,'scan real module, JSON, HTML and CSS resource URLs');
});
