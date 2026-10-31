// Run with installed PowerShell 7, or set PWSH_BIN. Synthetic text only.
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto'),{spawnSync}=require('node:child_process');
const pwsh=process.env.PWSH_BIN||'pwsh',script=path.resolve(__dirname,'../tools/Review-LocalSchema.ps1');
const available=spawnSync(pwsh,['-NoProfile','-NonInteractive','-Command',"$PSVersionTable.PSVersion -ge [version]'7.2'"],{encoding:'utf8'}).stdout?.trim()==='True';
const fake='SYNTHETIC_ONLY_DO_NOT_ECHO_8c729d';
const baseline=fs.readFileSync(path.join(__dirname,'legacy-model.fixture.sql'),'utf8');
function scan(source,options={}){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'mapgame-private-schema-'));
 try{
 const input=path.join(dir,'map-game-original-schema.sql'),output=options.output||path.join(dir,'reports');
 fs.writeFileSync(input,source);const original=crypto.createHash('sha256').update(source).digest('hex');
 const before=fs.readFileSync(input);
 const r=spawnSync(pwsh,['-NoProfile','-NonInteractive','-File',script,'-SchemaPath',input,'-ReportDirectory',output],{encoding:'utf8',timeout:30000});
 assert.equal(Buffer.compare(before,fs.readFileSync(input)),0,'source must remain byte-identical');
 const runs=fs.existsSync(output)?fs.readdirSync(output).filter(x=>x.startsWith('review-')):[];
 let data,report='';if(runs.length){const rd=path.join(output,runs[0]);report=fs.readFileSync(path.join(rd,'security-review.json'),'utf8')+fs.readFileSync(path.join(rd,'security-review.md'),'utf8');data=JSON.parse(fs.readFileSync(path.join(rd,'security-review.json'),'utf8'));assert.equal(data.sha256,original);}
 const text=(r.stdout||'')+(r.stderr||'')+report;
 assert.equal(text.includes(fake),false,'sensitive canary must never appear in diagnostics/report');
 assert.equal(text.includes(input),false,'input path must not be copied');
 return {status:r.status,data,text,runs};
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
}
const opts={skip:!available};
test('private synthetic export emits review-only sanitized reports, fixed order, immutable input',opts,()=>{
 const r=scan(baseline);assert.equal(r.status,2);assert.equal(r.data.status,'REVIEW_REQUIRED');assert.equal(r.data.deploymentApproved,false);assert.equal(r.runs.length,1);
 assert.equal(r.data.expectedMigrationOrder.length,5);
 assert.ok(r.data.findings.some(x=>x.code==='SESSION_OWNER_REASSIGNMENT'));
 assert.ok(r.data.findings.some(x=>x.code==='CONSTRAINTS_PENDING'));
});
test('embedded credentials in literals/comments/function bodies never leak',opts,()=>{
 const r=scan(baseline+`\n-- postgresql://private:${fake}@localhost/db\nCREATE FUNCTION public.private_hidden() RETURNS text LANGUAGE sql AS $body$ SELECT '${fake}' $body$;\n`);
 assert.equal(r.status,2);assert.ok(r.data.findings.some(x=>x.code==='SENSITIVE_PATTERN'));
});
test('comments and dollar-quoted body DDL cannot fake required outer constraints',opts,()=>{
 const r=scan(`/* nested /* PRIMARY KEY(session_id) */ safe */\n-- CREATE TABLE public.worlds(id text);\nCREATE FUNCTION public.hidden() RETURNS text LANGUAGE sql AS $body$ SELECT 'CREATE TABLE public.world_sessions(session_id uuid PRIMARY KEY);'; $body$;`);
 assert.equal(r.status,2);assert.ok(r.data.findings.some(x=>x.code==='TABLE_world_sessions'));
 assert.ok(r.data.findings.some(x=>x.code==='PK_world_sessions'));
});
test('quoted pg_dump identifiers, comments, bodies and psql directives have safe line locations',opts,()=>{
 const r=scan('\\restrict abc\n-- private\nCREATE TABLE "public"."world_sessions" ("session_id" uuid, PRIMARY KEY ("session_id"));\nALTER TABLE "public"."world_sessions" ENABLE ROW LEVEL SECURITY;\n\\unrestrict abc\n');
 assert.equal(r.status,2);assert.equal(r.data.findings.some(x=>x.code==='TABLE_world_sessions'),false);
 assert.equal(r.data.findings.some(x=>x.code==='PK_world_sessions'),false);
 assert.equal(r.data.findings.filter(x=>x.code==='PSQL_DIRECTIVE').length,2);
});
test('truncated literals, comments and incomplete statements fail with sanitized errors',opts,()=>{
 for(const source of [`CREATE TABLE public.${fake} (`, `SELECT '${fake}`, `/*${fake}`,`CREATE FUNCTION public.x() RETURNS text AS $x$ ${fake}`]){
  const r=scan(source);assert.equal(r.status,1);assert.equal(r.runs.length,0);
 }
});
test('unknown trigger, role grants, views and non-postgres owners stay blocked',opts,()=>{
 const r=scan(`CREATE VIEW public.hidden AS SELECT 1; GRANT private_role TO authenticated; ALTER FUNCTION public.hidden() OWNER TO private_role; CREATE TRIGGER hidden BEFORE UPDATE ON public.world_sessions EXECUTE FUNCTION public.hidden();`);
 assert.equal(r.status,2);for(const code of ['VIEW_RULE_REVIEW','ROLE_MEMBERSHIP','OWNER_REVIEW','TRIGGER_REVIEW'])assert.ok(r.data.findings.some(x=>x.code===code));
});
test('repository output is refused without writing report files',opts,()=>{
 const target=path.join(path.resolve(__dirname,'../../../..'),'DO_NOT_CREATE_PRIVATE_REPORTS');
 assert.equal(fs.existsSync(target),false);const r=scan(baseline,{output:target});assert.equal(r.status,1);assert.equal(fs.existsSync(target),false);
});
test('symlink into repository cannot bypass output protection',opts,()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'mapgame-report-link-'));
 try{const link=path.join(dir,'alias');fs.symlinkSync(path.resolve(__dirname,'../../../..'),link,process.platform==='win32'?'junction':'dir');
 const r=scan(baseline,{output:path.join(link,'DO_NOT_CREATE_PRIVATE_REPORTS')});assert.equal(r.status,1);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});

