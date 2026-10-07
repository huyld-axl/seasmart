import json, os, sys, urllib.request, uuid
BASE = 'https://design.penpot.app/api/main/methods/'
UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36'
def call(method, params=None):
    req = urllib.request.Request(BASE + method, data=json.dumps(params or {}).encode(), method='POST', headers={
        'Authorization': 'Token ' + os.environ['PENPOT_TOKEN'], 'Content-Type': 'application/json', 'Accept': 'application/json', 'User-Agent': UA})
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            body = r.read().decode()
            return json.loads(body) if body else None
    except urllib.error.HTTPError as e:
        raise SystemExit(f'{method} HTTP {e.code}: {e.read().decode()[:1500]}')
