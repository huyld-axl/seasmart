// Bỏ phản hồi về muộn khi người dùng đã đổi chức danh/tàu hoặc tải mẫu khác.
export function createPresetRequest(fetchPreset, getSelection) {
  let version = 0
  return async (selection) => {
    const requestVersion = ++version
    const rank = selection.rank_id
    const vessel = selection.vessel_id || null
    if (!rank) return null
    const isCurrent = () => {
      const current = getSelection()
      return version === requestVersion && current.rank_id === rank && (current.vessel_id || null) === vessel
    }
    const preset = await fetchPreset({ rank_id: rank, vessel_id: vessel || undefined }).catch(() => null)
    return preset && isCurrent() ? { preset, isCurrent } : null
  }
}
