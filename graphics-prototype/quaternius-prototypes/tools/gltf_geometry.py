"""Generic glTF geometry readers. Reuses internal algorithms, no legacy assets."""
import numpy as np

def accessor(d,b,index):
 if type(index)is not int or index<0 or index>=len(d['accessors']):raise ValueError('Invalid accessor index')
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
  if type(index)is not int or index<0 or index>=len(d['nodes']):raise ValueError('Invalid node index')
  n=d['nodes'][index];m=parent@matrix(n)
  if not np.isfinite(m).all() or abs(np.linalg.det(m[:3,:3]))<1e-10:raise ValueError('Invalid node transform')
  if 'mesh' in n:
   for p in d['meshes'][n['mesh']]['primitives']:
    if p.get('mode',4)!=4 or p.get('targets'):raise ValueError('Unsupported primitive')
    a=p['attributes'];
    if any(d['accessors'][a[k]]['type']!=t for k,t in [('POSITION','VEC3'),('NORMAL','VEC3'),('TEXCOORD_0','VEC2')]) or d['accessors'][p['indices']]['componentType']not in (5121,5123,5125):raise ValueError('Invalid primitive accessor types')
    pos=accessor(d,b,a['POSITION']);norm=accessor(d,b,a['NORMAL']);uv=accessor(d,b,a['TEXCOORD_0']);idx=accessor(d,b,p['indices']).reshape(-1)
    if len(norm)!=len(pos) or len(uv)!=len(pos) or len(idx)%3 or idx.max()>=len(pos):raise ValueError('Invalid triangle indices')
    if np.any(np.linalg.norm(norm,axis=1)<1e-8):raise ValueError('Zero-length normal')
    pos=(np.c_[pos,np.ones(len(pos))]@m.T)[:,:3];norm=norm@np.linalg.inv(m[:3,:3]);norm/=np.linalg.norm(norm,axis=1)[:,None]
    if np.linalg.det(m[:3,:3])<0:idx=idx.reshape(-1,3)[:,[0,2,1]].reshape(-1)
    output.append({'pos':pos,'norm':norm,'uv':uv,'idx':idx,'material':p.get('material',0)})
  for c in n.get('children',[]):visit(c,m,ancestors|{index})
 for n in d['scenes'][d.get('scene',0)]['nodes']:visit(n,np.eye(4),set())
 return output
