"""Authored architectural geometry and restrained palette finish, not resource icons.
Original Kenney source textures and approved game terrain textures stay untouched.
"""
import io
import numpy as np
from PIL import Image,ImageEnhance

MATERIALS={
 'metal':{'name':'architectural-metal','pbrMetallicRoughness':{'baseColorFactor':[.20,.24,.26,1],'metallicFactor':.65,'roughnessFactor':.38}},
 'dark':{'name':'architectural-dark','pbrMetallicRoughness':{'baseColorFactor':[.045,.065,.08,1],'metallicFactor':.25,'roughnessFactor':.65}},
 'glass':{'name':'architectural-glass','alphaMode':'BLEND','pbrMetallicRoughness':{'baseColorFactor':[.17,.31,.37,.65],'metallicFactor':.2,'roughnessFactor':.2}},
 'paint':{'name':'architectural-paint','pbrMetallicRoughness':{'baseColorFactor':[.55,.58,.56,1],'metallicFactor':.10,'roughnessFactor':.8}},
 'light':{'name':'architectural-light','pbrMetallicRoughness':{'baseColorFactor':[.9,.75,.45,1],'metallicFactor':0,'roughnessFactor':.5}}}

def finish(raw,pack):
 if pack=='suburban':return raw
 im=Image.open(io.BytesIO(raw)).convert('RGBA');alpha=im.getchannel('A');rgb=ImageEnhance.Color(im.convert('RGB')).enhance(.20 if pack=='industrial'else .50);rgb=ImageEnhance.Contrast(rgb).enhance(1.06);rgb.putalpha(alpha);out=io.BytesIO();rgb.save(out,format='PNG',optimize=True);return out.getvalue()

def box(x,y,z,w,h,d):
 corners=np.array([[-w/2,-h/2,-d/2],[w/2,-h/2,-d/2],[w/2,h/2,-d/2],[-w/2,h/2,-d/2],[-w/2,-h/2,d/2],[w/2,-h/2,d/2],[w/2,h/2,d/2],[-w/2,h/2,d/2]])+np.array([x,y,z]);pos=[];norm=[];idx=[]
 for face in [(0,3,2,1),(4,5,6,7),(0,4,7,3),(1,2,6,5),(3,7,6,2),(0,1,5,4)]:
  p=corners[list(face)];n=np.cross(p[1]-p[0],p[2]-p[0]);n=n/np.linalg.norm(n);start=len(pos);pos.extend(p);norm.extend([n]*4);idx.extend(np.array([0,1,2,0,2,3])+start)
 return {'pos':np.array(pos),'norm':np.array(norm),'uv':np.zeros((24,2)),'idx':np.array(idx),'material':0}

def parts(id):
 result=[]
 def add(mat,x,y,z,w,h,d,detail=2):result.append(({'detail':detail},{'materials':[MATERIALS[mat]]},[box(x,y,z,w,h,d)],np.eye(4)))
 if id=='steelMill':
  # Recessed loading doors, metal ribs and clerestory strips on the hall facade.
  for x in [-35,-18,-1]:
   add('dark',x,5,-22.5,12,10,.5,1);add('metal',x,10.4,-23,12.8,.8,.9);add('light',x,11.1,-23.3,4,.25,.5)
   for y in [2,4,6,8]:add('metal',x,y,-22.85,11,.16,.25)
  for x in [-44,-27,-10,7,20]:add('metal',x,14,-22.7,.35,24,.5)
  add('glass',-10,19,-22.8,60,3,.25);add('metal',-10,17.3,-23,60,.35,.6)
 elif id=='precisionElectronicsWorks':
  add('glass',5,9,-7.3,39,12,.4,1)
  for x in [-14,-6,2,10,18,26]:add('metal',x,9,-7.7,.35,13,.55)
  add('metal',5,16,-7.8,43,1,2);add('paint',5,17.2,-7.6,43,1.2,1)
  for x in [-7,7,21]:
   add('metal',x,19.1,10,7,2,8);add('dark',x,20.2,10,5.6,.2,6)
   for z in [8,9,10,11,12]:add('paint',x,20.4,z,5.6,.14,.15)
  add('paint',-24,4,-9,12,.5,3,1)
 elif id=='machineWorks':
  add('dark',-14,5,-10.2,17,10,.35,1);add('metal',-14,10.5,-10.5,19,.8,1)
  for y in [2,4,6,8]:add('metal',-14,y,-10.5,16,.18,.22)
  for x in [-26,-20,-8,-2]:add('metal',x,9,-10.3,.3,16,.5)
  add('glass',-14,15,-10.3,20,2,.25);add('light',-14,11.3,-11,5,.3,.5)
 return result