test('missing and unvalidated structural contracts are reported without fake comment evidence',opts,()=>{
 const source=`CREATE TABLE public.world_sessions(session_id uuid, user_id uuid, last_seen timestamptz);\nALTER TABLE public.world_sessions ADD FOREIGN KEY(user_id) REFERENCES auth.users(id) NOT VALID;\n-- NOT NULL PRIMARY KEY(session_id)\nCREATE UNIQUE INDEX partial_owner ON public.territory_claims(owner_id) WHERE world_id='central';`;
 const r=scan(source);assert.equal(r.status,2);
 for(const code of ['NOT_NULL_world_sessions_user_id','FK_world_sessions_user_id','OWNER_UNIQUENESS','SIGNATURE_COUNT_map_game_start_session'])assert.ok(r.data.findings.some(x=>x.code===code));
});
test('input inside a Git checkout is refused and original file remains untouched',opts,()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'mapgame-private-git-'));
 try{fs.mkdirSync(path.join(dir,'.git'));fs.writeFileSync(path.join(dir,'.git','HEAD'),'ref: refs/heads/synthetic\n');
 const file=path.join(dir,'map-game-original-schema.sql');fs.writeFileSync(file,baseline);
 const r=spawnSync(pwsh,['-NoProfile','-NonInteractive','-File',script,'-SchemaPath',file,'-ReportDirectory',path.join(dir,'reports')],{encoding:'utf8'});
 assert.equal(r.status,1);assert.equal(fs.readFileSync(file,'utf8'),baseline);assert.equal(fs.existsSync(path.join(dir,'reports')),false);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});

