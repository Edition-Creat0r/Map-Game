"""Read-only Quaternius archive audit. Never extracts or executes pack contents."""
import argparse,collections,hashlib,json,math,posixpath,stat,struct,zipfile
from pathlib import Path,PurePosixPath

REVIEWED={
 'buildings-2019':'b3872787b4b08e9f0512acae6db1e418c00550a486b4624e56e9a02c9e2a6d41',
 'textured-2019':'26f2907064fbf0cc604e62ebb0b79f6137f3e93589e72af233d9eaaf507527ec'}
MAX_ENTRY=32*1024*1024

def checked_zip(path,expected=None):
 if path.stat().st_size>32*1024*1024:raise ValueError('Transfer/archive limit: 32 MiB')
 digest=hashlib.sha256(path.read_bytes()).hexdigest()
 if expected and digest!=expected:raise ValueError('Archive differs from reviewed fingerprint')
 z=zipfile.ZipFile(path);seen=set();total=0
 try:
  if len(z.infolist())>3000:raise ValueError('Archive entry limit')
  for i in z.infolist():
   p=PurePosixPath(i.filename);key=i.filename.rstrip('/').casefold();mode=i.external_attr>>16
   if not i.filename or p.is_absolute() or '..'in p.parts or ':'in i.filename or '\\'in i.filename or str(p)!=i.filename.rstrip('/') or key in seen:raise ValueError('Ambiguous/unsafe archive path')
   if stat.S_IFMT(mode)not in (0,stat.S_IFREG,stat.S_IFDIR):raise ValueError('Archive contains a link or special file')
   total+=i.file_size
   if i.flag_bits&1 or i.file_size>MAX_ENTRY or total>256*1024*1024:raise ValueError('Encrypted/oversized archive')
   seen.add(key)
  return z,digest
 except BaseException:z.close();raise

def dependency(parent,name):
 if not name or '\\'in name or ':'in name or name.startswith('/'):raise ValueError('External/unsafe dependency')
 result=posixpath.normpath(posixpath.join(posixpath.dirname(parent),name))
 if result=='..'or result.startswith('../'):raise ValueError('Dependency escapes archive')
 return result

def numbers(tokens,counts):
 if len(tokens)not in counts:raise ValueError('Unexpected numeric arity')
 values=[float(x)for x in tokens]
 if not all(math.isfinite(x)for x in values):raise ValueError('Nonfinite geometry/material value')
 return values

def index(token,count):
 n=int(token)
 if not n or (n>0 and n>count)or(n<0 and -n>count):raise ValueError('OBJ index outside declared data')
 return n-1 if n>0 else count+n

def obj_info(raw):
 if len(raw)>16*1024*1024:raise ValueError('OBJ size limit')
 positions=[];uv=[];normal_count=0;faces=collections.Counter();materials=set();libraries=[];unsupported=set()
 for line in raw.decode('utf-8-sig').splitlines():
  t=line.split('#',1)[0].split()
  if not t:continue
  key,*v=t
  if key=='v':
   a=numbers(v,{3,4})
   if len(a)==4 and a[3]!=1:raise ValueError('Unsupported homogeneous vertex')
   positions.append(a[:3])
  elif key=='vt':uv.append(numbers(v,{2,3})[:2])
  elif key=='vn':numbers(v,{3});normal_count+=1
  elif key=='f':
   if len(v)<3 or len(v)>64:raise ValueError('Unsupported polygon arity')
   for item in v:
    parts=item.split('/')
    if len(parts)>3 or not parts[0]:raise ValueError('Invalid OBJ face token')
    index(parts[0],len(positions))
    if len(parts)>1 and parts[1]:index(parts[1],len(uv))
    if len(parts)>2 and parts[2]:index(parts[2],normal_count)
   faces[len(v)]+=1
  elif key=='usemtl':materials.add(' '.join(v))
  elif key=='mtllib':
   if len(v)!=1:raise ValueError('Ambiguous material library filename')
   libraries.append(v[0])
  elif key not in {'o','g','s'}:unsupported.add(key)
 if not positions or not faces:raise ValueError('No polygon mesh')
 return {'vertices':len(positions),'texcoords':len(uv),'normals':normal_count,'bounds':[[min(p[a]for p in positions)for a in range(3)],[max(p[a]for p in positions)for a in range(3)]],'faceSizes':dict(faces),'triangleEstimate':sum((n-2)*count for n,count in faces.items()),'materials':sorted(materials),'libraries':libraries,'unsupportedDirectives':sorted(unsupported),'uvBounds':[[min(p[a]for p in uv)for a in range(2)],[max(p[a]for p in uv)for a in range(2)]]if uv else None}

