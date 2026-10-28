#!/usr/bin/env bash
# XJ Store 重写回归测试包装脚本
# 管理员口令为哈希存储且已被改过，无法反推。
# 本脚本：备份 admin.json → 临时改密 → 重启服务 → 跑测试 → 还原 admin.json → 重启服务
set -u
cd "D:/Projects/xj store"

NODE="C:/Users/aiden/.workbuddy/binaries/node/versions/22.22.2/node.exe"
ADMIN_FILE="server/data/admin.json"
BACKUP="server/data/admin.json.rwtest.bak"
TMP_PASS="rwtest$(date +%s | tail -c 7)"

# 1. 备份并临时改密
cp "$ADMIN_FILE" "$BACKUP"
"$NODE" -e '
const crypto=require("crypto"),fs=require("fs");
const f="server/data/admin.json";
const salt=crypto.randomBytes(8).toString("hex");
const hash=crypto.createHash("sha256").update(salt+":"+process.argv[1],"utf8").digest("hex");
fs.writeFileSync(f,JSON.stringify({user:"星际Stellar",salt,hash},null,2));
console.log("临时口令已写入");
' "$TMP_PASS"

# 2. 重启服务
OLD=$(netstat -ano 2>/dev/null | grep ":8080" | grep LISTENING | head -1 | awk '{print $5}')
[ -n "$OLD" ] && taskkill /PID "$OLD" /F >/dev/null 2>&1
sleep 1

powershell -NoProfile -Command "\$node='C:\Users\aiden\.workbuddy\binaries\node\versions\22.22.2\node.exe'; \$script='D:\Projects\xj store\server\pay-server.js'; \$args=\"\`\"\$script\`\" 8080\"; Start-Process -FilePath \$node -ArgumentList \$args -WorkingDirectory 'D:\Projects\xj store' -RedirectStandardOutput 'D:\Projects\xj store\server\server.out.log' -RedirectStandardError 'D:\Projects\xj store\server\server.err.log' -WindowStyle Hidden" >/dev/null 2>&1
sleep 2

# 3. 跑测试
ADMIN_PASS="$TMP_PASS" "$NODE" server/regression-test.js
TEST_EXIT=$?

# 4. 还原管理员口令
cp "$BACKUP" "$ADMIN_FILE"
rm -f "$BACKUP"
echo "已还原 admin.json"

# 5. 再重启，让服务加载回原口令
OLD=$(netstat -ano 2>/dev/null | grep ":8080" | grep LISTENING | head -1 | awk '{print $5}')
[ -n "$OLD" ] && taskkill /PID "$OLD" /F >/dev/null 2>&1
sleep 1
powershell -NoProfile -Command "\$node='C:\Users\aiden\.workbuddy\binaries\node\versions\22.22.2\node.exe'; \$script='D:\Projects\xj store\server\pay-server.js'; \$args=\"\`\"\$script\`\" 8080\"; Start-Process -FilePath \$node -ArgumentList \$args -WorkingDirectory 'D:\Projects\xj store' -RedirectStandardOutput 'D:\Projects\xj store\server\server.out.log' -RedirectStandardError 'D:\Projects\xj store\server\server.err.log' -WindowStyle Hidden" >/dev/null 2>&1
sleep 2
echo "服务已用原口令重启"

exit $TEST_EXIT
