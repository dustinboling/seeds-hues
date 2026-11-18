import json, re, subprocess, sys, time

cat = json.load(open('/home/hatch/workspace/seeds-hues/v2/seed-data/catalog.json'))
out = {}
for s in cat['sellers']:
    q = f"{s['name']} {s.get('location') or s.get('region') or ''}".strip()
    r = subprocess.run(['/opt/hatch/bin/web-search', '--query', q, '--language', 'en',
                        '--serving-config-name', 'hatch_chat', '--skip-result-url-validation',
                        '--request-id', f"req:manual:rev-{s['slug']}"],
                       capture_output=True, text=True, timeout=120)
    m = re.search(r'place_id of (\d+)', r.stdout)
    # also capture the "Information about" block name to sanity check identity
    nm = re.search(r'## Information about ([^\n]+)', r.stdout)
    out[s['slug']] = {'query': q, 'place_id': m.group(1) if m else None,
                      'matched_name': nm.group(1).strip() if nm else None}
    print(s['slug'], '->', out[s['slug']]['place_id'], '|', out[s['slug']]['matched_name'], flush=True)
    time.sleep(0.5)
json.dump(out, open('/home/hatch/workspace/seeds-hues/reviews-work/place-ids.json', 'w'), indent=1)
print('DONE')
