import { describe, it, expect } from 'vitest'
import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const Fastify = require('fastify')
const contract = require('../../schemas/mcah.schema')
async function validate(schema, body) {
  const app = Fastify({ ajv: { customOptions: { coerceTypes: false, removeAdditional: false } } })
  app.post('/', { schema: { body: schema } }, async () => ({ ok: true }))
  try { return (await app.inject({ method: 'POST', url: '/', payload: body })).statusCode } finally { await app.close() }
}
describe('MCAH v2 contract validation', () => {
  it('preserves UNKNOWN and requires missing reason and null value', async () => {
    const field = { schema_version: 2, source: { document_id: 1, page_id: 2, record_key: 'trip-1' }, record_type: 'SEA_SERVICE', field_key: 'sign_off', raw: null, value: null, state: 'UNKNOWN', missing_reason: 'NOT_ON_SOURCE', critical: true }
    expect(await validate(contract.proposal, field)).toBe(200)
    expect(await validate(contract.proposal, { ...field, missing_reason: null })).toBe(400)
    expect(await validate(contract.proposal, { ...field, value: '2020-01-01' })).toBe(400)
    expect(await validate(contract.proposal, { ...field, source: { ...field.source, page_id: 0 } })).toBe(400)
  })
  it('requires lock, revision and reason for edit/reject', async () => {
    const edit = { lock_version: 0, expected_revision: 1, action: 'edit', value: 'Corrected', reason: 'Source checked' }
    expect(await validate(contract.decision, edit)).toBe(200)
    expect(await validate(contract.decision, { ...edit, reason: null })).toBe(400)
    expect(await validate(contract.decision, { ...edit, reason: '   ' })).toBe(400)
    expect(await validate(contract.decision, { ...edit, expected_revision: -1 })).toBe(400)
    expect(await validate(contract.decision, { ...edit, unexpected: true })).toBe(400)
    expect(await validate(contract.decision, { lock_version: 0, action: 'accept', reason: null })).toBe(400)
  })
  it('requires the full aggregate snapshot and bounds pagination', async () => {
    expect(await validate(contract.snapshot, { schema_version: 2, revision_no: 1, profile: { id: 1 }, sea_service: [], sources: [], certificates: [], contacts: [] })).toBe(200)
    expect(await validate(contract.snapshot, { schema_version: 2, revision_no: 1, profile: { id: 1 } })).toBe(400)
    expect(await validate(contract.pagination, { limit: 101 })).toBe(400)
  })
  it('does not allow edits to terminal exports/documents', () => {
    expect(() => contract.assertTransition('export', 'RELEASED', 'STALE')).not.toThrow()
    expect(() => contract.assertTransition('export', 'RELEASED', 'DRAFT')).toThrow()
    expect(() => contract.assertTransition('document', 'PUBLISHED', 'READING')).toThrow()
    expect(() => contract.assertTransition('job', 'SUCCEEDED', 'RUNNING')).toThrow()
  })
})
