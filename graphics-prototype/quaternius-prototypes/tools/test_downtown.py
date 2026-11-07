"""Offline tests; no credentials, downloads, pack code or game state needed."""
import copy,hashlib,io,json,struct,unittest
from pathlib import Path
import numpy as np
from PIL import Image
from downtown import read_parts,model,PREFIX
from gltf_geometry import accessor,geometry
from build_downtown import box,cylinder
ROOT=Path(__file__).resolve().parents[1]

def triangle():
 raw=struct.pack('<9f9f6f3H',0,0,0,1,0,0,0,1,0,*([0,0,1]*3),0,0,1,0,0,1,0,1,2)
 d={'asset':{'version':'2.0'},'buffers':[{'uri':'t.bin','byteLength':len(raw)}],'bufferViews':[{'byteOffset':0,'byteLength':36},{'byteOffset':36,'byteLength':36},{'byteOffset':72,'byteLength':24},{'byteOffset':96,'byteLength':6}],'accessors':[{'bufferView':i,'count':3,'type':k,'componentType':c}for i,k,c in [(0,'VEC3',5126),(1,'VEC3',5126),(2,'VEC2',5126),(3,'SCALAR',5123)]],'meshes':[{'primitives':[{'attributes':{'POSITION':0,'NORMAL':1,'TEXCOORD_0':2},'indices':3}]}],'nodes':[{'mesh':0}],'scenes':[{'nodes':[0]}]}
 return d,raw

class ReaderTests(unittest.TestCase):
 def test_five_parts_mandatory(self):
  with self.assertRaises(ValueError):read_parts([])
 def test_geometry_transforms(self):
  d,b=triangle();d['nodes'][0]['translation']=[5,2,-1];g=geometry(d,b)[0];np.testing.assert_allclose(g['pos'][0],[5,2,-1])
 def test_reflection_winding(self):
  d,b=triangle();d['nodes'][0]['scale']=[-1,1,1];self.assertEqual(geometry(d,b)[0]['idx'].tolist(),[0,2,1])
 def test_cycle_rejected(self):
  d,b=triangle();d['nodes'][0]['children']=[0]
  with self.assertRaises(ValueError):geometry(d,b)
 def test_out_of_buffer_rejected(self):
  d,b=triangle();d['accessors'][0]['count']=4
  with self.assertRaises(ValueError):geometry(d,b)
 def test_sparse_rejected(self):
  d,b=triangle();d['accessors'][0]['sparse']={'count':1}
  with self.assertRaises(ValueError):geometry(d,b)
 def test_nonfinite_rejected(self):
  d,b=triangle();b=struct.pack('<f',float('nan'))+b[4:]
  with self.assertRaises(ValueError):geometry(d,b)
 def test_negative_accessor_rejected(self):
  d,b=triangle()
  with self.assertRaises(ValueError):accessor(d,b,-1)
 def test_float_indices_rejected(self):
  d,b=triangle();d['accessors'][3]['componentType']=5126
  with self.assertRaises(ValueError):geometry(d,b)
 def test_zero_normals_rejected(self):
  d,b=triangle();b=b[:36]+bytes(36)+b[72:]
  with self.assertRaises(ValueError):geometry(d,b)
 def test_negative_node_rejected(self):
  d,b=triangle();d['scenes'][0]['nodes']=[-1]
  with self.assertRaises(ValueError):geometry(d,b)
 def test_missing_image_rejected(self):
  d,b=triangle();d['images']=[{'uri':'missing.png'}]
  with self.assertRaises(ValueError):model({PREFIX+'t.gltf':json.dumps(d).encode(),PREFIX+'t.bin':b},'t')
 def test_external_dependency_rejected(self):
  d,b=triangle();d['buffers'][0]['uri']='https://example.com/t.bin'
  with self.assertRaises(ValueError):model({PREFIX+'t.gltf':json.dumps(d).encode()},'t')
 def test_unsupported_animation_rejected(self):
  d,b=triangle();d['animations']=[{}]
  with self.assertRaises(ValueError):model({PREFIX+'t.gltf':json.dumps(d).encode()},'t')
 def test_original_primitives_finite(self):
  for g in [box(np.array([2,4,3])),cylinder(2,4)]:
   self.assertTrue(np.isfinite(g['pos']).all());self.assertEqual(len(g['idx'])%3,0);self.assertLess(g['idx'].max(),len(g['pos']))

class ArtifactTests(unittest.TestCase):
 def setUp(self):self.m=json.loads((ROOT/'manifest.json').read_text())
 def test_glb_hash_and_headers(self):
  raw=(ROOT/self.m['url']).read_bytes();self.assertEqual(hashlib.sha256(raw).hexdigest(),self.m['sha256']);magic,version,length=struct.unpack_from('<4sII',raw);self.assertEqual((magic,version,length),(b'glTF',2,len(raw)))
 def test_only_approved_sources(self):
  self.assertFalse(self.m['kenneyUsed']);self.assertFalse(self.m['liveRendererEnabled']);self.assertFalse(self.m['paidShadersUsed']);self.assertTrue(all(s['path'].startswith(PREFIX)for s in self.m['sources'].values()));self.assertEqual(len(self.m['archives']),5)
 def test_lod_and_bounds(self):
  self.assertEqual(len(self.m['buildings']),3)
  for b in self.m['buildings']:
   self.assertEqual([l['name']for l in b['lods']],['low','medium','high']);tri=[l['triangles']for l in b['lods']];self.assertLess(tri[0],tri[1]);self.assertLessEqual(tri[1],tri[2]);self.assertEqual(b['pivot'],'base-center')
   for l in b['lods']:
    lo,hi=l['bounds'];w,d=b['footprint'];self.assertGreaterEqual(lo[1],-.001);self.assertLessEqual(max(abs(lo[0]),abs(hi[0])),w/2+.001);self.assertLessEqual(max(abs(lo[2]),abs(hi[2])),d/2+.001)
 def test_all_texture_hashes_sizes_and_normal_lengths(self):
  for t in self.m['textures']:
   raw=(ROOT/t['url']).read_bytes();self.assertEqual(hashlib.sha256(raw).hexdigest(),t['sha256']);im=Image.open(io.BytesIO(raw));self.assertEqual(list(im.size),t['size']);self.assertLessEqual(max(im.size),512 if t['role']=='normal-renormalized' or '_ORM' in t['source']else 1024)
   if t['role']=='normal-renormalized':
    a=np.asarray(im).astype(float)/127.5-1;self.assertLess(np.abs(np.linalg.norm(a,axis=2)-1).max(),.015)
 def test_complete_audit(self):
  audit=json.loads((ROOT/'downtown-audit.json').read_text());self.assertEqual(len(audit['models']),153);self.assertEqual(len(audit['images']),29);self.assertFalse(audit['packCodeExecuted']);self.assertEqual(audit['license'],'CC0-1.0')

if __name__=='__main__':unittest.main()
