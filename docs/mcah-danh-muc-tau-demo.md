# Danh mục 9 tàu cho bản demo

- **Ngày lập:** 2026-10-08. **Chốt:** 2026-10-12.
- **Dùng cho:** mục 5.3 của [kế hoạch demo](mcah-ke-hoach-demo-sales.md). Chín tàu này là chín chuyến trong sổ thuyền viên mẫu; app cần thông số của chúng để điền vùng SERVICE RECORDS của CV.
- **Quyết định 12/10 (HuyLD):** đây là dữ liệu demo, không cần chính xác và không cần rà. Trường nào thiếu thì **để null**, không bịa số. Bảng này không dùng làm dữ liệu tàu thật.
- **Cách đọc:** ô `—` là null. Các ô còn lại là số đọc từ sổ hoặc tra web ngày 08/10/2026, chưa ai xác nhận.

## Bảng chính

| # | Tên tàu | IMO | Cờ | Loại tàu | GT | DWT | Năm đóng | Công suất (kW) | Loại máy chính | Chủ tàu |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | SAO BIỂN | (không có) | Việt Nam | Tàu huấn luyện | 300 | — | — | 700 | — | VIMARU |
| 2 | ATAYAL STAR | 9606962 | Panama | Bulk carrier | 9991 | 16805 | 2012 | 4440 | — | Wisdom Marine Lines |
| 3 | FRANBO WIND | 9233480 | Panama | Bulk carrier | 25545 | 46513 | 2001 | 7487 | — | Franbo Lines |
| 4 | GEIYO K | 9747613 | Marshall Islands | Bulk carrier | 31557 | 55476 | 2016 | 7730 | — | Sealift Maritime S.A. |
| 5 | ASAHI MARU | 9594389 | Panama | Bulk carrier | 23264 | 38215 | 2011 | 7860 | — | Misuga Kaiun |
| 6 | HTK CONFIDENCE | 9412969 | Việt Nam | Bulk carrier | 16960 | 28437 | 2007 | 5850 | — | HTK SIMEX Co. Ltd |
| 7 | HTK DISCOVERY | 9374349 | Panama | Bulk carrier | 22697 | 37322 | 2007 | 7080 | — | HTK SIMEX Co. Ltd |
| 8 | GLORY NAVIGATOR | 9336907 | Panama | Bulk carrier | 42647 | 81900 | 2008 | 9378 | — | Glory Ships (S) |
| 9 | PACIFIC GRACE | 9154828 | Panama | Container | 9352 | 12368 | 1997 | 7987 | — | — |

Cả 8 số IMO đều đúng số kiểm tra (đã chạy luật kiểm tra của app trên từng số).

## Các lựa chọn đã chốt

1. **SAO BIỂN không có IMO, DWT, năm đóng.** Để null. Đây là ca demo "tàu không có IMO, cần bằng chứng khác".
2. **PACIFIC GRACE giữ lệch dung tích.** Danh mục ghi 9352, sổ ghi 9203. Đây là ca demo để panel đối chiếu báo "dung tích khác" và người duyệt phải quyết.
3. **HTK DISCOVERY** ghi Bulk carrier theo sổ; chủ tàu ghi theo sổ (HTK SIMEX).
4. **ATAYAL STAR, ASAHI MARU:** lấy tên công ty quản lý làm chủ tàu.
5. **Tên cũ** (ASAHI MARU nay là TBC PASSION, GLORY NAVIGATOR từng là Fortune Island) không lưu; danh mục dùng tên như trên sổ.
6. **Loại máy chính** của cả 9 tàu và **chủ tàu của PACIFIC GRACE** để null; dòng tương ứng trong CV xuất ra sẽ trống.
7. **Vùng hoạt động (Trade Area)** không lưu trong danh mục: đây là thông tin của từng chuyến, người lập nhập khi xuất.

## Nguồn

Số liệu lấy từ kết quả tìm kiếm ngày 08/10/2026 trên các trang sau, chưa ai xác nhận.

- ATAYAL STAR: [maritimeoptima.com](https://maritimeoptima.com/public/vessels/pages/imo:9606962/mmsi:373293000/ATAYAL_STAR.html), [vesselfinder.com](https://www.vesselfinder.com/vessels/details/9606962)
- FRANBO WIND: [shipspotting.com](https://www.shipspotting.com/photos/2223895)
- GEIYO K: [ClassNK Register](https://www.classnk.or.jp/register/regships/one_dsp.aspx?imo=9747613), [vesselfinder.com](https://www.vesselfinder.com/vessels/GEIYO-K-IMO-9747613-MMSI-538006748)
- ASAHI MARU: [ClassNK Register](https://www.classnk.or.jp/register/regships/one_dsp.aspx?imo=9594389), [myshiptracking.com](https://www.myshiptracking.com/vessels/asahi-maru-mmsi-357169000-imo-9594389)
- HTK CONFIDENCE: [ClassNK Register](https://www.classnk.or.jp/register/regships/one_dsp.aspx?imo=9412969), [vesselfinder.com](https://www.vesselfinder.com/vessels/details/9412969)
- HTK DISCOVERY: [magicport.ai](https://magicport.ai/vessels/general-cargo/htk-discovery-mmsi-351752000)
- GLORY NAVIGATOR: [Wikidata](https://www.wikidata.org/wiki/Q83652456), [vesselfinder.com](https://www.vesselfinder.com/vessels/details/9336907)
- PACIFIC GRACE: [atlas.flexport.com](https://atlas.flexport.com/vessel/imo:9154828/mmsi:351513000/name:pacific-grace), [marinetraffic.org](https://marinetraffic.org/ship-owner-manager-ism-data/PACIFIC-GRACE/9154828/351513000)
