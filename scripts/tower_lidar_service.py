"""Local, read-only LAS processing for Ray–King candidate towers. No uploads.
python tower_lidar_service.py --data ../Data/lidar/Ray_King_345
"""
import argparse,json,pathlib,threading,concurrent.futures,hashlib
from http.server import ThreadingHTTPServer,BaseHTTPRequestHandler
from urllib.parse import urlparse
import numpy as np,laspy
from pyproj import Transformer
def prism_faces(band):
 points=sorted(set(map(tuple,band[:,[0,2]].tolist())))
 if len(points)<3:return []
 def cross(a,b,c):return (b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0])
 lower=[];upper=[]
 for p in points:
  while len(lower)>=2 and cross(lower[-2],lower[-1],p)<=0:lower.pop()
  lower.append(p)
 for p in reversed(points):
  while len(upper)>=2 and cross(upper[-2],upper[-1],p)<=0:upper.pop()
  upper.append(p)
 ring=lower[:-1]+upper[:-1]
 if len(ring)<3:return []
 lo=float(band[:,1].min());hi=float(band[:,1].max())
 if hi-lo<.1:return []
 bottom=[np.array([x,lo,z]) for x,z in ring];top=[np.array([x,hi,z]) for x,z in ring];faces=[]
 for i in range(len(ring)):
  j=(i+1)%len(ring);faces.extend([[bottom[i],bottom[j],top[j]],[bottom[i],top[j],top[i]]])
 for i in range(1,len(ring)-1):faces.extend([[bottom[0],bottom[i+1],bottom[i]],[top[0],top[i],top[i+1]]])
 return [np.array(f) for f in faces]
ROOT=pathlib.Path(__file__).resolve().parents[1]
meta=json.loads((ROOT/'src/fleet/ray-king-data.json').read_text());supports=json.loads((ROOT/'src/fleet/ray-king-spans.json').read_text())['supports']
jobs={};lock=threading.Lock();pool=concurrent.futures.ThreadPoolExecutor(max_workers=1)
def inventory(folder):
 return tuple((str(p.relative_to(folder)),p.stat().st_size,p.stat().st_mtime_ns) for p in sorted(folder.rglob('*.las')))
def unique_tiles(folder):
 paths=sorted(folder.rglob('*.las'));seen=set();sizes={}
 for p in paths:sizes[p.stat().st_size]=sizes.get(p.stat().st_size,0)+1
 for p in paths:
  if sizes[p.stat().st_size]>1:
   with p.open('rb') as stream:digest=hashlib.file_digest(stream,'sha256').hexdigest()
   if digest in seen:continue
   seen.add(digest)
  yield p

