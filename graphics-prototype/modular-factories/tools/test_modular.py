import hashlib,io,json,stat,struct,tempfile,unittest,zipfile
from pathlib import Path
import numpy as np
from packlib import safe_zip,glb,geometry,info
from build import ROOT,build_one

class PackSecurity(unittest.TestCase):
 def archive(self,names):
  f=Path(self.tmp.name)/'pack.zip'
  with zipfile.ZipFile(f,'w')as z:
   for n in names:z.writestr(n,b'safe')
  return f
 def setUp(self):self.tmp=tempfile.TemporaryDirectory()
 def tearDown(self):self.tmp.cleanup()
 def test_reject_traversal(self):
  for n in ['../secret','/absolute','C:/file','a\\b','a/../b','a//b','a/./b']:
   with self.subTest(n=n),self.assertRaises(ValueError):safe_zip(self.archive([n]))
 def test_reject_case_collision(self):
  with self.assertRaises(ValueError):safe_zip(self.archive(['a.glb','A.glb']))
 def test_reject_duplicate(self):
  with self.assertRaises(ValueError):safe_zip(self.archive(['a','a']))
 def test_reject_symlink(self):
  p=Path(self.tmp.name)/'link.zip'
  with zipfile.ZipFile(p,'w')as z:
   i=zipfile.ZipInfo('link');i.create_system=3;i.external_attr=(stat.S_IFLNK|0o777)<<16;z.writestr(i,'/private')
  with self.assertRaises(ValueError):safe_zip(p)
 def test_fingerprint(self):
  with self.assertRaises(ValueError):safe_zip(self.archive(['safe']),expected='0'*64)
 def test_safe_directory_and_file(self):
  z,_=safe_zip(self.archive(['safe/','safe/model.glb']));z.close()
 def test_invalid_glb(self):
  for raw in [b'',b'x'*64,struct.pack('<4sII',b'glTF',2,999)+b' '*24]:
   with self.subTest(raw=raw[:12]),self.assertRaises(ValueError):glb(raw)

class AssetContract(unittest.TestCase):
 @classmethod
 def setUpClass(cls):cls.spec=json.loads((ROOT/'assemblies.json').read_text());cls.manifest=json.loads((ROOT/'manifest.json').read_text());cls.audit=json.loads((ROOT/'asset-audit.json').read_text())
 def test_source_inventory(self):self.assertEqual([a['modelCount']for a in self.audit['archives']],[143,37,40])
 def test_selected_sources_hashes_and_license(self):
  for a in self.audit['archives']:
   self.assertIn('Creative Commons Zero, CC0',(ROOT/'source'/a['id']/'License.txt').read_text())
   for p in (ROOT/'source'/a['id']).glob('*.glb'):
    record=next(x for x in a['models']if Path(x['path']).name==p.name);self.assertEqual(hashlib.sha256(p.read_bytes()).hexdigest(),record['sha256'])
 def test_reproducible_preassembly(self):
  for spec in self.spec['buildings']:
   raw,lods,animated=build_one(spec);saved=next(b for b in self.manifest['buildings']if b['id']==spec['id']);self.assertEqual(raw,(ROOT/saved['url']).read_bytes());self.assertEqual(hashlib.sha256(raw).hexdigest(),saved['sha256']);self.assertEqual(lods,saved['lods'])
 def test_all_lods_fit_and_reduce_triangles(self):
  for b in self.manifest['buildings']:
   self.assertLessEqual(b['lods'][0]['triangles'],b['lods'][1]['triangles']);self.assertLessEqual(b['lods'][1]['triangles'],b['lods'][2]['triangles'])
   for lod in b['lods']:
    lo,hi=lod['bounds'];self.assertGreaterEqual(lo[1],-.001)
    for axis,span in [(0,b['footprint'][0]),(2,b['footprint'][1])]:self.assertGreaterEqual(lo[axis],-span/2-.001);self.assertLessEqual(hi[axis],span/2+.001)
 def test_no_external_dependencies_in_generated_static_assets(self):
  for b in self.manifest['buildings']:
   d,raw=glb((ROOT/b['url']).read_bytes());self.assertTrue(all('bufferView'in i and 'uri'not in i for i in d['images']));self.assertTrue(np.isfinite(np.concatenate([g['pos']for g in geometry(d,raw)])).all())
 def test_piston_animations_preserved_separately(self):
  spec=next(b for b in self.manifest['buildings']if b['id']=='machineWorks');part=spec['animatedParts'][0];self.assertEqual(part['animationCount'],3)
  with self.assertRaises(ValueError):glb((ROOT/part['source']).read_bytes())
  d,_=glb((ROOT/part['source']).read_bytes(),allow_animation=True);self.assertEqual(len(d['animations']),3)
 def test_original_palette_preserved(self):
  for a in self.audit['archives']:
   p=ROOT/'source'/a['id']/a['texture']['path'];self.assertEqual(hashlib.sha256(p.read_bytes()).hexdigest(),a['texture']['sha256'])

if __name__=='__main__':unittest.main()
