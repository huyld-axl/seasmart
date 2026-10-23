import { useState } from 'react'
import { useInfiniteQuery } from '@tanstack/react-query'
import { Button, Skeleton } from 'antd'
import { EditOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { DownloadIcon } from '../../../components/ds/TransferIcons'
import useToast from '../../../components/ds/useToast'
import api from '../../../api/client'
import { EmptyState } from '../../../components/ds/Controls'
import { FIELD_LABELS } from './fieldLabels'

const PARTNER_LABELS = { company_name: 'Tên công ty', company_name_en: 'Tên tiếng Anh', country_id: 'Quốc gia', tax_id: 'Mã số thuế', address: 'Địa chỉ', phone: 'Điện thoại', zalo: 'Zalo', fax: 'Fax', email: 'Email', website: 'Website', is_active: 'Trạng thái', notes: 'Ghi chú', contacts: 'Người liên hệ' }

const show = (value) => (value === null || value === undefined || value === '' ? 'trống' : (typeof value === 'object' ? JSON.stringify(value) : String(value)))

// Tab Lịch sử của hồ sơ: mỗi lần sửa có lý do, ai sửa, trường nào đổi từ gì sang gì.
export default function ProfileHistory({ seafarerId, partnerId }) {
  const [downloading, setDownloading] = useState(false)
  const toast = useToast()
  const endpoint = partnerId ? `/admin/master/ship-owners/${partnerId}/revisions` : `/seafarers/${seafarerId}/revisions`
  const history = useInfiniteQuery({
    queryKey: ['revisions', partnerId ? 'partner' : 'seafarer', partnerId || seafarerId],
    initialPageParam: 0,
    queryFn: ({ pageParam }) => api.get(endpoint, { params: { limit: 20, offset: pageParam } }).then((r) => r.data),
    getNextPageParam: (last) => last.nextOffset ?? undefined,
  })
  const { isLoading, isError, refetch } = history
  const data = history.data?.pages.flatMap((page) => page.data) || []
  async function downloadLog() {
    setDownloading(true)
    try {
      const lines = ['Lịch sử chỉnh sửa', '']
      let offset = 0
      do {
        const { data: page } = await api.get(endpoint, { params: { limit: 100, offset } })
        for (const rev of page.data) {
          lines.push(`${dayjs(rev.created_at).format('HH:mm DD/MM/YYYY')} · ${rev.changed_by_email || 'Không rõ người sửa'} · ${rev.reason}`)
          for (const [field, [from, to]] of Object.entries(rev.changes)) lines.push(`  ${(partnerId ? PARTNER_LABELS[field] : FIELD_LABELS[field]) || field}: ${show(from)} → ${show(to)}`)
          lines.push('')
        }
        offset = page.nextOffset
      } while (offset != null)
      const url = URL.createObjectURL(new Blob(['\uFEFF', lines.join('\n')], { type: 'text/plain;charset=utf-8' }))
      const link = document.createElement('a')
      link.href = url
      link.download = `lich-su-${partnerId ? 'doi-tac' : 'thuyen-vien'}-${partnerId || seafarerId}.txt`
      link.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch { toast.error('Không tải được log. Vui lòng thử lại.') }
    finally { setDownloading(false) }
  }
  if (isLoading) return <div className="crew-panel crew-panel__body"><Skeleton active /></div>
  if (isError && !history.data) return <EmptyState isError title="Không tải được lịch sử" action={<Button onClick={() => refetch()}>Thử lại</Button>} />
  return (
    <section className="crew-panel">
      <div className="crew-panel__head"><h2 className="crew-panel__title">Lịch sử chỉnh sửa</h2><Button icon={<DownloadIcon />} loading={downloading} onClick={downloadLog}>Tải log</Button></div>
      {!data.length && <EmptyState title="Chưa có lần sửa nào" description="Mỗi lần sửa hồ sơ sẽ ghi lại ở đây." />}
      <ol className="ds-timeline crew-panel__body">
        {data.map((rev) => (
          <li key={rev.id} className="ds-timeline__item">
            <span className="ds-timeline__line" aria-hidden />
            <span className="ds-timeline__icon ds-timeline__icon--neutral"><EditOutlined /></span>
            <div className="ds-timeline__body">
              <p className="ds-timeline__title">{rev.reason}</p>
              <p className="ds-timeline__meta">{rev.changed_by_email || 'Không rõ người sửa'} · {dayjs(rev.created_at).format('HH:mm DD/MM/YYYY')}</p>
              <ul className="rev-changes">
                {Object.entries(rev.changes).map(([field, [from, to]]) => (
                  <li key={field}><b>{(partnerId ? PARTNER_LABELS[field] : FIELD_LABELS[field]) || field}</b>: {show(from)} → {show(to)}</li>
                ))}
              </ul>
            </div>
          </li>
        ))}
      </ol>
      {history.hasNextPage && <div className="crew-panel__body"><Button loading={history.isFetchingNextPage} onClick={() => history.fetchNextPage()}>Tải thêm</Button>{history.isFetchNextPageError && <p>Không tải được lịch sử tiếp theo. Nhấn Tải thêm để thử lại.</p>}</div>}
    </section>
  )
}
