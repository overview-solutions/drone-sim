"""Make a deterministic corridor preview; original LAS stays in AEP/Data.
Requires laspy, numpy, pyproj. Run from any directory with the LAS folder argument.
"""
import pathlib, sys, json
import laspy, numpy as np
from pyproj import Transformer
ROOT=pathlib.Path(__file__).resolve().parents[1]
source=pathlib.Path(sys.argv[1])
raw=json.loads((ROOT/'src/fleet/ohio-data.json').read_text())
ids=[179559746,953747816,953747815]
ways={x['id']:x for x in raw['lines']}
coords=ways[ids[0]]['coords']+ways[ids[1]]['coords'][1:]+ways[ids[2]]['coords'][1:]
# Retain only the covered continuous section; never synthesize a connector.
coords=[p for p in coords if -82.7445<p[0]<-82.6909 and 39.9766<p[1]<40.0177]
origin=coords[0];cos=np.cos(np.radians(origin[1])); ft=1200/3937
line=np.array([[(p[0]-origin[0])*111320*cos,-(p[1]-origin[1])*111320] for p in coords])
rows=[];tiles=[]
for path in sorted(source.rglob('*.las')):
 cloud=laspy.read(path); crs=cloud.header.parse_crs()
 # Older metadata contradicts itself (CORS vs HARN). NAD83 Ohio South ftUS
 # is a display approximation only, documented rather than treated as surveyed registration.
 transformer=Transformer.from_crs(crs.sub_crs_list[0] if crs and crs.is_compound else (crs or 'EPSG:3735'),4326,always_xy=True)
 lon,lat=transformer.transform(np.asarray(cloud.x),np.asarray(cloud.y))
 x=(lon-origin[0])*111320*cos;z=-(lat-origin[1])*111320
 dist=np.full(len(x),np.inf)
 for a,b in zip(line,line[1:]):
  d=b-a;t=np.clip(((x-a[0])*d[0]+(z-a[1])*d[1])/np.dot(d,d),0,1)
  dist=np.minimum(dist,np.hypot(x-a[0]-t*d[0],z-a[1]-t*d[1]))
 ix=np.flatnonzero(dist<=150)
 # Each tile contributes at most 25k actual returns, no invented points.
 ix=ix[::max(1,int(np.ceil(len(ix)/25000)))]
 rows.append(np.column_stack([x[ix],np.asarray(cloud.z)[ix]*ft,z[ix],np.asarray(cloud.classification)[ix]]))
 tiles.append({'file':path.name,'sourcePoints':len(x),'previewPoints':len(ix),'horizontalCRS':str(crs) if crs else 'EPSG:3735 approximation; XML CORS/HARN ambiguous','bounds':[float(min(lon)),float(min(lat)),float(max(lon)),float(max(lat))]})
points=np.concatenate(rows);ground=points[points[:,3]==2,1];datum=float(np.min(ground if len(ground) else points[:,1]))-1
points[:,1]-=datum
out={'line':{'id':179559746,'operator':'','voltage':345000,'aep':False,'coords':coords},'sourceWayIds':ids,'origin':origin,'verticalOffsetMeters':datum,'bufferMeters':150,'tiles':tiles,'points':np.round(points,2).tolist()}
(ROOT/'src/fleet/ray-king-data.json').write_text(json.dumps(out,separators=(',',':')))
print('Preview:',len(points),'points;',len(coords),'OSM vertices; datum',datum)
