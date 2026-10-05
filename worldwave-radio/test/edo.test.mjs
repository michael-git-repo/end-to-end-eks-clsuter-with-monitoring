import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {filterStations,mergeLocalStations} from '../public/catalogue.js';
const edo=JSON.parse(await readFile(new URL('../public/edo-stations.json',import.meta.url),'utf8'));
test('Edo catalogue distinguishes Benin City from other towns and Benin country',()=>{
  assert.equal(edo.length,22);
  assert.equal(new Set(edo.map(s=>s.id)).size,22);
  assert.equal(filterStations(edo,{country:'NG',state:'Edo',city:'Benin City'}).length,19);
  assert.deepEqual(filterStations(edo,{city:'Auchi'}).map(s=>s.name),['Hillside FM']);
  assert.equal(filterStations(edo,{country:'BJ'}).length,0);
  assert.equal(filterStations(edo,{query:'105.5'})[0].name,'RayPower FM Benin');
});
test('local records survive refreshes without duplicate HOD streams or country changes',()=>{
  const hod=edo.find(s=>s.name==='HOD Radio');
  const base=[{id:'rb-hod-1',country:'NG',name:'HOD RADIO',state:'Edo State',url:hod.url},{id:'rb-hod-2',country:'NG',name:'HOD RADIO',state:'Edo state',url:hod.url},{id:'benin-country',country:'BJ',name:'Benin Radio',state:'',url:'https://example.com/benin'},{id:'another-edo',country:'NG',name:'Another station',state:'EDO STATE',url:''}];
  const merged=mergeLocalStations(base,edo);
  assert.equal(merged.filter(s=>s.url===hod.url).length,1);
  assert.equal(merged.find(s=>s.id==='benin-country').country,'BJ');
  assert.equal(merged.find(s=>s.id==='another-edo').state,'Edo');
  assert.deepEqual(mergeLocalStations(merged,edo),merged);
  assert.equal(filterStations(mergeLocalStations([],edo),{state:'Edo'}).length,22);
});
test('every local record has provenance and explicit availability',()=>{
  for(const s of edo){
    assert.equal(s.country,'NG');assert.equal(s.state,'Edo');assert.equal(s.local,true);
    assert.match(s.source,/^https:\/\//);assert.ok(s.sources.length);
    assert.ok(['responding','unavailable','not-found'].includes(s.streamStatus));
    if(s.url)assert.match(s.url,/^https:\/\//);
    else assert.equal(s.streamStatus,'not-found');
  }
});
