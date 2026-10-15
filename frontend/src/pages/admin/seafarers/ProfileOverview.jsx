import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Button, Skeleton, Tag } from 'antd'
import { EditOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { seafarerApi } from '../../../api'
import ZaloButton from '../../../components/common/ZaloButton'
import StatusBadge from '../../../components/ds/StatusBadge'
import './SeafarerForm.css'

const date = (v) => (v ? dayjs(v).format('DD/MM/YYYY') : null)
const GENDER = { M: 'Nam', F: 'Nữ', O: 'Khác' }
const YES_NO = { 1: 'Có', 0: 'Không' }
const filled = (v) => v !== undefined && v !== null && v !== ''

// Cùng các khối, cùng thứ tự và tên với form thêm / sửa hồ sơ. Mỗi trường: [nhãn, giá trị, độ rộng].
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
        { sub: 'Hộ chiếu', fields: [['Số hộ chiếu', s.passport_number, 4], ['Ngày cấp', date(s.passport_issued_date), 4], ['Ngày hết hạn', date(s.passport_expiry), 4], ['Nơi sinh', s.place_of_birth, 6], ['Quốc tịch', s.nationality_name, 6]] },
        { sub: 'Căn cước công dân', fields: [['Số CCCD', s.national_id, 4], ['Ngày cấp', date(s.national_id_issued_date), 4], ['Nơi cấp', s.national_id_issued_place, 4]] },
        { sub: 'Sổ thuyền viên', fields: [['Số sổ thuyền viên', s.seaman_book_number, 4]] },
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
        ['Số điện thoại', s.phone_primary ? <span>{s.phone_primary}<ZaloButton phone={s.phone_primary} /></span> : null, 6],
        ['Email', s.email, 6],
      ],
    },
    {
      key: 'bank',
      title: 'Ngân hàng & BHXH',
      items: banks.map((b, i) => ({
        title: `Tài khoản ${i + 1}`,
        fields: [['Tên ngân hàng', b.bank_name, 4], ['Số tài khoản', b.account_number, 4], ['Tên chủ tài khoản', b.account_holder, 4]],
      })),
      itemsEmpty: 'Chưa có tài khoản ngân hàng.',
      groups: [{ sub: 'Bảo hiểm xã hội', fields: [['Tham gia BHXH', YES_NO[s.social_insurance_joined], 4], ['Số BHXH', s.social_insurance_number, 4]] }],
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
          ['Số điện thoại', c.phone_primary ? <span>{c.phone_primary}<ZaloButton phone={c.phone_primary} /></span> : null, 4],
          ['Số CCCD', c.guarantor_id_number, 4],
          ['Ngày cấp CCCD', date(c.guarantor_id_issued_date), 4],
          ['Nơi cấp CCCD', c.guarantor_id_issued_place, 4],
          ['Địa chỉ', c.address, 12],
        ],
      })),
      itemsEmpty: 'Chưa có người thân hay người bảo lãnh.',
    },
    {
      key: 'education',
      title: 'Học vấn',
      fields: [['Bằng cấp', s.education_level, 12], ['Trường', s.education_school, 5], ['Ngành', s.education_major, 4], ['Trình độ tiếng Anh', s.english_level, 3]],
    },
    { key: 'notes', title: 'Ghi chú', fields: [['Ghi chú', s.notes, 12]] },
  ]
}

function Info({ label, value, span }) {
  return (
    <div className={`sf-ro${span && span < 12 ? ` sf-c${span}` : ''}`}>
      <dt className="sf-ro__label">{label}</dt>
      <dd className="sf-ro__value">{filled(value) ? value : <span className="sf-ro__empty">Chưa có</span>}</dd>
    </div>
  )
}

const Grid = ({ fields }) => (
  <dl className="sf-grid">
    {fields.map(([label, value, span]) => <Info key={label} label={label} value={value} span={span} />)}
  </dl>
)

function countFilled(section) {
  const all = [...(section.fields || []), ...(section.groups || []).flatMap((g) => g.fields)]
  const done = all.filter(([, v]) => filled(v)).length
  if (section.items) return `${section.items.length} ${section.key === 'family' ? 'người' : 'tài khoản'}`
  return `${done}/${all.length}`
}

function Panel({ index, section }) {
  return (
    <section className="sf-panel" id={`sf-${section.key}`} aria-labelledby={`sf-${section.key}-title`}>
      <div className="sf-panel__head">
        <span className="sf-step">{index + 1}</span>
        <div><h3 className="sf-panel__title" id={`sf-${section.key}-title`}>{section.title}</h3></div>
        <span className="sf-panel__meta">{countFilled(section)}</span>
      </div>
      <div className="sf-panel__body">
        {section.fields ? <Grid fields={section.fields} /> : null}
        {section.items ? (
          section.items.length ? (
            <div className="sf-items">
              {section.items.map((item) => (
                <div className="sf-item" key={item.title}>
                  <div className="sf-item__head">
                    <h4 className="sf-item__title">{item.title}</h4>
                    {item.tags?.map((tag) => <Tag key={tag} color={tag === 'Bảo lãnh' ? 'orange' : 'blue'}>{tag}</Tag>)}
                  </div>
                  <div className="sf-item__body"><Grid fields={item.fields} /></div>
                </div>
              ))}
            </div>
          ) : (
            <p className="sf-ro__empty">{section.itemsEmpty}</p>
          )
        ) : null}
        {section.groups?.map((group) => (
          <div key={group.sub} className="sf-ro-group">
            <div className="sf-sub">{group.sub}</div>
            <Grid fields={group.fields} />
          </div>
        ))}
      </div>
    </section>
  )
}

// Màn xem hồ sơ: bố cục giống form sửa (ảnh + mục lục bên trái, các khối bên phải) nhưng chỉ đọc.
export default function ProfileOverview({ seafarer, seafarerId }) {
  const [active, setActive] = useState('general')
  const { data: contacts, isLoading } = useQuery({
    queryKey: ['seafarer-contacts', seafarerId],
    queryFn: () => seafarerApi.getContacts(seafarerId).then((r) => r.data),
  })
  const sections = buildSections(seafarer, contacts)

  useEffect(() => {
    const els = sections.map((s) => document.getElementById(`sf-${s.key}`)).filter(Boolean)
    const observer = new IntersectionObserver(
      (entries) => {
        const top = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0]
        if (top) setActive(top.target.id.slice(3))
      },
      { rootMargin: '-96px 0px -60% 0px' }
    )
    els.forEach((el) => observer.observe(el))
    return () => observer.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading])

  const goTo = (key) => (event) => {
    event.preventDefault()
    setActive(key)
    document.getElementById(`sf-${key}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div className="sf-layout">
      <aside className="sf-aside" aria-label="Tóm tắt hồ sơ">
        <nav className="sf-toc" aria-label="Các mục của hồ sơ">
          {sections.map((s, i) => (
            <a key={s.key} href={`#sf-${s.key}`} aria-current={active === s.key ? 'true' : undefined} onClick={goTo(s.key)}>
              <span className="sf-toc__n">{i + 1}</span>
              {s.title}
              <span className="sf-toc__cnt">{countFilled(s)}</span>
            </a>
          ))}
        </nav>
      </aside>
      <div className="sf-sections">
        {isLoading ? <Skeleton active paragraph={{ rows: 6 }} /> : sections.map((s, i) => <Panel key={s.key} index={i} section={s} />)}
        <div>
          <Link to={`/seafarers/${seafarerId}/edit`}><Button icon={<EditOutlined />}>Sửa hồ sơ</Button></Link>
        </div>
      </div>
    </div>
  )
}
