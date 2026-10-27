// Danh mục loại tàu và quốc gia, dùng để đổi chữ của nguồn ngoài thành id của MCAH.
async function loadRefs(db) {
  const [types] = await db.query('SELECT id, code, name_en, name_vi FROM vessel_type')
  const [countries] = await db.query('SELECT id, code, name_en, name_vi FROM country')
  return { types, countries }
}

module.exports = { loadRefs }
