import json, re, subprocess, time
queries = {
 'songbird-seed-co': 'Songbird Seed Co Mount Vernon Washington',
 'sunflower-steve-seed-co': 'Sunflower Steve Seed Co Ellsworth Wisconsin',
 'floret': 'Floret Flower Farm Mount Vernon Washington',
 'dawn-creek-farm': 'Dawn Creek Farm California flowers',
 'wild-west-seed': 'Wild West Seed Albany Oregon',
 '3-porch-farm': '3 Porch Farm Comer Georgia',
 'blomma-flower-farm': 'Blomma Flower Farm Gardnerville Nevada',
 'half-moons-farm': "Half Moon's Farm Ferndale Washington flowers",
 'jig-bee-flower-farm': 'Jig-Bee Flower Farm Vermont',
 'peace-seedlings': 'Peace Seedlings Corvallis Oregon',
 'summertime-seed-co': 'Summertime Seed Co Oregon',
 'sunflower-selections': 'Sunflower Selections Woodland California',
 'three-brothers-blooms': 'Three Brothers Blooms Camano Island',
 'high-mowing-organic-seeds': 'High Mowing Organic Seeds Wolcott Vermont',
 'seed-savers-exchange': 'Seed Savers Exchange Decorah Iowa',
}
found = json.load(open('/home/hatch/workspace/seeds-hues/reviews-work/found-ids.json'))
for slug, q in queries.items():
    r = subprocess.run(['/opt/hatch/bin/web-search', '--query', q, '--language', 'en',
                        '--serving-config-name', 'hatch_chat', '--skip-result-url-validation',
                        '--request-id', f"req:manual:rev2-{slug}"], capture_output=True, text=True, timeout=120)
    m = re.search(r'has a place_id of (\d+)', r.stdout)
    nm = re.search(r'## Information about ([^\\n]+)', r.stdout)
    if m:
        found[slug] = m.group(1)
        print('FOUND', slug, m.group(1), '|', (nm.group(1) if nm else '')[:60], flush=True)
    else:
        print('MISS ', slug, flush=True)
    time.sleep(0.5)
json.dump(found, open('/home/hatch/workspace/seeds-hues/reviews-work/found-ids.json', 'w'), indent=1)
print('TOTAL FOUND:', len(found))