// Only the supplied CREATE headers/line numbers are copied from the user's
// report. All column definitions here are hand-authored synthetic fixtures.
const exactCreateHeaders=[['capitals',212,'world_id text NOT NULL, owner_id uuid NOT NULL, territory_id text NOT NULL, x double precision NOT NULL, z double precision NOT NULL, PRIMARY KEY(world_id,owner_id)'],['territory_claims',228,'world_id text NOT NULL, territory_id text NOT NULL, owner_id uuid NOT NULL, PRIMARY KEY(world_id,territory_id)'],['world_members',240,'world_id text NOT NULL, user_id uuid NOT NULL, PRIMARY KEY(world_id,user_id)'],['world_sessions',252,'world_id text NOT NULL, session_id uuid NOT NULL, user_id uuid NOT NULL, created_at timestamp(6) with time zone DEFAULT now() NOT NULL, last_seen timestamp with time zone DEFAULT now() NOT NULL, conflicted boolean DEFAULT false NOT NULL, PRIMARY KEY(session_id)'],['worlds',267,'id text NOT NULL, PRIMARY KEY(id)']];
function suppliedHeaders(){const lines=Array(270).fill('');for(const [table,line,columns] of exactCreateHeaders){lines[line-1]=`CREATE TABLE IF NOT EXISTS "public"."${table}" (`;lines[line]=columns;lines[line+1]=');';}return lines.join('\n');}
test('recognizes all five exact quoted IF NOT EXISTS CREATE headers and their constraints',opts,()=>{
 const r=scan(suppliedHeaders());assert.equal(r.status,2);
 for(const [table] of exactCreateHeaders){assert.equal(r.data.findings.some(x=>x.code==='TABLE_'+table),false);assert.equal(r.data.findings.some(x=>x.code==='PK_'+table),false);assert.equal(r.data.findings.some(x=>x.code.startsWith('NOT_NULL_'+table+'_')),false);}
 assert.equal(r.data.deploymentApproved,false);assert.ok(r.data.findings.some(x=>x.code==='CONSTRAINTS_PENDING'));
});
test('NOT NULL distinguishes real column modifiers from nested expressions and string contents',opts,()=>{
 const r=scan(`CREATE TABLE IF NOT EXISTS "public"."world_sessions" (
 world_id text DEFAULT concat('a', 'b') NOT NULL,
 session_id uuid NOT NULL,
 user_id uuid CHECK(user_id IS NOT NULL),
 created_at timestamp(6) with time zone DEFAULT now() NOT NULL,
 last_seen timestamp with time zone DEFAULT coalesce(now(), now()) NOT NULL,
 conflicted boolean DEFAULT false NOT NULL,
 label text DEFAULT 'NOT NULL'
);`);
 assert.equal(r.status,2);
 for(const col of ['world_id','session_id','created_at','last_seen','conflicted'])assert.equal(r.data.findings.some(x=>x.code==='NOT_NULL_world_sessions_'+col),false);
 assert.ok(r.data.findings.some(x=>x.code==='NOT_NULL_world_sessions_user_id'));
});
test('conditional table CREATE recognizes inline foreign keys without clearing global review gates',opts,()=>{
 const r=scan('CREATE TABLE IF NOT EXISTS "public"."world_members" (world_id text NOT NULL,user_id uuid NOT NULL,FOREIGN KEY(world_id) REFERENCES "public"."worlds"(id),FOREIGN KEY(user_id) REFERENCES "auth"."users"(id));');
 assert.equal(r.status,2);for(const col of ['world_id','user_id'])assert.equal(r.data.findings.some(x=>x.code==='FK_world_members_'+col),false);
 assert.ok(r.data.findings.some(x=>x.code==='OWNERS_ACLS_PENDING'));
});
test('quoted identifier case and lookalikes cannot masquerade as the five public tables',opts,()=>{
 const r=scan('CREATE TABLE IF NOT EXISTS "PUBLIC"."world_sessions" (session_id uuid NOT NULL); CREATE TABLE IF NOT EXISTS "publіc"."worlds" (id text NOT NULL);');
 assert.equal(r.status,2);assert.ok(r.data.findings.some(x=>x.code==='TABLE_world_sessions'));assert.ok(r.data.findings.some(x=>x.code==='TABLE_worlds'));
});
test('duplicate conditional definitions and later constraint drops retain fail-closed warnings',opts,()=>{
 const r=scan('CREATE TABLE IF NOT EXISTS "public"."world_sessions" (user_id uuid NOT NULL); CREATE TABLE IF NOT EXISTS "public"."world_sessions" (user_id uuid NOT NULL); ALTER TABLE ONLY "public"."world_sessions" ALTER COLUMN "user_id" DROP NOT NULL;');
 assert.equal(r.status,2);assert.ok(r.data.findings.some(x=>x.code==='TABLE_world_sessions'));assert.ok(r.data.findings.some(x=>x.code==='NOT_NULL_world_sessions_user_id'));
});

test('IS NOT NULL defaults and CHECK expressions cannot supply an explicit column constraint',opts,()=>{
 const r=scan(`CREATE TABLE IF NOT EXISTS "public"."world_sessions" (
 world_id text DEFAULT 'NOT NULL',
 session_id uuid CHECK (session_id IS NOT NULL),
 user_id uuid,
 created_at timestamp with time zone,
 last_seen timestamp with time zone,
 conflicted boolean DEFAULT current_user IS NOT NULL
);`);
 assert.equal(r.status,2);for(const col of ['world_id','session_id','user_id','created_at','last_seen','conflicted'])assert.ok(r.data.findings.some(x=>x.code==='NOT_NULL_world_sessions_'+col));
});
test('unqualified conditional names and duplicate column definitions remain unresolved',opts,()=>{
 const r=scan('SET search_path=public; CREATE TABLE IF NOT EXISTS worlds(id text NOT NULL); CREATE TABLE IF NOT EXISTS "public"."world_sessions" (user_id uuid NOT NULL,user_id uuid NOT NULL);');
 assert.equal(r.status,2);assert.ok(r.data.findings.some(x=>x.code==='TABLE_worlds'));assert.ok(r.data.findings.some(x=>x.code==='NOT_NULL_world_sessions_user_id'));
});
test('explicit quoted ALTER SET NOT NULL still supplies evidence after conditional CREATE',opts,()=>{
 const r=scan('CREATE TABLE IF NOT EXISTS "public"."world_sessions" (user_id uuid); ALTER TABLE ONLY "public"."world_sessions" ALTER COLUMN "user_id" SET NOT NULL;');
 assert.equal(r.status,2);assert.equal(r.data.findings.some(x=>x.code==='NOT_NULL_world_sessions_user_id'),false);assert.ok(r.data.findings.some(x=>x.code==='CONSTRAINTS_PENDING'));
});
