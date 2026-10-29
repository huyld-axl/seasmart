import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { App, Button, Input, Select, Tooltip } from 'antd'
import { CloseOutlined, DeleteOutlined, ExpandAltOutlined, MinusOutlined, PaperClipOutlined, ShrinkOutlined } from '@ant-design/icons'
import useToast from '../../../components/ds/useToast'
import { shipOwnerApi } from '../../../api/fleetApi'
import { useOpportunityMutations } from '../../../hooks/useOpportunities'
import useAuthStore from '../../../stores/authStore'
import apiErrorText from '../../../utils/apiError'
import { mailBody, mailSubject, pickContact } from './sendToOwner'

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
// Tệp đính kèm thêm: khớp giới hạn của máy chủ (loại tệp, 5 tệp, 10 MB mỗi tệp).
const EXTRA_EXT = ['pdf', 'jpg', 'jpeg', 'png', 'doc', 'docx', 'xls', 'xlsx', 'zip', 'txt']
const MAX_EXTRA = 5
const MAX_EXTRA_BYTES = 10 * 1024 * 1024
const fileSize = (bytes) => (bytes >= 1048576 ? `${(bytes / 1048576).toFixed(1)}M` : `${Math.max(1, Math.round(bytes / 1024))}K`)

// Ô nhập người nhận dùng chung cho Đến, Cc, Bcc: mỗi email một chip, gõ rồi Enter / dấu phẩy / dấu cách, gợi ý từ liên hệ của chủ tàu.
function RecipientSelect({ id, value, onChange, options, status, autoFocus }) {
  const [typed, setTyped] = useState('')
  // Gõ xong rời ô mà chưa Enter thì vẫn nhận email đó, như Gmail.
  const commitTyped = () => {
    const address = typed.trim()
    if (address && !value.includes(address)) onChange([...value, address])
    setTyped('')
  }
  return (
    <Select
      id={id}
      mode="tags"
      variant="borderless"
      tokenSeparators={[',', ';', ' ']}
      value={value}
      options={options}
      optionFilterProp="label"
      optionLabelProp="value"
      suffixIcon={null}
      autoFocus={autoFocus}
      status={status}
      onChange={onChange}
      onSearch={setTyped}
      onBlur={commitTyped}
    />
  )
}

