import { useRef, useState, useEffect, useCallback } from 'react'
import { Modal, Button, Alert, Typography, Tabs, Input, Space } from 'antd'
import { CameraOutlined, UploadOutlined, EditOutlined } from '@ant-design/icons'
import jsQR from 'jsqr'
import QrScanner from 'qr-scanner'

const THRESHOLDS = [90, 110, 130]
const GRAY_FORMULAS = [
  (r, g) => r * 0.7 + g * 0.3,
  (r, g) => r * 0.55 + g * 0.45,
  (r, g, b) => r * 0.299 + g * 0.587 + b * 0.114,
]

let _grayBuf = null
let _procBuf = null
function getBuffers(n) {
  if (!_grayBuf || _grayBuf.length < n) _grayBuf = new Float32Array(n)
  if (!_procBuf || _procBuf.length < n * 4) _procBuf = new Uint8ClampedArray(n * 4)
  return { grayBuf: _grayBuf, procBuf: _procBuf }
}

// Hàm decode core — dùng chung cho live scan và ảnh tĩnh
function tryDecodePixels(data, width, height) {
  const n = width * height
  const { grayBuf, procBuf } = getBuffers(n)

  // Strategy 1: max(R,G,B) — phát hiện mực đen bất kể màu nền xanh bảo mật
  for (const t of [75, 90, 105, 120, 140]) {
    for (let j = 0; j < n; j++) {
      const i = j * 4
      const maxCh =
        data[i] > data[i + 1]
          ? data[i] > data[i + 2]
            ? data[i]
            : data[i + 2]
          : data[i + 1] > data[i + 2]
            ? data[i + 1]
            : data[i + 2]
      const v = maxCh < t ? 0 : 255
      procBuf[i] = procBuf[i + 1] = procBuf[i + 2] = v
      procBuf[i + 3] = 255
    }
    const code = jsQR(procBuf, width, height, { inversionAttempts: 'dontInvert' })
    if (code) return code.data
  }

  // Strategy 2: grayscale bỏ blue + jsQR adaptive binarize
  for (const formula of GRAY_FORMULAS) {
    for (let i = 0, j = 0; i < data.length; i += 4, j++) {
      grayBuf[j] = formula(data[i], data[i + 1], data[i + 2])
    }
    for (let j = 0; j < n; j++) {
      const v = Math.min(255, Math.max(0, grayBuf[j]))
      const i4 = j * 4
      procBuf[i4] = procBuf[i4 + 1] = procBuf[i4 + 2] = v
      procBuf[i4 + 3] = 255
    }
    let code = jsQR(procBuf, width, height, { inversionAttempts: 'attemptBoth' })
    if (code) return code.data

    for (const t of THRESHOLDS) {
      for (let j = 0; j < n; j++) {
        const v = grayBuf[j] < t ? 0 : 255
        const i4 = j * 4
        procBuf[i4] = procBuf[i4 + 1] = procBuf[i4 + 2] = v
        procBuf[i4 + 3] = 255
      }
      code = jsQR(procBuf, width, height, { inversionAttempts: 'dontInvert' })
      if (code) return code.data
    }
  }

  return null
}

function drawAndDecode(ctx, canvas, source, srcX, srcY, srcW, srcH, maxPx) {
  const scale = Math.min(1, maxPx / Math.max(srcW, srcH))
  canvas.width = Math.round(srcW * scale)
  canvas.height = Math.round(srcH * scale)
  ctx.drawImage(source, srcX, srcY, srcW, srcH, 0, 0, canvas.width, canvas.height)
  const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height)
  return tryDecodePixels(data, width, height)
}

function tryDecodeFrame(video, canvas) {
  if (video.readyState < video.HAVE_ENOUGH_DATA) return null
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  return drawAndDecode(ctx, canvas, video, 0, 0, video.videoWidth, video.videoHeight, 960)
}

async function scanPhotoWithPreprocessing(file) {
  const img = await new Promise((resolve, reject) => {
    const el = new Image()
    const url = URL.createObjectURL(file)
    el.onload = () => {
      URL.revokeObjectURL(url)
      resolve(el)
    }
    el.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('load failed'))
    }
    el.src = url
  })

  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  const w = img.naturalWidth
  const h = img.naturalHeight

  // Thử toàn ảnh ở 3 mức resolution
  for (const maxPx of [1600, 960, 480]) {
    const r = drawAndDecode(ctx, canvas, img, 0, 0, w, h, maxPx)
    if (r) return r
  }

  // Thử crop 4 góc (60% ảnh mỗi góc) — QR CCCD thường ở góc dưới trái
  const cw = Math.round(w * 0.6)
  const ch = Math.round(h * 0.6)
  const crops = [
    [0, h - ch], // dưới trái ← ưu tiên vì QR CCCD ở đây
    [w - cw, h - ch], // dưới phải
    [0, 0], // trên trái
    [w - cw, 0], // trên phải
  ]
  for (const [sx, sy] of crops) {
    for (const maxPx of [960, 480]) {
      const r = drawAndDecode(ctx, canvas, img, sx, sy, cw, ch, maxPx)
      if (r) return r
    }
  }

  // Fallback: dùng QrScanner gốc
  try {
    const r = await QrScanner.scanImage(file, { returnDetailedScanResult: true })
    return r.data
  } catch {
    return null
  }
}

