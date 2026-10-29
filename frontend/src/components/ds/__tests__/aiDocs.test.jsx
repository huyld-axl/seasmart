import { describe, it, expect, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import UploadPanel from '../UploadPanel'
import FieldInput from '../FieldInput'
import VesselMatchChip from '../VesselMatchChip'
import DocumentViewer from '../DocumentViewer'
import SeaServiceTimeline from '../SeaServiceTimeline'
import CertificateTable from '../CertificateTable'
import ReviewPager from '../ReviewPager'

describe('UploadPanel', () => {
  it('chưa có tệp thì chỉ hiện khung thả lớn', () => {
    render(<UploadPanel seafarerName="Khôi" />)
    expect(screen.getByText('Thả giấy tờ của Khôi vào đây')).toBeInTheDocument()
  })

  it('mỗi tệp một dòng chỉ có trạng thái đang xử lý hoặc xong, nút Duyệt gọi onReview', () => {
    const onReview = vi.fn()
    const files = [
      { id: 'a', name: 'so.pdf', kind: 'pdf', state: 'running' },
      { id: 'b', name: 'cc.pdf', kind: 'pdf', state: 'done', summary: '1 chứng chỉ' },
    ]
    render(<UploadPanel files={files} summary={{ title: 'Đang xử lý 1 tệp' }} onReview={onReview} />)
    expect(screen.getByText('Đang xử lý 1 tệp')).toBeInTheDocument()
    expect(screen.getByText('Đang xử lý')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Duyệt/ }))
    expect(onReview).toHaveBeenCalledWith(files[1])
  })

  it('tệp lỗi có Thử lại và Bỏ tệp', () => {
    const onRetry = vi.fn()
    render(<UploadPanel files={[{ id: 'x', name: 'x.pdf', kind: 'pdf', state: 'error' }]} onRetry={onRetry} />)
    fireEvent.click(screen.getByRole('button', { name: /Thử lại/ }))
    expect(onRetry).toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Bỏ tệp' })).toBeInTheDocument()
  })
})

