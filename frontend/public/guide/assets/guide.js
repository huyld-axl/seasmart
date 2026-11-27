// Bộ hướng dẫn Catoro: trang chủ (index.html) + mỗi bài một trang (<slug>.html). Tệp này giữ danh mục bài (GUIDE) và
// dựng phần chung quanh nội dung bài: mục lục bên trái, đường dẫn, "Trên trang này", bài liên quan, bài trước / sau,
// tìm kiếm và lọc theo công việc ở trang chủ.
// Thêm bài: tạo <slug>.html theo mẫu một bài có sẵn, thêm vào GUIDE.articles và vào items của một nhóm trong GUIDE.groups.
// Bài "app": chỉ có trong app máy tính, hiện khi mở từ app (app mở bản web kèm ?app=1). Link trong bộ giữ ?app=1.
;(function () {
  var GUIDE = {
    "updated": "26/11/2026",
    "groups": [
      {
        "id": "bat-dau",
        "title": "Bắt đầu",
        "summary": "Cài Catoro cho văn phòng, đăng nhập, mở và cập nhật Catoro.",
        "items": [
          "cai-dat-van-phong",
          "dang-nhap",
          "cai-dat-cap-nhat"
        ]
      },
      {
        "id": "ho-so",
        "title": "Hồ sơ",
        "summary": "Thuyền viên, giấy tờ, đối tác, tàu và người phụ trách.",
        "items": [
          "tong-quan",
          "thuyen-vien",
          "giay-to",
          "doi-tac",
          "tau",
          "nguoi-phu-trach",
          "thu-muc-ho-so"
        ]
      },
      {
        "id": "tuyen-dung",
        "title": "Tuyển và gửi hồ sơ",
        "summary": "Cơ hội của chủ tàu, ráp hồ sơ, gửi thư cho chủ tàu.",
        "items": [
          "co-hoi",
          "gui-chu-tau",
          "gui-email"
        ]
      },
      {
        "id": "hop-dong-tien",
        "title": "Hợp đồng và tiền",
        "summary": "Chuyến tàu, hợp đồng, thu tiền chủ tàu, trả lương và báo cáo.",
        "items": [
          "chuyen-tau",
          "hop-dong",
          "roi-tau",
          "thanh-toan",
          "tra-luong",
          "bao-cao"
        ]
      },
      {
        "id": "quan-tri",
        "title": "Quản trị văn phòng",
        "summary": "Tài khoản, vai trò, danh mục, mục tiêu, máy và mã PIN.",
        "items": [
          "vai-tro",
          "tai-khoan",
          "nhieu-may",
          "ma-pin"
        ]
      },
      {
        "id": "ho-tro",
        "title": "Hỗ trợ",
        "summary": "Câu hỏi thường gặp.",
        "items": [
          "hoi-dap"
        ]
      }
    ],
    "articles": {
      "cai-dat-van-phong": {
        "title": "Cài máy chính và máy nhân viên",
        "summary": "Cài Catoro cho cả văn phòng theo đúng thứ tự, và xử lý khi máy nhân viên không nối được.",
        "group": "bat-dau",
        "jobs": [
          "dy",
          "kt",
          "mg",
          "qt"
        ],
        "app": false,
        "related": [
          "nhieu-may",
          "dang-nhap",
          "cai-dat-cap-nhat"
        ],
        "keywords": "Làm theo đúng thứ tự này · Trước khi bắt đầu · A. Cài máy chính (quản trị văn phòng làm) · B. Thêm tài khoản cho nhân viên (quản trị văn phòng làm) · C. Cài máy nhân viên (từng nhân viên làm trên máy mình) · Gặp màn này thì làm gì · Máy nhân viên vẫn không nối được · Ghi nhớ hằng ngày"
      },
      "dang-nhap": {
        "title": "Đăng nhập và tài khoản",
        "summary": "Đăng nhập bằng Google hoặc mã email, đăng nhập lại sau 30 ngày, tài khoản bị khoá.",
        "group": "bat-dau",
        "jobs": [
          "dy",
          "kt",
          "mg",
          "qt"
        ],
        "app": false,
        "related": [
          "ma-pin",
          "tai-khoan",
          "cai-dat-van-phong"
        ],
        "keywords": "Chi tiết đăng nhập trên ứng dụng máy tính · Ai có tài khoản · Đăng nhập · Lần đầu: cài máy chính · Thêm, tắt tài khoản nhân viên · Đăng nhập lại sau 30 ngày · Khoá bằng mã PIN (tuỳ văn phòng) · Tài khoản hoặc văn phòng bị khoá"
      },
      "tong-quan": {
        "title": "Tổng quan (Dashboard)",
        "summary": "Các con số trên Tổng quan, cách tính, và đặt mục tiêu tháng.",
        "group": "ho-so",
        "jobs": [
          "dy",
          "kt",
          "mg"
        ],
        "app": false,
        "related": [
          "thanh-toan",
          "bao-cao"
        ],
        "keywords": "Cách tính · Đặt mục tiêu tháng"
      },
      "thuyen-vien": {
        "title": "Thuyền viên",
        "summary": "Thêm thuyền viên và làm việc với hồ sơ thuyền viên.",
        "group": "ho-so",
        "jobs": [
          "mg"
        ],
        "app": false,
        "related": [
          "giay-to",
          "nguoi-phu-trach",
          "thu-muc-ho-so"
        ],
        "keywords": "Thêm thuyền viên · Hồ sơ thuyền viên"
      },
      "giay-to": {
        "title": "Giấy tờ và AI đọc giấy",
        "summary": "Nạp giấy tờ, để AI điền sẵn, kiểm tra rồi lưu.",
        "group": "ho-so",
        "jobs": [
          "mg"
        ],
        "app": false,
        "related": [
          "thuyen-vien",
          "thu-muc-ho-so"
        ],
        "keywords": "Nạp giấy tờ bằng AI · Nhắc giấy sắp hết hạn"
      },
      "doi-tac": {
        "title": "Đối tác",
        "summary": "Chủ tàu, đối tác và người liên hệ; quét danh thiếp, mã QR.",
        "group": "ho-so",
        "jobs": [
          "mg"
        ],
        "app": false,
        "related": [
          "tau",
          "co-hoi"
        ],
        "keywords": "Quét danh thiếp và mã QR"
      },
      "tau": {
        "title": "Tàu",
        "summary": "Thêm tàu, tra tàu theo số IMO.",
        "group": "ho-so",
        "jobs": [
          "mg"
        ],
        "app": false,
        "related": [
          "doi-tac",
          "chuyen-tau"
        ],
        "keywords": "Tra tàu theo số IMO"
      },
      "nguoi-phu-trach": {
        "title": "Người phụ trách",
        "summary": "Ai phụ trách thuyền viên, hợp đồng, yêu cầu thanh toán; đổi người và tìm việc của mình.",
        "group": "ho-so",
        "jobs": [
          "dy",
          "kt",
          "mg"
        ],
        "app": false,
        "related": [
          "thuyen-vien",
          "hop-dong",
          "thanh-toan"
        ],
        "keywords": "Được giao tự động khi tạo · Đổi người phụ trách · Tìm việc của mình"
      },
      "co-hoi": {
        "title": "Cơ hội",
        "summary": "Vị trí chủ tàu cần người: hồ sơ yêu cầu, thêm ứng viên, chủ tàu chọn và chốt người.",
        "group": "tuyen-dung",
        "jobs": [
          "dy",
          "mg"
        ],
        "app": false,
        "related": [
          "gui-chu-tau",
          "chuyen-tau",
          "thuyen-vien"
        ],
        "keywords": "Hồ sơ yêu cầu · Thêm ứng viên · Chủ tàu chọn và chốt người"
      },
      "gui-chu-tau": {
        "title": "Hồ sơ nộp và gửi chủ tàu",
        "summary": "Điền biểu mẫu tự động và gửi hồ sơ ứng viên cho chủ tàu.",
        "group": "tuyen-dung",
        "jobs": [
          "mg"
        ],
        "app": false,
        "related": [
          "gui-email",
          "co-hoi"
        ],
        "keywords": "Biểu mẫu tự điền · Gửi thư cho chủ tàu"
      },
      "gui-email": {
        "title": "Gửi email cho chủ tàu",
        "summary": "Hai cách gửi thư trong app: mở bằng app mail hoặc gửi thẳng; cài đặt từng bước.",
        "group": "tuyen-dung",
        "jobs": [
          "dy",
          "mg"
        ],
        "app": true,
        "related": [
          "gui-chu-tau",
          "cai-dat-cap-nhat"
        ],
        "keywords": "Cách 1: Mở bằng app mail · Cách 2: Gửi thẳng từ app"
      },
      "chuyen-tau": {
        "title": "Chuyến tàu",
        "summary": "Chuyến tàu sinh ra khi chốt người; ghi xuống tàu, rời tàu.",
        "group": "hop-dong-tien",
        "jobs": [
          "dy",
          "mg"
        ],
        "app": false,
        "related": [
          "hop-dong",
          "roi-tau",
          "co-hoi"
        ],
        "keywords": "Các thao tác trên chuyến"
      },
      "hop-dong": {
        "title": "Hợp đồng",
        "summary": "Soạn, gửi duyệt và duyệt hợp đồng thuyền viên.",
        "group": "hop-dong-tien",
        "jobs": [
          "dy",
          "mg"
        ],
        "app": false,
        "related": [
          "chuyen-tau",
          "thanh-toan",
          "roi-tau"
        ],
        "keywords": "Soạn hợp đồng · Duyệt"
      },
      "roi-tau": {
        "title": "Rời tàu, sửa và kết thúc hợp đồng",
        "summary": "Rời tàu sớm hoặc muộn, sửa ngày, kết thúc hợp đồng, nhãn cảnh báo.",
        "group": "hop-dong-tien",
        "jobs": [
          "dy",
          "kt",
          "mg"
        ],
        "app": false,
        "related": [
          "hop-dong",
          "chuyen-tau",
          "thanh-toan"
        ],
        "keywords": "Thuyền viên rời tàu sớm hoặc ở lại lâu hơn · Kết thúc hợp đồng · Huỷ chốt hoặc xoá chuyến khi đã có hợp đồng · Nhãn cảnh báo"
      },
      "thanh-toan": {
        "title": "Yêu cầu thanh toán",
        "summary": "Bill thu tiền chủ tàu theo kỳ: sửa, duyệt, gửi, ghi nhận đã thu.",
        "group": "hop-dong-tien",
        "jobs": [
          "dy",
          "kt"
        ],
        "app": false,
        "related": [
          "hop-dong",
          "tra-luong",
          "bao-cao"
        ],
        "keywords": ""
      },
      "tra-luong": {
        "title": "Trả lương thuyền viên",
        "summary": "Chốt khoản trả cho thuyền viên theo từng yêu cầu thanh toán.",
        "group": "hop-dong-tien",
        "jobs": [
          "dy",
          "kt"
        ],
        "app": false,
        "related": [
          "thanh-toan",
          "bao-cao"
        ],
        "keywords": "Sửa sau khi đã chốt"
      },
      "bao-cao": {
        "title": "Báo cáo tháng",
        "summary": "Phải thu, phải chi, lịch thu chi; xem và xuất Excel.",
        "group": "hop-dong-tien",
        "jobs": [
          "dy",
          "kt"
        ],
        "app": false,
        "related": [
          "thanh-toan",
          "tra-luong",
          "tong-quan"
        ],
        "keywords": ""
      },
      "vai-tro": {
        "title": "Vai trò và phân quyền",
        "summary": "Vai trò, quyền và phạm vi dữ liệu; tạo và sửa vai trò.",
        "group": "quan-tri",
        "jobs": [
          "dy",
          "qt"
        ],
        "app": false,
        "related": [
          "tai-khoan",
          "nguoi-phu-trach"
        ],
        "keywords": "Phạm vi dữ liệu · Tạo và sửa vai trò"
      },
      "tai-khoan": {
        "title": "Tài khoản",
        "summary": "Thêm, sửa, khoá tài khoản nhân viên.",
        "group": "quan-tri",
        "jobs": [
          "qt"
        ],
        "app": false,
        "related": [
          "vai-tro",
          "dang-nhap",
          "nhieu-may"
        ],
        "keywords": ""
      },
      "nhieu-may": {
        "title": "Máy trong văn phòng",
        "summary": "Máy chính, máy nhân viên, gỡ và duyệt máy, mất nối, cập nhật theo máy chính.",
        "group": "quan-tri",
        "jobs": [
          "dy",
          "kt",
          "mg",
          "qt"
        ],
        "app": true,
        "related": [
          "cai-dat-van-phong",
          "ma-pin",
          "cai-dat-cap-nhat"
        ],
        "keywords": "Máy chính và máy nhân viên · Nối một máy nhân viên · Máy trong văn phòng · Mất nối máy chính · Hai người cùng sửa một hồ sơ · Cập nhật"
      },
      "ma-pin": {
        "title": "Mã PIN và tự khoá",
        "summary": "Bật khoá cho văn phòng, đặt, đổi và quên mã PIN trên từng máy.",
        "group": "quan-tri",
        "jobs": [
          "dy",
          "kt",
          "mg",
          "qt"
        ],
        "app": true,
        "related": [
          "dang-nhap",
          "nhieu-may",
          "cai-dat-cap-nhat"
        ],
        "keywords": "Quản trị: bật hoặc tắt cho cả văn phòng · Mỗi người: đặt mã PIN lần đầu · Đổi mã PIN · Quên mã PIN · Khi Catoro tự khoá · Khi văn phòng tắt khoá bằng PIN"
      },
      "thu-muc-ho-so": {
        "title": "Thư mục hồ sơ",
        "summary": "Giấy tờ nằm ở đâu trên máy chính, bảo vệ máy chính, sao lưu.",
        "group": "may-tinh",
        "jobs": [
          "dy",
          "kt",
          "mg",
          "qt"
        ],
        "app": true,
        "related": [
          "thuyen-vien",
          "giay-to",
          "cai-dat-cap-nhat"
        ],
        "keywords": "Thư mục hồ sơ · Bảo vệ máy chính · Không có sao lưu trong Catoro · Quét giấy tờ bằng AI · Cập nhật"
      },
      "cai-dat-cap-nhat": {
        "title": "Cài đặt, mở, cập nhật và gỡ Catoro",
        "summary": "Tải bộ cài, mở Catoro khi gặp lỗi, kênh cập nhật, gỡ Catoro trên Windows và Ubuntu.",
        "group": "may-tinh",
        "jobs": [
          "dy",
          "kt",
          "mg",
          "qt"
        ],
        "app": true,
        "related": [
          "cai-dat-van-phong",
          "nhieu-may"
        ],
        "keywords": "Tải và cài · Cập nhật · Gỡ cài đặt · Mở Catoro"
      },
      "hoi-dap": {
        "title": "Hỏi đáp",
        "summary": "Các câu hỏi thường gặp.",
        "group": "ho-tro",
        "jobs": [
          "dy",
          "kt",
          "mg",
          "qt"
        ],
        "app": false,
        "related": [
          "ma-pin",
          "roi-tau"
        ],
        "keywords": ""
      }
    }
  }

  var params = new URLSearchParams(location.search)
  var inApp = location.protocol === 'app:' || params.has('app')
  if (inApp) document.documentElement.classList.add('trong-app')


  var JOBS = { mg: 'Môi giới', dy: 'Duyệt & quản lý', kt: 'Kế toán', qt: 'Quản trị' }
  var order = []
  GUIDE.groups.forEach(function (g) { g.items.forEach(function (slug) { order.push(slug) }) })
  var shown = function (slug) { return inApp || !GUIDE.articles[slug].app }
  var groupOf = function (slug) { return GUIDE.groups.filter(function (g) { return g.items.indexOf(slug) >= 0 })[0] }
  var esc = function (s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;') }
  var plain = function (s) { return String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase() }
  var href = function (slug, hash) { return slug + '.html' + (hash ? '#' + hash : '') }
  var jobChips = function (jobs) { return Object.keys(JOBS).filter(function (j) { return jobs.indexOf(j) >= 0 }).map(function (j) { return '<span class="job j-' + j + '">' + JOBS[j] + '</span>' }).join('') }
  var el = function (tag, attrs, inner) {
    var node = document.createElement(tag)
    Object.keys(attrs || {}).forEach(function (k) { node.setAttribute(k, attrs[k]) })
    if (inner != null) node.innerHTML = inner
    return node
  }
  var store = {
    get: function (k) { try { return localStorage.getItem(k) } catch (e) { return null } },
    set: function (k, v) { try { localStorage.setItem(k, v) } catch (e) { /* trình duyệt chặn: bỏ qua */ } },
  }

  function sidebar(current) {
    var toc = GUIDE.groups.map(function (g) {
      var links = g.items.filter(shown).map(function (slug) {
        return '<a href="' + href(slug) + '"' + (slug === current ? ' class="on" aria-current="page"' : '') + '>' + esc(GUIDE.articles[slug].title) + '</a>'
      }).join('')
      return links ? '<p>' + esc(g.title) + '</p>' + links : ''
    }).join('') + '<span class="empty" id="toc-empty">Không có bài nào khớp.</span>'
    var side = el('aside', { class: 'side', id: 'side', 'aria-label': 'Mục lục' },
      '<a class="brand" href="index.html"><i><img src="/favicon.svg" alt=""></i><span><b>Catoro</b><small>Hướng dẫn sử dụng</small></span></a>' +
      '<label class="find"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>' +
      '<input id="find" type="search" placeholder="Lọc mục lục…" aria-label="Lọc mục lục"></label>' +
      '<nav class="toc" id="toc">' + toc + '</nav>')
    document.body.insertBefore(el('div', { class: 'scrim', id: 'scrim' }), document.body.firstChild)
    document.body.insertBefore(side, document.body.firstChild)

    // Lọc mục lục theo chữ (không phân biệt dấu), tìm cả trong tóm tắt và tiêu đề mục của bài.
    var links = side.querySelectorAll('#toc a')
    side.querySelector('#find').addEventListener('input', function (e) {
      var q = plain(e.target.value.trim())
      var count = 0
      links.forEach(function (a) {
        var slug = a.getAttribute('href').replace('.html', '')
        var art = GUIDE.articles[slug]
        var text = art ? art.title + ' ' + art.summary + ' ' + art.keywords : a.textContent
        var ok = !q || plain(text).indexOf(q) >= 0
        a.style.display = ok ? '' : 'none'
        if (ok) count++
      })
      side.querySelectorAll('#toc p').forEach(function (p) {
        var n = p.nextElementSibling, any = false
        while (n && n.tagName === 'A') { if (n.style.display !== 'none') any = true; n = n.nextElementSibling }
        p.style.display = any ? '' : 'none'
      })
      side.querySelector('#toc-empty').style.display = count ? 'none' : 'block'
    })
    var on = side.querySelector('#toc a.on')
    if (on) on.scrollIntoView({ block: 'center' })
  }

  function topBar(inner, extraClass) {
    var bar = el('div', { class: 'bar' + (extraClass ? ' ' + extraClass : '') },
      '<button class="menu-btn" id="menu-btn" type="button" aria-label="Mở mục lục" aria-controls="side" aria-expanded="false">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16"/></svg></button>' + inner)
    var page = document.querySelector('.page')
    page.insertBefore(bar, page.firstChild)
    // Ngăn kéo mục lục ở màn hẹp.
    var btn = bar.querySelector('#menu-btn')
    var setNav = function (open) { document.body.classList.toggle('nav-open', open); btn.setAttribute('aria-expanded', String(open)) }
    btn.addEventListener('click', function () { setNav(!document.body.classList.contains('nav-open')) })
    document.getElementById('scrim').addEventListener('click', function () { setNav(false) })
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') setNav(false) })
    return bar
  }

  // Mục ẩn theo bản (chi-app / chi-web) không đưa vào "Trên trang này".
  var hiddenByMode = function (node) { return Boolean(node.closest(inApp ? '.chi-web' : '.chi-app')) }

  function article(slug) {
    var art = GUIDE.articles[slug]
    var group = groupOf(slug)
    var main = document.querySelector('main')
    topBar('<nav class="crumbs" aria-label="Đường dẫn"><a href="index.html">Hướng dẫn</a><span aria-hidden="true">›</span><a href="index.html#' + group.id + '">' + esc(group.title) + '</a><span aria-hidden="true">›</span><b>' + esc(art.title) + '</b></nav>')
    var header = main.querySelector('header')
    if (art.jobs.length) header.appendChild(el('div', { class: 'for' }, 'Dành cho: ' + jobChips(art.jobs) + (art.app ? '<span class="tag t-info">Ứng dụng máy tính</span>' : '')))

    var heads = Array.prototype.filter.call(main.querySelectorAll('section h2[id], section h3[id]'), function (h) { return !hiddenByMode(h) })
    if (heads.length >= 3) {
      header.insertAdjacentElement('afterend', el('nav', { class: 'onpage', 'aria-label': 'Trên trang này' },
        '<b>Trên trang này</b>' + heads.map(function (h) { return '<a href="#' + h.id + '"' + (h.tagName === 'H3' && main.querySelector('section h2[id]') ? ' class="sub"' : '') + '>' + esc(h.textContent) + '</a>' }).join('')))
    }

    var related = art.related.filter(shown)
    if (related.length) {
      main.appendChild(el('nav', { class: 'related', 'aria-label': 'Bài liên quan' }, '<h2>Bài liên quan</h2><ul>' + related.map(function (s) {
        var r = GUIDE.articles[s]
        return '<li><a href="' + href(s) + '"><span><b>' + esc(r.title) + '</b><small>' + esc(r.summary) + '</small></span><i aria-hidden="true">›</i></a></li>'
      }).join('') + '</ul>'))
    }
    var list = order.filter(shown)
    var i = list.indexOf(slug)
    var prev = list[i - 1], next = list[i + 1]
    main.appendChild(el('nav', { class: 'pager', 'aria-label': 'Bài trước và bài sau' },
      (prev ? '<a class="prev" href="' + href(prev) + '"><small>← Bài trước</small><b>' + esc(GUIDE.articles[prev].title) + '</b></a>' : '<span></span>') +
      (next ? '<a class="next" href="' + href(next) + '"><small>Bài sau →</small><b>' + esc(GUIDE.articles[next].title) + '</b></a>' : '')))
    main.appendChild(el('footer', {}, 'Cập nhật ' + GUIDE.updated + ' · Không thấy điều bạn cần? Xem <a href="hoi-dap.html">Hỏi đáp</a>. Ảnh minh hoạ chụp từ dữ liệu demo tự đặt; tên người, công ty, tàu và số giấy tờ đều không có thật.'))
  }

  function hub() {
    var main = document.querySelector('main')
    topBar('<b>Trung tâm hướng dẫn</b>', 'hub-bar')
    var groups = main.querySelector('#groups')
    groups.innerHTML = GUIDE.groups.map(function (g) {
      var items = g.items.filter(shown)
      if (!items.length) return ''
      return '<section class="group" id="' + g.id + '"><h3>' + esc(g.title) + '</h3><p>' + esc(g.summary) + '</p><ul>' +
        items.map(function (s) { return '<li data-jobs="' + GUIDE.articles[s].jobs.join(' ') + '"><a href="' + href(s) + '">' + esc(GUIDE.articles[s].title) + '</a></li>' }).join('') + '</ul></section>'
    }).join('')

    // Lọc theo công việc: chỉ để lại bài gắn nhóm đang chọn. Nhớ lựa chọn trong máy.
    var buttons = main.querySelectorAll('#jobs button')
    var applyJob = function (job) {
      buttons.forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.job === job)) })
      groups.querySelectorAll('li').forEach(function (li) { li.classList.toggle('off', job !== 'all' && li.dataset.jobs.split(' ').indexOf(job) < 0) })
      groups.querySelectorAll('.group').forEach(function (g) { g.style.display = g.querySelector('li:not(.off)') ? '' : 'none' })
      store.set('catoro-guide-job', job)
    }
    buttons.forEach(function (b) { b.addEventListener('click', function () { applyJob(b.dataset.job) }) })
    var saved = (store.get('catoro-guide-job') || store.get('mcah-guide-job')) || 'all'
    applyJob(main.querySelector('#jobs button[data-job="' + saved + '"]') ? saved : 'all')

    // Tìm kiếm: mọi từ phải có trong tiêu đề, tóm tắt hoặc tiêu đề mục của bài (không phân biệt dấu).
    var input = main.querySelector('#search')
    var results = main.querySelector('#results')
    var mark = function (text, words) {
      var out = esc(text)
      words.forEach(function (w) {
        var p = plain(out), at = p.indexOf(w)
        if (w.length > 1 && at >= 0) out = out.slice(0, at) + '<mark>' + out.slice(at, at + w.length) + '</mark>' + out.slice(at + w.length)
      })
      return out
    }
    input.addEventListener('input', function () {
      var words = plain(input.value.trim()).split(/\s+/).filter(Boolean)
      if (!words.length) { results.innerHTML = ''; return }
      var hits = order.filter(shown).map(function (s) {
        var a = GUIDE.articles[s]
        var title = plain(a.title), body = plain(a.summary + ' ' + a.keywords + ' ' + groupOf(s).title)
        if (!words.every(function (w) { return title.indexOf(w) >= 0 || body.indexOf(w) >= 0 })) return null
        var score = words.filter(function (w) { return title.indexOf(w) >= 0 }).length
        return { slug: s, score: score }
      }).filter(Boolean).sort(function (a, b) { return b.score - a.score })
      results.innerHTML = hits.length
        ? hits.slice(0, 8).map(function (h) {
            var a = GUIDE.articles[h.slug]
            return '<a href="' + href(h.slug) + '"><small>' + esc(groupOf(h.slug).title) + '</small><b>' + mark(a.title, words) + '</b><span>' + mark(a.summary, words) + '</span></a>'
          }).join('')
        : '<p>Không tìm thấy bài nào. Thử từ khác, hoặc xem <a href="hoi-dap.html">Hỏi đáp</a>.</p>'
      keepApp(results)
    })
    input.addEventListener('keydown', function (e) {
      var first = results.querySelector('a')
      if (e.key === 'Enter' && first) location.href = first.getAttribute('href')
    })

    main.querySelector('#quick').innerHTML = ['cai-dat-van-phong', 'dang-nhap', 'co-hoi', 'thanh-toan', 'ma-pin', 'gui-email'].filter(shown).map(function (s) {
      var a = GUIDE.articles[s]
      return '<a class="card" href="' + href(s) + '"><small>' + esc(groupOf(s).title) + '</small><b>' + esc(a.title) + '</b><span>' + esc(a.summary) + '</span></a>'
    }).join('')
    main.querySelector('#updated').textContent = GUIDE.updated
  }

  // Link nội bộ giữ ?app=1 để bài chỉ có trong app vẫn hiện khi chuyển trang.
  function keepApp(root) {
    if (!inApp || location.protocol === 'app:') return
    root.querySelectorAll('a[href]').forEach(function (a) {
      var h = a.getAttribute('href')
      if (!/^[\w-]+\.html(#.*)?$/.test(h)) return
      var parts = h.split('#')
      a.setAttribute('href', parts[0] + '?app=1' + (parts[1] ? '#' + parts[1] : ''))
    })
  }

  document.addEventListener('DOMContentLoaded', function () {
    var slug = document.body.dataset.page
    sidebar(slug)
    if (slug && GUIDE.articles[slug]) article(slug)
    else hub()
    keepApp(document)
  })
})()
