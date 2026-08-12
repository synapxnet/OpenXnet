; ============================================
; OpenXnet Custom NSIS Installer Enhancement
; Shows installation path + extraction details
; ============================================

; Show the detail log during installation (file-by-file progress)
!macro customHeader
  !system "echo ''"
!macroend

!macro customInit
  ; Older OpenXnet builds may hide to tray instead of closing during updater install.
  ; Kill only the desktop executable here; avoid /T so the updater-spawned installer survives.
  Push $0
  Push $1
  nsExec::ExecToStack 'taskkill /IM OpenXnet.exe /F'
  Pop $0
  Pop $1
  nsExec::ExecToStack `powershell -NoProfile -ExecutionPolicy Bypass -Command "Get-CimInstance Win32_Process | Where-Object { $$_.Name -eq 'server.exe' -and $$_.ExecutablePath -like '*OpenXnet*' } | ForEach-Object { Stop-Process -Id $$_.ProcessId -Force -ErrorAction SilentlyContinue }"`
  Pop $0
  Pop $1
  Sleep 1200
  Pop $1
  Pop $0
!macroend

; Pre-installation: show installation info to user
!macro preInit
  ; Nothing needed here - electron-builder handles directory selection
!macroend

; During installation: show detailed progress
!macro customInstall
  ; Enable showing details
  SetDetailsPrint both

  ; Show installation summary header
  DetailPrint ""
  DetailPrint "======================================================"
  DetailPrint "  OpenXnet v${VERSION}"
  DetailPrint "======================================================"
  DetailPrint "  Note: installer may recalibrate progress while unpacking large components"
  DetailPrint ""
  DetailPrint "  Installation path: $INSTDIR"
  DetailPrint ""
  DetailPrint "  Components being installed:"
  DetailPrint "    [Core]      OpenXnet Desktop Application"
  DetailPrint "    [Engine]    Python AI Server Engine (server.exe)"
  DetailPrint "    [Runtime]   Python 3.12 Runtime Libraries"
  DetailPrint "    [AI]        MiniLM Embedding Model"
  DetailPrint "    [AI]        FAISS Vector Search Engine"
  DetailPrint "    [AI]        ONNX Runtime Inference"
  DetailPrint "    [Media]     FFmpeg Media Processing"
  DetailPrint "    [VRM]       3D Avatar Rendering Engine"
  DetailPrint "    [Plugins]   Extension System & Built-in Plugins"
  DetailPrint "    [Network]   Multi-platform Bot Connectors"
  DetailPrint ""
  DetailPrint "  Estimated disk space: ~950 MB"
  DetailPrint "======================================================"
  DetailPrint ""
!macroend

; Post-installation: show completion message
!macro customInstallMode
  ; Default to current user
!macroend

; Uninstaller customization
!macro customUnInstall
  DetailPrint ""
  DetailPrint "Removing OpenXnet from: $INSTDIR"
  DetailPrint ""
!macroend
