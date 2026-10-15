// Khung ảnh thuyền viên theo ảnh thẻ 3x4. Chưa có ảnh thì hiện hình người mặc định.
export default function CrewPhoto({ size, src }) {
  return (
    <span className={`crew-avatar${size ? ` crew-avatar--${size}` : ''}`} aria-hidden={src ? undefined : true}>
      {src ? <img src={src} alt="Ảnh chân dung" /> : <svg viewBox="0 0 30 40" focusable="false">
        <circle cx="15" cy="15" r="6.5" />
        <path d="M2 40c0-9.5 5.5-15 13-15s13 5.5 13 15z" />
      </svg>}
    </span>
  )
}
