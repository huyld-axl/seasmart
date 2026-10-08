// 12 mẫu giấy của bộ giấy tờ xuất (B3). Giữ khớp với frontend/src/pages/admin/exports/packModel.js.
// formKey: mẫu Excel trong form_export.service (null nếu chưa có file mẫu).

const SELF_SIGNER = 'Thuyền viên' // ký qua link SMS; các vai còn lại ký trong app

const t = (key, name, stage, signers, formKey, group = null) => ({ key, name, stage, signers, formKey, group })
const PACK_TEMPLATES = [
  t('kq', 'Kết quả thi tuyển', 'tuyen', ['Giám khảo 1', 'Giám khảo 2', 'Giám đốc'], 'kq_thi_tuyen'),
  t('tb', 'Thông báo trúng tuyển', 'tuyen', ['Giám đốc'], 'tb_trung_tuyen'),
  t('cv', 'CV chủ tàu Trung Quốc', 'tuyen', [], null),
  t('pt', 'Phiếu thu', 'tuyen', ['Người nộp tiền', 'Thủ quỹ', 'Kế toán trưởng'], 'phieu_thu'),
  t('qddd', 'Quyết định điều động', 'di-tau', ['Giám đốc'], 'qd_dieu_dong'),
  t('bhxh', 'Đơn tham gia BHXH', 'di-tau', [SELF_SIGNER], 'don_bh', 'bhxh'),
  t('kbhxh', 'Đơn không tham gia BHXH', 'di-tau', [SELF_SIGNER], 'bao_hiem', 'bhxh'),
  t('bl', 'Thư bảo lãnh', 'di-tau', ['Giám đốc'], 'thu_bao_lanh'),
  t('uqcn', 'Ủy quyền cá nhân', 'di-tau', [SELF_SIGNER], 'uy_quyen_cn'),
  t('uql', 'Ủy quyền nhận lương', 'di-tau', [SELF_SIGNER], 'uy_quyen'),
  t('qdrt', 'Quyết định rời tàu', 'roi-tau', ['Giám đốc'], 'qd_roi_tau'),
  t('tl', 'Thanh lý hợp đồng', 'roi-tau', [SELF_SIGNER, 'Giám đốc'], 'thanh_ly'),
]
const TEMPLATE_KEYS = PACK_TEMPLATES.map((x) => x.key)
const templateOf = (key) => PACK_TEMPLATES.find((x) => x.key === key)

const PACK_STATUS = ['PENDING_APPROVAL', 'SIGNING', 'DONE', 'REJECTED', 'STALE']
const STAGE_TITLE = { tuyen: 'Bộ giấy tuyển dụng', 'di-tau': 'Bộ giấy lên tàu', 'roi-tau': 'Bộ giấy rời tàu' }

module.exports = { PACK_TEMPLATES, TEMPLATE_KEYS, PACK_STATUS, STAGE_TITLE, SELF_SIGNER, templateOf }
