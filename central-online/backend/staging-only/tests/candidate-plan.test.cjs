const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {createPlan,verifyPlan}=require('../release-candidate/build-plan.cjs');
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