def mtl_info(raw):
 result={};current=None;unknown=set()
 for line in raw.decode('utf-8-sig').splitlines():
  t=line.split('#',1)[0].split()
  if not t:continue
  key,*v=t
  if key=='newmtl':
   current=' '.join(v)
   if not current or current in result:raise ValueError('Duplicate/empty material')
   result[current]={}
  elif current is None:raise ValueError('Material property before newmtl')
  elif key in {'Kd','Ka','Ks','Ke'}:result[current][key]=numbers(v,{3})
  elif key in {'Ns','Ni','d','Tr','illum'}:result[current][key]=numbers(v,{1})[0]
  elif key.startswith('map_')or key in {'bump','norm'}:result[current][key]=' '.join(v)
  else:unknown.add(key)
 return {'materials':result,'unsupportedDirectives':sorted(unknown)}

def audit(path,key):
 z,digest=checked_zip(path,REVIEWED[key])
 with z:
  entries=z.namelist();licenses=[n for n in entries if PurePosixPath(n).name.casefold()in {'license.txt','licence.txt'}]
  if len(licenses)!=1:raise ValueError('Expected one reviewable license')
  notice=z.read(licenses[0]).decode('utf8')
  if 'CC0 1.0 Universal'not in notice:raise ValueError('License needs separate review')
  materials={n:mtl_info(z.read(n))for n in entries if n.lower().endswith('.mtl')}
  models=[]
  for name in entries:
   if not name.lower().endswith('.obj'):continue
   raw=z.read(name);info=obj_info(raw);referenced={};missing=[]
   for lib in info['libraries']:
    resolved=dependency(name,lib)
    if resolved not in materials:missing.append(resolved);continue
    referenced[resolved]=materials[resolved]
   definitions={k for lib in referenced.values()for k in lib['materials']}
   missing_materials=sorted(set(info['materials'])-definitions)
   texture_bindings=[]
   for mtl,lib in referenced.items():
    for mat,props in lib['materials'].items():
     for prop,value in props.items():
      if prop.startswith('map_')or prop in {'bump','norm'}:
       # Options/spaces need manual review; never guess or load an external URI.
       if value.startswith('-'):raise ValueError('Texture map options need explicit review')
       resolved=dependency(mtl,value);texture_bindings.append({'material':mat,'property':prop,'path':resolved,'exists':resolved in entries})
   models.append({'path':name,'sha256':hashlib.sha256(raw).hexdigest(),'bytes':len(raw),**info,'materialLibraries':referenced,'missingLibraries':missing,'undefinedMaterials':missing_materials,'textureBindings':texture_bindings,'textureAssociationNeedsReview':('/Textured Models/'in name and not texture_bindings),'conversionBlocked':bool(missing or missing_materials or info['unsupportedDirectives']or('/Textured Models/'in name and not texture_bindings))})
  images=[]
  for n in entries:
   if n.lower().endswith('.png'):
    raw=z.read(n)
    mismatch=False;detected='PNG'
    if raw[:8]==b'\x89PNG\r\n\x1a\n' and raw[12:16]==b'IHDR':w,h=struct.unpack_from('>II',raw,16)
    elif raw[:3]==b'\xff\xd8\xff' and '/Textures/'not in n:
     # Known mislabeled preview: report it, never approve it as a PNG texture.
     import io
     from PIL import Image
     with Image.open(io.BytesIO(raw))as im:w,h=im.size;detected=im.format
     mismatch=True
    else:raise ValueError('Invalid or mislabeled required PNG texture')
    if not w or not h or w*h>64*1024*1024:raise ValueError('Image dimension limit')
    images.append({'path':n,'width':w,'height':h,'detectedFormat':detected,'extensionMismatch':mismatch,'approvedForTextureBinding':not mismatch,'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest()})
  approved_images={i['path']for i in images if i['approvedForTextureBinding']}
  for model in models:
   invalid=[ref['path']for ref in model['textureBindings']if not ref['exists']or ref['path']not in approved_images]
   model['unapprovedTextureDependencies']=invalid
   if invalid:model['conversionBlocked']=True
  return {'id':key,'archive':path.name,'sha256':digest,'archiveBytes':path.stat().st_size,'expandedBytes':sum(i.file_size for i in z.infolist()),'formats':dict(collections.Counter(PurePosixPath(n).suffix.lower()for n in entries if not n.endswith('/'))),'license':{'path':licenses[0],'identifier':'CC0-1.0','notice':notice},'models':models,'images':images,'executedPackCode':False,'extractedFiles':0}

if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--buildings',type=Path,required=True);p.add_argument('--textured',type=Path,required=True);p.add_argument('--output',type=Path,required=True);a=p.parse_args()
 data={'version':1,'scope':'Read-only source audit; no converted/rendered models','packs':[audit(a.buildings,'buildings-2019'),audit(a.textured,'textured-2019')]}
 a.output.parent.mkdir(parents=True,exist_ok=True);a.output.write_text(json.dumps(data,indent=2)+'\n');print('Audited',sum(len(p['models'])for p in data['packs']),'OBJ exports; pack code executed: none; archive extraction: none.')