function LiveScanTab({ active, onScanned, onError }) {
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const streamRef = useRef(null)
  const rafRef = useRef(null)
  const refocusTimerRef = useRef(null)
  const busyRef = useRef(false)
  const lastScanRef = useRef(0)
  const [focusing, setFocusing] = useState(false)

  const triggerFocus = useCallback(async () => {
    const track = streamRef.current?.getVideoTracks()[0]
    if (!track) return
    const capabilities = track.getCapabilities?.() || {}
    if (!capabilities.focusMode) return
    setFocusing(true)
    try {
      if (capabilities.focusMode.includes('single-shot')) {
        await track.applyConstraints({ advanced: [{ focusMode: 'single-shot' }] })
        await new Promise((r) => setTimeout(r, 400))
      }
      if (capabilities.focusMode.includes('continuous')) {
        await track.applyConstraints({ advanced: [{ focusMode: 'continuous' }] })
      }
    } catch {
      /* ignore focus errors */
    }
    setFocusing(false)
  }, [])

  useEffect(() => {
    if (!active) return
    let cancelled = false

    const stopCamera = () => {
      cancelAnimationFrame(rafRef.current)
      clearInterval(refocusTimerRef.current)
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop())
        streamRef.current = null
      }
    }

    const loop = (ts) => {
      if (cancelled) return
      rafRef.current = requestAnimationFrame(loop)
      if (busyRef.current || ts - lastScanRef.current < 100) return
      lastScanRef.current = ts
      busyRef.current = true
      try {
        const result = tryDecodeFrame(videoRef.current, canvasRef.current)
        if (result && !cancelled) {
          stopCamera()
          onScanned(result)
        }
      } finally {
        busyRef.current = false
      }
    }

    const start = async () => {
      await new Promise((r) => setTimeout(r, 150))
      if (cancelled || !videoRef.current || !canvasRef.current) return
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
        })
        streamRef.current = stream
        videoRef.current.srcObject = stream
        videoRef.current.play()

        const track = stream.getVideoTracks()[0]
        const capabilities = track.getCapabilities?.() || {}
        if (capabilities.focusMode?.includes('continuous')) {
          await track.applyConstraints({ advanced: [{ focusMode: 'continuous' }] }).catch(() => {})
        }

        rafRef.current = requestAnimationFrame(loop)
        refocusTimerRef.current = setInterval(() => {
          if (!cancelled) triggerFocus()
        }, 3000)
      } catch {
        if (!cancelled) onError('Không thể mở camera. Hãy cấp quyền camera và thử lại.')
      }
    }

    start()
    return () => {
      cancelled = true
      stopCamera()
    }
  }, [active, onScanned, onError, triggerFocus])

  return (
    <div>
      <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 4, fontSize: 12 }}>
        Nên sử dụng trên điện thoại
      </Typography.Text>
      <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 6, fontSize: 12 }}>
        Căn chỉnh camera sao cho mã QR hiện rõ nét, đầy đủ và nằm giữa khung hình
      </Typography.Text>
      <div style={{ position: 'relative', borderRadius: 4, overflow: 'hidden' }}>
        <video
          ref={videoRef}
          style={{ width: '100%', height: 200, objectFit: 'cover', display: 'block' }}
          playsInline
          muted
        />
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'none',
          }}
        >
          <div
            style={{
              width: 140,
              height: 140,
              border: '2px solid rgba(255, 255, 255, 0.85)',
              borderRadius: 6,
              boxShadow: '0 0 0 9999px rgba(0,0,0,0.35)',
            }}
          />
        </div>
        {focusing && (
          <div
            style={{
              position: 'absolute',
              bottom: 8,
              left: '50%',
              transform: 'translateX(-50%)',
              background: 'rgba(0,0,0,0.55)',
              color: '#fff',
              padding: '2px 10px',
              borderRadius: 10,
              fontSize: 11,
            }}
          >
            Đang lấy nét...
          </div>
        )}
      </div>
      <Button htmlType="button" size="small" style={{ marginTop: 6 }} onClick={triggerFocus}>
        Lấy nét lại
      </Button>
      <canvas ref={canvasRef} style={{ display: 'none' }} />
    </div>
  )
}

