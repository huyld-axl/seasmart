import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { Button } from 'antd'
import { CheckCircleFilled } from '@ant-design/icons'
import ProductBrand from '../../components/common/ProductBrand'
import A4Preview from '../admin/exports/A4Preview'
import { template } from '../admin/exports/packModel'
import { SELF_SIGN, crewDocs, packStore, signState, usePack } from '../admin/exports/packStore'
import SignaturePad from './SignaturePad'
import '../admin/exports/exports.css'

const AGENCY = 'Agency Demo'
const AGENCY_PHONE = '0900 000 999'

// C2 Ký online: thuyền viên mở link SMS trên điện thoại, đọc từng giấy, tick đồng ý, ký bằng ngón tay.
// Chưa có backend: link chỉ chạy trong cùng tab với app (kho bộ giấy tạm), chưa có hạn 72 giờ thật.
export default function RemoteSignPage() {
  const { packId } = useParams()
  const pack = usePack(packId)
  const [step, setStep] = useState(0)
  const [agreed, setAgreed] = useState(false)
  const [inked, setInked] = useState(false)

  const head = (
    <header className="rs-head">
      <ProductBrand />
      {pack && <span className="rs-head__from">{AGENCY} gửi {pack.seafarerName}</span>}
    </header>
  )

  const docs = pack ? crewDocs(pack) : []
  const unusable = !pack || pack.status !== 'SIGNING' || !docs.length
  const done = pack && docs.length > 0 && docs.every((key) => signState(pack, key, SELF_SIGN) === 'done')

  if (done) {
    return (
      <div className="rs">
        {head}
        <main className="rs-main">
          <div className="rs-done" role="status">
            <CheckCircleFilled className="rs-done__icon" aria-hidden />
            <h1>Đã ký xong {docs.length} giấy</h1>
            <p>{AGENCY} đã nhận chữ ký của bạn. Bạn có thể đóng trang này.</p>
          </div>
        </main>
      </div>
    )
  }

  if (unusable) {
    return (
      <div className="rs">
        {head}
        <main className="rs-main">
          <div className="rs-done" role="alert">
            <h1>Link ký không còn dùng được</h1>
            <p>Link có thể đã hết hạn hoặc bộ giấy đã thay đổi. Gọi {AGENCY} để nhận link mới:</p>
            <p><b className="ds-num" style={{ userSelect: 'all', color: 'var(--foreground)' }}>{AGENCY_PHONE}</b></p>
          </div>
        </main>
      </div>
    )
  }

  const docKey = docs[step]
  const last = step === docs.length - 1

  function signAndNext() {
    if (last) {
      packStore.signAs(pack.id, SELF_SIGN)
      return
    }
    setStep(step + 1)
    setAgreed(false)
    setInked(false)
    window.scrollTo(0, 0)
  }

  return (
    <div className="rs">
      {head}
      <main className="rs-main">
        <p className="rs-step">Giấy {step + 1} / {docs.length}</p>
        <h1 className="rs-title">{template(docKey).name}</h1>
        <div className="rs-doc">
          <A4Preview docKey={docKey} seafarer={pack.snapshot} inputs={pack.inputs} signs={Object.fromEntries(template(docKey).signers.map((who) => [who, signState(pack, docKey, who)]))} />
        </div>
        <label className="rs-agree">
          <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
          <span>Tôi đã đọc và đồng ý nội dung giấy này</span>
        </label>
        <SignaturePad key={docKey} resetKey={docKey} disabled={!agreed} onChange={setInked} />
        <Button type="primary" size="large" block disabled={!agreed || !inked} onClick={signAndNext}>
          {last ? 'Ký và gửi' : 'Ký và sang giấy tiếp'}
        </Button>
      </main>
    </div>
  )
}
