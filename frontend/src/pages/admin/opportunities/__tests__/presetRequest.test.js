import { describe, expect, it, vi } from 'vitest'
import { createPresetRequest } from '../presetRequest'

describe('opportunity preset loading', () => {
  it('ignores an older response arriving after the latest selection', async () => {
    const pending = []
    const fetch = vi.fn(() => new Promise((resolve) => pending.push(resolve)))
    let selection = { rank_id: 1, vessel_id: 7 }
    const request = createPresetRequest(fetch, () => selection)
    const old = request(selection)
    selection = { rank_id: 2, vessel_id: 7 }
    const latest = request(selection)
    pending[1]({ source: 'RANK', requirements: ['new'] })
    expect((await latest).preset.requirements).toEqual(['new'])
    pending[0]({ source: 'RANK', requirements: ['old'] })
    expect(await old).toBeNull()
  })
  it('prevents a stale confirmation from applying after the vessel changes', async () => {
    let selection = { rank_id: 1, vessel_id: 7 }
    const request = createPresetRequest(async () => ({ requirements: [] }), () => selection)
    const result = await request(selection)
    expect(result.isCurrent()).toBe(true)
    selection = { rank_id: 1, vessel_id: 8 }
    expect(result.isCurrent()).toBe(false)
  })
  it('invalidates pending requests when the rank is cleared', async () => {
    let resolve
    let selection = { rank_id: 1 }
    const request = createPresetRequest(() => new Promise((done) => { resolve = done }), () => selection)
    const old = request(selection)
    selection = {}
    expect(await request(selection)).toBeNull()
    resolve({ requirements: [] })
    expect(await old).toBeNull()
  })
  it('handles a failed preset request without changing the form', async () => {
    const request = createPresetRequest(async () => { throw new Error('offline') }, () => ({ rank_id: 1 }))
    expect(await request({ rank_id: 1 })).toBeNull()
  })
})
