import { withFlag } from '../../../utils/flag'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import dayjs from 'dayjs'
import { seafarerApi } from '../../../api'
import CopyButton from '../../../components/ds/CopyButton'
import { ZaloActions, EmailActions, PhoneActions } from '../../../components/ds/ContactActions'
import StatusBadge from '../../../components/ds/StatusBadge'
import useToast from '../../../components/ds/useToast'
import { useCan } from '../../../hooks/usePermission'
import { ReadLayout, NotePanel } from './ReadSections'
import { filled } from './readSectionUtils'
import './SeafarerForm.css'

const date = (v) => (v ? dayjs(v).format('DD/MM/YYYY') : null)
const GENDER = { M: 'Nam', F: 'Nữ', O: 'Khác' }
const YES_NO = { 1: 'Có', 0: 'Không' }

// Cùng các khối, cùng thứ tự và tên với form thêm / sửa hồ sơ. Mỗi trường: [nhãn, giá trị, độ rộng].
const copyable = (v) => (filled(v) ? <span className="ds-contact-value">{v}<CopyButton value={v} /></span> : null)
const phone = (v) => (v ? <span className="ds-contact-value">{v}<PhoneActions phone={v} /></span> : null)
const mail = (v) => (v ? <span className="ds-contact-value">{v}<EmailActions email={v} /></span> : null)

function buildSections(s, contacts) {
  const banks = s.bank_accounts?.length
    ? s.bank_accounts
    : [{ account_number: s.bank_account_number, bank_name: s.bank_name, account_holder: s.bank_account_holder }].filter((b) => filled(b.account_number) || filled(b.bank_name))
  return [
    {
      key: 'general',
      title: 'Thông tin chung',
      fields: [
        ['Mã thuyền viên', s.seafarer_code, 4],
        ['Họ và tên', s.full_name, 4],
        ['Tên tiếng Trung', s.full_name_zh, 4],
        ['Tên tiếng Anh', s.full_name_en, 4],
        ['Ngày sinh', date(s.date_of_birth), 4],
        ['Giới tính', GENDER[s.gender], 4],
        ['Tình trạng', <StatusBadge key="st" group="crew" value={s.status} />, 4],
        ['Chức danh', s.rank_name, 4],
        ['Nguyên quán', s.place_of_origin, 8],
        ['Địa chỉ thường trú', s.permanent_address, 12],
        ['Tình trạng hôn nhân', s.marital_status, 4],
        ['Số con', s.children_count, 4],
      ],
    },
    {
      key: 'identity',
      title: 'Giấy tờ tùy thân',
      groups: [
        { sub: 'Hộ chiếu', fields: [['Số hộ chiếu', copyable(s.passport_number), 4], ['Ngày cấp', date(s.passport_issued_date), 4], ['Ngày hết hạn', date(s.passport_expiry), 4], ['Nơi sinh', s.place_of_birth, 6], ['Quốc tịch', s.nationality_name ? withFlag(s.nationality_code, s.nationality_name, s.nationality_flag_emoji) : null, 6]] },
        { sub: 'Căn cước công dân', fields: [['Số CCCD', copyable(s.national_id), 4], ['Ngày cấp', date(s.national_id_issued_date), 4], ['Nơi cấp', s.national_id_issued_place, 4]] },
        { sub: 'Sổ thuyền viên', fields: [['Số sổ thuyền viên', copyable(s.seaman_book_number), 4]] },
      ],
    },
    {
      key: 'physical',
      title: 'Thể chất',
      fields: [
        ['Chiều cao', filled(s.height_cm) ? `${s.height_cm} cm` : null, 3],
        ['Cân nặng', filled(s.weight_kg) ? `${s.weight_kg} kg` : null, 3],
        ['Nhóm máu', s.blood_type, 6],
        ['Size giày', s.shoe_size, 3],
        ['Size bảo hộ', s.ppe_size, 3],
        ['Size áo', s.shirt_size, 3],
        ['Size quần', s.pants_size, 3],
      ],
    },
    {
      key: 'contact',
      title: 'Liên hệ',
      fields: [
        ['Số điện thoại', phone(s.phone_primary), 6],
        ['Zalo', s.zalo ? <span className="ds-contact-value">{s.zalo}<ZaloActions value={s.zalo} /></span> : null, 6],
        ['Email', mail(s.email), 6],
      ],
    },
    {
      key: 'bank',
      title: 'Ngân hàng & BHXH',
      items: banks.map((b, i) => ({
        title: `Tài khoản ${i + 1}`,
        fields: [['Tên ngân hàng', b.bank_name, 4], ['Số tài khoản', copyable(b.account_number), 4], ['Tên chủ tài khoản', b.account_holder, 4]],
      })),
      unit: 'tài khoản',
      itemsEmpty: 'Chưa có tài khoản ngân hàng.',
      groups: [{ sub: 'Bảo hiểm xã hội', fields: [['Tham gia BHXH', YES_NO[s.social_insurance_joined], 4], ['Số BHXH', copyable(s.social_insurance_number), 4]] }],
    },
    {
      key: 'family',
      title: 'Gia quyến',
      items: (contacts || []).map((c, i) => ({
        title: `Người thân ${i + 1}`,
        tags: [c.is_emergency_contact ? 'Liên lạc' : null, c.is_guarantor ? 'Bảo lãnh' : null].filter(Boolean),
        fields: [
          ['Họ tên', c.full_name, 4],
          ['Quan hệ', c.relationship, 4],
          ['Số điện thoại', phone(c.phone_primary), 4],
          ['Zalo', c.zalo ? <span className="ds-contact-value">{c.zalo}<ZaloActions value={c.zalo} /></span> : null, 4],
          ['Số CCCD', copyable(c.guarantor_id_number), 4],
          ['Ngày cấp CCCD', date(c.guarantor_id_issued_date), 4],
          ['Nơi cấp CCCD', c.guarantor_id_issued_place, 4],
          ['Địa chỉ', c.address, 12],
        ],
      })),
      unit: 'người',
      itemsEmpty: 'Chưa có người thân hay người bảo lãnh.',
    },
    {
      key: 'education',
      title: 'Học vấn',
      fields: [['Bằng cấp', s.education_level, 12], ['Trường', s.education_school, 5], ['Ngành', s.education_major, 4], ['Trình độ tiếng Anh', s.english_level, 3]],
    },
  ]
}

