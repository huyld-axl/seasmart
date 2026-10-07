import { useState } from 'react'
import { Button, Card, DatePicker, Form, Input, Menu, Modal, Pagination, Select, Skeleton, Steps, Tabs, Tooltip } from 'antd'
import {
  DeleteOutlined,
  FileTextOutlined,
  DatabaseOutlined,
  MoreOutlined,
  ReloadOutlined,
  SafetyCertificateOutlined,
  SendOutlined,
  TeamOutlined,
  UploadOutlined,
} from '@ant-design/icons'
import ProductBrand from '../components/common/ProductBrand'
import StatusBadge from '../components/ds/StatusBadge'
import { STATUS, STATUS_GROUP_LABELS } from '../components/ds/statusMap'
import ReviewField from '../components/ds/ReviewField'
import DocumentViewer from '../components/ds/DocumentViewer'
import FileDropzone from '../components/ds/FileDropzone'
import AuditTimeline from '../components/ds/AuditTimeline'
import Banner from '../components/ds/Banner'
import ChoiceCardGroup from '../components/ds/ChoiceCardGroup'
import DescriptionList from '../components/ds/DescriptionList'
import SlidePanel from '../components/ds/SlidePanel'
import useToast from '../components/ds/useToast'
import { EmptyState, FilterChips, ListRow, ProgressBar, SaveStatus, StatusTabs } from '../components/ds/Controls'
import { COLORS, ELEVATION, RADIUS } from '../theme/tokens'
import './DesignSystemPage.css'

// Trang xem design system (skill ui-ux, D9). Dùng CHÍNH component của app, không vẽ lại.
// Ví dụ ép trạng thái (rê, focus) bọc trong <div inert data-demo-state> để probe bỏ qua.
// Mọi dữ liệu trên trang là giả (synthetic).

const SWATCHES = [
  ['primary', 'Màu nhấn: nút chính, link, control đang chọn'],
  ['primaryHover', 'Rê nút chính'],
  ['background', 'Nền trang'],
  ['surface', 'Nền card, ô nhập, header, sidebar'],
  ['foreground', 'Chữ chính'],
  ['muted', 'Chữ phụ, nhãn, placeholder'],
  ['border', 'Viền card, vạch chia'],
  ['borderStrong', 'Viền ô nhập, nút viền, kẻ khung app'],
  ['secondary', 'Mục đang chọn, nút phụ'],
  ['itemHover', 'Rê mục sidebar, dòng'],
  ['buttonHover', 'Rê nút viền'],
  ['neutral', 'Trạng thái trung lập'],
  ['success', 'Trạng thái ổn, đã xong'],
  ['warning', 'Trạng thái cần chú ý'],
  ['errorStrong', 'Trạng thái lỗi, bị chặn'],
  ['danger', 'Nút nguy hiểm'],
]

const CONTRAST_PAIRS = [
  ['Chữ chính trên nền card', 'foreground', 'surface'],
  ['Chữ chính trên nền trang', 'foreground', 'background'],
  ['Chữ phụ trên nền card', 'muted', 'surface'],
  ['Chữ phụ trên nền trang', 'muted', 'background'],
  ['Chữ trên nút chính', 'primaryForeground', 'primary'],
  ['Link trên nền card', 'primary', 'surface'],
  ['Badge trung lập', 'neutral', 'neutralBg'],
  ['Badge ổn', 'success', 'successBg'],
  ['Badge cần chú ý', 'warning', 'warningBg'],
  ['Badge lỗi', 'errorStrong', 'errorBg'],
  ['Nút nguy hiểm', 'danger', 'dangerBg'],
  ['Câu lỗi dưới ô nhập', 'errorText', 'surface'],
]

const TYPE_SCALE = [
  ['xs · 12 · 400', 12, 400, 'Cập nhật lúc 14:32 · 06/10/2026'],
  ['sm · 14 · 400 (mặc định)', 14, 400, 'Sổ thuyền viên của Nguyễn Thị Hồng Nhung có 3 dòng sea service cần xem lại.'],
  ['sm · 14 · 500 (nút, nhãn)', 14, 500, 'Công bố hồ sơ'],
  ['base · 16 · 600 (tên card)', 16, 600, 'Kết quả kiểm tra'],
  ['lg · 18 · 600 (tiêu đề khối, tên bản ghi)', 18, 600, 'Trần Minh Khôi · Chief Officer'],
  ['xl · 20 · 600 (tên trang)', 20, 600, 'Duyệt tài liệu'],
  ['2xl · 24 · 600 (số liệu)', 24, 600, '1.284 ngày đi biển'],
]

