"""Deterministic static assembly build. Animated source parts stay separate GLBs."""
import hashlib,json,math,struct,subprocess
from pathlib import Path
import numpy as np
from packlib import glb,geometry,info
from detailing import parts as architectural_parts,finish
ROOT=Path(__file__).resolve().parents[1]

def transform(part, bounds):
 lo,hi=np.array(bounds);angle=math.radians(part.get('rotation',0));c,s=math.cos(angle),math.sin(angle)
 rotation=np.array([[c,0,s],[0,1,0],[-s,0,c]])
 corners=np.array([[x,y,z]for x in [lo[0],hi[0]]for y in [lo[1],hi[1]]for z in [lo[2],hi[2]]])@rotation.T
 low,high=corners.min(0),corners.max(0);scale=np.array(part['dimensions'])/(high-low)
 if part.get('preserveAspect'):scale[:]=scale.min()
 m=np.eye(4);m[:3,:3]=np.diag(scale)@rotation;m[:3,3]=np.array(part['position'])-np.array([(low[0]+high[0])/2,low[1],(low[2]+high[2])/2])*scale
 return m

def build_one(spec):
 doc={'asset':{'version':'2.0','generator':'Map Game Kenney static assembly v1'},'scene':0,'scenes':[{'nodes':[0]}],'nodes':[{'name':spec['id'],'children':[]}],'meshes':[],'materials':[],'textures':[],'images':[],'samplers':[{'magFilter':9728,'minFilter':9984,'wrapS':33071,'wrapT':33071}],'buffers':[{'byteLength':0}],'bufferViews':[],'accessors':[]};binary=bytearray();palette={};material={};rows=[];animated=[]
 def put(raw):
  while len(binary)%4:binary.append(0)
  v=len(doc['bufferViews']);doc['bufferViews'].append({'buffer':0,'byteOffset':len(binary),'byteLength':len(raw)});binary.extend(raw);return v
 def access(a,kind):
  a=np.asarray(a,dtype='<u4'if kind=='SCALAR'else'<f4');v=put(a.tobytes());i=len(doc['accessors']);doc['accessors'].append({'bufferView':v,'componentType':5125 if kind=='SCALAR'else 5126,'count':len(a),'type':kind,'min':np.min(a,axis=0).reshape(-1).tolist(),'max':np.max(a,axis=0).reshape(-1).tolist()});return i
 def mat(pack,source):
  # Preserve reviewed palette PBR and the factory kit's transparent glazing.
  pbr=source.get('pbrMetallicRoughness',{})
  if set(pbr)-{'baseColorTexture','baseColorFactor','roughnessFactor','metallicFactor'} or set(source)-{'name','doubleSided','pbrMetallicRoughness','alphaMode'}:raise ValueError('New material semantics require review')
  key=(pack,json.dumps({k:v for k,v in source.items()if k!='name'},sort_keys=True))
  if key in material:return material[key]
  copied={k:v for k,v in pbr.items()if k!='baseColorTexture'}
  if 'baseColorTexture' in copied:raise ValueError('Unexpected texture')
  if 'baseColorTexture' in pbr:
   if pack not in palette:
    png=finish((ROOT/'source'/pack/'Textures/colormap.png').read_bytes(),pack);image=len(doc['images']);doc['images'].append({'bufferView':put(png),'mimeType':'image/png','name':pack+'-palette'});palette[pack]=len(doc['textures']);doc['textures'].append({'sampler':0,'source':image})
   copied['baseColorTexture']={'index':palette[pack]}
  result=len(doc['materials']);doc['materials'].append({'name':pack+'-'+hashlib.sha256(key[1].encode()).hexdigest()[:12],'doubleSided':source.get('doubleSided',False),'alphaMode':source.get('alphaMode','OPAQUE'),'pbrMetallicRoughness':copied});material[key]=result;return result
 prepared=[]
 for part in spec['parts']:
  path=ROOT/'source'/part['pack']/(part['model']+'.glb');raw=path.read_bytes();d,b=glb(raw,allow_animation=True);a=info(raw)
  for node in d['nodes']:
   pose=part.get('pose',{}).get(node.get('name'))
   if pose:
    angle=math.radians(pose['degrees'])/2;q=[0,0,0,math.cos(angle)];q['xyz'.index(pose['axis'])]=math.sin(angle);node['rotation']=q
  geoms=geometry(d,b);points=np.concatenate([g['pos']for g in geoms]);m=transform(part,[points.min(0),points.max(0)])
  if part.get('animated'):
   animated.append({**part,'source':'source/'+part['pack']+'/'+part['model']+'.glb','matrix':m.flatten(order='F').tolist(),'animationCount':len(d.get('animations',[]))});continue
  if d.get('animations'):raise ValueError('Animated component must not be merged')
  prepared.append((part,d,geoms,m))
 prepared.extend(architectural_parts(spec['id']))
 for level,label in enumerate(['low','medium','high']):
  groups={};bounds=[];parts=0
  for part,d,geoms,m in prepared:
   if part['detail']>level:continue
   parts+=1
   for g in geoms:
    used,indices=np.unique(g['idx'],return_inverse=True);pos=(np.c_[g['pos'][used],np.ones(len(used))]@m.T)[:,:3];norm=g['norm'][used]@np.linalg.inv(m[:3,:3]);norm/=np.linalg.norm(norm,axis=1)[:,None]
    bounds.append(pos);key=mat(part.get('pack','authored'),d['materials'][g['material']]);groups.setdefault(key,[]).append((pos,norm,g['uv'][used],indices))
  group=len(doc['nodes']);doc['nodes'].append({'name':label,'children':[]});doc['nodes'][0]['children'].append(group);triangles=0
  bounds=[]
  for key,chunks in groups.items():
   positions=[];normals=[];uvs=[];indices=[];offset=0
   for pos,norm,uv,idx in chunks:positions.append(pos);normals.append(norm);uvs.append(uv);indices.append(idx+offset);offset+=len(pos)
   idx=np.concatenate(indices);pos=np.concatenate(positions);normal=np.concatenate(normals);uv=np.concatenate(uvs)
   if level<2:
    payload=[{'positions':pos.reshape(-1).tolist(),'normals':normal.reshape(-1).tolist(),'uv':uv.reshape(-1).tolist(),'indices':idx.tolist(),'ratio':.2 if level==0 else .65,'maxIndices':1200 if level==0 else len(idx),'error':.045 if level==0 else .012}]
    result=subprocess.run(['node',str(ROOT/'tools/simplify.cjs')],input=json.dumps(payload),text=True,capture_output=True,check=True,timeout=30)
    reduced=json.loads(result.stdout)[0];idx=np.array(reduced['indices'],dtype=np.uint32)
    if not len(idx) or len(idx)%3 or idx.max()>=len(pos):raise ValueError('Invalid simplified geometry')
   used,idx=np.unique(idx,return_inverse=True);pos=pos[used];normal=normal[used];uv=uv[used];bounds.append(pos);triangles+=len(idx)//3
   primitive={'attributes':{'POSITION':access(pos,'VEC3'),'NORMAL':access(normal,'VEC3'),'TEXCOORD_0':access(uv,'VEC2')},'indices':access(idx,'SCALAR'),'material':key}
   mesh=len(doc['meshes']);doc['meshes'].append({'name':label+'-'+str(key),'primitives':[primitive]});node=len(doc['nodes']);doc['nodes'].append({'name':label+'-'+str(key),'mesh':mesh});doc['nodes'][group]['children'].append(node)
  p=np.concatenate(bounds);lo,hi=p.min(0),p.max(0);fp=spec['footprint']
  if abs(lo[0])>fp[0]/2+.001 or abs(hi[0])>fp[0]/2+.001 or abs(lo[2])>fp[1]/2+.001 or abs(hi[2])>fp[1]/2+.001 or lo[1]<-.001:raise ValueError('Assembly outside logical footprint')
  rows.append({'lod':label,'triangles':triangles,'meshBatches':len(groups),'sourceParts':parts,'simplifier':None if level==2 else {'tool':'meshoptimizer@0.25.0','relativeErrorLimit':.045 if level==0 else .012,'retainsOriginalVertices':True,'preserveIslands':True,'uvWeight':10},'bounds':[lo.tolist(),hi.tolist()]})
 doc['buffers'][0]['byteLength']=len(binary)
 while len(binary)%4:binary.append(0)
 js=json.dumps(doc,separators=(',',':'),sort_keys=True).encode();js+=b' '*((-len(js))%4)
 output=struct.pack('<4sII',b'glTF',2,28+len(js)+len(binary))+struct.pack('<II',len(js),0x4e4f534a)+js+struct.pack('<II',len(binary),0x004e4942)+binary
 return output,rows,animated

def run():
 spec=json.loads((ROOT/'assemblies.json').read_text());out=ROOT/'generated';out.mkdir(exist_ok=True);manifest={'version':1,'sourceSpecSha256':hashlib.sha256((ROOT/'assemblies.json').read_bytes()).hexdigest(),'license':'CC0-1.0','finish':'industrial-neutral-v1; desaturated Kenney palettes + authored architectural PBR details; original terrain untouched','buildings':[]}
 pending=[]
 for building in spec['buildings']:
  raw,lods,animated=build_one(building);path=out/(building['id']+'.glb');pending.append((path,raw));manifest['buildings'].append({'id':building['id'],'label':building['label'],'footprint':building['footprint'],'url':'generated/'+path.name,'sha256':hashlib.sha256(raw).hexdigest(),'bytes':len(raw),'lods':lods,'animatedParts':animated})
 for path,raw in pending:path.write_bytes(raw)
 (ROOT/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n');print([(b['id'],[l['triangles']for l in b['lods']],b['bytes'])for b in manifest['buildings']])
if __name__=='__main__':run()
