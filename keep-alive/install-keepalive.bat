@echo off
REM ============================================
REM  Minecraft Launcher - Server Keep-Alive Setup
REM  Creates a Windows Task Scheduler task that
REM  pings the update server every 60 seconds
REM  to keep the Vercel server alive.
REM ============================================

setlocal enabledelayedexpansion

set INSTALL_DIR=%~dp0
set VBS_SRC=%INSTALL_DIR%server-keepalive.vbs
set VBS_DST=%APPDATA%\minecraft-launcher\server-keepalive.vbs

echo [Keep-Alive] Setting up server keep-alive service...

REM Create target directory
if not exist "%APPDATA%\minecraft-launcher" mkdir "%APPDATA%\minecraft-launcher"

REM Copy VBS script
if exist "%VBS_SRC%" (
    copy /Y "%VBS_SRC%" "%VBS_DST%" >nul 2>&1
    echo [Keep-Alive] Script installed to %VBS_DST%
) else (
    echo [Keep-Alive] Warning: VBS source not found at %VBS_SRC%
    goto :try_direct
)

REM Create Task Scheduler task
echo [Keep-Alive] Registering Windows Task...
schtasks /create /tn "MinecraftLauncher_KeepAlive" /tr "wscript.exe \"%VBS_DST%\"" /sc onlogon /rl limited /f >nul 2>&1

if %errorlevel% equ 0 (
    echo [Keep-Alive] Task registered successfully
    REM Start the task immediately
    schtasks /run /tn "MinecraftLauncher_KeepAlive" >nul 2>&1
    echo [Keep-Alive] Service started
    goto :end
)

:try_direct
REM Fallback: create a scheduled task using PowerShell
echo [Keep-Alive] Trying PowerShell method...
powershell -WindowStyle Hidden -Command "$action = New-ScheduledTaskAction -Execute 'wscript.exe' -Argument '\"%VBS_DST%\"'; $trigger = New-ScheduledTaskTrigger -AtLogOn; Register-ScheduledTask -TaskName 'MinecraftLauncher_KeepAlive' -Action $action -Trigger $trigger -Description 'Minecraft Launcher Server Keep-Alive' -RunLevel Limited -Force" >nul 2>&1

if %errorlevel% equ 0 (
    echo [Keep-Alive] Task registered via PowerShell
    start "" wscript.exe "%VBS_DST%" >nul 2>&1
    echo [Keep-Alive] Service started
) else (
    echo [Keep-Alive] Could not register task. Starting manually...
    start "" wscript.exe "%VBS_DST%" >nul 2>&1
)

:end
echo [Keep-Alive] Setup complete
echo.
echo The server keep-alive service will run automatically
echo every time you log into Windows.
echo.
echo To stop: schtasks /end /tn "MinecraftLauncher_KeepAlive"
echo To remove: schtasks /delete /tn "MinecraftLauncher_KeepAlive" /f
echo.
