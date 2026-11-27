; Bộ cài Windows: mở cổng 7443 (máy chính, mạng Private) cho máy nhân viên trong văn phòng
; (docs/catoro-ke-hoach-desktop-gd3.md 3.1). Cài theo người dùng nên phải xin quyền quản trị một lần (UAC); từ chối thì
; Windows tự hỏi lúc máy chính mở cổng lần đầu. Gỡ app thì xoá luật.
; Từ 0.9.14 (đổi tên MCAH → Catoro, docs/catoro-ke-hoach-doi-ten.md 3.4): xoá luật cũ "MCAH may chinh" (trỏ MCAH.exe) rồi thêm
; luật mới trong cùng một lần xin quyền.
!macro customInstall
  ExecShell "runas" "cmd.exe" '/c netsh advfirewall firewall delete rule name="MCAH may chinh" & netsh advfirewall firewall add rule name="Catoro may chinh" dir=in action=allow protocol=TCP localport=7443 profile=private program="$INSTDIR\Catoro.exe"' SW_HIDE
  ; Người dùng bỏ chọn "Tạo biểu tượng trên Desktop" ở bước Tuỳ chọn: xoá biểu tượng electron-builder vừa tạo.
  ; Cài im lặng / tự cập nhật không qua bước đó (biến rỗng): giữ nguyên như cũ.
  ${if} $catoroDesktopShortcut == "0"
    WinShell::UninstShortcut "$newDesktopLink"
    Delete "$newDesktopLink"
  ${endIf}
!macroend

; Bước "Tuỳ chọn" sau bước chọn thư mục: có tạo biểu tượng trên Desktop không (mặc định có).
; Tự cập nhật (--updated) bỏ qua bước này; biểu tượng giữ như người dùng đã chọn lúc cài.
!macro customPageAfterChangeDir
  Var catoroDesktopShortcut
  Var catoroDesktopCheckbox
  Page custom catoroOptionsShow catoroOptionsLeave

  Function catoroOptionsShow
    ${if} ${isUpdated}
      Abort
    ${endIf}
    !insertmacro MUI_HEADER_TEXT "Tuỳ chọn" "Chọn cách mở Catoro sau khi cài."
    nsDialogs::Create 1018
    Pop $0
    ${NSD_CreateLabel} 0 0 100% 24u "Biểu tượng giúp mở Catoro nhanh từ màn hình chính. Luôn có Catoro trong menu Start."
    Pop $0
    ${NSD_CreateCheckbox} 0 32u 100% 12u "Tạo biểu tượng Catoro trên màn hình Desktop"
    Pop $catoroDesktopCheckbox
    ${if} $catoroDesktopShortcut != "0"
      ${NSD_Check} $catoroDesktopCheckbox
    ${endIf}
    nsDialogs::Show
  FunctionEnd

  Function catoroOptionsLeave
    ${NSD_GetState} $catoroDesktopCheckbox $0
    ${if} $0 == ${BST_CHECKED}
      StrCpy $catoroDesktopShortcut "1"
    ${else}
      StrCpy $catoroDesktopShortcut "0"
    ${endIf}
  FunctionEnd
!macroend

!macro customUnInstall
  ExecShell "runas" "cmd.exe" '/c netsh advfirewall firewall delete rule name="Catoro may chinh" & netsh advfirewall firewall delete rule name="MCAH may chinh"' SW_HIDE
  ; Gỡ bằng tay (không phải bộ cài bản mới gỡ bản cũ, không chạy im lặng): hỏi có xoá dữ liệu không, mặc định GIỮ.
  ; Đồng ý thì hỏi lại lần hai (docs/catoro-ke-hoach-desktop-gd6.md 3.6, wireframe màn 4).
  ${ifNot} ${isUpdated}
    IfSilent catoro_keep_data
    MessageBox MB_YESNO|MB_ICONQUESTION|MB_DEFBUTTON2 "Xoá cả dữ liệu Catoro trên máy này?$\r$\n$\r$\nCơ sở dữ liệu và thư mục hồ sơ (trong Tài liệu). Chọn Không để giữ lại, cài lại là dùng tiếp." IDNO catoro_keep_data
    MessageBox MB_YESNO|MB_ICONEXCLAMATION|MB_DEFBUTTON2 "Xoá vĩnh viễn dữ liệu của văn phòng trên máy này? Không lấy lại được." IDNO catoro_keep_data
    ; Thư mục dữ liệu vẫn tên MCAH (app.setName giữ tên cũ để không mất dữ liệu). Thư mục hồ sơ: tên mới cho máy cài từ 0.9.14,
    ; tên cũ cho máy cài từ trước.
    RMDir /r "$APPDATA\MCAH"
    RMDir /r "$DOCUMENTS\Catoro - Hồ sơ"
    RMDir /r "$DOCUMENTS\MCAH - Hồ sơ"
    catoro_keep_data:
  ${endIf}
!macroend
