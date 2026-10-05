'use strict'

const cache = {}
const TTL = 5 * 60 * 1000

const TABLE_CACHE_KEY = {
  certificate_type: 'certificate_types',
  country: 'countries',
  port: 'ports',
  partners: 'partners',
}

function invalidateCache(table) {
  const key = TABLE_CACHE_KEY[table]
  if (key) delete cache[key]
}

async function getCached(key, queryFn) {
  const now = Date.now()
  if (cache[key] && now - cache[key].ts < TTL) return cache[key].data
  const data = await queryFn()
  cache[key] = { data, ts: now }
  return data
}

module.exports = { invalidateCache, getCached }
