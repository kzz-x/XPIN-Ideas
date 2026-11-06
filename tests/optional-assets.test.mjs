import test from 'node:test';
import assert from 'node:assert/strict';
import {boundedOptional} from '../src/optional-assets.mjs';
import {createChatPresentation} from '../src/chat-r07.mjs';

function clock(t){
 const pending=new Map();let id=0,now=0;
 t.mock.method(globalThis,'setTimeout',(callback,ms)=>{const key=++id;pending.set(key,{callback,at:now+ms});return key;});
 t.mock.method(globalThis,'clearTimeout',key=>pending.delete(key));
 return{pending,tick(ms){now+=ms;for(const[key,item]of[...pending])if(item.at<=now&&pending.delete(key))item.callback();}};
}
function deferred(){let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return{promise,resolve,reject};}

test('optional jobs start immediately, await real completion and clear their timeout',async t=>{
 const c=clock(t),asset=deferred(),issues=[];let called=false,settled=false;
 const ready=boundedOptional(()=>{called=true;return asset.promise;},{name:'fonts',timeoutMs:1500,onIssue:issue=>issues.push(issue)});
 ready.then(()=>settled=true);
 assert.equal(called,true);assert.equal(c.pending.size,1);
 await Promise.resolve();assert.equal(settled,false);
 asset.resolve('custom font ready');
 assert.deepEqual(await ready,{name:'fonts',status:'ready',value:'custom font ready'});
 assert.equal(c.pending.size,0);assert.equal(issues.length,0);
});

test('synchronous failures and rejected asset promises resolve explicit failed results',async t=>{
 const c=clock(t),failure=new Error('font 404'),issues=[];
 const sync=await boundedOptional(()=>{throw failure;},{name:'fonts',onIssue:issue=>issues.push(issue)});
 assert.equal(sync.status,'failed');assert.equal(sync.error,failure);assert.equal(issues[0],sync);
 const asynchronous=await boundedOptional(Promise.reject('audio 404'),{name:'sfx'});
 assert.equal(asynchronous.status,'failed');assert.equal(asynchronous.name,'sfx');
 assert.equal(asynchronous.error.message,'audio 404');assert.equal(c.pending.size,0);
});

test('timeouts resolve once and a delayed rejection remains handled',async t=>{
 const c=clock(t),asset=deferred(),issues=[],unhandled=[];
 const capture=reason=>unhandled.push(reason);process.on('unhandledRejection',capture);t.after(()=>process.off('unhandledRejection',capture));
 const ready=boundedOptional(()=>asset.promise,{name:'fonts',timeoutMs:1500,onIssue:issue=>issues.push(issue)});
 c.tick(1499);assert.equal(issues.length,0);
 c.tick(1);const result=await ready;
 assert.equal(result.status,'timeout');assert.equal(result.name,'fonts');assert.ok(result.error instanceof Error);
 assert.equal(c.pending.size,0);assert.equal(issues.length,1);
 asset.reject(new Error('late network failure'));
 await new Promise(setImmediate);
 assert.equal(issues.length,1);assert.deepEqual(unhandled,[]);
 assert.equal(await ready,result);
});

test('late success cannot replace a timeout outcome or report another issue',async t=>{
 const c=clock(t),asset=deferred(),issues=[];
 const ready=boundedOptional(asset.promise,{name:'icon',timeoutMs:5,onIssue:issue=>issues.push(issue)});
 c.tick(5);const result=await ready;asset.resolve('late icon');await Promise.resolve();
 assert.equal(result.status,'timeout');assert.equal(await ready,result);assert.equal(issues.length,1);
});

test('a failed diagnostics callback cannot reject optional preparation',async t=>{
 clock(t);
 const sync=await boundedOptional(()=>{throw Error('missing');},{onIssue:()=>{throw Error('reporter failed');}});
 assert.equal(sync.status,'failed');
 const asynchronous=await boundedOptional(Promise.reject(Error('missing')),{onIssue:()=>Promise.reject(Error('async reporter failed'))});
 assert.equal(asynchronous.status,'failed');await new Promise(setImmediate);
});

function chatDOM(t,decode){
 const previous=Object.getOwnPropertyDescriptor(globalThis,'document');
 t.after(()=>{if(previous)Object.defineProperty(globalThis,'document',previous);else delete globalThis.document;});
 const classes=new Set(),sigil={innerHTML:'<img>'},icon={decode},text={textContent:''},send={attributes:{},setAttribute(name,value){this.attributes[name]=value;}},slot={append(node){this.child=node;}};
 const chat={innerHTML:'',classList:{remove:name=>classes.delete(name),toggle(name,enabled){if(enabled)classes.add(name);else classes.delete(name);}},querySelector:selector=>selector==='.chat-sigil'?sigil:selector==='.chat-sigil img'?icon:null};
 const nodes={'#chat':chat,'#send':send,'#send-slot':slot,'#prompt-text':text};
 globalThis.document={querySelector:selector=>nodes[selector]||null};
 return{chat,sigil,icon,text,send,slot,classes};
}

test('failed decorative icon decode creates an inline SVG and preserves the chat interaction',async t=>{
 const c=clock(t),dom=chatDOM(t,()=>Promise.reject(Error('icon 404'))),issues=[],typed=[];
 const chat=createChatPresentation({onTyping:count=>typed.push(count),onAssetIssue:issue=>issues.push(issue)});
 const result=await chat.ready;
 assert.equal(result.status,'failed');assert.equal(issues[0],result);
 assert.match(dom.sigil.innerHTML,/<svg/);assert.doesNotMatch(dom.sigil.innerHTML,/data:|<img/);
 assert.equal(dom.slot.child,dom.send);assert.equal(c.pending.size,0);
 chat.update('morph',0);chat.update('chat',2);
 assert.equal(dom.text.textContent,'帮我做一个炫酷的视频');assert.ok(dom.classes.has('prompt-ready'));
 assert.deepEqual(typed,[0,10]);
});

test('a decoded icon is retained and normal chat readiness does not wait for the timeout',async t=>{
 const c=clock(t),dom=chatDOM(t,()=>Promise.resolve()),issues=[];
 const chat=createChatPresentation({onAssetIssue:issue=>issues.push(issue)});
 assert.equal((await chat.ready).status,'ready');assert.equal(dom.sigil.innerHTML,'<img>');
 assert.equal(c.pending.size,0);assert.equal(issues.length,0);
});

test('a stalled decorative icon falls back after two seconds and later failure stays handled',async t=>{
 const c=clock(t),asset=deferred(),dom=chatDOM(t,()=>asset.promise);
 const chat=createChatPresentation();
 c.tick(1999);assert.equal(dom.sigil.innerHTML,'<img>');
 c.tick(1);assert.equal((await chat.ready).status,'timeout');assert.match(dom.sigil.innerHTML,/<svg/);
 asset.reject(Error('late icon failure'));await new Promise(setImmediate);
 assert.match(dom.sigil.innerHTML,/<svg/);assert.equal(c.pending.size,0);
});
