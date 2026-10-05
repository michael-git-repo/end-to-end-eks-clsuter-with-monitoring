export function coordinates(latitude,longitude){
  if(latitude===null||longitude===null||latitude===undefined||longitude===undefined||String(latitude).trim()===''||String(longitude).trim()==='')return null;
  const lat=Number(latitude),lon=Number(longitude);
  return Number.isFinite(lat)&&Number.isFinite(lon)&&Math.abs(lat)<=90&&Math.abs(lon)<=180?[lon,lat]:null;
}
export function locateStation(station,countries=[]){
  const point=coordinates(station.latitude??station.geo_lat,station.longitude??station.geo_long);
  if(point)return {point,precision:'Station coordinates',label:[station.city,station.state].filter(Boolean).join(' · ')||'Published station location'};
  if(station.local&&station.country==='NG'&&station.city==='Benin City')return {point:[5.63,6.34],precision:'Approximate city centre',label:'Benin City · Edo · Nigeria'};
  const country=countries.find(c=>c.properties.code===station.country)?.properties;
  const centre=country&&coordinates(country.latitude,country.longitude);
  return centre?{point:centre,precision:'Approximate country location',label:country.name}:null;
}
export const globeScale={min:125,base:155,station:180,max:255};
const countryNames=new Intl.DisplayNames(['en'],{type:'region',fallback:'none'});
export function countryFlag(value,availableCodes){
  if(typeof value!=='string')return null;
  let code=value.trim().toUpperCase();if(code==='UK')code='GB';
  if(!/^[A-Z]{2}$/.test(code)||!availableCodes.has(code))return null;
  const name=countryNames.of(code);return name?{code,name,path:`flags/${code.toLowerCase()}.svg`}:null;
}
export const clampScale=value=>Math.max(globeScale.min,Math.min(globeScale.max,value));
export function rotateGlobe(rotation,dx,dy){
  return [((rotation[0]+dx+180)%360+360)%360-180,Math.max(-85,Math.min(85,rotation[1]-dy)),0];
}
export function flightFrame(start,point,progress,{spin=true}={}){
  const t=Math.max(0,Math.min(1,progress)),turn=spin?Math.min(t/.65,1):t,zoom=spin?Math.max(0,(t-.65)/.35):t;
  const ease=x=>x*x*(3-2*x);
  const destination=-point[0],delta=((destination-start.rotation[0]+540)%360+360)%360-180;
  return {rotation:[start.rotation[0]+(delta+(spin?360:0))*ease(turn),start.rotation[1]+(-point[1]-start.rotation[1])*ease(turn),0],scale:spin?(t<.65?start.scale+(globeScale.base-start.scale)*ease(turn):globeScale.base+(globeScale.station-globeScale.base)*ease(zoom)):start.scale+(globeScale.station-start.scale)*ease(zoom)};
}
