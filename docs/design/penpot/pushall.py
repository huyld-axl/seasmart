import json, uuid
from pp import call; from shapes import Doc
from dom2pp import build
st = json.load(open('state.json'))
SC = [('thuyen-vien', 'A1 · Thuyền viên'), ('ho-so', 'A2 · Hồ sơ thuyền viên'), ('duyet', 'A3 · Duyệt giấy tờ'), ('dang-nhap', 'A4 · Đăng nhập'),
      ('doi-chieu', 'B1 · Đối chiếu tàu'), ('san-sang', 'B2 · Sẵn sàng xuất'), ('tao-bo', 'B3 · Tạo bộ giấy'), ('ky-duyet', 'B4 · Duyệt và ký'),
      ('ban-xuat', 'C1 · Bản xuất'), ('ky-online-m', 'C2 · Ký online (mobile)')]
def push(changes):
    f = call('get-file', {'id': st['file']})
    call('update-file', {'id': st['file'], 'sessionId': str(uuid.uuid4()), 'revn': f['revn'], 'vern': f.get('vern', 0), 'features': f['features'], 'changes': changes})
    return f
f = call('get-file', {'id': st['file']}); objs = f['data']['pagesIndex'][st['page']]['objects']
push([{'type': 'del-obj', 'id': o['id'], 'pageId': st['page']} for o in objs.values() if o.get('parentId') == '00000000-0000-0000-0000-000000000000' and o['id'] != o['parentId']] or [])
x = y = 0; rowh = 0
for i, (k, name) in enumerate(SC):
    data = json.load(open('scr/%s.json' % k))
    if i and i % 4 == 0: x, y, rowh = 0, y + rowh + 200, 0
    d = Doc(st['page']); build(d, data, name, x, y); push(d.changes)
    x += data['w'] + 160; rowh = max(rowh, data['h']); print('ok', name, len(d.changes))
