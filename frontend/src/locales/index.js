import vi from './vi.json'

function resolve(obj, pathParts) {
  let cur = obj
  for (const p of pathParts) {
    if (cur == null || typeof cur !== 'object') return undefined
    cur = cur[p]
  }
  return cur
}

export function translate(key, vars) {
  let value = resolve(vi, key.split('.'))
  if (typeof value !== 'string') return key
  if (vars && typeof vars === 'object') {
    for (const [k, v] of Object.entries(vars)) {
      value = value.split(`{{${k}}}`).join(String(v))
    }
  }
  return value
}
