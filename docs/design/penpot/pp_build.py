import io, json, uuid, svgelements as SE
from shapes import geom, fill, stroke
ROOT = '00000000-0000-0000-0000-000000000000'
ID = lambda: str(uuid.uuid4())
W = {'400': 'regular', '500': '500', '600': '600', '700': '700'}

def text_obj(it, x, y):
    lhpx = it['lh'] * it['size']
    ty = y if it['multi'] else y - (lhpx - it['h']) / 2
    wt = str(it['weight']) if str(it['weight']) in W else ('700' if int(it['weight']) > 600 else '400')
    leaf = {'text': it['t'], 'fontFamily': 'Inter', 'fontId': 'gfont-inter', 'fontVariantId': W[wt], 'fontSize': str(round(it['size'], 2)), 'fontWeight': wt, 'fontStyle': 'normal',
            'lineHeight': str(round(it['lh'], 3)), 'letterSpacing': str(round(it['ls'], 3)), 'fills': [{'fillColor': it['color'], 'fillOpacity': it['op']}], 'textDecoration': 'none', 'textTransform': 'none'}
    para = {'type': 'paragraph', 'textAlign': it['align'], 'children': [leaf], **{k: leaf[k] for k in ('fontFamily', 'fontId', 'fontVariantId', 'fontSize', 'fontWeight', 'fontStyle', 'lineHeight', 'letterSpacing', 'fills')}}
    w = it['w'] + (4 if it['multi'] else 2)
    return {'type': 'text', 'name': it['t'][:40], **geom(x, ty, w, it['h'] if it['multi'] else lhpx),
            'content': {'type': 'root', 'verticalAlign': 'top', 'children': [{'type': 'paragraph-set', 'children': [para]}]},
            'growType': 'auto-height' if it['multi'] else 'auto-width', 'fills': [], 'strokes': []}

def icon_nodes(svg, x, y, w, h):
    out = []
    doc = SE.SVG.parse(io.StringIO(svg), width=w, height=h)
    for el in doc.elements():
        if not isinstance(el, SE.Shape): continue
        p = abs(SE.Path(el) * SE.Matrix('translate(%f,%f)' % (x, y)))
        segs = []
        for sg in p.segments():
            if isinstance(sg, SE.Move): segs.append({'command': 'move-to', 'params': {'x': sg.end.x, 'y': sg.end.y}})
            elif isinstance(sg, SE.Close): segs.append({'command': 'close-path', 'params': {}})
            elif isinstance(sg, SE.Line): segs.append({'command': 'line-to', 'params': {'x': sg.end.x, 'y': sg.end.y}})
            else:
                for c in (sg.as_cubic_curves() if hasattr(sg, 'as_cubic_curves') else [sg]):
                    if isinstance(c, SE.QuadraticBezier): c1 = c.start + (c.control - c.start) * (2 / 3); c2 = c.end + (c.control - c.end) * (2 / 3)
                    else: c1, c2 = c.control1, c.control2
                    segs.append({'command': 'curve-to', 'params': {'x': c.end.x, 'y': c.end.y, 'c1x': c1.x, 'c1y': c1.y, 'c2x': c2.x, 'c2y': c2.y}})
        bb = p.bbox()
        if not segs or not bb: continue
        bx, by, bx2, by2 = bb
        fc = el.fill.hex[:7] if el.fill is not None and el.fill.value is not None else None
        sc = el.stroke.hex[:7] if el.stroke is not None and el.stroke.value is not None else None
        o = {'type': 'path', 'name': 'path', **geom(bx, by, max(bx2 - bx, .01), max(by2 - by, .01)), 'content': segs, 'fills': fill(fc), 'strokes': []}
        if sc: o['strokes'] = [{'strokeColor': sc, 'strokeOpacity': 1, 'strokeWidth': (el.stroke_width or 1) * w / 24, 'strokeAlignment': 'center', 'strokeStyle': 'solid'}]
        out.append({'obj': o, 'children': []})
    return out

