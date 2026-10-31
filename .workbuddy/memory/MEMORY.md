# XJ Store 项目长期记忆

## 启动与存活检查
- 入口 `server/pay-server.js`（零依赖单文件，6 层：配置/存储/领域/HTTP/路由/启动），默认端口 **8080**（`process.argv[2]` 或 `PORT` 覆盖）。
  启动：`cd "D:/Projects/xj store" && node server/pay-server.js [端口]`；成功标志终端打印 `XJ Store 服务已启动`。
- 判断存活**先看端口再打接口**：`netstat -ano | grep ":8080"`(LISTENING 即活) + `curl -s -o /dev/null -w "%{http_code}" http://localhost:8080/api/products`(200=活)。
  ⚠️ `curl -o /dev/null` 在本环境退出码恒为 23（写入错误），**只看 HTTP 状态码，别看 curl 退出码**。
- **可靠启动（run_in_background 的 bash 任务会随外壳回收假死）**：用 PowerShell `Start-Process` 把 node 放进独立进程树：
  `$node="C:\Users\aiden\.workbuddy\binaries\node\versions\22.22.2\node.exe"; $s="D:\Projects\xj store\server\pay-server.js"; Start-Process -FilePath $node -ArgumentList "`"$s`" 8080" -WorkingDirectory "D:\Projects\xj store" -WindowStyle Hidden`
  ⚠️ `-ArgumentList` 不会自动给带空格参数加引号，`D:\Projects\xj store` 会被拆成 `D:\Projects\xj` 导致 MODULE_NOT_FOUND，必须 `"`"$s`"` 整体转义。
  ⚠️ 某些会话 `-RedirectStandardOutput/-RedirectStandardError` 报「字典中已添加关键字 Path」致起不来，去掉这两个参数即可。

## Git 与远端
- 远端 **https://github.com/niuniuzhu/xj-store**，分支 `main`；提交身份 `星际Stellar <niuniuzhu@users.noreply.github.com>`（仓库级）。
- `.gitignore`：`server/config.json`、`server/data/`、`server/keys/`、`.env`、以及 `server/*.log`、`server/*.bak.*`、`ab_out.txt`。
- ⚠️ 本环境 **不要用 rebase**（`--root` 那次直接把 `.git` 弄没了）；要接历史就 `git checkout -b main FETCH_HEAD` 后重新 add/commit。
- ⚠️ GCM（credential.helper=helper-selector/manager）在本机段错误，浏览器 OAuth 不可用；已把本仓库 `credential.helper` 设为 **wincred**，凭据已存在 Windows 凭据管理器，push 直接可用。
- 沙箱内 `git fetch` 偶发写不进 `refs/remotes/origin/*`（status 显示 `[gone]`）→ 显式 `git fetch origin "+refs/heads/main:refs/remotes/origin/main"`。

## 常驻自启（已生效）
- 启动文件夹 `XJ Store Server.vbs`：登录时探测 8080，未起则静默拉起；由它起的实例**不依附会话**，跨天存活。睡眠唤醒/锁屏解锁不触发（需真登录）。
- `schtasks`/`cscript`/`wscript` 被安全策略禁用，崩溃自愈/定时保活做不了，需用户在安全中心放开策略。

## 主题/多语言/质感
- `documentElement` 叠加 `data-theme`(浅/深) + **风格三态**（普通/玻璃/ore ui，默认玻璃）：
  - `html.ore-mode`（ore ui）/`html.glass-mode`（玻璃）/ 都不加（普通）。状态存 `localStorage['xj_style']`（'normal'|'glass'|'ore'），**兼容旧 `xj_glass` 值**。
  - 顶栏「风格」菜单（`#styleSw`/`#styleToggle`/`#styleMenu`，复用 `lang-sw`/`lang-menu`/`lang-item` 样式）三选一；JS：`applyStyle(mode,animate)`、`bindStyleSwitcher()`、`XJ.setStyle/styleMode`。
  - ore ui 观感：不透明表面 + 对角金属高光 + 棱角化（`--radius` 降至 8px）+ **琥珀/矿金主色**（`--primary` 覆盖为 `#c8870f`）——与玻璃(通透模糊)、普通(扁平蓝)明显区分。规则在 `base.css` 的 `ore-mode` 块。
  - 旧 `applyGlass`/`setGlass`/`glassOn` 已作为别名指向 `applyStyle`，保留向后兼容。
- 多语言：`I18N` 以中文原文为键（`base.js`），`translateStatic` 自动翻译静态正文，动态用 `XJ.tr()`，结构化数据用 `XJ.loc()`；API 挂 `window.XJ`。

## 支付配置与签名铁律（易支付/虹灵）
- 配置统一在 `server/config.json`（扁平 `honglingPay*`：MerchantId/ApiKey/SignType/CreateUrl/QueryUrl/NotifyUrl/ReturnUrl + `payType`）。`.env` 只留 `XJ_PAY_MOCK`，**改密钥直接改 config.json**（旧「必须改 .env」已作废）。
- 当前真实商户：网关 `https://dash.bxyvps.cn`、PID `348884`、MD5 加签、密钥见 config.json（勿外泄/入库）。
- **签名铁律**：易支付签名串用**原始值**拼接（`k=原始值&...` 排序后 `+key` 再 md5），**绝不逐个值 URL 编码**（之前 phpUrlencode 误伤中文/空格验签）。URL 编码只在传输阶段。
- 网关调试：裸 curl 得 500，**必须带浏览器 UA+Referer**；「签名计算失败」**无法区分 key 对错**；302 跳转=验签通过，500=重复 `out_trade_no`/限流。
- `server/data/*.json` 读写即改文件，服务自带 `.bak.<时间戳>`；`server/config.json` 的 `mock:true` 为本地演练，不调真实网关。

## XJ AI 智能助手
- 入口顶栏 `XJ AI`(ai.html)；密钥仅服务端（`config.json` aiApiKey，env `XJ_AI_*` 可覆盖），前端走 `/api/ai/chat`。上游 OpenAI 兼容 `https://ai.tdgzs.top/v1`。
- 默认模型 `gpt-6.1-sol`（gpt-5.5/5.6 实测 503/502）；白名单固定 7 个；`/api/admin/state` 脱敏、后台留空即不改写。
- **仅 VIP 及以上可用**（服务端 `aiAuthGate`，`aiMinLevel` 默认 vip）；最高权限位 `ai_admin` 解锁 `/api/ai/insights`。
- ⚠️ `server/data/admin.json` 改动**必须重启服务**才生效（ADMIN 启动时加载）；改前先备份，`sha256` 不可逆。管理员口令现为 `19860107Jw`（用户 `星际Stellar`）。

## 会员等级购买
- 入口：账号中心「升级会员」(自助走真实网关) + 账号管理(管理员手动/改价上下架)。配置 `config.json` 的 `memberPlans`（9 档 LVIP/VIP/SVIP × 月/季/年）。
- 端点：`GET /api/member/plans` 公开；`POST /api/member/order`(uid+token，服务端定价) 生成 `kind:'member'`；`/api/admin/member/plans` 读写；`/api/admin/member/grant` 后台开通。
- 等级序 none0<lvip1<vip2<svip3；升级才换级、买低档不降级，限时会员到期自动回落 none；`markPaid` 对 member 幂等(`memberGranted`)。
- ⚠️ 回归测试每跑一次消耗 id=1 商品 1 规格库存 2 件，耗尽需手动把 `products.json` 该 `specs[0].stock` 改回 2（非代码缺陷）。

## Cap 人机验证（trycap.dev 自托管 CAPTCHA）
- 用途：**登录确认**(`/api/account/login`) + **支付确认**(`/api/order` POST、会员 `/api/member/order` POST)。
- 后端：`reloadConfig()` 读 `capEnabled/capInstance/capSiteKey/capSecretKey`→`CFG.cap`；`verifyCap(body)` 在 capEnabled 时 POST `<instance>/<siteKey>/siteverify` 校验 `success`(8s 超时)，无效返回 403；公开 `GET /api/cap/config` 下发 `{enabled,instance,siteKey}`（不下发 secretKey）。
- 前端：`assets/cap.js` 的 `CapGuard.mount(el,onSolve)` 仅 enabled 时动态加载 `cap-widget` CDN 并渲染，解出令牌回调，`rerender()` 用于提交失败后重新验证。`login.html`/`checkout.html`/`account-center.html` 各自挂载，提交校验 `cap.enabled && !cap.token()` 并随请求体带 `capToken`。mount 调用包 `if (window.CapGuard)` 防御。
- **`capEnabled` 默认 false**（未部署 Cap 时本地开发无感）；启用需 `docker compose up` 起 Cap Standalone(含 valkey)，控制台建站点密钥填 instance(浏览器可访问的公开 URL)/siteKey/secretKey。
- 回归：`bash server/run-regression.sh`（断言 90 项）；改 admin.json 口令需先备份再改。

## 回归与测试
- `bash server/run-regression.sh` 自动临时改密→重启→测→还原→重启，断言 90 项（登录后须用最新 token）。
- `node server/member-test.js` 36 项会员用例。
