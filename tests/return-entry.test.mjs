import test from 'node:test';
import assert from 'node:assert/strict';
import {createReturnVisit,ReturnHold,RETURN_VISIT_KEY} from '../src/return-entry.mjs';
import {STORAGE_KEY} from '../src/games-rules.mjs';
const storage=data=>({getItem:key=>data.get(key)||null,setItem:(key,value)=>data.set(key,value)});
test('a fresh visitor and a merely preloaded game have no return shortcut',()=>{
 const data=new Map([[STORAGE_KEY,JSON.stringify({done:[[],[],[],[],[]],seen:[false,false,false,false,false]})]]);
 assert.equal(createReturnVisit({storage:storage(data)}).eligible,false);
});
test('entering the scroll is remembered across a refresh, independently of game resets',()=>{
 const data=new Map(),local=storage(data),visit=createReturnVisit({storage:local,now:()=>1234});visit.markScrollVisited();
 data.set(STORAGE_KEY,JSON.stringify({done:[[],[],[],[],[]]}));
 assert.equal(createReturnVisit({storage:local}).eligible,true);assert.equal(JSON.parse(data.get(RETURN_VISIT_KEY)).visitedAt,1234);
});
test('actual older game and resource interactions identify previous scroll visitors',()=>{
 for(const data of [new Map([[STORAGE_KEY,JSON.stringify({done:[[0],[],[],[],[]]})]]),new Map([['linggan-resource-seen-r09',JSON.stringify({toolkit:true})]])])assert.equal(createReturnVisit({storage:storage(data)}).eligible,true);
});
test('unavailable storage never interrupts the visit and works for a same-page return',()=>{
 const visit=createReturnVisit({storage:{getItem(){throw Error('blocked')},setItem(){throw Error('blocked')}}});
 assert.equal(visit.eligible,false);visit.markScrollVisited();assert.equal(visit.eligible,true);
});
test('releasing or cancelling a short hold never navigates when readiness arrives later',()=>{
 const hold=new ReturnHold();hold.press(100);hold.update(600);hold.release();assert.equal(hold.update(4000),false);assert.equal(hold.progress,0);
 hold.press(5000);hold.update(5500);hold.cancel();assert.equal(hold.update(8000),false);
});
test('a continuous one-second pointer or keyboard hold commits exactly once',()=>{
 const hold=new ReturnHold();hold.press(100);assert.equal(hold.press(500),false);assert.equal(hold.update(1099),false);assert.equal(hold.update(1100),true);
 assert.equal(hold.update(1200),false);hold.release();assert.equal(hold.press(1300),false);
 hold.reset();assert.equal(hold.press(2000),true);assert.equal(hold.update(3000),true);
});
