const { prepareQuery, wrapPool } = require('../postgres_query')

describe('PostgreSQL parameter binding', () => {
  it('keeps injection text in values and skips quoted/comment question marks', () => {
    const value = "x'; DROP TABLE seafarer; --"
    const query = prepareQuery("SELECT '?', $$?$$, \"?\" FROM seafarer WHERE full_name = ? -- ?", [value])
    expect(query.text).toContain('full_name = $1')
    expect(query.text).not.toContain(value)
    expect(query.values).toEqual([value])
  })

  it('expands IN arrays and bulk rows into separate bound parameters', () => {
    expect(prepareQuery('SELECT id FROM seafarer WHERE id IN (?) AND status = ?', [[1, 2], 'AVAILABLE']))
      .toEqual({ text: 'SELECT id FROM seafarer WHERE id IN ($1, $2) AND status = $3', values: [1, 2, 'AVAILABLE'] })
    expect(prepareQuery('INSERT INTO export_pack_doc (pack_id, template_key) VALUES ?', [[[1, 'cv'], [1, 'contract']]]))
      .toEqual({ text: 'INSERT INTO export_pack_doc (pack_id, template_key) VALUES ($1, $2), ($3, $4) RETURNING *', values: [1, 'cv', 1, 'contract'] })
    expect(prepareQuery('SELECT id FROM seafarer WHERE id IN (?)', [[]]).text).toContain('IN (NULL)')
  })

  it('binds object assignments safely, including boolean fields', () => {
    expect(prepareQuery('INSERT INTO "user" SET ?', [{ email: 'test@example.invalid', is_active: true }]))
      .toEqual({ text: 'INSERT INTO "user" ("email", "is_active") VALUES ($1, $2) RETURNING *', values: ['test@example.invalid', 1] })
    expect(prepareQuery('UPDATE seafarer SET ?, updated_at = NOW() WHERE id = ?', [{ full_name: 'Test' }, 1]).values).toEqual(['Test', 1])
    expect(() => prepareQuery('INSERT INTO seafarer SET ?', [{ 'id; DROP TABLE seafarer': 1 }])).toThrow('Invalid SQL identifier')
  })

  it('keeps JSON objects as scalar parameters and rejects count mismatches', () => {
    const data = { value: 'Test' }
    expect(prepareQuery('SELECT ?::jsonb', [data]).values).toEqual([data])
    expect(() => prepareQuery('SELECT ?', [])).toThrow('Missing SQL parameter')
    expect(() => prepareQuery('SELECT 1', [1])).toThrow('Unexpected SQL parameters')
  })

  it('uses the same PostgreSQL connection for a transaction and releases it', async () => {
    const connection = { query: vi.fn().mockResolvedValue({ command: 'SELECT', rows: [], rowCount: 0 }), release: vi.fn() }
    const native = { connect: vi.fn().mockResolvedValue(connection) }
    const db = wrapPool(native)
    const client = await db.getConnection()
    await client.beginTransaction()
    await client.query('SELECT ?', [1])
    await client.rollback()
    client.release()
    expect(connection.query.mock.calls).toEqual([['BEGIN'], [{ text: 'SELECT $1', values: [1] }], ['ROLLBACK']])
    expect(connection.release).toHaveBeenCalledOnce()
  })
})
