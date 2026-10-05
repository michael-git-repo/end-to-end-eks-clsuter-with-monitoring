import {DatabaseSync} from 'node:sqlite';
import {createHash,randomUUID} from 'node:crypto';
import {mkdirSync} from 'node:fs';
import {resolve} from 'node:path';

export function createVisitorStore(directory,{now=()=>new Date()}={}){
  mkdirSync(directory,{recursive:true});
  const db=new DatabaseSync(resolve(directory,'visitors.sqlite'),{timeout:3000});
  db.exec(`PRAGMA journal_mode=WAL;
    CREATE TABLE IF NOT EXISTS visitors (token_hash TEXT PRIMARY KEY, first_seen TEXT NOT NULL, last_seen TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS daily (day TEXT PRIMARY KEY, visitors INTEGER NOT NULL, visits INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS totals (id INTEGER PRIMARY KEY CHECK(id=1), visits INTEGER NOT NULL, since TEXT NOT NULL);`);
  db.prepare('INSERT OR IGNORE INTO totals VALUES(1,0,?)').run(now().toISOString());
  function summary(){
    const today=now().toISOString().slice(0,10);
    const totals=db.prepare('SELECT visits,since FROM totals WHERE id=1').get();
    const visitors=db.prepare('SELECT COUNT(*) AS count FROM visitors').get().count;
    const daily=db.prepare('SELECT visitors,visits FROM daily WHERE day=?').get(today)||{visitors:0,visits:0};
    const cutoff=new Date(now().getTime()-29*86400000).toISOString().slice(0,10);
    const days=db.prepare('SELECT day,visitors,visits FROM daily WHERE day>=? ORDER BY day DESC').all(cutoff);
    return {...totals,visitors,todayVisitors:daily.visitors,todayVisits:daily.visits,days,timezone:'UTC'};
  }
  return {
    summary,
    record(cookie=''){
      const candidate=cookie.match(/(?:^|;\s*)mw_visitor=([a-f0-9-]{36})(?:;|$)/)?.[1];
      const valid=candidate&&/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(candidate);
      const token=valid?candidate:randomUUID(),hash=createHash('sha256').update(token).digest('hex');
      const timestamp=now().toISOString(),day=timestamp.slice(0,10);
      db.exec('BEGIN IMMEDIATE');
      try{
        const previous=db.prepare('SELECT last_seen FROM visitors WHERE token_hash=?').get(hash);
        db.prepare('INSERT INTO visitors VALUES(?,?,?) ON CONFLICT(token_hash) DO UPDATE SET last_seen=excluded.last_seen').run(hash,timestamp,timestamp);
        const uniqueToday=previous?.last_seen.slice(0,10)===day?0:1;
        db.prepare('INSERT INTO daily VALUES(?,?,1) ON CONFLICT(day) DO UPDATE SET visitors=visitors+excluded.visitors,visits=visits+1').run(day,uniqueToday);
        db.prepare('UPDATE totals SET visits=visits+1 WHERE id=1').run();
        db.exec('COMMIT');
      }catch(error){db.exec('ROLLBACK');throw error;}
      return {stats:summary(),cookie:`mw_visitor=${token}; Path=/; Max-Age=31536000; HttpOnly; SameSite=Lax`};
    },
    close(){db.close();}
  };
}
