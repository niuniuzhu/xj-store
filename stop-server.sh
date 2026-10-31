#!/usr/bin/env bash
# XJ Store 停止脚本（bash 等效版）
# 用法: ./stop-server.sh [端口]   默认端口 8080
# 按端口找到监听进程并强制终止，随后复查端口是否释放。

# 切换到脚本所在目录（项目根目录）
cd "$(dirname "$0")" || exit 1

PORT="${1:-8080}"

echo ""
echo "  XJ Store 服务停止脚本"
echo "  目标端口 ${PORT}"
echo ""

# 端口无人监听 -> 无需停止
if ! netstat -ano 2>/dev/null | grep ":${PORT} " | grep -i LISTENING >/dev/null; then
  echo "  未发现占用 ${PORT} 的进程 —— 服务当前未在运行，无需停止。"
  echo ""
  exit 0
fi

echo "  发现以下进程正在监听 ${PORT}："
echo ""

# 取监听进程的 PID（netstat -ano 第 5 列为 PID），去重后逐个终止
PIDS=$(netstat -ano 2>/dev/null | grep ":${PORT} " | grep -i LISTENING | awk '{print $5}' | sort -u)
for pid in $PIDS; do
  if [ -n "$pid" ]; then
    echo "    PID ${pid}"
    taskkill /PID "${pid}" /F 2>&1 | head -2
  fi
done

echo ""
echo "  正在确认 ..."
sleep 2

# 复查端口是否已释放
if netstat -ano 2>/dev/null | grep ":${PORT} " | grep -i LISTENING >/dev/null; then
  echo ""
  echo "  [注意] ${PORT} 端口仍有进程在监听，可能未完全停止。"
  echo "  可手动检查：netstat -ano | grep \":${PORT} \""
else
  echo ""
  echo "  [完成] 服务已停止，端口 ${PORT} 已释放。"
  echo ""
  echo "  提醒：本脚本不会移除登录自启。"
  echo "  下次登录 Windows 时，服务仍会自动启动。"
fi

echo ""
