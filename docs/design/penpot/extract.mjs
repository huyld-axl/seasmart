import { chromium } from 'playwright'
const [,, file, query, out] = process.argv
const mob = /kho=mobile/.test(query); const VW = mob ? 390 : 1440, VH = mob ? 844 : 900
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: VW, height: VH } })
await p.goto('file://' + file + '?' + query); await p.waitForTimeout(800)
const extra = await p.evaluate(() => Math.max(0, ...[...document.querySelectorAll('.content, main, .main, .rs-main, .wf-phone')].map(e => e.scrollHeight - e.clientHeight)))
if (extra > 0) { await p.setViewportSize({ width: VW, height: VH + extra }); await p.waitForTimeout(400) }
const data = await p.evaluate(() => {
  const root = document.querySelector('.wf-phone') || document.querySelector('#wf-design > *')
  const R = root.getBoundingClientRect(); const items = []
  const rgb = (c) => { const m = c.match(/rgba?\(([^)]+)\)/); if (!m) return null; const [r, g, bl, a = 1] = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); if (+a === 0) return null; return { hex: '#' + [r, g, bl].map(v => v.toString(16).padStart(2, '0')).join(''), a: +a } }
  const vis = (el) => { const s = getComputedStyle(el); return s.display !== 'none' && s.visibility !== 'hidden' && +s.opacity > 0 }
  function walk(el, depth) {
    if (!vis(el)) return
    const r = el.getBoundingClientRect(); if (r.width < 1 || r.height < 1) { if (getComputedStyle(el).display !== 'contents') return }
    const s = getComputedStyle(el)
    if ((s.clip && s.clip !== 'auto') || (s.position === 'absolute' && r.width <= 2 && r.height <= 2) || /inset\(50%/.test(s.clipPath)) return
    if (el.tagName.toLowerCase() === 'svg') { const c = el.cloneNode(true); c.setAttribute('width', r.width); c.setAttribute('height', r.height); c.setAttribute('color', s.color); items.push({ k: 'svg', x: r.x - R.x, y: r.y - R.y, w: r.width, h: r.height, svg: c.outerHTML.replaceAll('currentColor', rgb(s.color)?.hex || '#000') }); return }
    const bg = rgb(s.backgroundColor); const bw = parseFloat(s.borderTopWidth); const bc = bw ? rgb(s.borderTopColor) : null
    const sides = ['Top', 'Right', 'Bottom', 'Left'].map(k => parseFloat(s['border' + k + 'Width']) > 0 && rgb(s['border' + k + 'Color']))
    const uniform = sides.every(Boolean)
    if (bg || (uniform && bc)) items.push({ k: 'rect', x: r.x - R.x, y: r.y - R.y, w: r.width, h: r.height, bg, stroke: uniform ? bc : null, sw: bw, rad: parseFloat(s.borderTopLeftRadius) || 0, name: el.className && typeof el.className === 'string' ? el.className.split(' ')[0] : el.tagName.toLowerCase() })
    if (/radial-gradient/.test(s.backgroundImage)) { const c = rgb(s.color); items.push({ k: 'rect', x: r.x - R.x + r.width / 2 - 2, y: r.y - R.y + r.height / 2 - 2, w: 4, h: 4, bg: c, rad: 2, name: 'dot' }) }
    if ((el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') && !el.value && el.placeholder) { const c = rgb(getComputedStyle(el, '::placeholder').color) || { hex: '#9aa0a6', a: 1 }; const fs = parseFloat(s.fontSize); items.push({ k: 'text', x: r.x - R.x + parseFloat(s.paddingLeft) + parseFloat(s.borderLeftWidth), y: r.y - R.y + r.height / 2 - fs * 0.6, w: el.placeholder.length * fs * 0.55, h: fs * 1.2, multi: false, t: el.placeholder, size: fs, weight: s.fontWeight, color: c.hex, op: c.a, lh: 1.2, ls: 0, tt: 'none', align: 'left' }) }
    if (!uniform) sides.forEach((c, i) => { if (!c) return; const w = parseFloat(s['border' + ['Top', 'Right', 'Bottom', 'Left'][i] + 'Width']); const L = [[0, 0, r.width, w], [r.width - w, 0, w, r.height], [0, r.height - w, r.width, w], [0, 0, w, r.height]][i]; items.push({ k: 'rect', x: r.x - R.x + L[0], y: r.y - R.y + L[1], w: L[2], h: L[3], bg: c, name: 'border' }) })
    for (const n of el.childNodes) {
      if (n.nodeType === 3 && n.textContent.trim()) {
        const rg = document.createRange(); rg.selectNodeContents(n); const rects = [...rg.getClientRects()].filter(q => q.width > 0)
        if (!rects.length) continue
        const x1 = Math.min(...rects.map(q => q.x)), y1 = Math.min(...rects.map(q => q.y)), x2 = Math.max(...rects.map(q => q.right)), y2 = Math.max(...rects.map(q => q.bottom))
        const c = rgb(s.color)
        items.push({ k: 'text', x: x1 - R.x, y: y1 - R.y, w: x2 - x1 + 2, h: y2 - y1, multi: rects.length > 1 && new Set(rects.map(q => Math.round(q.y))).size > 1, t: n.textContent.replace(/\s+/g, ' ').trim(), size: parseFloat(s.fontSize), weight: s.fontWeight, color: c?.hex || '#000', op: c?.a ?? 1, lh: parseFloat(s.lineHeight) / parseFloat(s.fontSize) || 1.4, ls: parseFloat(s.letterSpacing) || 0, tt: s.textTransform, align: s.textAlign === 'center' ? 'center' : s.textAlign === 'right' || s.textAlign === 'end' ? 'right' : 'left' })
      } else if (n.nodeType === 1) walk(n, depth + 1)
    }
  }
  walk(root, 0)
  items.sort((a, b) => (a.k === 'svg') - (b.k === 'svg'))
  return { w: R.width, h: Math.max(R.height, root.scrollHeight), items }
})
const fs = await import('fs'); fs.writeFileSync(out, JSON.stringify(data)); console.log(data.items.length, data.w, data.h)
await b.close()
