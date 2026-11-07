"""Offline Quaternius-only pilot builder. Reads pinned ZIPs; never extracts code.
Requires Python 3, NumPy and Pillow. Outputs only generated/ and manifest.json.
"""
import argparse,copy,hashlib,io,json,math,struct
from pathlib import Path
import numpy as np
from PIL import Image
from far_lod import bake_wall,wall,roof
from downtown import read_parts,model,inventory,PREFIX,dependency
ROOT=Path(__file__).resolve().parents[1]
IDS=[('steelMill','Steel Mill',[118,92]),('precisionElectronicsWorks','Electronics Plant',[80,66]),('machineWorks','Machinery Works',[64,54])]
COLORS={'steel':[.26,.29,.31,1],'paint':[.13,.23,.28,1],'yellow':[.61,.39,.10,1],'rubber':[.055,.065,.07,1],'concrete':[.36,.37,.35,1]}

def rotation(angle):
 c,s=math.cos(angle),math.sin(angle);return np.array([[c,0,s],[0,1,0],[-s,0,c]])

def box(size):
 # Authored unit cube with independent face normals and UVs.
 p=[];n=[];uv=[];idx=[]
 for axis,sgn in [(0,1),(0,-1),(1,1),(1,-1),(2,1),(2,-1)]:
  norm=np.zeros(3);norm[axis]=sgn;other=[a for a in range(3)if a!=axis]
  a=np.zeros(3);a[other[0]]=1;b=np.cross(norm,a);center=norm*.5
  k=len(p)
  for u,v in [(-.5,-.5),(.5,-.5),(.5,.5),(-.5,.5)]:p.append((center+a*u+b*v)*size);n.append(norm);uv.append([u+.5,v+.5])
  idx.extend([k,k+1,k+2,k,k+2,k+3])
 return dict(pos=np.array(p),norm=np.array(n),uv=np.array(uv),idx=np.array(idx),material=0)

def cylinder(radius,height,segments=12):
 p=[];n=[];uv=[];idx=[]
 for i in range(segments):
  a,b=i*2*math.pi/segments,(i+1)*2*math.pi/segments;k=len(p)
  for t,y in [(a,0),(a,height),(b,height),(b,0)]:p.append([radius*math.cos(t),y,radius*math.sin(t)]);n.append([math.cos(t),0,math.sin(t)]);uv.append([t/(2*math.pi),y/max(height,1)])
  idx.extend([k,k+1,k+2,k,k+2,k+3])
  for y,sgn in [(0,-1),(height,1)]:
   k=len(p);p.extend([[0,y,0],[radius*math.cos(a),y,radius*math.sin(a)],[radius*math.cos(b),y,radius*math.sin(b)]]);n.extend([[0,sgn,0]]*3);uv.extend([[.5,.5],[0,0],[1,1]]);idx.extend([k,k+1,k+2]if sgn<0 else[k,k+2,k+1])
 return dict(pos=np.array(p),norm=np.array(n),uv=np.array(uv),idx=np.array(idx),material=0)

