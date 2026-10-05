import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {geoOrthographic,geoArea} from 'd3-geo';
import {coordinates,locateStation,flightFrame,rotateGlobe,clampScale,globeScale,countryFlag} from '../public/globe-state.js';

test('locations preserve valid zero coordinates and reject missing or out-of-range data',()=>{
  assert.deepEqual(coordinates(0,0),[0,0]);assert.deepEqual(coordinates('6.34','5.63'),[5.63,6.34]);
  for(const value of [null,undefined,'',' ',NaN,'not a number',91])assert.equal(coordinates(value,5),null);
  assert.equal(coordinates(0,181),null);
});
test('flags use the station country and cannot construct arbitrary asset paths',()=>{
  const codes=new Set(['NG','US','GB','FR']);
  assert.deepEqual(countryFlag('ng',codes),{code:'NG',name:'Nigeria',path:'flags/ng.svg'});
  assert.equal(countryFlag('US',codes).path,'flags/us.svg');assert.equal(countryFlag('UK',codes).path,'flags/gb.svg');
  for(const value of ['../NG','https://example.com','ZZ','XX',undefined])assert.equal(countryFlag(value,codes),null);
});
test('map locations distinguish station, city, country estimates and unknown locations',()=>{
  const countries=[{properties:{code:'NG',name:'Nigeria',latitude:9,longitude:8}}];
  assert.equal(locateStation({latitude:0,longitude:0},countries).precision,'Station coordinates');
  assert.equal(locateStation({local:true,country:'NG',city:'Benin City'},countries).precision,'Approximate city centre');
  assert.equal(locateStation({country:'NG',name:'Benin City station'},countries).precision,'Approximate country location');
  assert.equal(locateStation({country:'XX',name:'Benin City station'},countries),null);
});
test('globe completes a turn, zooms after rotating, and centres the selected station',()=>{
  const start={rotation:[-5.63,-6.34,0],scale:155};const point=[-74,40.7];
  const turning=flightFrame(start,point,.65),end=flightFrame(start,point,1);
  assert.ok(turning.rotation[0]-start.rotation[0]>180);assert.equal(turning.scale,155);assert.equal(end.scale,globeScale.station);
  const projected=geoOrthographic().rotate(end.rotation).translate([200,185]).scale(end.scale)(point);
  assert.ok(Math.abs(projected[0]-200)<.00001);assert.ok(Math.abs(projected[1]-185)<.00001);
});
test('dragging wraps longitude, limits polar flipping and bounds zoom',()=>{
  assert.deepEqual(rotateGlobe([175,0,0],20,0),[-165,0,0]);
  assert.deepEqual(rotateGlobe([0,80,0],0,-50),[0,85,0]);
  assert.deepEqual(rotateGlobe([0,-80,0],0,50),[0,-85,0]);
  assert.equal(clampScale(10),globeScale.min);assert.equal(clampScale(900),globeScale.max);
});
test('back to station takes the short route without another full spin',()=>{
  const start={rotation:[170,0,0],scale:250};
  const end=flightFrame(start,[170,40],1,{spin:false});
  assert.equal(end.rotation[0]-start.rotation[0],20);assert.equal(end.rotation[1],-40);assert.equal(end.scale,globeScale.station);
});
test('bundled countries use small spherical areas instead of inverted world-sized polygons',async()=>{
  const world=JSON.parse(await readFile(new URL('../public/maps/world.json',import.meta.url),'utf8'));
  assert.ok(world.features.length>170);
  for(const feature of world.features)assert.ok(geoArea(feature)<2*Math.PI,feature.properties.name);
  assert.ok(locateStation({country:'NG'},world.features));
});
