const pool = require('../../config/db')
const { invalidateCache } = require('./lookup.routes')

const ADMIN_ROLES = ['admin', 'operator', 'accountant']

function adminAuth(fastify) {
  return {
    onRequest: [fastify.authenticate],
    preHandler: async (request, reply) => {
      if (!ADMIN_ROLES.includes(request.user.role)) {
        return reply.code(403).send({ error: 'Không có quyền thực hiện' })
      }
    },
  }
}

function buildPartnerCodeSeed(companyName) {
  const normalized = String(companyName || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9]/g, '')
    .toUpperCase()
  return (normalized || 'PARTNER').slice(0, 10)
}

async function generateUniquePartnerCode(companyName) {
  const seed = buildPartnerCodeSeed(companyName)

  for (let i = 0; i < 20; i += 1) {
    const suffix = i === 0 ? '' : String(Math.floor(Math.random() * 10000)).padStart(4, '0')
    const candidate = `${seed}${suffix}`.slice(0, 30)
    const [[existing]] = await pool.query(
      'SELECT id FROM partner WHERE code = ? AND deleted_at IS NULL LIMIT 1',
      [candidate]
    )
    if (!existing) return candidate
  }

  return `${seed}${Date.now().toString().slice(-6)}`.slice(0, 30)
}

