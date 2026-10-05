import { cp, mkdir, access, readFile, writeFile, readdir } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { mergeLocalStations } from '../public/catalogue.js';
await access('public/directory.json');
await mkdir('dist',{recursive:true});
await cp('public','dist',{recursive:true});
await mkdir('dist/vendor',{recursive:true});
for(const name of ['d3-array','d3-geo']){
  await cp(`node_modules/${name}/dist/${name}.min.js`,`dist/vendor/${name}.min.js`);
  await cp(`node_modules/${name}/LICENSE`,`dist/vendor/${name}-LICENSE.txt`);
}
await cp('node_modules/internmap/LICENSE','dist/vendor/internmap-LICENSE.txt');
await cp('node_modules/flag-icons/flags/4x3','dist/flags',{recursive:true});
await cp('node_modules/flag-icons/LICENSE','dist/flags/LICENSE.txt');
const flagCodes=(await readdir('dist/flags')).filter(name=>/^[a-z]{2}\.svg$/.test(name)).map(name=>name.slice(0,2).toUpperCase());
await writeFile('dist/flag-codes.js',`export const flagCodes=new Set(${JSON.stringify(flagCodes)});\n`);
// A fresh HTML load must not reuse an older player module from an embedded browser cache.
const assetNames=['app.js','playback.js','catalogue.js','globe.js','globe-state.js','visitors.js','library.js','style.css'];
const assets=await Promise.all(assetNames.map(name=>readFile(`public/${name}`,'utf8')));
const version=createHash('sha256').update(assets.join('\n')).digest('hex').slice(0,12);
let html=await readFile('public/index.html','utf8');
html=html.replace('src="app.js"',`src="app.js?v=${version}"`).replace('href="style.css"',`href="style.css?v=${version}"`);
await writeFile('dist/index.html',html);
for(let index=0;index<assetNames.length;index++){
  if(!assetNames[index].endsWith('.js'))continue;
  const code=assets[index].replace(/from '(\.\/[^']+\.js)'/g,(_,path)=>`from '${path}?v=${version}'`);
  await writeFile(`dist/${assetNames[index]}`,code);
}
const directory=JSON.parse(await readFile('public/directory.json','utf8'));
directory.stations=mergeLocalStations(directory.stations,JSON.parse(await readFile('public/edo-stations.json','utf8')));
const output=JSON.stringify(directory);
await writeFile('dist/directory.json',output);
await writeFile('dist/directory.json.gz',gzipSync(output));
console.log('Built Worldwave Radio into dist/');
