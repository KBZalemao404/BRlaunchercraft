; ============================================
;  Custom NSIS Script - Minecraft Launcher
;  Installs server keep-alive service
; ============================================

!macro customInstall
  ; Create keep-alive directory
  CreateDirectory "$APPDATA\minecraft-launcher"
  
  ; Extract and install the keep-alive VBS script
  SetOutPath "$APPDATA\minecraft-launcher"
  File /oname=server-keepalive.vbs "${BUILD_RESOURCES_DIR}\keep-alive\server-keepalive.vbs"
  
  ; Create the scheduled task via schtasks
  nsExec::ExecToLog 'schtasks /create /tn "MinecraftLauncher_KeepAlive" /tr "wscript.exe \"$APPDATA\minecraft-launcher\server-keepalive.vbs\"" /sc onlogon /rl limited /f'
  
  ; Start it immediately
  nsExec::ExecToLog 'schtasks /run /tn "MinecraftLauncher_KeepAlive"'
  
  SetOutPath "$INSTDIR"
!macroend

!macro customUnInstall
  ; Stop and remove the keep-alive task
  nsExec::ExecToLog 'schtasks /end /tn "MinecraftLauncher_KeepAlive"'
  nsExec::ExecToLog 'schtasks /delete /tn "MinecraftLauncher_KeepAlive" /f'
  
  ; Remove the VBS file
  Delete "$APPDATA\minecraft-launcher\server-keepalive.vbs"
  Delete "$APPDATA\minecraft-launcher\keepalive.log"
!macroend