async function partnerRoutes(fastify) {
  fastify.get('/', { onRequest: [fastify.authenticate] }, async (request) => {
    const {
      search,
      company_name,
      code,
      contact_person,
      is_active,
      payment_cycle,
      page: pageRaw,
      limit: limitRaw,
    } = request.query
    const page = Math.max(1, parseInt(pageRaw) || 1)
    const limit = Math.min(parseInt(limitRaw) || 20, 100)
    const offset = (page - 1) * limit

    let sql = `
      SELECT p.*, c.name_vi AS country_name
      FROM partner p
      LEFT JOIN country c ON c.id = p.country_id
      WHERE p.deleted_at IS NULL`
    const params = []

    if (search) {
      sql += ' AND (p.company_name LIKE ? OR p.code LIKE ? OR p.contact_person LIKE ?)'
      params.push(`%${search}%`, `%${search}%`, `%${search}%`)
    }
    if (company_name) {
      sql += ' AND p.company_name LIKE ?'
      params.push(`%${company_name}%`)
    }
    if (code) {
      sql += ' AND p.code LIKE ?'
      params.push(`%${code}%`)
    }
    if (contact_person) {
      sql += ' AND p.contact_person LIKE ?'
      params.push(`%${contact_person}%`)
    }
    if (is_active !== undefined && is_active !== '') {
      sql += ' AND p.is_active = ?'
      params.push(is_active === 'true' || is_active === '1' ? 1 : 0)
    }
    if (payment_cycle) {
      sql += ' AND p.payment_cycle = ?'
      params.push(payment_cycle)
    }
    sql += ' ORDER BY p.created_at DESC, p.id DESC LIMIT ? OFFSET ?'
    params.push(limit, offset)

    const [rows] = await pool.query(sql, params)

    let countSql = 'SELECT COUNT(*) AS total FROM partner p WHERE p.deleted_at IS NULL'
    const countParams = []
    if (search) {
      countSql += ' AND (p.company_name LIKE ? OR p.code LIKE ? OR p.contact_person LIKE ?)'
      countParams.push(`%${search}%`, `%${search}%`, `%${search}%`)
    }
    if (company_name) {
      countSql += ' AND p.company_name LIKE ?'
      countParams.push(`%${company_name}%`)
    }
    if (code) {
      countSql += ' AND p.code LIKE ?'
      countParams.push(`%${code}%`)
    }
    if (contact_person) {
      countSql += ' AND p.contact_person LIKE ?'
      countParams.push(`%${contact_person}%`)
    }
    if (is_active !== undefined && is_active !== '') {
      countSql += ' AND p.is_active = ?'
      countParams.push(is_active === 'true' || is_active === '1' ? 1 : 0)
    }
    if (payment_cycle) {
      countSql += ' AND p.payment_cycle = ?'
      countParams.push(payment_cycle)
    }
    const [[{ total }]] = await pool.query(countSql, countParams)
    return { data: rows, total, page, limit }
  })

  fastify.get('/:id', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const [[row]] = await pool.query(
      `SELECT p.*, c.name_vi AS country_name
       FROM partner p
       LEFT JOIN country c ON c.id = p.country_id
       WHERE p.id = ? AND p.deleted_at IS NULL`,
      [parseInt(request.params.id)]
    )
    if (!row) return reply.code(404).send({ error: 'Không tìm thấy đối tác' })
    return row
  })

  fastify.post('/', adminAuth(fastify), async (request, reply) => {
    const {
      code,
      company_name,
      company_name_en,
      representative,
      country_id,
      address,
      phone,
      fax,
      email,
      website,
      contact_person,
      contact_phone,
      contact_email,
      tax_id,
      payment_cycle,
      payment_method,
      payment_terms,
      payment_account_name,
      payment_account_number,
      payment_bank_name,
      payment_bank_branch,
      commission_rate,
      is_active,
      notes,
    } = request.body

    if (!company_name) return reply.code(400).send({ error: 'Tên công ty là bắt buộc' })

    const partnerCode = code || (await generateUniquePartnerCode(company_name))

    const [result] = await pool.query(
      `INSERT INTO partner (code, company_name, company_name_en, representative, country_id,
        address, phone, fax, email, website,
        contact_person, contact_phone, contact_email,
        tax_id, payment_cycle, payment_method, payment_terms,
        payment_account_name, payment_account_number, payment_bank_name, payment_bank_branch,
        commission_rate, is_active, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        partnerCode,
        company_name,
        company_name_en || null,
        representative || null,
        country_id || null,
        address || null,
        phone || null,
        fax || null,
        email || null,
        website || null,
        contact_person || null,
        contact_phone || null,
        contact_email || null,
        tax_id || null,
        payment_cycle || null,
        payment_method || null,
        payment_terms || null,
        payment_account_name || null,
        payment_account_number || null,
        payment_bank_name || null,
        payment_bank_branch || null,
        commission_rate != null ? parseFloat(commission_rate) : null,
        is_active !== false ? 1 : 0,
        notes || null,
      ]
    )
    invalidateCache('partners')
    const [[created]] = await pool.query(
      `SELECT p.*, c.name_vi AS country_name
       FROM partner p LEFT JOIN country c ON c.id = p.country_id
       WHERE p.id = ?`,
      [result.insertId]
    )
    return reply.code(201).send(created)
  })

  fastify.put('/:id', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const id = parseInt(request.params.id)
    const userRole = request.user.role

    if (!ADMIN_ROLES.includes(userRole)) {
      return reply.code(403).send({ error: 'Không có quyền thực hiện' })
    }

    const body = request.body
    const sets = []
    const params = []

    const stringFields = [
      'company_name',
      'company_name_en',
      'representative',
      'address',
      'phone',
      'fax',
      'email',
      'website',
      'contact_person',
      'contact_phone',
      'contact_email',
      'tax_id',
      'payment_cycle',
      'payment_method',
      'payment_terms',
      'payment_account_name',
      'payment_account_number',
      'payment_bank_name',
      'payment_bank_branch',
      'notes',
    ]

    if ('code' in body) {
      const partnerCode =
        body.code || (await generateUniquePartnerCode(body.company_name || `partner-${id}`))
      sets.push('code = ?')
      params.push(partnerCode)
    } else if ('company_name' in body) {
      const partnerCode = await generateUniquePartnerCode(body.company_name)
      sets.push('code = ?')
      params.push(partnerCode)
    }

    for (const field of stringFields) {
      if (field in body) {
        sets.push(`${field} = ?`)
        params.push(body[field] || null)
      }
    }

    if ('country_id' in body) {
      sets.push('country_id = ?')
      params.push(body.country_id || null)
    }

    if ('commission_rate' in body) {
      sets.push('commission_rate = ?')
      params.push(body.commission_rate != null ? parseFloat(body.commission_rate) : null)
    }

    if ('is_active' in body) {
      sets.push('is_active = ?')
      params.push(body.is_active !== false && body.is_active !== 0 ? 1 : 0)
    }

    if (sets.length === 0) return reply.code(400).send({ error: 'Không có dữ liệu cập nhật' })

    sets.push('updated_at = NOW()')
    params.push(id)

    await pool.query(
      `UPDATE partner SET ${sets.join(', ')} WHERE id = ? AND deleted_at IS NULL`,
      params
    )
    invalidateCache('partners')
    const [[updated]] = await pool.query(
      `SELECT p.*, c.name_vi AS country_name
       FROM partner p LEFT JOIN country c ON c.id = p.country_id WHERE p.id = ?`,
      [id]
    )
    if (!updated) return reply.code(404).send({ error: 'Không tìm thấy đối tác' })
    return updated
  })

  fastify.delete('/:id', adminAuth(fastify), async (request, reply) => {
    // adminAuth đã check role; endpoint này chỉ là delete "hard" (soft-delete trong DB)
    await pool.query('UPDATE partner SET deleted_at = NOW() WHERE id = ?', [
      parseInt(request.params.id),
    ])
    invalidateCache('partners')
    return { success: true }
  })
}

module.exports = partnerRoutes
