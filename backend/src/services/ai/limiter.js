// Giới hạn số lời gọi chạy song song; lời gọi dư xếp hàng theo thứ tự đến.
function createLimiter(max) {
  const limit = Math.max(1, Number(max) || 1)
  let active = 0
  const queue = []

  function next() {
    if (active >= limit || !queue.length) return
    active += 1
    const { fn, resolve, reject } = queue.shift()
    Promise.resolve()
      .then(fn)
      .then(resolve, reject)
      .finally(() => {
        active -= 1
        next()
      })
  }

  return {
    run(fn) {
      return new Promise((resolve, reject) => {
        queue.push({ fn, resolve, reject })
        next()
      })
    },
  }
}

module.exports = { createLimiter }
