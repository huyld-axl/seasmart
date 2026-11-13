import { useEffect, useState } from 'react'
import { Button, Modal, Progress } from 'antd'
import Banner from '../ds/Banner'
import ChoiceCardGroup from '../ds/ChoiceCardGroup'
import useToast from '../ds/useToast'
import { bridgeError, desktop } from '../../lib/desktop'

// Xuất hồ sơ ra thư mục (app máy tính, docs/design/wireframes/desktop-gd4.html màn 5). Cần quyền seafarer.export_bulk.
// pageIds: thuyền viên đang hiện trên trang danh sách.
export default function ExportFolderModal({ open, onClose, pageIds = [] }) {
  const toast = useToast()
  const [scope, setScope] = useState('page')
  const [progress, setProgress] = useState(null)
  const busy = progress !== null

  useEffect(() => (open ? desktop.onExportProgress(setProgress) : undefined), [open])

  async function run() {
    setProgress({ done: 0, total: 0 })
    try {
      const r = await desktop.exportFolder(scope === 'all' ? { all: true } : { seafarerIds: pageIds })
      if (!r.canceled) {
        toast.success(`Đã xuất ${r.people} hồ sơ (${r.files} tệp)`, { description: r.folder })
        onClose()
      }
    } catch (err) {
      toast.error('Không xuất được hồ sơ', { description: bridgeError(err) })
    } finally {
      setProgress(null)
    }
  }

  return (
    <Modal
      open={open}
      title="Xuất hồ sơ ra thư mục"
      onCancel={busy ? undefined : onClose}
      closable={!busy}
      footer={
        <div className="dsp-modal__footer">
          <Button color="default" variant="filled" disabled={busy} onClick={onClose}>Huỷ</Button>
          <Button type="primary" loading={busy} onClick={run}>Chọn thư mục và xuất</Button>
        </div>
      }
    >
      <div style={{ display: 'grid', gap: 12 }}>
        <Banner tone="warning">Bản xuất <b>không được mã hoá</b>. Ai mở được thư mục này là đọc được giấy tờ.</Banner>
        <ChoiceCardGroup
          name="export-scope"
          value={scope}
          onChange={setScope}
          options={[
            { value: 'page', title: `${pageIds.length} hồ sơ đang hiện trên trang`, disabled: !pageIds.length },
            { value: 'all', title: 'Toàn bộ hồ sơ thuyền viên' },
          ]}
        />
        <p className="muted" style={{ margin: 0 }}>Thư mục "MCAH - Hồ sơ xuất <ngày>" được tạo ở nơi bạn chọn: giấy tờ còn hiệu lực, bản cũ (trong "Bản cũ"), ảnh, hồ sơ đã gửi. Tệp đã xoá không xuất.</p>
        {busy && progress.total ? <Progress percent={Math.round((progress.done / progress.total) * 100)} format={() => `${progress.done}/${progress.total} tệp`} /> : null}
      </div>
    </Modal>
  )
}
