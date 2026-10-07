import { chromium } from 'playwright'
import fs from 'fs'
const [,, file, query, out] = process.argv
const mob = /kho=mobile/.test(query); const VW = mob ? 390 : 1440, VH = mob ? 844 : 900
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: VW, height: VH } })
await p.goto('file://' + file + '?' + query); await p.waitForTimeout(800)
const extra = await p.evaluate(() => Math.max(0, ...[...document.querySelectorAll('.content, main, .main, .rs-main, .wf-phone')].map(e => e.scrollHeight - e.clientHeight)))
if (extra > 0) { await p.setViewportSize({ width: VW, height: VH + extra }); await p.waitForTimeout(400) }
const COMP = ['sider', 'topbar', 'nav-item', 'btn', 'ds-badge', 'avatar', 'search', 'ds-progress', 'user-btn']
const data = await p.evaluate((COMP) => {
  const root = document.querySelector('.wf-phone') || document.querySelector('#wf-design > *')
  const R = root.getBoundingClientRect()
  const rgb = (c) => { const m = c && c.match(/rgba?\(([^)]+)\)/); if (!m) return null; const [r, g, bl, a = 1] = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); if (+a === 0) return null; return { hex: '#' + [r, g, bl].map(v => Math.round(v).toString(16).padStart(2, '0')).join(''), a: +a } }
  const vis = (el) => { const s = getComputedStyle(el); return s.display !== 'none' && s.visibility !== 'hidden' && +s.opacity > 0 }
  const textItem = (t, x, y, w, h, multi, st, color) => ({ k: 'text', x, y, w, h, multi, t: st.textTransform === 'uppercase' ? t.toUpperCase() : t, size: parseFloat(st.fontSize), weight: st.fontWeight, color: color?.hex || '#000', op: color?.a ?? 1, lh: parseFloat(st.lineHeight) / parseFloat(st.fontSize) || 1.4, ls: parseFloat(st.letterSpacing) || 0, align: st.textAlign === 'center' ? 'center' : (st.textAlign === 'right' || st.textAlign === 'end') ? 'right' : 'left' })
  function walk(el, items) {
    if (!vis(el)) return
    const r = el.getBoundingClientRect(); const s = getComputedStyle(el)
    if ((r.width < 1 || r.height < 1) && s.display !== 'contents') return
    if ((s.clip && s.clip !== 'auto') || (s.position === 'absolute' && r.width <= 2 && r.height <= 2) || /inset\(50%/.test(s.clipPath)) return
    const box = { x: r.x - R.x, y: r.y - R.y, w: r.width, h: r.height }
    if (el.tagName.toLowerCase() === 'svg') { const c = el.cloneNode(true); c.setAttribute('width', r.width); c.setAttribute('height', r.height); items.push({ k: 'svg', ...box, svg: c.outerHTML.replaceAll('currentColor', rgb(s.color)?.hex || '#000') }); return }
    const cls = typeof el.className === 'string' ? el.className.split(/\s+/).filter(Boolean) : []
    const ck = COMP.find(c => cls.includes(c))
    let target = items
    if (ck) { const g = { k: 'group', name: [ck, ...cls.filter(c => c.startsWith(ck + '--')).map(c => c.slice(ck.length + 2))].join('/') + (el.getAttribute('aria-current') ? '/active' : ''), ...box, children: [] }; items.push(g); target = g.children }
    const bg = rgb(s.backgroundColor); const bw = parseFloat(s.borderTopWidth)
    const sides = ['Top', 'Right', 'Bottom', 'Left'].map(k => parseFloat(s['border' + k + 'Width']) > 0 && rgb(s['border' + k + 'Color']))
    const uniform = sides.every(Boolean)
    if (bg || uniform) target.push({ k: 'rect', ...box, bg, stroke: uniform ? sides[0] : null, sw: bw, rad: parseFloat(s.borderTopLeftRadius) || 0, name: ck ? 'bg' : (cls[0] || el.tagName.toLowerCase()) })
    if (!uniform) sides.forEach((c, i) => { if (!c) return; const w = parseFloat(s['border' + ['Top', 'Right', 'Bottom', 'Left'][i] + 'Width']); const L = [[0, 0, r.width, w], [r.width - w, 0, w, r.height], [0, r.height - w, r.width, w], [0, 0, w, r.height]][i]; target.push({ k: 'rect', x: box.x + L[0], y: box.y + L[1], w: L[2], h: L[3], bg: c, name: 'border' }) })
    if (/radial-gradient/.test(s.backgroundImage)) target.push({ k: 'rect', x: box.x + r.width / 2 - 2, y: box.y + r.height / 2 - 2, w: 4, h: 4, bg: rgb(s.color), rad: 2, name: 'dot' })
    if (el.tagName === 'INPUT' && (el.type === 'checkbox' || el.type === 'radio')) { target.push({ k: 'rect', ...box, bg: el.checked ? rgb(getComputedStyle(document.documentElement).getPropertyValue('--primary').trim()) || { hex: '#1f4e8c', a: 1 } : { hex: '#ffffff', a: 1 }, stroke: { hex: '#bfc4cc', a: 1 }, sw: 1, rad: el.type === 'radio' ? box.w / 2 : 4, name: el.type }); return }
    if ((el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') && (el.value || el.placeholder)) {
      const c = el.value ? rgb(s.color) : rgb(getComputedStyle(el, '::placeholder').color); const fs = parseFloat(s.fontSize)
      const t = el.type === 'password' && el.value ? '••••••••' : (el.value || el.placeholder)
      target.push(textItem(t, box.x + parseFloat(s.paddingLeft) + parseFloat(s.borderLeftWidth), box.y + r.height / 2 - fs * 0.6, t.length * fs * 0.55, fs * 1.2, false, s, c))
    }
    for (const n of el.childNodes) {
      if (n.nodeType === 3 && n.textContent.trim()) {
        const rg = document.createRange(); rg.selectNodeContents(n); const rects = [...rg.getClientRects()].filter(q => q.width > 0)
        if (!rects.length) continue
        const x1 = Math.min(...rects.map(q => q.x)), y1 = Math.min(...rects.map(q => q.y)), x2 = Math.max(...rects.map(q => q.right)), y2 = Math.max(...rects.map(q => q.bottom))
        const multi = new Set(rects.map(q => Math.round(q.y))).size > 1
        target.push(textItem(n.textContent.replace(/\s+/g, ' ').trim(), x1 - R.x, y1 - R.y, x2 - x1, y2 - y1, multi, s, rgb(s.color)))
      } else if (n.nodeType === 1) walk(n, target)
    }
  }
  const items = []; walk(root, items)
  return { w: R.width, h: Math.max(R.height, root.scrollHeight), items }
}, COMP)
fs.writeFileSync(out, JSON.stringify(data)); console.log(out.split('/').pop(), data.items.length)
await b.close()
