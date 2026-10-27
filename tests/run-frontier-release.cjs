// Sequential checkpoints: never overlap browser/solver benchmarks.
const fs=require('node:fs'),path=require('node:path'),{spawnSync,execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),out=process.argv[2]||'/tmp/mapgame-frontier-release';fs.mkdirSync(out,{recursive:true});
const steps=[
 ['inherited',['tests/run-visual-release.cjs',path.join(out,'inherited')]],
 ['frontier-browser',['tests/modern-frontier-browser.cjs',path.join(out,'frontier-browser')]],
 ['restoration-performance',['tests/economy-performance.cjs',path.join(out,'restoration-performance')],{MAP_GAME_BASELINE_REF:'9111c23'}],
 ['restoration-shop',['tests/progression-shop-performance.cjs',path.join(out,'restoration-shop')],{MAP_GAME_BASELINE_REF:'9111c23'}],
 ['memory',['tests/frontier-memory.cjs',path.join(out,'memory')]],
 ['city-comparison',['tests/frontier-city-comparison.cjs',path.join(out,'city-comparison')]],
 ['render-profile',['tests/frontier-render-profile.cjs',path.join(out,'render-profile')]],
];
const results={source:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),baseline:'9111c239971fea1a27d11756490593b5cce63b43',steps:[]};
if(process.env.FRONTIER_RESUME==='1'){
 const old=JSON.parse(fs.readFileSync(path.join(out,'results.json'),'utf8'));
 if(old.source!==results.source)throw Error('Cannot resume against a different source commit.');
 const changed=execFileSync('git',['diff','HEAD','--name-only'],{cwd:root,encoding:'utf8'}).trim().split('\n').filter(Boolean);
 if(changed.some(f=>!f.endsWith('.md')&&!f.startsWith('tests/')))throw Error('Runtime changes require a complete fresh release run.');
 results.steps=old.steps.filter(s=>s.code===0);
}
for(const [name,args,extra] of steps){if(results.steps.some(s=>s.name===name&&s.code===0)){console.log('REUSE validated unchanged source '+name);continue;}console.log('START '+name);const fd=fs.openSync(path.join(out,name+'.log'),'w'),start=Date.now();const r=spawnSync(process.execPath,args,{cwd:root,env:{...process.env,...extra},stdio:['ignore',fd,fd]});fs.closeSync(fd);results.steps.push({name,code:r.status,ms:Date.now()-start});fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(results,null,2));console.log('END '+name+' '+r.status);if(r.status!==0)process.exit(r.status||1);}
console.log('Functional checkpoint commands completed. Review timing/security gates separately: this is not backend/deployment certification or merge authorization.');
