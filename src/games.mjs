import * as T from 'three';
import {createWordCube} from './games-cube.mjs';
import {createProductCarousel} from './games-products.mjs';
import {orders} from './games-layout.mjs';
import {WORDS,STEP_IDS,STEP_NAMES,TOOL_IDS,TOOL_NAMES,USE_IDS,USE_NAMES,TOOL_MATCH,CARGO_IDS,CARGO_NAMES,COUNTS,readProgress,saveProgress,validateDrop,markStep,completed,currentStep,stampUnlocked,resetChapter} from './games-rules.mjs';

const V=(x=0,y=0,z=0)=>new T.Vector3(x,y,z);
const ease=t=>{t=T.MathUtils.clamp(t,0,1);return t*t*t*(t*(6*t-15)+10);};
const tips=[
  '上下左右拖动玻璃方块。把一面转清楚，停一小会儿，词就会自动收好。',
  '按住流程板，拖到正确的顺序位置。先有目标，再把创作一步步组织起来。',
  '先看需求，再选工具。把四个工具拖到对应节点，让路径接通中央芯片。',
  '直接点击模型上不合理的位置。先看清局部修正，再检查转盘上的下一件。',
  '先备齐影片、互动场景和工程盒；三项全部落位后，发布印章才会解锁。'
];
const chapterNames=['看清想法','组织步骤','选择工具','发现问题','完成交付'];

