import io,unittest
import numpy as np
from PIL import Image
from far_lod import wall,roof,bake_wall
class FarTests(unittest.TestCase):
 def test_wall_uv_density(self):
  g=wall(72,18);self.assertEqual(len(g['idx']),6);np.testing.assert_allclose(g['uv'].max(0),[12,2]);self.assertEqual(g['pos'][:,1].max(),18)
 def test_roof_winding(self):
  g=roof(72,48);p=g['pos'][g['idx'][:3]];self.assertGreater(np.cross(p[1]-p[0],p[2]-p[0])[1],0)
 def test_uncovered_tile_fails(self):
  with self.assertRaises(ValueError):bake_wall({'materials':[]},[],{})
 def test_deterministic_native_basecolor_projection(self):
  g=wall(2,3);g['pos'][:,1]*=1;g['uv']=np.array([[0,1],[1,1],[1,0],[0,0]]);doc={'materials':[{'pbrMetallicRoughness':{'baseColorFactor':[.5,.5,.5,1]}}]};a=bake_wall(doc,[g],{});self.assertEqual(a,bake_wall(doc,[g],{}));im=Image.open(io.BytesIO(a));self.assertEqual(im.size,(128,192));np.testing.assert_allclose(np.asarray(im),188)
if __name__=='__main__':unittest.main()
