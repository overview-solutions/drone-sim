"""Cache OSM-tagged AEP line geometry. One filtered Overpass request; no automatic refresh.
Usage: python3 scripts/fetch_aep_osm.py [--refresh]
"""
import argparse,json,urllib.request,urllib.parse,datetime
from pathlib import Path
root=Path(__file__).resolve().parents[1]
raw_path=root/'.cache/osm/aep-osm-response.json'
out=root/'public/gis/aep-power-lines.geojson'
parser=argparse.ArgumentParser();parser.add_argument('--refresh',action='store_true');parser.add_argument('--endpoint',default='https://overpass-api.de/api/interpreter');parser.add_argument('--get',action='store_true');args=parser.parse_args()
pattern='American Electric Power|(^|[; /])AEP([; /]|$)|Appalachian Power|Indiana[ -]Michigan Power|Kentucky Power|Southwestern Electric Power|SWEPCO|Public Service Company of Oklahoma|^PSO$|Kingsport Power|Wheeling Power|Ohio Power|Columbus Southern Power'
selectors=''.join(f'way[power~"^(line|minor_line|cable)$"]["{key}"~"{pattern}",i](24,-126,50,-66);' for key in ['operator','owner'])
selectors+=''.join(f'way[power~"^(line|minor_line|cable)$"]["{key}"~"(^|;)(Q464092|Q109015295)(;|$)"](24,-126,50,-66);' for key in ['operator:wikidata','owner:wikidata'])
relations=''.join(f'relation[route=power]["{key}"~"{pattern}",i](24,-126,50,-66);' for key in ['operator','owner'])
query=f'[out:json][timeout:150][maxsize:134217728];({relations})->.routes;({selectors}way(r.routes)[power~"^(line|minor_line|cable)$"];relation.routes;);out geom;'
if raw_path.exists() and not args.refresh:
    raw=json.loads(raw_path.read_text());print('Using cached Overpass response',flush=True)
else:
    print('Requesting only AEP/operator/owner-matched power ways and route members within the continental US',flush=True)
    encoded=urllib.parse.urlencode({'data':query})
    request=urllib.request.Request(args.endpoint+('?' + encoded if args.get else ''),data=None if args.get else encoded.encode(),headers={'User-Agent':'Flightline local GIS snapshot (one-time filtered OSM download)','Content-Type':'application/x-www-form-urlencoded'})
    with urllib.request.urlopen(request,timeout=180) as response:raw=json.load(response)
    if raw.get('remark'):raise RuntimeError('Overpass returned a partial/error response: '+raw['remark'])
    raw_path.parent.mkdir(parents=True,exist_ok=True);raw_path.write_text(json.dumps(raw,separators=(',',':')))
relations={}
for element in raw.get('elements',[]):
    if element['type']=='relation':
        for member in element.get('members',[]):
            if member['type']=='way':relations.setdefault(member['ref'],[]).append({'id':element['id'],'operator':element.get('tags',{}).get('operator'),'owner':element.get('tags',{}).get('owner')})
features={}
for element in raw.get('elements',[]):
    if element['type']!='way' or len(element.get('geometry',[]))<2:continue
    tags=element.get('tags',{});volts=[int(x.strip()) for x in tags.get('voltage','').split(';') if x.strip().isdigit()]
    features[element['id']]={'type':'Feature','id':'osm/way/'+str(element['id']),'properties':{'osm_id':element['id'],'osm_type':'way','source':'OpenStreetMap','source_url':f'https://www.openstreetmap.org/way/{element["id"]}','attribution':'© OpenStreetMap contributors','license':'ODbL-1.0','ownership_status':'OSM-tagged association; not verified asset ownership','height_reference':'unknown; ground trace only','power':tags.get('power'),'voltage':max(volts,default=0),'voltage_tag':tags.get('voltage'),'operator':tags.get('operator'),'owner':tags.get('owner'),'name':tags.get('name'),'ref':tags.get('ref'),'tags':tags,'matched_routes':relations.get(element['id'],[])},'geometry':{'type':'LineString','coordinates':[[p['lon'],p['lat']] for p in element['geometry']]}}
data={'type':'FeatureCollection','name':'aep-osm-tagged-power-lines','metadata':{'retrieved':datetime.datetime.now(datetime.timezone.utc).isoformat(),'osm_timestamp':raw.get('osm3s',{}).get('timestamp_osm_base'),'source':'https://overpass-api.de/api/interpreter','query':query,'license':'ODbL-1.0','attribution':'© OpenStreetMap contributors','scope':'Continental US, tagged AEP/subsidiary operator or owner, plus tagged route member ways; overhead transmission, minor lines and cables','limitations':'Incomplete contributor mapping and ownership tags. Not a complete AEP inventory or engineering survey. Unknown voltages/heights are not inferred.','company_reference':'https://www.aep.com/about/businesses/opcos/'},'features':list(features.values())}
out.parent.mkdir(parents=True,exist_ok=True)
temporary=out.with_suffix('.tmp');temporary.write_text(json.dumps(data,separators=(',',':')));temporary.replace(out)
print(f'Saved {len(features):,} unique line ways ({out.stat().st_size/1e6:.1f} MB) to {out}',flush=True)
