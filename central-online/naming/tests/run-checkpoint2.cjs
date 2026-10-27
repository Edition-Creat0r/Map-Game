// Extend the checkpoint-1 disposable PostgreSQL runner, never a live Supabase URL.
const fs = require("node:fs"),
  path = require("node:path"),
  { spawnSync } = require("node:child_process");
const root = path.resolve(__dirname, "../../.."),
  out = process.argv[2] || "/tmp/mapgame041-naming";
fs.mkdirSync(out, { recursive: true });
let base = fs.readFileSync(
  path.join(root, "central-online/backend/tests/run-postgres.cjs"),
  "utf8",
);
// Reuse its pinned image, no-network container and final-server readiness checks.
const mark = '    if (r.status !== 0) throw Error("Backend tests failed");';
if (!base.includes(mark)) throw Error("Checkpoint-1 runner contract changed");
base = base.replace(
  mark,
  mark + `
for(const f of ['central-online/naming/tests/legacy-fixture.sql','central-online/naming/migrations/004_registry.sql','central-online/naming/migrations/005_legacy_guards.sql'])run('docker',['exec','-i',name,'psql','-U','postgres','-d','mapgame','-v','ON_ERROR_STOP=1'],{input:fs.readFileSync(path.join(root,f),'utf8')});
const naming=spawnSync(process.execPath,['--test','--test-concurrency=1','central-online/naming/tests/policy.test.cjs','central-online/naming/tests/naming.test.cjs','central-online/naming/tests/client.test.cjs'],{cwd:root,encoding:'utf8',env:{...process.env,CW041_TEST_CONTAINER:name}});fs.writeFileSync(path.join(out,'naming-tests.log'),naming.stdout+'\\n'+naming.stderr);console.log(naming.stdout);fs.writeFileSync(path.join(out,'naming-result.json'),JSON.stringify({mode:'Isolated PostgreSQL; synthetic legacy/auth fixtures, mocked GoTrue identities',testExit:naming.status},null,2));if(naming.status!==0)throw Error('Naming security tests failed');
// Synthetic fixture reset only: production must suspend API, never disable guards.
run('docker',['exec','-i',name,'psql','-U','postgres','-d','mapgame','-v','ON_ERROR_STOP=1'],{input:'TRUNCATE cw041_names.config;INSERT INTO cw041_names.config(singleton) VALUES(true);'});
const compatibility=spawnSync(process.execPath,['--test','--test-concurrency=1','central-online/backend/tests/backend.test.cjs'],{cwd:root,encoding:'utf8',env:{...process.env,CW041_TEST_CONTAINER:name}});fs.writeFileSync(path.join(out,'checkpoint1-after.log'),compatibility.stdout+'\\n'+compatibility.stderr);console.log(compatibility.stdout);if(compatibility.status!==0)throw Error('Checkpoint-1 post-migration compatibility failed');`,
);
// __dirname must retain the original runner's location for its root calculation.
const Module = require("node:module"),
  mod = new Module(
    path.join(root, "central-online/backend/tests/run-postgres.cjs"),
    module,
  );
mod.filename = path.join(root, "central-online/backend/tests/run-postgres.cjs");
mod.paths = module.paths;
mod._compile(base, mod.filename);
