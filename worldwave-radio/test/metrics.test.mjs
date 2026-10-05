import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from '../server.mjs';
test('Prometheus metrics count responses without request data, health checks or scrape traffic',async()=>{
  const server=createServer({checkStation:async()=>null});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base=`http://127.0.0.1:${server.address().port}`;
  try{
    await fetch(base+'/healthz');await fetch(base+'/metrics');
    await fetch(base+'/private-unique-path?email=hidden@example.com');
    await fetch(base+'/another-unique-path');await fetch(base+'/api/stations/edo-test/check');
    await fetch(base+'/',{method:'POST'});
    const response=await fetch(base+'/metrics'),text=await response.text();
    assert.equal(response.status,200);assert.match(response.headers.get('content-type'),/version=0.0.4/);
    assert.match(text,/michaelwave_http_requests_total\{method="GET",route="other",status="404"\} 2/);
    assert.match(text,/michaelwave_http_requests_total\{method="POST",route="home",status="405"\} 1/);
    assert.match(text,/route="station_check",status="404"/);
    assert.doesNotMatch(text,/hidden@example|private-unique|edo-test|route="metrics"|route="healthz"/);
    assert.match(text,/michaelwave_http_request_duration_seconds_bucket\{method="GET",route="other",status="404",le="\+Inf"\} 2/);
    assert.match(text,/michaelwave_process_resident_memory_bytes \d+/);
    assert.match(text,/michaelwave_process_cpu_seconds_total [\d.]+/);
    assert.equal((await fetch(base+'/metrics',{method:'HEAD'})).status,200);
    assert.equal(await(await fetch(base+'/metrics',{method:'HEAD'})).text(),'');
    assert.equal((await fetch(base+'/metrics',{method:'POST'})).status,405);
  }finally{await new Promise(resolve=>server.close(resolve));}
});
