"""Local-only graphics pack v1. No scripts, GLB parsing, extraction API or uploads."""
import argparse, hashlib, json, os, pathlib, re, stat, struct, tempfile, zipfile, zlib
MAX_FILE=1024*1024
MAX_TOTAL=8*MAX_FILE
IDS={'smallHouse':[18,12,22],'steelMill':[118,32,92],'officeLow':[86,24,72]}
SURFACES=('grass','dirt','gravel','asphalt','concrete')
def reject(message): raise ValueError(message)
def pairs(items):
    out={}
    for k,v in items:
        if k in out: reject('Duplicate JSON key')
        out[k]=v
    return out
def read_json(blob):
    if len(blob)>65536: reject('Manifest too large')
    return json.loads(blob,object_pairs_hook=pairs,parse_constant=lambda _:reject('Nonfinite JSON'))
def clean_path(value):
    if not isinstance(value,str) or not re.fullmatch(r'[a-z0-9][a-z0-9_./-]{0,95}',value): reject('Invalid path')
    if any(x in ('','.', '..') for x in value.split('/')) or ':' in value: reject('Unsafe path')
    return value
def png(blob):
    if len(blob)>MAX_FILE or blob[:8]!=b'\x89PNG\r\n\x1a\n': reject('PNG required')
    pos=8; chunks=[]; compressed=b''; width=height=0
    while pos<len(blob):
        if pos+12>len(blob): reject('Truncated PNG')
        n,=struct.unpack('>I',blob[pos:pos+4]); kind=blob[pos+4:pos+8]
        if n>MAX_FILE or pos+12+n>len(blob): reject('Invalid PNG chunk')
        data=blob[pos+8:pos+8+n]; crc,=struct.unpack('>I',blob[pos+8+n:pos+12+n])
        if zlib.crc32(kind+data)&0xffffffff!=crc: reject('PNG CRC mismatch')
        if kind not in (b'IHDR',b'IDAT',b'IEND'): reject('Unsupported PNG chunk')
        chunks.append(kind)
        if kind==b'IHDR':
            if len(chunks)!=1 or n!=13: reject('Invalid PNG header')
            width,height,bits,color,comp,filt,inter=struct.unpack('>IIBBBBB',data)
            if not 16<=width<=1024 or not 16<=height<=1024 or bits!=8 or color not in (2,6) or comp or filt or inter: reject('Unsupported PNG format')
        if kind==b'IDAT': compressed+=data
        if kind==b'IEND' and (n or pos+12!=len(blob)): reject('PNG trailing data')
        pos+=12+n
    if chunks[:1]!=[b'IHDR'] or chunks[-1:]!=[b'IEND'] or any(k!=b'IDAT' for k in chunks[1:-1]): reject('Invalid PNG order')
    channels=3 if color==2 else 4; stride=width*channels+1; expected=stride*height
    dec=zlib.decompressobj(); raw=dec.decompress(compressed,expected+1)
    if len(raw)!=expected or not dec.eof or dec.unconsumed_tail or dec.unused_data: reject('Invalid PNG decompressed size')
    if any(raw[i]>4 for i in range(0,len(raw),stride)): reject('Invalid PNG filter')
    return width,height