def process(index,folder):
 key=supports[index]['id'];job=jobs[key]
 try:
  tower=supports[index];cx,base,cz=tower['position'];
  before=np.array(supports[max(0,index-1)]['position']);after=np.array(supports[min(len(supports)-1,index+1)]['position']);axis=after[[0,2]]-before[[0,2]];axis=axis/np.linalg.norm(axis);normal=np.array([-axis[1],axis[0]]);
  origin=meta['origin'];cos=np.cos(np.radians(origin[1]));lon=origin[0]+cx/(111320*cos);lat=origin[1]-cz/111320
  tiles=[]
  for path in unique_tiles(folder):
   job['step']='Checking '+path.name
   with laspy.open(path) as reader:
    crs=reader.header.parse_crs();crs=crs.sub_crs_list[0] if crs and crs.is_compound else crs or 'EPSG:3735'
    inv=Transformer.from_crs(4326,crs,always_xy=True);sx,sy=inv.transform(lon,lat)
    # All supplied source tiles use US survey feet. Header bounds avoid unrelated reads.
    if not (reader.header.mins[0]-80<sx<reader.header.maxs[0]+80 and reader.header.mins[1]-80<sy<reader.header.maxs[1]+80):continue
    transform=Transformer.from_crs(crs,4326,always_xy=True);pieces=[]
    for chunk in reader.chunk_iterator(250000):
     job['step']='Reading full-resolution '+path.name
     mask=(np.abs(np.asarray(chunk.x)-sx)<80)&(np.abs(np.asarray(chunk.y)-sy)<80)
     if not mask.any():continue
     xx,yy=transform.transform(np.asarray(chunk.x)[mask],np.asarray(chunk.y)[mask]);z=np.asarray(chunk.z)[mask]*1200/3937-meta['verticalOffsetMeters'];x=(xx-origin[0])*111320*cos;zz=-(yy-origin[1])*111320
     along=(x-cx)*axis[0]+(zz-cz)*axis[1];across=(x-cx)*normal[0]+(zz-cz)*normal[1]
     valid=(np.abs(along)<5)&(np.abs(across)<18)&(z>base+2)&(z<tower['top']+4)&(np.asarray(chunk.classification)[mask]!=7)
     pieces.append(np.column_stack([x[valid],z[valid],zz[valid]]))
    pts=np.concatenate(pieces) if pieces else np.empty((0,3))
    if len(pts):tiles.append((path.name,pts))
  # Prefer the 2021 survey only when it has enough evidence, never merge survey epochs.
  newer=[t for t in tiles if t[0].startswith('BS') and len(t[1])>=12];chosen=newer or [t for t in tiles if not t[0].startswith('BS')]
  pts=np.unique(np.concatenate([t[1] for t in chosen]),axis=0) if chosen else np.empty((0,3));job['returns']=len(pts)
  if len(pts)<12:raise ValueError('Insufficient full-resolution returns for a structure envelope')
  job['step']='Fitting evidence-supported 3D bands';triangles=[];features=[];skipped=0
  for low in np.arange(base+2,tower['top']+4,3):
   band=pts[(pts[:,1]>=low)&(pts[:,1]<low+3)]
   if len(band)<6:skipped+=1;continue
   faces=prism_faces(band)
   if not faces:skipped+=1;continue
   local=[];geo=[]
   for tri in faces:
    local.extend(tri.tolist());ring=[[origin[0]+p[0]/(111320*cos),origin[1]-p[2]/111320,p[1]+meta['verticalOffsetMeters']] for p in tri];geo.append([ring+[ring[0]]])
   triangles.extend(local);features.append({'type':'Feature','geometry':{'type':'MultiPolygon','coordinates':geo},'properties':{'towerId':key,'candidate':True,'orientationMethod':'Cross-corridor crop: 36 m across, 10 m along; measured points unchanged','method':'3 m height-band XY convex prism bounded by observed min/max elevations','returns':len(band),'sourceFiles':[t[0] for t in chosen],'verticalDatum':'NAVD88 metres','warning':'Unverified envelope; may include wires or vegetation; not individual steel members'}})
  if not triangles:raise ValueError('Returns too sparse or coplanar; no defensible volume fitted')
  job.update(status='complete',step='3D candidate envelope ready',triangles=triangles,geojson={'type':'FeatureCollection','features':features},sourceFiles=[t[0] for t in chosen],skippedBands=skipped)
 except Exception as e:job.update(status='error',step=str(e))
class Handler(BaseHTTPRequestHandler):
 def do_GET(self):
  origin=self.headers.get('Origin','');parsed=urlparse(origin)
  if origin and origin!='null' and not(parsed.hostname in ('localhost','127.0.0.1')):self.send_error(403);return
  key=urlparse(self.path).path.removeprefix('/towers/')
  ids=[s['id'] for s in supports]
  if not self.path.startswith('/towers/') or key not in ids:self.send_error(404);return
  with lock:
   fingerprint=inventory(folder)
   if key not in jobs or (jobs[key].get('_inventory')!=fingerprint and jobs[key]['status']!='processing'):
    jobs[key]={'status':'processing','step':'Queued','towerId':key,'_inventory':fingerprint};pool.submit(process,ids.index(key),folder)
   payload=json.dumps({k:v for k,v in jobs[key].items() if not k.startswith('_')}).encode()
  self.send_response(200);self.send_header('Content-Type','application/json');self.send_header('Cache-Control','no-store');self.send_header('Access-Control-Allow-Origin',origin or 'http://127.0.0.1:5190');self.end_headers();self.wfile.write(payload)
 def log_message(self,*args):pass
if __name__=='__main__':
 parser=argparse.ArgumentParser();parser.add_argument('--data',type=pathlib.Path,required=True);parser.add_argument('--port',type=int,default=8790);args=parser.parse_args();folder=args.data.resolve()
 if not folder.is_dir():raise SystemExit('LAS folder not found')
 print('Local tower processing on http://127.0.0.1:'+str(args.port),flush=True);ThreadingHTTPServer(('127.0.0.1',args.port),Handler).serve_forever()