const SPACING = [4, 8, 12, 16, 20, 24, 32, 40]

const FIELD_STATES = [
  { label: 'Họ tên', value: 'Nguyễn Thị Hồng Nhung Phương Anh', state: 'PROPOSED', page: 1, isCritical: true },
  { label: 'Ngày sinh', value: '02/11/1995', state: 'ACCEPTED', page: 1, isCritical: true },
  { label: 'Sign on · dòng 2', value: '05/01/2022', state: 'EDITED', page: 3, isCritical: true, reason: 'AI đọc nhầm tháng 07 thành 01, đối chiếu dấu xuất cảnh' },
  { label: 'Sign off · dòng 3', value: '', state: 'UNKNOWN', page: 3, isCritical: true },
  { label: 'Sign off · dòng 3', value: '', state: 'UNKNOWN_KEPT', page: 3, isCritical: true, reason: 'Ô bị nhoè mực, không có giấy tờ khác đối chiếu' },
  { label: 'Sign on · dòng 3', value: '24/09/2022', state: 'DATE_AMBIGUOUS', page: 3, isCritical: true },
  { label: 'Rank raw · dòng 1', value: 'Bosun', state: 'REJECTED', page: 3, reason: 'Sổ ghi AB, AI đọc lẫn sang dòng chữ ký' },
  { label: 'IMO · dòng 3', value: '9524454', state: 'PROPOSED', page: 3, vesselStatus: 'NOT_CHECKED' },
]

const FILES = [
  { name: 'so-thuyen-vien-nguyen-thi-hong-nhung-phuong-anh.pdf', state: 'uploading', progress: 71 },
  { name: 'so-thuyen-vien-tran-minh-khoi.pdf', state: 'waiting', size: '6,8 MB' },
  { name: 'so-thuyen-vien-le-van-duc-trang-1.jpg', state: 'failed', error: 'Mất kết nối mạng' },
  { name: 'so-thuyen-vien-tran-minh-khoi-ban-chup-lai.pdf', state: 'duplicate', duplicateOf: '09:12 · 03/10/2026' },
  { name: 'so-thuyen-vien-pham-quoc-bao.pdf', state: 'done', size: '2,4 MB' },
]

const AUDIT = [
  { id: 4, kind: 'export', tone: 'warning', title: 'Bản xuất CV · Chủ tàu Demo A chuyển sang Cần làm lại', time: '15:02 · 06/10/2026', actor: 'Hệ thống', source: 'Hồ sơ đổi sang revision 3' },
  { id: 3, kind: 'edit', tone: 'success', title: 'Sửa Sign on · dòng 2', time: '14:58 · 06/10/2026', before: '05/07/2022', after: '05/01/2022', reason: 'AI đọc nhầm tháng 07 thành 01, đối chiếu dấu xuất cảnh', actor: 'Lê Thu Hà', source: 'Trang 3 · so-thuyen-vien-nguyen-thi-hong-nhung.pdf' },
  { id: 2, kind: 'accept', tone: 'success', title: 'Chấp nhận 14 trường AI đề xuất', time: '14:51 · 06/10/2026', actor: 'Lê Thu Hà', source: 'Trang 1–3' },
  { id: 1, kind: 'upload', tone: 'neutral', title: 'Tải lên sổ thuyền viên', time: '14:40 · 06/10/2026', actor: 'Phạm Văn Tùng', source: 'so-thuyen-vien-nguyen-thi-hong-nhung.pdf · 12 trang' },
]

const DETAILS = [
  { label: 'Họ tên', value: 'Nguyễn Thị Hồng Nhung Phương Anh' },
  { label: 'Ngày sinh', value: '02/11/1995' },
  { label: 'Rank', value: 'Able Seaman (AB)' },
  { label: 'Quốc tịch', value: 'Việt Nam' },
  { label: 'Hộ chiếu', value: 'D0000002' },
  { label: 'Số điện thoại', value: '' },
]

const TEMPLATE_OPTIONS = [
  { value: 'cv', title: 'CV thuyền viên', aside: 'Mẫu A · v1', description: 'Một trang thông tin cá nhân và 10 dòng sea service gần nhất.' },
  { value: 'matrix', title: 'Sea service matrix', aside: 'Mẫu B · v1', description: 'Bảng kinh nghiệm theo loại tàu và Rank, tối đa 30 dòng.' },
]

