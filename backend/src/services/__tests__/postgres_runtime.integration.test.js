const name = process.env.INTEGRATION_DB_NAME
const enabled = Boolean(name) && /^seasmart_.*test/.test(name) && name !== process.env.DB_NAME

describe.skipIf(!enabled)('PostgreSQL repository integration', () => {
  let db, connection, exportPackService, seafarerId
  const userId = 900001

  beforeAll(async () => {
    process.env.DB_NAME = name
    db = require('../../config/db')
    ;({ exportPackService } = require('../export_pack.service'))
    const [[current]] = await db.query('SELECT current_database() AS name')
    if (current.name !== name) throw new Error('Refusing to run on another database')
  })

  beforeEach(async () => {
    connection = await db.getConnection()
    await connection.beginTransaction()
    await connection.query('INSERT INTO "user" (id, email, password_hash) VALUES (?, ?, ?)', [userId, 'postgres-runtime@example.invalid', 'fixture'])
    const [[country]] = await connection.query('SELECT id FROM country WHERE code = ?', ['VN'])
    const [insert] = await connection.query('INSERT INTO seafarer SET ?', [{ full_name: 'Test PostgreSQL', date_of_birth: '1990-01-01', nationality_id: country.id }])
    seafarerId = insert.insertId
  })

  afterEach(async () => {
    await connection.rollback()
    connection.release()
  })
  afterAll(async () => db?.end())

  it('reads export packs with ordered docs and JSON edits after bound bulk inserts', async () => {
    const [pack] = await connection.query('INSERT INTO export_pack SET ?', [{ seafarer_id: seafarerId, title: 'Test export', created_by: userId, inputs: JSON.stringify({ port: 'Test' }), edits: JSON.stringify({ cv: { A1: 'Test' } }) }])
    await connection.query('INSERT INTO export_pack_doc (pack_id, template_key, sort_order) VALUES ?', [[[pack.insertId, 'cv', 0], [pack.insertId, 'contract', 1]]])
    const result = await exportPackService.list(connection, { seafarer_id: seafarerId, limit: 100 })
    expect(result.total).toBe(1)
    expect(result.data[0].docs).toEqual(['cv', 'contract'])
    const row = await exportPackService.get(connection, pack.insertId)
    expect(row.inputs).toEqual({ port: 'Test' })
    expect(row.edits).toEqual({ cv: { A1: 'Test' } })
  })

  it('preserves integer boolean writes, user toggle, case-insensitive email uniqueness', async () => {
    await connection.query('UPDATE "user" SET ?, updated_at = NOW() WHERE id = ?', [{ is_active: false }, userId])
    await connection.query('UPDATE "user" SET is_active = 1 - is_active WHERE id = ?', [userId])
    const [[user]] = await connection.query('SELECT is_active FROM "user" WHERE id = ?', [userId])
    expect(user.is_active).toBe(1)
    await expect(connection.query('INSERT INTO "user" (email, password_hash) VALUES (?, ?)', ['POSTGRES-RUNTIME@EXAMPLE.INVALID', 'fixture'])).rejects.toMatchObject({ code: '23505' })
  })

  it('allows re-upload after soft delete while rejecting active duplicates', async () => {
    const data = { seafarer_id: seafarerId, file_name: 'test.pdf', mime_type: 'application/pdf', file_size: 1, storage_path: '/test', sha256: 'a'.repeat(64) }
    const [first] = await connection.query('INSERT INTO document_upload SET ?', [data])
    await connection.query('UPDATE document_upload SET deleted_at = NOW() WHERE id = ?', [first.insertId])
    await connection.query('INSERT INTO document_upload SET ?', [data])
    await expect(connection.query('INSERT INTO document_upload SET ?', [data])).rejects.toMatchObject({ code: '23505' })
  })

  it('matches Vietnamese text regardless of accents and case', async () => {
    await connection.query('UPDATE seafarer SET full_name = ? WHERE id = ?', ['Thuyền Viên', seafarerId])
    const [rows] = await connection.query('SELECT id FROM seafarer WHERE id = ? AND unaccent(full_name::text) ILIKE unaccent(?)', [seafarerId, '%thuyen vien%'])
    expect(rows).toHaveLength(1)
  })
})
