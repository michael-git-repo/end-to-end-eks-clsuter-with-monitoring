import test from 'node:test';
import assert from 'node:assert/strict';
import {availability,createPlayer} from '../public/playback.js';

class AudioStub extends EventTarget{
  src='';paused=true;error=null;plays=0;loads=0;
  play(){this.plays++;this.paused=false;this.dispatchEvent(new Event('playing'));return Promise.resolve();}
  pause(){this.paused=true;this.dispatchEvent(new Event('pause'));}
  removeAttribute(){this.src='';}
  load(){this.loads++;this.error=null;}
  canPlayType(){return '';}
}
const ready={id:'ebs',url:'https://example.com/ebs',streamStatus:'responding'};
test('known offline, absent and insecure feeds are not playable',()=>{
  assert.equal(availability(ready).playable,true);
  assert.equal(availability({...ready,streamStatus:'unavailable'}).playable,false);
  assert.equal(availability({...ready,url:''}).playable,false);
  assert.equal(availability({...ready,url:'http://example.com'}).playable,false);
});
test('play happens synchronously and pause/resume reuses the current source',async()=>{
  const audio=new AudioStub();const player=createPlayer(audio);
  try{const started=player.start(ready);assert.equal(audio.plays,1);await started;
    assert.equal(player.snapshot().status,'playing');await player.start(ready);
    assert.equal(player.snapshot().status,'paused');await player.start(ready);
    assert.equal(player.snapshot().status,'playing');assert.equal(audio.src,ready.url);
    assert.equal(audio.loads,0);
  }finally{player.destroy();}
});
test('selecting a known offline station does not interrupt an existing stream',async()=>{
  const audio=new AudioStub();const player=createPlayer(audio);
  try{await player.start(ready);const result=await player.start({...ready,id:'offline',streamStatus:'unavailable'});
    assert.equal(result.ok,false);assert.equal(player.snapshot().station.id,'ebs');assert.equal(audio.paused,false);
  }finally{player.destroy();}
});
test('an old play rejection cannot stop a newly selected station',async()=>{
  const audio=new AudioStub();let rejectFirst;
  audio.play=()=>new Promise((_,reject)=>{rejectFirst=reject;});
  const player=createPlayer(audio);
  try{const first=player.start(ready);audio.play=AudioStub.prototype.play;
    await player.start({...ready,id:'super',url:'https://example.com/super'});
    rejectFirst(new Error('Old stream failed'));await first;
    assert.equal(player.snapshot().status,'playing');assert.equal(player.snapshot().station.id,'super');
  }finally{player.destroy();}
});
test('browser playback blocking allows a direct retry without clearing the source',async()=>{
  const audio=new AudioStub();audio.play=()=>Promise.reject(Object.assign(new Error('Blocked'),{name:'NotAllowedError'}));
  const player=createPlayer(audio);
  try{await player.start(ready);assert.equal(player.snapshot().status,'blocked');assert.equal(audio.src,ready.url);
    audio.play=AudioStub.prototype.play;await player.start(ready);assert.equal(player.snapshot().status,'playing');
  }finally{player.destroy();}
});
test('media errors stay visible instead of being overwritten by pause events',async()=>{
  const audio=new AudioStub();const player=createPlayer(audio);
  try{await player.start(ready);audio.error={code:4};audio.dispatchEvent(new Event('error'));
    assert.equal(player.snapshot().status,'error');assert.match(player.snapshot().message,/unavailable or unsupported/);assert.equal(audio.src,'');
  }finally{player.destroy();}
});