describe('FieldInput', () => {
  it('gõ vào ô gọi onChange, không có nút Chấp nhận hay Sửa', () => {
    const onChange = vi.fn()
    render(<FieldInput label="Chức danh" value="OLR" onChange={onChange} />)
    fireEvent.change(screen.getByLabelText('Chức danh'), { target: { value: '2/E' } })
    expect(onChange).toHaveBeenCalledWith('2/E')
    expect(screen.queryByText('Chấp nhận')).toBeNull()
    expect(screen.queryByText('Sửa')).toBeNull()
  })

  it('ngày chưa chắc có nút ✓ một lần; ô đã sửa hiện "Đã sửa"', () => {
    const onConfirm = vi.fn()
    const { rerender } = render(<FieldInput label="Ngày rời tàu" value="17/06/2019" state="DATE_AMBIGUOUS" needsConfirm onConfirm={onConfirm} />)
    fireEvent.click(screen.getByRole('button', { name: 'Đúng, giữ nguyên' }))
    expect(onConfirm).toHaveBeenCalled()
    rerender(<FieldInput label="Ngày rời tàu" value="12/06/2019" state="EDITED" aiRead="17/06/2019" needsConfirm />)
    expect(screen.getByText('Đã sửa')).toBeInTheDocument()
    expect(screen.getByText('AI đọc: 17/06/2019')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Đúng, giữ nguyên' })).toBeNull()
  })

  it('ô không đọc được để trống với gợi ý', () => {
    render(<FieldInput label="Loại tàu" value="Hàng rời" state="UNKNOWN" />)
    expect(screen.getByLabelText('Loại tàu')).toHaveValue('')
    expect(screen.getByPlaceholderText('Không đọc được')).toBeInTheDocument()
  })
})

describe('VesselMatchChip', () => {
  it('khớp danh mục chỉ để xem, chưa kiểm thì bấm được', () => {
    const onClick = vi.fn()
    const { rerender } = render(<VesselMatchChip status="VERIFIED" />)
    expect(screen.getByText('Khớp danh mục')).toBeInTheDocument()
    rerender(<VesselMatchChip status="NOT_FOUND" onClick={onClick} />)
    fireEvent.click(screen.getByRole('button'))
    expect(onClick).toHaveBeenCalled()
  })
})

describe('DocumentViewer', () => {
  it('không truyền regions thì giữ nguyên, có regions thì tô ô đang chọn', () => {
    const onRegionClick = vi.fn()
    const { container, rerender } = render(<DocumentViewer fileName="a.pdf" page={1} pageCount={2} />)
    expect(container.querySelector('.ds-viewer__region')).toBeNull()
    rerender(<DocumentViewer fileName="a.pdf" page={1} pageCount={2} regions={[{ key: 'ship', label: 'Tên tàu', x: 1, y: 2, w: 3, h: 4 }]} activeRegion="ship" onRegionClick={onRegionClick} />)
    const region = screen.getByRole('button', { name: 'Ô Tên tàu trên bản gốc' })
    expect(region).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(region)
    expect(onRegionClick).toHaveBeenCalledWith('ship')
  })
})

describe('SeaServiceTimeline', () => {
  it('chỉ chuyến chưa khớp hoặc trùng mới có nhãn', () => {
    const trips = [
      { id: '1', vessel: 'A', signOn: '01/01/2020', signOff: null, ongoing: true, rank: 'OLR', rankName: 'Thợ máy', vesselStatus: 'VERIFIED', source: { type: 'manual' } },
      { id: '2', vessel: 'B', signOn: '01/01/2019', signOff: '01/02/2019', rank: 'OLR', rankName: 'Thợ máy', vesselStatus: 'NOT_FOUND', overlapNote: 'Trùng', source: { type: 'document', label: 'Từ sổ, tr.4' } },
    ]
    render(<SeaServiceTimeline trips={trips} />)
    expect(screen.getByText('Đang trên tàu')).toBeInTheDocument()
    expect(screen.getByText('Trùng thời gian')).toBeInTheDocument()
    expect(screen.getByText('Không tìm thấy')).toBeInTheDocument()
    expect(screen.queryByText('Đã đối chiếu')).toBeNull()
    expect(screen.getByText('Nhập tay')).toBeInTheDocument()
  })
})

describe('CertificateTable và ReviewPager', () => {
  it('chứng chỉ nhập tay không ghi chữ Nhập tay, hết hạn có nhãn Hết hạn', () => {
    render(<CertificateTable certs={[
      { id: '1', name: 'AFF', number: 'A1', issuedOn: '01/01/2020', expiresOn: '01/01/2025', status: 'EXPIRED', alert: 'expired', daysLeft: -12, canRenew: true },
      { id: '2', name: 'MFA', number: 'M1', issuedOn: '01/01/2021', expiresOn: '', noExpiry: true, status: 'NO_EXPIRY', manual: true },
    ]} onRenew={() => {}} onDismiss={() => {}} />)
    expect(screen.getAllByText('Hết hạn').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Quá hạn 12 ngày').length).toBeGreaterThan(0)
    expect(screen.getAllByRole('button', { name: 'Tắt cảnh báo AFF' }).length).toBeGreaterThan(0)
    expect(screen.getAllByRole('button', { name: 'Nạp bản mới AFF' }).length).toBeGreaterThan(0)
    expect(screen.queryByText('Nhập tay')).toBeNull()
    expect(screen.getAllByText('Không thời hạn').length).toBeGreaterThan(0)
  })

  it('bộ chuyển giấy khoá hai đầu', () => {
    render(<ReviewPager index={1} total={3} />)
    expect(screen.getByText('Giấy 1/3')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Giấy trước' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Giấy sau' })).not.toBeDisabled()
  })
})
