// Offline source lock only: no database, network, subprocess or private baseline.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../../../..');
const approvedFile=path.join(__dirname,'CANDIDATE.json');
const approvedMetadataHash='1b8a1b533d7d0ebd4a096945f07751f4061d6903e961657b308562a0945b7099';
const digest=value=>crypto.createHash('sha256').update(value).digest('hex');
function approvedMetadata(){
 const plan=JSON.parse(fs.readFileSync(approvedFile,'utf8'));
 // Metadata content stays immutable; harmless JSON file line endings do not
 // change approval. Every protected source hash remains an exact byte hash.
 if(digest(JSON.stringify(plan))!==approvedMetadataHash)throw Error('Approved RC1 metadata changed');
 return plan;
}
function verifyApprovedCandidate(){
 try{return Object.entries(approvedMetadata().files).every(([f,hash])=>digest(fs.readFileSync(path.join(root,f)))===hash);}catch(_){return false;}
}
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
 approvedMetadata();
 const files=Object.fromEntries(sources.map(f=>[f,crypto.createHash('sha256').update(fs.readFileSync(path.join(root,f))).digest('hex')]));
 const migrationOrder=[{step:1,name:'20261101000100_reviewed_legacy_baseline.sql',source:null,sha256:null,required:'Private reviewed baseline; never supplied by a test fixture or raw unreviewed export'},
 {step:2,name:'20261101000200_reviewed_staging_hardening.sql',source:sources[0],sha256:files[sources[0]],required:'Explicitly reviewed same-transaction wrapper with both SET LOCAL acknowledgements; record compiled wrapper hash privately'},
 ...sources.slice(1,4).map((f,i)=>({step:i+3,name:`20261101000${i+3}00_cp1_${['backend','pin_rules','legacy_coordination'][i]}.sql`,source:f,sha256:files[f]}))];
 return {formatVersion:2,candidateId:'RC2',baseCommit:'5f742f2008d87276f76b3d8fde0f31580b2abcc4',supersedes:{candidateId:'RC1',manifest:'CANDIDATE.json',metadataSha256:approvedMetadataHash,sourceCommit:'5f742f2008d87276f76b3d8fde0f31580b2abcc4',status:'INVALID_FOR_CURRENT_SOURCES_APPROVAL_NOT_TRANSFERRED'},stagingProjectRef:'upcrdvdspypoyferpuxe',productionProjectForbidden:'vjwvhtsjdsbcorszzldk',status:'BLOCKED_PENDING_PRIVATE_SCHEMA_AND_STAGING_TESTS',spendingEnabled:false,liveEnforcementVerified:false,hardDeletionSupported:false,
 approvalsRequired:['fresh RC2 protected-source review; RC1 approval does not transfer','private baseline and complete metadata review','exact baseline and hardening wrapper approval','disabled staging deployment approval','separate temporary two-account spending-test approval'],migrationOrder,files};
}
function verifyPlan(plan){try{return JSON.stringify(plan)===JSON.stringify(createPlan());}catch(_){return false;}}
module.exports={createPlan,verifyPlan,verifyApprovedCandidate,approvedMetadata};
if(require.main===module){
 try{
  const args=process.argv.slice(2);
  if(args.length===1&&args[0]==='--check'){
   if(!verifyApprovedCandidate())throw Error('Approved RC1 no longer matches current protected sources');
   console.log('Approved RC1 source lock matches. Deployment gates still apply.');
  }else if(args.length===3&&args[0]==='--candidate'&&args[1]==='RC2'&&['--write','--check'].includes(args[2])){
   const target=path.join(__dirname,'CANDIDATE-RC2.json');
   if(args[2]==='--write')fs.writeFileSync(target,JSON.stringify(createPlan(),null,2)+'\n',{flag:'wx'});
   else if(!verifyPlan(JSON.parse(fs.readFileSync(target,'utf8'))))throw Error('RC2 source drift');
   console.log('RC2 proposal verified/written. NEW APPROVAL REQUIRED; RC1 metadata was not changed.');
  }else throw Error('Explicit RC2 selection required; approved manifests cannot be overwritten');
 }catch(_){console.error('Candidate verification stopped. RC1 may be invalid for current sources; select RC2 explicitly and obtain fresh approval. No approved manifest was overwritten.');process.exitCode=1;}
}
