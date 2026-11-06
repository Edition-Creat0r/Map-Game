"""Audit exact supplied archives; copy only selected GLBs, their palette and license.
Usage: python import_packs.py --factory FILE --industrial FILE --suburban FILE
No extraction of scripts/HTML/URLs, no remote fetch and no execution of archive contents.
"""
import argparse, hashlib, io, json
from pathlib import Path, PurePosixPath
from PIL import Image
from packlib import PACKS, safe_zip, info, glb
ROOT=Path(__file__).resolve().parents[1]

def run(paths):
 spec=json.loads((ROOT/'assemblies.json').read_text());pending=[];report={'version':1,'archives':[]}
 for key,path in paths.items():
  with safe_zip(path,PACKS[key])[0]as z:
   license='\n'.join(line.rstrip()for line in z.read('License.txt').decode('utf8').splitlines())+'\n'
   if 'Creative Commons Zero, CC0' not in license:raise ValueError('License requires review')
   inventory=[]
   for n in z.namelist():
    if n.endswith('.glb'):
     raw=z.read(n);a=info(raw);d,_=glb(raw,allow_animation=True)
     for im in d.get('images',[]):
      if im.get('uri')!='Textures/colormap.png':raise ValueError('Unreviewed model image dependency')
     inventory.append({'path':n,'sha256':hashlib.sha256(raw).hexdigest(),'bytes':len(raw),**a})
   tex=z.read('Models/GLB format/Textures/colormap.png');im=Image.open(io.BytesIO(tex));im.load()
   report['archives'].append({'id':key,'filename':path.name,'sha256':PACKS[key],'license':'CC0-1.0','modelCount':len(inventory),'texture':{'path':'Textures/colormap.png','dimensions':im.size,'sha256':hashlib.sha256(tex).hexdigest()},'models':inventory})
   pending.extend([(ROOT/'source'/key/'License.txt',license.encode()),(ROOT/'source'/key/'Textures/colormap.png',tex)])
   names={p['model']for b in spec['buildings']for p in b['parts']if p['pack']==key}
   for name in sorted(names):pending.append((ROOT/'source'/key/(name+'.glb'),z.read('Models/GLB format/'+name+'.glb')))
 # All archives and dependencies must pass before publishing any selected source.
 for path,raw in pending:path.parent.mkdir(parents=True,exist_ok=True);path.write_bytes(raw)
 (ROOT/'asset-audit.json').write_text(json.dumps(report,indent=2)+'\n')
 print('Audited',sum(a['modelCount']for a in report['archives']),'GLBs; copied',len(pending),'allowlisted source/license/texture files')

if __name__=='__main__':
 a=argparse.ArgumentParser();[a.add_argument('--'+key,required=True,type=Path)for key in PACKS];args=a.parse_args();run(vars(args))
