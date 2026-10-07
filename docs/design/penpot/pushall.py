import json, uuid
from pp import call
from pp_build import Builder, to_nodes, frame_obj, ROOT, ID
st = json.load(open('state.json'))
SC = [('thuyen-vien', 'A1 · Thuyền viên'), ('ho-so', 'A2 · Hồ sơ thuyền viên'), ('duyet', 'A3 · Duyệt giấy tờ'), ('dang-nhap', 'A4 · Đăng nhập'),
      ('doi-chieu', 'B1 · Đối chiếu tàu'), ('san-sang', 'B2 · Sẵn sàng xuất'), ('tao-bo', 'B3 · Tạo bộ giấy'), ('ky-duyet', 'B4 · Duyệt và ký'),
      ('ban-xuat', 'C1 · Bản xuất'), ('ky-online', 'C2 · Ký online (mobile)')]
def push(changes, n=400):
    for i in range(0, len(changes), n):
        f = call('get-file', {'id': st['file']})
        call('update-file', {'id': st['file'], 'sessionId': str(uuid.uuid4()), 'revn': f['revn'], 'vern': f.get('vern', 0), 'features': f['features'], 'changes': changes[i:i + n]})
f = call('get-file', {'id': st['file']}); data = f['data']
pg = st['page']; cp = st.get('comp_page')
ch = []
# xoá sạch: board ở trang màn, trang component cũ, component cũ
for o in data['pagesIndex'][pg]['objects'].values():
    if o.get('parentId') == ROOT and o['id'] != ROOT: ch.append({'type': 'del-obj', 'id': o['id'], 'pageId': pg})
for cid in (data.get('components') or {}): ch.append({'type': 'del-component', 'id': cid})
if cp and cp in data['pagesIndex']: ch.append({'type': 'del-page', 'id': cp})
cp = ID(); st['comp_page'] = cp; json.dump(st, open('state.json', 'w'), indent=1)
ch.append({'type': 'add-page', 'id': cp, 'name': 'Components'})
ch.append({'type': 'mod-page', 'id': pg, 'name': 'Màn hình'})
push(ch)
b = Builder(st['file'])
x = y = rowh = 0; boards = []
for i, (k, name) in enumerate(SC):
    d = json.load(open('scr/%s.json' % k))
    if i and i % 4 == 0: x, y, rowh = 0, y + rowh + 200, 0
    board = {'obj': frame_obj(name, x, y, d['w'], d['h'], bg='#f4f4f6'), 'children': to_nodes(d['items'], x, y)}
    board['obj']['showContent'] = False; board['obj']['hideInViewer'] = False
    boards.append(board); b.collect(board)
    x += d['w'] + 160; rowh = max(rowh, d['h'])
b.make_mains(cp)
for board in boards: b.place(pg, board, ROOT, ROOT)
b.finish()
print('changes', len(b.changes), 'components', len(b.comps), sum(c['uses'] for c in b.comps.values()))
push(b.changes)
print('ok')
