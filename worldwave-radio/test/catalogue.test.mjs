import test from 'node:test';
import assert from 'node:assert/strict';
import {filterStations,safeUrl} from '../public/catalogue.js';
import {createServer} from '../server.mjs';
const data=[{id:'1',name:'Lagos FM',country:'NG',state:'Lagos',tags:'news'},{id:'2',name:'Paris Jazz',country:'FR',state:'Île-de-France',tags:'jazz'},{id:'3',name:'London News',country:'GB',state:'England',tags:'news'}];
test('location filters combine and city mentions do not invent coordinates',()=>{
  assert.deepEqual(filterStations(data,{region:'Africa',country:'NG',city:'lagos'}).map(s=>s.id),['1']);
  assert.equal(filterStations(data,{country:'NG',city:'abuja'}).length,0);
  assert.equal(filterStations(data,{region:'Europe',query:'news'}).length,1);
  assert.equal(filterStations(data,{state:'Île-de-France',city:'ile'}).length,1);
});
test('station links reject script and local URLs',()=>{assert.equal(safeUrl('javascript:alert(1)'),'');assert.equal(safeUrl('file:///etc/passwd'),'');assert.equal(safeUrl('https://example.com/stream'),'https://example.com/stream');});
test('HTTP health, content security, method and traversal handling',async()=>{
  const server=createServer();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base=`http://127.0.0.1:${server.address().port}`;
  try{const health=await fetch(base+'/healthz');assert.equal(await health.text(),'ok');assert.match(health.headers.get('content-security-policy'),/object-src 'none'/);assert.equal((await fetch(base+'/',{method:'POST'})).status,405);assert.equal((await fetch(base+'/%2e%2e%2fpackage.json')).status,403);}finally{await new Promise(resolve=>server.close(resolve));}
});
