import copy,hashlib,json,pathlib,stat,tempfile,unittest,zipfile
from create_pack import generate
from pack import load_zip,build,png
class PackTests(unittest.TestCase):
 def setUp(self):
  self.tmp=tempfile.TemporaryDirectory();self.root=pathlib.Path(self.tmp.name);self.good=self.root/'good.zip';self.m,self.blobs=generate(self.good)
 def tearDown(self):self.tmp.cleanup()
 def altered(self,manifest=None,extra=None,entries=None):
  target=self.root/'bad.zip'
  with zipfile.ZipFile(target,'w') as z:
   for n,b in (entries or {'manifest.json':json.dumps(manifest or self.m).encode(),**self.blobs,**(extra or {})}).items():z.writestr(n,b)
  return target
 def test_valid_build(self):
  self.assertEqual(load_zip(self.good)[0]['version'],1);dest=self.root/'built';build(self.good,dest);self.assertEqual(len(list(dest.rglob('*.png'))),5)
 def test_deterministic(self):
  other=self.root/'other.zip';generate(other);self.assertEqual(self.good.read_bytes(),other.read_bytes())
 def test_no_overwrite(self):
  with self.assertRaises(ValueError):build(self.good,self.root)
 def test_traversal(self):
  for name in ['../x.png','/tmp/x.png','textures/../x.png','C:/x.png','textures\\x.png']:
   entries={'manifest.json':json.dumps(self.m).encode(),**self.blobs};blob=entries.pop('textures/grass.png');entries[name]=blob
   destination=self.root/'unsafe-not-created'
   with self.assertRaises(ValueError):build(self.altered(entries=entries),destination)
   self.assertFalse(destination.exists())
 def test_extra_script(self):
  with self.assertRaises(ValueError):load_zip(self.altered(extra={'evil.js':b'alert(1)'}))
 def test_model_ids(self):
  m=copy.deepcopy(self.m);m['models'][0]['catalogId']='newFactory'
  with self.assertRaises(ValueError):load_zip(self.altered(m))
 def test_future_glb(self):
  m=copy.deepcopy(self.m);m['models'][0]['source']='glb'
  with self.assertRaises(ValueError):load_zip(self.altered(m))
 def test_hashes(self):
  m=copy.deepcopy(self.m);m['files'][0]['sha256']='0'*64
  with self.assertRaises(ValueError):load_zip(self.altered(m))
 def test_unknown_fields_and_versions(self):
  for key,value in [('version',2),('script','evil.js')]:
   m=copy.deepcopy(self.m);m[key]=value
   with self.assertRaises(ValueError):load_zip(self.altered(m))
 def test_duplicate_names(self):
  target=self.root/'duplicate.zip'
  with zipfile.ZipFile(target,'w') as z:
   for i in range(6):z.writestr('manifest.json',b'{}')
  with self.assertRaises(ValueError):load_zip(target)
 def test_symlink(self):
  target=self.root/'link.zip'
  with zipfile.ZipFile(target,'w') as z:
   z.writestr('manifest.json',json.dumps(self.m));
   for n,b in self.blobs.items():
    i=zipfile.ZipInfo(n);i.external_attr=(stat.S_IFLNK|0o777)<<16;z.writestr(i,b)
  with self.assertRaises(ValueError):load_zip(target)
 def test_bad_png_crc(self):
  b=bytearray(next(iter(self.blobs.values())));b[-1]^=1
  with self.assertRaises(ValueError):png(bytes(b))
 def test_duplicate_json_keys(self):
  raw=json.dumps(self.m).replace('"version": 1','"version": 1, "version": 1')
  with self.assertRaises(ValueError):load_zip(self.altered(entries={'manifest.json':raw.encode(),**self.blobs}))
 def test_nonfinite_json(self):
  raw=json.dumps(self.m).replace('"tileMeters": 4','"tileMeters": NaN',1)
  with self.assertRaises(ValueError):load_zip(self.altered(entries={'manifest.json':raw.encode(),**self.blobs}))
 def test_zip_expansion_rejected_before_build(self):
  entries={'manifest.json':json.dumps(self.m).encode(),**self.blobs};entries['textures/grass.png']=b'0'*400000
  target=self.root/'bomb.zip'
  with zipfile.ZipFile(target,'w',compression=zipfile.ZIP_DEFLATED) as z:
   for n,b in entries.items():z.writestr(n,b)
  destination=self.root/'not-created'
  with self.assertRaises(ValueError):build(target,destination)
  self.assertFalse(destination.exists())
 def test_oversized_png_dimensions(self):
  from create_pack import chunk
  import struct,zlib
  blob=b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('>IIBBBBB',2048,128,8,2,0,0,0))+chunk(b'IDAT',zlib.compress(b'x'))+chunk(b'IEND',b'')
  with self.assertRaises(ValueError):png(blob)
if __name__=='__main__':unittest.main()
