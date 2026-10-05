// Only configured local station URLs can be checked; callers cannot supply a URL.
export function createStationChecker(stations,{fetchImpl=fetch,cacheMs=30000,timeoutMs=10000}={}){
  const known=new Map(stations.filter(s=>s.local).map(s=>[s.id,s]));
  const cache=new Map();
  async function probe(station){
    const checkedAt=new Date().toISOString();
    const result=(status,reason)=>({id:station.id,status,reason,checkedAt});
    if(!station.url)return result('not-found','No direct online stream has been found for this station.');
    const initial=new URL(station.url);
    if(initial.protocol!=='https:')return result('unknown','This station does not provide a secure stream.');
    const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),timeoutMs);
    try{
      let url=initial;
      for(let redirects=0;redirects<6;redirects++){
        const response=await fetchImpl(url.href,{signal:controller.signal,redirect:'manual',headers:{'User-Agent':'WorldwaveRadio/1.0'}});
        if([301,302,303,307,308].includes(response.status)){
          const location=response.headers.get('location');await response.body?.cancel();
          if(!location)return result('unknown','The stream returned an incomplete redirect.');
          const next=new URL(location,url);
          const allowed=next.hostname===initial.hostname||['zeno.fm','surfernetwork.com','streamguys1.com'].some(domain=>next.hostname===domain||next.hostname.endsWith('.'+domain));
          if(next.protocol!=='https:'||next.username||next.password||!allowed)return result('unknown','The stream redirected to an unverified server. Open the station website.');
          url=next;continue;
        }
        const chunk=await response.body?.getReader().read();
        const type=response.headers.get('content-type')||'';
        if(response.ok&&/^(audio\/|application\/(?:octet-stream|vnd\.apple\.mpegurl|x-mpegurl))/i.test(type)&&chunk?.value?.length)return result('responding','The station is sending audio. Press Listen to start.');
        const text=new TextDecoder().decode(chunk?.value?.slice(0,1024));
        if(response.status===503&&text.includes('Mount point not active'))return result('unavailable','The broadcaster’s stream is not active. The station must reconnect its broadcast feed.');
        if([404,410,503].includes(response.status))return result('unavailable',`The station’s streaming server returned HTTP ${response.status}.`);
        return result('unknown','The server did not return recognizable audio. Open the station website or check again later.');
      }
      return result('unknown','The station redirected too many times.');
    }catch{return result('unknown','Could not reach the station to check it. Try again later.');}
    finally{clearTimeout(timer);controller.abort();}
  }
  return async id=>{
    const station=known.get(id);if(!station)return null;
    const saved=cache.get(id);if(saved&&saved.until>Date.now())return saved.promise;
    const promise=probe(station);cache.set(id,{until:Date.now()+cacheMs,promise});return promise;
  };
}
