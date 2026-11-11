import { useMemo, useState } from 'react'
import { Button, Skeleton, Table, Tooltip } from 'antd'
import useLeaveGuard from '../../../hooks/useLeaveGuard'
import DateField from '../../../components/ds/DateField'
import { CopyOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import dayjs from 'dayjs'
import { kpiTargetApi } from '../../../api'
import MoneyInput from '../../../components/ds/MoneyInput'
import NumberInput from '../../../components/ds/NumberInput'
import { EmptyState } from '../../../components/ds/Controls'
import useToast from '../../../components/ds/useToast'
import useViewport from '../../../hooks/useViewport'
import apiErrorText from '../../../utils/apiError'
import { changedCells, changedRows, cellErrors, prevMonth, totals } from './kpiTargets'
import '../seafarers/SeafarerForm.css'
import './kpiTargets.css'

const usd = (n) => Number(n || 0).toLocaleString('vi-VN', { maximumFractionDigits: 0 })
const monthLabel = (m) => `${m.slice(5, 7)}/${m.slice(0, 4)}`

// Quản trị → Mục tiêu tháng: mỗi môi giới viên hai số (hợp đồng, doanh thu USD). Form sửa theo CLAUDE.md mục 3.3.
export default function KpiTargetPage() {
  const toast = useToast()
  const { isPhone } = useViewport()
  const queryClient = useQueryClient()
  const [month, setMonth] = useState(dayjs().format('YYYY-MM'))
  const query = useQuery({ queryKey: ['kpi-targets', month], queryFn: () => kpiTargetApi.list(month) })
  const original = useMemo(() => query.data?.rows || [], [query.data])
  // Bản nháp gắn với bản đã tải: tải lại (đổi tháng, lưu, chép) thì nháp tự về bản mới.
  const [edit, setEdit] = useState({ base: null, rows: [], tried: false })
  const fresh = edit.base === original
  const draft = fresh ? edit.rows : original
  const tried = fresh && edit.tried
  const setDraft = (fn) => setEdit((e) => ({ base: original, tried: e.base === original && e.tried, rows: fn(e.base === original ? e.rows : original) }))
  const setTried = (value) => setEdit((e) => ({ base: original, rows: e.base === original ? e.rows : original, tried: value }))

  const changed = new Set(changedCells(original, draft))
  const errors = cellErrors(draft)
  const after = (data) => {
    queryClient.setQueryData(['kpi-targets', month], data)
    queryClient.invalidateQueries({ queryKey: ['dashboard'] })
  }
  const save = useMutation({
    mutationFn: () => kpiTargetApi.save({ month, rows: changedRows(original, draft) }),
    onSuccess: (data) => { after(data); toast.success(`Đã lưu mục tiêu tháng ${monthLabel(month)}`) },
    onError: (err) => toast.error('Không lưu được mục tiêu', { description: apiErrorText(err, 'Thử lại sau ít phút.') }),
  })
  const copy = useMutation({
    mutationFn: () => kpiTargetApi.copy({ from: prevMonth(month), to: month }),
    onSuccess: (data) => { after(data); toast.success(`Đã chép mục tiêu tháng ${monthLabel(prevMonth(month))} vào các ô còn trống`) },
    onError: (err) => toast.error('Không chép được mục tiêu tháng trước', { description: apiErrorText(err, 'Thử lại sau ít phút.') }),
  })

  const setCell = (userId, field, value) => setDraft((rows) => rows.map((r) => (r.user_id === userId ? { ...r, [field]: value ?? null } : r)))
  const cell = (row, field, input) => {
    const key = `${row.user_id}:${field}`
    const error = tried && errors[key]
    return (
      <div className={changed.has(key) ? 'sf-changed kt-cell' : 'kt-cell'}>
        {input}
        {error ? <p className="kt-err" role="alert">{error}</p> : null}
      </div>
    )
  }
  const sum = totals(draft)
  const columns = [
    { title: 'Môi giới viên', dataIndex: 'name', render: (name) => <span className="kt-name">{name}</span> },
    {
      title: 'Hợp đồng', key: 'contracts', width: 150,
      render: (_, row) => cell(row, 'contracts', <NumberInput changeOnBlur={false} controls={false} inputMode="numeric" value={row.contracts} placeholder="Chưa đặt" onChange={(v) => setCell(row.user_id, 'contracts', v)} aria-label={`Mục tiêu hợp đồng của ${row.name}`} />),
    },
    {
      title: 'Doanh thu', key: 'revenue_usd', width: 200,
      render: (_, row) => cell(row, 'revenue_usd', <MoneyInput min={undefined} max={undefined} changeOnBlur={false} value={row.revenue_usd} placeholder="Chưa đặt" onChange={(v) => setCell(row.user_id, 'revenue_usd', v)} aria-label={`Mục tiêu doanh thu của ${row.name}`} />),
    },
    { title: 'Tháng này: đã ký / dự kiến', key: 'actual', align: 'right', render: (_, row) => <span className="kt-actual">{row.done} HĐ · {usd(row.revenue)} USD</span> },
  ]

  const submit = () => {
    setTried(true)
    if (Object.keys(errors).length) {
      document.querySelector('.kt-err')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      return
    }
    save.mutate()
  }

  let body
  if (query.isLoading) body = <div className="crew-loading"><Skeleton active title={false} paragraph={{ rows: 6 }} /></div>
  else if (query.isError) body = <EmptyState isError title="Không tải được mục tiêu" action={<Button onClick={() => query.refetch()}>Thử lại</Button>} />
  else if (!draft.length) body = <EmptyState title="Chưa có tài khoản nào đang hoạt động" />
  else if (isPhone) {
    // Điện thoại: "Cả công ty" lên đầu, mỗi môi giới viên một card hai ô (cùng ô nhập với bảng desktop).
    body = (
      <div className="kt-cards">
        <div className="kt-card kt-card--total">
          <b>Cả công ty</b>
          <span className="kt-actual">Mục tiêu: {sum.contracts ?? 'chưa đặt'}{sum.contracts != null ? ' HĐ' : ''} · {sum.revenue_usd != null ? `${usd(sum.revenue_usd)} USD` : 'chưa đặt'}</span>
          <span className="kt-actual">Tháng này: {sum.done} HĐ · {usd(sum.revenue)} USD</span>
        </div>
        {draft.map((row) => (
          <div key={row.user_id} className="kt-card">
            <span className="kt-name">{row.name}</span>
            <span className="kt-actual">Tháng này: {row.done} HĐ · {usd(row.revenue)} USD</span>
            <div className="kt-card__fields">
              <label className="kt-card__field"><span>Hợp đồng</span>{columns[1].render(null, row)}</label>
              <label className="kt-card__field"><span>Doanh thu (USD)</span>{columns[2].render(null, row)}</label>
            </div>
          </div>
        ))}
      </div>
    )
  } else {
    body = (
      <Table
        rowKey="user_id"
        className="kt-table"
        dataSource={draft}
        columns={columns}
        pagination={false}
        scroll={{ x: 640 }}
        summary={() => (
          <Table.Summary.Row className="kt-total">
            <Table.Summary.Cell index={0}>Cả công ty</Table.Summary.Cell>
            <Table.Summary.Cell index={1}>{sum.contracts ?? <span className="muted">Chưa đặt</span>}</Table.Summary.Cell>
            <Table.Summary.Cell index={2}>{sum.revenue_usd != null ? `${usd(sum.revenue_usd)} USD` : <span className="muted">Chưa đặt</span>}</Table.Summary.Cell>
            <Table.Summary.Cell index={3} align="right">{sum.done} HĐ · {usd(sum.revenue)} USD</Table.Summary.Cell>
          </Table.Summary.Row>
        )}
      />
    )
  }

  const dirty = changed.size > 0
  // Rời trang khi còn mục tiêu chưa lưu thì hỏi lại.
  useLeaveGuard(dirty)
  return (
    <div className="ds-page">
      <div className="ds-page__head">
        <div>
          <h1 className="ds-page__title">Mục tiêu tháng</h1>
          <p className="ds-page__desc">Mỗi môi giới viên một mục tiêu số hợp đồng ký mới và doanh thu. Mục tiêu công ty là tổng. Số hợp đồng từ 1; doanh thu từ 1 USD. Ô để trống là chưa đặt.</p>
        </div>
      </div>
      <div className="kt-toolbar">
        <DateField
          picker="month"
          format="MM/YYYY"
          allowClear={false}
          value={dayjs(`${month}-01`)}
          onChange={(d) => d && setMonth(d.format('YYYY-MM'))}
          disabled={dirty}
          aria-label="Tháng"
        />
        <Tooltip title={dirty ? 'Lưu hoặc huỷ thay đổi trước' : `Điền các ô trống bằng mục tiêu tháng ${monthLabel(prevMonth(month))}`}>
          <Button icon={<CopyOutlined />} onClick={() => copy.mutate()} loading={copy.isPending} disabled={dirty}>Chép từ tháng trước</Button>
        </Tooltip>
      </div>
      <section className="ds-card">{body}</section>
      <div className="sf-savebar">
        <div className="sf-savebar__count">
          <b>{dirty ? `${changed.size} thay đổi` : 'Chưa có thay đổi'}</b>
        </div>
        <div className="sf-savebar__actions">
          <Button onClick={() => setEdit({ base: null, rows: [], tried: false })} disabled={!dirty || save.isPending}>Huỷ</Button>
          <Button type="primary" onClick={submit} loading={save.isPending} disabled={!dirty}>Lưu thay đổi</Button>
        </div>
      </div>
    </div>
  )
}
