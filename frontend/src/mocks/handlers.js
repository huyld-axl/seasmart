import { http, HttpResponse } from 'msw'
import {
  mockUser,
  ranks,
  certificateTypes,
  countries,
  partners,
  vessels,
  seafarers,
  deployments,
  jobs,
  users,
} from './data'

const API = '/api/v1'

export const handlers = [
  // Auth
  http.post(`${API}/auth/login`, () =>
    HttpResponse.json({ token: 'mock-jwt-token', user: mockUser })
  ),
  http.get(`${API}/auth/me`, () => HttpResponse.json(mockUser)),

  // Lookup
  http.get(`${API}/lookup/ranks`, () => HttpResponse.json(ranks)),
  http.get(`${API}/lookup/certificate-types`, () => HttpResponse.json(certificateTypes)),
  http.get(`${API}/lookup/countries`, () => HttpResponse.json(countries)),
  http.get(`${API}/lookup/vessels`, () =>
    HttpResponse.json(vessels.map((v) => ({ id: v.id, vessel_name: v.vessel_name })))
  ),
  http.get(`${API}/lookup/partners`, () =>
    HttpResponse.json(partners.map((p) => ({ id: p.id, company_name: p.company_name })))
  ),

  // Seafarers
  http.get(`${API}/seafarers/stats`, () => {
    const stats = { ONBOARD: 0, STANDBY: 0, SIGNOFF: 0 }
    seafarers.forEach((s) => stats[s.status]++)
    return HttpResponse.json(stats)
  }),
  http.get(`${API}/seafarers/forms`, () => HttpResponse.json([])),
  http.get(`${API}/seafarers`, ({ request }) => {
    const url = new URL(request.url)
    const search = (url.searchParams.get('search') || '').toLowerCase()
    const status = url.searchParams.get('status') || ''
    const rankIds = url.searchParams.get('rank_ids') || ''
    const page = parseInt(url.searchParams.get('page')) || 1
    const limit = parseInt(url.searchParams.get('limit')) || 20

    let data = [...seafarers]
    if (search)
      data = data.filter(
        (s) =>
          s.full_name.toLowerCase().includes(search) ||
          s.seafarer_code.toLowerCase().includes(search) ||
          (s.phone_primary || '').includes(search)
      )
    if (status) data = data.filter((s) => s.status === status)
    if (rankIds) {
      const ids = rankIds.split(',').map(Number)
      data = data.filter((s) => ids.includes(s.rank_id))
    }

    const total = data.length
    const start = (page - 1) * limit
    data = data.slice(start, start + limit)

    return HttpResponse.json({ data, total, page, limit })
  }),
  http.get(`${API}/seafarers/:id`, ({ params }) => {
    const sf = seafarers.find((s) => s.id === Number(params.id))
    if (!sf) return HttpResponse.json({ error: 'Not found' }, { status: 404 })
    return HttpResponse.json({
      ...sf,
      nationality: 'Việt Nam',
      marital_status: 'Đã kết hôn',
      address: '123 Lê Lợi, Hải Phòng',
    })
  }),
  http.post(`${API}/seafarers`, async ({ request }) => {
    const body = await request.json()
    const newSf = {
      id: seafarers.length + 1,
      seafarer_code: `TV-${String(seafarers.length + 1).padStart(3, '0')}`,
      ...body,
      status: 'STANDBY',
      call_count: 0,
    }
    seafarers.push(newSf)
    return HttpResponse.json(newSf, { status: 201 })
  }),
  http.put(`${API}/seafarers/:id`, async ({ params, request }) => {
    const body = await request.json()
    const idx = seafarers.findIndex((s) => s.id === Number(params.id))
    if (idx === -1) return HttpResponse.json({ error: 'Not found' }, { status: 404 })
    seafarers[idx] = { ...seafarers[idx], ...body }
    return HttpResponse.json(seafarers[idx])
  }),
  http.delete(`${API}/seafarers/:id`, ({ params }) => {
    const idx = seafarers.findIndex((s) => s.id === Number(params.id))
    if (idx !== -1) seafarers.splice(idx, 1)
    return HttpResponse.json({ success: true })
  }),

  // Seafarer sub-resources
  http.get(`${API}/seafarers/:id/contacts`, () => HttpResponse.json([])),
  http.get(`${API}/seafarers/:id/educations`, () => HttpResponse.json([])),
  http.get(`${API}/seafarers/:id/certificates`, () => HttpResponse.json([])),
  http.get(`${API}/seafarers/:id/deployments`, ({ params }) => {
    const deps = deployments.filter((d) => d.seafarer_id === Number(params.id))
    return HttpResponse.json(deps)
  }),
  http.get(`${API}/seafarers/:id/calls`, () => HttpResponse.json({ data: [], total: 0 })),
  http.post(`${API}/seafarers/:id/calls`, () =>
    HttpResponse.json({ success: true }, { status: 201 })
  ),

  // Partners
  http.get(`${API}/partners`, ({ request }) => {
    const url = new URL(request.url)
    const search = (url.searchParams.get('search') || '').toLowerCase()
    const page = parseInt(url.searchParams.get('page')) || 1
    const limit = parseInt(url.searchParams.get('limit')) || 20
    let data = [...partners]
    if (search) data = data.filter((p) => p.company_name.toLowerCase().includes(search))
    return HttpResponse.json({ data, total: data.length, page, limit })
  }),
  http.get(`${API}/partners/:id`, ({ params }) => {
    const p = partners.find((x) => x.id === Number(params.id))
    if (!p) return HttpResponse.json({ error: 'Not found' }, { status: 404 })
    return HttpResponse.json(p)
  }),
  http.post(`${API}/partners`, async ({ request }) => {
    const body = await request.json()
    const np = {
      id: Math.max(...partners.map((p) => p.id)) + 1,
      ...body,
      is_active: true,
      created_at: new Date().toISOString().slice(0, 10),
    }
    partners.push(np)
    return HttpResponse.json(np, { status: 201 })
  }),
  http.put(`${API}/partners/:id`, async ({ params, request }) => {
    const body = await request.json()
    const idx = partners.findIndex((p) => p.id === Number(params.id))
    if (idx === -1) return HttpResponse.json({ error: 'Not found' }, { status: 404 })
    partners[idx] = { ...partners[idx], ...body }
    return HttpResponse.json(partners[idx])
  }),
  http.delete(`${API}/partners/:id`, ({ params }) => {
    const idx = partners.findIndex((p) => p.id === Number(params.id))
    if (idx !== -1) partners.splice(idx, 1)
    return HttpResponse.json({ success: true })
  }),

  // Vessels
  http.get(`${API}/vessels`, ({ request }) => {
    const url = new URL(request.url)
    const search = (url.searchParams.get('search') || '').toLowerCase()
    const partnerId = url.searchParams.get('partner_id')
    let data = [...vessels]
    if (search)
      data = data.filter(
        (v) => v.vessel_name.toLowerCase().includes(search) || v.imo_number.includes(search)
      )
    if (partnerId) data = data.filter((v) => v.partner_id === Number(partnerId))
    return HttpResponse.json({ data, total: data.length })
  }),
  http.get(`${API}/vessels/types`, () =>
    HttpResponse.json([
      'Bulk Carrier',
      'Container',
      'Tanker',
      'Car Carrier',
      'General Cargo',
      'LPG/LNG',
    ])
  ),
  http.get(`${API}/vessels/:id`, ({ params }) => {
    const v = vessels.find((x) => x.id === Number(params.id))
    if (!v) return HttpResponse.json({ error: 'Not found' }, { status: 404 })
    return HttpResponse.json(v)
  }),
  http.post(`${API}/vessels`, async ({ request }) => {
    const body = await request.json()
    const nv = { id: Math.max(...vessels.map((v) => v.id)) + 1, ...body, status: 'IN_SERVICE' }
    vessels.push(nv)
    return HttpResponse.json(nv, { status: 201 })
  }),
  http.put(`${API}/vessels/:id`, async ({ params, request }) => {
    const body = await request.json()
    const idx = vessels.findIndex((v) => v.id === Number(params.id))
    if (idx === -1) return HttpResponse.json({ error: 'Not found' }, { status: 404 })
    vessels[idx] = { ...vessels[idx], ...body }
    return HttpResponse.json(vessels[idx])
  }),
  http.delete(`${API}/vessels/:id`, ({ params }) => {
    const idx = vessels.findIndex((v) => v.id === Number(params.id))
    if (idx !== -1) vessels.splice(idx, 1)
    return HttpResponse.json({ success: true })
  }),

  // Jobs
  http.get(`${API}/jobs/stats`, () => {
    const stats = { OPEN: 0, FILLED: 0, CANCELLED: 0 }
    jobs.forEach((j) => stats[j.status]++)
    return HttpResponse.json(stats)
  }),
  http.get(`${API}/jobs`, ({ request }) => {
    const url = new URL(request.url)
    const status = url.searchParams.get('status') || ''
    const page = parseInt(url.searchParams.get('page')) || 1
    const limit = parseInt(url.searchParams.get('limit')) || 20
    let data = [...jobs]
    if (status) data = data.filter((j) => j.status === status)
    return HttpResponse.json({ data, total: data.length, page, limit })
  }),
  http.get(`${API}/jobs/:id`, ({ params }) => {
    const j = jobs.find((x) => x.id === Number(params.id))
    if (!j) return HttpResponse.json({ error: 'Not found' }, { status: 404 })
    return HttpResponse.json(j)
  }),
  http.post(`${API}/jobs`, async ({ request }) => {
    const body = await request.json()
    const nj = {
      id: Math.max(...jobs.map((j) => j.id)) + 1,
      ...body,
      status: 'OPEN',
      payment_status: 'UNPAID',
      created_at: new Date().toISOString().slice(0, 10),
    }
    jobs.push(nj)
    return HttpResponse.json(nj, { status: 201 })
  }),
  http.put(`${API}/jobs/:id`, async ({ params, request }) => {
    const body = await request.json()
    const idx = jobs.findIndex((j) => j.id === Number(params.id))
    if (idx === -1) return HttpResponse.json({ error: 'Not found' }, { status: 404 })
    jobs[idx] = { ...jobs[idx], ...body }
    return HttpResponse.json(jobs[idx])
  }),
  http.put(`${API}/jobs/:id/payment`, async ({ params, request }) => {
    const body = await request.json()
    const idx = jobs.findIndex((j) => j.id === Number(params.id))
    if (idx !== -1) jobs[idx] = { ...jobs[idx], ...body }
    return HttpResponse.json({ success: true })
  }),
  http.post(`${API}/jobs/:id/assign`, async ({ params, request }) => {
    const body = await request.json()
    const idx = jobs.findIndex((j) => j.id === Number(params.id))
    if (idx !== -1) {
      jobs[idx].status = 'FILLED'
      jobs[idx].seafarer_id = body.seafarer_id
      jobs[idx].seafarer_name = body.seafarer_name || 'Assigned'
    }
    return HttpResponse.json({ success: true })
  }),
  http.delete(`${API}/jobs/:id`, ({ params }) => {
    const idx = jobs.findIndex((j) => j.id === Number(params.id))
    if (idx !== -1) jobs.splice(idx, 1)
    return HttpResponse.json({ success: true })
  }),

  // Deployments
  http.get(`${API}/deployments`, ({ request }) => {
    const url = new URL(request.url)
    const status = url.searchParams.get('status') || ''
    let data = [...deployments]
    if (status) data = data.filter((d) => d.status === status)
    return HttpResponse.json({ data, total: data.length })
  }),
  http.get(`${API}/deployments/:id`, ({ params }) => {
    const d = deployments.find((x) => x.id === Number(params.id))
    if (!d) return HttpResponse.json({ error: 'Not found' }, { status: 404 })
    return HttpResponse.json(d)
  }),
  http.get(`${API}/deployments/:id/checklist`, () => HttpResponse.json([])),
  http.post(`${API}/seafarers/:sfId/deployments`, async ({ params, request }) => {
    const body = await request.json()
    const nd = {
      id: Math.max(...deployments.map((d) => d.id)) + 1,
      seafarer_id: Number(params.sfId),
      ...body,
      status: 'collecting_docs',
    }
    deployments.push(nd)
    return HttpResponse.json(nd, { status: 201 })
  }),
  http.put(`${API}/deployments/:id`, async ({ params, request }) => {
    const body = await request.json()
    const idx = deployments.findIndex((d) => d.id === Number(params.id))
    if (idx === -1) return HttpResponse.json({ error: 'Not found' }, { status: 404 })
    deployments[idx] = { ...deployments[idx], ...body }
    return HttpResponse.json(deployments[idx])
  }),
  http.put(`${API}/deployments/:id/status`, async ({ params, request }) => {
    const body = await request.json()
    const idx = deployments.findIndex((d) => d.id === Number(params.id))
    if (idx !== -1) deployments[idx].status = body.status
    return HttpResponse.json({ success: true })
  }),
  http.delete(`${API}/deployments/:id`, ({ params }) => {
    const idx = deployments.findIndex((d) => d.id === Number(params.id))
    if (idx !== -1) deployments.splice(idx, 1)
    return HttpResponse.json({ success: true })
  }),

  // Users
  http.get(`${API}/users`, () => HttpResponse.json({ data: users, total: users.length })),
  http.get(`${API}/users/:id`, ({ params }) => {
    const u = users.find((x) => x.id === Number(params.id))
    return u ? HttpResponse.json(u) : HttpResponse.json({ error: 'Not found' }, { status: 404 })
  }),
  http.post(`${API}/users`, async ({ request }) => {
    const body = await request.json()
    const nu = {
      id: Math.max(...users.map((u) => u.id)) + 1,
      ...body,
      is_active: true,
      last_login: null,
    }
    users.push(nu)
    return HttpResponse.json(nu, { status: 201 })
  }),
  http.put(`${API}/users/:id`, async ({ params, request }) => {
    const body = await request.json()
    const idx = users.findIndex((u) => u.id === Number(params.id))
    if (idx === -1) return HttpResponse.json({ error: 'Not found' }, { status: 404 })
    users[idx] = { ...users[idx], ...body }
    return HttpResponse.json(users[idx])
  }),
  http.delete(`${API}/users/:id`, ({ params }) => {
    const idx = users.findIndex((u) => u.id === Number(params.id))
    if (idx !== -1) users.splice(idx, 1)
    return HttpResponse.json({ success: true })
  }),

  // Forms
  http.get(`${API}/forms`, () => HttpResponse.json([])),

  // Notifications
  http.get(`${API}/notifications/unread-count`, () => HttpResponse.json({ count: 0 })),
  http.get(`${API}/notifications`, () => HttpResponse.json({ data: [], total: 0 })),

  // Catch-all for unhandled
  http.get(`${API}/*`, () => HttpResponse.json([])),
  http.post(`${API}/*`, () => HttpResponse.json({ success: true }, { status: 201 })),
  http.put(`${API}/*`, () => HttpResponse.json({ success: true })),
  http.delete(`${API}/*`, () => HttpResponse.json({ success: true })),
]
