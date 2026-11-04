import * as T from 'three';
import {CSS3DObject} from 'three/addons/renderers/CSS3DRenderer.js';
import {CHAPTERS,RESOURCES} from './content.mjs';
import {clamp,smooth,damp,vec,titleMesh,label,line,box} from './space-utils.mjs';

export function createScrollSpace({scene,camera,onFocus=()=>{},onSound=()=>{},onReplay=()=>{}}){
  const root=new T.Group();root.name='Continuous creative scroll';scene.add(root);
  const objects=[],cards=[],industrials=[],resources=[];
  // r02: one saturated printed surface, neutral technical objects and precise edges.
  // These are the supplied reference's sRGB palette values, converted by Three.
  const palette=['#051DAA','#7000A9','#B2005B','#B03400','#00632E','#0F0F0F'];
  const paletteLinear=palette.map(hex=>new T.Color(hex));
  const cardSurfaces=['#142DAE','#7724A9','#A71B64','#AA431E','#176E42'];
  const styleTitle=object=>{object.traverse(o=>{if(!o.isMesh)return;const list=Array.isArray(o.material)?o.material:[o.material];list.forEach((m,i)=>{m.color.set(i===0?'#F5F5F0':'#989CA2');m.roughness=.68;m.metalness=.035;});});return object;};
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
  let focus=null,focusMix=0,focusGoal=0,hover=null;
  const backdrop=document.querySelector('#focus-backdrop');
  const readingLayer=document.createElement('div');readingLayer.id='reading-layer';Object.assign(readingLayer.style,{position:'fixed',inset:'0',zIndex:'6',pointerEvents:'none'});document.body.append(readingLayer);let readingCard=null;
  function surface(el){const wrapper=document.createElement('div');wrapper.className='spatial-surface';wrapper.append(el);return new CSS3DObject(wrapper);}
  function restoreReading(){if(!readingCard)return;const card=readingCard;card.css.element.append(card.el);for(const key of ['position','left','top','transform','transformOrigin'])card.el.style[key]='';readingCard=null;}
  function syncReading(){if(!focus||!focusGoal||focusMix<1){restoreReading();return;}const card=focus,rect=card.css.element.getBoundingClientRect();if(readingCard!==card){restoreReading();readingCard=card;readingLayer.append(card.el);}Object.assign(card.el.style,{position:'absolute',left:rect.x+'px',top:rect.y+'px',transformOrigin:'0 0',transform:`scale(${rect.width/card.el.offsetWidth},${rect.height/card.el.offsetHeight})`,pointerEvents:'auto'});}
  const escape=s=>String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function open(card){if(focus===card&&focusGoal)return;if(focus)return;focus=card;focusGoal=1;card.el?.classList.add('focused');document.body.classList.add('has-focus');backdrop.classList.add('open');onFocus(true);onSound('open');}
  function close(){if(!focus)return;restoreReading();focusGoal=0;backdrop.classList.remove('open');onSound('close');}
  backdrop.addEventListener('click',close);document.querySelector('#close-focus').addEventListener('click',close);window.addEventListener('keydown',e=>{if(e.key==='Escape')close();});
  function detailHTML(c){const paragraphs=(c.body||[]).map(p=>`<p>${escape(p)}</p>`).join('');const comparison=c.id==='review-detail'?`<div class="comparison" style="--split:50%"><div class="compare-half before" style="background-image:url('${c.image}');background-position:left top"></div><div class="compare-half after" style="background-image:url('${c.image}');background-position:right top"></div><div class="compare-line"></div><input aria-label="拖动查看 v05 与 v06 B 候选的同坐标细节" type="range" min="0" max="100" value="50"></div><p class="source-note">拖动分界线：左为 v05，右为 v06 B 候选。取自原图同坐标裁切；右侧尚未标为通过。</p>`:`<figure><img src="${c.image}" alt="${escape(c.title)}"></figure>`;return `<div class="detail-label">${escape(c.subtitle||'CREATIVE ARCHIVE')} / 过程档案</div><h2>${escape(c.title)}</h2>${comparison}${paragraphs}${c.images?.length?`<div class="detail-gallery">${c.images.map((im,i)=>`<button data-image="${im}">画面 ${i+1}</button>`).join('')}</div>`:''}<p class="source-note">${escape(c.sourceNote||'真实历史过程素材；展示编排为当前候选，非最终观众文案。')}</p>`;}
  function makeCard(c,chapter,index){const el=document.createElement('article');el.className=`process-card ${index===0?'hero-card':'support-card'}`;el.style.setProperty('--chapter-color',palette[chapter]);el.style.setProperty('--card-surface',cardSurfaces[chapter]);el.setAttribute('aria-label',`打开过程卡片：${c.title}`);el.setAttribute('tabindex','0');el.dataset.cardId=c.id;el.innerHTML=`<div class="card-meta"><span>${String(chapter+1).padStart(2,'0')} / ${escape(c.subtitle||'PROCESS')}</span><span>↗</span></div><h2>${escape(c.title)}</h2><img class="card-image" src="${c.image}" alt="${escape(c.title)}" draggable="false"><div class="card-bottom"><span>过程档案 · 点击展开</span><span class="card-arrow">↗</span></div><div class="card-detail">${detailHTML(c)}</div>`;
    const group=new T.Group(),size=index===0?(chapter===4?10.1:9.4):5.35,scale=size/640;
    const backing=box(size,420*scale,.065,0x898d93,{roughness:.72,metalness:.08});backing.name='Physical archival board / focus hit target';group.add(backing);
    const frame=new T.Group();frame.name='Fine board silhouette and registration corners';
    const perimeter=new T.LineSegments(new T.EdgesGeometry(backing.geometry),new T.LineBasicMaterial({color:0xf0f0e9,transparent:true,opacity:.66}));frame.add(perimeter);
    for(const sx of [-1,1])for(const sy of [-1,1]){const x=sx*(size/2+.08),y=sy*(420*scale/2+.08);frame.add(line([vec(x-sx*.22,y,.041),vec(x,y,.041),vec(x,y-sy*.22,.041)],0xe9e9e3,.55));}group.add(frame);
    const css=surface(el);css.scale.setScalar(scale);css.position.z=.042;group.add(css);
    // The three plates occupy one bounded editorial field. Their far edge stops
    // before z=-11; the existing game fields begin after z=-12 and stay untouched.
    const chapterZ=-chapter*34,mirrored=chapter===2;
    const x=index===0?(mirrored?2.05:chapter===4?-1.95:-2.15):(mirrored?-6.05:6.05);
    const z=chapterZ+(index===0?-5.65:index===1?-3.35:-8.25);
    group.position.set(x,index===0?.46:.34,z);group.rotation.set(-Math.PI/2+(index===0?.075:.105),0,index===0?-.008:index===1?.014:-.012);root.add(group);
    const card={group,el,css,frame,c,chapter,width:size,base:group.position.clone(),baseQ:group.quaternion.clone(),hover:0};cards.push(card);objects.push({group,z});el.addEventListener('pointerenter',()=>hover=card);el.addEventListener('pointerleave',()=>{if(hover===card)hover=null;});let down=null;el.addEventListener('pointerdown',e=>down={x:e.clientX,y:e.clientY});el.addEventListener('click',e=>{if(down&&Math.hypot(e.clientX-down.x,e.clientY-down.y)>8)return;if(!focus){open(card);e.stopPropagation();}});el.addEventListener('keydown',e=>{if(e.key==='Enter'){open(card);e.preventDefault();}});el.querySelector('.card-detail').addEventListener('wheel',e=>e.stopPropagation(),{passive:true});el.querySelector('.card-detail').addEventListener('pointerdown',e=>e.stopPropagation());el.querySelectorAll('[data-image]').forEach(btn=>btn.addEventListener('click',e=>{e.stopPropagation();el.querySelector('.card-detail figure img').src=btn.dataset.image;}));el.querySelector('.comparison input')?.addEventListener('input',e=>e.target.parentElement.style.setProperty('--split',e.target.value+'%'));return card;
  }
  CHAPTERS.forEach((chapter,i)=>{const z=-i*34;const title=styleTitle(titleMesh(chapter.title,1.85,.22));title.rotation.x=-Math.PI/2;title.position.set(-3.6,.20,z+2.6);root.add(title);objects.push({group:title,z:z+2.6});const num=label(chapter.kicker,7,.38,{size:25,color:'#e1e1dc'});num.rotation.x=-Math.PI/2;num.position.set(-4,.09,z+4.3);root.add(num);objects.push({group:num,z:z+4.3});const des=label(chapter.description,10,.55,{size:29,color:'#f0f0ea'});des.rotation.x=-Math.PI/2;des.position.set(-1,.09,z+.1);root.add(des);objects.push({group:des,z:z+.1});
    const headingRule=line([vec(-8.6,.055,z+5.05),vec(8.6,.055,z+5.05)],0xe8e8df,.27);root.add(headingRule);objects.push({group:headingRule,z:z+5.05});
    chapter.cards.forEach((c,j)=>makeCard(c,i,j));
    const connection=line([vec(-8.7,.065,z-8.6),vec(-8.7,.065,z-11.9),vec(0,.065,z-11.9),vec(0,.065,z-13)],0xe5e5df,.48);root.add(connection);objects.push({group:connection,z:z-11});const action=label('动手试试 / '+['转动观察','排出步骤','连接用途','找出问题','整理交付'][i],6,.45,{color:'#efefea',size:28});action.rotation.x=-Math.PI/2;action.position.set(-4,.10,z-12);root.add(action);objects.push({group:action,z:z-12});
    const end=label('结果留在这里 · 继续向下展开  ↓',7,.38,{size:23,color:'#c1cadc'});end.rotation.x=-Math.PI/2;end.position.set(2,.12,z-26);root.add(end);objects.push({group:end,z:z-26});
    makeIndustrial(i,z-6);
  });
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
      const lab=label(`${minor?'DETAIL':'FIG'} ${String(i+1).padStart(2,'0')} / ${['OPTICS','SEQUENCE','ROUTING','STRUCTURE','ARCHIVE'][i]}`,minor?3.4:5.6,.30,{size:25,color:'#a6a9ae'});lab.rotation.x=-Math.PI/2;lab.position.set(g.position.x,.04,g.position.z+(minor?1.65:2.55));root.add(lab);
      const record={group:g,z:g.position.z,bodyMaterial,edgeMaterial,mode:0,mix:0,minor,baseYaw:(minor?-.18:.24)*side};industrials.push(record);objects.push({group:g,z:g.position.z});objects.push({group:lab,z:g.position.z+(minor?1.65:2.55)});
    }
    artifact(false);artifact(true);
  }
  const shelf=new T.Group();shelf.position.set(0,0,-177);root.add(shelf);objects.push({group:shelf,z:-177});
  const resourceTitle=styleTitle(titleMesh('资源档案',1.85,.22));resourceTitle.rotation.x=-Math.PI/2;resourceTitle.position.set(-3,.2,-169);root.add(resourceTitle);objects.push({group:resourceTitle,z:-169});
  function shelfPart(mesh){const edge=new T.LineSegments(new T.EdgesGeometry(mesh.geometry),new T.LineBasicMaterial({color:0xc7c9c6,transparent:true,opacity:.38}));mesh.add(edge);shelf.add(mesh);}
  for(const x of [-6.3,6.3])for(const z of [-1,1.3]){const upright=box(.09,5.5,.09,0x747b81,{metalness:.28,roughness:.65});upright.position.set(x,2.75,z);shelfPart(upright);}for(const y of [.2,2.7,5.3]){const plate=box(12.8,.12,2.8,0x2d3034,{metalness:.10,roughness:.78});plate.position.y=y;shelfPart(plate);}
  RESOURCES.forEach((r,i)=>{const g=new T.Group();g.name=`Resource ${r.kind}`;g.position.set(-4.2+i*4.2,i===1?2.78:.3,0);shelf.add(g);const metal=0xb9bdc1,accent=[0xe7e8e2,0xb9bec6,0xedefe7][i];let lid,parts=[];
    if(r.kind==='book'){const pages=box(1.55,2.1,.34,0xb7c0c2);pages.position.y=1.05;g.add(pages);const back=box(1.64,2.2,.07,0x34373c);back.position.set(0,1.05,-.22);g.add(back);const pivot=new T.Group();pivot.position.set(-.82,1.05,.22);lid=box(1.64,2.2,.07,accent);lid.position.x=.82;pivot.add(lid);g.add(pivot);lid=pivot;const t=label('想法 / 方法',1.3,.3,{size:100,color:'#25292e'});t.position.set(.82,0,.05);pivot.add(t);}
    else if(r.kind==='toolbox'){const body=box(2.6,1.15,1.5,0x53575d,{roughness:.68,metalness:.08});body.position.y=.6;g.add(body);const p=new T.Group();p.position.set(0,1.2,-.75);lid=box(2.6,.12,1.5,accent);lid.position.z=.75;p.add(lid);g.add(p);lid=p;const handle=box(.8,.11,.14,metal);handle.position.set(0,.2,.7);lid.add(handle);for(const x of [-.6,.6]){const clasp=box(.13,.3,.08,metal);clasp.position.set(x,1.05,.8);g.add(clasp);}}
    else{const base=box(2.7,.4,1.7,0x4b5055,{roughness:.68,metalness:.08});base.position.y=.2;g.add(base);for(let j=0;j<3;j++){const p=box(2.5-j*.18,.22,1.55-j*.12,j===2?accent:0x777c82);p.position.y=.55+j*.28;g.add(p);parts.push(p);}lid=parts[2];}
    const tagEl=document.createElement('button');tagEl.className='shelf-tag';tagEl.textContent=r.title+' ↗';const tag=new CSS3DObject(tagEl);tag.scale.setScalar(.012);tag.position.set(0,-.04,2);tag.rotation.x=-Math.PI/2;shelf.add(tag);tag.position.x=g.position.x;tag.position.y=g.position.y+.05;
    const detailEl=document.createElement('article');detailEl.className='process-card resource-detail';detailEl.innerHTML=`<div class="card-detail" style="display:block"><div class="detail-label">RESOURCE / 资源档案</div><h2>${escape(r.title)}</h2><span class="pending">${escape(r.status||'待补充')}</span><div class="resource-symbol">${['[ / ]','{ + }','[ ≡ ]'][i]}</div><p>${escape(r.description)}</p>${(r.body||[]).map(t=>`<p>${escape(t)}</p>`).join('')}<p class="source-note">领取内容确定后再接入；私密源工程不自动对外提供。</p></div>`;const dg=new T.Group();const css=surface(detailEl);css.scale.setScalar(.0125);dg.add(css);dg.position.copy(shelf.position).add(vec(g.position.x,4,4));dg.visible=false;root.add(dg);const card={group:dg,el:detailEl,css,c:r,chapter:5,width:8,base:dg.position.clone(),baseQ:dg.quaternion.clone(),isResource:true};cards.push(card);const record={group:g,lid,parts,kind:r.kind,card,base:g.position.clone(),hover:0};resources.push(record);tagEl.addEventListener('click',e=>{e.stopPropagation();dg.visible=true;open(card);});tagEl.addEventListener('pointerenter',()=>record.hover=1);tagEl.addEventListener('pointerleave',()=>record.hover=0);detailEl.querySelector('.card-detail').addEventListener('wheel',e=>e.stopPropagation(),{passive:true});
  });
  const noteEl=document.createElement('div');noteEl.className='end-note';noteEl.innerHTML='从一个想法，到一次完成。<b>下一次，让你的想法先行。</b><small>回看影片 · 返回任一章节 · 留在这里看看资源</small>';const note=new CSS3DObject(noteEl);note.scale.setScalar(.014);note.rotation.x=-Math.PI/2+.3;note.position.set(0,.2,-188);root.add(note);objects.push({group:note,z:-188});
  const raycaster=new T.Raycaster();raycaster.params.Line.threshold=.065;const pointer=new T.Vector2();
  const industrialDark=new T.Color('#101113'),industrialSolid=new T.Color('#92969B');
  function pointerHit(e){if(focus)return;pointer.set(e.clientX/innerWidth*2-1,-e.clientY/innerHeight*2+1);raycaster.setFromCamera(pointer,camera);const rs=raycaster.intersectObjects(resources.map(r=>r.group).filter(g=>g.visible&&g.parent.visible),true);if(rs.length){const r=resources.find(r=>{let o=rs[0].object;while(o){if(o===r.group)return true;o=o.parent;}return false;});if(r){r.card.group.visible=true;open(r.card);}return;}
    // Some Chromium CSS3D hit tests fall through a steeply tilted card. The
    // matching physical backplate provides the same click target in WebGL.
    const activeCards=cards.filter(c=>!c.isResource&&c.group.visible);
    const cardHits=raycaster.intersectObjects(activeCards.map(c=>c.group.children.find(o=>o.isMesh)).filter(Boolean),false);
    if(cardHits.length){const card=activeCards.find(c=>c.group===cardHits[0].object.parent);if(card)open(card);return;}
    const hits=raycaster.intersectObjects(industrials.map(r=>r.group).filter(g=>g.visible),true);if(hits.length){const record=industrials.find(r=>{let o=hits[0].object;while(o){if(o===r.group)return true;o=o.parent;}return false;});if(record){record.mode=record.mode?0:1;onSound('open');}}}
  return {root,ribbon,cards,resources,close,open,pointerHit,syncReading,get focused(){return !!focus;},get focusMix(){return focusMix;},cameraFocus(){if(!focus)return null;const target=focus.base.clone();target.y=focus.isResource?5:6;target.z+=1;const widthPx=Math.min(innerWidth*.84,920),distance=focus.width*innerHeight/(2*Math.tan(T.MathUtils.degToRad(camera.fov/2))*widthPx);const position=target.clone().add(vec(0,.25,1).normalize().multiplyScalar(distance));return {target,position,mix:smooth(focusMix)};},update({scroll,time,dt,unfold=1}){
      uniforms.scroll.value=scroll;uniforms.unfold.value=unfold;ribbon.position.z=-scroll;rails.position.z=-scroll;grid.position.z=-scroll;root.visible=unfold>.001;
      focusMix=clamp(focusMix+(focusGoal?1:-1)*dt/.95);if(focus&&focusMix===0&&focusGoal===0){focus.el.classList.remove('focused');if(focus.isResource)focus.group.visible=false;focus=null;document.body.classList.remove('has-focus');onFocus(false);}
      const fm=smooth(focusMix),contentReveal=smooth((unfold-.42)/.5);for(const o of objects){const distance=Math.abs(o.z+scroll);o.group.visible=distance<51&&unfold>.43;}note.visible=scroll>181&&unfold>.9;note.element.style.opacity=String(smooth((scroll-181)/7));for(const card of cards){if(card.isResource&&card!==focus)continue;const layoutMix=card===focus&&innerWidth<700?fm:0,domW=T.MathUtils.lerp(640,340,layoutMix),domH=T.MathUtils.lerp(420,640,layoutMix);card.el.style.width=domW+"px";card.el.style.height=domH+"px";card.css.element.style.width=domW+"px";card.css.element.style.height=domH+"px";card.css.element.style.pointerEvents=focus&&card!==focus?"none":"auto";card.css.scale.setScalar(card.width/domW);const backing=card.group.children.find(c=>c.isMesh);if(backing)backing.scale.y=(domH/domW)/(420/640);if(card.frame)card.frame.scale.y=(domH/domW)/(420/640);if(card===focus){const cf=this.cameraFocus();card.group.position.lerpVectors(card.base,cf.target,fm);card.group.position.x+=Math.sin(fm*Math.PI)*.18;const rot=new T.Matrix4().lookAt(cf.position,cf.target,vec(0,1,0));const q=new T.Quaternion().setFromRotationMatrix(rot);card.group.quaternion.slerpQuaternions(card.baseQ,q,fm);card.el.style.opacity='1';card.group.visible=true;}else{card.hover=damp(card.hover,hover===card?1:0,7,dt);const proximity=1-clamp((Math.abs(card.base.z+scroll)-2)/22);card.group.position.copy(card.base);card.group.position.y=.15+(smooth(proximity)*1.15+card.hover*.24)*contentReveal;card.group.quaternion.copy(card.baseQ);card.el.style.opacity=String((1-fm*.9)*contentReveal);card.el.style.pointerEvents=focus?'none':'auto';}}
      for(const r of resources){const opened=focus===r.card?fm:0;r.group.position.copy(r.base);r.group.position.z+=opened*1.8+r.hover*.08;r.group.rotation.y=-opened*.12;if(r.kind==='book')r.lid.rotation.y=-opened*1.3;else if(r.kind==='toolbox')r.lid.rotation.x=-opened*1.2;else r.parts.forEach((p,i)=>p.position.y=.55+i*.28+smooth(clamp(opened*1.5-i*.18))*(i+1)*.45);}
      for(const i of industrials){i.mix=damp(i.mix,i.mode,4.5,dt);i.bodyMaterial.color.copy(industrialDark).lerp(industrialSolid,smooth(i.mix));i.edgeMaterial.opacity=T.MathUtils.lerp(i.minor?.50:.71,.26,smooth(i.mix));i.bodyMaterial.metalness=.12+i.mix*.16;i.group.rotation.y=i.baseYaw+Math.sin(time*.16+i.z*.03)*.12+Math.sin(time*.069)*.035;i.group.rotation.z=Math.sin(time*.13+i.z)*.018;}
    }};
}



