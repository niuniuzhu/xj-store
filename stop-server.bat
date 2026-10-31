@echo off
chcp 65001 >nul
title 停止 XJ Store 服务
cd /d "%~dp0"

set PORT=%1
if "%PORT%"=="" set PORT=8080

echo.
echo   XJ Store 服务停止脚本
echo   目标端口 %PORT%
echo.

rem ---- 1. 先看端口有没有人在监听 ----
netstat -ano | findstr /C:":%PORT% " | findstr /I /C:"LISTENING" >nul
if %errorlevel% NEQ 0 (
  echo   未发现占用 %PORT% 的进程 —— 服务当前未在运行，无需停止。
  echo.
  pause
  exit /b 0
)

rem ---- 2. 列出并终止监听该端口的进程 ----
echo   发现以下进程正在监听 %PORT% ：
echo.

for /f "tokens=5" %%p in ('netstat -ano ^| findstr /C:":%PORT% " ^| findstr /I /C:"LISTENING"') do (
  if "%%p" NEQ "" (
    echo     PID %%p
    taskkill /PID %%p /F
  )
)

rem ---- 3. 确认端口是否已释放 ----
echo.
echo   正在确认 ...
timeout /t 2 /nobreak >nul

netstat -ano | findstr /C:":%PORT% " | findstr /I /C:"LISTENING" >nul
if %errorlevel%==0 (
  echo.
  echo   [注意] %PORT% 端口仍有进程在监听，可能未完全停止。
  echo   可手动检查：netstat -ano ^| findstr ":%PORT%"
) else (
  echo.
  echo   [完成] 服务已停止，端口 %PORT% 已释放。
  echo.
  echo   提醒：本脚本不会移除登录自启。
  echo   下次登录 Windows 时，服务仍会自动启动。
)

echo.
pause
