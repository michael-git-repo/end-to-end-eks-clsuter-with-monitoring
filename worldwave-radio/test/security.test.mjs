import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
test('security gate rejects high findings and malformed reports, accepts clean scans',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'worldwave-scan-'));
  try{
    for(const [report,expected] of [
      [{SchemaVersion:2},0],
      [{SchemaVersion:2,Results:[{Vulnerabilities:[{Severity:'HIGH'}]}]},1],
      [{SchemaVersion:2,Results:[{Secrets:[{Severity:'CRITICAL'}]}]},1],
      [{SchemaVersion:2,Results:[{Misconfigurations:[{Severity:'HIGH',Status:'PASS'}]}]},0],
      [{SchemaVersion:2,Results:[{Misconfigurations:[{Severity:'HIGH',Status:'FAIL'}]}]},1],
      [{},1]
    ]){
      const file=join(dir,'report.json');await writeFile(file,JSON.stringify(report));
      const result=spawnSync(process.execPath,['scripts/security-gate.mjs',file],{encoding:'utf8'});
      assert.equal(result.status,expected,result.stderr);
    }
  }finally{await rm(dir,{recursive:true,force:true});}
});
