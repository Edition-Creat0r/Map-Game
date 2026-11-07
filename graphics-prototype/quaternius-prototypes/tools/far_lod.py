"""Bake native Quaternius wall UVs to a small repeatable far tile. No new artwork.
Only Low LOD uses these caches. High/Medium geometry and textures are untouched.
"""
import io
import numpy as np
from PIL import Image
from downtown import PREFIX,dependency

def bake_wall(doc,geoms,files,width=128,height=192):
 color=np.full((height,width,3),100.,dtype=float);depth=np.full((height,width),-np.inf)
 images={}
 for g in geoms:
  mat=doc['materials'][g['material']]
  if mat.get('name')=='MI_InteriorWall':continue
  pbr=mat.get('pbrMetallicRoughness',{});linear=np.array([.085,.12,.14]if mat.get('name')=='MI_FakeInterior'else pbr.get('baseColorFactor',[1,1,1,1])[:3]);factor=np.where(linear<=.0031308,linear*12.92,1.055*linear**(1/2.4)-.055)*255
  tex=pbr.get('baseColorTexture');image=None
  if tex:
   path=dependency(PREFIX+'tile.gltf',doc['images'][doc['textures'][tex['index']]['source']]['uri'])
   if path not in images:
    with Image.open(io.BytesIO(files[path]))as im:images[path]=np.asarray(im.convert('RGB')).astype(float)
   image=images[path]
  for idx in g['idx'].reshape(-1,3):
   p=g['pos'][idx];norm=g['norm'][idx]
   if norm[:,2].mean()<.2:continue
   xy=np.c_[(p[:,0]+1)*width/2,(3-p[:,1])*height/3]
   lo=np.maximum(np.floor(xy.min(0)).astype(int),0);hi=np.minimum(np.ceil(xy.max(0)).astype(int),[width-1,height-1])
   if np.any(lo>hi):continue
   xs,ys=np.meshgrid(np.arange(lo[0],hi[0]+1)+.5,np.arange(lo[1],hi[1]+1)+.5);a,b,c=xy;den=(b[1]-c[1])*(a[0]-c[0])+(c[0]-b[0])*(a[1]-c[1])
   if abs(den)<1e-8:continue
   u=((b[1]-c[1])*(xs-c[0])+(c[0]-b[0])*(ys-c[1]))/den;v=((c[1]-a[1])*(xs-c[0])+(a[0]-c[0])*(ys-c[1]))/den;w=1-u-v
   z=u*p[0,2]+v*p[1,2]+w*p[2,2];target=depth[lo[1]:hi[1]+1,lo[0]:hi[0]+1];mask=(u>=-1e-6)&(v>=-1e-6)&(w>=-1e-6)&(z>=target)
   rgb=np.broadcast_to(factor,(*u.shape,3)).copy()
   if image is not None:
    uv=u[...,None]*g['uv'][idx[0]]+v[...,None]*g['uv'][idx[1]]+w[...,None]*g['uv'][idx[2]];fx=np.mod(uv[...,0],1)*(image.shape[1]-1);fy=np.mod(uv[...,1],1)*(image.shape[0]-1);x0=fx.astype(int);y0=fy.astype(int);x1=np.minimum(x0+1,image.shape[1]-1);y1=np.minimum(y0+1,image.shape[0]-1);dx=(fx-x0)[...,None];dy=(fy-y0)[...,None]
    rgb=((image[y0,x0]*(1-dx)+image[y0,x1]*dx)*(1-dy)+(image[y1,x0]*(1-dx)+image[y1,x1]*dx)*dy)*(factor/255)
   target[mask]=z[mask];color[lo[1]:hi[1]+1,lo[0]:hi[0]+1][mask]=rgb[mask]
 if not np.isfinite(depth).all():raise ValueError('Far tile has uncovered pixels; manual review required')
 out=io.BytesIO();Image.fromarray(np.round(color).clip(0,255).astype('uint8')).save(out,format='PNG',optimize=True);return out.getvalue()

def wall(width,height):
 return dict(pos=np.array([[-width/2,0,0],[width/2,0,0],[width/2,height,0],[-width/2,height,0]]),norm=np.array([[0,0,1]]*4),uv=np.array([[0,height/9],[width/6,height/9],[width/6,0],[0,0]]),idx=np.array([0,1,2,0,2,3]),material=0)

def roof(width,depth):
 return dict(pos=np.array([[-width/2,0,-depth/2],[-width/2,0,depth/2],[width/2,0,depth/2],[width/2,0,-depth/2]]),norm=np.array([[0,1,0]]*4),uv=np.array([[0,0],[0,depth/6],[width/6,depth/6],[width/6,0]]),idx=np.array([0,1,2,0,2,3]),material=0)
