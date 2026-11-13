; Bộ cài Windows: mở cổng 7443 (máy chính, mạng Private) cho máy nhân viên trong văn phòng
; (docs/mcah-ke-hoach-desktop-gd3.md 3.1). Cài theo người dùng nên phải xin quyền quản trị một lần (UAC); từ chối thì
; Windows tự hỏi lúc máy chính mở cổng lần đầu. Gỡ app thì xoá luật.
!macro customInstall
  ExecShell "runas" "netsh" 'advfirewall firewall add rule name="MCAH may chinh" dir=in action=allow protocol=TCP localport=7443 profile=private program="$INSTDIR\MCAH.exe"' SW_HIDE
!macroend

!macro customUnInstall
  ExecShell "runas" "netsh" 'advfirewall firewall delete rule name="MCAH may chinh"' SW_HIDE
!macroend
