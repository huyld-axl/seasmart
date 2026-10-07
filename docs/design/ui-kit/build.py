import re, pathlib
S = pathlib.Path(__file__).resolve().parent.parent
src = (S / 'evon-design/nhom-bc.html').read_text()

def sub(old, new, s, count=1):
    assert old in s, old[:80]
    return s.replace(old, new, count)

# --- dữ liệu: gộp hai nhóm, chỉ giữ phương án đã chốt, mặc định có màu
src = sub("const SCREENS = WF_GROUP === 'bc' ? SCREENS_BC : SCREENS_A;", """const CODES = { 'dang-nhap': 'A0', 'thuyen-vien': 'A1', 'ho-so': 'A2', duyet: 'A3', 'doi-chieu': 'B1', 'san-sang': 'B2', 'tao-bo': 'B3', 'ky-duyet': 'B4', 'ban-xuat': 'C1', 'ky-online': 'C2', loi: 'E' };
const ORDER = ['dang-nhap', 'thuyen-vien', 'ho-so', 'duyet', 'doi-chieu', 'san-sang', 'tao-bo', 'ky-duyet', 'ban-xuat', 'ky-online', 'loi'];
const ALL_SCREENS = { ...SCREENS_A, ...SCREENS_BC };
const SCREENS = Object.fromEntries(ORDER.map((key) => [key, { ...ALL_SCREENS[key], options: key === 'loi' ? ALL_SCREENS[key].options : ['a'], recommended: 'a' }]));""", src)
src = sub("const REASONS = WF_GROUP === 'bc' ? REASONS_BC : REASONS_A;", "const REASONS = { ...REASONS_A, ...REASONS_BC };", src)
src = sub("mau: 'xam'", "mau: 'mau'", src)
src = re.sub(r"function syncHash\(\) \{.*?\n\}", "function syncHash() { try { if (currentTab === 'screens') history.replaceState(null, '', '#' + state.man); } catch (error) { /* bỏ qua */ } }", src, count=1, flags=re.S)
src = sub("(function readState() {", "let currentTab = ['#flow', '#ds'].includes(location.hash) ? location.hash.slice(1) : 'screens';\nconst INITIAL_HASH = location.hash.replace(/^#/, '');\n(function readState() {", src)
src = sub("  const hash = location.hash.replace(/^#/, '').split('.');", "  const hash = location.hash.replace(/^#/, '').split('.');\n  if (hash.length === 1 && hash[0] && !['flow', 'ds'].includes(hash[0])) state.man = hash[0];", src)
# lấy bảng hàm vẽ màn để dùng cho ảnh thu nhỏ
m = re.search(r"const screens = (\{ 'thuyen-vien'.*?\});", src)
src = sub("function renderDesign() {", "function screenFns() { return " + m.group(1) + "; }\nfunction renderDesign() {", src)
# bỏ phần chỉ dành cho wireframe: lý do, chọn phương án, công tắc màu, số khối
src = re.sub(r'<details class="wf-reason">.*?</details>\n', '', src, count=1, flags=re.S)
src = sub('  <div class="wf-group"><span>Màn</span><span class="wf-set" data-wf-param="man"></span></div>\n  <div class="wf-group"><span>Phương án</span><span class="wf-set" data-wf-param="v"></span></div>\n  <button type="button" class="wf-switch" data-wf-toggle="mau" role="switch">Màu <i></i></button>\n',
          '  <h2 class="sc-title" id="sc-title"></h2>\n  <span class="wf-set sc-var" data-wf-param="v"></span>\n  <span class="wf-set" data-wf-param="man" hidden></span><button type="button" data-wf-toggle="mau" hidden></button>\n', src)
for i in ('reason-name', 'reason-tag', 'reason-why', 'reason-pros', 'reason-cons', 'reason-fit'):
    pass
src = re.sub(r"\n  const \[name, why, pros, cons, fit, tips\] = REASONS.*?\n  \}\);\n", "\n  renderRail();\n", src, count=1, flags=re.S)

shell = (S / 'showcase/shell.html').read_text()
style, top, tail = shell.split('<!--SPLIT-->')
src = sub('</style>', style + '\n</style>', src)
src = sub('<nav class="wf-bar"', top + '\n<nav class="wf-bar"', src)
src = sub('<main id="wf-design" class="wf-stage"></main>', '<main id="wf-design" class="wf-stage"></main>\n</div></div>', src)
src = src[:src.rindex('</script>')] + tail + '\n</script>' + src[src.rindex('</script>') + 9:]
src = re.sub(r'<title>.*?</title>', '<title>MCAH UI Kit</title>', src, count=1)
if '<title>' not in src[:8000]:
    src = '<title>MCAH UI Kit</title>\n' + src
(S / 'showcase/mcah-ui.html').write_text(src)
print(len(src))
