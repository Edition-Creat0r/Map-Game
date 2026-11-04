"""Read-only audit of the supplied ModernResource_Free ZIP. NEVER extracts/imports.
Requires Pillow >= 12.3.0 for bounded decoding; license approval is separate.
"""
import argparse, hashlib, io, json, pathlib, re, stat, struct, warnings, zipfile, zlib
from PIL import Image
MAX_FILE = 256 * 1024
MAX_TOTAL = 32 * 1024 * 1024
EXPECTED = {f'64px/icon_{i}.png' for i in range(1, 125)}
def reject(message): raise ValueError(message)
def png_chunks(blob):
    if blob[:8] != b'\x89PNG\r\n\x1a\n': reject('PNG signature required')
    pos=8; kinds=[]; compressed=b''
    while pos < len(blob):
        if pos+12 > len(blob): reject('Truncated PNG')
        n,=struct.unpack('>I',blob[pos:pos+4]); k=blob[pos+4:pos+8]
        if n > MAX_FILE or pos+12+n > len(blob): reject('PNG chunk size')
        payload=blob[pos+8:pos+8+n]; crc,=struct.unpack('>I',blob[pos+8+n:pos+12+n])
        if zlib.crc32(k+payload)&0xffffffff != crc: reject('PNG CRC')
        if k in (b'acTL',b'fcTL',b'fdAT') or not re.fullmatch(b'[A-Za-z]{4}',k): reject('Animated/invalid PNG')
        if k[:1].isupper() and k not in (b'IHDR',b'PLTE',b'IDAT',b'IEND'): reject('Unknown critical chunk')
        if k == b'IHDR':
            if kinds or n!=13: reject('PNG header order')
            if struct.unpack('>II',payload[:8])!=(64,64): reject('Expected 64x64 PNG header')
        if k == b'IDAT': compressed+=payload
        if k == b'IEND' and (n or pos+12!=len(blob)): reject('PNG trailing bytes')
        kinds.append(k); pos+=n+12
    if kinds[:1]!=[b'IHDR'] or kinds[-1:]!=[b'IEND'] or b'IDAT' not in kinds: reject('PNG structure')
    # Even 16-bit RGBA Adam7 at 64x64 fits below 64 KiB. Bound PNG's own
    # deflate stream independently of ZIP expansion and the image decoder.
    dec=zlib.decompressobj(); raw=dec.decompress(compressed,65537)
    if len(raw)>65536 or not dec.eof or dec.unconsumed_tail or dec.unused_data: reject('PNG decompression limit/stream')
def audit(source):
    source=pathlib.Path(source)
    if source.stat().st_size > MAX_TOTAL: reject('Archive size limit')
    entries=[]; names=set(); total=0
    with zipfile.ZipFile(source) as archive:
        infos=archive.infolist()
        if len(infos) not in (124,125): reject('Expected 124 PNGs and optional directory')
        for e in infos:
            mode=e.external_attr>>16
            if e.filename.casefold() in names: reject('Duplicate filename')
            names.add(e.filename.casefold())
            if e.flag_bits&1 or stat.S_IFMT(mode) not in (0,stat.S_IFREG,stat.S_IFDIR): reject('Encrypted/special ZIP entry')
            if e.filename=='64px/' and e.is_dir(): continue
            if e.filename not in EXPECTED or e.is_dir(): reject('Unexpected/unsafe path')
            if e.compress_type not in (zipfile.ZIP_STORED,zipfile.ZIP_DEFLATED) or not 0<e.file_size<=MAX_FILE or e.file_size>max(1,e.compress_size)*100: reject('ZIP expansion limit')
            total+=e.file_size
            if total>MAX_TOTAL: reject('Total size limit')
            with archive.open(e) as f: blob=f.read(MAX_FILE+1)
            if len(blob)!=e.file_size: reject('Size mismatch')
            png_chunks(blob)
            with warnings.catch_warnings():
                warnings.simplefilter('error',Image.DecompressionBombWarning)
                with Image.open(io.BytesIO(blob)) as img:
                    if img.format!='PNG' or img.size!=(64,64) or getattr(img,'n_frames',1)!=1: reject('Expected static 64x64 PNG')
                    img.verify()
                with Image.open(io.BytesIO(blob)) as img:
                    img.load(); alpha=img.convert('RGBA').getchannel('A').getextrema()
                    if alpha[1]==0: reject('Fully invisible icon')
            entries.append({'file':e.filename,'bytes':len(blob),'sha256':hashlib.sha256(blob).hexdigest(),'width':64,'height':64,'alphaMin':alpha[0],'alphaMax':alpha[1],'transparent':alpha[0]<255})
    if {e['file'] for e in entries} != EXPECTED: reject('Missing icon')
    return {'format':'map-game-resource-audit','version':1,'count':len(entries),'archiveSha256':hashlib.sha256(source.read_bytes()).hexdigest(),'source':'UNVERIFIED','license':'NOT PROVIDED — PUBLIC IMPORT BLOCKED','imported':False,'icons':sorted(entries,key=lambda e:int(re.search(r'_(\d+)',e['file'])[1]))}
if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__); parser.add_argument('archive'); args=parser.parse_args()
    try: print(json.dumps(audit(args.archive),indent=2))
    except (ValueError,OSError,zipfile.BadZipFile,SyntaxError,zlib.error,Image.DecompressionBombError) as e: parser.exit(2,'Audit rejected: '+str(e)+'\n')
