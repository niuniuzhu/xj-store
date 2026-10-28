@echo off
title XJ Store Server
cd /d "%~dp0"

set NODE_BIN=C:\Users\aiden\.workbuddy\binaries\node\versions\22.22.2\node.exe
if not exist "%NODE_BIN%" set NODE_BIN=node

echo.
echo   XJ Store 正在启动，关闭本窗口即停止服务。
echo   站点 http://localhost:%1/
echo.
"%NODE_BIN%" server\pay-server.js %1
pause