function PhotoScanTab({ onScanned, onError }) {
  const [scanning, setScanning] = useState(false)
  const cameraInputRef = useRef(null)
  const galleryInputRef = useRef(null)

  const handleFile = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setScanning(true)
    try {
      const result = await scanPhotoWithPreprocessing(file)
      if (result) {
        onScanned(result)
      } else {
        onError('Không tìm thấy mã QR trong ảnh. Chụp gần hơn vào phần QR code.')
      }
    } catch {
      onError('Không tìm thấy mã QR trong ảnh. Chụp gần hơn vào phần QR code.')
    } finally {
      setScanning(false)
      e.target.value = ''
    }
  }

  const open = (ref, e) => {
    e.preventDefault()
    e.stopPropagation()
    ref.current?.click()
  }

  return (
    <div style={{ textAlign: 'center', padding: '16px 0' }}>
      <Typography.Text
        type="secondary"
        style={{ display: 'block', marginBottom: 16, fontSize: 13 }}
      >
        Tải lên ảnh CCCD mặt trước có chụp rõ phần QR
      </Typography.Text>
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        style={{ display: 'none' }}
        onChange={handleFile}
      />
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handleFile}
      />
      {isDesktopDevice ? (
        <>
          <Button
            htmlType="button"
            icon={<UploadOutlined />}
            size="large"
            type="primary"
            loading={scanning}
            onClick={(e) => open(galleryInputRef, e)}
          >
            {scanning ? 'Đang xử lý...' : 'Chọn ảnh CCCD từ máy tính'}
          </Button>
        </>
      ) : (
        <>
          <Button
            htmlType="button"
            icon={<CameraOutlined />}
            size="large"
            type="primary"
            loading={scanning}
            onClick={(e) => open(cameraInputRef, e)}
          >
            {scanning ? 'Đang xử lý...' : 'Mở camera chụp ảnh'}
          </Button>
          <Typography.Text
            type="secondary"
            style={{ display: 'block', marginTop: 8, fontSize: 12 }}
          >
            Hoặc chọn ảnh có sẵn từ thư viện
          </Typography.Text>
          <Button
            htmlType="button"
            icon={<UploadOutlined />}
            size="small"
            style={{ marginTop: 4 }}
            onClick={(e) => open(galleryInputRef, e)}
          >
            Chọn từ thư viện
          </Button>
        </>
      )}
    </div>
  )
}

function PasteTab({ onScanned, onError }) {
  const [text, setText] = useState('')

  const handleSubmit = () => {
    const t = text.trim()
    if (!t) return
    if (!t.includes('|')) {
      onError('Định dạng không hợp lệ. Dữ liệu QR phải chứa dấu |')
      return
    }
    onScanned(t)
  }

  return (
    <div style={{ padding: '8px 0' }}>
      <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 8, fontSize: 13 }}>
        Dùng app camera quét QR trên CCCD, copy chuỗi kết quả rồi dán vào đây
      </Typography.Text>
      <Space.Compact style={{ width: '100%' }}>
        <Input.TextArea
          rows={3}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="00109902020202|017521650|Nguyễn Văn A|..."
        />
      </Space.Compact>
      <Button
        htmlType="button"
        type="primary"
        style={{ marginTop: 8 }}
        disabled={!text.trim()}
        onClick={handleSubmit}
      >
        Xác nhận
      </Button>
    </div>
  )
}

const isDesktopDevice = !('ontouchstart' in window) && navigator.maxTouchPoints === 0

export default function CccdQrScanModal({ open, onClose, onScanned }) {
  const [activeTab, setActiveTab] = useState('photo')
  const [errMsg, setErrMsg] = useState('')

  const handleScanned = (data) => {
    setErrMsg('')
    onClose()
    onScanned(data)
  }

  const handleClose = () => {
    setErrMsg('')
    onClose()
  }

  const tabs = [
    {
      key: 'photo',
      label: (
        <>
          <UploadOutlined /> Upload ảnh
        </>
      ),
      children: <PhotoScanTab onScanned={handleScanned} onError={setErrMsg} />,
    },
    ...(!isDesktopDevice
      ? [
          {
            key: 'live',
            label: 'Quét trực tiếp',
            children: (
              <LiveScanTab
                active={open && activeTab === 'live'}
                onScanned={handleScanned}
                onError={setErrMsg}
              />
            ),
          },
        ]
      : []),
  ]

  return (
    <Modal
      title="Quét mã QR trên CCCD"
      open={open}
      onCancel={handleClose}
      footer={
        <Button htmlType="button" onClick={handleClose}>
          Đóng
        </Button>
      }
      destroyOnClose
      width={420}
    >
      {errMsg && (
        <Alert
          type="error"
          message={errMsg}
          style={{ marginBottom: 12 }}
          closable
          onClose={() => setErrMsg('')}
        />
      )}
      <Tabs
        activeKey={activeTab}
        onChange={(k) => {
          setErrMsg('')
          setActiveTab(k)
        }}
        items={tabs}
        size="small"
      />
    </Modal>
  )
}
