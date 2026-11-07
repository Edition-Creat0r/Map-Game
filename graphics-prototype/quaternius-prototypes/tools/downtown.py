"""Read the five pinned ZIPs as one bounded virtual archive; never execute pack text."""
import hashlib,json,struct
from pathlib import Path,PurePosixPath
from urllib.parse import unquote
from audit_assets import checked_zip,dependency
from gltf_geometry import geometry
import numpy as np
HASHES={1:'27f633d851807d8bb5014ffe18842ea8f6ac4ecb8bbc2bca32965aef5f5ce9e1',2:'3770a41f64500c4cb33afe4bd4cb400c990b68bd5df99c572e7d981b7163173b',3:'4802542fa8d7709cc2163200f558ee66c83fbada850f11b66b967ca20e77ef6e',4:'a4805653781895f127ddac408cefcf26c6fd3633f0b382134d7e15c9357bae4a',5:'e373cca2e259658a11e951c153bf28352087e62b0704914687a328016e1c091f'}
PREFIX='Exports/glTF (Godot)/'
def read_parts(paths):
 files={};owners={};case={};archives=[];total=0
 if len(paths)!=5:raise ValueError('Exactly five Downtown parts required')
 for number,path in enumerate(paths,1):
  z,digest=checked_zip(Path(path),HASHES[number])
  with z:
   archives.append({'part':number,'file':Path(path).name,'sha256':digest})
   for info in z.infolist():
    if info.is_dir():continue
    name=info.filename;raw=z.read(info);canonical=name.casefold()
    if canonical in case and case[canonical]!=name:raise ValueError('Cross-part case collision')
    if name in files and files[name]!=raw:raise ValueError('Conflicting cross-part duplicate')
    if name not in files:total+=len(raw);files[name]=raw
    if total>256*1024*1024:raise ValueError('Combined expansion limit')
    case[canonical]=name;owners.setdefault(name,[]).append(number)
 if b'CC0 1.0 Universal'not in files.get('License_Standard.txt',b''):raise ValueError('License requires review')
 return files,owners,archives

def model(files,name):
 path=PREFIX+name+'.gltf';d=json.loads(files[path]);binaries=d.get('buffers',[])
 if d.get('asset',{}).get('version')!='2.0' or len(binaries)!=1 or d.get('skins')or d.get('animations')or d.get('extensionsRequired'):raise ValueError('Unsupported glTF features')
 uri=dependency(path,unquote(binaries[0]['uri']));raw=files[uri]
 if len(raw)!=binaries[0]['byteLength']:raise ValueError('Binary size mismatch')
 for image in d.get('images',[]):
  if 'uri'not in image:raise ValueError('Embedded image needs review')
  ref=dependency(path,unquote(image['uri']))
  if not ref.endswith('.png') or ref not in files:raise ValueError('Missing/non-PNG image dependency')
 return d,geometry(d,raw)

def inventory(files,owners,archives):
 report={'version':1,'license':'CC0-1.0','archives':archives,'identicalCrossPartDuplicates':{n:p for n,p in owners.items()if len(p)>1},'models':[],'images':[],'packCodeExecuted':False}
 for path,raw in sorted(files.items()):
  if path.endswith('.gltf'):
   d,g=model(files,PurePosixPath(path).stem);p=np.concatenate([x['pos']for x in g]);refs=[dependency(path,unquote(x['uri']))for x in d.get('buffers',[])+d.get('images',[])]
   report['models'].append({'path':path,'sha256':hashlib.sha256(raw).hexdigest(),'triangles':sum(len(x['idx'])//3 for x in g),'bounds':[p.min(0).tolist(),p.max(0).tolist()],'materials':[x.get('name')for x in d.get('materials',[])],'dependencies':[{'path':n,'sha256':hashlib.sha256(files[n]).hexdigest()}for n in refs]})
  elif path.endswith('.png'):
   if raw[:8]!=b'\x89PNG\r\n\x1a\n' or raw[12:16]!=b'IHDR':raise ValueError('Invalid required PNG')
   w,h=struct.unpack_from('>II',raw,16)
   if not w or not h or w*h>64*1024*1024:raise ValueError('Image size limit')
   report['images'].append({'path':path,'sha256':hashlib.sha256(raw).hexdigest(),'width':w,'height':h,'bytes':len(raw)})
 return report
