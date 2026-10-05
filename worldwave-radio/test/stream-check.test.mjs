import test from 'node:test';
import assert from 'node:assert/strict';
import {createStationChecker} from '../stream-check.mjs';
import {createServer} from '../server.mjs';
import {stationLogo} from '../public/catalogue.js';
const station={id:'edo-example',local:true,url:'https://stream.zeno.fm/example'};
test('stream checks recognize audio and share cached results',async()=>{
  let calls=0;
  const check=createStationChecker([station],{fetchImpl:async()=>{calls++;return new Response('audio bytes',{headers:{'Content-Type':'audio/mpeg'}});}});
  const results=await Promise.all([check(station.id),check(station.id)]);
  assert.equal(results[0].status,'responding');assert.deepEqual(results[0],results[1]);assert.equal(calls,1);
  assert.equal(await check('edo-unknown'),null);assert.equal(calls,1);
});
test('inactive broadcaster feed remains unavailable after a valid redirect',async()=>{
  const visited=[];
  const check=createStationChecker([station],{fetchImpl:async url=>{
    visited.push(url);
    return visited.length===1?new Response(null,{status:302,headers:{location:'https://stream-176.surfernetwork.com/example'}}):new Response('Mount point not active, try again later.',{status:503});
  }});
  const result=await check(station.id);assert.equal(result.status,'unavailable');assert.match(result.reason,/reconnect/);assert.equal(visited.length,2);
});
test('untrusted and insecure redirects are never fetched',async()=>{
  for(const location of ['https://untrusted.example/audio','http://stream.zeno.fm/audio','https://user:pass@stream.zeno.fm/audio']){
    let calls=0;
    const check=createStationChecker([station],{fetchImpl:async()=>{calls++;return new Response(null,{status:302,headers:{location}});}});
    assert.equal((await check(station.id)).status,'unknown');assert.equal(calls,1);
  }
});
test('a network timeout does not label a broadcaster offline',async()=>{
  const check=createStationChecker([station],{timeoutMs:5,fetchImpl:async(_url,{signal})=>new Promise((_resolve,reject)=>signal.addEventListener('abort',()=>reject(signal.reason),{once:true}))});
  assert.equal((await check(station.id)).status,'unknown');
});
test('station check HTTP endpoint returns fresh JSON and rejects unknown IDs',async()=>{
  const server=createServer({checkStation:async id=>id===station.id?{id,status:'responding'}:null});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  try{
    const base=`http://127.0.0.1:${server.address().port}`;
    const result=await fetch(`${base}/api/stations/${station.id}/check`);
    assert.equal(result.status,200);assert.equal(result.headers.get('cache-control'),'no-store');assert.equal((await result.json()).status,'responding');
    assert.equal((await fetch(`${base}/api/stations/edo-unknown/check`)).status,404);
  }finally{await new Promise(resolve=>server.close(resolve));}
});
test('station artwork permits local assets and HTTPS logos only',()=>{
  assert.equal(stationLogo({logo:'logos/edo-example.webp'}),'logos/edo-example.webp');
  assert.equal(stationLogo({logo:'https://example.com/logo.png'}),'https://example.com/logo.png');
  for(const logo of ['javascript:alert(1)','http://example.com/logo.png','logos/../secret.png',null])assert.equal(stationLogo({logo}),'');
});
