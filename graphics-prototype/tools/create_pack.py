"""Original deterministic prototype tiles. No world seed or third-party imagery."""
import hashlib,json,pathlib,random,struct,zlib,zipfile,sys
from pack import IDS,SURFACES,validate
root=pathlib.Path(__file__).resolve().parents[1]
def chunk(kind,data): return struct.pack('>I',len(data))+kind+data+struct.pack('>I',zlib.crc32(kind+data)&0xffffffff)
def tile(name):
    rng=random.Random(410+SURFACES.index(name)); colors={'grass':(91,112,58),'dirt':(133,105,73),'gravel':(126,127,120),'asphalt':(53,59,65),'concrete':(171,168,155)}; rows=[]
    for y in range(128):
        row=bytearray([0])
        for x in range(128):
            v=rng.randrange(-15,16)
            if name=='grass': v+=8 if (x*7+y*13)%19<3 else 0
            if name=='gravel': v+=18 if (x//3+y//3)%4==0 else -4
            if name=='concrete' and (x%64==0 or y%64==0):v=-30
            if name=='asphalt':v//=2
            row.extend(max(0,min(255,c+v)) for c in colors[name])
        rows.append(bytes(row))
    return b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('>IIBBBBB',128,128,8,2,0,0,0))+chunk(b'IDAT',zlib.compress(b''.join(rows),9))+chunk(b'IEND',b'')
def generate(output):
    blobs={'textures/'+s+'.png':tile(s) for s in SURFACES}
    m={'format':'map-game-graphics','version':1,'packId':'frontier-prototype-v1','license':'CC0-1.0','models':[{'catalogId':i,'source':'procedural-v1','dimensions':d,'pivot':'base-center'} for i,d in IDS.items()],'surfaces':{s:{'file':'textures/'+s+'.png','tileMeters':4} for s in SURFACES},'files':[{'path':n,'kind':'texture','bytes':len(b),'sha256':hashlib.sha256(b).hexdigest()} for n,b in blobs.items()]}
    validate(m,blobs)
    with zipfile.ZipFile(output,'x',compression=zipfile.ZIP_DEFLATED) as z:
        for n,b in {'manifest.json':(json.dumps(m,indent=2)+'\n').encode(),**blobs}.items():
            info=zipfile.ZipInfo(n,(2026,1,1,0,0,0));info.compress_type=zipfile.ZIP_DEFLATED;info.external_attr=0o100644<<16;z.writestr(info,b)
    return m,blobs
if __name__=='__main__': generate(sys.argv[1])
