import hashlib,stat,tempfile,unittest,zipfile
from pathlib import Path
from unittest.mock import patch
from audit_assets import checked_zip,dependency,obj_info,mtl_info,audit,REVIEWED
OBJ=b'v 0 0 0\nv 1 0 0\nv 0 1 0\nvt 0 0\nvt 1 0\nvt 0 1\nvn 0 0 1\nf 1/1/1 2/2/1 3/3/1\n'
class AuditTests(unittest.TestCase):
 def setUp(self):self.temp=tempfile.TemporaryDirectory();self.path=Path(self.temp.name)/'pack.zip'
 def tearDown(self):self.temp.cleanup()
 def write(self,entries):
  with zipfile.ZipFile(self.path,'w')as z:
   for name,raw in entries:z.writestr(name,raw)
  return self.path
 def test_obj_bounds_and_triangles(self):
  a=obj_info(OBJ);self.assertEqual(a['bounds'],[[0,0,0],[1,1,0]]);self.assertEqual(a['triangleEstimate'],1);self.assertEqual(a['texcoords'],3)
 def test_negative_indices(self):self.assertEqual(obj_info(b'v 0 0 0\nv 1 0 0\nv 0 1 0\nf -3 -2 -1')['triangleEstimate'],1)
 def test_ngon_count_is_explicit_estimate(self):self.assertEqual(obj_info(b'v 0 0 0\nv 1 0 0\nv 1 1 0\nv 0 1 0\nf 1 2 3 4')['triangleEstimate'],2)
 def test_bad_indices(self):
  for token in ['0','99','-99','1/99/1','1/1/99','1/1/1/1']:
   with self.subTest(token=token),self.assertRaises(ValueError):obj_info(OBJ.replace(b'1/1/1',token.encode(),1))
 def test_nonfinite_geometry(self):
  for n in ['nan','inf','-inf']:
   with self.subTest(n=n),self.assertRaises(ValueError):obj_info(OBJ.replace(b'v 0 0 0',('v '+n+' 0 0').encode(),1))
 def test_no_mesh_or_ambiguous_library(self):
  for data in [b'v 0 0 0',b'mtllib a b\n'+OBJ]:
   with self.assertRaises(ValueError):obj_info(data)
 def test_unknown_call_is_data_not_executed(self):self.assertEqual(obj_info(OBJ+b'call never_execute.py\n')['unsupportedDirectives'],['call'])
 def test_materials_fail_closed(self):
  for raw in [b'Kd 1 1 1',b'newmtl x\nnewmtl x',b'newmtl x\nKd nan 0 0']:
   with self.assertRaises(ValueError):mtl_info(raw)
 def test_material_maps_are_reported_not_guessed(self):self.assertEqual(mtl_info(b'newmtl x\nmap_Kd ../Textures/t.png')['materials']['x']['map_Kd'],'../Textures/t.png')
 def test_local_dependency_resolution(self):self.assertEqual(dependency('Pack/OBJ/model.obj','../Textures/t.png'),'Pack/Textures/t.png')
 def test_external_dependencies_rejected(self):
  for p in ['https://example.com/a','/private','C:/private','..\\private','../../../private']:
   with self.subTest(p=p),self.assertRaises(ValueError):dependency('Pack/OBJ/x.obj',p)
 def test_unsafe_archive_paths(self):
  for n in ['../private','/private','C:/private','x\\y','x//y','x/./y']:
   with self.subTest(n=n),self.assertRaises(ValueError):checked_zip(self.write([(n,b'a')]))
 def test_case_collision_and_symlink(self):
  with self.assertRaises(ValueError):checked_zip(self.write([('A',b'1'),('a',b'2')]))
  with zipfile.ZipFile(self.path,'w')as z:
   i=zipfile.ZipInfo('link');i.create_system=3;i.external_attr=(stat.S_IFLNK|0o777)<<16;z.writestr(i,'/private')
  with self.assertRaises(ValueError):checked_zip(self.path)
 def test_hash_gate(self):
  with self.assertRaises(ValueError):checked_zip(self.write([('safe',b'a')]),'0'*64)
 def test_read_only_audit_and_missing_texture_gate(self):
  prefix='Pack/Textured Models/OBJ/';data=b'mtllib x.mtl\nusemtl Texture\n'+OBJ
  p=self.write([('Pack/License.txt',b'CC0 1.0 Universal'),(prefix+'x.obj',data),(prefix+'x.mtl',b'newmtl Texture\nKd 1 1 1')]);before=p.read_bytes();files=list(Path(self.temp.name).iterdir())
  with patch.dict(REVIEWED,{'fixture':hashlib.sha256(before).hexdigest()}):result=audit(p,'fixture')
  self.assertEqual(p.read_bytes(),before);self.assertEqual(list(Path(self.temp.name).iterdir()),files);self.assertEqual(result['extractedFiles'],0);self.assertFalse(result['executedPackCode']);self.assertTrue(result['models'][0]['conversionBlocked']);self.assertTrue(result['models'][0]['textureAssociationNeedsReview'])
 def test_mislabeled_preview_is_reported_not_approved_as_texture(self):
  import io
  from PIL import Image
  blob=io.BytesIO();Image.new('RGB',(2,2),'white').save(blob,format='JPEG')
  p=self.write([('Pack/License.txt',b'CC0 1.0 Universal'),('Pack/model.obj',OBJ),('Pack/Preview.png',blob.getvalue())])
  with patch.dict(REVIEWED,{'fixture':hashlib.sha256(p.read_bytes()).hexdigest()}):r=audit(p,'fixture')
  self.assertEqual(r['images'][0]['detectedFormat'],'JPEG');self.assertTrue(r['images'][0]['extensionMismatch']);self.assertFalse(r['images'][0]['approvedForTextureBinding'])
 def test_mislabeled_required_texture_is_blocked(self):
  import io
  from PIL import Image
  blob=io.BytesIO();Image.new('RGB',(2,2),'white').save(blob,format='JPEG')
  p=self.write([('Pack/License.txt',b'CC0 1.0 Universal'),('Pack/model.obj',OBJ),('Pack/Textures/bad.png',blob.getvalue())])
  with patch.dict(REVIEWED,{'fixture':hashlib.sha256(p.read_bytes()).hexdigest()}),self.assertRaises(ValueError):audit(p,'fixture')
 def test_missing_texture_file_blocks_conversion(self):
  p=self.write([('Pack/License.txt',b'CC0 1.0 Universal'),('Pack/x.obj',b'mtllib x.mtl\nusemtl x\n'+OBJ),('Pack/x.mtl',b'newmtl x\nmap_Kd absent.png')])
  with patch.dict(REVIEWED,{'fixture':hashlib.sha256(p.read_bytes()).hexdigest()}):r=audit(p,'fixture')
  self.assertTrue(r['models'][0]['conversionBlocked']);self.assertEqual(r['models'][0]['unapprovedTextureDependencies'],['Pack/absent.png'])
 def test_preview_mismatch_cannot_be_used_as_texture(self):
  import io
  from PIL import Image
  b=io.BytesIO();Image.new('RGB',(2,2),'white').save(b,format='JPEG')
  p=self.write([('Pack/License.txt',b'CC0 1.0 Universal'),('Pack/x.obj',b'mtllib x.mtl\nusemtl x\n'+OBJ),('Pack/x.mtl',b'newmtl x\nmap_Kd Preview.png'),('Pack/Preview.png',b.getvalue())])
  with patch.dict(REVIEWED,{'fixture':hashlib.sha256(p.read_bytes()).hexdigest()}):r=audit(p,'fixture')
  self.assertTrue(r['models'][0]['conversionBlocked']);self.assertEqual(r['models'][0]['unapprovedTextureDependencies'],['Pack/Preview.png'])
if __name__=='__main__':unittest.main()
