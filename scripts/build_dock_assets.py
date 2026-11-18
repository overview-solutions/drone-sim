"""Clip available line sources to configured 3-statute-mile dock buffers; preserve uncertainty.
python3 scripts/build_dock_assets.py --state /path/to/local-api-state.json
"""
import argparse,json,math,datetime
from pathlib import Path
root=Path(__file__).resolve().parents[1];aep=root.parent
parser=argparse.ArgumentParser();parser.add_argument('--state',required=True);args=parser.parse_args()
state=json.load(open(args.state));docks=[d for d in state['assets'] if d['kind']=='dock' and d.get('coordinates')]
network=root/'public/gis/aep-power-lines.geojson'
if not network.exists():
    ohio=json.load(open(root/'src/fleet/ohio-data.json'));features=[]
    for line in ohio['lines']:
        if not line['aep']:continue
        features.append({'type':'Feature','id':'osm/way/'+str(line['id']),'geometry':{'type':'LineString','coordinates':line['coords']},'properties':{'osm_id':line['id'],'source':'OpenStreetMap cached Ohio snapshot','operator':line['operator'],'voltage':line['voltage'],'power':'line','height_reference':'unknown; ground trace only'}})
    data={'type':'FeatureCollection','metadata':{'scope':'Ohio-only cached fallback; AEP-wide live download unavailable','osm_timestamp':ohio['meta']['osmTimestamp'],'attribution':'© OpenStreetMap contributors / ODbL','regional_pending':True},'features':features}
    network.write_text(json.dumps(data,separators=(',',':')))
network_data=json.load(open(network));sources=[]
for f in network_data['features']:
    if f['geometry']['type']=='LineString':sources.append({'id':f['id'],'name':f['properties'].get('name') or f['properties'].get('ref') or f['id'],'coords':f['geometry']['coordinates'],'properties':f['properties'],'structures':None})
inspection=json.load(open(aep/'Workbench/projects/skydio-dark/data/265454_inspection_preview.geojson'))
structures=[f for f in inspection['features'] if f['properties']['layer']=='structure']
route=next(f for f in inspection['features'] if f['properties']['layer']=='inferred_span')['geometry']['coordinates']
sources.append({'id':'circuit/265454','name':'Circuit 265454 · supplied structures','coords':route,'properties':{'source':'User-supplied circuit 265454 structure points','voltage':138000,'span_status':'Inferred support sequence; not as-built conductor survey'},'structures':structures})
radius=3*1609.344

def clip_segment(a,b):
    dx,dy=b[0]-a[0],b[1]-a[1];aa=dx*dx+dy*dy
    if aa<1e-12:return None
    bb=2*(a[0]*dx+a[1]*dy);cc=a[0]**2+a[1]**2-radius**2;disc=bb*bb-4*aa*cc
    if disc<0:return None
    low=max(0,(-bb-math.sqrt(disc))/(2*aa));high=min(1,(-bb+math.sqrt(disc))/(2*aa))
    if low>=high:return None
    return [[a[0]+low*dx,a[1]+low*dy],[a[0]+high*dx,a[1]+high*dy]]
output=[]
for dock in docks:
    lon,lat=dock['coordinates'];cos=math.cos(math.radians(lat))
    xy=lambda p:((p[0]-lon)*111320*cos,(p[1]-lat)*111320)
    geo=lambda p:[lon+p[0]/(111320*cos),lat+p[1]/111320]
    circuits=[]
    for source in sources:
        segments=[];length=0
        for a,b in zip(source['coords'],source['coords'][1:]):
            clipped=clip_segment(xy(a),xy(b))
            if clipped:segments.append([geo(p) for p in clipped]);length+=math.dist(*clipped)
        if not segments:continue
        supports=[]
        for f in source['structures'] or []:
            p=xy(f['geometry']['coordinates'])
            if math.hypot(*p)<=radius:supports.append({'id':str(f['properties']['STRUCTURE_NUMBER']),'coord':f['geometry']['coordinates'],'properties':f['properties'],'heightM':None,'heightStatus':'Unknown; schematic default only'})
        circuits.append({'id':source['id'],'name':source['name'],'source':source['properties'].get('source','OpenStreetMap'),'voltage':source['properties'].get('voltage',0),'lengthM':round(length,1),'segments':segments,'supports':supports,'supportCoverage':'Supplied structure points' if supports else 'No mapped supports in loaded data','status':'Planning candidate within radius; flight feasibility unverified','modeledHeightM':45,'geometryStatus':'Schematic 3D; heights, pole dimensions, attachments, sag and terrain unverified'})
    output.append({'id':dock['id'],'name':dock['name'],'coordinates':dock['coordinates'],'radiusMiles':3,'circuits':circuits,'coverage':network_data['metadata']['scope'],'coverageComplete':False})
out=root/'public/gis/dock-assets.json';out.write_text(json.dumps({'schema':'flightline-dock-assets/1.0','generated':datetime.datetime.now(datetime.timezone.utc).isoformat(),'docks':output},separators=(',',':')))
print('Dock inventories:',len(output),'with local candidate circuits:',sum(bool(d['circuits']) for d in output),'candidate ways:',sum(len(d['circuits']) for d in output))
