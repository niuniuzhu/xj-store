@echo off
chcp 65001 >nul
title XJ Store Server
cd /d "%~dp0"

set PORT=%1
if "%PORT%"=="" set PORT=8080

set NODE_BIN=C:\Users\aiden\.workbuddy\binaries\node\versions\22.22.2\node.exe
if not exist "%NODE_BIN%" set NODE_BIN=node

echo.
echo   正在检查 %PORT% 端口 ...

netstat -ano | findstr /C:":%PORT% " | findstr /I /C:"LISTENING" >nul
if %errorlevel%==0 (
  echo.
  echo   [跳过] %PORT% 端口已被占用，服务很可能已在运行。
  echo   如需重启，请先关闭原有服务窗口，再重新双击本脚本。
  echo.
  echo   站点  http://localhost:%PORT%/
  echo   后台  http://localhost:%PORT%/admin.html
  echo.
  echo   直接访问即可；本窗口可关闭。
  echo.
  pause
  exit /b 0
)

echo   端口空闲，正在启动 ...
echo.
echo   站点  http://localhost:%PORT%/
echo   后台  http://localhost:%PORT%/admin.html
echo.
echo   保持本窗口开启即保持服务；关闭本窗口即停止服务。
echo.

"%NODE_BIN%" server\pay-server.js %PORT%

echo.
echo   服务已停止。
pause
