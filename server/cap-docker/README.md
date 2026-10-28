# XJ Store · Cap 人机验证（真实实例）部署说明

Cap 是 trycap.dev 的自托管 CAPTCHA：用户点一个复选框，浏览器静默完成工作量证明，
数据不出你的服务器。本项目已内置前端组件（`assets/cap.js`）与后端守卫（登录 / 支付 / 会员购买三处），
**默认关闭**，本目录提供把真实 Cap 实例跑起来的最小配置。

> ⚠️ 验证代码一直都在，只是 `server/config.json` 的 `capEnabled` 默认为 `false`，
> 且本机需先有 Cap 实例才会渲染验证框。以下步骤就是把它真正跑起来。

## 一、前置条件（在你本机真实 Windows 上，不是 WorkBuddy 沙箱）

1. 安装 **Docker Desktop**：https://docs.docker.com/get-docker/
   - 安装时勾选 WSL 2 后端；首次启动会提示开启 WSL / 虚拟化（BIOS 里开 VT-x/AMD-V）。
   - 安装完需要管理员权限、可能重启一次。
2. 确认 `docker --version` 与 `docker compose version` 可用。

> 当前 WorkBuddy 沙箱里 `docker` 缺失、`wsl`/`net` 等系统工具被安全策略禁用，
> 因此**无法在会话内自动安装/启动**。请在你的本机终端完成本目录的 `docker compose` 步骤。

## 二、启动 Cap 实例

```powershell
# 进入本目录
cd D:\Projects\xj store\server\cap-docker

# 1) 复制环境变量模板
Copy-Item .env.example .env
# 用编辑器打开 .env，把 CAP_ADMIN_KEY 改成一段 ≥32 位的随机串

# 2) 拉起（cap + valkey 两个容器）
docker compose up -d

# 3) 看日志确认健康
docker compose logs -f cap
```

启动后访问 `http://localhost:3000` → 用 `CAP_ADMIN_KEY` 登录控制台 →
「创建站点密钥」→ 得到 **站点密钥 site key** 和 **秘密密钥 secret key**（保存好）。

> 站点 secret key ≠ ADMIN_KEY，混淆是最常见配置错误。

## 三、对接 XJ Store

编辑 `server/config.json`，把 Cap 段改成：

```json
"_note_cap": "Cap 人机验证：capEnabled=true 时登录与支付确认需先过质询",
"capEnabled": true,
"capInstance": "http://localhost:3000",   // 本机联调用 localhost；生产必须填浏览器可访问的公开 HTTPS 域名
"capSiteKey": "<控制台拿到的 site key>",
"capSecretKey": "<控制台拿到的 secret key>"
```

然后**重启 XJ Store 服务**（端口 8080）。登录页、结算页、会员购买页会自动出现验证框。
点了复选框出对勾后，提交请求会带上 `capToken`，后端向
`{capInstance}/{capSiteKey}/siteverify` 发 `{secret, response}` 校验 `success`。

## 四、一键自检（验证链路通不通）

拿到一个令牌后：

```powershell
# 先在前端点验证框解出 token（开发者工具控制台看 cap.token()）
# 然后：
curl.exe "http://localhost:3000/<site-key>/siteverify" `
  -X POST -H "Content-Type: application/json" `
  -d "{ \"secret\": \"<secret-key>\", \"response\": \"<token>\" }"
# 第一次应返回 { "success": true }；同一 token 再发一次应失败（一次性）
```

## 五、关闭 / 回退

把 `capEnabled` 改回 `false` 并重启服务即可完全关闭验证（本地开发无感）。
停掉实例：`docker compose down`（数据在 `valkey-data` 卷里保留）。

## 六、生产部署要点

- `capInstance` 必须是访客浏览器能访问的公开地址（如 `https://cap.xjstore.com`），
  用 Nginx/Caddy 反代 3000 端口并配 HTTPS；**不能用 localhost**。
- 高安全场景可自托管 `cap-widget` 脚本（`cdn.jsdelivr.net/npm/cap-widget`）而非走 CDN，
  改 `assets/cap.js` 第 11 行的 `SCRIPT_SRC` 即可。
- `capSecretKey` 是敏感凭证，勿入库 / 勿泄露。
