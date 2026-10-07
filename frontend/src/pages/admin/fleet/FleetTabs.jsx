import { Form, Input, InputNumber, Select } from 'antd'
import { useQuery } from '@tanstack/react-query'
import FleetList from './FleetList'
import { vesselApi, shipOwnerApi } from '../../../api/fleetApi'
import { lookupApi } from '../../../api'
import { isValidImo } from '../../../utils/imo'

const toOptions = (rows, label) => (rows || []).map((row) => ({ value: row.id, label: label(row) }))
const nullIfEmpty = (value) => (value === '' || value === undefined ? null : value)

function useLookups() {
  const vesselTypes = useQuery({ queryKey: ['lookup', 'vessel-types'], queryFn: () => lookupApi.vesselTypes().then((r) => r.data) })
  const countries = useQuery({ queryKey: ['lookup', 'countries'], queryFn: () => lookupApi.countries().then((r) => r.data) })
  const owners = useQuery({ queryKey: ['fleet', 'owner-options'], queryFn: () => shipOwnerApi.list({ limit: 100 }).then((r) => r.data) })
  return {
    vesselTypes: toOptions(vesselTypes.data, (row) => row.name_vi),
    countries: toOptions(countries.data, (row) => row.name_vi),
    owners: toOptions(owners.data, (row) => row.company_name),
  }
}

const cell2 = (main, sub) => (
  <span className="ds-cell2" style={{ maxWidth: 280 }}>
    <span className="ds-cell2__main">{main}</span>
    {sub ? <span className="ds-cell2__sub">{sub}</span> : null}
  </span>
)
const muted = (value) => (value == null || value === '' ? <span style={{ color: 'var(--muted)' }}>—</span> : value)
const imoRule = {
  validator: (_, value) => (!value || isValidImo(value) ? Promise.resolve() : Promise.reject(new Error('IMO có 7 chữ số và chữ số cuối phải đúng số kiểm tra'))),
}

export function VesselTab() {
  const options = useLookups()
  return (
    <FleetList
      queryKey="vessels"
      resourceApi={vesselApi}
      noun="tàu"
      searchPlaceholder="Tìm theo tên tàu hoặc IMO"
      describe={(row) => row.vessel_name}
      toFormValues={(row) => ({ ...row, gross_tonnage: row.gross_tonnage == null ? null : Number(row.gross_tonnage), deadweight: row.deadweight == null ? null : Number(row.deadweight) })}
      columns={[
        { title: 'Tàu', key: 'name', render: (_, row) => cell2(row.vessel_name, row.vessel_type_name) },
        { title: 'IMO', dataIndex: 'imo_number', render: (value) => <span className="ds-mono">{muted(value)}</span> },
        { title: 'Cờ', dataIndex: 'flag_name', render: muted, responsive: ['md'] },
        { title: 'Chủ tàu', dataIndex: 'ship_owner_name', render: muted, responsive: ['md'] },
        { title: 'GT', dataIndex: 'gross_tonnage', align: 'right', responsive: ['lg'], render: (value) => <span className="ds-num">{value == null ? muted(null) : Number(value).toLocaleString('vi-VN')}</span> },
      ]}
      renderForm={() => (
        <>
          <Form.Item name="vessel_name" label="Tên tàu" rules={[{ required: true, whitespace: true, message: 'Nhập tên tàu, ví dụ MV Lotus Pearl' }]}>
            <Input maxLength={150} autoFocus />
          </Form.Item>
          <Form.Item name="imo_number" label="IMO" rules={[imoRule]} normalize={(value) => value?.replace(/\D/g, '') || null} extra="Để trống nếu tàu không có IMO.">
            <Input inputMode="numeric" maxLength={7} placeholder="7 chữ số" />
          </Form.Item>
          <Form.Item name="vessel_type_id" label="Loại tàu" normalize={nullIfEmpty}>
            <Select allowClear showSearch optionFilterProp="label" options={options.vesselTypes} placeholder="Chọn loại tàu" />
          </Form.Item>
          <Form.Item name="flag_country_id" label="Cờ" normalize={nullIfEmpty}>
            <Select allowClear showSearch optionFilterProp="label" options={options.countries} placeholder="Chọn quốc gia" />
          </Form.Item>
          <Form.Item name="ship_owner_id" label="Chủ tàu" normalize={nullIfEmpty}>
            <Select allowClear showSearch optionFilterProp="label" options={options.owners} placeholder="Chọn chủ tàu" />
          </Form.Item>
          <div className="ds-form-row">
            <Form.Item name="gross_tonnage" label="Tổng dung tích (GT)">
              <InputNumber min={0} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="year_built" label="Năm đóng">
              <InputNumber min={1900} max={2100} style={{ width: '100%' }} />
            </Form.Item>
          </div>
          <Form.Item name="notes" label="Ghi chú" normalize={nullIfEmpty}>
            <Input.TextArea rows={3} maxLength={2000} />
          </Form.Item>
        </>
      )}
    />
  )
}

export function ShipOwnerTab() {
  const options = useLookups()
  return (
    <FleetList
      queryKey="ship-owners"
      resourceApi={shipOwnerApi}
      noun="chủ tàu"
      searchPlaceholder="Tìm theo tên hoặc mã chủ tàu"
      describe={(row) => row.company_name}
      toFormValues={(row) => row}
      columns={[
        { title: 'Chủ tàu', key: 'name', render: (_, row) => cell2(row.company_name, row.code) },
        { title: 'Quốc gia', dataIndex: 'country_name', render: muted, responsive: ['md'] },
        { title: 'Người liên hệ', key: 'contact', responsive: ['md'], render: (_, row) => (row.contact_person ? cell2(row.contact_person, row.contact_phone || row.contact_email) : muted(null)) },
        { title: 'Số tàu', dataIndex: 'vessel_count', align: 'right', render: (value) => <span className="ds-num">{value}</span> },
      ]}
      renderForm={() => (
        <>
          <Form.Item name="company_name" label="Tên chủ tàu" rules={[{ required: true, whitespace: true, message: 'Nhập tên công ty chủ tàu' }]}>
            <Input maxLength={200} autoFocus />
          </Form.Item>
          <Form.Item name="code" label="Mã" rules={[{ required: true, whitespace: true, message: 'Nhập mã ngắn, ví dụ DEMO-A' }]} normalize={(value) => value?.toUpperCase()}>
            <Input maxLength={30} />
          </Form.Item>
          <Form.Item name="company_name_en" label="Tên tiếng Anh" normalize={nullIfEmpty}>
            <Input maxLength={200} />
          </Form.Item>
          <Form.Item name="country_id" label="Quốc gia" normalize={nullIfEmpty}>
            <Select allowClear showSearch optionFilterProp="label" options={options.countries} placeholder="Chọn quốc gia" />
          </Form.Item>
          <Form.Item name="contact_person" label="Người liên hệ" normalize={nullIfEmpty}>
            <Input maxLength={150} />
          </Form.Item>
          <div className="ds-form-row">
            <Form.Item name="contact_phone" label="Điện thoại" normalize={nullIfEmpty}>
              <Input maxLength={30} inputMode="tel" />
            </Form.Item>
            <Form.Item name="contact_email" label="Email" normalize={nullIfEmpty} rules={[{ type: 'email', message: 'Email phải có dạng ten@congty.com' }]}>
              <Input maxLength={150} inputMode="email" />
            </Form.Item>
          </div>
          <Form.Item name="notes" label="Ghi chú" normalize={nullIfEmpty}>
            <Input.TextArea rows={3} maxLength={2000} />
          </Form.Item>
        </>
      )}
    />
  )
}
