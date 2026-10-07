import json, uuid, sys, xml.etree.ElementTree as ET
from pp import call; from shapes import Doc, ID, geom, fill, stroke
def svgtree(e):
    tag = e.tag.split('}')[-1]
    attrs = {k.split('}')[-1]: v for k, v in e.attrib.items() if k.split('}')[-1] not in ('class', 'aria-hidden', 'focusable')}
    return {'tag': tag, 'attrs': attrs, 'content': [svgtree(c) for c in e]}
def build(d, data, name, x0, y0):
    s = d.board(name, x0, y0, data['w'], data['h'], bg='#f4f4f6')
    for it in data['items']:
        x, y, w, h = x0 + it['x'], y0 + it['y'], it['w'], it['h']
        if it['k'] == 'rect':
            i = d.rect(it.get('name') or 'rect', x, y, w, h, bg=it['bg']['hex'] if it.get('bg') else None, parent=s, frame=s, radius=min(it.get('rad', 0), h / 2, w / 2), strokeC=it['stroke']['hex'] if it.get('stroke') else None)
            o = d.changes[-1]['obj']
            if it.get('bg'): o['fills'][0]['fillOpacity'] = it['bg']['a']
            if it.get('stroke'): o['strokes'][0]['strokeWidth'] = it.get('sw', 1)
        elif it['k'] == 'text':
            t = it['t'].upper() if it['tt'] == 'uppercase' else it['t']
            lhpx = it['lh'] * it['size']
            ty = y - (lhpx - h) / 2 if not it['multi'] else y
            d.text(t, x, ty, round(it['size']), str(it['weight']) if str(it['weight']) in ('400', '500', '600', '700') else '400', it['color'], parent=s, frame=s, w=w + 4 if it['multi'] else None, align=it['align'])
            o = d.changes[-1]['obj']; leafp = o['content']['children'][0]['children'][0]
            if not it['multi']: o['width'] = w + 4; geomfix(o, x, ty, w + 4, lhpx); o['growType'] = 'auto-width'
            for node in (leafp, leafp['children'][0]):
                node['lineHeight'] = str(round(it['lh'], 3)); node['letterSpacing'] = str(it['ls']); node['fills'][0]['fillOpacity'] = it['op']
        elif it['k'] == 'svg':
            icon_paths(d, it['svg'], x, y, w, h, s)
    return s
import io, svgelements as SE
def icon_paths(d, svg, x, y, w, h, parent):
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
        if not segs: continue
        bb = p.bbox()
        if not bb: continue
        bx, by, bx2, by2 = bb; bw, bh = max(bx2 - bx, 0.01), max(by2 - by, 0.01)
        fc = el.fill.hex if el.fill is not None and el.fill.value is not None else None
        sc = el.stroke.hex if el.stroke is not None and el.stroke.value is not None else None
        o = {'id': ID(), 'type': 'path', 'name': 'icon', **geom(bx, by, bw, bh), 'content': segs, 'fills': fill(fc[:7] if fc else None), 'strokes': []}
        if sc: o['strokes'] = [{'strokeColor': sc[:7], 'strokeOpacity': 1, 'strokeWidth': (el.stroke_width or 1) * w / 24, 'strokeAlignment': 'center', 'strokeStyle': 'solid', 'strokeCapStart': 'round', 'strokeCapEnd': 'round'}]
        d._add(o, parent, parent)
def geomfix(o, x, y, w, h): o.update(geom(x, y, w, h))
if __name__ == '__main__':
    st = json.load(open('state.json'))
    f = call('get-file', {'id': st['file']}); objs = f['data']['pagesIndex'][st['page']]['objects']
    d = Doc(st['page'])
    for o in objs.values():
        if o.get('parentId') == '00000000-0000-0000-0000-000000000000' and o['id'] != o['parentId']:
            d.changes.append({'type': 'del-obj', 'id': o['id'], 'pageId': st['page']})
    x = 0
    for path, name in zip(sys.argv[1::2], sys.argv[2::2]):
        data = json.load(open(path)); build(d, data, name, x, 0); x += data['w'] + 120
    r = call('update-file', {'id': st['file'], 'sessionId': str(uuid.uuid4()), 'revn': f['revn'], 'vern': f.get('vern', 0), 'features': f['features'], 'changes': d.changes})
    print('ok', len(d.changes))
