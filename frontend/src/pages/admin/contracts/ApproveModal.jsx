import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Button, Modal, Skeleton } from 'antd'
import Banner from '../../../components/ds/Banner'
import CountdownCheck from '../../../components/ds/CountdownCheck'
import useToast from '../../../components/ds/useToast'
import { useBillPlan, useContractMutations } from '../../../hooks/useVoyages'
import apiErrorText from '../../../utils/apiError'
import { BILL_STATUS_TEXT, planChangesBills, planHeadline, planRows } from './contractView'
import './contracts.css'

// Duyệt hợp đồng chờ duyệt. Lần đầu và duyệt lại không đổi bill: hộp đơn giản. Duyệt lại làm bill đổi: hộp liệt kê thay đổi
// và buộc tích ô xác nhận sau 5 giây; có bill bị ảnh hưởng đã gửi / đã thu thì chặn. Server tính lại và đối chiếu `fingerprint`.
// Trạng thái thuyền viên (Đang trên tàu / Ở bờ) chỉ do chuyến đổi, nên không hỏi gì thêm.
export default function ApproveModal({ contract, open, onClose }) {
  const toast = useToast()
  const { approve } = useContractMutations()
  const [checked, setChecked] = useState(false)
  const [round, setRound] = useState(0)
  const id = contract.contract.id
  const number = contract.contract.contract_number
  const planQuery = useBillPlan(id, open)
  const plan = planQuery.data
  const blocked = plan?.blocked?.length > 0
  const changes = planChangesBills(plan)
  const ready = Boolean(plan) && !blocked && (!changes || checked)

  async function submit() {
    try {
      await approve.mutateAsync({ id, expected_fingerprint: plan.fingerprint })
      toast.success(`Đã duyệt hợp đồng ${number}`)
      onClose()
    } catch (error) {
      toast.error(`Không duyệt được hợp đồng ${number}`, { description: apiErrorText(error, 'Thử lại sau ít phút.') })
      // Bill vừa đổi hoặc bị chặn: tải lại bản xem trước, người dùng đọc lại và xác nhận lại.
      setChecked(false)
      setRound((value) => value + 1)
      planQuery.refetch()
    }
  }

  const rows = plan && changes ? planRows(plan) : []
  const edited = rows.filter((row) => row.edited)
  let body = null
  if (planQuery.isLoading) {
    body = <Skeleton active paragraph={{ rows: 3 }} />
  } else if (planQuery.isError) {
    body = <Banner tone="error" title="Không tính được thay đổi yêu cầu thanh toán" description="Thử lại sau ít phút." action={<Button onClick={() => planQuery.refetch()}>Thử lại</Button>} />
  } else if (blocked) {
    body = (
      <Banner tone="error" title="Không duyệt được: có yêu cầu thanh toán đã gửi hoặc đã thu bị ảnh hưởng" description="Huỷ ghi nhận thu, thu hồi các bill sau rồi duyệt lại.">
        <ul className="ct-blocked">
          {plan.blocked.map((b) => (
            <li key={b.bill_id}><Link to={`/bills/${b.bill_id}`}>{b.code}</Link> kỳ {b.seq} ({BILL_STATUS_TEXT[b.status]})</li>
          ))}
        </ul>
      </Banner>
    )
  } else if (changes) {
    body = (
      <>
        {planHeadline(plan) ? <p className="ct-plan__head">{planHeadline(plan)}</p> : null}
        <table className="ct-plan">
          <thead>
            <tr><th>Kỳ</th><th>Hiện tại</th><th>Sau khi duyệt</th><th>Trạng thái</th></tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key}>
                <td>{row.label}</td>
                <td>{row.current}</td>
                <td className={row.removed ? 'ct-plan__removed' : undefined}>{row.after}</td>
                <td>{row.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {plan.mode === 'EXTEND' ? <p className="vd-muted">Các kỳ đang có giữ nguyên. Bill mới không có khoản một lần.</p> : <p className="vd-muted">Kỳ không nêu ở bảng giữ nguyên.</p>}
        {edited.length ? (
          <Banner tone="warning" title="Bill đã sửa tay sẽ mất" description={`${edited.map((row) => `kỳ ${row.label}`).join(', ')} đã được sửa số tiền hoặc ghi chú; xoá mềm thì phần sửa mất theo.`} />
        ) : null}
        <CountdownCheck label="Tôi đã xem các thay đổi trên" checked={checked} onChange={setChecked} resetKey={round} />
      </>
    )
  }

  return (
    <Modal
      open={open}
      onCancel={onClose}
      width={changes || blocked ? 640 : 480}
      destroyOnHidden
      title={
        <div>
          <div>{changes || blocked ? `Duyệt ${number}: yêu cầu thanh toán sẽ thay đổi` : `Duyệt hợp đồng ${number}?`}</div>
          {!changes && !blocked ? <p className="vt-desc">Hợp đồng chuyển sang Hiệu lực và khoá nội dung.</p> : null}
        </div>
      }
      footer={[
        <Button key="cancel" onClick={onClose}>Huỷ</Button>,
        <Button key="ok" type="primary" loading={approve.isPending} disabled={!ready} onClick={submit}>
          {changes ? 'Xác nhận và duyệt' : 'Duyệt hợp đồng'}
        </Button>,
      ]}
    >
      {body}
    </Modal>
  )
}
