// Nguồn token DUY NHẤT của MCAH: Ant Design (ConfigProvider) và CSS (biến --*) cùng đọc từ đây.
// Giá trị theo skill ui-ux (references/tokens.css, budgets.md), chỉ thay màu nhấn và font.
// ĐỔI THƯƠNG HIỆU: màu nhấn ở `primary` (kéo theo primaryHover, primaryLight, ringFocus), font ở `fontFamily`.

export const COLORS = {
  // Màu nhấn navy của dự án. Chỉ ở nút chính, link, control đang chọn (M4).
  primary: '#003366',
  primaryHover: '#1a4775', // lệch về phía nền một bậc
  primaryForeground: '#ffffff',
  primaryLight: 'rgba(0, 51, 102, 0.06)',

  background: '#f4f4f6', // nền trang, xám nhạt
  surface: '#ffffff', // nền card, ô nhập, header, sidebar
  foreground: '#2c2c2c', // chữ chính
  muted: '#707070', // chữ phụ, nhãn, placeholder. 4.95:1 trên surface, 4.51:1 trên background

  // Hai token viền (M14): đường tóc của card và vạch chia; viền ô nhập, nút viền, đường kẻ khung app.
  border: '#f7f7f8',
  borderStrong: '#eaeaea',

  secondary: '#e7e8ec', // mục đang chọn (sidebar, tab, trang), nút phụ
  secondaryHover: '#dbdce2',
  itemHover: '#f4f4f6', // rê mục sidebar, dòng danh sách
  surfaceHover: '#f8f8fa',
  buttonHover: '#f1f1f3', // rê nút viền: chỉ đổi nền (luật chốt #5)

  ringFocus: 'rgba(0, 51, 102, 0.1)',
  borderFocus: '#003366',

  // Bốn tông trạng thái (M7). Chữ trên nền nhạt đều ≥ 4.5:1.
  neutral: '#52525c',
  neutralBg: '#f4f4f5',
  success: '#007a55',
  successBg: '#ecfdf5',
  warning: '#bb4d00',
  warningBg: '#fffbeb',
  warningBorder: '#fee685',
  errorStrong: '#c10007',
  errorBg: '#fef2f2',
  errorBorder: '#ffc9c9',
  error: '#fb2c36', // chỉ cho viền ô nhập lỗi, không cho chữ
  errorText: '#e7000b', // câu lỗi dưới ô

  // Nút nguy hiểm: nền đỏ mờ, chữ đỏ đậm, luôn hiện (luật chốt #2).
  danger: '#c70036',
  dangerBg: 'rgba(255, 32, 86, 0.1)',
  dangerBgHover: 'rgba(255, 32, 86, 0.15)',
}

export const FONT_FAMILY = "'Inter', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif"

// Bo góc theo chiều cao (F1, luật chốt #10): dưới 40px là 8, từ 40px là 12, card và modal 16.
export const RADIUS = { sm: 8, md: 12, lg: 16, full: 9999 }

// Bóng chỉ cho lớp nổi (M15).
export const ELEVATION = {
  popover: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
  modal: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
}

// Biến CSS sinh từ cùng bộ trên, gắn vào :root lúc khởi động (main.jsx).
const toKebab = (name) => name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)

export function buildCssVariables() {
  const lines = Object.entries(COLORS).map(([name, value]) => `--${toKebab(name)}: ${value};`)
  lines.push(`--app-font: ${FONT_FAMILY};`)
  for (const [name, value] of Object.entries(RADIUS)) lines.push(`--radius-${name}: ${value}px;`)
  lines.push(`--elevation-popover: ${ELEVATION.popover};`, `--elevation-modal: ${ELEVATION.modal};`)
  return `:root {\n  ${lines.join('\n  ')}\n}`
}

export function applyCssVariables() {
  const style = document.createElement('style')
  style.dataset.mcahTokens = ''
  style.textContent = buildCssVariables()
  document.head.prepend(style)
}

