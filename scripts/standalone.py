"""Package the built app as a double-clickable HTML file, including both workers."""
from pathlib import Path
import json
import re
root = Path(__file__).resolve().parents[1]
dist = root / 'dist'
html = (dist / 'index.html').read_text()
main = next((dist / 'assets').glob('index-*.js')).read_text()
css = next((dist / 'assets').glob('index-*.css')).read_text()
for pattern in ['worker-*.js', 'maplibre-gl-worker-*.js']:
    worker = next((dist / 'assets').glob(pattern))
    expression = 'URL.createObjectURL(new Blob([' + json.dumps(worker.read_text()) + '],{type:"text/javascript"}))'
    literal = '`/assets/' + worker.name + '`'
    assert literal in main, worker.name
    main = main.replace(literal, expression)
html = re.sub(r'\s*<script[^>]+src="[^"]+"[^>]*></script>', '', html)
html = re.sub(r'\s*<link[^>]+href="[^"]+"[^>]*>', '', html)
html = html.replace('</head>', '<style>' + css.replace('</style', '<\\/style') + '</style></head>')
html = html.replace('</body>', '<script type="module">' + main.replace('</script', '<\\/script') + '</script></body>')
out = root / 'Flightline.html'
out.write_text(html)
print(out)
