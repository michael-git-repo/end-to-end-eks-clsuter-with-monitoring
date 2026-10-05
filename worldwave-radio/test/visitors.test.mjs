import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createVisitorStore} from '../visitors.mjs';
import {createServer} from '../server.mjs';

test('visitor records distinguish repeat visits, daily visitors, and survive reopening',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'michaelwave-visitors-'));
  let clock=new Date('2026-10-04T10:00:00Z');let store;
  try{
    store=createVisitorStore(dir,{now:()=>clock});assert.equal(store.summary().visitors,0);
    const first=store.record();const cookie=first.cookie.split(';')[0];
    assert.equal(first.stats.visitors,1);assert.equal(first.stats.visits,1);
    let next=store.record(cookie).stats;assert.equal(next.visitors,1);assert.equal(next.visits,2);assert.equal(next.todayVisitors,1);
    next=store.record().stats;assert.equal(next.visitors,2);assert.equal(next.visits,3);
    clock=new Date('2026-10-05T10:00:00Z');assert.equal(store.summary().todayVisitors,0);
    next=store.record(cookie).stats;assert.equal(next.visitors,2);assert.equal(next.todayVisitors,1);assert.equal(next.todayVisits,1);assert.equal(next.days.length,2);
    store.close();store=createVisitorStore(dir,{now:()=>clock});assert.equal(store.summary().visits,4);
    assert.equal(store.record(cookie).stats.visitors,2);
  }finally{store?.close();await rm(dir,{recursive:true,force:true});}
});

test('visitor HTTP API exposes aggregates, uses an HttpOnly cookie, and ignores health checks',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'michaelwave-visitors-http-'));
  const server=createServer({dataDirectory:dir});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base=`http://127.0.0.1:${server.address().port}`;
  try{
    await fetch(base+'/healthz');const empty=await(await fetch(base+'/api/visitors')).json();assert.equal(empty.visits,0);
    const blocked=await fetch(base+'/api/visitors',{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://unrelated.example'}});assert.equal(blocked.status,403);
    const result=await fetch(base+'/api/visitors',{method:'POST',headers:{'Content-Type':'application/json'}});assert.equal(result.status,200);
    const cookie=result.headers.get('set-cookie');assert.match(cookie,/HttpOnly/);assert.match(cookie,/SameSite=Lax/);
    const again=await fetch(base+'/api/visitors',{method:'POST',headers:{'Content-Type':'application/json',Cookie:cookie.split(';')[0]}});
    const stats=await again.json();assert.equal(stats.visitors,1);assert.equal(stats.visits,2);assert.ok(!JSON.stringify(stats).includes('token'));
    const get=await fetch(base+'/api/visitors');assert.equal(get.headers.get('cache-control'),'no-store');assert.equal((await get.json()).visits,2);
  }finally{await new Promise(resolve=>server.close(resolve));await rm(dir,{recursive:true,force:true});}
});
