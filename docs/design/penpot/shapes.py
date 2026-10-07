import uuid
ROOT = '00000000-0000-0000-0000-000000000000'
ID = lambda: str(uuid.uuid4())
def geom(x, y, w, h):
    return {'x': x, 'y': y, 'width': w, 'height': h, 'rotation': 0,
        'selrect': {'x': x, 'y': y, 'width': w, 'height': h, 'x1': x, 'y1': y, 'x2': x + w, 'y2': y + h},
        'points': [{'x': x, 'y': y}, {'x': x + w, 'y': y}, {'x': x + w, 'y': y + h}, {'x': x, 'y': y + h}],
        'transform': {'a': 1, 'b': 0, 'c': 0, 'd': 1, 'e': 0, 'f': 0}, 'transformInverse': {'a': 1, 'b': 0, 'c': 0, 'd': 1, 'e': 0, 'f': 0}}
def fill(c, o=1): return [{'fillColor': c, 'fillOpacity': o}] if c else []
def stroke(c, w=1): return [{'strokeColor': c, 'strokeOpacity': 1, 'strokeWidth': w, 'strokeAlignment': 'inner', 'strokeStyle': 'solid'}] if c else []
WEIGHT = {'400': 'regular', '500': '500', '600': '600', '700': '700'}
class Doc:
    def __init__(self, page): self.page, self.changes = page, []
    def _add(self, obj, parent, frame):
        obj.update({'parentId': parent, 'frameId': frame})
        self.changes.append({'type': 'add-obj', 'id': obj['id'], 'pageId': self.page, 'parentId': parent, 'frameId': frame, 'obj': obj})
        return obj['id']
    def board(self, name, x, y, w, h, bg=None, parent=ROOT, frame=ROOT, radius=0, strokeC=None, clip=True):
        i = ID(); o = {'id': i, 'type': 'frame', 'name': name, **geom(x, y, w, h), 'fills': fill(bg), 'strokes': stroke(strokeC), 'shapes': [], 'r1': radius, 'r2': radius, 'r3': radius, 'r4': radius, 'showContent': not clip, 'hideFillOnExport': False, 'proportion': 1, 'proportionLock': False}
        return self._add(o, parent, frame)
    def rect(self, name, x, y, w, h, bg=None, parent=ROOT, frame=ROOT, radius=0, strokeC=None, opacity=1):
        i = ID(); o = {'id': i, 'type': 'rect', 'name': name, **geom(x, y, w, h), 'fills': fill(bg, opacity), 'strokes': stroke(strokeC), 'r1': radius, 'r2': radius, 'r3': radius, 'r4': radius, 'proportion': 1, 'proportionLock': False}
        return self._add(o, parent, frame)
    def circle(self, name, x, y, d, bg, parent, frame):
        i = ID(); o = {'id': i, 'type': 'circle', 'name': name, **geom(x, y, d, d), 'fills': fill(bg), 'strokes': [], 'proportion': 1, 'proportionLock': True}
        return self._add(o, parent, frame)
    def text(self, chars, x, y, size=14, weight='400', color='#2c2c2c', parent=ROOT, frame=ROOT, w=None, align='left', name=None, family='Inter', italic=False):
        i = ID(); lh = round(size * 1.45); width = w or max(8, len(chars) * size * 0.56)
        leaf = {'text': chars, 'fontFamily': family, 'fontId': 'gfont-' + family.lower().replace(' ', '-'), 'fontVariantId': ('italic' if italic and weight == '400' else WEIGHT[weight] + ('italic' if italic else '')), 'fontSize': str(size), 'fontWeight': weight, 'fontStyle': 'italic' if italic else 'normal', 'lineHeight': '1.45', 'letterSpacing': '0', 'fills': fill(color), 'textDecoration': 'none', 'textTransform': 'none'}
        para = {'type': 'paragraph', 'textAlign': align, 'children': [leaf], **{k: leaf[k] for k in ('fontFamily', 'fontId', 'fontVariantId', 'fontSize', 'fontWeight', 'fontStyle', 'lineHeight', 'letterSpacing', 'fills')}}
        content = {'type': 'root', 'verticalAlign': 'top', 'children': [{'type': 'paragraph-set', 'children': [para]}]}
        o = {'id': i, 'type': 'text', 'name': name or chars[:40], **geom(x, y, width, lh), 'content': content, 'growType': 'auto-width' if not w else 'auto-height', 'fills': [], 'strokes': []}
        return self._add(o, parent, frame)
