"""Rebuild snapshot from raw directory; see OHIO_DATA_SOURCES.md."""
import json,csv,math,collections
from pathlib import Path
import sys
root=Path(sys.argv[1]);out=Path(__file__).resolve().parents[1]/'src/fleet'
def ring(p,r):
 x,y=p;inside=False
 for a,b in zip(r,r[1:]+r[:1]):
  if (a[1]>y)!=(b[1]>y) and x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0]:inside=not inside
 return inside
def contains(p,g):
 polys=[g['coordinates']] if g['type']=='Polygon' else g['coordinates']
 return any(ring(p,rs[0]) and not any(ring(p,r) for r in rs[1:]) for rs in polys)
urban=json.load(open(root/'urban.geojson'))['features']
runways=collections.defaultdict(list)
for r in csv.DictReader(open(root/'APT_RWY.csv')):
 if r['STATE_CODE']=='OH':runways[r['ARPT_ID']].append({'id':r['RWY_ID'],'lengthFt':float(r['RWY_LEN'] or 0),'surface':r['SURFACE_TYPE_CODE']})
airports=[]
for a in csv.DictReader(open(root/'APT_BASE.csv')):
 if not(a['STATE_CODE']=='OH' and a['SITE_TYPE_CODE']=='A' and a['FACILITY_USE_CODE']=='PU' and a['ARPT_STATUS']=='O' and a['TWR_TYPE_CODE']=='NON-ATCT'):continue
 p=[float(a['LONG_DECIMAL']),float(a['LAT_DECIMAL'])]
 airports.append({'id':a['ARPT_ID'],'name':a['ARPT_NAME'].title(),'city':a['CITY'].title(),'county':a['COUNTY_NAME'].title(),'coord':p,'rural':not any(contains(p,f['geometry']) for f in urban),'runways':runways[a['ARPT_ID']],'certificated':bool(a['FAR_139_TYPE_CODE'])})
raw=json.load(open(root/'osm.json'));lines=[]
for a in raw['elements']:
 if a['type']!='way' or not a.get('geometry'):continue
 t=a.get('tags',{});operator=t.get('operator','');v=[int(x) for x in t.get('voltage','').split(';') if x.isdigit()];voltage=max(v,default=0)
 lines.append({'id':a['id'],'operator':operator,'voltage':voltage,'aep':operator in ['American Electric Power','AEP Ohio'] or t.get('operator:wikidata') in ['Q464092','Q109015295'],'coords':[[round(p['lon'],6),round(p['lat'],6)] for p in a['geometry']]})
# Keep full geometry for reproducible length calculations; all rendering is local.
data={'airports':airports,'lines':lines,'boundary':json.load(open(root/'ohio.geojson'))['features'][0]['geometry'],'urban':[f['geometry'] for f in urban], 'meta':{'faaCycle':'2026-10-01','osmTimestamp':raw['osm3s']['timestamp_osm_base'],'retrieved':'2026-10-16','airportFilter':'Ohio, airport (A), public-use (PU), operational (O), NON-ATCT','ruralFilter':'Airport reference point outside Census 2020 urban areas; simplified boundary tolerance 0.0001 degrees','aepFilter':'operator American Electric Power / AEP Ohio or operator:wikidata Q464092 / Q109015295','sourceURLs':['https://nfdc.faa.gov/webContent/28DaySub/extra/01_Oct_2026_APT_CSV.zip','https://overpass-api.de/api/interpreter','https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/State_County/MapServer/0','https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/Urban/MapServer/0']}}
(out/'ohio-data.json').write_text(json.dumps(data,separators=(',',':')))
print('airports',len(airports),'rural',sum(a['rural'] for a in airports),'rural 2500ft',sum(a['rural'] and any(r['lengthFt']>=2500 for r in a['runways']) for a in airports),'aep69',sum(l['aep'] and l['voltage']>=69000 for l in lines),'bytes',(out/'ohio-data.json').stat().st_size)
