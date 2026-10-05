const buckets=[0.005,0.01,0.025,0.05,0.1,0.25,0.5,1,2.5,5,10,30];
function route(url){
  let path;try{path=new URL(url,'http://localhost').pathname;}catch{return 'other';}
  if(path==='/metrics'||path==='/healthz')return null;
  if(path==='/api/visitors')return 'visitors';
  if(/^\/api\/stations\/edo-[a-z0-9-]+\/check$/.test(path))return 'station_check';
  if(path==='/')return 'home';
  return 'other';
}
export function createMetrics(){
  const requests=new Map();
  return {
    track(req,res){
      const group=route(req.url);if(group===null)return;
      const method=['GET','HEAD','POST','PUT','PATCH','DELETE','OPTIONS'].includes(req.method)?req.method:'OTHER';
      const start=process.hrtime.bigint();
      res.once('finish',()=>{
        const labels=`method="${method}",route="${group}",status="${res.statusCode}"`;
        const row=requests.get(labels)||{count:0,sum:0,buckets:buckets.map(()=>0)};
        const seconds=Number(process.hrtime.bigint()-start)/1e9;
        row.count++;row.sum+=seconds;for(let i=0;i<buckets.length;i++)if(seconds<=buckets[i])row.buckets[i]++;
        requests.set(labels,row);
      });
    },
    render(){
      const lines=['# HELP michaelwave_http_requests_total Completed application HTTP requests, excluding health and metrics.','# TYPE michaelwave_http_requests_total counter'];
      for(const [labels,row] of requests)lines.push(`michaelwave_http_requests_total{${labels}} ${row.count}`);
      lines.push('# HELP michaelwave_http_request_duration_seconds Application HTTP response duration.','# TYPE michaelwave_http_request_duration_seconds histogram');
      for(const [labels,row] of requests){
        for(let i=0;i<buckets.length;i++)lines.push(`michaelwave_http_request_duration_seconds_bucket{${labels},le="${buckets[i]}"} ${row.buckets[i]}`);
        lines.push(`michaelwave_http_request_duration_seconds_bucket{${labels},le="+Inf"} ${row.count}`,`michaelwave_http_request_duration_seconds_sum{${labels}} ${row.sum}`,`michaelwave_http_request_duration_seconds_count{${labels}} ${row.count}`);
      }
      const cpu=process.cpuUsage();
      for(const [name,type,help,value] of [
        ['michaelwave_process_uptime_seconds','gauge','Node process uptime in seconds.',process.uptime()],
        ['michaelwave_process_resident_memory_bytes','gauge','Node process resident memory in bytes.',process.memoryUsage().rss],
        ['michaelwave_process_cpu_seconds_total','counter','Node process cumulative user and system CPU seconds.',(cpu.user+cpu.system)/1e6]
      ])lines.push(`# HELP ${name} ${help}`,`# TYPE ${name} ${type}`,`${name} ${value}`);
      return lines.join('\n')+'\n';
    }
  };
}
