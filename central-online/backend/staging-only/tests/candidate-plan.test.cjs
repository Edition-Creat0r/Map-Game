const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {createPlan,verifyPlan,verifyApprovedCandidate,approvedMetadata}=require('../release-candidate/build-plan.cjs');
const crypto=require('node:crypto'),{spawnSync}=require('node:child_process');
test('candidate has exact five-step order, requires private baseline and remains blocked/OFF',()=>{
 const p=createPlan();assert.equal(p.migrationOrder.length,5);assert.equal(p.migrationOrder[0].source,null);assert.equal(p.migrationOrder[0].sha256,null);assert.equal(p.spendingEnabled,false);assert.equal(p.liveEnforcementVerified,false);assert.equal(p.hardDeletionSupported,false);
 assert.deepEqual(p.migrationOrder.slice(1).map(x=>path.basename(x.source)),['000_staging_legacy_security.DRAFT.sql','001_backend.sql','002_pin_rules.sql','003_legacy_coordination.sql']);
 assert.equal(new Set(p.migrationOrder.map(x=>x.name)).size,5);assert.equal(p.stagingProjectRef,'upcrdvdspypoyferpuxe');assert.ok(p.approvalsRequired.some(x=>x.includes('temporary')));
 assert.equal(p.migrationOrder.some(x=>/bootstrap|fixture|004_|005_/.test(x.source||'')),false);
});
test('candidate lock rejects modified hashes, reordered migrations and approval/status changes',()=>{
 const p=createPlan();assert.equal(verifyPlan(p),true);
 for(const mutate of [x=>{x.files[Object.keys(x.files)[0]]='0'.repeat(64)},x=>{x.migrationOrder.reverse()},x=>{x.spendingEnabled=true},x=>{x.stagingProjectRef='vjwvhtsjdsbcorszzldk'}]){const altered=JSON.parse(JSON.stringify(p));mutate(altered);assert.equal(verifyPlan(altered),false);}
});
test('Edge entry is staging-target bound and JWT verification stays enabled',()=>{
 const root=path.resolve(__dirname,'../../../..'),entry=fs.readFileSync(path.join(root,'central-online/backend/supabase/functions/central-economy/index.ts'),'utf8');
 assert.ok(entry.includes('url !== "https://upcrdvdspypoyferpuxe.supabase.co"'));assert.ok(entry.includes('Staging project mismatch'));
 assert.match(fs.readFileSync(path.join(root,'central-online/backend/supabase/config.toml'),'utf8'),/verify_jwt\s*=\s*true/);
});

test('RC1 approved metadata is preserved and correctly fails against changed protected sources',()=>{
 const original=approvedMetadata();assert.equal(original.formatVersion,1);assert.equal(original.baseCommit,'7f7517a8f21daf83db4893f577e14ad95fd6f1df');assert.equal(verifyApprovedCandidate(),false);
 const rc2=createPlan();assert.equal(rc2.formatVersion,2);assert.equal(rc2.candidateId,'RC2');assert.equal(rc2.baseCommit,'5f742f2008d87276f76b3d8fde0f31580b2abcc4');assert.ok(rc2.approvalsRequired.some(x=>x.includes('fresh RC2')));assert.equal(verifyPlan(original),false);
});
test('legacy implicit --write is rejected without overwriting approved metadata',()=>{
 const tool=path.resolve(__dirname,'../release-candidate/build-plan.cjs'),original=path.join(path.dirname(tool),'CANDIDATE.json');
 const hash=()=>crypto.createHash('sha256').update(fs.readFileSync(original)).digest('hex');const before=hash();
 const r=spawnSync(process.execPath,[tool,'--write'],{encoding:'utf8'});assert.equal(r.status,1);assert.equal(hash(),before);
});

test('explicit RC2 check succeeds, old approval check fails, and RC2 proposal cannot be overwritten',()=>{
 const tool=path.resolve(__dirname,'../release-candidate/build-plan.cjs');
 const paths=['CANDIDATE.json','CANDIDATE-RC2.json'].map(f=>path.join(path.dirname(tool),f));
 const hashes=()=>paths.map(p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex'));
 const before=hashes();
 for(const [args,status] of [[['--check'],1],[['--candidate','RC2','--check'],0],[['--candidate','RC2','--write'],1]])assert.equal(spawnSync(process.execPath,[tool,...args],{encoding:'utf8'}).status,status);
 assert.deepEqual(hashes(),before);
});
