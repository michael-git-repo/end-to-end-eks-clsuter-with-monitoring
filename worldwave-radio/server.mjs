import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, sep, extname } from 'node:path';
import { createStationChecker } from './stream-check.mjs';
import { createVisitorStore } from './visitors.mjs';
import { createMetrics } from './metrics.mjs';

const root=fileURLToPath(new URL('./dist/',import.meta.url));
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.webp':'image/webp','.png':'image/png','.jpg':'image/jpeg','.ico':'image/x-icon','.woff2':'font/woff2','.txt':'text/plain; charset=utf-8'};
export function createServer({checkStation,dataDirectory=process.env.DATA_DIR||fileURLToPath(new URL('./data/',import.meta.url))}={}){
  let checker,visitors;
  const metrics=createMetrics();
  const server=http.createServer(async(req,res)=>{
    metrics.track(req,res);
    res.setHeader('X-Content-Type-Options','nosniff');
    res.setHeader('Referrer-Policy','no-referrer');
    res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' https: data:; connect-src 'self' https://*.api.radio-browser.info; media-src https:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'");
    try{
      const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
      if(pathname==='/api/visitors'){
        if(!['GET','HEAD','POST'].includes(req.method)){res.writeHead(405,{'Allow':'GET, HEAD, POST'}).end();return;}
        res.setHeader('Cache-Control','no-store');res.setHeader('Content-Type','application/json');
        if(req.method==='POST'){
          let sameOrigin=true;
          try{if(req.headers.origin)sameOrigin=new URL(req.headers.origin).host===req.headers.host;}catch{sameOrigin=false;}
          if(!sameOrigin||req.headers['sec-fetch-site']==='cross-site'||req.headers['content-type']!=='application/json'){res.writeHead(403).end(JSON.stringify({error:'Same-origin request required'}));return;}
          if(Number(req.headers['content-length']||0)>0||req.headers['transfer-encoding']){res.writeHead(413,{'Connection':'close'}).end(JSON.stringify({error:'No request body expected'}));return;}
        }
        try{
          visitors??=createVisitorStore(dataDirectory);
          let stats;
          if(req.method==='POST'){
            const record=visitors.record(req.headers.cookie);
            res.setHeader('Set-Cookie',record.cookie+((req.socket.encrypted||req.headers['x-forwarded-proto']==='https')?'; Secure':''));stats=record.stats;
          }else stats=visitors.summary();
          res.writeHead(200).end(req.method==='HEAD'?undefined:JSON.stringify(stats));
        }catch(error){console.error('Visitor statistics unavailable:',error.code||error.name);res.writeHead(503).end(JSON.stringify({error:'Visitor statistics unavailable'}));}
        return;
      }
      if(req.method!=='GET'&&req.method!=='HEAD'){res.writeHead(405,{'Allow':'GET, HEAD'}).end();return;}
      if(pathname==='/healthz'){res.writeHead(200,{'Content-Type':'text/plain'}).end('ok');return;}
      if(pathname==='/metrics'){res.writeHead(200,{'Content-Type':'text/plain; version=0.0.4; charset=utf-8','Cache-Control':'no-store'}).end(req.method==='HEAD'?undefined:metrics.render());return;}
      const stationCheck=pathname.match(/^\/api\/stations\/(edo-[a-z0-9-]+)\/check$/);
      if(stationCheck){
        checker??=checkStation?Promise.resolve(checkStation):readFile(resolve(root,'edo-stations.json'),'utf8').then(text=>createStationChecker(JSON.parse(text)));
        const status=await (await checker)(stationCheck[1]);
        res.writeHead(status?200:404,{'Content-Type':'application/json','Cache-Control':'no-store'}).end(JSON.stringify(status||{error:'Unknown station'}));return;
      }
      const path=resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
      if(!path.startsWith(root.endsWith(sep)?root:root+sep)){res.writeHead(403).end();return;}
      const compressed=pathname==='/directory.json'&&/\bgzip\b/.test(req.headers['accept-encoding']||'');
      const data=await readFile(compressed?path+'.gz':path);
      if(compressed)res.setHeader('Content-Encoding','gzip');
      res.setHeader('Vary','Accept-Encoding');
      res.writeHead(200,{'Content-Type':types[extname(path)]||'application/octet-stream','Cache-Control':'no-cache'});
      res.end(req.method==='HEAD'?undefined:data);
    }catch{res.writeHead(404).end('Not found');}
  });
  server.on('close',()=>visitors?.close());
  return server;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const server=createServer();
  server.listen(Number(process.env.PORT)||8080,'0.0.0.0',()=>console.log('Worldwave Radio: http://localhost:'+(process.env.PORT||8080)));
  process.on('SIGTERM',()=>server.close(()=>process.exit(0)));
}
