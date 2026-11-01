// Offline source lock only: no database, network, subprocess or private baseline.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../../../..');
const sources=[
 'central-online/backend/staging-only/draft/000_staging_legacy_security.DRAFT.sql',
 ...['001_backend.sql','002_pin_rules.sql','003_legacy_coordination.sql'].map(f=>'central-online/backend/migrations/'+f),
 'central-online/backend/rollback-disable.sql','central-online/backend/supabase/config.toml',
 'central-online/backend/supabase/functions/central-economy/index.ts','central-online/backend/handler.mjs','central-online/backend/engine.mjs',
 'central-online/backend/generated/rules.mjs','central-online/backend/generated/manifest.json',
 'central-online/backend/staging-only/release-candidate/WINDOWS_ACCEPTANCE.md',
 'central-online/backend/staging-only/release-candidate/RELEASE_SCOPE.md',
 'central-online/backend/staging-only/release-candidate/build-plan.cjs',
];
function createPlan(){
 const files=Object.fromEntries(sources.map(f=>[f,crypto.createHash('sha256').update(fs.readFileSync(path.join(root,f))).digest('hex')]));
 const migrationOrder=[{step:1,name:'20261101000100_reviewed_legacy_baseline.sql',source:null,sha256:null,required:'Private reviewed baseline; never supplied by a test fixture or raw unreviewed export'},
 {step:2,name:'20261101000200_reviewed_staging_hardening.sql',source:sources[0],sha256:files[sources[0]],required:'Explicitly reviewed same-transaction wrapper with both SET LOCAL acknowledgements; record compiled wrapper hash privately'},
 ...sources.slice(1,4).map((f,i)=>({step:i+3,name:`20261101000${i+3}00_cp1_${['backend','pin_rules','legacy_coordination'][i]}.sql`,source:f,sha256:files[f]}))];
 return {formatVersion:1,baseCommit:'7f7517a8f21daf83db4893f577e14ad95fd6f1df',stagingProjectRef:'upcrdvdspypoyferpuxe',productionProjectForbidden:'vjwvhtsjdsbcorszzldk',status:'BLOCKED_PENDING_PRIVATE_SCHEMA_AND_STAGING_TESTS',spendingEnabled:false,liveEnforcementVerified:false,hardDeletionSupported:false,
 approvalsRequired:['private baseline and complete metadata review','exact baseline and hardening wrapper approval','disabled staging deployment approval','separate temporary two-account spending-test approval'],migrationOrder,files};
}
function verifyPlan(plan){return JSON.stringify(plan)===JSON.stringify(createPlan());}
module.exports={createPlan,verifyPlan};
if(require.main===module){
 try{const target=path.join(__dirname,'CANDIDATE.json');if(process.argv.length!==3||!['--write','--check'].includes(process.argv[2]))throw Error();
 if(process.argv[2]==='--write')fs.writeFileSync(target,JSON.stringify(createPlan(),null,2)+'\n');
 else if(!verifyPlan(JSON.parse(fs.readFileSync(target,'utf8'))))throw Error();
 console.log('Source lock verified/written. REVIEW REQUIRED; no baseline, deployment or spending authorized.');
 }catch(_){console.error('Candidate source lock failed. Stop; review source changes and regenerate only after tests.');process.exitCode=1;}
}
