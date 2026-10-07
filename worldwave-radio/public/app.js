import { regions, filterStations, safeUrl, mergeLocalStations, stationLogo } from './catalogue.js';
import { availability, createPlayer } from './playback.js';
import { createStationGlobe } from './globe.js';
import { startVisitorCounter } from './visitors.js';
import { createLibrary } from './library.js';
import { countryFlag } from './globe-state.js';
import { flagCodes } from './flag-codes.js';
let storage;try{storage=window.localStorage;}catch{/* Listening works without browser storage. */}
const library=createLibrary(storage);
let collection='all',lastRecorded=null;
const $=id=>document.getElementById(id), audio=$('audio');
const countryNames=new Intl.DisplayNames(['en'],{type:'region'});
const countryName=code=>{try{return countryNames.of(code)||'Unspecified';}catch{return 'Unspecified';}};
let stations=[],localStations=[],matches=[],shown=24,region='',selected=null,mirrors=['https://de1.api.radio-browser.info'];
const stationChecks=new Map();
let visibleStationIds=new Set();
const motionPreference=window.matchMedia('(prefers-reduced-motion: reduce)');
let globe;
function setMotion(enabled){
  const active=enabled&&!motionPreference.matches;
  document.documentElement.dataset.motion=active?'on':'off';
  $('motion-toggle').setAttribute('aria-pressed',String(active));
  $('motion-toggle').disabled=motionPreference.matches;
  let label='Motion off';
  if(motionPreference.matches)label='Reduced motion';
  else if(active)label='Motion on';
  $('motion-label').textContent=label;
  globe?.motionChanged();
}
setMotion(!motionPreference.matches);
$('motion-toggle').addEventListener('click',()=>setMotion(document.documentElement.dataset.motion!=='on'));
motionPreference.addEventListener('change',()=>setMotion(!motionPreference.matches));
const pauseHiddenMotion=()=>{document.documentElement.dataset.motionPaused=String(document.hidden);};
document.addEventListener('visibilitychange',pauseHiddenMotion);pauseHiddenMotion();
globe=createStationGlobe({motionEnabled:()=>document.documentElement.dataset.motion==='on',resolveStation:async station=>{
  if(!/^[a-f0-9-]{36}$/i.test(station.id))return null;
  const response=await fetch(mirrors[0]+'/json/stations/byuuid/'+encodeURIComponent(station.id),{signal:AbortSignal.timeout(4000)});
  if(!response.ok)return null;
  const result=await response.json();return result.find(row=>row.stationuuid===station.id)||null;
}});
startVisitorCounter();
const player=createPlayer(audio,{onChange(state){
  selected=state.station;
  if(state.status==='playing'&&selected&&lastRecorded!==selected.id){library.played(selected.id);lastRecorded=selected.id;}
  $('player').dataset.status=state.status;
  globe.show(selected,state.status);$('view-map').hidden=!selected;
  $('player-name').textContent=selected?.name||'Your next discovery awaits';
  if(selected)$('player-art').replaceChildren(...stationArt(selected).childNodes);
  $('player-status').textContent=state.message;
  $('toggle').disabled=!selected;
  $('toggle').textContent=state.status==='playing'?'Ⅱ':'▶';
  let toggleLabel='Play station';
  if(state.status==='playing')toggleLabel='Pause station';
  else if(state.status==='error')toggleLabel='Retry station';
  $('toggle').setAttribute('aria-label',toggleLabel);
  const home=safeUrl(selected?.home||selected?.source);$('station-link').hidden=!home;
  if(home)$('station-link').href=home;
  $('station-link').textContent=selected?.home?'Station website':'Station details';
  render();
}});
const filters=()=>({region,country:$('country').value,state:$('state').value,query:$('query').value,city:$('city').value});
function element(tag,className,text){const e=document.createElement(tag);if(className)e.className=className;if(text!==undefined)e.textContent=text;return e;}
function stationArt(station){
  const art=element('div','station-art');art.setAttribute('aria-hidden','true');
  const fallback=element('img','radio-icon');fallback.src='radio.svg';fallback.alt='';art.append(fallback);
  const url=stationLogo(station);
  if(url){const logo=element('img','station-logo');logo.alt='';logo.loading='lazy';logo.decoding='async';logo.referrerPolicy='no-referrer';logo.addEventListener('error',()=>logo.remove(),{once:true});logo.src=url;art.append(logo);}
  return art;
}
function notice(message){$('notice').textContent=message;$('notice').hidden=!message;}
function options(id,values,placeholder){const previous=$(id).value;$(id).replaceChildren(new Option(placeholder,''),...values.map(([value,label])=>new Option(label,value)));if(values.some(([value])=>value===previous))$(id).value=previous;}
function fillCountries(){const codes=[...new Set(stations.filter(s=>!region||regions[region].includes(s.country)).map(s=>s.country))].filter(Boolean);options('country',codes.map(c=>[c,countryName(c)]).sort((a,b)=>a[1].localeCompare(b[1])),'All countries');}
function fillStates(){const rows=filterStations(stations,{region,country:$('country').value});options('state',[...new Set(rows.map(s=>s.state).filter(Boolean))].sort().map(s=>[s,s]),'All states / regions');}
function updateLibraryControls(saved){
  $('saved-count').textContent=saved.saved.length;
  let libraryNote='Save the stations you love. Your favourites stay in this browser.';
  if(!saved.persistent)libraryNote='Your collection is available for this visit. Browser storage is unavailable.';
  else if(collection==='recent')libraryNote='Your last 20 stations that played, saved only in this browser.';
  $('library-note').textContent=libraryNote;
  $('clear-recent').hidden=collection!=='recent'||!saved.recent.length;
  $('surprise').disabled=!matches.some(canDiscover);
}
function updateFilterButtons(){
  document.querySelectorAll('[data-collection]').forEach(button=>{
    button.setAttribute('aria-pressed',String(button.dataset.collection===collection));
  });
  const sound=$('query').value.toLowerCase();
  document.querySelectorAll('[data-sound]').forEach(button=>{
    button.setAttribute('aria-pressed',String(button.dataset.sound===sound));
  });
}
function resultsTitle(){
  if(collection==='saved')return 'Your favourites';
  if(collection==='recent')return 'Recently played';
  const country=$('country').value;
  const location=[$('city').value.trim(),$('state').value,country?countryName(country):region].filter(Boolean).join(' · ');
  return location||'Around the world';
}
function updateResultsHeader(){
  $('results-title').textContent=resultsTitle();
  $('count').textContent=`${matches.length.toLocaleString()} stations · ${Math.min(shown,matches.length)} shown`;
}
function createFavouriteButton(station){
  const saved=library.has(station.id);
  const button=element('button','favourite',saved?'♥':'♡');
  button.type='button';
  button.dataset.station=station.id;
  button.setAttribute('aria-pressed',String(saved));
  button.setAttribute('aria-label',`${saved?'Remove':'Save'} ${station.name} ${saved?'from':'to'} favourites`);
  button.addEventListener('click',()=>toggleFavourite(station));
  return button;
}
function toggleFavourite(station){
  library.toggle(station.id);
  const action=library.has(station.id)?'saved to':'removed from';
  $('library-feedback').textContent=`${station.name} ${action} favourites.`;
  render();
  const replacement=[...document.querySelectorAll('.favourite')].find(button=>button.dataset.station===station.id);
  const focusTarget=replacement||document.querySelector('[data-collection="saved"]');
  focusTarget.focus({preventScroll:true});
}
function createStationHeader(station){
  const header=element('div','card-top');
  let stationType='INTERNET RADIO';
  if(station.frequency)stationType=`${station.frequency} FM`;
  header.append(stationArt(station),element('span','station-type',stationType),createFavouriteButton(station));
  return header;
}
function addStationFlag(info,station){
  const flag=countryFlag(station.country,flagCodes);
  if(!flag)return;
  const badge=element('span','station-country');
  const image=element('img');
  image.src=flag.path;image.alt='';image.width=18;image.height=14;image.loading='lazy';
  image.addEventListener('error',()=>image.remove(),{once:true});
  badge.append(image,document.createTextNode(flag.name));
  info.append(badge);
}
function createStationInfo(station){
  const info=element('div');
  const location=[station.city,station.state,countryName(station.country)].filter(Boolean).join(' · ');
  info.append(element('h3','',station.name),element('p','location',location));
  addStationFlag(info,station);
  const reference=safeUrl(station.home||station.source);
  if(reference){
    const label=station.home?'Station website':'Station details';
    const link=element('a','station-source',label);
    link.href=reference;link.target='_blank';link.rel='noopener noreferrer';
    info.append(link);
  }
  return info;
}
function createStationTags(station){
  const tags=element('p','tags');
  const source=station.tags||station.language||'Radio discovery';
  for(const tag of source.split(',').map(value=>value.trim()).filter(Boolean).slice(0,3)){
    tags.append(element('span','tag',tag));
  }
  return tags;
}
function createListenButton(station,available){
  const playing=station.id===selected?.id&&player.snapshot().status==='playing';
  let label='Listen';
  if(!available.playable)label='Unavailable';
  else if(playing)label='Pause';
  const button=element('button','listen'+(playing?' is-playing':''),label);
  button.disabled=!available.playable;
  let action='Listen to';
  if(!available.playable)action='Stream unavailable for';
  else if(playing)action='Pause';
  button.setAttribute('aria-label',`${action} ${station.name}`);
  if(available.playable)button.addEventListener('click',()=>chooseStation(station));
  return button;
}
function createStreamCheck(station){
  const status=stationChecks.get(station.id);
  const label=status?.pending?'Checking…':'Check again';
  const retry=element('button','check-stream',label);
  retry.disabled=Boolean(status?.pending);
  retry.setAttribute('aria-label',`Check the stream for ${station.name}`);
  retry.addEventListener('click',()=>recheckStation(station));
  const controls=element('div','stream-check');
  controls.append(retry);
  const reason=status?.reason||station.streamReason;
  if(reason){
    const detail=element('p','hint',reason);
    detail.setAttribute('role','status');
    controls.append(detail);
  }
  return controls;
}
function createStationControls(station,card){
  const available=availability(station);
  card.dataset.playable=String(available.playable);
  const bottom=element('div','card-bottom');
  let streamLabel=available.label;
  if(available.playable&&station.bitrate){
    const codec=station.codec||'Audio';
    streamLabel=`${station.bitrate} kbps · ${codec}`;
  }
  bottom.append(element('span','stream-label',streamLabel));
  if(station.url)bottom.append(createListenButton(station,available));
  let streamCheck=null;
  if(station.local&&station.url)streamCheck=createStreamCheck(station);
  return {bottom,streamCheck};
}
function createStationCard(station,index){
  const active=station.id===selected?.id;
  const card=element('article',active?'card active':'card');
  if(index!==null){
    card.classList.add('card-enter');
    card.dataset.enter=String(Math.min(index,7));
  }
  card.prepend(createStationHeader(station),createStationInfo(station),createStationTags(station));
  const controls=createStationControls(station,card);
  card.append(controls.bottom);
  if(controls.streamCheck)card.append(controls.streamCheck);
  return card;
}
function showEmptyResults(){
  if(!matches.length&&collection==='saved'){
    notice('No favourites match this view. Save a station using its heart button, or reset your filters.');
    return;
  }
  if(!matches.length&&collection==='recent'){
    notice('No listening history matches this view. Play a station from Discover, or reset your filters.');
    return;
  }
  if(!matches.length){
    notice('No stations match these filters. Try a nearby city, choose a broader location, or reset your search.');
    return;
  }
  notice('');
}
function render(){
  matches=library.filter(filterStations(stations,filters()),collection);
  if(collection!=='recent')matches.sort((a,b)=>Number(availability(b).playable)-Number(availability(a).playable));
  updateLibraryControls(library.snapshot());
  updateFilterButtons();
  updateResultsHeader();
  const grid=$('grid');
  grid.replaceChildren();
  grid.setAttribute('aria-busy','false');
  showEmptyResults();
  const visible=matches.slice(0,shown);
  let entering=0;
  visible.forEach(station=>{
    const index=visibleStationIds.has(station.id)?null:entering++;
    grid.append(createStationCard(station,index));
  });
  visibleStationIds=new Set(visible.map(s=>s.id));
  $('more').hidden=shown>=matches.length;
}
async function recheckStation(station){
  stationChecks.set(station.id,{pending:true});render();
  try{
    const response=await fetch(`/api/stations/${encodeURIComponent(station.id)}/check`,{cache:'no-store',signal:AbortSignal.timeout(15000)});
    if(!response.ok)throw new Error();
    const result=await response.json();
    if(result.id!==station.id||!['responding','unavailable','unknown','not-found'].includes(result.status))throw new Error();
    if(result.status!=='unknown'){
      for(const row of [...stations,...localStations])if(row.id===station.id){row.streamStatus=result.status;row.streamCheckedAt=result.checkedAt;row.streamReason=result.reason;}
    }
    stationChecks.set(station.id,{pending:false,reason:result.reason});
  }catch{stationChecks.set(station.id,{pending:false,reason:'Could not reach the stream-check service. Try again later.'});}
  render();
}
async function api(path){
  for(const host of mirrors){try{const r=await fetch(host+path,{signal:AbortSignal.timeout(12000)});if(!r.ok)throw new Error('Directory unavailable');return await r.json();}catch{/* Try the next advertised mirror. */}}
  throw new Error('The station directory is temporarily unavailable.');
}
function chooseStation(s){
  const wasPlaying=selected?.id===s.id&&player.snapshot().status==='playing';
  void player.start(s);
  // Resolve updates for the NEXT attempt without delaying this click's playback.
  if(!s.local&&!wasPlaying&&availability(s).playable){void api('/json/url/'+encodeURIComponent(s.id)).then(fresh=>{
    const url=safeUrl(fresh.url);if((fresh.ok===true||fresh.ok==='true')&&url.startsWith('https://'))s.url=url;
  }).catch(()=>{});}
}
audio.volume=.8;
$('toggle').addEventListener('click',()=>{if(selected)chooseStation(selected);});
$('volume').addEventListener('input',()=>{audio.volume=Number($('volume').value);});
$('filters').addEventListener('submit',e=>e.preventDefault());
for(const id of ['query','city'])$(id).addEventListener('input',()=>{shown=24;render();markRegions();});
$('country').addEventListener('change',()=>{$('state').value='';fillStates();shown=24;render();markRegions();});
$('state').addEventListener('change',()=>{shown=24;render();markRegions();});
function regionButtonIsActive(button){
  if(button.dataset.state){
    return $('country').value===button.dataset.country&&$('state').value===button.dataset.state&&$('city').value===(button.dataset.city||'');
  }
  if(button.dataset.country){
    return $('country').value===button.dataset.country&&!$('state').value&&!$('city').value;
  }
  return button.dataset.region===region&&!$('country').value;
}
function markRegions(){
  document.querySelectorAll('.regions button').forEach(button=>{
    button.setAttribute('aria-pressed',String(regionButtonIsActive(button)));
  });
}
function reset(){collection='all';region='';$('country').value='';$('state').value='';$('city').value='';$('query').value='';fillCountries();fillStates();markRegions();shown=24;render();}
$('reset').addEventListener('click',reset);
document.querySelectorAll('.regions button').forEach(button=>button.addEventListener('click',()=>{collection='all';region=button.dataset.region||'';$('country').value='';$('state').value='';$('city').value=button.dataset.city||'';$('query').value='';fillCountries();if(button.dataset.country)$('country').value=button.dataset.country;fillStates();if(button.dataset.state)$('state').value=button.dataset.state;markRegions();shown=24;render();}));

