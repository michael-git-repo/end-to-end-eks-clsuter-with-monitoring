import { readFile } from 'node:fs/promises';
let failed=false;
for(const file of process.argv.slice(2)){
  const report=JSON.parse(await readFile(file,'utf8'));
  if(report.SchemaVersion!==2||(report.Results!==undefined&&!Array.isArray(report.Results)))throw new Error('Invalid scanner report: '+file);
  const findings=(report.Results||[]).flatMap(r=>[...(r.Vulnerabilities||[]),...(r.Secrets||[]),...(r.Misconfigurations||[]).filter(m=>m.Status==='FAIL')]).filter(v=>['HIGH','CRITICAL'].includes(v.Severity));
  console.log(`${file}: ${findings.length} HIGH/CRITICAL findings`);
  if(findings.length)failed=true;
}
if(process.argv.length<3)throw new Error('No scan reports supplied.');
process.exitCode=failed?1:0;
