// Tên văn phòng lấy từ query (main.js loadFile … { query: { office } }).
const office = new URLSearchParams(location.search).get('office')
if (office) document.getElementById('text').textContent = `${office} đã được chuyển sang một máy chính mới. Máy này ngừng phục vụ để tránh có hai bản dữ liệu.`
document.getElementById('quit').addEventListener('click', () => window.mcah.startup.quit())
