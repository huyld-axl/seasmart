import { readdirSync, readFileSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { expect, it } from 'vitest'
import { BREAKPOINTS } from '../hooks/useViewport'

// CSS chỉ dùng ba mốc màn (hooks/useViewport.js). Mốc khác phải ghi lý do bằng comment `mốc riêng:` ngay trên
// hoặc cùng dòng với @media. Container query (@container) không tính.
const SRC = resolve('src') // vitest chạy ở thư mục frontend/
const ALLOWED = new Set([
  ...Object.values(BREAKPOINTS).map((value) => `min-width: ${value}px`),
  ...Object.values(BREAKPOINTS).map((value) => `max-width: ${value - 1}px`),
])

function cssFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) return entry.name === 'node_modules' ? [] : cssFiles(path)
    return entry.name.endsWith('.css') ? [path] : []
  })
}

it('mọi @media chỉ dùng mốc 640 / 768 / 1024, trừ chỗ ghi "mốc riêng:"', () => {
  const offenders = []
  for (const file of cssFiles(SRC)) {
    const lines = readFileSync(file, 'utf8').split('\n')
    lines.forEach((line, index) => {
      if (!line.includes('@media')) return
      if (line.includes('mốc riêng:') || lines[index - 1]?.includes('mốc riêng:')) return
      for (const [, width] of line.matchAll(/\(((?:min|max)-width:\s*\d+px)\)/g)) {
        if (!ALLOWED.has(width.replace(/\s+/g, ' '))) offenders.push(`${relative(SRC, file)}:${index + 1} ${width}`)
      }
    })
  }
  expect(offenders).toEqual([])
})