// Ghi chú sửa ngay tại màn xem; lưu qua PUT hồ sơ với lý do cố định.
export function NoteBox({ seafarer, seafarerId, className = '' }) {
  const can = useCan()
  const toast = useToast()
  const queryClient = useQueryClient()
  const save = useMutation({
    mutationFn: (notes) => seafarerApi.update(seafarerId, { notes, reason: 'Cập nhật ghi chú' }),
    onSuccess: () => {
      toast.success('Đã lưu ghi chú')
      queryClient.invalidateQueries({ queryKey: ['seafarer', seafarerId] })
      queryClient.invalidateQueries({ queryKey: ['seafarer', Number(seafarerId)] })
    },
    onError: (e) => toast.error('Không lưu được ghi chú', { description: e.response?.data?.error || e.response?.data?.message }),
  })
  return <NotePanel notes={seafarer.notes} canEdit={can('seafarer.update')} saving={save.isPending} onSave={(notes) => save.mutateAsync(notes)} className={className} />
}

// Màn xem hồ sơ: bố cục giống form sửa (mục lục bên trái, các khối bên phải) nhưng chỉ đọc.
export default function ProfileOverview({ seafarer, seafarerId }) {
  const { data: contacts, isLoading } = useQuery({
    queryKey: ['seafarer-contacts', seafarerId],
    queryFn: () => seafarerApi.getContacts(seafarerId).then((r) => r.data),
  })
  return <ReadLayout sections={buildSections(seafarer, contacts)} loading={isLoading} />
}
