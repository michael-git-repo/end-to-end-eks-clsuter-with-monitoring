const key='michaelwave-library-v1';
const clean=(values,limit)=>Array.isArray(values)?[...new Set(values.filter(id=>typeof id==='string'&&id.length>0&&id.length<200))].slice(0,limit):[];

// Keep station IDs only: stream URLs and directory metadata stay in the catalogue.
export function createLibrary(storage){
  let saved=[],recent=[],persistent=!!storage;
  try{const data=JSON.parse(storage?.getItem(key)||'{}');saved=clean(data?.saved,500);recent=clean(data?.recent,20);}catch{/* Ignore damaged or unavailable browser storage. */}
  function persist(){try{if(!storage)throw new Error();storage.setItem(key,JSON.stringify({saved,recent}));persistent=true;}catch{persistent=false;}}
  return {
    has:id=>saved.includes(id),
    snapshot:()=>({saved:[...saved],recent:[...recent],persistent}),
    toggle(id){if(typeof id!=='string'||!id||id.length>=200)return; saved=saved.includes(id)?saved.filter(value=>value!==id):[id,...saved].slice(0,500);persist();},
    played(id){if(typeof id!=='string'||!id||id.length>=200)return;recent=[id,...recent.filter(value=>value!==id)].slice(0,20);persist();},
    clearRecent(){recent=[];persist();},
    filter(stations,view){if(view==='saved')return stations.filter(s=>saved.includes(s.id));if(view==='recent'){const rank=new Map(recent.map((id,index)=>[id,index]));return stations.filter(s=>rank.has(s.id)).sort((a,b)=>rank.get(a.id)-rank.get(b.id));}return stations;}
  };
}
