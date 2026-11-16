// Trạng thái và tham số của bộ lọc nâng cao (components: CrewFilters.jsx).
export const EMPTY_FILTERS = { ranks: [], vessels: [], certs: [], ageMin: null, ageMax: null }

// Số bộ lọc nâng cao đang bật (mỗi nhóm một).
export const filterCount = (f) => [f.ranks.length, f.vessels.length, f.certs.length, f.ageMin !== null || f.ageMax !== null].filter(Boolean).length

// Tham số gửi lên GET /seafarers.
export function filterParams(f) {
  const join = (items) => (items.length ? items.map((item) => item.value ?? item).join(',') : undefined)
  return {
    rank_ids: join(f.ranks),
    vessel_ids: join(f.vessels),
    certificate_type_ids: join(f.certs),
    age_min: f.ageMin ?? undefined,
    age_max: f.ageMax ?? undefined,
  }
}
