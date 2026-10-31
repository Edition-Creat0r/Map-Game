// Synthetic baseline only, before hardening and before economy migrations.
const {test,beforeEach}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {query,reset}=require('./helpers.cjs');
beforeEach(reset);
const draft=fs.readFileSync(path.join(__dirname,'../draft/000_staging_legacy_security.DRAFT.sql'),'utf8');
const approved="SET LOCAL mapgame.reviewed_staging_project='upcrdvdspypoyferpuxe';SET LOCAL mapgame.legacy_schema_reviewed='yes';";
async function refuses(change,error){
 await assert.rejects(query('BEGIN;'+change+approved+draft+'ROLLBACK;'),error);
 assert.equal(await query("SELECT to_regnamespace('cw041_staging_security') IS NULL"),'t');
 assert.equal(await query("SELECT has_table_privilege('authenticated','public.world_sessions','INSERT')"),'t');
}
for(const [name,change,error] of [
 ['session primary key', 'ALTER TABLE public.world_sessions DROP CONSTRAINT world_sessions_pkey;',/required primary key/],
 ['member primary key', 'ALTER TABLE public.world_members DROP CONSTRAINT world_members_pkey;',/required primary key/],
 ['nullable owner','ALTER TABLE public.world_sessions ALTER COLUMN user_id DROP NOT NULL;',/required NOT NULL/],
 ['nullable expiry','ALTER TABLE public.world_sessions ALTER COLUMN last_seen DROP NOT NULL;',/required NOT NULL/],
 ['session auth foreign key','ALTER TABLE public.world_sessions DROP CONSTRAINT world_sessions_user_id_fkey;',/required foreign key/],
 ['capital claim foreign key','ALTER TABLE public.capitals DROP CONSTRAINT capitals_world_id_territory_id_fkey;',/required foreign key/],
 ['unvalidated foreign key','ALTER TABLE public.world_sessions DROP CONSTRAINT world_sessions_user_id_fkey;ALTER TABLE public.world_sessions ADD FOREIGN KEY(user_id) REFERENCES auth.users(id) NOT VALID;',/required foreign key/],
 ['unreviewed delete action','ALTER TABLE public.world_sessions DROP CONSTRAINT world_sessions_user_id_fkey;ALTER TABLE public.world_sessions ADD FOREIGN KEY(user_id) REFERENCES auth.users(id) ON DELETE RESTRICT;',/required foreign key/],
 ['capital NO ACTION instead of confirmed RESTRICT','ALTER TABLE public.capitals DROP CONSTRAINT capitals_world_id_territory_id_fkey;ALTER TABLE public.capitals ADD FOREIGN KEY(world_id,territory_id) REFERENCES public.territory_claims(world_id,territory_id) ON DELETE NO ACTION;',/required foreign key/],
 ['preexisting capital owner mismatch',"INSERT INTO public.territory_claims(world_id,territory_id,owner_id,owner_username) VALUES('central','T_190_27','11111111-1111-4111-8111-111111111111','Synthetic');INSERT INTO public.capitals(world_id,owner_id,owner_username,territory_id,name,x,z) VALUES('central','22222222-2222-4222-8222-222222222222','Synthetic','T_190_27','Test city',500,500);",/capital and claim ownership mismatch/],
 ['owner uniqueness','DROP INDEX public.territory_claims_one_per_owner;',/one-claim-per-owner/],
 ['partial uniqueness','DROP INDEX public.territory_claims_one_per_owner;CREATE UNIQUE INDEX owner_partial ON public.territory_claims(owner_id) WHERE world_id=\'central\';',/one-claim-per-owner/],
 ['function owner','ALTER FUNCTION public.map_game_start_session(text,uuid,text) OWNER TO authenticated;',/function owners/],
 ['function argument defaults',"ALTER FUNCTION public.map_game_start_session(text,uuid,text) RENAME TO old_start;CREATE FUNCTION public.map_game_start_session(text,uuid,text DEFAULT 'x') RETURNS boolean LANGUAGE sql AS 'SELECT true';DROP FUNCTION public.old_start(text,uuid,text);",/function owners/],
 ['inherited elevated role','GRANT service_role TO authenticated;',/elevated role/],
 ['inherited write grant','CREATE ROLE synthetic_writer NOLOGIN;GRANT synthetic_writer TO authenticated;GRANT UPDATE(last_seen) ON public.world_sessions TO synthetic_writer;',/inherited legacy column/],
 ['inherited claim truncate','CREATE ROLE synthetic_truncator NOLOGIN;GRANT synthetic_truncator TO authenticated;GRANT TRUNCATE ON public.territory_claims TO synthetic_truncator;',/inherited legacy table/],
 ['additional definer RPC',"CREATE FUNCTION public.synthetic_forge() RETURNS void LANGUAGE sql SECURITY DEFINER AS 'UPDATE public.world_sessions SET conflicted=false';GRANT EXECUTE ON FUNCTION public.synthetic_forge() TO authenticated;",/additional public SECURITY DEFINER/],
 ['unknown trigger',"CREATE FUNCTION public.synthetic_hook() RETURNS trigger LANGUAGE plpgsql AS 'BEGIN RETURN NEW; END';CREATE TRIGGER z_synthetic BEFORE UPDATE ON public.world_sessions FOR EACH ROW EXECUTE FUNCTION public.synthetic_hook();",/preexisting legacy triggers/],
]) test('draft fails atomically on '+name,()=>refuses(change,error));
test('baseline retains required identities and actor uniqueness behavior',async()=>{
 await assert.rejects(query("BEGIN;INSERT INTO public.world_sessions(world_id,session_id,user_id) VALUES('central','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','99999999-9999-4999-8999-999999999999');ROLLBACK;"),/foreign key/);
 await assert.rejects(query("BEGIN;INSERT INTO public.territory_claims(world_id,territory_id,owner_id,owner_username) VALUES('central','T_1_1','11111111-1111-4111-8111-111111111111','Synthetic'),('central','T_2_2','11111111-1111-4111-8111-111111111111','Synthetic');ROLLBACK;"),/duplicate key/);
});
