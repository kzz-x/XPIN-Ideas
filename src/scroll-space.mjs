import {yieldTask} from './preparation.mjs';
import {createCardMorph} from './card-morph.mjs';
import {resourcePhases,RESOURCE_DURATION,createTitleMotion,createEnding} from './scroll-motion.mjs';
import * as T from 'three';
import {frostedGlass,glassEdges} from './frosted-glass.mjs';
import {CSS3DObject} from 'three/addons/renderers/CSS3DRenderer.js';
import {CHAPTERS,RESOURCES} from './content.mjs';
import {createResourceShelf,createResourceModel} from './resource-models.mjs';
import {clamp,smooth,damp,vec,titleMesh,label,line,box} from './space-utils.mjs';

export async function createScrollSpace({scene,camera,onFocus=()=>{},onSound=()=>{},onReplay=()=>{}}){
  const root=new T.Group();root.name='Continuous creative scroll';scene.add(root);
  const objects=[],cards=[],industrials=[],resources=[],layoutLabels=[],layoutLines=[],titles=[];
  let resourceSeen={};try{resourceSeen=JSON.parse(localStorage.getItem('linggan-resource-seen-r09')||'{}');}catch{}
  const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  let animationTime=0,hoveredTitle=null,hoveredIndustrial=null,hoveredResource=null;
  const cardTilt=0,labelTilt=-Math.PI/4;
  function placeLabel(text,width,height,{x=0,y=.65,z=0,chapter=-1,kind='caption',...style}={}){
    const mesh=label(text,width,height,{...style,size:Math.max(70,style.size||70),color:kind==='continuation'?'#e8eef4':style.color||'#f2f5f7'});mesh.name=`Chapter ${chapter+1} / ${kind}`;
    mesh.rotation.x=labelTilt;mesh.position.set(x,y,z);
    mesh.userData.readableLabel={text,chapter,kind,width,height};
    root.add(mesh);objects.push({group:mesh,z});layoutLabels.push(mesh);return mesh;
  }
  // r02: one saturated printed surface, neutral technical objects and precise edges.
  // These are the supplied reference's sRGB palette values, converted by Three.
  const palette=['#051DAA','#7000A9','#B2005B','#B03400','#00632E','#0F0F0F'];
  const paletteLinear=palette.map(hex=>new T.Color(hex));
  const cardSurfaces=['#142DAE','#7724A9','#A71B64','#AA431E','#176E42'];
  const styleTitle=object=>{object.traverse(o=>{if(!o.isMesh)return;const list=Array.isArray(o.material)?o.material:[o.material];list.forEach((m,i)=>{m.color.set(i===0?'#F5F5F0':'#989CA2');m.roughness=.68;m.metalness=.035;});});return object;};
  function raiseTitle(title){title.rotation.x=-Math.PI/2+T.MathUtils.degToRad(20);title.updateMatrixWorld(true);const bounds=new T.Box3().setFromObject(title);title.position.y+=.18-bounds.min.y;return title;}
  const ribbonGeometry=new T.PlaneGeometry(22,105,4,180);ribbonGeometry.rotateX(-Math.PI/2);
  const positions=ribbonGeometry.attributes.position;for(let i=0;i<positions.count;i++){const local=positions.getZ(i)-18;const over=Math.max(0,-local-35);const a=Math.min(over/18,1.42);positions.setXYZ(i,positions.getX(i),over>0?18*(1-Math.cos(a)):0,over>0?-35-18*Math.sin(a):local);}positions.needsUpdate=true;ribbonGeometry.computeVertexNormals();
  const ribbonMat=new T.MeshStandardMaterial({color:0xffffff,roughness:.86,metalness:0,side:T.DoubleSide});
  const uniforms={scroll:{value:0},unfold:{value:1}};
  ribbonMat.onBeforeCompile=shader=>{shader.uniforms.uScroll=uniforms.scroll;shader.uniforms.uUnfold=uniforms.unfold;shader.uniforms.uBands={value:paletteLinear};shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec2 vScrollUv;').replace('#include <uv_vertex>','#include <uv_vertex>\nvScrollUv=uv;');shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nuniform float uScroll;uniform float uUnfold;uniform vec3 uBands[6];varying vec2 vScrollUv;');shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
    float pageZ=(.5-vScrollUv.y)*105.-18.-uScroll;
    float section=floor((12.-pageZ)/34.);
    vec3 band=uBands[0];
    if(section>0.5)band=uBands[1];
    if(section>1.5)band=uBands[2];
    if(section>2.5)band=uBands[3];
    if(section>3.5)band=uBands[4];
    if(section>4.5)band=uBands[5];
    float rule=1.-smoothstep(.004,.012,abs(fract((pageZ+22.)/34.)-.5));
    band=mix(band,vec3(.75),rule*.035);
    diffuseColor.rgb=mix(vec3(.055),band,uUnfold);
  `);};
  ribbonMat.customProgramCacheKey=()=> 'linggan-scroll-r02-reference-palette';
  const ribbon=new T.Mesh(ribbonGeometry,ribbonMat);ribbon.receiveShadow=true;root.add(ribbon);
  const grid=new T.Group();
  for(const [divisions,color,opacity] of [[500,0x77797c,.13],[50,0xa1a2a5,.16]]){const layer=new T.GridHelper(500,divisions,color,color);layer.position.y=-.13;layer.material.transparent=true;layer.material.opacity=opacity;grid.add(layer);}root.add(grid);
  const rails=new T.Group();for(const x of [-11,11]){const pts=[];for(let z=33;z>=-70;z-=.5){const over=Math.max(0,-z-35),a=Math.min(over/18,1.42);pts.push(vec(x,over>0?18*(1-Math.cos(a))+.025:.025,over>0?-35-18*Math.sin(a):z));}rails.add(line(pts,0xdddfe2,.42));}root.add(rails);
  let focus=null,focusMix=0,focusGoal=0,hover=null,focusAge=0;
  const backdrop=document.querySelector('#focus-backdrop');
  const readingLayer=document.createElement('div');readingLayer.id='reading-layer';Object.assign(readingLayer.style,{position:'fixed',inset:'0',zIndex:'6',pointerEvents:'none'});document.body.append(readingLayer);let readingCard=null;
  function surface(el){const wrapper=document.createElement('div');wrapper.className='spatial-surface';wrapper.append(el);return new CSS3DObject(wrapper);}
  function restoreReading(){if(!readingCard)return;const card=readingCard;card.css.element.append(card.el);for(const key of ['position','left','top','transform','transformOrigin'])card.el.style[key]='';readingCard=null;}
  function syncReading(){if(!focus||!focusGoal||focusMix<1){restoreReading();return;}const card=focus,rect=card.css.element.getBoundingClientRect();if(readingCard!==card){restoreReading();readingCard=card;readingLayer.append(card.el);}Object.assign(card.el.style,{position:'absolute',left:rect.x+'px',top:rect.y+'px',transformOrigin:'0 0',transform:`scale(${rect.width/card.el.offsetWidth})`,pointerEvents:'auto'});}
  const escape=s=>String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function open(card){
    if(focus)return;card.morph?.prepare();focus=card;focusGoal=1;focusAge=0;focusMix=0;
    card.openBase=card.group.position.clone();card.openQ=card.group.quaternion.clone();
    card.el.classList.add('focused');document.body.classList.add('has-focus');
    if(card.isResource){const r=resources.find(r=>r.card===card);r.visited=true;resourceSeen[r.kind]=true;try{localStorage.setItem('linggan-resource-seen-r09',JSON.stringify(resourceSeen));}catch{}}
    else backdrop.classList.add('open');
    onFocus(true);onSound('open');
  }
  function close(){if(!focus)return;focus.morph?.beginClose();restoreReading();focusGoal=0;backdrop.classList.remove('open');onSound('close');}
  function cancelFocus(){
    restoreReading();if(focus){focus.el.classList.remove('focused');focus.morph?.reset();focus.group.position.copy(focus.base);focus.group.quaternion.copy(focus.baseQ);focus.group.scale.setScalar(1);if(focus.isResource)focus.group.visible=false;}
    focus=null;focusAge=focusMix=focusGoal=0;backdrop.classList.remove('open');document.body.classList.remove('has-focus');onFocus(false);
  }

  // A touch on a model opens this layer on pointerup. Its following compatibility
  // click must not be mistaken for a new press on the newly visible backdrop.
  let backdropPressed=false;
  window.addEventListener('pointerdown',e=>{backdropPressed=e.target===backdrop;},true);
  window.addEventListener('pointercancel',()=>{backdropPressed=false;},true);
  backdrop.addEventListener('click',()=>{if(backdropPressed)close();backdropPressed=false;});document.querySelector('#close-focus').addEventListener('click',close);window.addEventListener('keydown',e=>{if(e.key==='Escape')close();});
  function detailHTML(c){const paragraphs=(c.body||[]).map(p=>`<p>${escape(p)}</p>`).join('');const comparison=c.id==='review-detail'?`<div class="comparison" style="--split:50%"><div class="compare-half before" style="background-image:url('${c.image}');background-position:left top"></div><div class="compare-half after" style="background-image:url('${c.image}');background-position:right top"></div><div class="compare-line"></div><input aria-label="拖动查看 v05 与 v06 B 候选的同坐标细节" type="range" min="0" max="100" value="50"></div><p class="source-note">拖动分界线：左为 v05，右为 v06 B 候选。取自原图同坐标裁切；右侧尚未标为通过。</p>`:`<figure><img src="${c.image}" alt="${escape(c.title)}"></figure>`;return `<div class="detail-label">${escape(c.subtitle||'CREATIVE ARCHIVE')} / 过程档案</div><h2>${escape(c.title)}</h2>${comparison}${paragraphs}${c.images?.length?`<div class="detail-gallery">${c.images.map((im,i)=>`<button data-image="${im}">画面 ${i+1}</button>`).join('')}</div>`:''}<p class="source-note">${escape(c.sourceNote||'真实历史过程素材；展示编排为当前候选，非最终观众文案。')}</p>`;}
  function makeCard(c,chapter,index){const el=document.createElement('article');el.className=`process-card ${index===0?'hero-card':'support-card'}`;el.style.setProperty('--chapter-color',palette[chapter]);el.style.setProperty('--card-surface',cardSurfaces[chapter]);el.setAttribute('aria-label',`打开过程卡片：${c.title}`);el.setAttribute('tabindex','0');el.dataset.cardId=c.id;el.innerHTML=`<div class="card-meta"><span>${String(chapter+1).padStart(2,'0')} / ${escape(c.subtitle||'PROCESS')}</span><span>↗</span></div><h2>${escape(c.title)}</h2><img class="card-image" src="${c.image}" alt="${escape(c.title)}" draggable="false"><div class="card-bottom"><span>过程档案 · 点击展开</span><span class="card-arrow">↗</span></div><div class="card-detail">${detailHTML(c)}</div>`;
    const group=new T.Group(),size=index===0?9.4:5.35,scale=size/640;
    // CSS owns the one visible perimeter. The inset solid board supplies depth,
    // shadow and the same raycast target without a second bright raster edge.
    const backing=new T.Mesh(new T.BoxGeometry(size-.035,420*scale-.035,.18),frostedGlass({color:0xbacbd8,thickness:.28,roughness:.34,transmission:.93,envMapIntensity:.16}));backing.position.z=-.095;backing.name='Physical frosted archive card / 0.18 world-unit thickness';backing.receiveShadow=true;group.add(backing);const frame=glassEdges(backing.geometry,{opacity:.54});frame.position.copy(backing.position);group.add(frame);
    const css=surface(el);css.scale.setScalar(scale);group.add(css);
    // The board rests flat. A small hover rise is applied around its lower edge.
    // Primary and support columns have a real gap in both world and screen space.
    // All far edges end before z=-10; game geometry starts after z=-12.
    const chapterZ=-chapter*34,mirrored=chapter===2;
    const x=index===0?(mirrored?2.05:-2.15):(mirrored?-6.05:6.05);
    const z=chapterZ+(index===0?-3.8:index===1?-.8:-8.2),height=420*scale;
    group.position.set(x,Math.sin(cardTilt)*height/2+.195,z);group.rotation.set(-Math.PI/2+cardTilt,0,0);root.add(group);
    const card={group,el,css,frame,c,chapter,width:size,height,base:group.position.clone(),baseQ:group.quaternion.clone(),hover:0,morph:createCardMorph(el)};cards.push(card);objects.push({group,z});el.addEventListener('pointerenter',()=>hover=card);el.addEventListener('pointerleave',()=>{if(hover===card)hover=null;});let down=null;el.addEventListener('pointerdown',e=>down={x:e.clientX,y:e.clientY});el.addEventListener('click',e=>{if(down&&Math.hypot(e.clientX-down.x,e.clientY-down.y)>8)return;if(!focus){open(card);e.stopPropagation();}});el.addEventListener('keydown',e=>{if(e.key==='Enter'){open(card);e.preventDefault();}});el.querySelector('.card-detail').addEventListener('wheel',e=>e.stopPropagation(),{passive:true});el.querySelector('.card-detail').addEventListener('pointerdown',e=>e.stopPropagation());el.querySelectorAll('[data-image]').forEach(btn=>btn.addEventListener('click',e=>{e.stopPropagation();el.querySelector('.card-detail figure img').src=btn.dataset.image;}));el.querySelector('.comparison input')?.addEventListener('input',e=>e.target.parentElement.style.setProperty('--split',e.target.value+'%'));return card;
  }
  for(const [i,chapter] of CHAPTERS.entries()){await yieldTask();const z=-i*34,mainSide=i===2?1:-1;const title=styleTitle(titleMesh(chapter.title,1.85,.22));title.name=`Chapter ${i+1} / title`;title.position.set(mainSide*3.6,0,z+4.0);root.add(raiseTitle(title));titles.push(createTitleMotion(title));objects.push({group:title,z:z+4.0});
    placeLabel(chapter.kicker,7,.42,{x:mainSide*3.6,y:.22,z:z+5.9,chapter:i,kind:'kicker',size:25,color:'#e1e1dc'});
    placeLabel(chapter.description,10.8,.58,{x:0,y:.40,z:z+7.2,chapter:i,kind:'description',size:29,color:'#f0f0ea'});
    const headingRule=line([vec(mainSide*9.5,.055,z+1.0),vec(mainSide*9.5,.055,z+7.3)],0xe8e8df,.27);headingRule.name=`Chapter ${i+1} / header separator`;root.add(headingRule);objects.push({group:headingRule,z:z+.7});layoutLines.push(headingRule);
    chapter.cards.forEach((c,j)=>makeCard(c,i,j));
    const connection=line([vec(mainSide*10.2,.065,z-8.5),vec(mainSide*10.2,.065,z-14.2),vec(mainSide*10.45,.065,z-14.2)],0xe5e5df,.48);connection.name=`Chapter ${i+1} / outside connector`;root.add(connection);objects.push({group:connection,z:z-11});layoutLines.push(connection);
    placeLabel(['转动观察','排出步骤','连接用途','找出问题','整理交付'][i],3.0,.60,{x:mainSide*5.3,y:1.45,z:z-11.9,chapter:i,kind:'action',color:'#efefea',size:150});
    makeIndustrial(i,z-6);
  }
  function makeIndustrial(i,z){
    const side=i%2===0?1:-1;
    function artifact(minor=false){
      const g=new T.Group();g.name=(minor?'Technical detail / ':'Engineering assembly / ')+['Optical inspection','Ordered layers','Routing board','Articulated mechanism','Archive enclosure'][i];
      g.position.set((minor?-side:side)*(minor?14.65:14.8),.25,z+(minor?8.0:0));
      const positions=[],normals=[],edgePositions=[];
      function part(geometry,p=[0,0,0],r=[0,0,0]){
        const matrix=new T.Matrix4().compose(vec(...p),new T.Quaternion().setFromEuler(new T.Euler(...r)),vec(1,1,1));
        geometry.applyMatrix4(matrix);
        const edges=new T.EdgesGeometry(geometry,24);edgePositions.push(...edges.attributes.position.array);edges.dispose();
        const flat=geometry.index?geometry.toNonIndexed():geometry;
        positions.push(...flat.attributes.position.array);normals.push(...flat.attributes.normal.array);
        if(flat!==geometry)flat.dispose();geometry.dispose();
      }
      const block=(w,h,d,p,r)=>part(new T.BoxGeometry(w,h,d),p,r);
      const cylinder=(radius,length,p,r)=>part(new T.CylinderGeometry(radius,radius,length,20),p,r);
      function stroke(points){for(let n=1;n<points.length;n++)edgePositions.push(...points[n-1],...points[n]);}
      if(minor){
        // One restrained sectional detail balances the larger assembly opposite.
        block(2.2,.10,1.5,[0,.05,0]);
        for(const x of [-.83,.83])block(.09,1.65,.09,[x,.88,0]);
        for(const y of [.65,1.55])block(1.82,.09,.09,[0,y,0]);
        cylinder(.43,.27,[0,1.1,.18],[Math.PI/2,0,0]);
        part(new T.TorusGeometry(.32,.025,4,24),[0,1.1,.34]);
        stroke([[-1.25,.02,.95],[1.25,.02,.95]]);
      }else if(i===0){
        block(3.65,.14,2.35,[0,.07,0]);
        for(const x of [-1.55,1.55])for(const zz of [-.82,.82])block(.10,2.95,.10,[x,1.62,zz]);
        for(const y of [.26,3.05]){block(3.2,.10,.10,[0,y,-.82]);block(3.2,.10,.10,[0,y,.82]);for(const x of [-1.55,1.55])block(.10,.10,1.7,[x,y,0]);}
        block(1.65,.12,1.3,[0,.62,0]);block(.84,.84,.84,[0,1.15,0],[0,.24,0]);
        cylinder(.58,.48,[0,2.32,.48],[Math.PI/2,0,0]);
        part(new T.TorusGeometry(.47,.038,4,32),[0,2.32,.75]);
        for(const x of [-.95,.95])block(.20,.53,.18,[x,2.42,-.48]);
        stroke([[-1.55,2.32,.82],[1.55,2.32,.82]]);
      }else if(i===1){
        block(3.5,.15,2.4,[0,.075,0]);
        for(const x of [-1.45,1.45])for(const zz of [-.85,.85])cylinder(.045,2.5,[x,1.40,zz]);
        for(let k=0;k<4;k++){
          block(2.82,.13,1.78,[0,.48+k*.57,0]);
          block(1.15,.12,.63,[k%2?-.46:.46,.61+k*.57,.18]);
          stroke([[-1.22,.58+k*.57,-.60],[.15,.58+k*.57,-.60],[.15,.58+k*.57,-.24]]);
        }
        block(.34,.15,1.85,[-1.67,.45,0]);
      }else if(i===2){
        block(3.8,.15,2.8,[0,.18,0]);block(1.26,.30,1.06,[0,.40,0]);block(.93,.09,.75,[0,.60,0]);
        for(let k=0;k<8;k++)for(const sign of [-1,1]){
          block(.065,.05,.35,[-.50+k*.143,.31,sign*.72]);
          block(.35,.05,.065,[sign*.82,.31,-.47+k*.134]);
        }
        for(const x of [-1.40,1.40])for(const zz of [-.93,.93])cylinder(.075,.06,[x,.29,zz]);
        block(.47,.32,1.66,[-1.40,.40,0]);block(.62,.25,.47,[1.30,.36,-.66]);block(.62,.25,.47,[1.30,.36,.62]);
        for(const zz of [-.92,-.68,.68,.92])stroke([[-1.12,.27,zz],[-.70,.27,zz],[-.70,.27,zz*.35],[.15,.27,zz*.35]]);
      }else if(i===3){
        block(2.8,.16,2.35,[0,.08,0]);cylinder(.53,.25,[-.65,.30,0]);
        block(.38,1.72,.48,[-.65,1.20,0]);cylinder(.38,.70,[-.65,2.10,0],[0,0,Math.PI/2]);
        block(1.90,.28,.37,[.16,2.31,0],[0,0,.24]);cylinder(.28,.58,[1.10,2.54,0],[Math.PI/2,0,0]);
        block(.19,.95,.26,[1.10,2.03,0]);
        for(const x of [.85,1.35])block(.09,.55,.16,[x,1.50,0],[0,0,x<1.1?-.16:.16]);
        stroke([[-1.50,.17,-.80],[1.55,.17,-.80],[1.55,.17,.80]]);
      }else{
        block(3.7,.12,2.4,[0,.06,0]);
        for(const x of [-1.65,1.65])for(const zz of [-.92,.92])block(.09,3.1,.09,[x,1.63,zz]);
        for(const y of [.40,1.42,2.44,3.13])block(3.38,.075,1.94,[0,y,0]);
        for(let k=0;k<3;k++)block(.60,.84,1.40,[-1.03+k*.76,.85,.02]);
        block(1.42,.72,1.42,[-.62,1.83,.02]);block(.82,.52,1.40,[.73,1.74,.02]);
        block(2.02,.42,1.48,[0,2.69,.02]);
      }
      // Dimension rules have structural meaning and share the model's transform.
      if(!minor){stroke([[-2.20,.015,1.60],[2.20,.015,1.60]]);for(const x of [-2.20,2.20]){stroke([[x,.015,1.35],[x,.015,1.85]]);stroke([[x-Math.sign(x)*.20,.015,1.46],[x,.015,1.60],[x-Math.sign(x)*.20,.015,1.74]]);}stroke([[2.30,.05,-1.10],[2.30,3.15,-1.10]]);for(const y of [.05,3.15])stroke([[2.13,y,-1.10],[2.47,y,-1.10]]);}
      const bodyGeometry=new T.BufferGeometry();bodyGeometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));bodyGeometry.setAttribute('normal',new T.Float32BufferAttribute(normals,3));bodyGeometry.computeBoundingSphere();
      const bodyMaterial=new T.MeshStandardMaterial({color:0x101113,metalness:.12,roughness:.78});
      const body=new T.Mesh(bodyGeometry,bodyMaterial);body.name='Opaque depth silhouette / one batched draw';body.castShadow=true;body.receiveShadow=true;g.add(body);
      const edgeGeometry=new T.BufferGeometry();edgeGeometry.setAttribute('position',new T.Float32BufferAttribute(edgePositions,3));edgeGeometry.computeBoundingSphere();
      const edgeMaterial=new T.LineBasicMaterial({color:0xdfe1e2,transparent:true,opacity:minor?.50:.71});
      const outline=new T.LineSegments(edgeGeometry,edgeMaterial);outline.name='Structural edges / one batched draw';g.add(outline);root.add(g);
      placeLabel(`${minor?'DETAIL':'FIG'} ${String(i+1).padStart(2,'0')} / ${['OPTICS','SEQUENCE','ROUTING','STRUCTURE','ARCHIVE'][i]}`,minor?3.4:5.6,.36,{x:g.position.x,y:.34,z:g.position.z+(minor?1.95:3.05),chapter:i,kind:minor?'detail ID':'engineering ID',size:25,color:'#a6a9ae'});
      const record={group:g,z:g.position.z,bodyMaterial,edgeMaterial,mode:0,mix:0,hover:0,hoverGoal:0,minor,baseYaw:(minor?-.18:.24)*side};industrials.push(record);objects.push({group:g,z:g.position.z});
    }
    artifact(false);artifact(true);
  }
  await yieldTask();
  const shelf=createResourceShelf();shelf.position.set(0,0,-177);root.add(shelf);objects.push({group:shelf,z:-177});
  const resourceTitle=styleTitle(titleMesh('资源档案',1.85,.22));resourceTitle.name='Chapter 6 / title';resourceTitle.position.set(-3,0,-169);root.add(raiseTitle(resourceTitle));titles.push(createTitleMotion(resourceTitle));objects.push({group:resourceTitle,z:-169});
  RESOURCES.forEach((r,i)=>{
    const model=createResourceModel(r.kind,{label}),{group:g,lid,parts=[]}=model;
    g.name=`Resource ${r.kind}`;g.position.set(-4.2+i*4.2,i===1?2.78:.3,0);shelf.add(g);
    const tagEl=document.createElement('button');tagEl.className='shelf-tag';tagEl.textContent=r.title+' ↗';const tag=new CSS3DObject(tagEl);tag.scale.setScalar(.014);tag.position.set(g.position.x,g.position.y+.30,2.3);tag.rotation.x=labelTilt;tag.name='Resource tag / '+r.kind;tag.userData.readableLabel={text:r.title,chapter:5,kind:'resource tag'};shelf.add(tag);
    const detailEl=document.createElement('article');detailEl.className='process-card resource-detail';detailEl.innerHTML=`<div class="card-detail" style="display:block"><div class="detail-label">RESOURCE / 资源档案</div><h2>${escape(r.title)}</h2><span class="pending">${escape(r.status||'待补充')}</span><div class="resource-symbol">${['[ / ]','{ + }','[ ≡ ]'][i]}</div><p>${escape(r.description)}</p>${(r.body||[]).map(t=>`<p>${escape(t)}</p>`).join('')}<p class="source-note">领取内容确定后再接入；私密源工程不自动对外提供。</p></div>`;const dg=new T.Group();const css=surface(detailEl);css.scale.setScalar(.0125);dg.add(css);dg.position.copy(shelf.position).add(vec(g.position.x,4,4));dg.visible=false;root.add(dg);const card={group:dg,el:detailEl,css,c:r,chapter:5,width:8,base:dg.position.clone(),baseQ:dg.quaternion.clone(),isResource:true};cards.push(card);const guidePositions=[];for(let k=0;k<72;k++)if(k%9<6){for(const a of [k/72*Math.PI*2,(k+1)/72*Math.PI*2])guidePositions.push(Math.cos(a),Math.sin(a),0);}
    const guideGeo=new T.BufferGeometry();guideGeo.setAttribute('position',new T.Float32BufferAttribute(guidePositions,3));
    const guide=new T.LineSegments(guideGeo,new T.LineBasicMaterial({color:0xd3e8f0,transparent:true,opacity:.6,depthWrite:false}));guide.name='First click reminder / '+r.kind;root.add(guide);
    const plate=new T.Mesh(new T.BoxGeometry(7.98,5.23,.10),frostedGlass({color:0xbacbd8,thickness:.18,roughness:.36,transmission:.9,envMapIntensity:.16}));plate.position.z=-.065;dg.add(plate);
    const record={group:g,lid,parts,model,kind:r.kind,card,guide,tagEl,base:g.position.clone(),hover:0,visited:!!resourceSeen[r.kind],phases:resourcePhases(0)};resources.push(record);tagEl.addEventListener('click',e=>{e.stopPropagation();dg.visible=true;open(card);});tagEl.addEventListener('pointerenter',()=>record.hover=1);tagEl.addEventListener('pointerleave',()=>record.hover=0);tagEl.addEventListener('pointerleave',()=>record.hover=0);detailEl.querySelector('.card-detail').addEventListener('wheel',e=>e.stopPropagation(),{passive:true});
  });
  const noteEl=document.createElement('div');noteEl.className='end-note';noteEl.innerHTML='从一个想法，到一次完成。<small>回看影片 · 返回任一章节 · 留在这里看看资源</small>';const note=new CSS3DObject(noteEl);note.scale.setScalar(.014);note.rotation.x=labelTilt;note.position.set(0,.7,-194);root.add(note);objects.push({group:note,z:-194});
  await yieldTask();
  const ending=createEnding(titleMesh,camera);root.add(ending.root);
  const raycaster=new T.Raycaster();raycaster.params.Line.threshold=.065;const pointer=new T.Vector2();
  const industrialDark=new T.Color('#101113'),industrialSolid=new T.Color('#92969B');
  function pointerHit(e){if(focus)return false;pointer.set(e.clientX/innerWidth*2-1,-e.clientY/innerHeight*2+1);raycaster.setFromCamera(pointer,camera);const rs=raycaster.intersectObjects(resources.map(r=>r.group).filter(g=>g.visible&&g.parent.visible),true);if(rs.length){
      // Only the visible face can receive a click; shelf steel and Dot remain
      // real occluders. This also permits model hits outside Dot's body but
      // inside the larger, forgiving Dot assistance hit radius.
      const surfaces=[];scene.traverse(o=>{if(!o.isMesh)return;for(let p=o;p;p=p.parent)if(!p.visible)return;const ms=Array.isArray(o.material)?o.material:[o.material];if(ms.every(m=>!m.visible||m.transparent&&m.opacity<.05))return;surfaces.push(o);});
      const nearest=raycaster.intersectObjects(surfaces,false)[0];if(nearest&&rs[0].distance>nearest.distance+.012)return false;
      const r=resources.find(r=>{let o=rs[0].object;while(o){if(o===r.group)return true;o=o.parent;}return false;});if(r){r.card.group.visible=true;open(r.card);return true;}return false;}
    // Some Chromium CSS3D hit tests fall through a steeply tilted card. The
    // matching physical backplate provides the same click target in WebGL.
    const activeCards=cards.filter(c=>!c.isResource&&c.group.visible&&c.readable>=.5);
    const cardHits=raycaster.intersectObjects(activeCards.map(c=>c.group.children.find(o=>o.isMesh)).filter(Boolean),false);
    if(cardHits.length){const card=activeCards.find(c=>c.group===cardHits[0].object.parent);if(card)open(card);return;}
    const hits=raycaster.intersectObjects(industrials.map(r=>r.group).filter(g=>g.visible),true);if(hits.length){const record=industrials.find(r=>{let o=hits[0].object;while(o){if(o===r.group)return true;o=o.parent;}return false;});if(record){record.mode=record.mode?0:1;onSound('open');}}}
  function clearHover(){hoveredTitle=hoveredIndustrial=hoveredResource=null;for(const i of industrials)i.hoverGoal=0;}
  function pointerMove(e){
    if(focus||e.target.closest('button,input,dialog,.process-card')){clearHover();return;}
    pointer.set(e.clientX/innerWidth*2-1,1-e.clientY/innerHeight*2);raycaster.setFromCamera(pointer,camera);
    const meshes=titles.filter(r=>r.title.visible).flatMap(r=>r.letters.map(l=>l.mesh));
    const hit=raycaster.intersectObjects(meshes,false)[0];
    if(hit){const record=titles.find(r=>r.letters.some(l=>l.mesh===hit.object));if(hoveredTitle!==hit.object){onSound('select');if(!reduced)record.trigger(hit.object,animationTime);}hoveredTitle=hit.object;}else hoveredTitle=null;
    const candidates=industrials.filter(i=>i.group.visible),h=raycaster.intersectObjects(candidates.map(i=>i.group.children.find(o=>o.isMesh)),false)[0];
    const previousIndustrial=hoveredIndustrial;hoveredIndustrial=h?candidates.find(i=>i.group===h.object.parent):null;if(hoveredIndustrial&&hoveredIndustrial!==previousIndustrial)onSound('hover');for(const i of industrials)i.hoverGoal=i===hoveredIndustrial?1:0;
    const rh=raycaster.intersectObjects(resources.filter(r=>r.group.parent.visible).map(r=>r.group),true)[0];
    const previousResource=hoveredResource;hoveredResource=rh?resources.find(r=>{for(let o=rh.object;o;o=o.parent)if(o===r.group)return true;return false;}):null;if(hoveredResource&&hoveredResource!==previousResource)onSound('hover');
    {const ch=raycaster.intersectObjects(cards.filter(c=>!c.isResource&&c.group.visible).map(c=>c.group.children.find(o=>o.isMesh)),false)[0];hover=ch?cards.find(c=>c.group===ch.object.parent):null;}
  }
  // Read-only projection evidence for layout QA. No render-time collision tricks:
  // the actual fixed world transforms must leave the projected polygons clear.
  const inkBoundsCache=new WeakMap();
  function snapshotLayout(){
    root.updateMatrixWorld(true);camera.updateMatrixWorld(true);
    const visible=o=>{for(let p=o;p;p=p.parent)if(!p.visible)return false;return true;};
    const project=p=>{const v=p.clone().project(camera);return {x:(v.x+1)*innerWidth/2,y:(1-v.y)*innerHeight/2,z:v.z};};
    const bounds=pts=>({left:Math.min(...pts.map(p=>p.x)),right:Math.max(...pts.map(p=>p.x)),top:Math.min(...pts.map(p=>p.y)),bottom:Math.max(...pts.map(p=>p.y))});
    const quad=(o,w,h)=>{const points=[vec(-w/2,h/2,0),vec(w/2,h/2,0),vec(w/2,-h/2,0),vec(-w/2,-h/2,0)].map(v=>v.applyMatrix4(o.matrixWorld)),screen=points.map(project);
      const px=project(vec(-.5,0,0).applyMatrix4(o.matrixWorld)),qx=project(vec(.5,0,0).applyMatrix4(o.matrixWorld)),py=project(vec(0,-.5,0).applyMatrix4(o.matrixWorld)),qy=project(vec(0,.5,0).applyMatrix4(o.matrixWorld));
      return {quad:screen,bounds:bounds(screen),inFront:points.every(p=>p.clone().applyMatrix4(camera.matrixWorldInverse).z < -camera.near),cameraDepths:points.map(p=>-p.clone().applyMatrix4(camera.matrixWorldInverse).z),worldMinY:Math.min(...points.map(p=>p.y)),aspectRetention:Math.hypot(qy.x-py.x,qy.y-py.y)/Math.max(.0001,Math.hypot(qx.x-px.x,qx.y-px.y))};};
    const records=[];
    for(const c of cards)if(!c.isResource&&visible(c.group))records.push({id:c.c.id,kind:'card',chapter:c.chapter,opacity:Number(c.el.style.opacity),...quad(c.group,c.width,c.width*c.el.offsetHeight/c.el.offsetWidth)});
    for(const o of layoutLabels)if(visible(o)){
      const w=o.geometry.parameters.width,h=o.geometry.parameters.height,canvas=o.material.map.image;
      let ink=inkBoundsCache.get(o);
      if(!ink){const pixels=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;let left=canvas.width,top=canvas.height,right=0,bottom=0;for(let y=0;y<canvas.height;y++)for(let x=0;x<canvas.width;x++)if(pixels[(y*canvas.width+x)*4+3]>32){left=Math.min(left,x);right=Math.max(right,x+1);top=Math.min(top,y);bottom=Math.max(bottom,y+1);}ink={left,top,right,bottom};inkBoundsCache.set(o,ink);}
      const inkQuad=[[ink.left,ink.top],[ink.right,ink.top],[ink.right,ink.bottom],[ink.left,ink.bottom]].map(([x,y])=>project(vec((x/canvas.width-.5)*w,(.5-y/canvas.height)*h,0).applyMatrix4(o.matrixWorld)));
      records.push({id:o.name,...o.userData.readableLabel,opacity:o.material.opacity,typography:o.userData.typography,...quad(o,w,h),inkQuad,inkBounds:bounds(inkQuad)});
    }
    for(const o of root.children.filter(o=>o.name.endsWith('/ title')))if(visible(o)){const points=[];let inFront=true;o.traverse(m=>{if(!m.isMesh)return;const a=m.geometry.attributes.position;for(let i=0;i<a.count;i++){const world=vec(a.getX(i),a.getY(i),a.getZ(i)).applyMatrix4(m.matrixWorld);inFront=inFront&&world.clone().applyMatrix4(camera.matrixWorldInverse).z < -camera.near;points.push(project(world));}});records.push({id:o.name,kind:'title',chapter:Number(o.name.split(' ')[1])-1,inFront,bounds:bounds(points)});}
    for(const o of shelf.children.filter(o=>o.isCSS3DObject))if(visible(o))records.push({id:o.name,...o.userData.readableLabel,...quad(o,o.element.offsetWidth,o.element.offsetHeight)});
    const lines=layoutLines.filter(visible).map(o=>{const a=o.geometry.attributes.position,points=[];for(let i=0;i<a.count;i++)points.push(project(vec(a.getX(i),a.getY(i),a.getZ(i)).applyMatrix4(o.matrixWorld)));return {id:o.name,points};});
    return {viewport:{width:innerWidth,height:innerHeight},records,lines};
  }
  return {root,ribbon,grid,cards,resources,industrials,titles,ending,close,cancelFocus,open,pointerHit,pointerMove,clearHover,syncReading,snapshotLayout,get focused(){return !!focus;},get focusMix(){return focusMix;},cameraFocus(){if(!focus)return null;const target=focus.base.clone();target.y=focus.isResource?5:6;target.z+=1;const widthPx=Math.min(innerWidth*.84,920),distance=focus.width*innerHeight/(2*Math.tan(T.MathUtils.degToRad(camera.fov/2))*widthPx);const position=target.clone().add(vec(0,.25,1).normalize().multiplyScalar(distance));return {target,position,mix:smooth(focusMix)};},update({scroll,time,dt,unfold=1}){
      animationTime=time;
      uniforms.scroll.value=scroll;uniforms.unfold.value=unfold;ribbon.position.z=-scroll;rails.position.z=-scroll;
      // The side grid is fixed in the same world coordinates as the content.
      // Both respond to the shared camera, including scrolling and mouse parallax.
      grid.position.z=-96;root.visible=unfold>.001;
      const resource=focus?.isResource?resources.find(r=>r.card===focus):null;
      if(focus){focusAge=clamp(focusAge+(focusGoal?1:-1)*dt,0,resource?RESOURCE_DURATION:.95);focusMix=resource?clamp((focusAge-1.9)/.95):clamp(focusAge/.95);
        if(resource&&focusAge>1.9&&focusGoal)backdrop.classList.add('open');
        if(focusAge===0&&!focusGoal){focus.el.classList.remove('focused');focus.morph?.reset();if(focus.isResource)focus.group.visible=false;focus=null;focusMix=0;document.body.classList.remove('has-focus');onFocus(false);}
      }
      const fm=smooth(focusMix),contentReveal=smooth((unfold-.42)/.5);
      for(const o of objects)o.group.visible=Math.abs(o.z+scroll)<51&&unfold>.43;
      for(const text of layoutLabels){
        const meta=text.userData.typography,desired=text.userData.readableLabel.kind==='description'?16:13;text.scale.setScalar(1);text.updateMatrixWorld(true);
        const a=vec(0,-meta.worldHeight/2,0).applyMatrix4(text.matrixWorld).project(camera),b=vec(0,meta.worldHeight/2,0).applyMatrix4(text.matrixWorld).project(camera),pixels=Math.hypot((b.x-a.x)*innerWidth/2,(b.y-a.y)*innerHeight/2)*meta.fontPx/meta.canvasHeight;
        const grow=Math.min(2.4,20/meta.worldWidth,Math.max(1,desired/Math.max(.01,pixels)));text.scale.setScalar(grow);text.userData.screenFontEstimate=pixels*grow;
        const alpha=1-smooth((Math.abs(text.position.z+scroll)-13)/6);text.material.opacity=alpha*(1-fm*.9);text.visible=text.visible&&alpha>.01&&!(innerWidth<700&&['action','kicker'].includes(text.userData.readableLabel.kind));
      }
      note.visible=false;note.element.style.opacity=String(smooth((scroll-184)/5));ending.update(scroll,time,reduced);ending.root.visible&&=unfold>.9;
      for(const t of titles)t.update(dt,time);
      // Extract, open, emerge and only then move into the reading position.
      for(const r of resources){
        const selected=focus===r.card,p=resourcePhases(selected?focusAge:0);r.phases=p;r.tagEl.style.opacity=String(1-p.extract);r.tagEl.style.pointerEvents=focus?"none":"auto";
        const hoverTarget=r.hover||hoveredResource===r?1:0;
        r.group.position.copy(r.base);r.group.position.z+=p.extract*(r.kind==='book'?2.7:3.3)+hoverTarget*.04;r.group.rotation.y=-p.extract*.1;
        r.model.update(p.open,hoverTarget);
        r.guide.visible=!r.visited&&shelf.visible&&!focus;r.guide.position.copy(r.group.getWorldPosition(vec())).add(vec(0,r.kind==='book'?1.1:.75,0));r.guide.quaternion.copy(camera.quaternion);
        r.guide.scale.setScalar((r.kind==='book'?1.45:1.65)*(1+.025*Math.sin(time*2.4)));r.guide.material.opacity=.30+.20*(.5+.5*Math.sin(time*2.4));
      }
      for(const card of cards){
        if(card.isResource&&card!==focus)continue;
        const layoutMix=card===focus&&innerWidth<700?fm:0,domW=T.MathUtils.lerp(640,340,layoutMix),domH=T.MathUtils.lerp(420,640,layoutMix);
        card.el.style.width=domW+'px';card.el.style.height=domH+'px';card.css.element.style.width=domW+'px';card.css.element.style.height=domH+'px';card.css.element.style.pointerEvents=focus&&card!==focus?'none':'auto';card.css.scale.setScalar(card.width/domW);
        const backing=card.group.children.find(c=>c.isMesh);if(backing)backing.scale.y=(domH/domW)/(420/640);if(card.frame)card.frame.scale.y=(domH/domW)/(420/640);
        if(card===focus){
          const cf=this.cameraFocus(),rot=new T.Matrix4().lookAt(cf.position,cf.target,vec(0,1,0)),q=new T.Quaternion().setFromRotationMatrix(rot);
          if(card.isResource){
            const r=resources.find(r=>r.card===card),p=r.phases,origin=r.group.localToWorld(vec(0,r.kind==='book'?1:.7,.25));
            const emerged=origin.clone().add(vec(0,2.3,1.4));card.group.position.lerpVectors(origin,emerged,p.emerge).lerp(cf.target,fm);card.group.quaternion.copy(q);
            card.group.scale.setScalar(T.MathUtils.lerp(.001+.55*p.emerge,1,fm));card.group.visible=focusAge>1.3;card.el.style.opacity='1';
          }else{
            card.group.position.lerpVectors(card.openBase,cf.target,fm);card.group.position.x+=Math.sin(fm*Math.PI)*.18;card.group.quaternion.slerpQuaternions(card.openQ,q,fm);card.el.style.opacity='1';card.group.visible=true;
          }
          card.morph?.update(fm);
        }else{
          card.hover=damp(card.hover,hover===card?1:0,9,dt);const tilt=(reduced?0:card.hover)*T.MathUtils.degToRad(7);
          card.group.position.copy(card.base);card.group.position.y=card.base.y+Math.sin(tilt)*card.height/2+card.hover*.06;card.group.rotation.set(-Math.PI/2+tilt,0,0);card.group.updateMatrixWorld(true);card.morph?.update(0);
          const px=vec(-.5,0,0).applyMatrix4(card.group.matrixWorld).project(camera),qx=vec(.5,0,0).applyMatrix4(card.group.matrixWorld).project(camera),py=vec(0,-.5,0).applyMatrix4(card.group.matrixWorld).project(camera),qy=vec(0,.5,0).applyMatrix4(card.group.matrixWorld).project(camera);
          const ratio=Math.hypot((qy.x-py.x)*innerWidth,(qy.y-py.y)*innerHeight)/Math.max(.0001,Math.hypot((qx.x-px.x)*innerWidth,(qx.y-px.y)*innerHeight));
          const nearZ=Math.max(...[-1,1].flatMap(x=>[-1,1].map(y=>vec(x*card.width/2,y*card.height/2,0).applyMatrix4(card.group.matrixWorld).applyMatrix4(camera.matrixWorldInverse).z))),nearFade=1-smooth((nearZ+2.5)/2),passedFade=1-smooth((card.base.z+scroll-7)/5);
          const readable=nearZ<-camera.near?smooth((ratio-.28)/.12)*nearFade*passedFade:0,nearContent=1-smooth((Math.abs(card.base.z+scroll)-13)/4);
          const screenScale=Math.hypot((qx.x-px.x)*innerWidth/2,(qx.y-px.y)*innerHeight/2)*card.width/640;
          const fontScale=screenScale*Math.min(1,Math.max(.70,ratio));
          card.el.style.setProperty('--thumb-title',Math.max(29,Math.min(innerWidth<700?100:60,14/Math.max(.08,fontScale)))+'px');card.el.style.setProperty('--thumb-meta',Math.max(20,Math.min(innerWidth<700?90:48,11.5/Math.max(.08,fontScale)))+'px');card.el.style.setProperty('--thumb-foot',Math.max(22,Math.min(innerWidth<700?95:50,12/Math.max(.08,fontScale)))+'px');
          card.el.dataset.screenScale=screenScale.toFixed(4);card.readable=readable*nearContent;card.group.visible=card.group.visible&&card.readable>.01;card.el.style.opacity=String((1-fm*.9)*contentReveal*card.readable);
          if(backing)backing.visible=card.readable>.5;if(card.frame)card.frame.visible=card.readable>.5;card.el.style.pointerEvents=focus||card.readable<.5?'none':'auto';card.css.element.style.pointerEvents=card.el.style.pointerEvents;card.el.tabIndex=card.readable>=.5?0:-1;
        }
      }
      for(const i of industrials){
        i.mix=damp(i.mix,i.mode,4.5,dt);i.hover=damp(i.hover,i.hoverGoal,8,dt);
        i.bodyMaterial.color.copy(industrialDark).lerp(industrialSolid,smooth(i.mix));i.edgeMaterial.opacity=T.MathUtils.lerp(i.minor?.50:.71,.26,smooth(i.mix))+i.hover*.18;i.bodyMaterial.metalness=.12+i.mix*.16;
        i.group.rotation.y=i.baseYaw+Math.sin(time*.16+i.z*.03)*.12+(reduced?0:i.hover*.24);i.group.rotation.z=reduced?0:-i.hover*.035;i.group.position.y=.25+(reduced?0:i.hover*.16);
      }
    }};
}
