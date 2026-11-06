"""Bounded, non-executing inspection of the supplied Kenney packs and GLB 2.0."""
import hashlib, json, math, stat, struct, zipfile
from pathlib import PurePosixPath
import numpy as np

PACKS = {
 'factory': '7e31fb2308e90304672bd15cd18fa9d9f02c03731a8cbc57a8e3e1c181dfb0a7',
 'industrial': '5b381164e5760f3830a2dbee43b972deee38b2a695d091b56e238ab2910c96d2',
 'suburban': '5869c35cf30b1c87bdb2d197b6d325eebadd2ef08ea27f04797e8e08d77a9a39'}

def safe_zip(path, expected=None):
 raw=path.read_bytes()
 if len(raw)>32*1024*1024: raise ValueError('Archive size limit')
 digest=hashlib.sha256(raw).hexdigest()
 if expected and digest!=expected: raise ValueError('Unreviewed archive fingerprint')
 z=zipfile.ZipFile(path); seen=set(); total=0
 if len(z.infolist())>2000: raise ValueError('Entry limit')
 for i in z.infolist():
  p=PurePosixPath(i.filename); key=i.filename.rstrip('/').casefold()
  if not i.filename or '\\' in i.filename or p.is_absolute() or str(p)!=i.filename.rstrip('/') or '..' in p.parts or ':' in i.filename or key in seen: raise ValueError('Unsafe or duplicate archive path')
  seen.add(key)
  mode=i.external_attr>>16
  if stat.S_ISLNK(mode) or (stat.S_IFMT(mode) not in (0,stat.S_IFREG,stat.S_IFDIR)): raise ValueError('Archive link or special file')
  total+=i.file_size
  if i.flag_bits&1 or i.file_size>16*1024*1024 or total>64*1024*1024: raise ValueError('Encrypted or oversized archive')
 return z,digest

def glb(raw, allow_animation=False):
 if len(raw)<28: raise ValueError('Truncated GLB')
 magic,version,length=struct.unpack_from('<4sII',raw)
 if magic!=b'glTF' or version!=2 or length!=len(raw): raise ValueError('Invalid GLB header')
 offset=12; chunks=[]
 while offset<len(raw):
  if offset+8>len(raw): raise ValueError('Truncated chunk')
  size,kind=struct.unpack_from('<II',raw,offset);offset+=8
  if size%4 or offset+size>len(raw): raise ValueError('Invalid chunk')
  chunks.append((kind,raw[offset:offset+size]));offset+=size
 if len(chunks)!=2 or [c[0]for c in chunks]!=[0x4e4f534a,0x004e4942]: raise ValueError('Expected JSON and embedded binary')
 d=json.loads(chunks[0][1]); binary=chunks[1][1]
 if d.get('extensionsRequired') or d.get('skins') or (d.get('animations') and not allow_animation): raise ValueError('Unsupported animated/compressed model')
 if len(d.get('buffers',[]))!=1 or d['buffers'][0].get('uri') or d['buffers'][0]['byteLength']>len(binary): raise ValueError('External/truncated buffers')
 return d,binary

def accessor(d,b,index):
 a=d['accessors'][index]
 if a.get('sparse') or a.get('normalized'): raise ValueError('Unsupported accessor')
 components={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4}[a['type']]
 dtype=np.dtype({5121:'u1',5123:'<u2',5125:'<u4',5126:'<f4'}[a['componentType']]);v=d['bufferViews'][a['bufferView']]
 count=a['count'];stride=v.get('byteStride',components*dtype.itemsize);start=v.get('byteOffset',0)+a.get('byteOffset',0)
 if count<=0 or count>1000000 or stride<components*dtype.itemsize or start+(count-1)*stride+components*dtype.itemsize>v.get('byteOffset',0)+v['byteLength'] or v.get('buffer',0)!=0 or v.get('byteOffset',0)+v['byteLength']>len(b): raise ValueError('Accessor outside buffer')
 result=np.ndarray((count,components),dtype=dtype,buffer=b,offset=start,strides=(stride,dtype.itemsize)).copy()
 if not np.isfinite(result).all(): raise ValueError('Nonfinite geometry')
 return result

def matrix(n):
 if 'matrix' in n:return np.array(n['matrix']).reshape(4,4,order='F')
 x,y,z,w=n.get('rotation',[0,0,0,1]);m=np.eye(4)
 m[:3,:3]=np.array([[1-2*(y*y+z*z),2*(x*y-z*w),2*(x*z+y*w)],[2*(x*y+z*w),1-2*(x*x+z*z),2*(y*z-x*w)],[2*(x*z-y*w),2*(y*z+x*w),1-2*(x*x+y*y)]])@np.diag(n.get('scale',[1,1,1]));m[:3,3]=n.get('translation',[0,0,0]);return m

def geometry(d,b):
 output=[]
 def visit(index,parent,ancestors):
  if index in ancestors:raise ValueError('Node cycle')
  n=d['nodes'][index];m=parent@matrix(n)
  if not np.isfinite(m).all() or abs(np.linalg.det(m[:3,:3]))<1e-10:raise ValueError('Invalid node transform')
  if 'mesh' in n:
   for p in d['meshes'][n['mesh']]['primitives']:
    if p.get('mode',4)!=4 or p.get('targets'):raise ValueError('Unsupported primitive')
    a=p['attributes'];pos=accessor(d,b,a['POSITION']);norm=accessor(d,b,a['NORMAL']);uv=accessor(d,b,a['TEXCOORD_0']);idx=accessor(d,b,p['indices']).reshape(-1)
    if len(idx)%3 or idx.max()>=len(pos):raise ValueError('Invalid triangle indices')
    pos=(np.c_[pos,np.ones(len(pos))]@m.T)[:,:3];norm=norm@np.linalg.inv(m[:3,:3]);norm/=np.linalg.norm(norm,axis=1)[:,None]
    if np.linalg.det(m[:3,:3])<0:idx=idx.reshape(-1,3)[:,[0,2,1]].reshape(-1)
    output.append({'pos':pos,'norm':norm,'uv':uv,'idx':idx,'material':p.get('material',0)})
  for c in n.get('children',[]):visit(c,m,ancestors|{index})
 for n in d['scenes'][d.get('scene',0)]['nodes']:visit(n,np.eye(4),set())
 return output

def info(raw):
 d,b=glb(raw,allow_animation=True);g=geometry(d,b);p=np.concatenate([x['pos']for x in g]);return {'bounds':[p.min(0).tolist(),p.max(0).tolist()],'triangles':sum(len(x['idx'])//3 for x in g),'vertices':sum(len(x['pos'])for x in g),'primitives':len(g),'materials':d.get('materials',[]),'images':d.get('images',[]),'animations':len(d.get('animations',[]))}
