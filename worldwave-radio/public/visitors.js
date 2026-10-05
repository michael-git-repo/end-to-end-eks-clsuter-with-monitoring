export function startVisitorCounter(){
  const $=id=>document.getElementById(id);let records=[];
  const count=value=>Number(value).toLocaleString();
  async function refresh(record=false){
    try{
      const response=await fetch('/api/visitors',{method:record?'POST':'GET',headers:record?{'Content-Type':'application/json'}:{},cache:'no-store',signal:AbortSignal.timeout(12000)});
      if(!response.ok)throw new Error();
      const stats=await response.json();
      $('visitor-count').textContent=count(stats.visitors);$('visitors-total').textContent=count(stats.visitors);
      $('visits-total').textContent=count(stats.visits);$('visitors-today').textContent=count(stats.todayVisitors);
      $('visitors-since').textContent=`Counting since ${new Date(stats.since).toLocaleDateString(undefined,{day:'numeric',month:'short',year:'numeric'})}. Daily records use UTC.`;
      records=stats.days;$('visitor-records').replaceChildren();
      for(const day of records.slice(0,7)){
        const row=document.createElement('tr');
        for(const value of [day.day,count(day.visitors),count(day.visits)]){const cell=document.createElement('td');cell.textContent=value;row.append(cell);}
        $('visitor-records').append(row);
      }
      $('download-visitors').disabled=false;
    }catch{$('visitor-count').textContent='—';$('visitors-since').textContent='Visitor statistics are temporarily unavailable.';}
  }
  $('download-visitors').addEventListener('click',()=>{
    const csv=['Date (UTC),Visitors,Visits',...records.map(day=>`${day.day},${day.visitors},${day.visits}`)].join('\r\n');
    const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));
    const link=document.createElement('a');link.href=url;link.download='michaelwave-visitor-records.csv';document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
  });
  void refresh(true);
  setInterval(()=>{if(!document.hidden)void refresh();},60000);
}
