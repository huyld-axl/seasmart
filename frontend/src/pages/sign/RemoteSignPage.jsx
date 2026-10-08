import { useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Button, Skeleton } from 'antd'
import { CheckCircleFilled } from '@ant-design/icons'
import ProductBrand from '../../components/common/ProductBrand'
import { publicSignApi } from '../../api/exportApi'
import A4Preview from '../admin/exports/A4Preview'
import SignaturePad from './SignaturePad'
import '../admin/exports/exports.css'

const AGENCY_PHONE = import.meta.env.VITE_AGENCY_PHONE || ''

// C2 Ký online: thuyền viên mở link (SMS) trên điện thoại, đọc từng giấy, tick đồng ý, ký bằng ngón tay.
// Một chữ ký áp cho mọi giấy thuyền viên cần ký trong bộ; gửi lên khi xong giấy cuối.
export default function RemoteSignPage() {
  const { token } = useParams()
  const [step, setStep] = useState(0)
  const [agreed, setAgreed] = useState(false)
  const [inked, setInked] = useState(false)
  const canvasRef = useRef(null)

  const { data: pack, isLoading, isError, error, refetch } = useQuery({ queryKey: ['sign', token], queryFn: () => publicSignApi.get(token), retry: false })
  const send = useMutation({ mutationFn: (image) => publicSignApi.sign(token, { image, agreed: true }), onSuccess: () => refetch() })

  const head = (
    <header className="rs-head">
      <ProductBrand />
      {pack && <span className="rs-head__from">Gửi {pack.seafarer_name} · bộ #{pack.code}</span>}
    </header>
  )
  const shell = (body) => <div className="rs">{head}<main className="rs-main">{body}</main></div>

  if (isLoading) return shell(<Skeleton active paragraph={{ rows: 8 }} />)
  if (isError) {
    const gone = error?.response?.status === 404
    return shell(
      <div className="rs-done" role="alert">
        <h1>{gone ? 'Link ký không còn dùng được' : 'Không tải được giấy để ký'}</h1>
        <p>{gone ? 'Link có thể đã hết hạn hoặc bộ giấy đã thay đổi. Liên hệ agency để nhận link mới.' : 'Kiểm tra mạng rồi thử lại.'}</p>
        {gone && AGENCY_PHONE && <p><b className="ds-num" style={{ userSelect: 'all', color: 'var(--foreground)' }}>{AGENCY_PHONE}</b></p>}
        {!gone && <Button onClick={() => refetch()}>Thử lại</Button>}
      </div>
    )
  }
  if (pack.done) {
    return shell(
      <div className="rs-done" role="status">
        <CheckCircleFilled className="rs-done__icon" aria-hidden />
        <h1>Đã ký xong {pack.docs.length} giấy</h1>
        <p>Agency đã nhận chữ ký của bạn. Bạn có thể đóng trang này.</p>
      </div>
    )
  }

  const docs = pack.docs
  const doc = docs[Math.min(step, docs.length - 1)]
  const last = step >= docs.length - 1
  const others = Object.fromEntries(pack.other_signatures.filter((s) => s.template_key === doc.key).map((s) => [s.signer, 'done']))

  function next() {
    if (last) {
      send.mutate(canvasRef.current.toDataURL('image/png'))
      return
    }
    setStep(step + 1)
    setAgreed(false)
    window.scrollTo(0, 0)
  }

  return shell(
    <>
      <p className="rs-step">Giấy {step + 1} / {docs.length}</p>
      <h1 className="rs-title">{doc.name}</h1>
      <div className="rs-doc">
        <A4Preview docKey={doc.key} seafarer={pack.snapshot} inputs={pack.inputs} signs={others} />
      </div>
      <label className="rs-agree">
        <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
        <span>Tôi đã đọc và đồng ý nội dung giấy này</span>
      </label>
      {last ? (
        <>
          <p className="rs-step">Ký một lần, chữ ký dùng cho cả {docs.length} giấy.</p>
          <SignaturePad canvasRef={canvasRef} disabled={!agreed} onChange={setInked} />
        </>
      ) : null}
      {send.isError && <p role="alert" className="crew-docs--error" style={{ margin: 0 }}>{send.error?.response?.data?.error || 'Chưa gửi được chữ ký. Thử lại.'}</p>}
      <Button type="primary" size="large" block disabled={!agreed || (last && !inked)} loading={send.isPending} onClick={next}>
        {last ? 'Ký và gửi' : 'Đồng ý, sang giấy tiếp'}
      </Button>
    </>
  )
}
