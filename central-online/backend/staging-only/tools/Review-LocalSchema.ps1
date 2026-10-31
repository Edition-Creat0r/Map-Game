#requires -Version 7.2
<#
Offline triage only. Reads a private export; writes sanitized reports outside Git.
Never executes SQL, opens a database connection, invokes psql/Supabase, or loads
code from the export. No raw SQL, identifiers from unknown objects, file paths,
credential matches or exception details are emitted. Exit 2 always means REVIEW
REQUIRED, not scanner failure. Exit 1 means no complete report was generated.
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory)][string]$SchemaPath,
    [string]$ReportDirectory = $(if ($env:LOCALAPPDATA) { Join-Path $env:LOCALAPPDATA 'MapGame/private-security-review' } else { Join-Path ([IO.Path]::GetTempPath()) 'MapGame-private-security-review' })
)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
try {
    # Resolve every existing path component, including directory junctions/links.
    function Get-PhysicalPath([string]$Value) {
        $full = [IO.Path]::GetFullPath($Value)
        if ($full.StartsWith('\\') -or $full.StartsWith('//')) { throw 'local-only' }
        $root = [IO.Path]::GetPathRoot($full)
        if ([IO.DriveInfo]::new($root).DriveType -eq [IO.DriveType]::Network) { throw 'local-only' }
        $current = $root
        foreach ($part in $full.Substring($root.Length).Split([char[]]@([IO.Path]::DirectorySeparatorChar,[IO.Path]::AltDirectorySeparatorChar), [StringSplitOptions]::RemoveEmptyEntries)) {
            $current = Join-Path $current $part
            if (Test-Path -LiteralPath $current) {
                $item = Get-Item -LiteralPath $current -Force
                if ($item.LinkType) { $current = $item.ResolveLinkTarget($true).FullName }
            }
        }
        if ($current.StartsWith('\\') -or $current.StartsWith('//') -or [IO.DriveInfo]::new([IO.Path]::GetPathRoot($current)).DriveType -eq [IO.DriveType]::Network) { throw 'local-only' }
        return $current
    }
    function Assert-PrivateLocation([string]$Value) {
        $cursor = $Value
        while ($cursor) {
            $marker = Join-Path $cursor '.git'
            if ((Test-Path -LiteralPath $marker -PathType Leaf) -or (Test-Path -LiteralPath (Join-Path $marker 'HEAD')) -or (Test-Path -LiteralPath (Join-Path $marker 'objects'))) { throw 'repository-location' }
            # Also reject the script's repository/document root if .git is absent.
            $repoRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../../..'))
            if ($cursor.TrimEnd([IO.Path]::DirectorySeparatorChar) -eq $repoRoot.TrimEnd([IO.Path]::DirectorySeparatorChar)) { throw 'repository-location' }
            $parent = [IO.Directory]::GetParent($cursor)
            if ($null -eq $parent) { break }
            $cursor = $parent.FullName
        }
    }
    $inputFile = Get-PhysicalPath $SchemaPath
    $outputRoot = Get-PhysicalPath $ReportDirectory
    Assert-PrivateLocation $inputFile
    Assert-PrivateLocation $outputRoot
    if (-not [IO.File]::Exists($inputFile)) { throw 'input-missing' }
    $size = [IO.FileInfo]::new($inputFile).Length
    if ($size -eq 0 -or $size -gt 33554432) { throw 'input-size' }
    $bytes = [IO.File]::ReadAllBytes($inputFile)
    $digest = [Convert]::ToHexString([Security.Cryptography.SHA256]::HashData($bytes)).ToLowerInvariant()
    $source = [Text.UTF8Encoding]::new($false,$true).GetString($bytes).TrimStart([char]0xfeff)
    if ($source.Contains([char]0)) { throw 'input-encoding' }
    # This trusted lexer never executes export text. Comments, string literals and
    # dollar-quoted bodies cannot introduce fake outer DDL statements.
    Add-Type -TypeDefinition @'
using System;
using System.Collections.Generic;
using System.Text;
using System.Text.RegularExpressions;
public sealed class MapGameSqlStatement {
 public string Code; public string Body; public int Line;
 public MapGameSqlStatement(string code,string body,int line){Code=code;Body=body;Line=line;}
}
public static class MapGameSqlReviewLexer {
 // Only normalized outer CREATE code enters here: strings/comments/bodies
 // have already been masked. Split columns on commas at table depth only.
 public static bool HasExplicitNotNull(string code,string column){
  int open=code.IndexOf('('),depth=0,count=0;bool notNull=false,closed=false;
  if(open<0)return false;
  var part=new StringBuilder();var parts=new List<string>();
  for(int i=open+1;i<code.Length;i++){
   char c=code[i];
   if(c=='('){if(depth==0)part.Append(" __nested__ ");depth++;}
   else if(c==')'){if(depth>0)depth--;else{parts.Add(part.ToString());closed=true;break;}}
   else if(c==','&&depth==0){parts.Add(part.ToString());part.Clear();}
   else if(depth==0)part.Append(c);
  }
  if(!closed||depth!=0)return false;
  foreach(string field in parts){
   if(!Regex.IsMatch(field,@"^\s*"+Regex.Escape(column)+@"\s+"))continue;
   count++;
   var modifier=Regex.Match(field,@"\bnot\s+null\b");
   if(!modifier.Success)continue;
   string before=field.Substring(0,modifier.Index);
   var def=Regex.Match(before,@"\bdefault\b");
   if(!def.Success){notNull=true;continue;}
   // After DEFAULT, accept only an unambiguous single literal, constant or
   // function call (with optional simple cast). Complex expressions stay REVIEW.
   // In particular DEFAULT (... IS NOT NULL), IS NOT NULL and CASE expressions
   // must not masquerade as an attnotnull modifier.
   string expression=before.Substring(def.Index+def.Length).Trim();
   if(Regex.IsMatch(expression,@"^(?:__literal__|true|false|null|current_timestamp|current_date|current_user|[-+]?\d+(?:\.\d+)?|(?:[a-z_][a-z0-9_]*\s*\.\s*)?[a-z_][a-z0-9_]*\s+__nested__)(?:\s*::\s*[a-z_][a-z0-9_]*(?:\s+__nested__)?)?\s*$"))notNull=true;
  }
  return count==1&&notNull;
 }
 public static MapGameSqlStatement[] Read(string s){
  var result=new List<MapGameSqlStatement>();var code=new StringBuilder();var body=new StringBuilder();
  int i=0,line=1,start=1;bool has=false;
  while(i<s.Length){
   char c=s[i];
   if(c=='\n'){line++;code.Append(' ');i++;continue;}
   if(char.IsWhiteSpace(c)){code.Append(' ');i++;continue;}
   if(c=='-'&&i+1<s.Length&&s[i+1]=='-'){while(i<s.Length&&s[i]!='\n')i++;continue;}
   if(c=='/'&&i+1<s.Length&&s[i+1]=='*'){
    int depth=1;i+=2;code.Append(' ');
    while(i<s.Length&&depth>0){if(s[i]=='\n')line++;
     if(i+1<s.Length&&s[i]=='/'&&s[i+1]=='*'){depth++;i+=2;}
     else if(i+1<s.Length&&s[i]=='*'&&s[i+1]=='/'){depth--;i+=2;}else i++;}
    if(depth!=0)throw new Exception("incomplete");continue;
   }
   if(!has){start=line;has=true;}
   if(c=='\\'){ // psql directives are recorded, never followed or executed.
    while(i<s.Length&&s[i]!='\n')i++;
    if(code.ToString().Trim().Length>0)throw new Exception("directive-location");
    result.Add(new MapGameSqlStatement("__meta__","",line));code.Clear();has=false;continue;
   }
   if(c=='\''||c=='"'){
    char quote=c;bool escape=quote=='\''&&i>0&&(s[i-1]=='e'||s[i-1]=='E');i++;
    var value=new StringBuilder();bool closed=false;
    while(i<s.Length){c=s[i++];if(c=='\n')line++;
     if(c==quote){if(i<s.Length&&s[i]==quote){value.Append(quote);i++;}else{closed=true;break;}}
     else if(escape&&c=='\\'&&i<s.Length){value.Append(c);value.Append(s[i++]);}
     else value.Append(c);
    }
    if(!closed)throw new Exception("incomplete");
    if(quote=='"'){var v=value.ToString();code.Append(Regex.IsMatch(v,"^[a-z_][a-z0-9_]*$")?v:"__quoted__");}
    else{code.Append(" __literal__ ");body.Append(value).Append('\n');}continue;
   }
   if(c=='$'){
    var match=Regex.Match(s.Substring(i),@"^\$(?:[A-Za-z_][A-Za-z0-9_]*)?\$");
    if(match.Success){string tag=match.Value;int begin=i+tag.Length,end=s.IndexOf(tag,begin,StringComparison.Ordinal);
     if(end<0)throw new Exception("incomplete");
     body.Append(s,begin,end-begin).Append('\n');
     for(int k=i;k<end+tag.Length;k++)if(s[k]=='\n')line++;
     i=end+tag.Length;code.Append(" __literal__ ");continue;
    }
   }
   if(c==';'){result.Add(new MapGameSqlStatement(code.ToString().Trim().ToLowerInvariant(),body.ToString(),start));code.Clear();body.Clear();has=false;i++;continue;}
   code.Append(c);i++;
  }
  if(code.ToString().Trim().Length>0)throw new Exception("incomplete");
  return result.ToArray();
 }
}
'@ | Out-Null
    $statements = [MapGameSqlReviewLexer]::Read($source)
    $findings = [Collections.Generic.List[object]]::new()
    function Add-Finding([string]$Code,[string]$Severity,[int]$Line,[string]$Message) {
        $findings.Add([ordered]@{ code=$Code; severity=$Severity; line=$Line; message=$Message })
    }
    $tables = @('worlds','world_members','world_sessions','territory_claims','capitals')
    foreach ($table in $tables) {
        $defs = @($statements | Where-Object Code -Match "^create\s+table\s+(?:if\s+not\s+exists\s+)?public\s*\.\s*$table\s*\(")
        if ($defs.Count -ne 1) { Add-Finding "TABLE_$table" 'BLOCKER' 0 'Expected exactly one table definition; inspect complete export privately.' }
        $rls = @($statements | Where-Object Code -Match "^alter\s+table\s+(?:only\s+)?public\.$table\s+enable\s+row\s+level\s+security$")
        if ($rls.Count -ne 1) { Add-Finding "RLS_$table" 'BLOCKER' 0 'Expected explicit RLS enable statement; static absence is not proof of live state.' }
    }
    $requirements = @(
        @('worlds','id'), @('world_members','world_id,user_id'), @('world_sessions','session_id'),
        @('territory_claims','world_id,territory_id'), @('capitals','world_id,owner_id')
    )
    foreach ($r in $requirements) {
        $table=$r[0]; $columns=($r[1].Split(',') | ForEach-Object { [regex]::Escape($_) }) -join '\s*,\s*'
        $pk = @($statements | Where-Object { $_.Code -match "^(?:create\s+table\s+(?:if\s+not\s+exists\s+)?|alter\s+table\s+(?:only\s+)?)(?:public\s*\.\s*$table)\b" -and $_.Code -match "primary\s+key\s*\(\s*$columns\s*\)" })
        if (-not $pk.Count) { Add-Finding "PK_$table" 'BLOCKER' 0 'Required primary key was not recognized. Inline/unusual syntax needs manual review; no constraints are repaired.' }
    }
    $notNull = @{
        worlds=@('id'); world_members=@('world_id','user_id')
        world_sessions=@('world_id','session_id','user_id','created_at','last_seen','conflicted')
        territory_claims=@('world_id','territory_id','owner_id')
        capitals=@('world_id','territory_id','owner_id','x','z')
    }
    foreach ($table in $tables) {
        $defs = @($statements | Where-Object Code -Match "^create\s+table\s+(?:if\s+not\s+exists\s+)?public\s*\.\s*$table\s*\(")
        foreach ($column in $notNull[$table]) {
            $inline = @()
            if ($defs.Count -eq 1 -and [MapGameSqlReviewLexer]::HasExplicitNotNull($defs[0].Code,$column)) { $inline = @($defs[0]) }
            $alter = @($statements | Where-Object Code -Match "^alter\s+table\s+(?:only\s+)?public\s*\.\s*$table\s+alter\s+column\s+$column\s+set\s+not\s+null$")
            $drop = @($statements | Where-Object Code -Match "^alter\s+table\s+(?:only\s+)?public\s*\.\s*$table\b.*\balter\s+(?:column\s+)?$column\s+drop\s+not\s+null\b")
            if ($defs.Count -ne 1 -or $drop.Count -or (-not $inline.Count -and -not $alter.Count)) { Add-Finding "NOT_NULL_${table}_$column" 'REVIEW' 0 'Explicit NOT NULL is absent, ambiguous or later dropped in recognized syntax. A primary key may supply it; confirm catalog attnotnull privately.' }
        }
    }
    $foreignKeys = @(
        @('world_members','world_id','public.worlds','id'), @('world_members','user_id','auth.users','id'),
        @('world_sessions','user_id','auth.users','id'),
        @('territory_claims','world_id','public.worlds','id'), @('territory_claims','owner_id','auth.users','id'),
        @('capitals','world_id','public.worlds','id'), @('capitals','owner_id','auth.users','id'),
        @('capitals','world_id,territory_id','public.territory_claims','world_id,territory_id')
    )
    foreach ($r in $foreignKeys) {
        $table=$r[0]; $cols=$r[1].Replace(',', '\s*,\s*'); $target=[regex]::Escape($r[2]); $refs=$r[3].Replace(',', '\s*,\s*')
        $matches = @($statements | Where-Object { $_.Code -match "^(?:create\s+table\s+(?:if\s+not\s+exists\s+)?|alter\s+table\s+(?:only\s+)?)(?:public\s*\.\s*$table)\b" -and $_.Code -match "foreign\s+key\s*\(\s*$cols\s*\)\s+references\s+$target\s*\(\s*$refs\s*\)" -and $_.Code -notmatch '\bnot\s+valid\b|\bdeferrable\b' })
        if (-not $matches.Count) { Add-Finding "FK_${table}_$($r[1].Replace(',','_'))" 'BLOCKER' 0 'Expected validated immediate foreign key was not recognized. Inline or unusual definitions need private catalog verification.' }
    }
    $ownerUnique = @($statements | Where-Object { $_.Code -match '^create\s+unique\s+index\s+.*\bon\s+(?:only\s+)?public\.territory_claims\s+(?:using\s+btree\s*)?\(\s*owner_id\s*\)' -and $_.Code -notmatch '\bwhere\b' })
    if (-not $ownerUnique.Count) { Add-Finding 'OWNER_UNIQUENESS' 'BLOCKER' 0 'Full global one-claim-per-owner unique index was not recognized. Inspect constraint/index validity privately.' }
    foreach ($pair in @(@('map_game_start_session',2),@('map_game_session_heartbeat',1),@('map_game_end_session',1))) {
        $name=$pair[0]
        $definitions=@($statements | Where-Object Code -Match "^create\s+(?:or\s+replace\s+)?function\s+public\.$name\s*\(")
        if ($definitions.Count -ne $pair[1]) { Add-Finding "SIGNATURE_COUNT_$name" 'BLOCKER' 0 'Unexpected or missing routine count. Confirm exact argument names/types, defaults, boolean return and owners privately.' }
    }
    foreach ($s in $statements) {
        $c = $s.Code
        if ($c -match '^create\s+(?:or\s+replace\s+)?(?:function|procedure)\s+') {
            Add-Finding 'ROUTINE_REVIEW' 'REVIEW' $s.Line 'Review signature, defaults, owner, body and all callers privately; alternate RPC bypasses cannot be ruled out statically.'
            if ($c -match '\bsecurity\s+definer\b') {
                Add-Finding 'DEFINER_REVIEW' 'BLOCKER' $s.Line 'Privileged routine requires explicit owner, search-path, body and effective EXECUTE review.'
                if ($c -notmatch '\bset\s+search_path\s*(?:=|to)\s*(?:pg_catalog|__literal__)\b') { Add-Finding 'DEFINER_PATH' 'BLOCKER' $s.Line 'A restricted search path was not recognized; quoted values must also be reviewed.' }
            }
            if ($s.Body -match '(?is)on\s+conflict\s*\(\s*"?session_id"?\s*\)\s*do\s+update\s+set[^;]*\b"?user_id"?\s*=') {
                Add-Finding 'SESSION_OWNER_REASSIGNMENT' 'BLOCKER' $s.Line 'Known unsafe collision-owner assignment pattern detected. Review both start-session overloads.'
            }
            if ($s.Body -match '(?i)\bexecute\b|\bset_config\b|\bdblink\b|\bhttp\b') { Add-Finding 'DYNAMIC_ROUTINE' 'BLOCKER' $s.Line 'Dynamic SQL, configuration or external-call pattern needs private review; content omitted.' }
        }
        if ($c -match '^alter\s+(?:function|procedure|table|view|schema).*\bowner\s+to\s+') {
            if ($c -notmatch '\bowner\s+to\s+postgres$') { Add-Finding 'OWNER_REVIEW' 'BLOCKER' $s.Line 'Non-postgres owner statement detected; identity omitted. A no-owner export cannot establish real ownership.' }
        }
        if ($c -match '^(?:grant|revoke|alter\s+default\s+privileges)\b') { Add-Finding 'ACL_REVIEW' 'REVIEW' $s.Line 'Review effective table/column/schema/function privileges, PUBLIC defaults and role inheritance; statements alone do not prove effective access.' }
        if ($c -match '^grant\b' -and $c -notmatch '\bon\b') { Add-Finding 'ROLE_MEMBERSHIP' 'BLOCKER' $s.Line 'Role-membership statement detected; inspect transitive inheritance and SET ROLE access privately.' }
        if ($c -match '^create\s+(?:constraint\s+)?(?:event\s+)?trigger\b|^alter\s+table.*\b(?:disable|enable)\s+trigger\b') { Add-Finding 'TRIGGER_REVIEW' 'BLOCKER' $s.Line 'Review trigger owner, ordering, enabled state and called routines; later BEFORE triggers may change guarded rows.' }
        if ($c -match '^create\s+(?:or\s+replace\s+)?(?:materialized\s+)?view\b|^create\s+(?:or\s+replace\s+)?rule\b') { Add-Finding 'VIEW_RULE_REVIEW' 'BLOCKER' $s.Line 'Review view/rule ownership, security behavior and writes as a possible alternative access path.' }
        if ($c -match '^create\s+policy\b') { Add-Finding 'POLICY_REVIEW' 'REVIEW' $s.Line 'Review roles, command, USING and WITH CHECK together; permissive policies combine with OR.' }
        if ($c -match '^(?:insert|copy|update|delete|truncate)\b') { Add-Finding 'DATA_STATEMENT' 'BLOCKER' $s.Line 'Data-changing statement detected. Do not treat this file as a schema-only baseline.' }
        if ($c -eq '__meta__') { Add-Finding 'PSQL_DIRECTIVE' 'REVIEW' $s.Line 'psql directive detected; inspect privately. Expected restrict/unrestrict directives are not executed or stripped.' }
    }
    # Fixed output only. Do not echo captured credentials, even on errors.
    if ($source -match '(?i)postgres(?:ql)?://|-----BEGIN [A-Z ]*PRIVATE KEY-----|\bsbp_[A-Za-z0-9]+|\bgh[pousr]_[A-Za-z0-9]+|eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+|\b(?:password|service_role_key|access_token)\b\s*[:=]') {
        Add-Finding 'SENSITIVE_PATTERN' 'BLOCKER' 0 'Potential embedded sensitive content detected; inspect privately. No matching text is copied.'
    }
    Add-Finding 'CONSTRAINTS_PENDING' 'BLOCKER' 0 'Confirm every required NOT NULL, validated immediate PK/FK, full nonpartial one-owner unique index and referential action against the draft and private metadata; PK syntax detection is only triage.'
    Add-Finding 'OWNERS_ACLS_PENDING' 'BLOCKER' 0 'A public schema-only/no-owner export omits authoritative owners and global role memberships. Private metadata preflight and transitive privilege review remain required.'
    Add-Finding 'COMPLETENESS_PENDING' 'BLOCKER' 0 'Confirm export success/footer, all schemas/dependencies, unknown routines/triggers, policies, grants, role graph and Realtime metadata. No static scan can certify completeness.'
    Add-Finding 'STAGING_TESTS_PENDING' 'BLOCKER' 0 'Real two-account JWT/REST/Realtime, session collisions, expiry, ownership and transaction gates have not run. No deployment or spending approval.'
    $report = [ordered]@{
        formatVersion=1; status='REVIEW_REQUIRED'; deploymentApproved=$false; offlineOnly=$true
        sha256=$digest; bytes=$size; statements=$statements.Count
        expectedMigrationOrder=@('reviewed private baseline','reviewed security hardening','001_backend.sql','002_pin_rules.sql','003_legacy_coordination.sql')
        findings=@($findings.ToArray())
    }
    $runDirectory = Join-Path $outputRoot ('review-'+[Guid]::NewGuid().ToString('N'))
    [IO.Directory]::CreateDirectory($runDirectory) | Out-Null
    $json = $report | ConvertTo-Json -Depth 8
    $lines = [Collections.Generic.List[string]]::new()
    $lines.Add('# Map Game private offline schema triage')
    $lines.Add('REVIEW REQUIRED. No SQL executed. Not deployment approval. Keep report private.')
    $lines.Add('SHA256: '+$digest)
    $lines.Add('Expected order: reviewed baseline -> reviewed hardening -> 001 -> 002 -> 003.')
    foreach ($f in $findings) { $lines.Add(('- {0} | {1} | line {2}: {3}' -f $f.severity,$f.code,$f.line,$f.message)) }
    [IO.File]::WriteAllText((Join-Path $runDirectory 'security-review.json'),$json,[Text.UTF8Encoding]::new($false))
    [IO.File]::WriteAllLines((Join-Path $runDirectory 'security-review.md'),$lines,[Text.UTF8Encoding]::new($false))
    Write-Output 'Offline triage complete. Private report saved in a new review-* folder beneath your chosen report directory. REVIEW REQUIRED (exit 2). No SQL or credentials printed.'
    exit 2
} catch {
    # Never print $_, exception text, input paths, source text or bound parameters.
    Write-Output 'Offline triage stopped (exit 1). Check PowerShell 7.2+, a local UTF-8 SQL file under 32 MiB, and private input/output locations outside repositories. No SQL executed; do not deploy.'
    exit 1
}
