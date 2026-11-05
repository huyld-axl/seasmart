import '@testing-library/jest-dom'

// jsdom không có matchMedia: mặc định không khớp truy vấn nào (useViewport, antd). Test cần màn cụ thể thì tự gán đè.
if (!window.matchMedia) {
  window.matchMedia = (query) => ({ matches: false, media: query, onchange: null, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent: () => false })
}
