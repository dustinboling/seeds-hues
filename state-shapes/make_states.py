import json, math, os

SRC = json.load(open('/home/hatch/workspace/seeds-hues/state-shapes/us-states.json'))
NEEDED = {  # state name -> slug (sellers' states; ME added for Johnny's)
    'Washington': 'washington', 'Wisconsin': 'wisconsin', 'California': 'california',
    'New York': 'new-york', 'Oregon': 'oregon', 'Georgia': 'georgia', 'Nevada': 'nevada',
    'Vermont': 'vermont', 'Montana': 'montana', 'Colorado': 'colorado', 'Utah': 'utah',
    'Minnesota': 'minnesota', 'Iowa': 'iowa', 'Connecticut': 'connecticut',
    'Virginia': 'virginia', 'Maine': 'maine',
}

def ring_area(r):
    return abs(sum(r[i][0] * r[i + 1][1] - r[i + 1][0] * r[i][1] for i in range(len(r) - 1))) / 2

def dp(points, tol):
    if len(points) < 3: return points
    def dist(p, a, b):
        if a == b: return math.hypot(p[0] - a[0], p[1] - a[1])
        t = max(0, min(1, ((p[0] - a[0]) * (b[0] - a[0]) + (p[1] - a[1]) * (b[1] - a[1])) / ((b[0] - a[0]) ** 2 + (b[1] - a[1]) ** 2)))
        return math.hypot(p[0] - (a[0] + t * (b[0] - a[0])), p[1] - (a[1] + t * (b[1] - a[1])))
    keep = [False] * len(points); keep[0] = keep[-1] = True
    stack = [(0, len(points) - 1)]
    while stack:
        i, j = stack.pop()
        dmax, imax = 0, -1
        for k in range(i + 1, j):
            d = dist(points[k], points[i], points[j])
            if d > dmax: dmax, imax = d, k
        if dmax > tol and imax > 0:
            keep[imax] = True; stack += [(i, imax), (imax, j)]
    return [p for p, k in zip(points, keep) if k]

out = {}
os.makedirs('/home/hatch/workspace/seeds-hues/state-shapes/svg', exist_ok=True)
for f in SRC['features']:
    name = f['properties']['name']
    if name not in NEEDED: continue
    slug = NEEDED[name]
    geom = f['geometry']
    polys = geom['coordinates'] if geom['type'] == 'MultiPolygon' else [geom['coordinates']]
    rings = []
    areas = []
    for poly in polys:
        rings.append(poly[0]); areas.append(ring_area(poly[0]))
    amax = max(areas)
    kept = [r for r, a in zip(rings, areas) if a >= amax * 0.004]  # drop specks, keep real islands
    lons = [p[0] for r in kept for p in r]; lats = [p[1] for r in kept for p in r]
    mid_lat = (min(lats) + max(lats)) / 2
    kx = math.cos(math.radians(mid_lat))
    W = 100.0
    span_x = (max(lons) - min(lons)) * kx; span_y = max(lats) - min(lats)
    scale = W / span_x
    H = span_y * scale
    tol = span_x * 0.004
    paths = []
    for r in kept:
        pts = [((x - min(lons)) * kx * scale, (max(lats) - y) * scale) for x, y in r]
        pts = dp(pts, tol * scale)
        if len(pts) < 4: continue
        d = 'M' + 'L'.join(f'{x:.1f},{y:.1f}' for x, y in pts) + 'Z'
        paths.append(d)
    viewbox = f'0 0 {W:.0f} {H:.0f}'
    out[slug] = {'name': name, 'viewBox': viewbox, 'd': ' '.join(paths)}
    svg = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{viewbox}" aria-hidden="true">'
           f'<path d="{" ".join(paths)}" fill="#1E4634" fill-opacity="0.08" stroke="#1E4634" stroke-width="1.6" stroke-linejoin="round"/></svg>\n')
    open(f'/home/hatch/workspace/seeds-hues/state-shapes/svg/{slug}.svg', 'w').write(svg)
    print(slug, viewbox, 'paths:', len(paths), 'bytes:', len(svg))
json.dump(out, open('/home/hatch/workspace/seeds-hues/state-shapes/state-paths.json', 'w'), indent=1)
