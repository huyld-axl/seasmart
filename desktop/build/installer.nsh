; Bộ cài Windows: mở cổng 7443 (máy chính, mạng Private) cho máy nhân viên trong văn phòng
; (docs/mcah-ke-hoach-desktop-gd3.md 3.1). Cài theo người dùng nên phải xin quyền quản trị một lần (UAC); từ chối thì
; Windows tự hỏi lúc máy chính mở cổng lần đầu. Gỡ app thì xoá luật.
!macro customInstall
  ExecShell "runas" "netsh" 'advfirewall firewall add rule name="MCAH may chinh" dir=in action=allow protocol=TCP localport=7443 profile=private program="$INSTDIR\MCAH.exe"' SW_HIDE
  ; Người dùng bỏ chọn "Tạo biểu tượng trên Desktop" ở bước Tuỳ chọn: xoá biểu tượng electron-builder vừa tạo.
  ; Cài im lặng / tự cập nhật không qua bước đó (biến rỗng): giữ nguyên như cũ.
  ${if} $mcahDesktopShortcut == "0"
    WinShell::UninstShortcut "$newDesktopLink"
    Delete "$newDesktopLink"
  ${endIf}
!macroend

; Bước "Tuỳ chọn" sau bước chọn thư mục: có tạo biểu tượng trên Desktop không (mặc định có).
; Tự cập nhật (--updated) bỏ qua bước này; biểu tượng giữ như người dùng đã chọn lúc cài.
!macro customPageAfterChangeDir
  Var mcahDesktopShortcut
  Var mcahDesktopCheckbox
  Page custom mcahOptionsShow mcahOptionsLeave

  Function mcahOptionsShow
    ${if} ${isUpdated}
      Abort
    ${endIf}
    !insertmacro MUI_HEADER_TEXT "Tuỳ chọn" "Chọn cách mở MCAH sau khi cài."
    nsDialogs::Create 1018
    Pop $0
    ${NSD_CreateLabel} 0 0 100% 24u "Biểu tượng giúp mở MCAH nhanh từ màn hình chính. Luôn có MCAH trong menu Start."
    Pop $0
    ${NSD_CreateCheckbox} 0 32u 100% 12u "Tạo biểu tượng MCAH trên màn hình Desktop"
    Pop $mcahDesktopCheckbox
    ${if} $mcahDesktopShortcut != "0"
      ${NSD_Check} $mcahDesktopCheckbox
    ${endIf}
    nsDialogs::Show
  FunctionEnd

  Function mcahOptionsLeave
    ${NSD_GetState} $mcahDesktopCheckbox $0
    ${if} $0 == ${BST_CHECKED}
      StrCpy $mcahDesktopShortcut "1"
    ${else}
      StrCpy $mcahDesktopShortcut "0"
    ${endIf}
  FunctionEnd
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
