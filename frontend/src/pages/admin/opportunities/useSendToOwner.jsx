import { useNavigate } from 'react-router-dom'
import { App } from 'antd'
import ConfirmGate from '../../../components/ds/ConfirmGate'
import useToast from '../../../components/ds/useToast'
import { shipOwnerApi } from '../../../api/fleetApi'
import { exportApi } from '../../../api/exportApi'
import { opportunityApi } from '../../../api/opportunityApi'
import { useOpportunityMutations } from '../../../hooks/useOpportunities'
import useAuthStore from '../../../stores/authStore'
import apiErrorText from '../../../utils/apiError'
import { saveBlob } from '../exports/download'
import { buildMailto, mailSubject, pickContact } from './sendToOwner'

// Hộp cảnh báo khi có người chưa tải được hồ sơ: trả true nếu người dùng vẫn muốn gửi.
function confirmWithoutFiles(modal, failed) {
  return new Promise((resolve) => {
    const dialog = modal.confirm({
      title: 'Chưa tải được hồ sơ, vẫn gửi chủ tàu?',
      width: 520,
      okText: 'Vẫn gửi',
      cancelText: 'Không gửi',
      okButtonProps: { disabled: true },
      content: (
        <>
          <p>Chưa tải được hồ sơ của: <b>{failed.map((f) => f.name).join(', ')}</b>.</p>
          <p className="vd-muted">{failed[0].reason}</p>
          <p>Nếu vẫn gửi, thư sẽ mở không có file của những người này. Chủ tàu có thể nhận thiếu hồ sơ nếu bạn quên đính kèm.</p>
          <ConfirmGate
            label="Tôi hiểu và sẽ tự đính kèm hồ sơ còn thiếu"
            onReadyChange={(ready) => dialog.update({ okButtonProps: { disabled: !ready } })}
          />
        </>
      ),
      onOk: () => resolve(true),
      onCancel: () => resolve(false),
    })
  })
}

// Gửi chủ tàu (Màn 6): tải bản xuất về máy, mở app mail mặc định đã điền sẵn, rồi hỏi "Đã gửi?" để ghi nhận.
// candidates: [{ id, seafarer_id, full_name, export_pack }]. Người chưa có hồ sơ nộp (bộ giấy) thì tạo trước khi tải.
export default function useSendToOwner() {
  const toast = useToast()
  const navigate = useNavigate()
  const { modal } = App.useApp()
  const me = useAuthStore((state) => state.user)
  const { recordSend } = useOpportunityMutations()

  return async function send(opportunity, candidates) {
    const owner = await shipOwnerApi.get(opportunity.ship_owner_id).catch(() => null)
    const contact = pickContact(owner?.contacts || [])
    if (!contact) {
      toast.warning(`Thêm email liên hệ cho ${opportunity.ship_owner_name}`, {
        description: 'Chủ tàu chưa có người liên hệ nào có email.',
        actionLabel: 'Mở trang đối tác',
        onAction: () => navigate(`/partners/${opportunity.ship_owner_id}`),
      })
      return
    }
    const files = []
    const failed = []
    for (const c of candidates) {
      try {
        const packId = c.export_pack?.id || (await opportunityApi.ensurePack(opportunity.id, c.seafarer_id)).pack.id
        const res = await exportApi.download(packId, 'pdf')
        saveBlob(res, `${c.full_name}.zip`)
        files.push(`${c.full_name}.zip`)
      } catch (error) {
        failed.push({ name: c.full_name, reason: apiErrorText(error, 'Thử lại sau ít phút.') })
      }
    }
    // Không tải được hồ sơ chỉ cảnh báo, không chặn gửi; cổng xác nhận bắt tích ô và chờ 5 giây.
    if (failed.length && !(await confirmWithoutFiles(modal, failed))) return
    const url = buildMailto({ opportunity, contact, people: candidates, cc: me?.email, sender: me?.email })
    const openMail = () => { window.location.href = url }
    openMail()
    modal.confirm({
      title: `Đã gửi email cho ${opportunity.ship_owner_name}?`,
      width: 480,
      content: (
        <>
          <p>{files.length ? `Đã tải ${files.length} file và mở app mail tới ${contact.email}. Đính kèm các file trong thư mục Tải về rồi gửi.` : `Đã mở app mail tới ${contact.email}.`}</p>
          <ul className="op-files">{files.map((f) => <li key={f}>{f}</li>)}</ul>
          {failed.length ? <p>Chưa có file của: {failed.map((f) => f.name).join(', ')}. Đính kèm tay trước khi gửi.</p> : null}
          <button type="button" className="ds-link" onClick={openMail}>Mở lại app mail</button>
        </>
      ),
      okText: 'Đã gửi',
      cancelText: 'Chưa gửi',
      onOk: async () => {
        try {
          await recordSend.mutateAsync({
            id: opportunity.id,
            candidate_ids: candidates.map((c) => c.id),
            ship_owner_contact_id: contact.id || null,
            to_email: contact.email,
            subject: mailSubject(opportunity),
          })
          toast.success(`Đã ghi nhận gửi ${candidates.length} người cho ${opportunity.ship_owner_name}`)
        } catch (error) {
          toast.error('Không ghi nhận được', { description: apiErrorText(error, 'Thử lại sau ít phút.') })
        }
      },
    })
  }
}
