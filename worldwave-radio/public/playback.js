import {safeUrl} from './catalogue.js';

export function availability(station){
  if(!safeUrl(station.url))return {playable:false,label:'Online stream not found'};
  if(station.streamStatus==='unavailable')return {playable:false,label:'Stream offline at last check'};
  if(!safeUrl(station.url).startsWith('https://'))return {playable:false,label:'No secure online stream'};
  return {playable:true,label:'Online stream'};
}

export function createPlayer(audio,{onChange=()=>{},timeoutMs=20000}={}){
  let station=null,status='idle',message='Choose a station to start listening',version=0,timer;
  const snapshot=()=>({station,status,message});
  const update=(next,text)=>{status=next;message=text;onChange(snapshot());};
  const clear=()=>clearTimeout(timer);
  function fail(text){
    clear();status='error';audio.pause();audio.removeAttribute('src');audio.load();update('error',text);
  }
  async function start(next){
    const available=availability(next);
    if(!available.playable)return {ok:false,reason:available.label};
    if(station?.id===next.id&&status==='playing'){audio.pause();return {ok:true};}
    const current=++version;clear();
    const resume=station?.id===next.id&&['paused','blocked'].includes(status)&&audio.src;
    status='loading';audio.pause();station=next;
    if(next.hls&&!audio.canPlayType('application/vnd.apple.mpegurl')){fail('This browser cannot play this stream format. Open the station website.');return {ok:false};}
    if(!resume)audio.src=safeUrl(next.url);
    update('loading','Connecting…');
    timer=setTimeout(()=>{if(current===version)fail('The station did not respond. Try another station or retry.');},timeoutMs);
    try{
      // Call play inside the click handler, before any network lookup can consume user activation.
      await audio.play();
      return {ok:current===version};
    }catch(error){
      if(current!==version||status==='error')return {ok:false};
      clear();
      if(error.name==='NotAllowedError')update('blocked','Your browser blocked playback. Press play again to allow it.');
      else fail('Could not play this stream here. Try another station or open its website.');
      return {ok:false};
    }
  }
  const handlers={
    playing:()=>{if(station&&!audio.paused){clear();update('playing','Playing live');}},
    pause:()=>{if(status==='playing'){clear();update('paused','Paused');}},
    waiting:()=>{if(station&&['loading','playing'].includes(status)){
      update('loading','Buffering…');clear();const current=version;
      timer=setTimeout(()=>{if(current===version)fail('The stream stopped responding. Press play to reconnect.');},timeoutMs);
    }},
    ended:()=>{if(station)fail('This stream ended. Press play to reconnect.');},
    error:()=>{if(!station||!audio.error||status==='error')return;
      const detail=audio.error.code===2?'The stream connection failed.':audio.error.code===3?'The browser could not decode this audio.':audio.error.code===4?'The station returned unavailable or unsupported audio.':'Playback failed.';
      fail(detail+' Try another station or open its website.');
    }
  };
  for(const [event,handler] of Object.entries(handlers))audio.addEventListener(event,handler);
  return {start,snapshot,destroy(){++version;clear();for(const [event,handler] of Object.entries(handlers))audio.removeEventListener(event,handler);audio.pause();}};
}
