import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import Banner from '../../../components/ds/Banner'
import UploadPanel from '../../../components/ds/UploadPanel'
import { documentApi } from '../../../api/documentApi'
import useToast from '../../../components/ds/useToast'
import { displayDate, hasRunning, localFile, panelSummary, rejectReason, serverFile } from './uploadView'

// Màn "Tải giấy tờ lên" (T1): thả tệp, thấy đang xử lý hay xong. Tệp gửi lên /api/v1/documents; AI đọc ở máy chủ.
// Tải lại trang không mất: danh sách lấy từ máy chủ và hỏi lại mỗi 3 giây khi còn tệp đang chạy.
export default function CrewDropzone({ seafarerId, firstName, onReview }) {
  const [locals, setLocals] = useState([])
  const qc = useQueryClient()
  const toast = useToast()
  const queryKey = ['documents', String(seafarerId)]

  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: () => documentApi.list(seafarerId),
    refetchInterval: (query) => {
      const aiOn = query.state.data?.ai_configured !== false
      return hasRunning((query.state.data?.uploads || []).map((u) => serverFile(u, { aiConfigured: aiOn }))) ? 3000 : false
    },
  })
  const aiConfigured = data?.ai_configured !== false
  const setLocal = (key, patch) => setLocals((current) => current.map((item) => (item.key === key ? { ...item, ...patch } : item)))
  const dropLocal = (key) => setLocals((current) => current.filter((item) => item.key !== key))
  const fail = (e) => toast.error('Không cập nhật được tệp', { description: e.response?.data?.error || 'Thử lại sau ít phút.' })

  const removeUpload = useMutation({
    mutationFn: (uploadId) => documentApi.removeUpload(uploadId),
    onSuccess: () => qc.invalidateQueries({ queryKey }),
    onError: fail,
  })
  const retryUpload = useMutation({
    mutationFn: (uploadId) => documentApi.retryUpload(uploadId),
    onSuccess: () => qc.invalidateQueries({ queryKey }),
    onError: fail,
  })

  async function send(item) {
    setLocal(item.key, { state: 'running', error: null })
    try {
      const res = await documentApi.upload(seafarerId, item.file)
      if (res.duplicate) setLocal(item.key, { state: 'duplicate', duplicateOf: displayDate(res.created_at) })
      else dropLocal(item.key)
      qc.invalidateQueries({ queryKey })
    } catch (e) {
      setLocal(item.key, { state: 'unsent', error: e.response?.data?.error })
    }
  }

  function addFiles(list) {
    const picked = Array.from(list || []).map((file) => {
      const rejected = rejectReason(file)
      return {
        key: `${file.name}-${file.size}-${file.lastModified}`,
        name: file.name,
        mime: file.type,
        file,
        state: rejected ? rejected.state : 'running',
        size: rejected?.size,
      }
    })
    const fresh = picked.filter((item) => !locals.some((old) => old.key === item.key))
    if (!fresh.length) return
    setLocals((current) => [...current, ...fresh])
    fresh.filter((item) => item.state === 'running').forEach(send)
  }

  const serverFiles = (data?.uploads || []).map((upload) => serverFile(upload, { aiConfigured }))
  const files = [...locals.map(localFile), ...serverFiles]
  const summary = files.length ? panelSummary(files, { aiConfigured }) : undefined
  const localByKey = new Map(locals.map((item) => [item.key, item]))

  if (isLoading) return null
  return (
    <>
      {!aiConfigured && (
        <Banner title="AI đọc giấy tờ chưa được cấu hình" description="Tệp tải lên vẫn được lưu kèm hồ sơ nhưng chưa được đọc. Cấu hình xong thì bấm Đọc lại." />
      )}
      <UploadPanel
        files={files}
        summary={summary}
        seafarerName={firstName}
        onSelect={(event) => { addFiles(event.target.files); event.target.value = '' }}
        onReview={onReview}
        onRetry={(file) => (file.localKey ? send(localByKey.get(file.localKey)) : retryUpload.mutate(file.uploadId))}
        onRemove={(file) => (file.localKey ? dropLocal(file.localKey) : removeUpload.mutate(file.uploadId))}
        onOpenDuplicate={() => toast.info('Tệp này đã có trong hồ sơ', { description: 'Xem ở danh sách bên dưới.' })}
      />
    </>
  )
}