function canDiscover(station){return availability(station).playable&&(!station.hls||!!audio.canPlayType('application/vnd.apple.mpegurl'));}
document.querySelectorAll('[data-collection]').forEach(button=>button.addEventListener('click',()=>{collection=button.dataset.collection;shown=24;render();}));
$('clear-recent').addEventListener('click',()=>{library.clearRecent();lastRecorded=null;render();document.querySelector('[data-collection="recent"]').focus();$('library-feedback').textContent='Listening history cleared.';});
$('surprise').addEventListener('click',()=>{const pool=matches.filter(s=>canDiscover(s)&&s.id!==selected?.id);if(pool.length){chooseStation(pool[Math.floor(Math.random()*pool.length)]);}else if(matches.some(canDiscover)){$('library-feedback').textContent='You are already tuned to the only available station in this view. Try a broader search.';}});
document.querySelectorAll('[data-sound]').forEach(button=>button.addEventListener('click',()=>{collection='all';$('query').value=$('query').value===button.dataset.sound?'':button.dataset.sound;shown=24;markRegions();render();}));
$('more').addEventListener('click',()=>{shown+=24;render();});
function acceptDirectory(data){stations=mergeLocalStations(data.stations,localStations);mirrors=data.mirrors?.length?data.mirrors:mirrors;$('total-stations').textContent=stations.length.toLocaleString();$('total-countries').textContent=new Set(stations.map(s=>s.country).filter(Boolean)).size.toLocaleString();fillCountries();fillStates();render();$('updated').textContent='Directory updated '+new Date(data.updated).toLocaleDateString(undefined,{day:'numeric',month:'short',year:'numeric'})+'.';}
async function load(){try{const [data,local]=await Promise.all(['directory.json','edo-stations.json'].map(async url=>{const r=await fetch(url);if(!r.ok)throw new Error();return r.json();}));localStations=local;acceptDirectory(data);}catch{notice('The directory could not load. Check your connection and refresh this page.');$('count').textContent='Directory unavailable';$('grid').replaceChildren();$('grid').setAttribute('aria-busy','false');}}
$('refresh').addEventListener('click',async()=>{
  $('refresh').disabled=true;
  try{
    const hosts=await api('/json/servers');const found=[...new Set(hosts.map(h=>h.name).filter(n=>/^[a-z0-9-]+\.api\.radio-browser\.info$/.test(n)))];if(found.length)mirrors=found.map(n=>'https://'+n).sort(()=>Math.random()-.5);
    const all=[];
    for(let offset=0;offset<100000;offset+=1000){$('refresh').textContent=`Refreshing ${all.length.toLocaleString()}…`;const page=await api(`/json/stations/search?hidebroken=true&order=name&limit=1000&offset=${offset}`);all.push(...page);if(page.length<1000)break;}
    const fresh=[...new Map(all.map(s=>[s.stationuuid,{id:s.stationuuid,name:s.name.trim(),country:s.countrycode,state:s.state,tags:s.tags,language:s.language,url:s.url_resolved||s.url,home:s.homepage,logo:s.favicon||'',latitude:s.geo_lat,longitude:s.geo_long,codec:s.codec,bitrate:s.bitrate,hls:s.hls,clicks:s.clickcount}])).values()].sort((a,b)=>b.clicks-a.clicks);
    acceptDirectory({stations:fresh,updated:new Date().toISOString(),mirrors});
  }catch{notice('Could not refresh the directory. Your previous stations are still available.');}finally{$('refresh').disabled=false;$('refresh').textContent='Refresh directory';}
});
const context=document.modelContext;
if(context?.registerTool){try{Promise.resolve(context.registerTool({name:'search_radio_stations',description:'Filter the visible station directory by country code, station text and city mention.',inputSchema:{type:'object',properties:{country:{type:'string'},query:{type:'string'},city:{type:'string'}},additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:true},execute(input){if(!input||typeof input!=='object'||Object.entries(input).some(([k,v])=>!['country','query','city'].includes(k)||typeof v!=='string'))throw new Error('Expected string search fields.');if(input.country&&!stations.some(s=>s.country===input.country))throw new Error('Unknown country code.');reset();$('country').value=input.country||'';$('query').value=input.query||'';$('city').value=input.city||'';fillStates();markRegions();render();return {count:matches.length,stations:matches.slice(0,10).map(s=>({name:s.name,country:s.country,state:s.state}))};}})).catch(()=>{});}catch{/* Optional browser capability. */}}
await load();