export function createGames({scene,camera,renderer,canvas,chapterPositions,onFeedback=()=>{},onProgress=()=>{},onInteractionLock=()=>{},onGuide=()=>{}}) {
  const abort=new AbortController(),eventOptions={signal:abort.signal,capture:true};
  let state=readProgress(),active=-1,time=0,disposed=false,drag=null,helpSequence=null,lastHover=null;
  const roots=[],pieces=[],slots=[],paths=[],animations=[],labels=[],resources=[],loads=[];
  const raycaster=new T.Raycaster(),pointer=new T.Vector2();
  // The default one-unit line threshold would select neighbouring board outlines.
  raycaster.params.Line.threshold=.025;
  const materials={
    white:new T.MeshStandardMaterial({color:0xf5f4ec,roughness:.38,metalness:.08}),
    side:new T.MeshStandardMaterial({color:0x9b9fa4,roughness:.38,metalness:.32}),
    dark:new T.MeshStandardMaterial({color:0x171b22,roughness:.36,metalness:.48}),
    glass:new T.MeshPhysicalMaterial({color:0xe4e9e8,roughness:.19,metalness:.12,clearcoat:.8,transparent:true,opacity:.84}),
    blue:new T.MeshStandardMaterial({color:0x183bc1,roughness:.34,metalness:.18}),
    gold:new T.MeshStandardMaterial({color:0xc5ae7a,roughness:.31,metalness:.72}),
    green:new T.MeshStandardMaterial({color:0xb7f2d0,roughness:.32,metalness:.18,emissive:0x2f925b,emissiveIntensity:.12}),
    line:new T.LineBasicMaterial({color:0x8da9d0,transparent:true,opacity:.48}),
    goldLine:new T.LineBasicMaterial({color:0xf3cf7f,transparent:true,opacity:.85}),
  };
  function box(w,h,d,mat,p,parent){
    const o=new T.Mesh(new T.BoxGeometry(w,h,d),mat);o.position.set(...p);o.castShadow=o.receiveShadow=true;parent.add(o);return o;
  }
  function line(points,mat,parent){const o=new T.Line(new T.BufferGeometry().setFromPoints(points.map(p=>Array.isArray(p)?V(...p):p)),mat);parent.add(o);return o;}
  const readingQuaternion=new T.Quaternion().setFromEuler(new T.Euler(-.70,0,0));
  function label(parent,text,p,w=2,h=.4,{surface=false,color='#e5eefb',font=58,weight=600,align='center'}={}){
    const c=document.createElement('canvas'),ctx=c.getContext('2d');
    const tx=new T.CanvasTexture(c);tx.colorSpace=T.SRGBColorSpace;tx.anisotropy=Math.min(4,renderer?.capabilities?.getMaxAnisotropy?.()||1);
    const m=new T.MeshBasicMaterial({map:tx,transparent:true,depthWrite:false,side:T.DoubleSide,toneMapped:false});
    const o=new T.Mesh(new T.PlaneGeometry(w,h),m);o.position.set(...p);if(surface){o.rotation.x=-.70;o.position.y+=h*.5*Math.cos(.70)+.04;}parent.add(o);labels.push(o);
    o.userData.readingSurface=surface;
    let previous=null;
    o.userData.setText=(value)=>{
      if(value===previous)return;previous=value;ctx.clearRect(0,0,c.width,c.height);ctx.fillStyle=color;ctx.textAlign=align;ctx.textBaseline='middle';
      const rows=String(value).split('\n'),padding=Math.max(8,c.width*.025),available=c.width-padding*2;
      let size=Math.min(c.height/(rows.length*1.22),c.height*.80*(font/70));
      const setFont=()=>ctx.font=`${weight} ${size}px "Idea","IdeaScene","Microsoft YaHei",sans-serif`;
      setFont();const natural=Math.max(1,...rows.map(row=>ctx.measureText(row).width));if(natural>available){size*=available/natural;setFont();}
      let measuredWidth=0,glyphHeight=0;const inkBounds={left:Infinity,top:Infinity,right:-Infinity,bottom:-Infinity};
      rows.forEach((row,i)=>{const metrics=ctx.measureText(row),x=align==='left'?padding:align==='right'?c.width-padding:c.width/2,y=c.height/2+(i-(rows.length-1)/2)*size*1.22;measuredWidth=Math.max(measuredWidth,metrics.width);glyphHeight=Math.max(glyphHeight,metrics.actualBoundingBoxAscent+metrics.actualBoundingBoxDescent);inkBounds.left=Math.min(inkBounds.left,x-metrics.actualBoundingBoxLeft);inkBounds.right=Math.max(inkBounds.right,x+metrics.actualBoundingBoxRight);inkBounds.top=Math.min(inkBounds.top,y-metrics.actualBoundingBoxAscent);inkBounds.bottom=Math.max(inkBounds.bottom,y+metrics.actualBoundingBoxDescent);ctx.fillText(row,x,y);});
      o.name='Game text / '+String(value);o.userData.typography={text:String(value),worldWidth:w,worldHeight:h,canvasWidth:c.width,canvasHeight:c.height,fontPx:size,measuredWidth,glyphHeight,inkBounds,canvasAspectRatio:c.width/c.height,geometryAspectRatio:w/h,fontReady:!!document.fonts?.check(`${weight} 16px Idea`),surface};tx.needsUpdate=true;
    };
    o.userData.refresh=()=>{const value=previous;previous=null;o.userData.setText(value);};
    o.userData.resize=(width,height)=>{w=width;h=height;const density=Math.max(384,128/h);c.width=Math.max(1,Math.round(w*density));c.height=Math.max(1,Math.round(h*density));o.geometry.dispose();o.geometry=new T.PlaneGeometry(w,h);o.userData.refresh();};
    const density=Math.max(384,128/h);c.width=Math.max(1,Math.round(w*density));c.height=Math.max(1,Math.round(h*density));
    o.userData.setText(text);
    let ancestor=parent,owner=null;while(ancestor&&!owner){owner=pieces.find(piece=>piece.root===ancestor);ancestor=ancestor.parent;}
    if(owner){owner.textNodes.push(o);o.userData.readingAnchor={position:o.position.clone(),rotation:o.rotation.clone()};}
    return o;
  }
  for(let i=0;i<5;i++){
    const root=new T.Group();root.name='卷轴互动 '+(i+1)+' / '+chapterNames[i];const p=chapterPositions?.[i]||{x:0,y:.15,z:-17-i*34};root.position.set(p.x||0,p.y||0,p.z||0);scene.add(root);roots.push(root);
    label(root,`0${i+1} / 亲手试一试`,[0,.12,-5.95],3.8,.40,{surface:true,color:'#bdcfe9',weight:500});
    line([[-5.5,.025,-5.40],[5.5,.025,-5.40]],materials.line,root);
    for(const x of [-5.45,5.45])for(const z of [-3.58,3.95])line([[x,.028,z],[x+(x<0?.24:-.24),.028,z]],materials.line,root);
  }
  const cube=createWordCube({root:roots[0],camera,box,label,line,materials,onCollect:index=>mark(0,index)});

  function card(chapter,id,title,p,{w=1.65,h=.96,material=materials.glass,kind='panel'}={}){
    const root=new T.Group();root.name=title+' / 可拿起的三维对象';root.position.set(...p);root.rotation.x=-.58;roots[chapter].add(root);
    const body=box(w,h,.12,material.clone(),[0,0,0],root);
    const border=new T.LineSegments(new T.EdgesGeometry(body.geometry),new T.LineBasicMaterial({color:0xc4dafa,transparent:true,opacity:.7}));root.add(border);
    const titleNode=label(root,title,[0,-.02,.075],w-.12,chapter===1?.32:.40,{color:chapter===1?'#173353':'#ecf5ff',font:68});
    const piece={chapter,id,title,root,body,border,titleNode,textNodes:[titleNode],w,h,home:root.position.clone(),homeQ:root.quaternion.clone(),target:root.position.clone(),done:false,locked:false,kind,extras:{}};
    pieces.push(piece);return piece;
  }
  function socket(chapter,id,title,p,w=1.65,h=1.10){
    const root=new T.Group();root.position.set(...p);roots[chapter].add(root);root.name=title+' / 接收位置';
    const pad=box(w,.09,h,materials.dark,[0,.045,0],root);
    const border=line([[-w/2,.096,-h/2],[w/2,.096,-h/2],[w/2,.096,h/2],[-w/2,.096,h/2],[-w/2,.096,-h/2]],materials.goldLine.clone(),root);
    const titleNode=label(root,title,[0,.18,-h/2-.47],w+.25,.42,{surface:true,color:'#e3edf8',font:64});
    const slot={chapter,id,title,root,pad,border,titleNode,w,h,done:false,target:root.position.clone().add(V(0,.24,0))};slots.push(slot);return slot;
  }
  function resizeSocket(slot,w,h){
    slot.w=w;slot.h=h;slot.root.scale.set(1,1,1);slot.pad.geometry.dispose();slot.pad.geometry=new T.BoxGeometry(w,.09,h);
    slot.border.geometry.dispose();slot.border.geometry=new T.BufferGeometry().setFromPoints([V(-w/2,.096,-h/2),V(w/2,.096,-h/2),V(w/2,.096,h/2),V(-w/2,.096,h/2),V(-w/2,.096,-h/2)]);
    slot.titleNode.position.z=-h/2-.47;slot.titleNode.userData.resize(w+.25,.42);
  }
  function route(chapter,from,to,{color=0xe7c273,via=null}={}){
    const a=V(...from),b=V(...to),mid=via?V(...via):a.clone().lerp(b,.5);mid.y=.12;
    const curve=new T.CatmullRomCurve3([a,a.clone().lerp(mid,.5),mid,mid.clone().lerp(b,.5),b]);
    const pts=curve.getPoints(72),track=line(pts,new T.LineBasicMaterial({color:0x8c9bad,transparent:true,opacity:.24}),roots[chapter]);
    const lit=line(pts,new T.LineBasicMaterial({color,transparent:true,opacity:.95}),roots[chapter]);lit.geometry.setDrawRange(0,0);
    const glow=new T.Mesh(new T.SphereGeometry(.045,8,6),new T.MeshBasicMaterial({color,toneMapped:false}));roots[chapter].add(glow);glow.visible=false;
    const path={chapter,curve,track,lit,glow,progress:0,target:0};paths.push(path);return path;
  }

  // 02: precise translucent process plates over one continuous drawn route.
  const processOrder=[3,0,5,1,4,2];
  let processNarrow=null;
  for(let k=0;k<6;k++){
    const x=-4.65+k*1.86;
    socket(1,STEP_IDS[k],String(k+1).padStart(2,'0'),[x,.10,-.65],1.65,1.10);
    const p=card(1,STEP_IDS[k],STEP_NAMES[k],[-4.65+processOrder.indexOf(k)*1.86,1.10,2.3],{w:1.63,h:.94});
    p.titleNode.position.y=-.19;
    label(p.root,['GOAL','REFERENCE','TASK','ROUTE','MAKE','DELIVER'][k],[0,.32,.075],1.45,.20,{color:'#365a86',font:54,weight:400});
    if(k>0){const path=route(1,[x-1.86,.13,-.65],[x,.13,-.65]);path.bind=STEP_IDS[k];}
  }
  label(roots[1],'把每一步放到它应该在的位置',[0,.10,3.95],6.8,.50,{surface:true,color:'#c8d7ed',font:70});

  function layoutProcess(narrow,force=false){
    if(!force&&processNarrow===narrow)return;
    processNarrow=narrow;
    // A breakpoint change cancels only the current gesture, never saved answers.
    if(drag&&active===1)cancelDrag();
    if(helpSequence?.chapter===1)endHelp();
    for(let i=animations.length-1;i>=0;i--)if(animations[i].piece.chapter===1)animations.splice(i,1);
    const processSlots=slots.filter(s=>s.chapter===1);
    for(let k=0;k<STEP_IDS.length;k++){
      const slot=processSlots.find(s=>s.id===STEP_IDS[k]);
      if(narrow){
        slot.root.position.set(-2.85+(k%3)*2.85,.10,k<3?-3.60:-1.60);
        resizeSocket(slot,2.65,1.50);
      }else{
        slot.root.position.set(-4.65+k*1.86,.10,-.65);resizeSocket(slot,1.65,1.10);
      }
      slot.titleNode.position.z=0;
      slot.target.copy(slot.root.position).add(V(0,.24,0));
      const piece=pieces.find(p=>p.chapter===1&&p.id===STEP_IDS[k]),position=processOrder.indexOf(k);
      if(narrow){piece.home.set(-2.85+(position%3)*2.85,.65,position<3?1.4:3.85);piece.root.scale.setScalar(2.50/1.63);}
      else{piece.home.set(-4.65+position*1.86,1.10,2.3);piece.root.scale.setScalar(1);}
      piece.root.position.copy(piece.done?slot.target:piece.home);
      piece.root.quaternion.copy(piece.done?new T.Quaternion().setFromEuler(new T.Euler(-Math.PI/2,0,0)):piece.homeQ);
      processTitle(piece);
    }
    for(const path of paths.filter(p=>p.chapter===1)){
      const k=STEP_IDS.indexOf(path.bind),previous=processSlots.find(s=>s.id===STEP_IDS[k-1]),next=processSlots.find(s=>s.id===STEP_IDS[k]);
      const a=previous.root.position.clone(),b=next.root.position.clone();a.y=b.y=.13;
      const points=narrow&&k===3?
        [a,V(4.5,.13,-3.60),V(4.5,.13,-2.60),V(-4.5,.13,-2.60),V(-4.5,.13,-1.60),b]:
        [a,a.clone().lerp(b,.30),a.clone().lerp(b,.70),b];
      path.curve=new T.CatmullRomCurve3(points);
      for(const object of [path.track,path.lit]){object.geometry.dispose();object.geometry=new T.BufferGeometry().setFromPoints(path.curve.getPoints(72));}
      path.lit.geometry.setDrawRange(0,Math.floor(path.progress*73));
    }
    // The instruction sits after the two pickup rows instead of beneath a card.
    const instruction=labels.find(o=>o.parent===roots[1]&&o.userData.processInstruction);
    if(instruction)instruction.position.z=narrow?5.45:3.95;
  }
  labels[labels.length-1].userData.processInstruction=true;
  function processTitle(piece){
    if(piece.chapter!==1)return;
    piece.titleNode.scale.setScalar(1);
    if(piece.root.children[3])piece.root.children[3].visible=!piece.done;
  }
  function updatePieceTypography(piece){
    // Raise the whole physical label above a landed board; never stretch glyph axes.
    const liftAngle=T.MathUtils.clamp(-.70-piece.root.rotation.x,0,Math.PI/2-.70);
    for(const node of piece.textNodes){
      const anchor=node.userData.readingAnchor??=( {position:node.position.clone(),rotation:node.rotation.clone()} );
      node.rotation.copy(anchor.rotation);node.rotation.x+=liftAngle;
      node.position.copy(anchor.position);node.position.z+=Math.sin(liftAngle)*(node.userData.typography?.worldHeight??node.userData.readingHeight)*.5+.025*liftAngle/(Math.PI/2-.70);
    }
  }

  // 03: a gold semiconductor routes actual tool symbols to semantic use sockets.
  const chip=new T.Group();chip.name='四路用途 / 金色芯片';chip.position.set(0,.34,-.60);roots[2].add(chip);
  box(2.0,.30,1.7,materials.gold.clone(),[0,0,0],chip);box(1.65,.05,1.35,materials.dark,[0,.175,0],chip);
  label(chip,'IDEA / CORE',[0,.21,0],1.5,.35,{surface:true,color:'#f4d691',font:70});
  for(let k=0;k<10;k++)for(const sign of [-1,1]){
    box(.07,.07,.25,materials.gold,[-.76+k*.17,.02,sign*.96],chip);
    box(.25,.07,.07,materials.gold,[sign*1.10,.02,-.68+k*.15],chip);
  }
  const toolSlotPoints=[[-3.55,.10,-1.6],[3.55,.10,-1.6],[-3.55,.10,1.15],[3.55,.10,1.15]];
  const toolOrder=orders(state.layoutSeeds[2],TOOL_IDS,USE_IDS);
  for(let k=0;k<4;k++){
    const id=TOOL_IDS[k],pos=toolOrder.cards.indexOf(id),piece=card(2,id,TOOL_NAMES[k],[-3.6+pos*2.4,1.12,2.95],{w:1.92,h:1.25,material:materials.dark});
    piece.titleNode.position.y=-.42;
    installLogo(piece,k);
    const slotIndex=toolOrder.slots.indexOf(USE_IDS[k]),p=toolSlotPoints[slotIndex],slot=socket(2,USE_IDS[k],USE_NAMES[k],p,2.0,1.1);
    slot.titleNode.position.z-=.42;
    const path=route(2,[p[0],.12,p[2]],[(Math.sign(p[0])||1)*1.1,.12,-.6],{via:[p[0]*.5,.12,p[2]]});path.bind=id;
  }
  function installLogo(piece,k){
    const fallback=label(piece.root,['</>','◉','S','Ae'][k],[0,.17,.081],.88,.66,{color:['#ff9165','#ffb266','#bbffc9','#bcaaff'][k],font:150,weight:700});
    const names=['html.svg','blender.svg','seedance-user-reference.webp','ae.svg'];
    const load=new T.TextureLoader().loadAsync(new URL('../assets/game-logos/'+names[k],import.meta.url).href).then(tx=>{
      if(disposed){tx.dispose();return;}tx.colorSpace=T.SRGBColorSpace;
      const sourceW=tx.image.naturalWidth||tx.image.width||1,sourceH=tx.image.naturalHeight||tx.image.height||1,fit=Math.min(.76/sourceW,.63/sourceH),width=sourceW*fit,height=sourceH*fit;
      const logo=new T.Mesh(new T.PlaneGeometry(width,height),new T.MeshBasicMaterial({map:tx,transparent:true,depthWrite:false,toneMapped:false}));logo.name='Tool logo / '+piece.id;logo.position.set(0,.22,.085);piece.root.add(logo);fallback.visible=false;
      logo.userData.typographyImage={sourceWidth:sourceW,sourceHeight:sourceH,worldWidth:width,worldHeight:height,sourceAspectRatio:sourceW/sourceH,geometryAspectRatio:width/height};logo.userData.readingHeight=height;logo.userData.readingAnchor={position:logo.position.clone(),rotation:logo.rotation.clone()};piece.textNodes.push(logo);
      logo.userData.provenance=k===2?'User-supplied third-party reference WebP':'Provided source logo';
    }).catch(()=>{});loads.push(load);
  }

  const products=createProductCarousel({root:roots[3],camera,box,label,line,materials,
    onRepair:(index,assisted)=>mark(3,index,assisted),
    onTurn:index=>{state.product=index;save();say('info',tips[3]);},onFeedback});
  loads.push(...products.loads);

  // 05: three different physical deliverables, then the gated completion stamp.
  const cargoOrder=orders(state.layoutSeeds[4],CARGO_IDS,CARGO_IDS);
  const cargoSlotPos={film:[-3.4,.10,-1.55],island:[0,.10,-1.55],project:[3.4,.10,-1.55],stamp:[0,.10,.65]};
  const cargoTargetNames={film:'观看',island:'互动',project:'继续制作',stamp:'三项齐备后盖章'};
  let stampPiece,stampSlot,filmPiece,scenePiece,projectPiece;
  CARGO_IDS.forEach((id,k)=>{
    const slot=socket(4,id,cargoTargetNames[id],cargoSlotPos[id],id==='stamp'?2.15:2.55,id==='stamp'?1.05:1.55);
    if(id!=='stamp')slot.titleNode.position.z=-2.10;
    const x=-3.6+cargoOrder.cards.indexOf(id)*2.4;
    const piece=card(4,id,CARGO_NAMES[k],[x,1.25,3.15],{w:1.90,h:1.25,material:id==='stamp'?materials.gold:materials.dark,kind:id});
    piece.titleNode.position.y=-.44;piece.body.material.transparent=false;piece.body.material.opacity=1;
    if(id==='film'){
      filmPiece=piece;
      const frame=box(1.45,.80,.10,materials.side,[0,.12,.14],piece.root);
      const screen=box(1.30,.67,.035,materials.blue,[0,.12,.205],piece.root);screen.material=screen.material.clone();
      const play=new T.Shape();play.moveTo(-.14,-.18);play.lineTo(.20,0);play.lineTo(-.14,.18);play.closePath();
      const icon=new T.Mesh(new T.ShapeGeometry(play),new T.MeshBasicMaterial({color:0xffffff}));icon.position.set(0,.12,.23);piece.root.add(icon);
      const run=line([[-.56,-.16,.232],[.56,-.16,.232]],materials.goldLine,piece.root);run.geometry.setDrawRange(0,0);
      piece.extras={frame,screen,icon,run,phase:0};
      // The film's preview status is already shown by the host player; keep this
      // physical delivery label short enough to read at its native proportions.
      loads.push(new T.TextureLoader().loadAsync(new URL('../assets/media/film-preview.jpg',import.meta.url).href).then(tx=>{
        if(disposed){tx.dispose();return;}tx.colorSpace=T.SRGBColorSpace;const sw=tx.image.naturalWidth||tx.image.width||1,sh=tx.image.naturalHeight||tx.image.height||1,fit=Math.min(1.30/sw,.67/sh);screen.geometry.dispose();screen.geometry=new T.BoxGeometry(sw*fit,sh*fit,.035);screen.material.map=tx;screen.material.color.set(0xffffff);screen.material.needsUpdate=true;
      }).catch(()=>{}));
    }
    if(id==='island'){
      scenePiece=piece;
      const mini=new T.Group();piece.root.add(mini);mini.position.set(0,.15,.3);
      const shape=box(.6,.6,.6,materials.blue,[0,0,0],mini);shape.rotation.set(.5,.45,.2);
      const wire=new T.LineSegments(new T.EdgesGeometry(shape.geometry),new T.LineBasicMaterial({color:0xbad9ff}));shape.add(wire);
      piece.extras={mini,shape};
    }
    if(id==='project'){
      projectPiece=piece;
      const layers=[];
      for(let j=0;j<3;j++){const mesh=box(1.15,.63,.09,[materials.blue,materials.side,materials.gold][j],[0,.13,.17+j*.12],piece.root);layers.push(mesh);}
      const code=label(layers[2],'{  }',[0,0,.055],.90,.44,{color:'#eaf2fb',font:160});piece.extras={layers,code,open:0};
    }
    if(id==='stamp'){
      stampPiece=piece;stampSlot=slot;
      piece.body.visible=false;piece.border.visible=false;piece.titleNode.position.set(0,-.48,.20);
      const handle=new T.Mesh(new T.CylinderGeometry(.22,.28,.48,32),materials.dark);handle.rotation.x=Math.PI/2;handle.position.set(0,.10,.30);piece.root.add(handle);
      box(.95,.65,.15,materials.gold,[0,.1,.065],piece.root);
      piece.extras={handle,lockedLabel:label(piece.root,'先完成三项',[0,-.94,.14],1.8,.29,{color:'#c6ceda',font:65})};
    }
  });
  const stamped=label(roots[4],'交付完成 ✓',[0,.23,.65],1.8,.40,{surface:true,color:'#c9edc2',font:92,weight:700});stamped.visible=false;
  label(roots[4],'观看 · 互动 · 继续制作',[0,.08,-4.65],6.2,.50,{surface:true,color:'#c7d4e8',font:70});

  const guideLine=line([V(),V()],new T.LineBasicMaterial({color:0xcee7ff,transparent:true,opacity:.8}),scene);guideLine.visible=false;guideLine.renderOrder=30;
  const guideDot=new T.Mesh(new T.SphereGeometry(.065,10,8),new T.MeshBasicMaterial({color:0xe5f3ff,toneMapped:false}));scene.add(guideDot);guideDot.visible=false;
  let guideCurve=null,guideProgress=0;

  function say(type,text){onFeedback({type,text,chapter:active});}
  function save(){saveProgress(state);onProgress(structuredClone(state));}
  function idsFor(chapter){return chapter===1?STEP_IDS:chapter===2?TOOL_IDS:CARGO_IDS;}
  function slotFor(piece){return slots.find(s=>s.chapter===piece.chapter&&s.id===(piece.chapter===2?TOOL_MATCH[piece.id]:piece.id));}
  function applyState({initial=false}={}){
    cube.setDone(state.done[0]);products.setDone(state.done[3],state.product);
    for(const piece of pieces){
      const k=idsFor(piece.chapter).indexOf(piece.id);piece.done=state.done[piece.chapter].includes(k);piece.locked=piece.id==='stamp'&&!stampUnlocked(state);
      processTitle(piece);
      if(piece.id==='stamp')piece.extras.lockedLabel.visible=piece.locked;
      piece.body.material.color.set(piece.chapter===1?(piece.done?0x8baec5:0xb6d3ef):piece.id==='stamp'?0xe2b35b:(piece.done?0x173441:0x101c2e));
      const slot=slotFor(piece);slot.done=piece.done;slot.border.material.color.set(piece.done?0xb8f1c3:piece.locked?0x657089:0xd4b575);slot.border.material.opacity=piece.done?.9:piece.locked?.35:.7;
      if(piece.chapter===1)slot.titleNode.visible=!piece.done;
      if(initial){piece.root.position.copy(piece.done?slot.target:piece.home);piece.root.quaternion.copy(piece.done?new T.Quaternion().setFromEuler(new T.Euler(-Math.PI/2,0,0)):piece.homeQ);}
    }
    for(const path of paths)path.target=state.done[path.chapter].includes(idsFor(path.chapter).indexOf(path.bind))?1:0;
    stamped.visible=completed(state,4);
    if(completed(state,4))stampPiece.root.visible=false;else stampPiece.root.visible=true;
  }
  function mark(chapter,index,assisted=false){
    if(!markStep(state,chapter,index))return;save();applyState();
    const names=chapter===0?WORDS:chapter===1?STEP_NAMES:chapter===2?TOOL_NAMES:chapter===3?['G1','SU7','VisionPro','Rubin']:CARGO_NAMES;
    const text=completed(state,chapter)?'这一段完成了。结果留在卷面上，继续向下看看。':chapter===4&&stampUnlocked(state)?'三项已经齐备。现在可以把印章放到最后的位置。':(assisted?'这一步我示范好了。':'已完成「'+names[index]+'」。')+(chapter===0?'继续转动，看看其他面。':chapter===3?'先看清变化，转盘会送来下一件。':'继续下一步就好。');
    say(chapter===4&&index===3?'stamp':completed(state,chapter)?'complete':'correct',text);
    onGuide({phase:'complete',chapter,index,text,target:chapter===0?cube.root:chapter===3?products.target():pieces.find(p=>p.chapter===chapter&&idsFor(chapter).indexOf(p.id)===index)?.root});
  }
  function animatePiece(piece,target,{correct=false,assisted=false,duration=1.05,stamp=false,onFinish=null}={}){
    for(let i=animations.length-1;i>=0;i--)if(animations[i].piece===piece)animations.splice(i,1);
    const a={piece,age:0,duration,start:piece.root.position.clone(),end:target.clone(),q0:piece.root.quaternion.clone(),q1:correct?new T.Quaternion().setFromEuler(new T.Euler(-Math.PI/2,0,0)):piece.homeQ.clone(),correct,assisted,stamp,onFinish};animations.push(a);
    return a;
  }
  function wrong(){
    state.errors[active]++;if(state.errors[active]>=3){state.errors[active]=0;save();help();}
    else{save();say('wrong',`位置还差一点，再试一次。需要帮助时可以点 Dot。（${state.errors[active]}/3）`);}
  }
  function targetWorld(object){return object?.isVector3?object.clone():object?.getWorldPosition?.(V())||V();}
  function beginGuide(a,b){
    const start=targetWorld(a),end=targetWorld(b),mid=start.clone().lerp(end,.45);mid.y+=1.5;
    guideCurve=new T.QuadraticBezierCurve3(start,mid,end);guideLine.geometry.dispose();guideLine.geometry=new T.BufferGeometry().setFromPoints(guideCurve.getPoints(80));guideLine.geometry.setDrawRange(0,0);guideLine.visible=guideDot.visible=true;guideProgress=0;
  }
  function endHelp(){
    if(!helpSequence)return;helpSequence=null;guideLine.visible=guideDot.visible=false;onInteractionLock(false);onGuide({phase:'end',chapter:active});
  }
  function help(){
    if(active<0||drag||helpSequence||completed(state,active))return false;
    const index=active===3?state.product:currentStep(state,active);if(index<0)return false;
    if(active===3&&(!products.ready||products.busy)){say('info','先等模型和转盘安定下来，再看这一处。');return false;}
    const piece=pieces.find(p=>p.chapter===active&&p.id===idsFor(active)[index]);
    const target=active===0?cube.root:active===3?products.target():piece?.root;
    helpSequence={chapter:active,index,piece,age:0,started:false,finished:false};onInteractionLock(true);
    onGuide({phase:'gaze',chapter:active,target,text:'看这里，我把当前这一步完整示范一次。'});say('help','看这里，我把当前这一步完整示范一次。');
    return true;
  }
  function activity(){
    if(active<0)return;
    if(!state.seen[active]){state.seen[active]=true;save();}
    onGuide({phase:'activity',chapter:active});
  }
  function setActiveChapter(index){
    const next=Number.isInteger(index)&&index>=0&&index<5?index:-1;if(next===active)return;
    cancelDrag();endHelp();active=next;
    if(active>=0){
      say('info',completed(state,active)?'这一段已经完成，结果和进度都为你保留着。':tips[active]);
      if(!state.seen[active])onGuide({phase:'intro',chapter:active,text:tips[active],target:active===0?cube.root:active===3?products.target():pieces.find(p=>p.chapter===active&&!p.done)?.root});
    }
  }
  function setRay(event){const rect=canvas.getBoundingClientRect();pointer.set((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1);raycaster.setFromCamera(pointer,camera);return rect;}
  function pick(event){
    if(active<0||helpSequence)return null;setRay(event);roots[active].updateWorldMatrix(true,true);
    if(active===0&&cube.hit(raycaster))return {kind:'cube'};
    if(active===3)return products.pick(raycaster);
    const candidates=[];
    for(const p of pieces.filter(p=>p.chapter===active&&!p.done)){
      const hit=raycaster.intersectObject(p.root,true);if(hit.length)candidates.push({kind:p.locked?'locked':'piece',piece:p,distance:hit[0].distance});
    }
    if(active===4&&scenePiece.done&&raycaster.intersectObject(scenePiece.root,true).length)return {kind:'scene-preview'};
    return candidates.sort((a,b)=>a.distance-b.distance)[0]||null;
  }
  function screenPoint(object){const r=canvas.getBoundingClientRect(),v=targetWorld(object).project(camera);return{x:r.left+(v.x+1)*r.width/2,y:r.top+(1-v.y)*r.height/2,z:v.z};}
  function nearestSlot(event){
    const rect=canvas.getBoundingClientRect(),found=[];
    for(const s of slots.filter(s=>s.chapter===active&&!s.done)){
      const center=s.root.getWorldPosition(V()).project(camera),worldScale=s.root.getWorldScale(V()).x;
      const distance=camera.position.distanceTo(s.root.getWorldPosition(V())),px=rect.height/(2*Math.tan(T.MathUtils.degToRad(camera.fov/2))*distance);
      const x=rect.left+(center.x+1)*rect.width/2,y=rect.top+(1-center.y)*rect.height/2,dx=Math.abs(event.clientX-x),dy=Math.abs(event.clientY-y);
      const maxX=Math.max(27,s.w*px*worldScale*.66),maxY=Math.max(23,s.h*px*worldScale*.58);
      if(dx<maxX&&dy<maxY)found.push({slot:s,score:dx/maxX+dy/maxY});
    }
    return found.sort((a,b)=>a.score-b.score)[0]?.slot||null;
  }
  function pointerDown(e){
    if(e.button>0||drag||active<0)return;
    const hit=pick(e);if(!hit)return;
    e.preventDefault();e.stopImmediatePropagation();activity();
    if(hit.kind==='locked'){
      // A rejected stamp gesture stays owned by the game until release. Letting
      // its touch-move bubble would scroll the whole page underneath the pieces.
      drag={id:e.pointerId,kind:'locked',x:e.clientX,y:e.clientY};onInteractionLock(true);canvas.setPointerCapture?.(e.pointerId);canvas.style.cursor='not-allowed';
      say('info','先把影片、互动场景和工程盒放好，最后再盖章。');return;
    }
    if(hit.kind==='product'){
      drag={id:e.pointerId,kind:'product',startX:e.clientX,startY:e.clientY,x:e.clientX,y:e.clientY,hit};
    }else if(hit.kind==='cube'){
      drag={id:e.pointerId,kind:'cube',x:e.clientX,y:e.clientY};
    }else if(hit.kind==='scene-preview'){
      drag={id:e.pointerId,kind:'scene-preview',x:e.clientX,y:e.clientY};
    }else{
      const piece=hit.piece;
      for(let i=animations.length-1;i>=0;i--)if(animations[i].piece===piece)animations.splice(i,1);
      const world=piece.root.getWorldPosition(V());
      // Drag on the physical plane above the scroll, with a fixed grab offset.
      const plane=new T.Plane().setFromNormalAndCoplanarPoint(V(0,1,0),world);
      const start=raycaster.ray.intersectPlane(plane,V());
      drag={id:e.pointerId,kind:'piece',piece,plane,offset:start?world.clone().sub(start):V(),x:e.clientX,y:e.clientY};
      piece.body.material.emissive?.set(0x153356);piece.body.material.emissiveIntensity=.25;
      say('pickup','已拿起「'+piece.title+'」。拖到接收位置后松手。');
    }
    onInteractionLock(true);canvas.setPointerCapture?.(e.pointerId);canvas.style.cursor='grabbing';
  }
  function pointerMove(e){
    if(!drag){
      const hit=pick(e),hover=hit?.piece||hit?.kind||null;
      if(hover!==lastHover){lastHover=hover;canvas.style.cursor=hit?.kind==='locked'?'not-allowed':hit?.kind==='product'?'pointer':hit?'grab':'';}
      return;
    }
    if(e.pointerId!==drag.id)return;e.preventDefault();e.stopImmediatePropagation();
    const dx=e.clientX-drag.x,dy=e.clientY-drag.y;
    if(drag.kind==='cube')cube.turn(dx,dy);
    if(drag.kind==='scene-preview')scenePiece.extras.mini.rotation.y+=dx*.012;
    if(drag.kind==='piece'){
      setRay(e);const point=raycaster.ray.intersectPlane(drag.plane,V());
      if(point){point.add(drag.offset);drag.piece.root.position.copy(roots[active].worldToLocal(point));drag.piece.root.position.x=T.MathUtils.clamp(drag.piece.root.position.x,-5.8,5.8);drag.piece.root.position.z=T.MathUtils.clamp(drag.piece.root.position.z,-3.3,4.1);}
    }
    drag.x=e.clientX;drag.y=e.clientY;
  }
  function release(e){
    if(!drag||e.pointerId!==drag.id)return;e.preventDefault?.();e.stopImmediatePropagation?.();
    const d=drag;drag=null;
    if(canvas.hasPointerCapture?.(d.id))canvas.releasePointerCapture(d.id);canvas.style.cursor='';
    onInteractionLock(false);const cancelled=e.type!=='pointerup';
    if(d.kind==='cube'){cube.release();return;}
    if(d.kind==='piece'){
      d.piece.body.material.emissive?.set(0);setRay(e);const slot=cancelled?null:nearestSlot(e),result=validateDrop(active,d.piece.id,slot?.id,state);
      if(result==='correct'){
        animatePiece(d.piece,slot.target,{correct:true,duration:d.piece.id==='stamp'?1.45:1.05,stamp:d.piece.id==='stamp'});
        if(active===2){const p=paths.find(p=>p.chapter===2&&p.bind===d.piece.id);if(p)p.target=.18;}
      }else{
        animatePiece(d.piece,d.piece.home,{duration:1.05});
        if(result==='wrong')wrong();else if(result==='locked')say('info','三项齐备以后，最后再盖章。');
      }
    }
    if(d.kind==='product'&&!cancelled&&Math.hypot(d.x-d.startX,d.y-d.startY)<10){
      if(d.hit.correct)products.repairCurrent();else wrong();
    }
  }
  function cancelDrag(){if(!drag)return;release({type:'pointercancel',pointerId:drag.id,clientX:drag.x,clientY:drag.y});}
  canvas.addEventListener('pointerdown',pointerDown,eventOptions);
  canvas.addEventListener('pointermove',pointerMove,eventOptions);
  canvas.addEventListener('pointerup',release,eventOptions);
  canvas.addEventListener('pointercancel',release,eventOptions);
  canvas.addEventListener('lostpointercapture',e=>{if(drag?.id===e.pointerId)cancelDrag();},eventOptions);
  canvas.addEventListener('wheel',e=>{if(drag||helpSequence){e.preventDefault();e.stopImmediatePropagation();}},{...eventOptions,passive:false});
  canvas.addEventListener('keydown',e=>{
    if(active<0)return;
    if(e.key==='Escape'&&drag){cancelDrag();e.preventDefault();return;}
    if(e.key.toLowerCase()==='h'){help();e.preventDefault();}
    if(active===0&&['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)){
      cube.turn(e.key==='ArrowLeft'?-24:e.key==='ArrowRight'?24:0,e.key==='ArrowUp'?-24:e.key==='ArrowDown'?24:0);cube.release();e.preventDefault();e.stopImmediatePropagation();
    }
  },eventOptions);
  let auxiliaryNarrow=null;
  function layoutAuxiliary(narrow,force=false){
    if(!force&&auxiliaryNarrow===narrow)return;auxiliaryNarrow=narrow;
    if(drag&&(active===2||active===4))cancelDrag();if(helpSequence&&(helpSequence.chapter===2||helpSequence.chapter===4))endHelp();
    for(let i=animations.length-1;i>=0;i--)if([2,4].includes(animations[i].piece.chapter))animations.splice(i,1);
    for(const chapter of [2,4]){
      const ids=chapter===2?TOOL_IDS:CARGO_IDS,order=orders(state.layoutSeeds[chapter],ids,chapter===2?USE_IDS:CARGO_IDS);
      for(const piece of pieces.filter(p=>p.chapter===chapter)){
        const index=order.cards.indexOf(piece.id);
        piece.home.set(narrow?(index%2===0?-2.05:2.05):-3.6+index*2.4,chapter===2?1.12:1.25,narrow?(index<2?3.3:5.6):(chapter===2?2.95:3.15));
        piece.root.position.copy(piece.done?slotFor(piece).target:piece.home);piece.root.quaternion.copy(piece.done?new T.Quaternion().setFromEuler(new T.Euler(-Math.PI/2,0,0)):piece.homeQ);
      }
    }
  }
  window.addEventListener('resize',()=>{layoutProcess(innerWidth<700);layoutAuxiliary(innerWidth<700);},{signal:abort.signal});

  function update(dt,absoluteTime){
    if(disposed)return;dt=Math.min(.05,Math.max(0,dt));time=absoluteTime??time+dt;
    cube.update(dt,time,active===0);products.update(dt,time,active===3);
    for(let i=animations.length-1;i>=0;i--){
      const a=animations[i],u=Math.min(1,(a.age+=dt)/a.duration),s=ease(u),p=a.piece;
      p.root.position.lerpVectors(a.start,a.end,s);
      if(a.stamp){
        // Align, hold briefly, then press over a short distance with no camera shake.
        const drop=ease((u-.60)/.40);p.root.position.y=a.end.y+.50*(1-drop);p.root.position.x=T.MathUtils.lerp(a.start.x,a.end.x,ease(u/.65));p.root.position.z=T.MathUtils.lerp(a.start.z,a.end.z,ease(u/.65));
      }else p.root.position.y+=Math.sin(Math.PI*s)*(a.correct?.38:.52);
      p.root.quaternion.slerpQuaternions(a.q0,a.q1,s);
      if(u===1){animations.splice(i,1);p.root.position.copy(a.end);if(a.correct)mark(p.chapter,idsFor(p.chapter).indexOf(p.id),a.assisted);a.onFinish?.();}
    }
    for(const path of paths){
      path.progress=T.MathUtils.damp(path.progress,path.target,4.2,dt);const count=Math.floor(path.progress*73);path.lit.geometry.setDrawRange(0,count);
      const running=path.progress>.97&&active===path.chapter;path.glow.visible=running;
      if(running)path.glow.position.copy(path.curve.getPoint((time*.14)%1));
    }
    const connected=state.done[2].length;chip.children[0].material.emissive.set(0xe9ba54);chip.children[0].material.emissiveIntensity=.06+connected*.045+(connected?Math.sin(time*1.6)*.025:0);
    if(filmPiece.done){filmPiece.extras.run.geometry.setDrawRange(0,2);filmPiece.extras.run.scale.x=(time*.12)%1;filmPiece.extras.screen.material.emissive?.set(0x4b71d1);filmPiece.extras.screen.material.emissiveIntensity=.14+Math.sin(time*.9)*.04;}
    if(scenePiece.done&&!drag)scenePiece.extras.shape.rotation.y+=dt*.18;
    projectPiece.extras.open=T.MathUtils.damp(projectPiece.extras.open,projectPiece.done?1:0,3.5,dt);
    projectPiece.extras.code.visible=!projectPiece.done&&projectPiece.root.rotation.x>-.9;
    projectPiece.extras.layers.forEach((mesh,k)=>{const f=ease((projectPiece.extras.open-k*.08)/.84);mesh.position.z=.17+k*.12+f*k*.25;});
    for(const piece of pieces)updatePieceTypography(piece);
    for(const node of labels)if(node.userData.readingSurface){node.parent.updateWorldMatrix(true,false);node.quaternion.copy(node.parent.getWorldQuaternion(new T.Quaternion()).invert()).multiply(readingQuaternion);}
    if(stampPiece.locked)stampPiece.root.scale.setScalar(.86);else stampPiece.root.scale.lerp(V(1,1,1),1-Math.exp(-4*dt));
    if(helpSequence){
      const h=helpSequence;h.age+=dt;
      if(!h.started&&h.age>.45){
        h.started=true;
        if(h.chapter===0){cube.showFace(h.index);onGuide({phase:'move',chapter:h.chapter,target:cube.root,text:'转到清楚的这一面，轻轻停住。'});}
        else if(h.chapter===3){products.repairCurrent({assisted:true});onGuide({phase:'move',chapter:3,target:products.target()});}
        else{
          const dest=slotFor(h.piece);beginGuide(h.piece.root,dest.root);onGuide({phase:'path',chapter:h.chapter,target:dest.root,source:h.piece.root});
        }
      }
      if(h.piece&&h.started){
        guideProgress=Math.min(1,(h.age-.45)/.75);guideLine.geometry.setDrawRange(0,Math.floor(guideProgress*81));guideDot.position.copy(guideCurve.getPoint(Math.max(0,guideProgress)));
        if(!h.moving&&h.age>.80){h.moving=true;const dest=slotFor(h.piece);animatePiece(h.piece,dest.target,{correct:true,assisted:true,duration:h.piece.id==='stamp'?1.45:1.6,stamp:h.piece.id==='stamp',onFinish:()=>{if(helpSequence)helpSequence.finished=true;}});onGuide({phase:'move',chapter:h.chapter,target:h.piece.root});}
        if(h.finished&&h.age>2.7)endHelp();
      }else if(h.chapter===0&&(state.done[0].includes(h.index)||h.age>6.0))endHelp();
      else if(h.chapter===3&&h.age>2.65&&!products.busy)endHelp();
    }
  }
  function reset(index=active){
    if(index<0||index>4)return;cancelDrag();endHelp();for(let i=animations.length-1;i>=0;i--)if(animations[i].piece.chapter===index)animations.splice(i,1);
    resetChapter(state,index);
    if(index===0)cube.reset();if(index===3)products.reset();
    if(index===2||index===4){
      const ids=index===2?TOOL_IDS:CARGO_IDS,order=orders(state.layoutSeeds[index],ids,index===2?USE_IDS:CARGO_IDS);
      for(const p of pieces.filter(p=>p.chapter===index))p.home.x=-3.6+order.cards.indexOf(p.id)*2.4;
      if(index===2)for(const slot of slots.filter(s=>s.chapter===2)){
        const point=toolSlotPoints[order.slots.indexOf(slot.id)];slot.root.position.set(...point);slot.target.copy(slot.root.position).add(V(0,.24,0));
        const id=TOOL_IDS[USE_IDS.indexOf(slot.id)],path=paths.find(p=>p.chapter===2&&p.bind===id);
        const a=V(point[0],.12,point[2]),b=V(Math.sign(point[0])*1.1,.12,-.6),mid=V(point[0]*.5,.12,point[2]);
        path.curve=new T.CatmullRomCurve3([a,a.clone().lerp(mid,.5),mid,mid.clone().lerp(b,.5),b]);
        for(const obj of [path.track,path.lit]){obj.geometry.dispose();obj.geometry=new T.BufferGeometry().setFromPoints(path.curve.getPoints(72));}
        path.progress=path.target=0;path.lit.geometry.setDrawRange(0,0);
      }
    }
    save();applyState({initial:true});layoutAuxiliary(innerWidth<700,true);say('info','这一段已重新开始。'+tips[index]);
  }
  applyState({initial:true});layoutProcess(innerWidth<700,true);layoutAuxiliary(innerWidth<700,true);save();
  document.fonts?.ready.then(()=>{if(!disposed)for(const node of labels)node.userData.refresh?.();});
  function getTextAudit(){
    scene.updateMatrixWorld(true);camera.updateMatrixWorld();const rect=canvas.getBoundingClientRect();
    const projectPoint=p=>{const q=p.clone().project(camera);return {x:rect.left+(q.x+1)*rect.width/2,y:rect.top+(1-q.y)*rect.height/2,z:q.z};};
    const records=labels.map(node=>{
      const t=node.userData.typography;let visible=!!t.text,ancestor=node,chapter=-1;
      while(ancestor){if(!ancestor.visible)visible=false;const index=roots.indexOf(ancestor);if(index>=0)chapter=index;ancestor=ancestor.parent;}
      const b=t.inkBounds,local=(x,y)=>V((x/t.canvasWidth-.5)*t.worldWidth,(.5-y/t.canvasHeight)*t.worldHeight,0);
      const world=[local(b.left,b.top),local(b.right,b.top),local(b.right,b.bottom),local(b.left,b.bottom)].map(p=>node.localToWorld(p)),corners=world.map(projectPoint);
      const xs=corners.map(p=>p.x),ys=corners.map(p=>p.y),bounds={left:Math.min(...xs),top:Math.min(...ys),right:Math.max(...xs),bottom:Math.max(...ys)};
      const unitX=V(1,0,0).applyMatrix4(node.matrixWorld).sub(node.getWorldPosition(V())).length(),unitY=V(0,1,0).applyMatrix4(node.matrixWorld).sub(node.getWorldPosition(V())).length();
      const top=projectPoint(node.localToWorld(V(0,t.worldHeight/2,0))),bottom=projectPoint(node.localToWorld(V(0,-t.worldHeight/2,0)));
      const left=projectPoint(node.localToWorld(V(-t.worldWidth/2,0,0))),right=projectPoint(node.localToWorld(V(t.worldWidth/2,0,0)));
      const vertical=Math.hypot(top.x-bottom.x,top.y-bottom.y),horizontal=Math.hypot(right.x-left.x,right.y-left.y);
      return {name:node.name,chapter,visible,typography:{...t},worldScaleRatio:unitX/unitY,aspectError:Math.abs(t.canvasAspectRatio/t.geometryAspectRatio-1),depthTest:node.material.depthTest,bounds,corners,glyphPixels:vertical*t.glyphHeight/t.canvasHeight,projectedAxisRatio:(vertical/t.worldHeight)/(horizontal/t.worldWidth),withinViewport:bounds.left>=0&&bounds.right<=rect.right&&bounds.top>=0&&bounds.bottom<=rect.bottom};
    });
    const overlaps=[];for(let i=0;i<records.length;i++)for(let j=i+1;j<records.length;j++){
      const a=records[i],b=records[j];if(!a.visible||!b.visible||a.chapter!==b.chapter)continue;
      const width=Math.min(a.bounds.right,b.bounds.right)-Math.max(a.bounds.left,b.bounds.left),height=Math.min(a.bounds.bottom,b.bounds.bottom)-Math.max(a.bounds.top,b.bounds.top);
      if(width>1&&height>1)overlaps.push({a:a.name,b:b.name,chapter:a.chapter,width,height,area:width*height});
    }
    const images=[];for(const piece of pieces)for(const node of piece.textNodes)if(node.userData.typographyImage)images.push({name:node.name,chapter:piece.chapter,...node.userData.typographyImage});
    return {active,records,overlaps,images};
  }
  return {roots,interactables:pieces.map(p=>p.root),loads,update,setActiveChapter,help,reset,
    get activeChapter(){return active;},get busy(){return !!drag||!!helpSequence;},
    getState(){return structuredClone(state);},
    getTextAudit,
    getTargets(){return {chapter:active,pieces:pieces.filter(p=>p.chapter===active).map(p=>({id:p.id,title:p.title,...screenPoint(p.root),done:p.done,locked:p.locked})),slots:slots.filter(s=>s.chapter===active).map(s=>({id:s.id,...screenPoint(s.root),done:s.done})),cube:screenPoint(cube.root),fault:products.target()?screenPoint(products.target()):null};},
    snapshot(){return {active,state:structuredClone(state),drag:drag?.kind||null,dragId:drag?.piece?.id||null,help:helpSequence?{chapter:helpSequence.chapter,index:helpSequence.index,age:helpSequence.age}:null,cube:cube.snapshot(),products:products.snapshot(),animations:animations.length};},
    dispose(){disposed=true;cancelDrag();endHelp();abort.abort();products.dispose();for(const root of roots){root.removeFromParent();root.traverse(o=>{o.geometry?.dispose();for(const m of(Array.isArray(o.material)?o.material:o.material?[o.material]:[])){m.map?.dispose();m.dispose();}});}guideLine.removeFromParent();guideLine.geometry.dispose();guideLine.material.dispose();guideDot.removeFromParent();guideDot.geometry.dispose();guideDot.material.dispose();}
  };
}