// Theme Ant Design: giữ tên token của AntD, trỏ giá trị về bộ token trên.
export const antTheme = {
  token: {
    colorPrimary: COLORS.primary,
    colorLink: COLORS.primary,
    colorLinkHover: COLORS.primaryHover,
    colorSuccess: COLORS.success,
    colorWarning: COLORS.warning,
    colorError: COLORS.errorStrong,
    colorInfo: COLORS.primary,
    colorText: COLORS.foreground,
    colorTextSecondary: COLORS.muted,
    colorTextTertiary: COLORS.muted,
    colorTextDescription: COLORS.muted,
    colorTextPlaceholder: COLORS.muted,
    colorTextDisabled: '#a1a1aa',
    colorBgLayout: COLORS.background,
    colorBgContainer: COLORS.surface,
    colorBgElevated: COLORS.surface,
    colorBorder: COLORS.borderStrong,
    colorBorderSecondary: COLORS.border,
    colorSplit: COLORS.border,
    colorFillTertiary: COLORS.itemHover,
    colorFillSecondary: COLORS.secondary,
    controlItemBgHover: COLORS.itemHover,
    controlItemBgActive: COLORS.secondary,
    controlItemBgActiveHover: COLORS.secondaryHover,
    controlOutline: COLORS.ringFocus,
    controlOutlineWidth: 2,
    borderRadius: RADIUS.md,
    borderRadiusSM: RADIUS.sm,
    borderRadiusXS: 6,
    borderRadiusLG: RADIUS.lg,
    controlHeight: 40,
    controlHeightSM: 32,
    controlHeightLG: 48,
    fontFamily: FONT_FAMILY,
    fontSize: 14,
    boxShadow: ELEVATION.popover,
    boxShadowSecondary: ELEVATION.popover,
    boxShadowTertiary: 'none',
    motionDurationMid: '0.2s',
    wireframe: false,
  },
  components: {
    Button: {
      primaryShadow: 'none',
      defaultShadow: 'none',
      dangerShadow: 'none',
      fontWeight: 500,
      paddingInline: 16,
      defaultHoverBg: COLORS.buttonHover,
      defaultHoverBorderColor: COLORS.borderStrong,
      defaultHoverColor: COLORS.foreground,
      defaultActiveBg: COLORS.secondary,
      defaultActiveBorderColor: COLORS.borderStrong,
      defaultActiveColor: COLORS.foreground,
      textHoverBg: 'rgba(44, 44, 44, 0.05)',
      textTextColor: COLORS.muted, // nút mờ (ghost): chữ phụ, rê vào mới đậm (button.md)
      textTextHoverColor: COLORS.foreground,
    },
    Input: { activeShadow: `0 0 0 2px ${COLORS.ringFocus}`, hoverBorderColor: COLORS.borderStrong, paddingInline: 16 },
    InputNumber: { activeShadow: `0 0 0 2px ${COLORS.ringFocus}`, hoverBorderColor: COLORS.borderStrong },
    Select: { activeOutlineColor: COLORS.ringFocus, hoverBorderColor: COLORS.borderStrong, optionSelectedBg: COLORS.secondary },
    DatePicker: { activeShadow: `0 0 0 2px ${COLORS.ringFocus}`, hoverBorderColor: COLORS.borderStrong },
    Card: { headerFontSize: 16, bodyPadding: 20, headerPadding: 20 },
    Modal: { titleFontSize: 18, contentBg: COLORS.surface, headerBg: COLORS.surface },
    Menu: {
      itemHeight: 40,
      itemBorderRadius: RADIUS.md,
      itemColor: 'rgba(44, 44, 44, 0.7)',
      itemHoverColor: COLORS.foreground,
      itemHoverBg: COLORS.itemHover,
      itemSelectedBg: COLORS.secondary,
      itemSelectedColor: COLORS.foreground,
      itemActiveBg: COLORS.secondary,
      itemMarginInline: 12,
      iconSize: 16,
    },
    Layout: { bodyBg: COLORS.background, headerBg: COLORS.surface, siderBg: COLORS.surface, headerHeight: 56, headerPadding: '0 24px' },
    Tabs: { inkBarColor: COLORS.foreground, itemSelectedColor: COLORS.foreground, itemHoverColor: COLORS.foreground, itemColor: 'rgba(44, 44, 44, 0.7)' },
    Pagination: { itemActiveBg: COLORS.secondary, itemSize: 36 },
    Table: { headerBg: COLORS.surface, headerColor: COLORS.muted, rowHoverBg: COLORS.surfaceHover, borderColor: COLORS.border, headerSplitColor: 'transparent' },
    Tag: { defaultBg: COLORS.neutralBg, defaultColor: COLORS.neutral },
    Descriptions: { labelColor: COLORS.muted },
    Tooltip: { colorBgSpotlight: COLORS.foreground },
  },
}
