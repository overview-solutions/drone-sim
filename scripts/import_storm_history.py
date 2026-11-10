"""Convert the NWS KMZ and downloaded Cleveland event page into bundled GeoJSON.
Usage: python3 scripts/import_storm_history.py TRACK.kmz EVENT.html
"""
import sys
import json
import re
import hashlib
import zipfile
import xml.etree.ElementTree as ET
from pathlib import Path
from html.parser import HTMLParser
from datetime import datetime, timezone
from zoneinfo import ZoneInfo

class PreText(HTMLParser):
    def __init__(self):
        super().__init__()
        self.active = False
        self.parts = []
    def handle_starttag(self, tag, attrs):
        if tag == 'pre':
            self.active = True
    def handle_endtag(self, tag):
        if tag == 'pre':
            self.active = False
    def handle_data(self, text):
        if self.active:
            self.parts.append(text)

kmz, html = map(Path, sys.argv[1:])
out = Path(__file__).resolve().parents[1] / 'src/fleet'
ns = {'k': 'http://www.opengis.net/kml/2.2'}
with zipfile.ZipFile(kmz) as archive:
    root = ET.fromstring(archive.read('doc.kml'))
features = []
for placemark in root.findall('.//k:Placemark', ns):
    for polygon in placemark.findall('.//k:Polygon', ns):
        rings = []
        for coordinates in polygon.findall('.//k:LinearRing/k:coordinates', ns):
            ring = [[float(n) for n in pair.split(',')[:2]] for pair in coordinates.text.split()]
            assert len(ring) >= 4 and ring[0] == ring[-1]
            rings.append(ring)
        features.append({'type': 'Feature', 'properties': {'name': placemark.findtext('k:name', namespaces=ns)},
                         'geometry': {'type': 'Polygon', 'coordinates': rings}})
assert features
track = {'type': 'FeatureCollection', 'source': 'https://www.weather.gov/iln/20240314_auglaize_logan',
         'inputFile': kmz.name, 'sha256': hashlib.sha256(kmz.read_bytes()).hexdigest(), 'features': features}
(out / 'indian-lake-track.json').write_text(json.dumps(track, indent=2)+'\n')

parser = PreText()
parser.feed(html.read_text())
text = ''.join(parser.parts)
header = re.compile(r'^(\d{4} [AP]M)\s{2,}(.*?)\s{2,}(.*?)\s+(\d+\.\d+)N\s+(\d+\.\d+)W\s*$', re.M)
matches = list(header.finditer(text))
reports = []
for index, match in enumerate(matches):
    block = text[match.end(): matches[index+1].start() if index+1<len(matches) else len(text)].strip().splitlines()
    fields = re.match(r'(\d{2}/\d{2}/\d{4})\s+(?:([MEU])(\d+\.\d+)\s+(MPH|INCH)\s+)?(.*?)\s{2,}OH\s+(.*)', block[0])
    if not fields:
        raise ValueError('Unparsed report: '+block[0])
    date, qualifier, magnitude, unit, county, observer = fields.groups()
    local = datetime.strptime(date+' '+match[1], '%m/%d/%Y %I%M %p').replace(tzinfo=ZoneInfo('America/New_York'))
    reports.append({'type': 'Feature', 'id': 'derecho-2012-'+str(index+1),
        'geometry': {'type': 'Point', 'coordinates': [-float(match[5]),float(match[4])]},
        'properties': {'event': match[2], 'location': match[3], 'county': county.strip(),
            'observedAt': local.astimezone(timezone.utc).isoformat(), 'localTime': match[1]+' EDT',
            'magnitude': float(magnitude) if magnitude else None, 'unit': unit,
            'qualifier': {'M':'measured','E':'estimated','U':'unknown method'}.get(qualifier),
            'observer': observer.strip(), 'remarks': ' '.join(line.strip() for line in block[1:] if line.strip())}})
assert len(reports) == len(matches) and reports
result = {'type': 'FeatureCollection','source':'https://www.weather.gov/cle/event_20120629_derecho',
          'bulletin':'Preliminary local storm report summary, NWS Cleveland, June 29 2012, 9:49 PM EDT',
          'coverage':'Reports reproduced on the Cleveland event page; not statewide coverage.',
          'sourceSha256':hashlib.sha256(html.read_bytes()).hexdigest(), 'features':reports}
(out / 'derecho-reports.json').write_text(json.dumps(result, indent=2)+'\n')
print(f'Imported {len(features)} tornado polygons and {len(reports)} storm reports.')
