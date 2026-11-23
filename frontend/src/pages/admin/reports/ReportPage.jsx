import { Fragment, useLayoutEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Button, Dropdown, Skeleton, Space, Table } from 'antd'
import Tooltip from '../../../components/ds/Tooltip'
import { DownOutlined, DownloadOutlined, LeftOutlined, RightOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import useListSessionState from '../../../hooks/useListSessionState'
import { EmptyState } from '../../../components/ds/Controls'
import DateField from '../../../components/ds/DateField'
import ToggleRow from '../../../components/ds/ToggleRow'
import ScrollRow from '../../../components/ds/ScrollRow'
import ListCard, { ListCardList } from '../../../components/ds/ListCard'
import useListSticky from '../../../components/ds/useListSticky'
import useToast from '../../../components/ds/useToast'
import useViewport from '../../../hooks/useViewport'
import { useCan } from '../../../hooks/usePermission'
import { useReport } from '../../../hooks/useReports'
import { reportApi } from '../../../api/reportApi'
import { SegmentedPick } from '../fleet/FleetParts'
import { downloadError, saveBlob } from '../exports/download'
import { isMonth, previousMonth, shiftMonth } from '../payouts/payoutView'
import {
  REPORT_OPTIONS, columnWidth, fileName, formatCell, groupColumns, isReportKey, linkOf, monthLabel, stickyWidth, visibleColumns,
} from './reportView'
import '../seafarers/SeafarerListPage.css'
import '../payouts/payouts.css'
import './reports.css'

// Báo cáo tháng (docs/mcah-ke-hoach-bao-cao.md): 4 bảng theo mẫu gốc, xem trên màn hình và xuất Excel. Cột lấy từ API.
export default function ReportPage() {
  const can = useCan()
  const canExport = can('report.export')
  const { isCompact: isMobile } = useViewport()
  const toast = useToast()
  const tableScroll = useListSticky()
  const [params, setParams] = useSearchParams()
  // Báo cáo và tháng: theo đường dẫn nếu có, không thì theo lần xem trước trong phiên (D8).
  const [savedKey, setSavedKey] = useListSessionState('reports', 'key', 'base')
  const [savedMonth, setSavedMonth] = useListSessionState('reports', 'month', '')
  const [showDetail, setShowDetail] = useListSessionState('reports', 'detail', false)
  const key = isReportKey(params.get('r')) ? params.get('r') : isReportKey(savedKey) ? savedKey : 'base'
  const month = isMonth(params.get('month')) ? params.get('month') : isMonth(savedMonth) ? savedMonth : null
  const [exporting, setExporting] = useState(null)
  const report = useReport(key, month)
  const data = report.data
  const rows = data?.rows || []

  const show = (nextKey, nextMonth) => {
    setSavedKey(nextKey)
    setSavedMonth(nextMonth || '')
    setParams(nextMonth ? { r: nextKey, month: nextMonth } : { r: nextKey }, { replace: true })
  }
  const changeMonth = (next) => show(key, next)

  async function exportFile(target) {
    if (!month) return
    setExporting(target)
    try {
      const res = await reportApi.export(target, month)
      saveBlob(res, fileName(target, month))
      toast.success(`Đã tải ${fileName(target, month)}`)
    } catch (error) {
      toast.error('Không tải được file', { description: await downloadError(error, 'Thử lại sau ít phút.') })
    } finally {
      setExporting(null)
    }
  }

  const columns = data ? visibleColumns(data.columns, key !== 'base' || showDetail) : []
  const fixedWidth = stickyWidth(columns)

  let body
  if (!month) {
    body = <EmptyState title="Chọn tháng để xem báo cáo." description="Báo cáo lấy các yêu cầu thanh toán có ngày kết thúc kỳ trong tháng đó." />
  } else if (report.isError) {
    body = <EmptyState isError title="Không tải được báo cáo" description="Mất kết nối tới máy chủ." action={<Button onClick={() => report.refetch()}>Thử lại</Button>} />
  } else if (report.isLoading || !data) {
    body = <div className="crew-loading"><Skeleton active title={false} paragraph={{ rows: 6 }} /></div>
  } else if (!rows.length) {
    body = <EmptyState title={`Tháng ${monthLabel(month)} không có yêu cầu thanh toán nào.`} description={canExport ? 'Vẫn xuất Excel được: file có tiêu đề và dòng tổng bằng 0.' : undefined} />
  } else if (isMobile) {
    body = <ReportCards report={data} canExport={canExport} exporting={exporting} onExport={() => exportFile(key)} />
  } else {
    body = <ReportTable columns={columns} rows={rows} totals={data.totals} fixedWidth={fixedWidth} scroll={tableScroll} />
  }

  const exportButton = canExport ? (
    <Space.Compact>
      <Button type="primary" icon={<DownloadOutlined />} disabled={!month} loading={exporting === key} onClick={() => exportFile(key)}>
        {isMobile ? 'Excel' : 'Xuất Excel'}
      </Button>
      <Dropdown
        disabled={!month}
        trigger={['click']}
        placement="bottomRight"
        menu={{
          items: [
            { key, label: 'Xuất báo cáo này' },
            { key: 'all', label: 'Xuất cả 4 báo cáo' },
          ],
          onClick: ({ key: target }) => exportFile(target),
        }}
      >
        <Button type="primary" icon={<DownOutlined />} loading={exporting === 'all'} aria-label="Cách xuất khác" />
      </Dropdown>
    </Space.Compact>
  ) : null

  return (
    <div className="ds-page">
      <div className="ds-card ds-card--fixed rp-list">
        <div className="ds-toolbar crew-toolbar rp-toolbar">
          {isMobile ? (
            <ScrollRow label="Chọn báo cáo" activeKey={key}>
              <SegmentedPick label="Báo cáo" value={key} options={REPORT_OPTIONS} onChange={(next) => show(next, month)} />
            </ScrollRow>
          ) : (
            <SegmentedPick label="Báo cáo" value={key} options={REPORT_OPTIONS} onChange={(next) => show(next, month)} />
          )}
          <span className="po-month">
            <Button icon={<LeftOutlined />} aria-label="Tháng trước" onClick={() => changeMonth(shiftMonth(month || previousMonth(), month ? -1 : 0))} />
            <DateField picker="month" format="MM/YYYY" allowClear={false} value={month ? dayjs(`${month}-01`) : null} placeholder="Chọn tháng" aria-label="Tháng" onChange={(value) => value && changeMonth(dayjs(value).format('YYYY-MM'))} />
            <Button icon={<RightOutlined />} aria-label="Tháng sau" onClick={() => changeMonth(shiftMonth(month || previousMonth(), month ? 1 : 0))} />
          </span>
          {key === 'base' && !isMobile ? (
            <span className="rp-detail-toggle"><ToggleRow compact label="Hiện 14 khoản" value={showDetail} onChange={setShowDetail} /></span>
          ) : null}
          {exportButton ? <span className="ds-toolbar__end">{exportButton}</span> : null}
        </div>
        {body}
      </div>
    </div>
  )
}

function Cell({ col, row }) {
  const text = formatCell(col, row[col.key])
  const to = linkOf(col, row)
  const content = to ? <Link to={to}>{text}</Link> : text
  // Chữ dài bị cắt "…": rê chuột xem đủ, cùng kiểu tooltip của cả app.
  if (col.type === 'text' && row[col.key]) return <Tooltip title={text} mouseEnterDelay={0.3}><span className="rp-clip">{content}</span></Tooltip>
  if (to) return content
  return col.type === 'money' && Number(row[col.key]) < 0 ? <span className="rp-neg">{text}</span> : text
}

// Ô gộp (Gộp thu, Thu theo đối tác): số ở đầu nhóm, dính trên cùng khi cuộn qua nhóm dài.
function MergedCell({ col, row }) {
  return <span className="rp-merge__value">{formatCell(col, row[col.key])}</span>
}

// Bảng máy tính: dựng từ danh sách cột của API. Cột dính cố định trái; tên nhóm dính ngay sau các cột đó khi cuộn ngang (Q7).
function ReportTable({ columns, rows, totals, fixedWidth, scroll }) {
  const numeric = (col) => ['money', 'int', 'percent'].includes(col.type)
  const leaf = (col, first) => ({
    key: col.key,
    dataIndex: col.key,
    title: col.hint ? <Tooltip title={col.hint}><span className="rp-hint">{col.label}</span></Tooltip> : col.label,
    width: columnWidth(col),
    fixed: col.sticky ? 'left' : undefined,
    align: numeric(col) ? 'right' : 'left',
    className: [first ? 'rp-group-start' : '', col.merge ? 'rp-merge' : '', col.strong ? 'rp-strong' : ''].filter(Boolean).join(' ') || undefined,
    onCell: col.merge ? (row) => {
      const span = row._span?.[col.merge] ?? 1
      return { rowSpan: span, className: span > 1 ? 'rp-merge--multi' : undefined }
    } : undefined,
    render: (_, row) => (col.merge ? <MergedCell col={col} row={row} /> : <Cell col={col} row={row} />),
  })
  const tableColumns = groupColumns(columns).flatMap(({ group, columns: list }) => (group
    ? [{ key: `g-${list[0].key}`, title: <span className="rp-group-label">{group}</span>, className: 'rp-group', children: list.map((col, i) => leaf(col, i === 0)) }]
    : list.map((col) => leaf(col, false))))
  const width = columns.reduce((total, col) => total + columnWidth(col), 0)
  // antd kéo ô cuối của dòng tổng sang cả chỗ thanh cuộn dọc: bù lề phải đúng bề rộng chỗ đó để số thẳng cột trên, không bị che.
  const wrap = useRef(null)
  useLayoutEffect(() => {
    // Đo ô giữ chỗ thanh cuộn ở tiêu đề (antd vẫn để chỗ này khi thân bảng không có thanh cuộn).
    const bar = wrap.current?.querySelector('.ant-table-thead th.ant-table-cell-scrollbar')
    wrap.current?.style.setProperty('--rp-sb', `${bar ? bar.offsetWidth : 0}px`)
  })
  return (
    <div ref={wrap} className="rp-table-wrap">
      <Table
        rowKey={(row) => `${row.no ?? ''}-${row._links?.contract_id ?? ''}-${row._links?.ship_owner_id ?? ''}-${row.period_end ?? ''}`}
        className="rp-table"
        style={{ '--rp-fixed-w': `${fixedWidth}px` }}
        dataSource={rows}
        columns={tableColumns}
        pagination={false}
        size="small"
        bordered
        tableLayout="fixed"
        scroll={{ ...scroll, x: width }}
        // Lịch thu chi: kẻ đậm đầu mỗi ngày (nhóm Gộp thu) để tách các nhóm gộp.
        rowClassName={(row, index) => (index > 0 && row._span?.day ? 'rp-row--group-start' : '')}
        summary={() => (
          <Table.Summary fixed="bottom">
            <Table.Summary.Row className="rp-total">
              {columns.map((col, i) => (
                <Table.Summary.Cell key={col.key} index={i} align={numeric(col) ? 'right' : 'left'} className={col.strong ? 'rp-strong' : undefined}>
                  {totals[col.key] == null || col.key === 'no' ? '' : col.type === 'text' || col.type === 'date' ? totals[col.key] : formatCell(col, totals[col.key])}
                </Table.Summary.Cell>
              ))}
            </Table.Summary.Row>
          </Table.Summary>
        )}
      />
    </div>
  )
}

const money = (value) => `${formatCell({ type: 'money' }, value)} USD`

// Điện thoại (D13): thẻ theo đối tác / theo bill, chỉ số có trong bảng máy tính. Dữ liệu tổng hợp chỉ thẻ tổng và nút xuất.
function ReportCards({ report, canExport, exporting, onExport }) {
  const { key, rows, totals } = report
  if (key === 'base') {
    return (
      <div className="rp-cards">
        <ListCardList label="Tổng tháng">
          <ListCard
            title={`Tháng ${monthLabel(report.month)}`}
            fields={[
              { label: 'Yêu cầu thanh toán', value: String(report.bill_count) },
              { label: 'Thu tổng', value: money(totals.thu_total) },
              { label: 'Trả tổng', value: money(totals.tra_total) },
              { label: 'Lãi thực tế', value: money(totals.margin) },
            ]}
          />
        </ListCardList>
        <div className="rp-wide-note">
          <b>Bảng này rộng</b>
          <span>Dữ liệu tổng hợp có nhiều cột. Xem trên máy tính hoặc xuất Excel để mở bằng ứng dụng bảng tính.</span>
          {canExport ? <Button type="primary" icon={<DownloadOutlined />} loading={exporting === key} onClick={onExport}>Xuất Excel</Button> : null}
        </div>
      </div>
    )
  }
  if (key === 'cashflow') {
    return (
      <div className="rp-cards">
        {rows.map((row) => (
          <Fragment key={`${row.no}`}>
            {row._span.day ? <div className="rp-card-group"><span>Hạn thu {formatCell({ type: 'date' }, row.due_date)}</span><span className="ds-num">{money(row.day_total)}</span></div> : null}
            <ListCardList label={`Hạn thu ${row.due_date}`}>
              <ListCard
                title={row.seafarer_name}
                sub={`${row.ship_owner_name} · kỳ ${dayjsShort(row.period_start)}–${dayjsShort(row.period_end)}`}
                fields={[
                  { label: 'Thu kỳ này', value: money(row.receivable) },
                  { label: 'Trả kỳ này', value: money(row.payable) },
                  { label: 'Hạn trả', value: formatCell({ type: 'date' }, row.payable_due_date) },
                  { label: 'Lãi gộp', value: money(row.margin), tone: row.margin < 0 ? 'err' : undefined },
                ]}
              />
            </ListCardList>
          </Fragment>
        ))}
        <p className="rp-cards-foot">Thu {money(totals.receivable)} · Trả {money(totals.payable)} · Lãi gộp {money(totals.margin)}</p>
      </div>
    )
  }
  return (
    <div className="rp-cards">
      <ListCardList label={report.title}>
        {rows.map((row) => (
          <ListCard
            key={row.no}
            title={row.ship_owner_name}
            fields={[
              { label: 'Khoản hằng tháng', value: money(row.monthly) },
              { label: 'Khoản một lần', value: money(row.one_time) },
              { label: 'Tổng', value: money(row.total) },
              { label: 'Thuyền viên · tỷ lệ', value: `${row.headcount} · ${formatCell({ type: 'percent' }, row.share)}` },
            ]}
          />
        ))}
      </ListCardList>
      <p className="rp-cards-foot">Tổng cộng {money(totals.total)} · {totals.headcount} thuyền viên</p>
    </div>
  )
}

const dayjsShort = (iso) => (iso ? dayjs(iso).format('DD/MM') : '—')