def frame_obj(name, x, y, w, h, rad=0, bg=None):
    return {'type': 'frame', 'name': name, **geom(x, y, w, h), 'fills': fill(bg), 'strokes': [], 'shapes': [], 'r1': rad, 'r2': rad, 'r3': rad, 'r4': rad, 'showContent': True, 'hideFillOnExport': False, 'hideInViewer': True}

def to_nodes(items, dx=0, dy=0):
    """item tree (from extract.mjs) -> node tree {obj, children, comp?}"""
    out = []
    for it in items:
        x, y = it['x'] + dx, it['y'] + dy
        if it['k'] == 'rect':
            r = min(it.get('rad', 0), it['h'] / 2, it['w'] / 2)
            o = {'type': 'rect', 'name': it.get('name') or 'rect', **geom(x, y, it['w'], it['h']), 'fills': fill(it['bg']['hex'], it['bg']['a']) if it.get('bg') else [], 'strokes': [], 'r1': r, 'r2': r, 'r3': r, 'r4': r}
            if it.get('stroke'): o['strokes'] = stroke(it['stroke']['hex'], it.get('sw', 1)); o['strokes'][0]['strokeOpacity'] = it['stroke']['a']
            out.append({'obj': o, 'children': []})
        elif it['k'] == 'text': out.append({'obj': text_obj(it, x, y), 'children': []})
        elif it['k'] == 'svg': out.append({'obj': frame_obj('icon', x, y, it['w'], it['h']), 'children': icon_nodes(it['svg'], x, y, it['w'], it['h'])})
        elif it['k'] == 'group':
            out.append({'obj': frame_obj(it['name'], x, y, it['w'], it['h']), 'children': to_nodes(it['children'], dx, dy), 'comp': it['name']})
    # icons on top within each container
    out.sort(key=lambda n: n['obj']['name'] == 'icon')
    return out

def sig(n):
    return n['obj']['type'] + '(' + ','.join(sig(c) for c in n['children']) + ')'

GROUPS = {'text': ['content'], 'fills': ['fills'], 'geo': ['x', 'y', 'width', 'height', 'selrect', 'points', 'content']}
def touched(o, ref, rx, ry):
    t = set()
    if o['type'] == 'text':
        if json.dumps(o['content'], sort_keys=True) != json.dumps(ref['content'], sort_keys=True): t.add('content-group')
    if json.dumps(o.get('fills')) != json.dumps(ref.get('fills')): t.add('fill-group')
    if json.dumps(o.get('strokes')) != json.dumps(ref.get('strokes')): t.add('stroke-group')
    if abs(o['width'] - ref['width']) > .5 or abs(o['height'] - ref['height']) > .5 or abs((o['x'] - rx) - (ref['x'] - ref['_rx'])) > .5 or abs((o['y'] - ry) - (ref['y'] - ref['_ry'])) > .5 or (o['type'] == 'path' and o['content'] != ref['content']): t.add('geometry-group')
    return t

