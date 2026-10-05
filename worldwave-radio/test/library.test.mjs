import test from 'node:test';
import assert from 'node:assert/strict';
import {createLibrary} from '../public/library.js';
const storage=()=>{let value=null;return {getItem:()=>value,setItem:(_,next)=>{value=next;}};};
test('favourites survive reload and can be removed without losing history',()=>{
  const store=storage(),library=createLibrary(store);library.toggle('a');library.played('b');
  const reloaded=createLibrary(store);assert.equal(reloaded.has('a'),true);reloaded.toggle('a');
  assert.equal(createLibrary(store).has('a'),false);assert.deepEqual(reloaded.snapshot().recent,['b']);
});
test('recent listening is unique, newest first, bounded, and clearable',()=>{
  const library=createLibrary(storage());for(let i=0;i<25;i++)library.played(String(i));library.played('20');
  const recent=library.snapshot().recent;assert.equal(recent.length,20);assert.equal(recent[0],'20');assert.equal(new Set(recent).size,20);
  assert.deepEqual(library.filter([{id:'21'},{id:'unknown'},{id:'20'}],'recent'),[{id:'20'},{id:'21'}]);
  library.toggle('21');library.clearRecent();assert.deepEqual(library.snapshot().recent,[]);assert.equal(library.has('21'),true);
});
test('unavailable or malformed storage cannot break listening or inject station data',()=>{
  const library=createLibrary({getItem:()=>'{broken',setItem:()=>{throw new Error('Quota');}});
  library.toggle('a');library.played('a');assert.equal(library.has('a'),true);assert.equal(library.snapshot().persistent,false);
  const corrupt=createLibrary({getItem:()=>JSON.stringify({saved:['ok','ok',{},null,''],recent:'bad'})});
  assert.deepEqual(corrupt.snapshot().saved,['ok']);assert.deepEqual(corrupt.snapshot().recent,[]);
  assert.deepEqual(corrupt.filter([{id:'ok'},{id:'other'}],'saved'),[{id:'ok'}]);
});
