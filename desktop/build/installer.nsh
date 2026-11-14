; Bộ cài Windows: mở cổng 7443 (máy chính, mạng Private) cho máy nhân viên trong văn phòng
; (docs/mcah-ke-hoach-desktop-gd3.md 3.1). Cài theo người dùng nên phải xin quyền quản trị một lần (UAC); từ chối thì
; Windows tự hỏi lúc máy chính mở cổng lần đầu. Gỡ app thì xoá luật.
!macro customInstall
  ExecShell "runas" "netsh" 'advfirewall firewall add rule name="MCAH may chinh" dir=in action=allow protocol=TCP localport=7443 profile=private program="$INSTDIR\MCAH.exe"' SW_HIDE
!macroend

!macro customUnInstall
  ExecShell "runas" "netsh" 'advfirewall firewall delete rule name="MCAH may chinh"' SW_HIDE
  ; Gỡ bằng tay (không phải bộ cài bản mới gỡ bản cũ, không chạy im lặng): hỏi có xoá dữ liệu không, mặc định GIỮ.
  ; Đồng ý thì hỏi lại lần hai (docs/mcah-ke-hoach-desktop-gd6.md 3.6, wireframe màn 4).
  ${ifNot} ${isUpdated}
    IfSilent mcah_keep_data
    MessageBox MB_YESNO|MB_ICONQUESTION|MB_DEFBUTTON2 "Xoá cả dữ liệu MCAH trên máy này?$\r$\n$\r$\nCơ sở dữ liệu và thư mục hồ sơ (Tài liệu\MCAH - Hồ sơ). Chọn Không để giữ lại, cài lại là dùng tiếp." IDNO mcah_keep_data
    MessageBox MB_YESNO|MB_ICONEXCLAMATION|MB_DEFBUTTON2 "Xoá vĩnh viễn dữ liệu của văn phòng trên máy này? Không lấy lại được." IDNO mcah_keep_data
    RMDir /r "$APPDATA\MCAH"
    RMDir /r "$DOCUMENTS\MCAH - Hồ sơ"
    mcah_keep_data:
  ${endIf}
!macroend
