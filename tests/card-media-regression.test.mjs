import test from 'node:test';
import assert from 'node:assert/strict';
import {createCardMorph} from '../src/card-morph.mjs';
import {bindCardMedia,stopCardMedia,mediaFigure} from '../src/card-media.mjs';

function globals(t,values){for(const[key,value]of Object.entries(values)){const before=Object.getOwnPropertyDescriptor(globalThis,key);Object.defineProperty(globalThis,key,{value,configurable:true,writable:true});t.after(()=>before?Object.defineProperty(globalThis,key,before):delete globalThis[key]);}}
class Node {
 constructor(tag='DIV',className=''){this.tagName=tag;this.className=className;this.children=[];this.style={setProperty(){}};this.offsetWidth=640;this.offsetHeight=420;this.offsetLeft=this.offsetTop=0;this.src='';this.classList={contains:c=>this.className.split(' ').includes(c),add:c=>{if(!this.classList.contains(c))this.className+=' '+c;},remove:c=>this.className=this.className.split(' ').filter(x=>x!==c).join(' '),toggle:(c,value)=>value?this.classList.add(c):this.classList.remove(c)};}
 append(...nodes){for(const node of nodes){if(node.parent)node.parent.children=node.parent.children.filter(x=>x!==node);this.children.push(node);node.parent=this;node.offsetParent=this;}}
 prepend(node){this.append(node);this.children.unshift(this.children.pop());}
 cloneNode(){const clone=new Node(this.tagName,this.className);clone.src=this.src;return clone;}
 querySelector(selector){return this.querySelectorAll(selector)[0]||null;}
 querySelectorAll(selector){const words=selector.split(' '),match=n=>words.at(-1).startsWith('.')?n.classList.contains(words.at(-1).slice(1)):n.tagName===words.at(-1).toUpperCase();return this.children.flatMap(node=>[...(match(node)?[node]:[]),...node.querySelectorAll(selector)]);}
 removeAttribute(name){if(name==='src')this.src='';}
}

test('closing and reopening a lazy article never overwrites its independent preview cover',t=>{
 globals(t,{document:{createElement:tag=>new Node(tag.toUpperCase())},innerWidth:1440,getComputedStyle:()=>({fontSize:'29px',lineHeight:'34px',fontWeight:'650'})});
 const card=new Node('ARTICLE'),heading=new Node('H2'),cover=new Node('IMG','card-image'),detail=new Node('DIV','card-detail'),detailHeading=new Node('H2'),figure=new Node('FIGURE'),bodyImage=new Node('IMG');
 cover.src='approved-cover.jpg';bodyImage.src='nearby-article-image.webp';figure.append(bodyImage);detail.append(detailHeading,figure);card.append(heading,cover,detail);
 const morph=createCardMorph(card);morph.prepare();morph.beginClose();
 assert.equal(cover.src,'approved-cover.jpg','the body image must not replace the cover');
 bodyImage.removeAttribute('src');morph.beginClose();morph.reset();
 assert.equal(cover.src,'approved-cover.jpg','releasing article media must leave the cover intact');
 morph.prepare();assert.equal(card.querySelector('.traveling-image').src,'approved-cover.jpg');
});

test('all article video markup and replay controls preserve silence',()=>{
 assert.match(mediaFigure({kind:'video',src:'clip.mp4',caption:'Reference'},0),/<video controls muted playsinline preload="none"/);
 class Video extends EventTarget{constructor(){super();this.dataset={resumeTime:'2'};this.currentTime=0;this.duration=4;this.muted=false;this.defaultMuted=false;}}
 const video=new Video();bindCardMedia({querySelectorAll:selector=>{assert.equal(selector,'.card-detail video');return[video];}});
 assert.equal(video.defaultMuted,true);assert.equal(video.muted,true);
 for(const type of ['volumechange','play','playing']){video.muted=false;video.dispatchEvent(new Event(type));assert.equal(video.muted,true);}
 video.dispatchEvent(new Event('loadedmetadata'));assert.equal(video.currentTime,2);assert.equal(video.muted,true);
});