def validate(manifest, blobs):
    if set(manifest)!=set(('format','version','packId','license','models','surfaces','files')): reject('Unknown manifest fields')
    if manifest['format']!='map-game-graphics' or type(manifest['version']) is not int or manifest['version']!=1: reject('Unsupported pack version')
    if not isinstance(manifest['packId'],str) or not re.fullmatch('[a-z][a-z0-9-]{0,47}',manifest['packId']): reject('Invalid pack ID')
    if manifest['license']!='CC0-1.0': reject('v1 requires declared CC0 assets')
    models=manifest['models']
    if not isinstance(models,list) or len(models)!=3: reject('Three existing models required')
    seen=set()
    for m in models:
        if set(m)!=set(('catalogId','source','dimensions','pivot')) or m['catalogId'] not in IDS or m['catalogId'] in seen: reject('Unknown/duplicate catalog model')
        if m['source']!='procedural-v1' or m['pivot']!='base-center' or m['dimensions']!=IDS[m['catalogId']]: reject('Unsupported model; GLB is reserved, not executable v1 content')
        seen.add(m['catalogId'])
    if set(manifest['surfaces'])!=set(SURFACES) or not isinstance(manifest['files'],list) or len(manifest['files'])!=5: reject('Five surfaces required')
    files=set()
    for item in manifest['files']:
        if set(item)!=set(('path','sha256','bytes','kind')): reject('Unknown file metadata')
        name=clean_path(item['path'])
        if name in files or not re.fullmatch(r'textures/(grass|dirt|gravel|asphalt|concrete)\.png',name) or item['kind']!='texture': reject('Unsupported or duplicate asset')
        blob=blobs.get(name)
        if blob is None or type(item['bytes']) is not int or not 0<item['bytes']<=MAX_FILE or len(blob)!=item['bytes'] or hashlib.sha256(blob).hexdigest()!=item['sha256']: reject('Asset integrity mismatch')
        png(blob);files.add(name)
    if files!=set(blobs): reject('Unlisted or missing payload')
    for name,v in manifest['surfaces'].items():
        if set(v)!=set(('file','tileMeters')) or v['file']!='textures/'+name+'.png' or type(v['tileMeters']) not in (int,float) or not 1<=v['tileMeters']<=16: reject('Invalid surface')
    return manifest
def load_zip(source):
    if pathlib.Path(source).stat().st_size>MAX_TOTAL: reject('ZIP size limit')
    with zipfile.ZipFile(source) as archive:
        infos=archive.infolist()
        if len(infos)!=6: reject('Exactly manifest + five images required')
        names=set(); contents={};total=0
        for entry in infos:
            name=clean_path(entry.filename)
            mode=entry.external_attr>>16
            if name.casefold() in names or entry.is_dir() or stat.S_ISLNK(mode) or (stat.S_IFMT(mode) not in (0,stat.S_IFREG)) or entry.flag_bits&1: reject('Unsafe ZIP entry')
            names.add(name.casefold())
            if entry.compress_type not in (zipfile.ZIP_STORED,zipfile.ZIP_DEFLATED) or not 0<entry.file_size<=MAX_FILE or entry.file_size>max(1,entry.compress_size)*100: reject('ZIP expansion limit')
            total+=entry.file_size
            if total>MAX_TOTAL: reject('ZIP total limit')
            with archive.open(entry) as f: contents[name]=f.read(MAX_FILE+1)
            if len(contents[name])!=entry.file_size: reject('ZIP size mismatch')
        if 'manifest.json' not in contents: reject('Missing manifest')
        m=read_json(contents.pop('manifest.json'))
        return validate(m,contents),contents

def build(source, destination):
    # Validate EVERYTHING before writes. New directory only, no merging/overwrite;
    # no ZipFile.extract/extractall; only fixed validated paths are materialized.
    manifest,blobs=load_zip(source)
    destination=pathlib.Path(destination).absolute()
    if destination.exists() or destination.is_symlink() or not destination.parent.is_dir(): reject('Use a new directory under an existing private build folder')
    for parent in destination.parents:
        if parent.is_symlink(): reject('Symlink parent refused')
    staging=pathlib.Path(tempfile.mkdtemp(prefix='.graphics-build-',dir=destination.parent))
    try:
        for name,blob in blobs.items():
            target=staging/name;target.parent.mkdir(exist_ok=True);target.write_bytes(blob)
        (staging/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
        # Same-origin static JSON, never JavaScript. Runtime only consumes known PNG paths.
        os.rename(staging,destination)
    finally:
        if staging.exists():
            import shutil;shutil.rmtree(staging)
    return manifest
if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('command',choices=['validate','build']);parser.add_argument('archive');parser.add_argument('destination',nargs='?');args=parser.parse_args()
    try:
        if args.command=='build':
            if not args.destination: reject('Destination required')
            result=build(args.archive,args.destination)
        else: result=load_zip(args.archive)[0]
        print('Validated graphics v1 pack:',result['packId'],'(procedural models; no GLB assets)')
    except Exception:
        parser.exit(1,'Pack rejected. No asset code was executed; review local manifest and limits.\n')
