import { mkdir, writeFile } from 'node:fs/promises';
const origin = 'https://de1.api.radio-browser.info';
let rows=[];
for(let offset=0;offset<100000;offset+=1000){
  let page;
  for(let attempt=0;attempt<3;attempt++){
    try {
      const response=await fetch(`${origin}/json/stations/search?hidebroken=true&order=name&limit=1000&offset=${offset}`,{headers:{'User-Agent':'WorldwaveRadio/1.0'},signal:AbortSignal.timeout(30000)});
      if(!response.ok) throw new Error(`Directory returned ${response.status}`);
      page=await response.json();break;
    }catch(error){if(attempt===2) throw error;}
  }
  rows.push(...page);
  if(page.length<1000) break;
}
rows=[...new Map(rows.map(s=>[s.stationuuid,s])).values()].sort((a,b)=>b.clickcount-a.clickcount);
const stations=rows.map(s=>({id:s.stationuuid,name:s.name.trim(),country:s.countrycode,state:s.state,tags:s.tags,language:s.language,url:s.url_resolved||s.url,home:s.homepage,logo:s.favicon||'',latitude:s.geo_lat,longitude:s.geo_long,codec:s.codec,bitrate:s.bitrate,hls:s.hls,clicks:s.clickcount}));
const mirrors=await fetch(`${origin}/json/servers`).then(r=>r.json()).then(r=>[...new Set(r.map(s=>`https://${s.name}`))]);
await mkdir('public',{recursive:true});
await writeFile('public/directory.json',JSON.stringify({updated:new Date().toISOString(),mirrors,stations}));
console.log(JSON.stringify({stations:stations.length,countries:new Set(stations.map(s=>s.country)).size,nigeria:stations.filter(s=>s.country==='NG').length,bytes:Buffer.byteLength(JSON.stringify(stations))}));
