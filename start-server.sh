#!/usr/bin/env bash
# XJ Store 启动脚本（bash 等效版）
# 用法: ./start-server.sh [端口]   默认端口 8080
# 前台运行：保持本终端开启即保持服务，Ctrl+C 或关闭终端即停止服务。

# 切换到脚本所在目录（项目根目录）
cd "$(dirname "$0")" || exit 1

PORT="${1:-8080}"

# 优先使用托管 node；不存在则回退到 PATH 中的 node
NODE_BIN="/c/Users/aiden/.workbuddy/binaries/node/versions/22.22.2/node.exe"
if [ ! -x "$NODE_BIN" ]; then
  NODE_BIN="node"
fi

echo ""
echo "  正在检查 ${PORT} 端口 ..."

# 端口已被监听 -> 视为已在运行，跳过
if netstat -ano 2>/dev/null | grep ":${PORT} " | grep -i LISTENING >/dev/null; then
  echo ""
  echo "  [跳过] ${PORT} 端口已被占用，服务很可能已在运行。"
  echo "  如需重启，请先停止原有服务，再重新运行本脚本。"
  echo ""
  echo "  站点  http://localhost:${PORT}/"
  echo "  后台  http://localhost:${PORT}/admin.html"
  echo ""
  echo "  直接访问即可；本终端可关闭。"
  echo ""
  exit 0
fi

echo "  端口空闲，正在启动 ..."
echo ""
echo "  站点  http://localhost:${PORT}/"
echo "  后台  http://localhost:${PORT}/admin.html"
echo ""
echo "  保持本终端开启即保持服务；关闭终端 / Ctrl+C 即停止服务。"
echo ""

"$NODE_BIN" server/pay-server.js "$PORT"

echo ""
echo "  服务已停止。"