const CONTACT_OPTIONS = [
  { value: 'replace', title: 'Thay bằng liên lạc của agency', description: 'Ẩn SĐT, email thuyền viên; in SĐT và email của agency.' },
  { value: 'hide', title: 'Ẩn thông tin liên lạc', description: 'Không in SĐT, email nào trên bản xuất.' },
  { value: 'show', title: 'Hiện đầy đủ', description: 'In SĐT và email của thuyền viên như trong hồ sơ.' },
]

const NAV_ITEMS = [
  { key: 'documents', icon: <FileTextOutlined />, label: 'Tài liệu' },
  { key: 'seafarers', icon: <TeamOutlined />, label: 'Thuyền viên' },
  { key: 'exports', icon: <SendOutlined />, label: 'Bản xuất' },
  { key: 'catalog', icon: <DatabaseOutlined />, label: 'Danh mục' },
  { key: 'admin', icon: <SafetyCertificateOutlined />, label: 'Quản trị' },
]

// Tỉ lệ tương phản WCAG; màu có alpha thì trộn lên nền trắng trước.
function parseColor(value) {
  if (value.startsWith('#')) {
    const hex = value.slice(1)
    return [0, 2, 4].map((offset) => parseInt(hex.slice(offset, offset + 2), 16))
  }
  const [r, g, b, a = 1] = value.match(/[\d.]+/g).map(Number)
  return [r, g, b].map((channel) => Math.round(channel * a + 255 * (1 - a)))
}

