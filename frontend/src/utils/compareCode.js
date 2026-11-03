// So sánh hai mã theo số, không theo chữ: CH2699 đứng trước CH26100, CH2601-02 trước CH2601-10.
export function compareCode(a, b) {
  const partsA = String(a ?? '').match(/\d+|\D+/g) || []
  const partsB = String(b ?? '').match(/\d+|\D+/g) || []
  for (let i = 0; i < Math.min(partsA.length, partsB.length); i += 1) {
    const x = partsA[i]
    const y = partsB[i]
    if (/^\d/.test(x) && /^\d/.test(y)) {
      if (Number(x) !== Number(y)) return Number(x) - Number(y)
    } else if (x !== y) {
      return x < y ? -1 : 1
    }
  }
  return partsA.length - partsB.length
}
