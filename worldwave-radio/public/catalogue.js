export const regions={
  Americas:'AG AI AR AW BB BL BM BO BQ BR BS BZ CA CL CO CR CU CW DM DO EC FK GD GF GL GP GT GY HN HT JM KN KY LC MF MQ MS MX NI PA PE PM PR PY SR SV SX TC TT US UY VC VE VG VI'.split(' '),
  Europe:'AD AL AT AX BA BE BG BY CH CY CZ DE DK EE ES FI FO FR GB GG GI GR HR HU IE IM IS IT JE LI LT LU LV MC MD ME MK MT NL NO PL PT RO RS RU SE SI SJ SK SM UA VA XK'.split(' '),
  Africa:'AO BF BI BJ BW CD CF CG CI CM CV DJ DZ EG EH ER ET GA GH GM GN GQ GW KE KM LR LS LY MA MG ML MR MU MW MZ NA NE NG RE RW SC SD SH SL SN SO SS ST SZ TD TG TN TZ UG YT ZA ZM ZW'.split(' '),
  Asia:'AE AF AM AZ BD BH BN BT CN GE HK ID IL IN IQ IR JO JP KG KH KP KR KW KZ LA LB LK MM MN MO MV MY NP OM PH PK PS QA SA SG SY TH TJ TL TM TR TW UZ VN YE'.split(' '),
  Oceania:'AS AU CK FJ FM GU KI MH MP NC NF NR NU NZ PF PG PN PW SB TK TO TV UM VU WF WS'.split(' ')
};
export const normalize=value=>String(value||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
export function filterStations(stations,{region='',country='',state='',query='',city=''}={}){
  const q=normalize(query),c=normalize(city);
  return stations.filter(s=>(!region||regions[region]?.includes(s.country))&&(!country||s.country===country)&&(!state||s.state===state)&&(!q||normalize(`${s.name} ${s.frequency||''} ${s.tags} ${s.language}`).includes(q))&&(!c||normalize(`${s.city||''} ${s.name} ${s.state} ${s.tags}`).includes(c)));
}
export function mergeLocalStations(stations,localStations){
  const streamKey=value=>safeUrl(value).replace(/^https?:\/\//,'');
  const ids=new Set(localStations.map(s=>s.id));
  const streams=new Set(localStations.filter(s=>s.url).map(s=>streamKey(s.url)));
  const names=new Set(localStations.map(s=>normalize(s.name).replace(/[^a-z0-9]/g,'')));
  const remaining=stations.filter(s=>!ids.has(s.id)&&!(s.url&&streams.has(streamKey(s.url)))&&!(s.country==='NG'&&names.has(normalize(s.name).replace(/[^a-z0-9]/g,'')))).map(s=>s.country==='NG'&&/^edo(?: state)?$/i.test(s.state?.trim()||'')?{...s,state:'Edo'}:s);
  return [...localStations.map(s=>({tags:'',language:'',codec:'',bitrate:0,hls:0,clicks:0,...s})),...remaining];
}
export function safeUrl(value){try{const u=new URL(value);return ['https:','http:'].includes(u.protocol)?u.href:'';}catch{return '';}}
export function stationLogo(station){
  if(typeof station.logo!=='string')return '';
  if(/^logos\/[a-z0-9-]+\.(png|webp|jpg)$/.test(station.logo))return station.logo;
  const url=safeUrl(station.logo);return url.startsWith('https://')?url:'';
}