function luminance(value) {
  const [r, g, b] = parseColor(value).map((channel) => {
    const c = channel / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function contrastRatio(foreground, background) {
  const [light, dark] = [luminance(foreground), luminance(background)].sort((a, b) => b - a)
  return (light + 0.05) / (dark + 0.05)
}

function Section({ id, title, children }) {
  return (
    <section id={id} className="dsp-section">
      <h2 className="dsp-section__title">{title}</h2>
      {children}
    </section>
  )
}

// Một ví dụ có nhãn trạng thái ở trên. `state` có giá trị thì là ví dụ ép trạng thái (inert).
function Demo({ label, state, children, wide = false }) {
  return (
    <div className={`dsp-demo${wide ? ' dsp-demo--wide' : ''}`}>
      <p className="dsp-demo__label">{label}</p>
      {state ? (
        <div inert data-demo-state={state}>
          {children}
        </div>
      ) : (
        children
      )}
    </div>
  )
}

// Panel trượt và toast mở thật (bấm nút); thanh bước tĩnh, bước 2/4.
function OverlayDemos() {
  const [panelOpen, setPanelOpen] = useState(false)
  const toast = useToast()
  return (
    <div className="dsp-states">
      <Demo label="Panel trượt: thêm và sửa chung một form">
        <Button onClick={() => setPanelOpen(true)}>Mở panel Thêm tàu</Button>
        <SlidePanel
          open={panelOpen}
          title="Thêm tàu"
          onClose={() => setPanelOpen(false)}
          footer={
            <>
              <Button onClick={() => setPanelOpen(false)}>Huỷ</Button>
              <Button type="primary" onClick={() => setPanelOpen(false)}>Thêm tàu</Button>
            </>
          }
        >
          <Form layout="vertical" requiredMark>
            <Form.Item label="Tên tàu" required><Input defaultValue="MV Lotus Pearl" /></Form.Item>
            <Form.Item label="IMO" extra="Để trống nếu tàu không có IMO."><Input defaultValue="9074729" /></Form.Item>
          </Form>
        </SlidePanel>
      </Demo>
      <Demo label="Toast: xong việc, có Hoàn tác, lỗi">
        <div className="dsp-inline">
          <Button onClick={() => toast.success('Đã lưu MV Lotus Pearl')}>Toast xong việc</Button>
          <Button onClick={() => toast.success('Đã xoá MV Lotus Pearl', { actionLabel: 'Hoàn tác', onAction: () => toast.success('Đã khôi phục MV Lotus Pearl') })}>Toast có Hoàn tác</Button>
          <Button onClick={() => toast.error('Không lưu được. Mất kết nối mạng.')}>Toast lỗi</Button>
        </div>
      </Demo>
      <Demo label="Thanh bước" wide>
        <Steps
          current={1}
          size="small"
          items={[{ title: 'Người' }, { title: 'Giấy tờ' }, { title: 'Điền thêm' }, { title: 'Gửi duyệt' }]}
        />
      </Demo>
    </div>
  )
}

export default function DesignSystemPage() {
  const [template, setTemplate] = useState('cv')
  const [contactPolicy, setContactPolicy] = useState('replace')
  const [statusTab, setStatusTab] = useState('review')
  const [chips, setChips] = useState(['blocked'])

  return (
    <div className="dsp">
      <header className="dsp-header">
        <ProductBrand />
        <h1 className="dsp-header__title">Design system</h1>
        <p className="dsp-header__text">Token và component dùng chung cho mọi màn MCAH. Chỉ giao diện sáng. Dữ liệu trên trang là giả.</p>
      </header>

      <Section id="mau" title="Màu">
        <div className="dsp-swatches">
          {SWATCHES.map(([name, role]) => (
            <div key={name} className="dsp-swatch">
              <span className="dsp-swatch__chip" style={{ background: COLORS[name] }} />
              <span className="dsp-swatch__name">{name}</span>
              <span className="dsp-swatch__value">{COLORS[name]}</span>
              <span className="dsp-swatch__role">{role}</span>
            </div>
          ))}
        </div>
        <div className="dsp-table-wrap">
          <table className="dsp-table">
            <thead>
              <tr><th>Cặp chữ trên nền</th><th>Mẫu</th><th>Tỉ lệ</th><th /></tr>
            </thead>
            <tbody>
              {CONTRAST_PAIRS.map(([label, fg, bg]) => {
                const ratio = contrastRatio(COLORS[fg], COLORS[bg])
                return (
                  <tr key={label}>
                    <td>{label}</td>
                    <td><span className="dsp-pair" style={{ color: COLORS[fg], background: COLORS[bg] }}>Đã duyệt 12/18</span></td>
                    <td className="dsp-num">{ratio.toFixed(2)}:1</td>
                    <td>{ratio < 4.5 ? <span className="dsp-fail">Dưới 4.5:1</span> : null}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Section>

      <Section id="chu" title="Chữ">
        <p className="dsp-note">Một font Inter, phân vai bằng độ đậm. Bảy bậc, không cỡ nào ngoài thang.</p>
        <div className="dsp-type">
          {TYPE_SCALE.map(([label, size, weight, sample]) => (
            <div key={label} className="dsp-type__row">
              <span className="dsp-type__meta">{label}</span>
              <span style={{ fontSize: size, fontWeight: weight }}>{sample}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section id="nhip" title="Khoảng cách, bo góc, viền, bóng">
        <div className="dsp-grid-2">
          <div>
            <p className="dsp-demo__label">Khoảng cách giữa khối (px)</p>
            <div className="dsp-spacing">
              {SPACING.map((size) => (
                <div key={size} className="dsp-spacing__row">
                  <span className="dsp-num">{size}</span>
                  <span className="dsp-spacing__bar" style={{ width: size * 4 }} />
                </div>
              ))}
            </div>
          </div>
          <div>
            <p className="dsp-demo__label">Bo góc: dưới 40px là 8, từ 40px là 12, card và hộp thoại 16</p>
            <div className="dsp-radius">
              {[['sm', 'Chip nhỏ, tab, nút 36px'], ['md', 'Nút, ô nhập 40px'], ['lg', 'Card, hộp thoại'], ['full', 'Badge, chip lọc']].map(([name, role]) => (
                <div key={name} className="dsp-radius__item">
                  <span className="dsp-radius__box" style={{ borderRadius: RADIUS[name] }} />
                  <span className="dsp-swatch__name">{name === 'full' ? 'full' : `${RADIUS[name]}px`}</span>
                  <span className="dsp-swatch__role">{role}</span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <p className="dsp-demo__label">Hai vai viền</p>
            <div className="dsp-borders">
              <div className="dsp-border-sample" style={{ borderColor: COLORS.border }}>border · card, vạch chia</div>
              <div className="dsp-border-sample" style={{ borderColor: COLORS.borderStrong }}>borderStrong · ô nhập, nút viền</div>
            </div>
          </div>
          <div>
            <p className="dsp-demo__label">Bóng chỉ cho lớp nổi</p>
            <div className="dsp-borders">
              <div className="dsp-shadow-sample" style={{ boxShadow: ELEVATION.popover }}>Dropdown, popover</div>
              <div className="dsp-shadow-sample" style={{ boxShadow: ELEVATION.modal }}>Hộp thoại, panel trượt</div>
            </div>
          </div>
        </div>
      </Section>

      <Section id="nut" title="Nút">
        <div className="dsp-states">
          <Demo label="Viền · mặc định · thường"><Button>Lưu nháp</Button></Demo>
          <Demo label="Viền · rê" state="hover"><Button>Lưu nháp</Button></Demo>
          <Demo label="Viền · khoá"><Button disabled>Lưu nháp</Button></Demo>
          <Demo label="Viền · có icon"><Button icon={<UploadOutlined />}>Tải tài liệu lên</Button></Demo>
        </div>
        <div className="dsp-states">
          <Demo label="Chính · thường"><Button type="primary">Công bố hồ sơ</Button></Demo>
          <Demo label="Chính · rê" state="hover"><Button type="primary">Công bố hồ sơ</Button></Demo>
          <Demo label="Chính · đang xử lý"><Button type="primary" loading>Công bố hồ sơ</Button></Demo>
          <Demo label="Chính · khoá"><Button type="primary" disabled>Công bố hồ sơ</Button></Demo>
        </div>
        <div className="dsp-states">
          <Demo label="Phụ · thường"><Button color="default" variant="filled">Huỷ</Button></Demo>
          <Demo label="Mờ · thường"><Button type="text">Bỏ chọn</Button></Demo>
          <Demo label="Mờ · rê" state="hover"><Button type="text">Bỏ chọn</Button></Demo>
          <Demo label="Nguy hiểm · thường"><Button color="danger" variant="filled" icon={<DeleteOutlined />}>Xoá tài liệu</Button></Demo>
          <Demo label="Chỉ icon">
            <Tooltip title="Thêm thao tác"><Button type="text" icon={<MoreOutlined />} aria-label="Thêm thao tác" /></Tooltip>
          </Demo>
        </div>
      </Section>

      <Section id="badge" title="Badge trạng thái">
        <p className="dsp-note">Một bảng ánh xạ cho mọi màn (D2). Trạng thái cùng tông tách nhau bằng hình ở đầu badge.</p>
        <div className="dsp-badges">
          {Object.entries(STATUS).map(([group, values]) => (
            <div key={group} className="dsp-badges__row">
              <span className="dsp-badges__group">{STATUS_GROUP_LABELS[group]}</span>
              <span className="dsp-badges__list">
                {Object.keys(values).map((value) => <StatusBadge key={value} group={group} value={value} />)}
              </span>
            </div>
          ))}
        </div>
      </Section>

      <Section id="o-nhap" title="Ô nhập">
        <Form layout="vertical" className="dsp-form" requiredMark>
          <div className="dsp-states dsp-states--form">
            <Demo label="Thường">
              <Form.Item label="Số IMO" required><Input placeholder="7 chữ số, ví dụ 9163283" /></Form.Item>
            </Demo>
            <Demo label="Đang gõ" state="focus">
              <Form.Item label="Số IMO" required><Input defaultValue="91632" /></Form.Item>
            </Demo>
            <Demo label="Lỗi">
              <Form.Item label="Số IMO" required validateStatus="error" help="Sai số kiểm tra: chữ số cuối phải là 3">
                <Input defaultValue="9524454" />
              </Form.Item>
            </Demo>
            <Demo label="Khoá">
              <Form.Item label="Số IMO"><Input defaultValue="9194945" disabled /></Form.Item>
            </Demo>
            <Demo label="Ô chọn">
              <Form.Item label="Rank"><Select placeholder="Chọn Rank" options={[{ value: 'AB', label: 'Able Seaman (AB)' }, { value: 'CO', label: 'Chief Officer' }]} /></Form.Item>
            </Demo>
            <Demo label="Ô chọn ngày">
              <Form.Item label="Sign off"><DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} /></Form.Item>
            </Demo>
          </div>
        </Form>
      </Section>

      <Section id="card" title="Card và dòng danh sách">
        <div className="dsp-grid-2">
          <Card title="Kết quả kiểm tra" extra={<StatusBadge group="readiness" value="BLOCKED" />}>
            <ul className="dsp-list">
              <ListRow trailing={<StatusBadge group="rule" value="FAIL" />} title="IMO sai số kiểm tra" meta="Dòng 3 · 9524454 · Sửa IMO hoặc đính bằng chứng" />
              <ListRow trailing={<StatusBadge group="rule" value="FAIL" />} title="Hai hợp đồng trùng 6 ngày" meta="Dòng 2 và 3 · Xác nhận là bàn giao hoặc sửa ngày" />
              <ListRow trailing={<StatusBadge group="rule" value="UNKNOWN" />} title="Thiếu Sign off" meta="Dòng 3 · Ô không đọc được" />
              <ListRow trailing={<StatusBadge group="rule" value="PASS" />} title="Đủ trường trọng yếu" meta="6 / 6 trường đã duyệt" />
            </ul>
            <p className="dsp-card-foot">Chưa đánh giá: chứng chỉ, visa</p>
          </Card>
          <Card title="Thông tin cá nhân">
            <DescriptionList items={DETAILS} />
          </Card>
        </div>
      </Section>

      <Section id="hop-thoai" title="Hộp thoại">
        <div className="dsp-modal">
          <Modal._InternalPanelDoNotUseOrYouWillBeFired
            title="Sửa Sign on · dòng 2"
            footer={
              <div className="dsp-modal__footer">
                <Button color="default" variant="filled">Huỷ</Button>
                <Button type="primary">Lưu thay đổi</Button>
              </div>
            }
          >
            <Form layout="vertical" requiredMark>
              <Form.Item label="Sign on" required><DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} /></Form.Item>
              <Form.Item label="Lý do sửa" required extra="Lý do lưu vào lịch sử hồ sơ, ai xem hồ sơ cũng thấy.">
                <Input.TextArea rows={3} placeholder="Ví dụ: AI đọc nhầm tháng, đối chiếu dấu xuất cảnh" />
              </Form.Item>
            </Form>
          </Modal._InternalPanelDoNotUseOrYouWillBeFired>
        </div>
      </Section>

      <Section id="panel" title="Panel trượt, toast, thanh bước">
        <OverlayDemos />
      </Section>

      <Section id="rong" title="Trạng thái rỗng, lỗi, đang tải">
        <div className="dsp-grid-3">
          <Demo label="Rỗng">
            <div className="dsp-box"><EmptyState title="Chưa có tài liệu nào" description="Tải sổ thuyền viên lên để AI đề xuất dữ liệu." action={<Button icon={<UploadOutlined />}>Tải tài liệu lên</Button>} /></div>
          </Demo>
          <Demo label="Lỗi tải">
            <div className="dsp-box"><EmptyState isError title="Không tải được danh sách tài liệu" description="Mất kết nối tới máy chủ." action={<Button icon={<ReloadOutlined />}>Thử lại</Button>} /></div>
          </Demo>
          <Demo label="Đang tải">
            <div className="dsp-box dsp-box--pad"><Skeleton active paragraph={{ rows: 3 }} title={false} /></div>
          </Demo>
        </div>
        <div className="dsp-grid-2">
          <Demo label="Việc chạy lâu: AI trích xuất">
            <div className="dsp-box dsp-box--pad">
              <ProgressBar label="Đang trích xuất trang 7 / 12" done={7} total={12} />
              <p className="dsp-note dsp-note--tight">so-thuyen-vien-tran-minh-khoi.pdf · xong sẽ chuyển sang Chờ duyệt</p>
            </div>
          </Demo>
          <Demo label="Tự lưu bản nháp duyệt">
            <div className="dsp-box dsp-box--pad dsp-inline">
              <SaveStatus state="saving" />
              <SaveStatus state="saved" />
              <SaveStatus state="failed" />
            </div>
          </Demo>
        </div>
      </Section>

      <Section id="o-truong" title="Ô trường duyệt">
        <p className="dsp-note">Trường trọng yếu có dấu *. Bấm chip trang để khung tài liệu nhảy tới trang bằng chứng.</p>
        <div className="dsp-grid-2">
          {FIELD_STATES.map((field, index) => (
            <ReviewField key={`${field.label}-${field.state}`} {...field} isActive={index === 3} />
          ))}
        </div>
      </Section>

      <Section id="tai-lieu" title="Khung xem tài liệu">
        <DocumentViewer fileName="so-thuyen-vien-nguyen-thi-hong-nhung-phuong-anh.pdf" page={3} pageCount={12} zoom={100} evidenceLabel="Sign off · dòng 3" />
      </Section>

      <Section id="tai-len" title="Khung kéo thả tệp">
        <div className="dsp-box dsp-box--pad">
          <FileDropzone files={FILES} />
        </div>
      </Section>

      <Section id="audit" title="Dòng thời gian audit">
        <div className="dsp-box dsp-box--pad"><AuditTimeline items={AUDIT} /></div>
      </Section>

      <Section id="banner" title="Banner">
        <div className="dsp-stack">
          <Banner tone="warning" title="Bản xuất này cũ hơn hồ sơ" description="Hồ sơ đã sang revision 3 sau khi bản xuất được tạo. Tạo lại và gửi duyệt trước khi gửi chủ tàu." action={<Button>Tạo lại bản xuất</Button>} />
          <Banner tone="error" title="Hồ sơ vừa được Lê Thu Hà cập nhật" description="Thay đổi của bạn chưa lưu. Tải lại để xem revision mới rồi sửa tiếp." action={<Button>Tải lại</Button>} />
          <Banner tone="error" title="Hồ sơ bị chặn, chưa xuất được">
            <ul>
              <li>IMO 9524454 ở dòng 3 sai số kiểm tra</li>
              <li>Dòng 2 và dòng 3 trùng 6 ngày</li>
              <li>Thiếu Sign off ở dòng 3</li>
            </ul>
          </Banner>
          <Banner tone="neutral" title="Định hướng" description="Màn này minh hoạ tính năng của giai đoạn sau, chưa chạy trong bản demo." />
        </div>
      </Section>

      <Section id="lua-chon" title="Lựa chọn dạng card">
        <div className="dsp-stack">
          <ChoiceCardGroup name="template" legend="Mẫu bản xuất" columns={2} options={TEMPLATE_OPTIONS} value={template} onChange={setTemplate} />
          <ChoiceCardGroup name="contact" legend="Thông tin liên lạc trên bản xuất" options={CONTACT_OPTIONS} value={contactPolicy} onChange={setContactPolicy} />
        </div>
      </Section>

      <Section id="tab" title="Tab, chip lọc, phân trang">
        <Demo label="Tab chia nội dung trang chi tiết" wide>
          <Tabs defaultActiveKey="profile" items={[
            { key: 'profile', label: 'Hồ sơ' },
            { key: 'sea', label: 'Sea service' },
            { key: 'checks', label: 'Kiểm tra' },
            { key: 'exports', label: 'Bản xuất' },
            { key: 'history', label: 'Lịch sử' },
          ]} />
        </Demo>
        <Demo label="Tab trạng thái trên bảng" wide>
          <StatusTabs value={statusTab} onChange={setStatusTab} tabs={[
            { value: 'all', label: 'Tất cả', count: 24 },
            { value: 'processing', label: 'Đang trích xuất', count: 2 },
            { value: 'review', label: 'Chờ duyệt', count: 5 },
            { value: 'failed', label: 'Lỗi', count: 1 },
          ]} />
        </Demo>
        <Demo label="Chip lọc" wide>
          <FilterChips
            selected={chips}
            onToggle={(value) => setChips((current) => (current.includes(value) ? current.filter((item) => item !== value) : [...current, value]))}
            chips={[
              { value: 'ready', label: 'Sẵn sàng (phạm vi MVP)' },
              { value: 'review', label: 'Cần xem lại' },
              { value: 'blocked', label: 'Bị chặn' },
              { value: 'ongoing', label: 'Đang trên tàu' },
            ]}
          />
        </Demo>
        <Demo label="Phân trang ở chân bảng" wide>
          <div className="dsp-pager">
            <p className="dsp-pager__count"><span className="dsp-hide-sm">1 tới 25 trong </span>312 thuyền viên</p>
            <Pagination className="dsp-pager__full" total={312} pageSize={25} defaultCurrent={1} showSizeChanger={false} />
            <Pagination className="dsp-pager__simple" simple total={312} pageSize={25} defaultCurrent={1} />
          </div>
        </Demo>
      </Section>

      <Section id="sidebar" title="Mục sidebar">
        <div className="dsp-sidebar">
          <div className="dsp-sidebar__head"><ProductBrand /></div>
          <Menu mode="inline" selectedKeys={['seafarers']} items={NAV_ITEMS} />
        </div>
      </Section>

    </div>
  )
}