class Builder:
    def __init__(self, file_id): self.file, self.changes, self.comps = file_id, [], {}
    def emit(self, page, n, parent, frame, ref=None, rootxy=None, inst=None):
        o = dict(n['obj']); o['id'] = ID(); o['parentId'] = parent; o['frameId'] = frame
        if ref is not None:
            o['shapeRef'] = ref['obj']['id']
            t = touched(o, ref['obj'], *rootxy)
            if t: o['touched'] = sorted(t)
        self.changes.append({'type': 'add-obj', 'id': o['id'], 'pageId': page, 'parentId': parent, 'frameId': frame, 'obj': o})
        n2 = {'obj': o, 'children': []}
        myframe = o['id'] if o['type'] == 'frame' else frame
        for i, c in enumerate(n['children']):
            n2['children'].append(self.emit(page, c, o['id'], myframe, ref['children'][i] if ref else None, rootxy))
        return n2
    def collect(self, n, top=True):
        if top and n.get('comp'):
            key = n['comp'] + '|' + sig(n)
            self.comps.setdefault(key, {'name': n['comp'], 'node': n, 'uses': 0})['uses'] += 1
            return
        for c in n['children']: self.collect(c, top)
    def make_mains(self, comp_page):
        names = {}; x = y = rowh = 0; prev = None
        for k in sorted(self.comps, key=lambda k: pretty(self.comps[k]['name'])):
            c = self.comps[k]; base = pretty(c['name'])
            names[base] = names.get(base, 0) + 1
            nm = base if names[base] == 1 else '%s %d' % (base, names[base])
            fam = base.split('/')[0]
            if prev and prev != fam: x, y, rowh = 0, y + rowh + 64, 0
            prev = fam
            n = c['node']; w = n['obj']['width']
            if x + w > 1600: x, y, rowh = 0, y + rowh + 32, 0
            moved = shift(n, x - n['obj']['x'], y - n['obj']['y'])
            cid = ID(); main = self.emit(comp_page, moved, ROOT, ROOT)
            parts = nm.split('/'); mo = main['obj']
            mo.update({'componentId': cid, 'componentFile': self.file, 'componentRoot': True, 'mainInstance': True, 'name': parts[-1], 'hideInViewer': False})
            self.changes.append({'type': 'add-component', 'id': cid, 'name': parts[-1], 'path': '/'.join(parts[:-1]), 'mainInstanceId': mo['id'], 'mainInstancePage': comp_page})
            mark(main, mo['x'], mo['y']); c['main'], c['cid'], c['label'] = main, cid, parts[-1]
            x += w + 32; rowh = max(rowh, n['obj']['height'])
    def place(self, page, n, parent, frame, top=True):
        if top and n.get('comp'):
            c = self.comps[n['comp'] + '|' + sig(n)]
            r = self.emit(page, n, parent, frame, ref=c['main'], rootxy=(n['obj']['x'], n['obj']['y']))
            r['obj'].update({'componentId': c['cid'], 'componentFile': self.file, 'componentRoot': True, 'name': c['label']})
            return
        o = dict(n['obj']); o['id'] = ID(); o['parentId'] = parent; o['frameId'] = frame
        self.changes.append({'type': 'add-obj', 'id': o['id'], 'pageId': page, 'parentId': parent, 'frameId': frame, 'obj': o})
        myframe = o['id'] if o['type'] == 'frame' else frame
        for c in n['children']: self.place(page, c, o['id'], myframe, top)
    def finish(self):
        self.changes = [{k: v for k, v in ch.items()} for ch in self.changes]
        for ch in self.changes:
            if 'obj' in ch: ch['obj'] = {k: v for k, v in ch['obj'].items() if not k.startswith('_')}

def mark(n, rx, ry):
    n['obj']['_rx'], n['obj']['_ry'] = rx, ry
    for c in n['children']: mark(c, rx, ry)

def shift(n, dx, dy):
    o = dict(n['obj']); g = geom(o['x'] + dx, o['y'] + dy, o['width'], o['height']); o.update(g)
    if o['type'] == 'path':
        o['content'] = [{'command': s['command'], 'params': {k: v + (dx if k in ('x', 'c1x', 'c2x') else dy) for k, v in s['params'].items()}} for s in o['content']]
    return {**n, 'obj': o, 'children': [shift(c, dx, dy) for c in n['children']]}

NAMES = {'btn': 'Button', 'ds-badge': 'Badge', 'sider': 'Sidebar', 'topbar': 'Topbar', 'avatar': 'Avatar', 'search': 'Search', 'ds-progress': 'Progress', 'nav-item': 'NavItem', 'user-btn': 'UserButton'}
def pretty(n):
    p = n.split('/'); p[0] = NAMES.get(p[0], p[0])
    if len(p) == 1: p.append('default')
    return '/'.join(x[:1].upper() + x[1:] for x in p)