def build(paths):
 files,owners,archives=read_parts(paths);audit=inventory(files,owners,archives)
 out=ROOT/'generated';out.mkdir(exist_ok=True);textures=out/'textures';textures.mkdir(exist_ok=True)
 d={'asset':{'version':'2.0','generator':'Map Game Quaternius pilot v1'},'scene':0,'scenes':[{'nodes':[]}],'nodes':[],'meshes':[],'materials':[],'images':[],'textures':[],'samplers':[{'magFilter':9729,'minFilter':9987,'wrapS':10497,'wrapT':10497}],'accessors':[],'bufferViews':[],'buffers':[{'byteLength':0}]}
 binary=bytearray();materialCache={};textureCache={};sourceCache={};sources={};imageReport=[];farMaterials={}
 def put(a,kind):
  a=np.asarray(a,dtype='<u4'if kind=='SCALAR'else'<f4')
  if not np.isfinite(a).all():raise ValueError('Nonfinite output')
  while len(binary)%4:binary.append(0)
  v=len(d['bufferViews']);d['bufferViews'].append({'buffer':0,'byteOffset':len(binary),'byteLength':a.nbytes});binary.extend(a.tobytes());i=len(d['accessors']);d['accessors'].append({'bufferView':v,'componentType':5125 if kind=='SCALAR'else 5126,'count':len(a),'type':kind,'min':a.min(0).reshape(-1).tolist(),'max':a.max(0).reshape(-1).tolist()});return i
 def texture(src,normal):
  key=(src,normal)
  if key in textureCache:return textureCache[key]
  raw=files[src];im=Image.open(io.BytesIO(raw));im.load();im=im.convert('RGB'if normal else'RGBA');original=im.size;limit=512 if normal or '_ORM' in src else 1024
  im.thumbnail((limit,limit),Image.Resampling.LANCZOS)
  if normal:
   a=np.asarray(im).astype(float)/127.5-1;a/=np.maximum(np.linalg.norm(a,axis=2,keepdims=True),1e-8);im=Image.fromarray(np.round((a+1)*127.5).clip(0,255).astype('uint8'))
  buf=io.BytesIO();im.save(buf,format='PNG',optimize=True);rawout=buf.getvalue();name=Path(src).stem+('-normal'if normal else'')+'.png';(textures/name).write_bytes(rawout)
  i=len(d['textures']);d['images'].append({'uri':'textures/'+name});d['textures'].append({'source':len(d['images'])-1,'sampler':0});textureCache[key]=i
  imageReport.append({'source':src,'sourceSha256':hashlib.sha256(raw).hexdigest(),'url':'generated/textures/'+name,'sha256':hashlib.sha256(rawout).hexdigest(),'sourceSize':original,'size':im.size,'role':'normal-renormalized'if normal else'color-or-ORM','estimatedRgbaMipBytes':im.width*im.height*4*4//3})
  return i
 def material(source,doc=None,name=None):
  m=copy.deepcopy(source)
  for owner,key,normal in [(m,'normalTexture',True),(m.get('pbrMetallicRoughness',{}),'baseColorTexture',False),(m.get('pbrMetallicRoughness',{}),'metallicRoughnessTexture',False)]:
   if key in owner:
    src=doc['images'][doc['textures'][owner[key]['index']]['source']]['uri'];owner[key]['index']=texture(dependency(PREFIX+'x.gltf',src),normal)
  # Explicit authored dark interior finish; no paid fake-interior/parallax shader.
  if m.get('name')=='MI_FakeInterior':m['pbrMetallicRoughness']['baseColorFactor']=[.085,.12,.14,1]
  # Closed assembled shells do not need the pack's interior-facing surfaces.
  m['doubleSided']=False
  if name:m['name']='Original-'+name
  canonical=json.dumps(m,sort_keys=True)
  if canonical not in materialCache:materialCache[canonical]=len(d['materials']);d['materials'].append(m)
  return materialCache[canonical]
 def authored(name):return material({'pbrMetallicRoughness':{'baseColorFactor':COLORS[name],'metallicFactor':.65 if name=='steel'else.12,'roughnessFactor':.55}},name=name)
 for id,label,fp in IDS:
  root=len(d['nodes']);d['nodes'].append({'name':id,'children':[]});d['scenes'][0]['nodes'].append(root);lods=[];usedSource=set();originalParts=set()
  for level,lod in enumerate(['low','medium','high']):
   groups={};partCount=0
   def add(g,mat,pos=(0,0,0),scale=1,angle=0):
    nonlocal partCount
    r=rotation(angle);p=g['pos']*scale@r.T+np.array(pos);n=g['norm']@r.T;groups.setdefault(mat,[]).append((p,n,g['uv'],g['idx']));partCount+=1
   def native(name):
    usedSource.add(name)
    if name not in sourceCache:sourceCache[name]=model(files,name)
    doc,geometry=sourceCache[name]
    sources[name]={'path':PREFIX+name+'.gltf','sha256':hashlib.sha256(files[PREFIX+name+'.gltf']).hexdigest()}
    return doc,geometry
   def source(name,pos=(0,0,0),scale=3,angle=0):
    doc,geometry=native(name)
    for g in geometry:
     mat=doc['materials'][g['material']]
     if mat.get('name')=='MI_InteriorWall':continue
     add(g,material(mat,doc),pos,scale,angle)
   def far_material(name):
    doc,geoms=native(name)
    if name not in farMaterials:
     raw=bake_wall(doc,geoms,files);filename='Far-'+name+'.png';(textures/filename).write_bytes(raw)
     textureIndex=len(d['textures']);d['images'].append({'uri':'textures/'+filename});d['textures'].append({'source':len(d['images'])-1,'sampler':0})
     imageReport.append({'source':PREFIX+name+'.gltf','sourceSha256':hashlib.sha256(files[PREFIX+name+'.gltf']).hexdigest(),'url':'generated/textures/'+filename,'sha256':hashlib.sha256(raw).hexdigest(),'sourceSize':[128,192],'size':[128,192],'role':'far-wall-bake','projection':'native 2x3 source-unit front face; source UV/color only','estimatedRgbaMipBytes':128*192*4*4//3})
     farMaterials[name]=len(d['materials']);d['materials'].append({'name':'Far-'+name,'pbrMetallicRoughness':{'baseColorTexture':{'index':textureIndex},'metallicFactor':0,'roughnessFactor':.8},'doubleSided':False})
    return farMaterials[name]
   def cube(name,size,pos,detail=0):
    if detail>level:return
    originalParts.add(name);add(box(np.array(size)),authored(name),pos)
   def pipe(name,r,h,pos,detail=0):
    if detail>level:return
    originalParts.add(name);add(cylinder(r,h,16 if level==2 else 8),authored(name),pos)
   def shell(cx,cz,w,depth,floors,metal=False):
    if level==0:
     mat=far_material('Metal_Plain_3'if metal else'Brick_Plain_3')
     for width,pos,angle in [(w,(cx,0,cz-depth/2),math.pi),(w,(cx,0,cz+depth/2),0),(depth,(cx-w/2,0,cz),-math.pi/2),(depth,(cx+w/2,0,cz),math.pi/2)]:add(wall(width,floors*9),mat,pos,angle=angle)
     doc,geoms=native('Roof_2x2');add(roof(w,depth),material(doc['materials'][geoms[0]['material']],doc),(cx,floors*9,cz))
     for x,z,ww,dd in [(cx,cz-depth/2,w,.5),(cx,cz+depth/2,w,.5),(cx-w/2,cz,.5,depth),(cx+w/2,cz,.5,depth)]:cube('concrete',(ww,1,dd),(x,floors*9,z))
     return
    # Uniform 3x native modules. No stretching brick/window UVs.
    for floor in range(floors):
     for along,count,angle,edge in [('x',w//6,math.pi,cz-depth/2),('x',w//6,0,cz+depth/2),('z',depth//6,-math.pi/2,cx-w/2),('z',depth//6,math.pi/2,cx+w/2)]:
      for j in range(int(count)):
       if level==0:name='Metal_Plain_3'if metal else'Brick_Plain_3'
       elif metal:name='Metal_FirstFloor_Window'if(j+floor)%3!=0 else'Metal_Plain_3'
       else:name='Brick_RedWhite_DoubleWindow'if level==2 else'Brick_Window_Square_Single'
       # Four-unit brick windows occupy two wall cells.
       if level==2 and not metal:
        if j%2:continue
        if j+1>=count:name='Brick_Plain_3';offset=3
        else:offset=6
       else:offset=3
       coord=(cx-w/2+j*6+offset if along=='x'else cz-depth/2+j*6+offset)
       pos=(coord if along=='x'else edge,floor*9,edge if along=='x'else coord)
       if level==1:add(wall(6,9),far_material(name),pos,angle=angle)
       else:source(name,pos,angle=angle)
    # Roof tiles retain native asphalt UV density.
    if level==1:
     doc,geoms=native('Roof_2x2');add(roof(w,depth),material(doc['materials'][geoms[0]['material']],doc),(cx,floors*9,cz))
    else:
     for x in np.arange(cx-w/2+3,cx+w/2,6):
      for z in np.arange(cz-depth/2+3,cz+depth/2,6):source('Roof_2x2',(x,floors*9+.6,z))
    for x,z,ww,dd in [(cx,cz-depth/2,w,.5),(cx,cz+depth/2,w,.5),(cx-w/2,cz,.5,depth),(cx+w/2,cz,.5,depth)]:cube('concrete',(ww,1,dd),(x,floors*9,z))
    if level>0:
     for x in [cx-w/4,cx+w/4]:source('Prop_ACUnit',(x,floors*9+.05,cz),scale=5)
   if id=='steelMill':
    shell(-10,8,72,48,2)
    for x,h in [(39,44),(49,36)]:
     pipe('steel',2.5,h,(x,0,24));pipe('paint',3.1,1.3,(x,h-2,24),1)
    cube('steel',(19,14,22),(41,7,-2));cube('paint',(14,3,12),(41,15,-2),1)
    # Authored gantry, loading shutters and conveyor; decorative only.
    for x in [-36,18]:cube('yellow',(1.3,19,1.3),(x,9.5,-29))
    cube('yellow',(56,2,2),(-9,19,-29));cube('steel',(3,4,3),(-3,16,-29),1)
    for x in [-28,-4,20]:
     cube('steel',(9,8,.8),(x,4,-16.8))
     for y in range(1,8):cube('paint',(8.6,.12,.1),(x,y,-17.3),2)
    cube('steel',(10,2,16),(40,1,-29),1)
    for z in range(-35,-22,2):cube('rubber',(10,.5,.8),(40,2,z),2)
   elif id=='precisionElectronicsWorks':
    shell(-9,5,48,36,2,True);shell(24,6,12,24,1,True)
    for x in [-20,-2,16]:cube('paint',(9,1,5),(x,19,-4),1)
    cube('steel',(44,1,8),(-7,.6,-22))
    for x in [-20,-6,8]:
     cube('paint',(6,3,5),(x,2,-22),1);pipe('yellow',.65,5,(x,3,-22),2);cube('yellow',(5,.7,.7),(x+1.5,7.5,-22),2)
   else:
    shell(-5,4,42,30,2)
    for x in [-24,20]:cube('yellow',(1.1,15,1.1),(x,7.5,-18))
    cube('yellow',(46,1.8,1.8),(-2,15,-18));cube('steel',(3,3,3),(2,12,-18),1)
    for x in [-16,0,16]:
     cube('steel',(8,7,.6),(x,3.5,-11.4));cube('paint',(7,2,5),(x,1,-20),1)
     for z in [-21,-19]:cube('steel',(6,.6,.6),(x,2.4,z),2)
   # Footprint plinth, no terrain texture replacement.
   cube('concrete',(fp[0]-.8,.25,fp[1]-.8),(0,.125,0))
   group=len(d['nodes']);d['nodes'].append({'name':lod,'children':[]});d['nodes'][root]['children'].append(group);tri=0;allp=[]
   for mat,chunks in groups.items():
    ps=[];ns=[];uvs=[];indices=[];offset=0
    for p,n,uv,idx in chunks:ps.append(p);ns.append(n);uvs.append(uv);indices.append(idx+offset);offset+=len(p)
    p=np.concatenate(ps);n=np.concatenate(ns);uv=np.concatenate(uvs);idx=np.concatenate(indices);tri+=len(idx)//3;allp.append(p)
    mesh=len(d['meshes']);d['meshes'].append({'name':id+'-'+lod+'-'+str(mat),'primitives':[{'attributes':{'POSITION':put(p,'VEC3'),'NORMAL':put(n,'VEC3'),'TEXCOORD_0':put(uv,'VEC2')},'indices':put(idx,'SCALAR'),'material':mat}]});node=len(d['nodes']);d['nodes'].append({'name':lod+'-'+str(mat),'mesh':mesh});d['nodes'][group]['children'].append(node)
   p=np.concatenate(allp);lo=p.min(0);hi=p.max(0)
   if lo[1]<-.001 or max(abs(lo[0]),abs(hi[0]))>fp[0]/2+.001 or max(abs(lo[2]),abs(hi[2]))>fp[1]/2+.001:raise ValueError('Outside canonical footprint: '+id)
   lods.append({'name':lod,'triangles':tri,'meshBatches':len(groups),'bounds':[lo.tolist(),hi.tolist()],'parts':partCount})
  audit.setdefault('pilots',[]).append({'id':id,'label':label,'footprint':fp,'lods':lods,'sourceModules':sorted(usedSource),'originalFinishRoles':sorted(originalParts),'pivot':'base-center','gameplayEnabled':False})
 d['buffers'][0]['byteLength']=len(binary)
 while len(binary)%4:binary.append(0)
 js=json.dumps(d,sort_keys=True,separators=(',',':')).encode();js+=b' '*((-len(js))%4)
 raw=struct.pack('<4sII',b'glTF',2,28+len(js)+len(binary))+struct.pack('<II',len(js),0x4e4f534a)+js+struct.pack('<II',len(binary),0x004e4942)+binary;(out/'pilots.glb').write_bytes(raw)
 manifest={'version':1,'license':'CC0-1.0','url':'generated/pilots.glb','sha256':hashlib.sha256(raw).hexdigest(),'bytes':len(raw),'buildings':audit['pilots'],'sources':sources,'archives':archives,'textures':imageReport,'sourceArchivesAltered':False,'geometrySource':'Quaternius Downtown Standard; original industrial primitives','kenneyUsed':False,'liveRendererEnabled':False,'paidShadersUsed':False,'staticProps':True,'texturePolicy':'Color <=1024; normal/ORM <=512; renormalized normal maps. Original source archive untouched. No synthetic AO.'}
 (ROOT/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n');(ROOT/'downtown-audit.json').write_text(json.dumps(audit,indent=2)+'\n')
 (ROOT/'License_Standard.txt').write_text('\n'.join(l.rstrip()for l in files['License_Standard.txt'].decode().splitlines())+'\n')
 print(json.dumps({'models':len(audit['models']),'textures':len(imageReport),'bytes':len(raw),'pilots':[{x['id']:[l['triangles']for l in x['lods']]}for x in audit['pilots']]}))

if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--parts',nargs=5,required=True,help='Five pinned ZIP files, in numeric order');a=p.parse_args();build(a.parts)