// Cửa sổ soạn thư gửi chủ tàu, dáng như Gmail: nổi ở góc dưới phải, thu nhỏ / phóng to / đóng, ô nhập không viền.
// Nội dung điền sẵn, sửa tự do; thư đi bằng mail server công ty, đính kèm .zip hồ sơ từng người, Reply-To là người gửi.
// Gửi xong ghi nhận ngay, lỗi thì giữ cửa sổ để sửa và gửi lại. candidates: [{ id, seafarer_id, full_name }].
export default function ComposeMailModal({ opportunity, candidates, onClose }) {
  const toast = useToast()
  const navigate = useNavigate()
  const { modal } = App.useApp()
  const me = useAuthStore((state) => state.user)
  const { sendMail } = useOpportunityMutations()
  const owner = useQuery({ queryKey: ['ship-owner', opportunity.ship_owner_id], queryFn: () => shipOwnerApi.get(opportunity.ship_owner_id) })
  const contacts = (owner.data?.contacts || []).filter((c) => c.email)

  const [people, setPeople] = useState(candidates)
  const [toEdit, setToEdit] = useState(null)
  const [cc, setCc] = useState(me?.email ? [me.email] : [])
  const [bcc, setBcc] = useState([])
  const [showCc, setShowCc] = useState(Boolean(me?.email))
  const [showBcc, setShowBcc] = useState(false)
  const [subjectEdit, setSubjectEdit] = useState(null)
  const [bodyEdit, setBodyEdit] = useState(null)
  const [errors, setErrors] = useState({})
  const [size, setSize] = useState('normal')
  const [extras, setExtras] = useState([])
  const fileInput = useRef(null)

  // Chưa sửa tay thì theo liên hệ chính; chủ tàu chưa có email thì để trống.
  const toList = toEdit ?? [pickContact(contacts)?.email].filter(Boolean)
  const contact = contacts.find((c) => c.email === toList[0]) || null
  const contactOptions = contacts.map((c) => ({ value: c.email, label: `${c.name ? `${c.name} · ` : ''}${c.email}` }))
  const subject = subjectEdit ?? mailSubject(opportunity)
  const body = bodyEdit ?? mailBody(opportunity, contact, people, me?.full_name || me?.email)
  const edited = toEdit !== null || subjectEdit !== null || bodyEdit !== null || bcc.length > 0 || extras.length > 0 || people.length !== candidates.length

  // Đóng: có chỉnh sửa thì hỏi trước khi bỏ thư đang soạn.
  function close() {
    if (sendMail.isPending) return
    if (!edited) return onClose()
    return modal.confirm({ title: 'Bỏ thư đang soạn?', content: 'Nội dung bạn vừa sửa sẽ mất.', okText: 'Bỏ thư', okType: 'danger', cancelText: 'Tiếp tục soạn', onOk: onClose })
  }
  useEffect(() => {
    const onKey = (event) => { if (event.key === 'Escape' && !document.querySelector('.ant-modal-wrap, .ant-select-dropdown:not(.ant-select-dropdown-hidden)')) close() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  })

  function validate() {
    const next = {}
    if (!toList.length || toList.some((address) => !EMAIL.test(address))) next.to = 'Nhập email người nhận hợp lệ'
    if (cc.some((address) => !EMAIL.test(address))) next.cc = 'Có email Cc không hợp lệ'
    if (bcc.some((address) => !EMAIL.test(address))) next.bcc = 'Có email Bcc không hợp lệ'
    if (!subject.trim()) next.subject = 'Nhập tiêu đề'
    if (!body.trim()) next.body = 'Nhập nội dung thư'
    setErrors(next)
    return !Object.keys(next).length
  }

  // Thêm tệp từ máy: bỏ tệp sai loại / quá lớn / quá số lượng và báo lý do.
  function addFiles(event) {
    const picked = [...event.target.files]
    event.target.value = ''
    const next = [...extras]
    const skipped = []
    for (const file of picked) {
      const ext = file.name.split('.').pop().toLowerCase()
      if (!EXTRA_EXT.includes(ext)) skipped.push(`${file.name}: loại tệp không được nhận`)
      else if (file.size > MAX_EXTRA_BYTES) skipped.push(`${file.name}: quá 10 MB`)
      else if (next.length >= MAX_EXTRA) skipped.push(`${file.name}: tối đa ${MAX_EXTRA} tệp thêm`)
      else next.push(file)
    }
    setExtras(next)
    if (skipped.length) toast.warning('Chưa đính kèm được một số tệp', { description: skipped.join('\n') })
  }

  async function submit() {
    if (!validate()) return
    try {
      await sendMail.mutateAsync({
        id: opportunity.id,
        candidate_ids: people.map((c) => c.id),
        ship_owner_contact_id: contact?.id || null,
        to: toList,
        cc,
        bcc,
        files: extras,
        subject: subject.trim(),
        body,
      })
      toast.success(`Đã gửi thư cho ${opportunity.ship_owner_name}`, { description: `${people.length} hồ sơ gửi tới ${toList.join(', ')}.` })
      onClose()
    } catch (error) {
      toast.error('Chưa gửi được thư', { description: apiErrorText(error, 'Thử lại sau ít phút.') })
    }
  }

  const minimized = size === 'min'
  return createPortal(
    <section className={`op-mail op-mail--${size}`} role="dialog" aria-label={`Gửi cho ${opportunity.ship_owner_name}`}>
      <header className="op-mail__head">
        <h2 className="op-mail__title">Gửi cho {opportunity.ship_owner_name}</h2>
        <Tooltip title={minimized ? 'Mở lại' : 'Thu nhỏ'}><Button type="text" size="small" icon={<MinusOutlined />} aria-label="Thu nhỏ" onClick={() => setSize(minimized ? 'normal' : 'min')} /></Tooltip>
        <Tooltip title={size === 'max' ? 'Thu lại' : 'Phóng to'}><Button type="text" size="small" icon={size === 'max' ? <ShrinkOutlined /> : <ExpandAltOutlined />} aria-label="Phóng to" onClick={() => setSize(size === 'max' ? 'normal' : 'max')} /></Tooltip>
        <Tooltip title="Đóng"><Button type="text" size="small" icon={<CloseOutlined />} aria-label="Đóng" onClick={close} /></Tooltip>
      </header>
      {minimized ? null : (
        <>
          <div className="op-mail__fields">
            <div className="op-mail__row">
              <label className="op-mail__label" htmlFor="mail-to">Đến</label>
              <RecipientSelect id="mail-to" value={toList} onChange={setToEdit} options={contactOptions} autoFocus={!toList.length} status={errors.to ? 'error' : undefined} />
              <span className="op-mail__toggles">
                {showCc ? null : <button type="button" onClick={() => setShowCc(true)}>Cc</button>}
                {showBcc ? null : <button type="button" onClick={() => setShowBcc(true)}>Bcc</button>}
              </span>
            </div>
            {errors.to ? <p className="op-mail__err">{errors.to}</p> : null}
            {!owner.isLoading && !contacts.length ? (
              <p className="op-mail__hint">
                {opportunity.ship_owner_name} chưa có liên hệ nào có email.{' '}
                <button type="button" className="ds-link" onClick={() => navigate(`/partners/${opportunity.ship_owner_id}`)}>Mở trang đối tác</button>
              </p>
            ) : null}
            {showCc ? (
              <div className="op-mail__row">
                <label className="op-mail__label" htmlFor="mail-cc">Cc</label>
                <RecipientSelect id="mail-cc" value={cc} onChange={setCc} options={contactOptions} status={errors.cc ? 'error' : undefined} />
              </div>
            ) : null}
            {errors.cc ? <p className="op-mail__err">{errors.cc}</p> : null}
            {showBcc ? (
              <div className="op-mail__row">
                <label className="op-mail__label" htmlFor="mail-bcc">Bcc</label>
                <RecipientSelect id="mail-bcc" value={bcc} onChange={setBcc} options={contactOptions} autoFocus status={errors.bcc ? 'error' : undefined} />
              </div>
            ) : null}
            {errors.bcc ? <p className="op-mail__err">{errors.bcc}</p> : null}
            <div className="op-mail__row">
              <label className="op-mail__label" htmlFor="mail-subject">Tiêu đề</label>
              <Input id="mail-subject" variant="borderless" maxLength={300} value={subject} status={errors.subject ? 'error' : undefined} onChange={(e) => setSubjectEdit(e.target.value)} />
            </div>
            {errors.subject ? <p className="op-mail__err">{errors.subject}</p> : null}
          </div>
          <Input.TextArea className="op-mail__body" variant="borderless" aria-label="Nội dung thư" autoFocus={toList.length > 0} value={body} status={errors.body ? 'error' : undefined} onChange={(e) => setBodyEdit(e.target.value)} />
          {errors.body ? <p className="op-mail__err">{errors.body}</p> : null}
          <ul className="op-mail__atts" aria-label="Tệp đính kèm">
            {people.map((c) => (
              <li key={c.id}>
                <PaperClipOutlined aria-hidden />
                <b>{c.full_name}.zip</b>
                <Tooltip title={people.length > 1 ? 'Bỏ hồ sơ này khỏi thư (người này cũng không được ghi nhận là đã gửi)' : 'Cần gửi ít nhất một hồ sơ'}>
                  <button type="button" aria-label={`Bỏ tệp của ${c.full_name}`} disabled={people.length < 2} onClick={() => setPeople((prev) => prev.filter((p) => p.id !== c.id))}><CloseOutlined /></button>
                </Tooltip>
              </li>
            ))}
            {extras.map((file, index) => (
              <li key={`${file.name}-${index}`}>
                <PaperClipOutlined aria-hidden />
                <b>{file.name}</b>
                <span className="op-mail__size">({fileSize(file.size)})</span>
                <Tooltip title="Xoá tệp"><button type="button" aria-label={`Xoá tệp ${file.name}`} onClick={() => setExtras((prev) => prev.filter((_, i) => i !== index))}><CloseOutlined /></button></Tooltip>
              </li>
            ))}
          </ul>
          <footer className="op-mail__foot">
            <Button type="primary" shape="round" loading={sendMail.isPending} onClick={submit}>Gửi</Button>
            <input ref={fileInput} type="file" multiple hidden accept={EXTRA_EXT.map((ext) => `.${ext}`).join(',')} onChange={addFiles} />
            <Tooltip title="Đính kèm tệp"><Button type="text" icon={<PaperClipOutlined />} aria-label="Đính kèm tệp" disabled={sendMail.isPending} onClick={() => fileInput.current?.click()} /></Tooltip>
            <span className="op-mail__note">Gửi từ mail server công ty · bạn đứng tên Reply-To</span>
            <Tooltip title="Bỏ thư"><Button type="text" icon={<DeleteOutlined />} aria-label="Bỏ thư" disabled={sendMail.isPending} onClick={close} /></Tooltip>
          </footer>
        </>
      )}
    </section>,
    document.body,
  )
}
