"""Build the offline Ohio fleet + 3D inspection HTML after npm run build:fleet."""
from pathlib import Path
import re
root=Path(__file__).resolve().parents[1]
dist=root/'dist-fleet'
html=(dist/'ohio.html').read_text()
js=next((dist/'assets').glob('*.js')).read_text()
css=next((dist/'assets').glob('*.css')).read_text()
html=re.sub(r'<script[^>]+src="[^"]+"[^>]*></script>','',html)
html=re.sub(r'<link[^>]+href="[^"]+"[^>]*>','',html)
html=html.replace('</head>','<style>'+css.replace('</style','<\\/style')+'</style></head>')
html=html.replace('</body>','<script type="module">'+js.replace('</script','<\\/script')+'</script></body>')
out=root/'OhioFleet.html'
out.write_text(html)
print(out)
