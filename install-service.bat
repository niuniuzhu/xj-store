@echo off
chcp 65001 >nul
REM =====================================================================
REM  XJ Store 后台服务安装器
REM  必须以「管理员身份」运行（右键 -> 以管理员身份运行）
REM  作用：用 nssm 把 Node 服务注册为 Windows 服务，
REM        开机自启 + 崩溃自动重启 + 无控制台窗口
REM =====================================================================
setlocal

REM ---- 路径配置（按实际环境修改）---------------------------------------
set "NODE=C:\Users\aiden\.workbuddy\binaries\node\versions\22.22.2\node.exe"
set "ROOT=D:\Projects\xj store"
set "SCRIPT=%ROOT%\server\pay-server.js"
set "NSSM=%ROOT%\server\nssm.exe"
set "SERVICE=XJStore"
set "PORT=8080"

REM ---- 若已安装则先停止/移除，避免重复 ----------------------------------
%NSSM% stop %SERVICE% >nul 2>&1
%NSSM% remove %SERVICE% confirm >nul 2>&1
sc stop %SERVICE% >nul 2>&1
sc delete %SERVICE% >nul 2>&1

REM ---- 获取 nssm（本地没有就下载并解压）-------------------------------
if not exist "%NSSM%" (
  echo [1/3] 未找到 nssm，正在下载...
  powershell -NoProfile -Command "Invoke-WebRequest -Uri 'https://nssm.cc/release/nssm-2.24.zip' -OutFile '%ROOT%\server\nssm.zip'"
  powershell -NoProfile -Command "Expand-Archive -Path '%ROOT%\server\nssm.zip' -DestinationPath '%ROOT%\server\nssm-tmp' -Force"
  copy /Y "%ROOT%\server\nssm-tmp\nssm-2.24\win64\nssm.exe" "%NSSM%" >nul
  if not exist "%NSSM%" (
    echo 下载/解压 nssm 失败，请手动把 nssm.exe 放到 %NSSM% 后重试。
    pause
    exit /b 1
  )
)

REM ---- 注册服务 --------------------------------------------------------
echo [2/3] 注册 Windows 服务 %SERVICE% ...
"%NSSM%" install %SERVICE% "%NODE%" "%SCRIPT% %PORT%"
"%NSSM%" set %SERVICE% AppDirectory "%ROOT%"
"%NSSM%" set %SERVICE% DisplayName "XJ Store 服务"
"%NSSM%" set %SERVICE% Description "XJ Store 商城与支付服务（开机自启，崩溃自动重启）"
"%NSSM%" set %SERVICE% Start SERVICE_AUTO_START
"%NSSM%" set %SERVICE% AppExit Default Restart
"%NSSM%" set %SERVICE% AppRestartDelay 2000
"%NSSM%" set %SERVICE% AppStdout "%ROOT%\server\service-out.log"
"%NSSM%" set %SERVICE% AppStderr "%ROOT%\server\service-err.log"

REM ---- 启动 ------------------------------------------------------------
echo [3/3] 启动服务...
"%NSSM%" start %SERVICE%
timeout /t 2 >nul
sc query %SERVICE% | findstr STATE
echo.
echo 完成。可用以下命令管理：
echo   启动:  nssm start %SERVICE%      停止: nssm stop %SERVICE%
echo   卸载:  nssm remove %SERVICE% confirm
echo   日志:  %ROOT%\server\service-out.log
pause
