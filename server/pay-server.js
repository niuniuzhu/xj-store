/* ============================================================
   XJ Store · 本地服务
   静态托管 + 支付接口 + 商品接口 + 会员/折扣 + 后台管理接口

   设计约定
   - 零依赖：只用 Node 内置模块，单文件即可运行
   - 分层：配置层 → 存储层 → 领域层（签名/计价/卡密/票据）→ 路由层
   - 计价权威：订单金额一律由服务端按商品/规格价重算，不信任前端
   - 鉴权：会员接口校验 token（而非仅凭 uid）；后台接口校验管理员 token
   - 密钥：仅存服务端，接口只回报「是否已配置」，绝不下发明文

   启动： node server/pay-server.js [端口]
   ============================================================ */
'use strict';

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { URL } = require('url');

const ROOT = path.resolve(__dirname, '..');
const DATA_DIR = path.join(__dirname, 'data');
const CONFIG_FILE = path.join(__dirname, 'config.json');

/* 会员套餐默认配置
   后台可在「账号管理」页改价 / 上下架，改动写入 server/config.json 的 memberPlans。
   字段：id(唯一) / level(lvip|vip|svip) / name(展示名) / days(有效天数) / price(原价元) / active(上下架) */
const DEFAULT_MEMBER_PLANS = [
  { id: 'lvip-30',  level: 'lvip', name: 'LVIP 月卡', days: 30,  price: 19,  active: true, desc: 'LVIP 权益 30 天，全场 7 折' },
  { id: 'lvip-90',  level: 'lvip', name: 'LVIP 季卡', days: 90,  price: 49,  active: true, desc: 'LVIP 权益 90 天，全场 7 折' },
  { id: 'lvip-365', level: 'lvip', name: 'LVIP 年卡', days: 365, price: 169, active: true, desc: 'LVIP 权益 365 天，全场 7 折' },
  { id: 'vip-30',   level: 'vip',  name: 'VIP 月卡',  days: 30,  price: 39,  active: true, desc: 'VIP 权益 30 天，全场 4.5 折' },
  { id: 'vip-90',   level: 'vip',  name: 'VIP 季卡',  days: 90,  price: 99,  active: true, desc: 'VIP 权益 90 天，全场 4.5 折' },
  { id: 'vip-365',  level: 'vip',  name: 'VIP 年卡',  days: 365, price: 329, active: true, desc: 'VIP 权益 365 天，全场 4.5 折' },
  { id: 'svip-30',  level: 'svip', name: 'SVIP 月卡', days: 30,  price: 99,  active: true, desc: 'SVIP 权益 30 天，全场 1.5 折' },
  { id: 'svip-90',  level: 'svip', name: 'SVIP 季卡', days: 90,  price: 259, active: true, desc: 'SVIP 权益 90 天，全场 1.5 折' },
  { id: 'svip-365', level: 'svip', name: 'SVIP 年卡', days: 365, price: 899, active: true, desc: 'SVIP 权益 365 天，全场 1.5 折' },
];
/* 校验并归一化套餐配置（非法项直接丢弃；全非法则回落到默认套餐） */
function normalizeMemberPlans(raw) {
  const arr = Array.isArray(raw) ? raw : (raw && Array.isArray(raw.plans) ? raw.plans : null);
  if (!arr) return DEFAULT_MEMBER_PLANS.map(p => Object.assign({}, p));
  const out = [];
  const seen = new Set();
  for (const p of arr) {
    if (!p || typeof p !== 'object') continue;
    const id = String(p.id || '').trim();
    const level = String(p.level || '').trim().toLowerCase();
    const days = Math.round(Number(p.days));
    const price = Number(p.price);
    if (!id || seen.has(id)) continue;
    if (['lvip', 'vip', 'svip'].indexOf(level) < 0) continue;
    if (!Number.isFinite(days) || days <= 0 || days > 3650) continue;
    if (!Number.isFinite(price) || price < 0 || price > 100000) continue;
    seen.add(id);
    out.push({
      id, level, days, price: Number(price.toFixed(2)),
      name: String(p.name || '').trim().slice(0, 40) || (level.toUpperCase() + ' ' + days + '天'),
      desc: String(p.desc || '').trim().slice(0, 120),
      active: p.active !== false,
    });
  }
  return out.length ? out : DEFAULT_MEMBER_PLANS.map(p => Object.assign({}, p));
}

/* 数据文件路径 */
const FILES = {
  orders: path.join(DATA_DIR, 'orders.json'),
  products: path.join(DATA_DIR, 'products.json'),
  admin: path.join(DATA_DIR, 'admin.json'),
  accounts: path.join(DATA_DIR, 'accounts.json'),
  purchases: path.join(DATA_DIR, 'purchases.json'),
  coupons: path.join(DATA_DIR, 'coupons.json'),
  cards: path.join(DATA_DIR, 'cards.json'),
  interactions: path.join(DATA_DIR, 'interactions.json'),
  categories: path.join(DATA_DIR, 'categories.json'),
  store: path.join(DATA_DIR, 'store.json'),
};

/* ============================================================
   1. 配置层
   ============================================================ */

/* 1.1 加载 .env（仅补充未设置的环境变量，不覆盖已有值） */
function loadDotEnv() {
  let raw;
  try { raw = fs.readFileSync(path.join(ROOT, '.env'), 'utf8'); } catch (e) { return; }
  raw.split(/\r?\n/).forEach(line => {
    const t = line.trim();
    if (!t || t.startsWith('#')) return;
    const i = t.indexOf('=');
    if (i < 0) return;
    const k = t.slice(0, i).trim();
    let v = t.slice(i + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (k && process.env[k] === undefined) process.env[k] = v;
  });
}
loadDotEnv();

/* 1.2 运行时配置（支持热更新：后台保存后立即生效） */
const CFG = {};
let cfgRaw = {};
let RSA_PRIV = '';
let RSA_PUB = '';
let USE_RSA = false;

function readPem(rel) {
  if (!rel) return '';
  try { return fs.readFileSync(path.resolve(__dirname, rel), 'utf8'); } catch (e) { return ''; }
}

function reloadConfig() {
  cfgRaw = readJson(CONFIG_FILE, cfgRaw);

  /* 兼容两套命名：优先截图里的 honglingPay*，回退旧字段（apiBase/pid/key/createUrl…） */
  const pick = (...vals) => {
    for (const v of vals) { if (v !== undefined && v !== null && String(v) !== '') return v; }
    return '';
  };

  CFG.submitPath = String(cfgRaw.submitPath || '/submit.php').replace(/^\/*/, '/');
  CFG.pid = String(pick(process.env.XJ_PAY_PID, cfgRaw.honglingPayMerchantId, cfgRaw.pid));
  CFG.key = String(pick(process.env.XJ_PAY_KEY, cfgRaw.honglingPayApiKey, cfgRaw.key));
  CFG.signType = String(pick(cfgRaw.honglingPaySignType, cfgRaw.signType, 'MD5'));
  CFG.rsaAlgo = cfgRaw.rsaAlgo || 'RSA-SHA256';
  CFG.sitename = cfgRaw.sitename || 'XJ Store';
  CFG.notifyUrl = String(pick(cfgRaw.honglingPayNotifyUrl, cfgRaw.notifyUrl));
  CFG.returnUrl = String(pick(cfgRaw.honglingPayReturnUrl, cfgRaw.returnUrl));
  CFG.mock = process.env.XJ_PAY_MOCK === '1' || cfgRaw.mock === true;
  CFG.merchantPrivateKeyPath = cfgRaw.merchantPrivateKeyPath || 'keys/merchant_private.pem';
  CFG.gatewayPublicKeyPath = cfgRaw.gatewayPublicKeyPath || 'keys/gateway_public.pem';
  CFG.stellarSecret = cfgRaw.stellarSecret || '';
  CFG.payType = String(pick(cfgRaw.payType, 'usdt')).toLowerCase();
  CFG.payMethod = String(pick(cfgRaw.honglingPayCreateMethod, cfgRaw.honglingPayMethod, cfgRaw.payMethod, 'POST')).toUpperCase();

  /* 下单地址自适应：
     - 留空 → 用 apiBase + submitPath
     - 以 / 结尾（站点根，如 https://dash.bxyvps.cn/）→ 自动补 submitPath
     - 否则视为完整端点，原样使用 */
  const rawApiBase = String(pick(process.env.XJ_PAY_API, cfgRaw.apiBase)).replace(/\/+$/, '');
  const rawCreate = String(pick(cfgRaw.honglingPayCreateUrl, cfgRaw.createUrl)).trim();
  if (!rawCreate) {
    CFG.createUrl = rawApiBase ? rawApiBase + CFG.submitPath : '';
  } else if (/\/$/.test(rawCreate)) {
    CFG.createUrl = rawCreate.replace(/\/+$/, '') + CFG.submitPath;
  } else {
    CFG.createUrl = rawCreate;
  }
  /* apiBase 仅用于后台展示/回退 */
  CFG.apiBase = rawApiBase || (rawCreate ? rawCreate.replace(/\/+$/, '') : '');
  CFG.queryUrl = String(pick(cfgRaw.honglingPayQueryUrl, cfgRaw.queryUrl)).replace(/\/+$/, '');

  RSA_PRIV = readPem(CFG.merchantPrivateKeyPath);
  RSA_PUB = readPem(CFG.gatewayPublicKeyPath);
  USE_RSA = String(CFG.signType).toUpperCase() === 'RSA' && !!RSA_PRIV;

  /* 支付总开关（对齐说明：getStorePaymentsEnabled 读 store_payments_enabled 设置项；缺省开启） */
  CFG.paymentsEnabled = cfgRaw.paymentsEnabled !== false;

  /* 会员套餐（后台可改价 / 上下架；配置存 config.json 的 memberPlans） */
  CFG.memberPlans = normalizeMemberPlans(cfgRaw.memberPlans);

  /* Cap 人机验证（trycap.dev 自托管 CAPTCHA）：
     capEnabled=true 时，登录与支付确认必须先过 Cap 质询（令牌一次性）。
     未部署 Cap 时保持 false，本地开发完全无感。 */
  CFG.cap = {
    enabled: cfgRaw.capEnabled === true,
    instance: String(cfgRaw.capInstance || '').replace(/\/+$/, ''),
    siteKey: String(cfgRaw.capSiteKey || ''),
    secretKey: String(cfgRaw.capSecretKey || ''),
  };
}
reloadConfig();

/* Cap 后端校验：向自家 Cap 实例的 /siteverify 端点核验令牌（一次性）。
   返回 { ok, msg }；capEnabled=false 时直接放行，便于未部署 Cap 时本地开发。 */
async function verifyCap(body) {
  const cap = CFG.cap;
  if (!cap || !cap.enabled) return { ok: true };
  const token = body && body.capToken ? String(body.capToken) : '';
  if (!token) return { ok: false, msg: '请先完成人机验证' };
  if (!cap.instance || !cap.siteKey || !cap.secretKey) {
    console.warn('[cap] 已启用但配置不完整（instance / siteKey / secretKey）');
    return { ok: false, msg: '人机验证服务未配置，请联系管理员' };
  }
  const endpoint = cap.instance + '/' + cap.siteKey + '/siteverify';
  try {
    const ctrl = new AbortController();
    const tid = setTimeout(() => ctrl.abort(), 8000);
    const resp = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret: cap.secretKey, response: token }),
      signal: ctrl.signal,
    });
    clearTimeout(tid);
    const j = await resp.json().catch(() => ({}));
    if (j && j.success === true) return { ok: true };
    console.warn('[cap] 令牌校验失败', JSON.stringify(j));
    return { ok: false, msg: '人机验证未通过，请重试' };
  } catch (e) {
    console.warn('[cap] 校验请求异常', e && e.message);
    return { ok: false, msg: '人机验证服务不可用，请稍后重试' };
  }
}

/* 1.4 支付配置读取（结构化，对齐 hongxingPay* 设计说明）
   当前工程是单一 pay-server.js + JSON 配置，下面这些函数把 CFG 再结构化一层，
   供「支付能力 / 就绪判断 / 路由分发」使用。备用通道（七香 payqixiang）先读配置、未配齐则不启用。 */

function getConfiguredValue(envKey, ...fieldKeys) {
  const fromEnv = process.env[envKey];
  if (fromEnv !== undefined && fromEnv !== null && String(fromEnv) !== '') return fromEnv;
  for (const k of fieldKeys) {
    const v = cfgRaw[k];
    if (v !== undefined && v !== null && String(v) !== '') return v;
  }
  return '';
}

function getHongxingPayConfig() {
  return {
    createUrl: CFG.createUrl, queryUrl: CFG.queryUrl, apiKey: CFG.key,
    merchantId: CFG.pid, payType: CFG.payType, signType: CFG.signType,
    notifyUrl: CFG.notifyUrl, returnUrl: CFG.returnUrl, method: CFG.payMethod, apiBase: CFG.apiBase,
  };
}

function getWechatBackupPayConfig() {
  // 七香备用通道：固定 wxpay，未配齐则不启用
  const merchantId = getConfiguredValue('WECHAT_BACKUP_MERCHANT_ID', 'wechatPayBackupMerchantId', 'wechatPayBackupPid');
  const apiKey = getConfiguredValue('WECHAT_BACKUP_API_KEY', 'wechatPayBackupApiKey', 'wechatPayBackupKey');
  const createUrl = String(getConfiguredValue('WECHAT_BACKUP_CREATE_URL', 'wechatPayBackupCreateUrl', 'wechatPayBackupUrl')).trim();
  return { createUrl, apiKey, merchantId, payType: 'wxpay', signType: 'MD5', ready: !!(merchantId && apiKey && createUrl) };
}

function getHongxingPayReadiness() {
  const cfg = getHongxingPayConfig();
  return {
    ready: !!(cfg.merchantId && cfg.apiKey && cfg.createUrl),
    merchantId: cfg.merchantId, signType: cfg.signType,
    method: cfg.method, createUrl: cfg.createUrl,
  };
}

function getStorePaymentReadiness() {
  const hx = getHongxingPayReadiness();
  const backup = getWechatBackupPayConfig();
  // 主通道就绪 → provider=hongxing；否则看备用；再否则退化（当前未启用微信官方 v3）
  let provider = 'none';
  let defaultPaymentMethod = 'wxpay';
  if (hx.ready) { provider = 'hongxing'; defaultPaymentMethod = CFG.payType || 'wxpay'; }
  else if (backup.ready) { provider = 'wechat_backup'; defaultPaymentMethod = 'wxpay'; }
  return { enabled: CFG.paymentsEnabled, provider, defaultPaymentMethod, hongxing: hx, backup: { ready: backup.ready } };
}

function getStorePaymentsEnabled() { return CFG.paymentsEnabled; }

/* 支付方式归一化：保留 qq/usdt 等，避免被静默降级为 wechat（修复过的坑） */
const ALLOWED_GATE_TYPES = ['alipay', 'wxpay', 'qqpay', 'usdt', 'bank', 'alipay_hk'];
const METHOD_NAMES = { wxpay: '微信支付', alipay: '支付宝', qqpay: 'QQ钱包', usdt: 'USDT', bank: '网银', alipay_hk: '支付宝香港' };
function normalizePaymentMethod(t) {
  const s = String(t || '').toLowerCase();
  return ALLOWED_GATE_TYPES.includes(s) ? s : '';
}

/* 1.3 XJ AI（OpenAI 兼容中转）配置
   对齐 codex config.toml 的字段含义：base_url / api_key / model。
   - 密钥只存服务端（config.json 的 aiApiKey 或环境变量 XJ_AI_API_KEY），前端只能走 /api/ai/* 代理
   - 中转站同时提供 /chat/completions 与 /responses，这里统一用 /chat/completions（SSE 格式最通用）
   - aiFallbackModels：默认模型挂了（中转站常见 502/503）时按序降级，避免页面直接报错
   - aiAllowModels：模型白名单，只放行实测可用的模型（gpt-5.5 / gpt-5.6 / gpt-5.6-luna 实测 503/502，已剔除）
   - aiMinLevel：XJ AI 使用门槛（默认 vip，即 VIP 及以上才能用），服务端强制校验，前端只做展示
   - aiAdminPerm：最高权限权限位，账号带该位可解锁经营洞察（销量/库存/营收等商店全局数据） */
const AI_DEFAULT_MODELS = 'gpt-6.1-sol,codex-auto-review,gpt-6-sol,gpt-5.6-sol,gpt-6-astra,gpt-6-luna,gpt-5.6-terra';

function getAiConfig() {
  const baseUrl = String(getConfiguredValue('XJ_AI_BASE_URL', 'aiBaseUrl') || 'https://ai.tdgzs.top/v1').replace(/\/+$/, '');
  const apiKey = String(getConfiguredValue('XJ_AI_API_KEY', 'aiApiKey'));
  const model = String(getConfiguredValue('XJ_AI_MODEL', 'aiModel') || 'gpt-6.1-sol');
  const fallbacks = String(getConfiguredValue('XJ_AI_FALLBACKS', 'aiFallbackModels') || 'gpt-6-sol,gpt-5.6-sol,gpt-6-astra,gpt-6-luna,gpt-5.6-terra,codex-auto-review')
    .split(',').map(s => s.trim()).filter(Boolean);
  const maxTokens = Number(getConfiguredValue('XJ_AI_MAX_TOKENS', 'aiMaxTokens')) || 0;
  const system = String(getConfiguredValue('XJ_AI_SYSTEM', 'aiSystemPrompt') || '');
  const allow = String(getConfiguredValue('XJ_AI_ALLOW_MODELS', 'aiAllowModels') || AI_DEFAULT_MODELS)
    .split(',').map(s => s.trim()).filter(Boolean);
  const minLevel = String(getConfiguredValue('XJ_AI_MIN_LEVEL', 'aiMinLevel') || 'vip').toLowerCase();
  const adminPerm = String(getConfiguredValue('XJ_AI_ADMIN_PERM', 'aiAdminPerm') || 'ai_admin');
  /* 总开关：aiEnabled 默认开启；可随时在后台关闭整个 XJ AI（未配置该字段视作开启） */
  const rawEnabled = getConfiguredValue('XJ_AI_ENABLED', 'aiEnabled');
  const enabled = (rawEnabled === undefined || rawEnabled === '')
    ? true
    : (rawEnabled === true || rawEnabled === 'true' || rawEnabled === '1' || rawEnabled === 'on' || rawEnabled === 1);
  /* 模型禁用名单：逗号分隔，被禁用的模型前端不展示、服务端也不路由 */
  const disabled = String(getConfiguredValue('XJ_AI_DISABLED_MODELS', 'aiDisabledModels') || '')
    .split(',').map(s => s.trim()).filter(Boolean);
  /* 模型计费元数据（仅用于前端展示，不参与调用） */
  let meta = {};
  const rawMeta = getConfiguredValue('XJ_AI_MODEL_META', 'aiModelMeta');
  if (rawMeta) {
    if (typeof rawMeta === 'object') meta = rawMeta;
    else { try { meta = JSON.parse(rawMeta); } catch (e) { meta = {}; } }
  }
  /* 模型 → 专属密钥映射：中转站按模型分组发 key（gpt 组一把、DeepSeek 组一把），
     命中映射的模型用专属 key 调用，未命中走主 key（aiApiKey） */
  let modelKeys = {};
  const rawKeys = getConfiguredValue('XJ_AI_MODEL_KEYS', 'aiModelKeys');
  if (rawKeys && typeof rawKeys === 'object' && !Array.isArray(rawKeys)) {
    for (const [k, v] of Object.entries(rawKeys)) {
      const mk = String(k || '').trim(); const mv = String(v || '').trim();
      if (mk && mv) modelKeys[mk] = mv;
    }
  }
  return {
    baseUrl, apiKey, model, fallbacks, maxTokens, system,
    allow: allow.length ? allow : AI_DEFAULT_MODELS.split(','),
    minLevel, adminPerm, meta, modelKeys,
    enabled, disabled,
    ready: !!(baseUrl && apiKey),
  };
}

/* 按模型选密钥：命中 aiModelKeys 映射用专属 key，否则用主 key */
function aiKeyForModel(ai, model) {
  const mk = String(model || '').trim();
  return (ai.modelKeys && ai.modelKeys[mk]) || ai.apiKey;
}

/* 1.3.1 模型目录（带 5 分钟缓存，供前端下拉框用） */
let AI_MODELS_CACHE = { at: 0, list: [] };

function aiHttpRequest(urlStr, { method = 'GET', headers = {}, body = null, timeout = 180000 } = {}) {
  return new Promise((resolve, reject) => {
    let target;
    try { target = new URL(urlStr); } catch (e) { return reject(new Error('上游地址无效')); }
    const mod = target.protocol === 'https:' ? https : http;
    const req = mod.request({
      protocol: target.protocol,
      hostname: target.hostname,
      port: target.port || (target.protocol === 'https:' ? 443 : 80),
      path: target.pathname + target.search,
      method,
      headers,
    }, res => resolve({ res, req }));
    req.setTimeout(timeout, () => { req.destroy(new Error('上游响应超时')); });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

function readAllStream(res, limit = 1024 * 1024) {
  return new Promise(resolve => {
    let buf = '';
    res.setEncoding('utf8');
    res.on('data', c => { if (buf.length < limit) buf += c; });
    res.on('end', () => resolve(buf));
    res.on('error', () => resolve(buf));
  });
}

async function fetchAiModels(force) {
  const ai = getAiConfig();
  if (!ai.ready) return [];
  if (!force && AI_MODELS_CACHE.list.length && Date.now() - AI_MODELS_CACHE.at < 5 * 60 * 1000) {
    return AI_MODELS_CACHE.list;
  }
  try {
    const { res } = await aiHttpRequest(ai.baseUrl + '/models', {
      headers: { Authorization: 'Bearer ' + ai.apiKey, 'User-Agent': 'XJ-Store/1.0' },
      timeout: 15000,
    });
    const text = await readAllStream(res);
    const json = JSON.parse(text || '{}');
    const list = (json.data || []).map(m => ({
      id: String(m.id || ''),
      name: String(m.display_name || m.id || ''),
    })).filter(m => m.id);
    if (list.length) AI_MODELS_CACHE = { at: Date.now(), list };
    return list;
  } catch (e) {
    console.warn('[ai] 拉取模型列表失败', e.message);
    return AI_MODELS_CACHE.list;
  }
}

/* 1.3.2 请求限流：同一 IP 10 分钟内最多 40 次，防止公开页面被刷爆额度 */
const AI_RATE = new Map();
function aiRateGuard(req) {
  const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim()
    || (req.socket && req.socket.remoteAddress) || 'unknown';
  const now = Date.now();
  const rec = AI_RATE.get(ip);
  if (!rec || now > rec.resetAt) {
    AI_RATE.set(ip, { count: 1, resetAt: now + 10 * 60 * 1000 });
    return { ok: true };
  }
  rec.count++;
  if (rec.count > 40) return { ok: false, retryAfter: Math.ceil((rec.resetAt - now) / 1000) };
  return { ok: true };
}
setInterval(() => {
  const now = Date.now();
  for (const [ip, rec] of AI_RATE) if (now > rec.resetAt) AI_RATE.delete(ip);
}, 5 * 60 * 1000).unref();

/* 1.3.3 消息清洗：只保留 system/user/assistant，总条数限 40
   - 支持多模态：content 可为「字符串」或「part 数组」（text / image_url / file）
   - 图片仅接受 data:image/ 直链（前端用 base64 内联，避免外链滥用 / SSRF），单张限 6MB、单条最多 8 张
   - 单条文本上限 60000 字符，避免超大文档把上下文撑爆 */
function sanitizeAiContent(content) {
  if (typeof content === 'string') {
    return content.trim() ? content.slice(0, 12000) : '';
  }
  if (Array.isArray(content)) {
    const parts = [];
    let textLen = 0, imgCount = 0;
    for (const p of content) {
      if (!p || typeof p !== 'object') continue;
      const type = String(p.type || '').toLowerCase();
      if (type === 'text') {
        const remain = 60000 - textLen;
        if (remain <= 0) continue;
        const t = String(p.text == null ? '' : p.text).slice(0, remain);
        textLen += t.length;
        if (t.trim()) parts.push({ type: 'text', text: t });
      } else if (type === 'image_url') {
        if (imgCount >= 8) continue;
        const url = (p.image_url && (p.image_url.url || p.image_url)) || '';
        if (!/^data:image\/[a-zA-Z0-9.+-]+;base64,/.test(url)) continue;
        if (url.length > 6 * 1024 * 1024) continue;
        imgCount++;
        parts.push({ type: 'image_url', image_url: { url } });
      } else if (type === 'file') {
        const remain = 60000 - textLen;
        if (remain <= 0) continue;
        const name = String(p.name || '文档');
        const t = String(p.text == null ? '' : p.text).slice(0, remain);
        textLen += t.length;
        if (t.trim()) parts.push({ type: 'text', text: '【文档 ' + name + '】\n' + t });
      }
    }
    if (!parts.length) return '';
    if (parts.length === 1 && parts[0].type === 'text') return parts[0].text;
    return parts;
  }
  return '';
}
function sanitizeAiMessages(input) {
  const arr = Array.isArray(input) ? input : [];
  const out = [];
  for (const m of arr.slice(-40)) {
    if (!m) continue;
    const role = String(m.role || '').toLowerCase();
    if (!['system', 'user', 'assistant'].includes(role)) continue;
    const content = sanitizeAiContent(m.content);
    if (!content) continue;
    out.push({ role, content });
  }
  return out;
}

/* 1.3.4 候选模型：用户所选（且在白名单内）→ 默认模型 → 回退队列（去重） */
function aiModelCandidates(requested) {
  const ai = getAiConfig();
  const disabled = new Set(ai.disabled || []);
  const list = [];
  const push = m => { const s = String(m || '').trim(); if (s && !disabled.has(s) && !list.includes(s)) list.push(s); };
  if (requested && (!ai.allow.length || ai.allow.includes(String(requested)))) push(requested);
  push(ai.model);
  ai.fallbacks.forEach(push);
  return list;
}

/* ============================================================
   1.4 XJ AI 权限分级与「商店大脑」
   - 等级序：none(0) < lvip(1) < vip(2) < svip(3)
   - aiMinLevel：默认 vip，仅 VIP 及以上可用 XJ AI（服务端强制）
   - ai_admin 权限位 = 最高权限：额外解锁经营洞察（销量/营收/库存/会员分布）
   ============================================================ */
const AI_LEVEL_RANK = { none: 0, lvip: 1, vip: 2, svip: 3 };
function aiLevelRank(level) {
  const k = String(level || 'none').toLowerCase();
  return AI_LEVEL_RANK[k] === undefined ? 0 : AI_LEVEL_RANK[k];
}

/* XJ AI 准入校验：需要 uid + token（会员身份），并满足最低等级 */
function aiAuthGate(uid, token) {
  const ai = getAiConfig();
  if (!uid || !token) {
    return { ok: false, code: 401, msg: '请先登录会员账号后再使用 XJ AI' };
  }
  const auth = authAccount(uid, token);
  if (!auth.ok) {
    return { ok: false, code: auth.code, msg: auth.msg };
  }
  const acct = auth.account;
  if (acct.banned) return { ok: false, code: 403, msg: '该账户已被封禁' };
  /* 限时会员到期后按实际生效等级判定（effectiveLevel 定义在领域层，函数声明会提升） */
  const curLevel = effectiveLevel(acct);
  const need = aiLevelRank(ai.minLevel);
  const mine = aiLevelRank(curLevel);
  if (mine < need) {
    const needName = (LEVELS[ai.minLevel] || {}).name || String(ai.minLevel).toUpperCase();
    return {
      ok: false, code: 403, msg: `XJ AI 为 ${needName} 及以上会员专享，当前等级不足`,
      needLevel: ai.minLevel, level: curLevel,
    };
  }
  const isAdmin = Array.isArray(acct.perms) && acct.perms.includes(ai.adminPerm);
  return {
    ok: true, account: acct, isAdmin,
    level: curLevel, levelName: (LEVELS[curLevel] || {}).name || String(curLevel).toUpperCase(),
    rate: levelRate(curLevel),
  };
}

/* 1.4.1 商品目录摘要：注入 system prompt，让 AI 认识「当前商店卖什么」
   只放标题/分类/价格/库存/标签，控制在可接受长度内（不塞 desc 全文，避免 token 爆炸） */
function buildStoreContext(limit) {
  const max = Math.max(1, Number(limit) || 60);
  const catName = {};
  CATEGORIES.forEach(c => { catName[c.id] = c.name; });
  const lines = [];
  for (const p of PRODUCTS) {
    if (lines.length >= max) break;
    if (p && p.status === 'off') continue;
    const stock = (p.specs || []).reduce((n, s) => n + (Number(s.stock) || 0), 0);
    const tags = (p.tags || []).map(t => Array.isArray(t) ? t[0] : t).filter(Boolean).join('、');
    lines.push(
      `商品ID:${p.id} | 名称:${p.title}${p.sub ? '（' + p.sub + '）' : ''} | 分类:${catName[p.cat] || p.cat || '未分类'}` +
      ` | 原价:${Number(p.price || 0)} | 库存:${stock}` + (tags ? ` | 标签:${tags}` : '')
    );
  }
  return lines.join('\n');
}

/* 1.4.2 经营洞察（最高权限 ai_admin）：销量 / 营收 / 库存 / 会员分布 */
function buildInsightsContext() {
  const orders = loadOrders();
  const paid = orders.filter(o => o.status === 'paid');
  /* 钳制异常金额：测试/刷单可能产生天文数字，洞察里按 999999 封顶，避免污染 AI 上下文 */
  const sane = n => (Number.isFinite(n) && Math.abs(n) < 999999 ? n : 0);
  const revenue = paid.reduce((s, o) => s + sane(Number(o.total || 0)), 0);
  const byProduct = {};
  paid.forEach(o => (o.items || []).forEach(it => {
    const k = it.title || ('ID:' + it.id);
    byProduct[k] = byProduct[k] || { qty: 0, amount: 0 };
    const q = sane(Number(it.qty) || 0);
    byProduct[k].qty += q;
    byProduct[k].amount += sane(q * (Number(it.price) || 0));
  }));
  const top = Object.entries(byProduct).sort((a, b) => b[1].qty - a[1].qty).slice(0, 8)
    .map(([k, v]) => `${k} ×${v.qty}（${v.amount.toFixed(2)} 元）`);
  const lowStock = PRODUCTS.filter(p => p && p.status !== 'off')
    .map(p => ({ p, stock: (p.specs || []).reduce((n, s) => n + (Number(s.stock) || 0), 0) }))
    .filter(x => x.stock <= 2)
    .map(x => `${x.p.title}（ID:${x.p.id}）剩余 ${x.stock}`);
  const levelDist = {};
  ACCOUNTS.forEach(a => { const k = a.level || 'none'; levelDist[k] = (levelDist[k] || 0) + 1; });
  const lines = [
    `订单总数:${orders.length}，已支付:${paid.length}，总营收:${revenue.toFixed(2)} 元`,
    '热销商品：' + (top.length ? top.join('；') : '暂无'),
    '库存告警（≤2）：' + (lowStock.length ? lowStock.join('；') : '无'),
    '会员分布：' + Object.entries(levelDist).map(([k, v]) => `${(LEVELS[k] || {}).name || k}:${v}`).join('，'),
  ];
  return lines.join('\n');
}

/* 1.4.4 商品推荐引擎
   打分维度：热度（浏览/点赞）、库存、用户收藏/购买过的分类偏好、会员折扣后的性价比、随机微扰避免固定顺序 */
function recommendProducts(acct, limit) {
  const catName = {};
  CATEGORIES.forEach(c => { catName[c.id] = c.name; });
  const rate = levelRate(acct.level);

  /* 用户偏好：收藏过的商品分类 + 历史购买商品名里命中的关键词 */
  const favIds = (acct.favorites || []).map(x => String(x));
  const favCats = new Set();
  PRODUCTS.forEach(p => { if (favIds.includes(String(p.id))) favCats.add(p.cat); });
  const bought = new Set(
    PURCHASES.filter(x => String(x.accountId) === String(acct.id)).map(x => x.productTitle)
  );

  const scored = [];
  for (const p of PRODUCTS) {
    if (!p || p.status === 'off') continue;
    const stock = (p.specs || []).reduce((n, s) => n + (Number(s.stock) || 0), 0);
    if (stock <= 0) continue;
    const it = INTERACTIONS[String(p.id)] || {};
    const views = Number(it.views) || 0;
    const likes = Number(it.likes) || 0;
    const price = Number(p.price) || 0;

    let score = 0;
    score += Math.log10(views + 1) * 12;      /* 热度 */
    score += Math.log10(likes + 1) * 20;      /* 点赞权重更高 */
    if (favCats.has(p.cat)) score += 18;      /* 同分类偏好 */
    if (bought.has(p.title)) score += 6;       /* 已购过，加一点复购权重 */
    if (stock >= 5) score += 5;                /* 库存充足 */
    /* 会员折扣后越便宜越受欢迎（0.1~0.6 区间加分） */
    if (price > 0 && price < 9999 && rate < 1) {
      const eff = price * rate;
      if (eff <= 60) score += 8;
      else if (eff <= 150) score += 4;
    }
    score += Math.random() * 6;                /* 抖动，避免每次完全相同 */

    scored.push({
      id: p.id,
      title: p.title,
      sub: p.sub || '',
      cat: p.cat,
      catName: catName[p.cat] || p.cat || '未分类',
      price,
      memberPrice: Number((price * rate).toFixed(2)),
      rate,
      stock,
      emoji: p.emoji || '📦',
      color: p.color || '',
      tags: (p.tags || []).map(t => Array.isArray(t) ? t[0] : t).filter(Boolean),
      views, likes,
      score: Number(score.toFixed(2)),
      reason: buildRecommendReason(p, stock, views, likes, favCats, rate),
    });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit);
}

function buildRecommendReason(p, stock, views, likes, favCats, rate) {
  const bits = [];
  if (favCats.has(p.cat)) bits.push('与你收藏的分类一致');
  if (views >= 1000) bits.push('热门商品（' + views + ' 次浏览）');
  else if (likes >= 100) bits.push('口碑好（' + likes + ' 赞）');
  if (stock <= 3) bits.push('仅剩 ' + stock + ' 件');
  if (rate < 1) {
    bits.push('会员价 ' + (Number(p.price || 0) * rate).toFixed(2) + ' 元');
  }
  if (!bits.length) bits.push('编辑精选');
  return bits.join(' · ');
}

/* 1.4.3 构造 system 消息（服务端权威，客户端无法伪造提权） */

function buildAiSystemPrompt(gate, wantInsights) {
  const ai = getAiConfig();
  const parts = [];
  parts.push(ai.system || '你是 XJ AI，XJ Store 的智能助手。回答简洁、准确、可执行，中文优先。');
  parts.push(
    '【当前商店商品目录（权威数据，价格为原价，折扣由系统另算）】\n' +
    buildStoreContext() +
    '\n注意：只能引用上面目录中真实存在的商品；不要编造商品、库存或价格。'
  );
  if (gate && gate.ok) {
    parts.push(
      `【当前用户】用户名:${gate.account.name}；等级:${gate.levelName}；折扣率:${gate.rate}（下单时按此系数计算实付价）；` +
      `积分:${Number(gate.account.point || 0)}`
    );
  }
  if (wantInsights && gate && gate.isAdmin) {
    parts.push('【经营数据（最高权限视图）】\n' + buildInsightsContext());
  }
  parts.push(
    '【商品推荐格式】需要推荐商品时，先用一句话说明推荐理由（结合用户等级与需求），' +
    '再在商品名称后紧跟标注 [[商品:ID]]（ID 必须是目录里的真实商品ID），例如：云珩公会管理 [[商品:3]]。' +
    '一次最多推荐 3 个商品，按推荐度排序。'
  );
  return parts.join('\n\n');
}

/* 1.3 星际共享密钥：服务端唯一持有，缺失则生成并落盘 */
if (!CFG.stellarSecret) {
  try {
    cfgRaw.stellarSecret = crypto.randomBytes(32).toString('hex');
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(cfgRaw, null, 2));
    CFG.stellarSecret = cfgRaw.stellarSecret;
  } catch (e) {
    CFG.stellarSecret = 'stellar-dev-secret';
  }
}

/* ============================================================
   2. 存储层
   ============================================================ */
/* 2.1 通用读写 */
function readJson(f, def) {
  try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { return def; }
}
function writeJson(f, v) {
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, JSON.stringify(v, null, 2), 'utf8');
}

/* 2.2 各数据集合的加载与保存 */
let PRODUCTS = readJson(FILES.products, []);
let ACCOUNTS = readJson(FILES.accounts, []);
let PURCHASES = readJson(FILES.purchases, []);
let COUPONS = readJson(FILES.coupons, []);
let CARDS = readJson(FILES.cards, { batches: [] });
let INTERACTIONS = readJson(FILES.interactions, {});
let CATEGORIES = readJson(FILES.categories, null);
let STORE = readJson(FILES.store, { name: 'XJ Store', announcement: '' });

const DEFAULT_CATEGORIES = [
  { id: 'bot', name: '测试机器人', icon: 'bot' },
  { id: 'plugin', name: '测试插件', icon: 'plug' },
  { id: 'resource', name: '测试资源', icon: 'book' },
  { id: 'service', name: '商品服务', icon: 'spark' },
];
if (!Array.isArray(CATEGORIES) || !CATEGORIES.length) CATEGORIES = DEFAULT_CATEGORIES.slice();

function saveProducts(v) { PRODUCTS = v; writeJson(FILES.products, v); }
function saveAccounts(v) { ACCOUNTS = v; writeJson(FILES.accounts, v); }
function savePurchases(v) { PURCHASES = v; writeJson(FILES.purchases, v); }
function saveCoupons(v) { COUPONS = v; writeJson(FILES.coupons, v); }
function saveCards(v) { CARDS = v; writeJson(FILES.cards, v); }
function saveInteractions(v) { INTERACTIONS = v; writeJson(FILES.interactions, v); }
function saveCategories(v) { CATEGORIES = v; writeJson(FILES.categories, v); }
function saveStore(v) { STORE = v; writeJson(FILES.store, v); }

/* 订单单独走 load/save（每次读写最新文件，避免多进程/多标签页读到旧内存） */
function loadOrders() { return readJson(FILES.orders, []); }
function saveOrders(list) { writeJson(FILES.orders, list); }

/* ============================================================
   3. 领域层
   ============================================================ */

/* 3.1 会员等级与折扣（服务端唯一权威） */
const LEVELS = {
  '':     { key: '',     name: '未设置', rate: 1,    zhe: null, color: '#8f959e' },
  none:   { key: 'none', name: '无折扣', rate: 1,    zhe: null, color: '#646a73' },
  lvip:   { key: 'lvip', name: 'LVIP',  rate: 0.70, zhe: 7,   color: '#0ea5e9' },
  vip:    { key: 'vip',  name: 'VIP',   rate: 0.45, zhe: 4.5, color: '#8b5cf6' },
  svip:   { key: 'svip', name: 'SVIP',  rate: 0.15, zhe: 1.5, color: '#f59e0b' },
};
function levelRate(level) {
  const L = LEVELS[String(level || '')];
  return L ? L.rate : 1;
}
function levelInfo(level) {
  return LEVELS[String(level || '')] || LEVELS[''];
}

/* 3.1b 会员套餐购买
   - 套餐配置在 config.json 的 memberPlans（后台可改价 / 上下架）
   - 购买走标准下单 → 网关支付 → 支付成功回调发放等级（与商品订单同一套支付链路）
   - 有效期：vipExpireAt（YYYY-MM-DD）。仅「限时会员」才受到期约束，
     管理员手动授予的永久等级（无 levelTimed 标记）不受影响。 */
const LEVEL_RANK = { '': 0, none: 0, lvip: 1, vip: 2, svip: 3 };

function memberPlans() { return Array.isArray(CFG.memberPlans) ? CFG.memberPlans : DEFAULT_MEMBER_PLANS; }
function findMemberPlan(id) {
  return memberPlans().find(p => String(p.id) === String(id || '')) || null;
}
/* 会员是否已到期（仅对限时会员生效） */
function levelExpired(acct) {
  if (!acct || !acct.levelTimed) return false;
  const exp = String(acct.vipExpireAt || '');
  if (!exp) return false;
  const t = new Date(exp.length <= 10 ? exp + 'T23:59:59' : exp).getTime();
  if (!Number.isFinite(t)) return false;
  return t < Date.now();
}
/* 实际生效等级：限时会员到期后回落为无折扣 */
function effectiveLevel(acct) {
  if (!acct) return '';
  const lv = String(acct.level || '');
  if (!lv || lv === 'none') return lv;
  return levelExpired(acct) ? 'none' : lv;
}
/* 发放会员权益：升级则换等级，同级/更低则保留高等级并叠加时长 */
function applyMemberPurchase(acct, plan) {
  const days = Math.max(1, Number(plan.days) || 30);
  const buyRank = LEVEL_RANK[plan.level] || 0;
  /* 以「实际生效等级」为基准：已到期的会员视为无等级，重新购买可正常升级 */
  const curRank = LEVEL_RANK[effectiveLevel(acct)] || 0;
  const now = Date.now();
  /* 到期基准：未到期的限时会员从原到期日叠加；否则从现在起算 */
  let base = now;
  if (acct.levelTimed && acct.vipExpireAt) {
    const t = new Date(String(acct.vipExpireAt).length <= 10 ? acct.vipExpireAt + 'T23:59:59' : acct.vipExpireAt).getTime();
    if (Number.isFinite(t) && t > now) base = t;
  }
  acct.vipExpireAt = new Date(base + days * 86400000).toISOString().slice(0, 10);
  acct.levelTimed = true;
  if (buyRank > curRank) acct.level = plan.level;   /* 升级才换等级，避免降级 */
  acct.memberOrders = acct.memberOrders || [];
  acct.memberOrders.unshift({
    planId: plan.id, planName: plan.name, level: plan.level, days,
    expireAt: acct.vipExpireAt, time: new Date().toISOString().slice(0, 10),
  });
  acct.memberOrders = acct.memberOrders.slice(0, 50);
  return {
    level: acct.level, upgrade: buyRank > curRank,
    expireAt: acct.vipExpireAt, name: levelInfo(acct.level).name,
  };
}

/* 3.2 优惠券校验（amount 减额 / rate 打折） */
function findCoupon(code) {
  const c = String(code || '').trim().toUpperCase();
  return COUPONS.find(x => String(x.code).toUpperCase() === c);
}
function validateCoupon(code, afterMember, level, subtotal) {
  const c = findCoupon(code);
  if (!c) return { ok: false, reason: '优惠券不存在' };
  if (c.active === false) return { ok: false, reason: '优惠券已停用' };
  const today = new Date().toISOString().slice(0, 10);
  if (c.expiresAt && c.expiresAt < today) return { ok: false, reason: '优惠券已过期' };
  if (Number(c.used || 0) >= Number(c.total || 0)) return { ok: false, reason: '优惠券已被领完' };
  if (c.level && c.level !== String(level || '')) return { ok: false, reason: '优惠券不适用于当前会员等级' };
  const amt = Number(afterMember || 0);
  const base = Number(subtotal || amt);
  if (Number(c.minSpend || 0) > base) return { ok: false, reason: `未满 ${c.minSpend} 元不可用` };
  let discount = 0;
  if (c.type === 'amount') discount = Math.min(Number(c.value || 0), amt);
  else if (c.type === 'rate') discount = Number((amt * (1 - Number(c.value || 1))).toFixed(2));
  else return { ok: false, reason: '优惠券类型无效' };
  discount = Number(discount.toFixed(2));
  return { ok: true, coupon: c, discount };
}

/* 3.3 口令与令牌 */
function hashPass(pass, salt) {
  return crypto.createHash('sha256').update(salt + ':' + pass, 'utf8').digest('hex');
}
function hashPwd(pwd) {
  return crypto.createHash('sha256').update(String(pwd || '')).digest('hex');
}
function loadAdmin() {
  let a = readJson(FILES.admin, null);
  if (!a || !a.user) {
    const salt = crypto.randomBytes(8).toString('hex');
    a = { user: '星际Stellar', salt, hash: hashPass('xjadmin2026', salt) };
    writeJson(FILES.admin, a);
  }
  return a;
}
let ADMIN = loadAdmin();

/* 管理员令牌（2 小时有效） */
const ADMIN_TOKENS = new Map();
function newAdminToken() {
  const t = crypto.randomBytes(18).toString('hex');
  ADMIN_TOKENS.set(t, Date.now() + 2 * 3600 * 1000);
  return t;
}
function checkAdminAuth(req, u) {
  const t = String(req.headers['x-admin-token'] || '') || String(u.searchParams.get('token') || '');
  const exp = ADMIN_TOKENS.get(t);
  if (!exp) return false;
  if (exp < Date.now()) { ADMIN_TOKENS.delete(t); return false; }
  return true;
}

/* 3.4 会员会话：账号自带 token，登录/注册时轮换 */
function findAccount(uid) {
  return ACCOUNTS.find(a => String(a.id) === String(uid)) || null;
}
/* 会员鉴权：uid + token 必须同时匹配，杜绝「仅凭 uid 改他人密码」 */
function authAccount(uid, token) {
  const acct = findAccount(uid);
  if (!acct) return { ok: false, code: 404, msg: '未找到账户' };
  if (!acct.token || acct.token !== String(token || '')) {
    return { ok: false, code: 401, msg: '登录状态已失效，请重新登录' };
  }
  return { ok: true, account: acct };
}

/* 对外暴露的账户字段（绝不含 pwd / token / appKey） */
function publicAccount(a) {
  const cur = effectiveLevel(a);
  return {
    id: a.id, name: a.name, mail: a.mail, phone: a.phone, wechat: a.wechat || '',
    contactType: a.contactType, level: cur, point: a.point || 0,
    banned: !!a.banned, vipExpireAt: a.vipExpireAt || '',
    levelTimed: !!a.levelTimed, levelExpired: levelExpired(a),
    memberOrders: a.memberOrders || [],
    redemptions: a.redemptions || [], favorites: a.favorites || [],
    perms: a.perms || ['buy', 'comment', 'view'], createdAt: a.createdAt,
  };
}

/* 3.5 签名（易支付规范：参数按键名升序、用【原始值】拼接，排除 sign / sign_type，空值不参与。
       注意：标准易支付的签名串用原始值（中文/空格原样），不要做 URL 编码——网关用原始值验签，
       编码后会对不上导致「签名计算失败」。URL 编码只在 POST 表单/GET 拼地址的传输阶段发生，与签名无关。） */
function signString(params) {
  const keys = Object.keys(params)
    .filter(k => k !== 'sign' && k !== 'sign_type')
    .filter(k => params[k] !== '' && params[k] !== undefined && params[k] !== null)
    .sort();
  return keys.map(k => `${k}=${params[k]}`).join('&');
}
function makeSign(params) {
  const str = signString(params);
  if (USE_RSA) {
    return { sign: crypto.createSign(CFG.rsaAlgo).update(str, 'utf8').sign(RSA_PRIV, 'base64'), signType: 'RSA' };
  }
  return { sign: crypto.createHash('md5').update(str + CFG.key, 'utf8').digest('hex'), signType: 'MD5' };
}
function verifySign(params) {
  const got = String(params.sign || '');
  if (!got) return false;
  const str = signString(params);
  const type = String(params.sign_type || CFG.signType).toUpperCase();
  if (type === 'RSA') {
    if (!RSA_PUB) return false;
    try { return crypto.createVerify(CFG.rsaAlgo).update(str, 'utf8').verify(RSA_PUB, got, 'base64'); }
    catch (e) { return false; }
  }
  const expect = crypto.createHash('md5').update(str + CFG.key, 'utf8').digest('hex');
  return got.toLowerCase() === expect;
}

/* 3.6 卡密池：下单时按购买数量支取，池空则现场生成 */
function drawCard(productTitle, orderNo) {
  for (const b of (CARDS.batches || [])) {
    const k = (b.keys || []).find(x => !x.used);
    if (k) {
      k.used = true;
      k.usedBy = '';
      k.usedAt = new Date().toISOString();
      k.orderNo = orderNo || '';
      k.productTitle = productTitle || '';
      saveCards(CARDS);
      return k.code;
    }
  }
  return null;
}
/* 已发放卡密（从订单反查，供后台查看） */
function issuedCards() {
  const out = [];
  for (const o of loadOrders()) {
    (o.cards || []).forEach(c => {
      const m = String(c).match(/卡密[:：]\s*([A-Za-z0-9\-]+)/);
      out.push({
        code: m ? m[1] : c,
        orderNo: o.no,
        productTitle: (o.items && o.items[0] && o.items[0].title) || '',
        time: o.time || o.serverTime || '',
        used: true,
      });
    });
  }
  return out;
}

/* 3.7 订单支付成功：标记已付并扣减规格库存（幂等，重复回调不重复扣）
   会员订单（kind='member'）：不涉及商品库存，改为给下单账号发放会员等级与有效期 */
function markPaid(order, payType, tradeNo) {
  if (order.status === 'paid') return false;
  if (order.kind === 'member') {
    order.status = 'paid';
    order.pay = payType || order.pay || '';
    order.tradeNo = tradeNo || order.tradeNo || '';
    order.paidTime = new Date().toLocaleString('zh-CN', { hour12: false });
    /* 发放会员权益（幂等：已发放过则跳过） */
    if (!order.memberGranted && order.member && order.uid) {
      const acct = findAccount(order.uid);
      if (acct) {
        const plan = findMemberPlan(order.member.planId) || order.member;
        const grant = applyMemberPurchase(acct, plan);
        order.memberGranted = true;
        order.memberGrant = grant;
        saveAccounts(ACCOUNTS);
        /* 记入购买记录，便于后台统计 */
        PURCHASES.unshift({
          id: (PURCHASES.reduce((m, p) => Math.max(m, p.id || 0), 0) + 1),
          accountId: acct.id, accountName: acct.name, level: grant.level,
          productTitle: (order.member && order.member.planName) || '会员套餐',
          amount: Number(order.total || 0), pay: order.pay || '', time: order.paidTime,
        });
        savePurchases(PURCHASES);
      }
    }
    return true;
  }
  for (const it of (order.items || [])) {
    const qty = Number(it.qty) || 0;
    if (!qty) continue;
    const prod = PRODUCTS.find(p => String(p.id) === String(it.id)) || PRODUCTS.find(p => p.title === it.title);
    if (!prod) continue;
    const target = (Array.isArray(prod.specs) && prod.specs.length)
      ? (prod.specs.find(s => s.name === it.spec) || prod.specs[0])
      : null;
    if (target && typeof target.stock === 'number') target.stock = Math.max(0, target.stock - qty);
    else if (typeof prod.stock === 'number') prod.stock = Math.max(0, prod.stock - qty);
  }
  saveProducts(PRODUCTS);
  order.status = 'paid';
  order.pay = payType || order.pay || '';
  order.tradeNo = tradeNo || order.tradeNo || '';
  order.paidTime = new Date().toLocaleString('zh-CN', { hour12: false });
  return true;
}

/* 3.8 星际互联：应用密钥与签名票据 */
function ensureAppKey(acct) {
  if (!acct.appKey) {
    acct.appKey = crypto.randomBytes(24).toString('hex');
    saveAccounts(ACCOUNTS);
  }
  return acct.appKey;
}
function appIdOf(appKey) {
  return crypto.createHash('sha256').update(String(appKey)).digest('hex').slice(0, 12);
}
/* ticket 绑定 app（公开 App ID）；同源商店接入可不传 app */
function stellarTicket(uid, token, app) {
  const p = JSON.stringify({ uid: String(uid), token: String(token), app: String(app || ''), exp: Date.now() + 5 * 60 * 1000 });
  const b64 = Buffer.from(p).toString('base64url');
  const sig = crypto.createHmac('sha256', CFG.stellarSecret).update(b64).digest('hex');
  return b64 + '.' + sig;
}

/* ============================================================
   4. HTTP 基础层
   ============================================================ */

const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon', '.woff2': 'font/woff2',
  '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif',
};
function sendJSON(res, code, data) {
  res.writeHead(code, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
  });
  res.end(JSON.stringify(data));
}
function sendText(res, code, text) {
  res.writeHead(code, {
    'Content-Type': 'text/plain; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
  });
  res.end(text);
}

/* 静态文件托管：仅开放根级 html/ico 与 assets/ 目录，防目录穿越 */
function serveStatic(req, res, pathname) {
  let rel = decodeURIComponent(pathname);
  if (rel === '/' || rel === '') rel = '/index.html';
  if (!rel.startsWith('/')) { res.writeHead(403); return res.end('Forbidden'); }
  const parts = rel.split('/').filter(p => p !== '' && p !== '.');
  if (parts.some(p => p === '..')) { res.writeHead(403); return res.end('Forbidden'); }
  const isRootFile = parts.length === 1;
  const inAssets = parts[0] === 'assets';
  if (!inAssets && !isRootFile) { res.writeHead(403); return res.end('Forbidden'); }
  if (!inAssets && !/\.(html|ico)$/i.test(parts[0])) { res.writeHead(403); return res.end('Forbidden'); }
  if (parts.includes('server') || parts.includes('data') || parts.includes('.workbuddy') || parts.includes('node_modules')) {
    res.writeHead(403); return res.end('Forbidden');
  }
  const file = path.join(ROOT, rel);
  const resolved = path.resolve(ROOT, '.' + path.sep + rel.replace(/\//g, path.sep));
  if (!resolved.startsWith(ROOT)) { res.writeHead(403); return res.end('Forbidden'); }
  fs.readFile(file, (err, buf) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('404 Not Found');
    }
    // 本地开发：禁强缓存，避免改完前端浏览器仍显示旧文件
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-cache',
    });
    res.end(buf);
  });
}

function readBody(req) {
  return new Promise(resolve => {
    let b = '';
    req.on('data', c => {
      b += c;
      if (b.length > 8 * 1024 * 1024) { req.destroy(); resolve({}); }
    });
    req.on('end', () => { try { resolve(JSON.parse(b || '{}')); } catch (e) { resolve({}); } });
    req.on('error', () => resolve({}));
  });
}

/* 取请求基址：优先反向代理头，其次 Host */
function requestBase(req) {
  const proto = (req.headers['x-forwarded-proto'] || 'http').split(',')[0].trim();
  const host = String(req.headers['x-forwarded-host'] || req.headers.host || 'localhost').split(',')[0].trim();
  return `${proto}://${host}`;
}

/* ============================================================
   5. 路由层
   ============================================================ */

/* 5.1 支付回调处理 */
function handleNotify(p, res) {
  if (!verifySign(p)) {
    console.warn('[notify] 签名校验失败', p);
    return sendText(res, 200, 'fail');
  }
  const list = loadOrders();
  const order = list.find(o => o.no === p.out_trade_no);
  if (order && p.trade_status === 'TRADE_SUCCESS') {
    markPaid(order, order.pay || (p.type === 'wxpay' ? '微信支付' : '支付宝'), p.trade_no || '');
    saveOrders(list);
    console.log('[notify] 订单已支付', order.no, p.trade_no);
  }
  return sendText(res, 200, 'success');
}

/* 5.2 XJ AI：对话代理（SSE 透传，模型自动回退）
   - 前端只与本接口通信，密钥不出服务端
   - 上游 5xx / 404 / 429 视为「该模型不可用」，自动换候选模型重试（此时尚未向浏览器写任何字节）
   - 401/403/400 属于配置或参数错误，直接回报，不再空转 */
async function handleAiChat(req, res) {
  const ai = getAiConfig();
  if (!ai.ready) {
    return sendJSON(res, 503, { ok: false, msg: 'XJ AI 尚未配置 API Key：请在 server/config.json 填写 aiApiKey' });
  }
  if (!ai.enabled) {
    return sendJSON(res, 503, { ok: false, msg: 'XJ AI 已临时关闭，请稍后再试或联系管理员开启' });
  }
  const guard = aiRateGuard(req);
  if (!guard.ok) {
    return sendJSON(res, 429, { ok: false, msg: `请求过于频繁，请 ${guard.retryAfter} 秒后再试` });
  }

  const body = await readBody(req);
  const gate = aiAuthGate(body.uid, body.token);
  if (!gate.ok) {
    return sendJSON(res, gate.code, {
      ok: false, msg: gate.msg,
      needLevel: gate.needLevel || null, level: gate.level || null,
      code: gate.code,
    });
  }

  let messages = sanitizeAiMessages(body.messages);
  if (!messages.length) return sendJSON(res, 400, { ok: false, msg: '消息不能为空' });
  /* system 由服务端统一构造（含商品目录与权限视图），丢弃客户端伪造的 system */
  messages = messages.filter(m => m.role !== 'system');
  const wantInsights = !!body.insights && gate.isAdmin;
  messages = [{ role: 'system', content: buildAiSystemPrompt(gate, wantInsights) }].concat(messages);

  const wantStream = body.stream !== false;
  const base = { messages, stream: wantStream };
  if (ai.maxTokens > 0) base.max_tokens = ai.maxTokens;

  let lastStatus = 0;
  let lastMsg = '';
  let tried = [];

  for (const model of aiModelCandidates(body.model)) {
    tried.push(model);
    const payload = JSON.stringify(Object.assign({ model }, base));
    let upstream;
    try {
      upstream = await aiHttpRequest(ai.baseUrl + '/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer ' + aiKeyForModel(ai, model),
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
          'User-Agent': 'XJ-Store/1.0',
          Accept: wantStream ? 'text/event-stream' : 'application/json',
        },
        body: payload,
      });
    } catch (e) {
      lastStatus = 0;
      lastMsg = e.message || '连接上游失败';
      continue;
    }

    const up = upstream.res;

    if (up.statusCode >= 200 && up.statusCode < 300) {
      if (wantStream) {
        res.writeHead(200, {
          'Content-Type': 'text/event-stream; charset=utf-8',
          'Cache-Control': 'no-cache, no-transform',
          Connection: 'keep-alive',
          'X-Accel-Buffering': 'no',
          'Access-Control-Allow-Origin': '*',
          'X-XJ-Model': encodeURIComponent(model),
        });
        if (res.flushHeaders) res.flushHeaders();
        /* 浏览器断开 → 立刻断开上游，避免白烧 token */
        let closed = false;
        const abort = () => {
          if (closed) return;
          closed = true;
          up.destroy();
        };
        req.on('close', abort);
        up.setEncoding('utf8');
        up.on('data', c => { if (!res.writableEnded) res.write(c); });
        up.on('end', () => { if (!res.writableEnded) res.end(); });
        up.on('error', () => { if (!res.writableEnded) res.end(); });
        return;
      }

      const text = await readAllStream(up);
      up.resume();
      let json = {};
      try { json = JSON.parse(text || '{}'); } catch (e) { /* 保持空对象 */ }
      const choice = (json.choices || [])[0] || {};
      const msg = choice.message || {};
      const reply = typeof msg.content === 'string'
        ? msg.content
        : Array.isArray(msg.content) ? msg.content.map(c => (c && c.text) || '').join('') : '';
      if (!reply && json.error) {
        lastStatus = 502;
        lastMsg = json.error.message || '上游返回错误';
        continue;
      }
      return sendJSON(res, 200, {
        ok: true, reply, model, usage: json.usage || null,
        reasoning: msg.reasoning_content || '',
      });
    }

    const errText = await readAllStream(up, 4096);
    up.resume();
    lastStatus = up.statusCode;
    try {
      const j = JSON.parse(errText || '{}');
      lastMsg = (j.error && (j.error.message || j.error.type)) || errText.slice(0, 200);
    } catch (e) {
      lastMsg = String(errText || '').slice(0, 200) || ('HTTP ' + up.statusCode);
    }
    console.warn('[ai] 模型不可用', model, up.statusCode, lastMsg);

    /* 只有「通道类」错误才值得换模型；鉴权/参数错误换模型也没用 */
    if (![404, 408, 429, 500, 502, 503, 504].includes(up.statusCode)) break;
  }

  return sendJSON(res, 502, {
    ok: false,
    msg: '上游模型暂时不可用：' + (lastMsg || ('HTTP ' + lastStatus)),
    status: lastStatus,
    tried,
  });
}

/* 5.3 主路由 */
const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://' + (req.headers.host || 'localhost'));
  const pathname = u.pathname;
  const method = req.method;

  /* CORS 预检 */
  if (method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type,x-admin-token',
    });
    return res.end();
  }

  try {
    /* ---------- 商品与站点信息 ---------- */
    if (pathname === '/api/products') {
      // 列表接口永远返回原价，折扣只在下单计价时计算
      return sendJSON(res, 200, { ok: true, list: PRODUCTS });
    }
    if (pathname === '/api/categories') {
      return sendJSON(res, 200, { ok: true, list: CATEGORIES });
    }
    if (pathname === '/api/levels') {
      const dist = { svip: 0, lvip: 0, vip: 0, none: 0, '': 0 };
      ACCOUNTS.forEach(a => { dist[a.level || ''] = (dist[a.level || ''] || 0) + 1; });
      return sendJSON(res, 200, { ok: true, levels: LEVELS, distribution: dist });
    }
    if (pathname === '/api/ping') {
      // 只回报配置状态，绝不回传密钥明文
      return sendJSON(res, 200, {
        ok: true, mock: CFG.mock, pid: CFG.pid, apiBase: CFG.apiBase,
        signType: USE_RSA ? 'RSA' : 'MD5', rsaAlgo: CFG.rsaAlgo,
        md5KeySet: !!CFG.key, privateKeySet: !!RSA_PRIV, gatewayPublicKeySet: !!RSA_PUB,
      });
    }

    /* 支付能力 / 默认方式（对齐说明：/api/store/wechat/meta） */
    if (pathname === '/api/store/wechat/meta') {
      const ready = getStorePaymentReadiness();
      return sendJSON(res, 200, {
        ok: true,
        enabled: ready.enabled,
        provider: ready.provider,
        defaultPaymentMethod: ready.defaultPaymentMethod,
        methods: ALLOWED_GATE_TYPES,
        methodNames: METHOD_NAMES,
        hongxing: ready.hongxing,
        backupReady: ready.backup.ready,
        mock: CFG.mock,
      });
    }
    /* ---------- XJ AI ---------- */
    if (pathname === '/api/ai/meta' && method === 'GET') {
      const ai = getAiConfig();
      const list = await fetchAiModels(u.searchParams.get('refresh') === '1');
      /* 只放行白名单模型；上游返回的其它模型（gpt-5.5 等已失效）一律过滤掉 */
      const allowed = list.filter(m => !ai.allow.length || ai.allow.includes(m.id));
      const models = allowed.length
        ? allowed
        : ai.allow.map(id => ({ id, name: id }));
      /* 白名单里的模型即使上游没列出来也要展示（保证用户可选） */
      ai.allow.forEach(id => {
        if (!models.some(m => m.id === id)) models.push({ id, name: id });
      });
      /* 被禁用的模型前端不展示、服务端也不路由 */
      const visible = models.filter(m => !ai.disabled.includes(String(m.id)));
      const gate = aiAuthGate(u.searchParams.get('uid'), u.searchParams.get('token'));
      return sendJSON(res, 200, {
        ok: true,
        enabled: ai.ready && ai.enabled,
        aiEnabled: ai.enabled,
        disabledModels: ai.disabled,
        defaultModel: ai.model,
        fallbacks: ai.fallbacks,
        maxTokens: ai.maxTokens,
        models: visible,
        modelMeta: ai.meta,
        upstream: ai.baseUrl,
        /* 权限信息：前端据此显示门禁与徽章 */
        minLevel: ai.minLevel,
        minLevelName: (LEVELS[ai.minLevel] || {}).name || String(ai.minLevel).toUpperCase(),
        access: gate.ok
          ? { allowed: true, level: gate.level, levelName: gate.levelName, rate: gate.rate, isAdmin: gate.isAdmin, uid: gate.account.id }
          : { allowed: false, code: gate.code, msg: gate.msg, needLevel: gate.needLevel || null },
      });
    }
    if (pathname === '/api/ai/chat' && method === 'POST') {
      return handleAiChat(req, res);
    }
    /* XJ AI 智能推荐：基于商品热度 + 用户偏好 + 等级折扣，给出可购买的推荐位 */
    if (pathname === '/api/ai/recommend' && method === 'GET') {
      const ai = getAiConfig();
      if (!ai.enabled) return sendJSON(res, 503, { ok: false, msg: 'XJ AI 已临时关闭', code: 503 });
      const gate = aiAuthGate(u.searchParams.get('uid'), u.searchParams.get('token'));
      if (!gate.ok) {
        return sendJSON(res, gate.code, { ok: false, msg: gate.msg, needLevel: gate.needLevel || null, code: gate.code });
      }
      const limit = Math.min(6, Math.max(1, Number(u.searchParams.get('limit')) || 3));
      const list = recommendProducts(gate.account, limit);
      return sendJSON(res, 200, { ok: true, list, level: gate.level, rate: gate.rate });
    }
    /* XJ AI 最高权限：经营洞察（仅 ai_admin 权限位账号可用） */
    if (pathname === '/api/ai/insights' && method === 'GET') {
      const ai = getAiConfig();
      if (!ai.enabled) return sendJSON(res, 503, { ok: false, msg: 'XJ AI 已临时关闭', code: 503 });
      const gate = aiAuthGate(u.searchParams.get('uid'), u.searchParams.get('token'));
      if (!gate.ok) return sendJSON(res, gate.code, { ok: false, msg: gate.msg, code: gate.code });
      if (!gate.isAdmin) {
        return sendJSON(res, 403, { ok: false, msg: '需要 XJ AI 最高权限（ai_admin）才能查看经营洞察', code: 403 });
      }
      return sendJSON(res, 200, { ok: true, insights: buildInsightsContext(), level: gate.level });
    }

    if (pathname === '/api/site') {
      return sendJSON(res, 200, {
        ok: true,
        site: {
          name: STORE.name || 'XJ Store',
          announcement: STORE.announcement || '',
          maintenance: !!STORE.maintenance,
          maintenanceMsg: STORE.maintenanceMsg || '',
          popup: STORE.popup || null,
          background: STORE.background || null,
        },
      });
    }

    /* ---------- 会员账户 ---------- */
    /* ---------- Cap 人机验证：公开下发前端所需启用状态 / 实例 / 站点密钥（绝不下发 secretKey） ---------- */
    if (pathname === '/api/cap/config' && method === 'GET') {
      return sendJSON(res, 200, {
        enabled: !!(CFG.cap && CFG.cap.enabled),
        instance: (CFG.cap && CFG.cap.instance) || '',
        siteKey: (CFG.cap && CFG.cap.siteKey) || '',
      });
    }

    if (pathname === '/api/account/login' && method === 'POST') {
      const body = await readBody(req);
      const cap = await verifyCap(body);
      if (!cap.ok) return sendJSON(res, 403, { ok: false, msg: cap.msg });
      const { name, pwd } = body;
      const acct = ACCOUNTS.find(a => a.name === name || a.mail === name);
      if (!acct) return sendJSON(res, 404, { ok: false, msg: '账户不存在' });
      if (acct.banned) return sendJSON(res, 403, { ok: false, msg: '该账户已被封禁' });
      if (acct.pwd !== hashPwd(pwd)) return sendJSON(res, 403, { ok: false, msg: '密码错误' });
      acct.token = crypto.randomBytes(16).toString('hex');
      saveAccounts(ACCOUNTS);
      return sendJSON(res, 200, { ok: true, account: publicAccount(acct), token: acct.token });
    }

    if (pathname === '/api/account/register' && method === 'POST') {
      const { name, mail, pwd } = await readBody(req);
      if (!name || !mail || !pwd) return sendJSON(res, 400, { ok: false, msg: '请填写完整信息' });
      if (ACCOUNTS.find(a => a.name === name || a.mail === mail)) {
        return sendJSON(res, 400, { ok: false, msg: '用户名或邮箱已被注册' });
      }
      const acct = {
        id: (ACCOUNTS.reduce((m, a) => Math.max(m, a.id || 0), 0) + 1),
        name, mail, phone: '', contactType: 'mail', qq: '', wechat: '',
        level: 'none', point: 0, banned: false, perms: ['buy', 'comment', 'view'],
        createdAt: new Date().toISOString().slice(0, 10),
        pwd: hashPwd(pwd),
      };
      acct.token = crypto.randomBytes(16).toString('hex');
      ACCOUNTS.push(acct);
      saveAccounts(ACCOUNTS);
      return sendJSON(res, 200, { ok: true, account: publicAccount(acct), token: acct.token });
    }

    if (pathname === '/api/account/me' && method === 'GET') {
      const auth = authAccount(u.searchParams.get('uid'), u.searchParams.get('token'));
      if (!auth.ok) return sendJSON(res, auth.code, { ok: false, msg: auth.msg });
      return sendJSON(res, 200, { ok: true, account: publicAccount(auth.account) });
    }

    if (pathname === '/api/account/update' && method === 'POST') {
      const { uid, token, name, mail, phone, qq, wechat, contactType, pwd } = await readBody(req);
      const auth = authAccount(uid, token);
      if (!auth.ok) return sendJSON(res, auth.code, { ok: false, msg: auth.msg });
      const acct = auth.account;
      if (name) {
        const nm = String(name).trim();
        if (!nm) return sendJSON(res, 400, { ok: false, msg: '用户名不能为空' });
        if (ACCOUNTS.some(a => a.id !== acct.id && a.name === nm)) {
          return sendJSON(res, 400, { ok: false, msg: '用户名已被占用' });
        }
        acct.name = nm;
      }
      if (mail) {
        const ml = String(mail).trim();
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(ml)) return sendJSON(res, 400, { ok: false, msg: '邮箱格式不正确' });
        if (ACCOUNTS.some(a => a.id !== acct.id && a.mail === ml)) {
          return sendJSON(res, 400, { ok: false, msg: '邮箱已被占用' });
        }
        acct.mail = ml;
      }
      if (typeof phone !== 'undefined') acct.phone = String(phone || '');
      if (typeof qq !== 'undefined') acct.qq = String(qq || '');
      if (typeof wechat !== 'undefined') acct.wechat = String(wechat || '');
      if (contactType && ['qq', 'wechat', 'mail', 'phone'].includes(String(contactType))) acct.contactType = String(contactType);
      if (pwd) acct.pwd = hashPwd(pwd);
      saveAccounts(ACCOUNTS);
      return sendJSON(res, 200, { ok: true, account: publicAccount(acct) });
    }

    /* ---------- 星际互联：第三方应用接入 ---------- */
    if (pathname === '/api/stellar/issue' && method === 'POST') {
      const { uid, token, app } = await readBody(req);
      const acct = findAccount(uid);
      if (!acct || acct.banned) return sendJSON(res, 403, { ok: false, msg: '账户不可用' });
      if (!acct.token || acct.token !== String(token || '')) return sendJSON(res, 403, { ok: false, msg: '会话无效，请重新登录' });
      return sendJSON(res, 200, { ok: true, ticket: stellarTicket(uid, acct.token, app || '') });
    }
    if (pathname === '/api/stellar/verify' && method === 'POST') {
      const { ticket, app } = await readBody(req);
      if (!ticket || typeof ticket !== 'string' || ticket.indexOf('.') < 0) return sendJSON(res, 400, { ok: false, msg: '票据无效' });
      const parts = ticket.split('.');
      const b64 = parts[0], sig = parts[1];
      const expected = crypto.createHmac('sha256', CFG.stellarSecret).update(b64).digest('hex');
      let payload;
      try {
        const a = Buffer.from(expected, 'hex'), b = Buffer.from(sig, 'hex');
        if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) throw new Error('sig');
        payload = JSON.parse(Buffer.from(b64, 'base64url').toString('utf8'));
      } catch (e) { return sendJSON(res, 403, { ok: false, msg: '签名校验失败' }); }
      if (!payload.exp || payload.exp < Date.now()) return sendJSON(res, 403, { ok: false, msg: '票据已过期' });
      // 第三方应用票据：必须携带与票据绑定的 App Key，防止票据跨站复用
      if (payload.app) {
        if (!app || appIdOf(app) !== payload.app) return sendJSON(res, 403, { ok: false, msg: 'App Key 不匹配' });
      }
      const acct = findAccount(payload.uid);
      if (!acct || !acct.token || acct.token !== payload.token) return sendJSON(res, 403, { ok: false, msg: '会话已失效' });
      return sendJSON(res, 200, { ok: true, account: publicAccount(acct) });
    }
    if (pathname === '/api/stellar/appkey' && method === 'POST') {
      const { uid, token, rotate } = await readBody(req);
      const acct = findAccount(uid);
      if (!acct || acct.banned) return sendJSON(res, 403, { ok: false, msg: '账户不可用' });
      if (!acct.token || acct.token !== String(token || '')) return sendJSON(res, 403, { ok: false, msg: '会话无效，请重新登录' });
      if (rotate) { acct.appKey = crypto.randomBytes(24).toString('hex'); saveAccounts(ACCOUNTS); }
      else ensureAppKey(acct);
      return sendJSON(res, 200, { ok: true, appKey: acct.appKey, appId: appIdOf(acct.appKey) });
    }

    /* ---------- 收藏 / 购买记录 ---------- */
    if (pathname === '/api/account/favorites' && method === 'GET') {
      const auth = authAccount(u.searchParams.get('uid'), u.searchParams.get('token'));
      if (!auth.ok) return sendJSON(res, auth.code, { ok: false, msg: auth.msg });
      const acct = auth.account;
      const ids = (acct.favorites || []).map(String);
      const list = PRODUCTS.filter(p => ids.includes(String(p.id)))
        .map(p => ({
          id: p.id, title: p.title, sub: p.sub || '', price: p.price,
          emoji: p.emoji, color: p.color, image: p.image || '', cat: p.cat,
          status: p.status || '',
          specs: (p.specs || []).map(s => ({ name: s.name, price: s.price, stock: s.stock })),
        }));
      const alive = list.map(p => String(p.id));
      if (alive.length !== ids.length) { acct.favorites = alive; saveAccounts(ACCOUNTS); }
      return sendJSON(res, 200, { ok: true, list });
    }
    if (pathname === '/api/account/favorite' && method === 'POST') {
      const { uid, token, id } = await readBody(req);
      const auth = authAccount(uid, token);
      if (!auth.ok) return sendJSON(res, auth.code, { ok: false, msg: auth.msg });
      const acct = auth.account;
      if (!PRODUCTS.some(p => String(p.id) === String(id))) {
        return sendJSON(res, 404, { ok: false, msg: '商品不存在' });
      }
      const fav = Array.isArray(acct.favorites) ? acct.favorites.slice() : [];
      const sid = String(id);
      const i = fav.findIndex(x => String(x) === sid);
      let added;
      if (i >= 0) { fav.splice(i, 1); added = false; } else { fav.unshift(sid); added = true; }
      acct.favorites = fav;
      saveAccounts(ACCOUNTS);
      return sendJSON(res, 200, { ok: true, added, favorites: fav });
    }
    if (pathname === '/api/account/purchases' && method === 'GET') {
      const auth = authAccount(u.searchParams.get('uid'), u.searchParams.get('token'));
      if (!auth.ok) return sendJSON(res, auth.code, { ok: false, msg: auth.msg });
      const list = PURCHASES.filter(p => String(p.accountId) === String(auth.account.id)).slice(0, 50);
      return sendJSON(res, 200, { ok: true, list, total: list.length });
    }

    /* ---------- 商品互动 ---------- */
    if (pathname === '/api/interactions' && method === 'GET') {
      return sendJSON(res, 200, { ok: true, data: INTERACTIONS });
    }
    if (pathname === '/api/interactions/view' && method === 'POST') {
      const { id } = await readBody(req);
      const k = String(id);
      if (!INTERACTIONS[k]) INTERACTIONS[k] = { likes: 0, views: 0, comments: [] };
      INTERACTIONS[k].views = (INTERACTIONS[k].views || 0) + 1;
      saveInteractions(INTERACTIONS);
      return sendJSON(res, 200, { ok: true, item: INTERACTIONS[k] });
    }
    if (pathname === '/api/interactions/like' && method === 'POST') {
      const { id } = await readBody(req);
      const k = String(id);
      if (!INTERACTIONS[k]) INTERACTIONS[k] = { likes: 0, views: 0, comments: [] };
      INTERACTIONS[k].likes = (INTERACTIONS[k].likes || 0) + 1;
      saveInteractions(INTERACTIONS);
      return sendJSON(res, 200, { ok: true, item: INTERACTIONS[k] });
    }
    if (pathname === '/api/interactions/comment' && method === 'POST') {
      const { id, name, text } = await readBody(req);
      const k = String(id);
      if (!INTERACTIONS[k]) INTERACTIONS[k] = { likes: 0, views: 0, comments: [] };
      const t = String(text || '').trim();
      if (!t) return sendJSON(res, 400, { ok: false, msg: '评论内容不能为空' });
      INTERACTIONS[k].comments = INTERACTIONS[k].comments || [];
      INTERACTIONS[k].comments.unshift({
        name: String(name || '匿名').slice(0, 20),
        text: t.slice(0, 200),
        time: new Date().toISOString().slice(0, 10),
      });
      saveInteractions(INTERACTIONS);
      return sendJSON(res, 200, { ok: true, item: INTERACTIONS[k] });
    }

    /* ---------- 会员套餐（购买入口） ---------- */
    /* 可售套餐列表：公开，账号中心与账号管理页都靠它渲染 */
    if (pathname === '/api/member/plans' && method === 'GET') {
      const uid = u.searchParams.get('uid');
      const token = u.searchParams.get('token');
      const auth = uid ? authAccount(uid, token) : { ok: false };
      const cur = auth.ok ? effectiveLevel(auth.account) : '';
      const curExpire = auth.ok ? (auth.account.vipExpireAt || '') : '';
      const list = memberPlans().filter(p => p.active !== false).map(p => {
        const L = levelInfo(p.level);
        return {
          id: p.id, level: p.level, name: p.name, days: p.days, price: p.price,
          desc: p.desc || '', levelName: L.name, zhe: L.zhe, rate: L.rate, color: L.color,
          current: cur === p.level, upgrade: (LEVEL_RANK[p.level] || 0) > (LEVEL_RANK[cur] || 0),
        };
      });
      return sendJSON(res, 200, { ok: true, list, levels: LEVELS, current: cur, expireAt: curExpire });
    }

    /* 创建会员购买订单：服务端按套餐定价，不信任前端金额 */
    if (pathname === '/api/member/order' && method === 'POST') {
      const body = await readBody(req);
      const cap = await verifyCap(body);
      if (!cap.ok) return sendJSON(res, 403, { ok: false, msg: cap.msg });
      const { uid, token, planId, pay } = body;
      const auth = authAccount(uid, token);
      if (!auth.ok) return sendJSON(res, auth.code === 404 ? 401 : auth.code, { ok: false, msg: auth.code === 404 ? '请先登录后再购买会员' : auth.msg });
      const acct = auth.account;
      if (acct.banned) return sendJSON(res, 403, { ok: false, msg: '该账户已被封禁，无法购买会员' });
      const plan = findMemberPlan(planId);
      if (!plan) return sendJSON(res, 404, { ok: false, msg: '套餐不存在或已下架' });
      if (plan.active === false) return sendJSON(res, 400, { ok: false, msg: '该套餐已下架' });
      const price = Number(plan.price);
      if (!Number.isFinite(price) || price < 0) return sendJSON(res, 400, { ok: false, msg: '套餐价格异常' });

      const no = 'XJ' + Date.now().toString().slice(-10) + Math.floor(Math.random() * 90 + 10);
      const L = levelInfo(plan.level);
      const order = {
        no, kind: 'member', uid: acct.id, email: acct.mail,
        contactType: acct.contactType || 'mail',
        pay: pay || '',
        items: [{ id: 'member:' + plan.id, title: plan.name, spec: L.name, price, qty: 1, emoji: '👑', color: L.color }],
        member: { planId: plan.id, planName: plan.name, level: plan.level, days: plan.days, price },
        originalTotal: price, discount: 0, couponDiscount: 0, total: price,
        level: effectiveLevel(acct),
        status: 'pending',
        time: new Date().toLocaleString('zh-CN', { hour12: false }),
        serverTime: new Date().toLocaleString('zh-CN', { hour12: false }),
        cards: [],
      };
      const list = loadOrders();
      list.unshift(order);
      saveOrders(list);
      return sendJSON(res, 200, { ok: true, no, total: price, plan: { id: plan.id, name: plan.name, level: plan.level, days: plan.days } });
    }

    /* ---------- 优惠券预览 ---------- */
    if (pathname === '/api/coupon/validate' && method === 'POST') {
      const { code, amount, subtotal, level } = await readBody(req);
      const v = validateCoupon(code, Number(amount || 0), String(level || ''), Number(subtotal || amount || 0));
      if (!v.ok) return sendJSON(res, 200, { ok: false, valid: false, msg: v.reason });
      return sendJSON(res, 200, {
        ok: true, valid: true, discount: v.discount,
        coupon: { code: v.coupon.code, name: v.coupon.name, type: v.coupon.type, value: v.coupon.value },
      });
    }

    /* ---------- 卡密自助兑换 ---------- */
    if (pathname === '/api/card/redeem' && method === 'POST') {
      const { code, uid, token } = await readBody(req);
      const auth = authAccount(uid, token);
      if (!auth.ok) return sendJSON(res, auth.code === 404 ? 401 : auth.code, { ok: false, msg: auth.code === 404 ? '请先登录后再兑换' : auth.msg });
      const acct = auth.account;
      if (acct.banned) return sendJSON(res, 403, { ok: false, msg: '账户已被封禁，无法兑换' });
      const ccode = String(code || '').trim().toUpperCase();
      if (!ccode) return sendJSON(res, 400, { ok: false, msg: '请输入卡密' });
      let found = null, foundBatch = null;
      for (const b of (CARDS.batches || [])) {
        const k = (b.keys || []).find(x => String(x.code).toUpperCase() === ccode);
        if (k) { found = k; foundBatch = b; break; }
      }
      if (!found) return sendJSON(res, 400, { ok: false, msg: '卡密无效' });
      if (found.used) return sendJSON(res, 400, { ok: false, msg: '该卡密已被使用' });
      const reward = foundBatch && foundBatch.reward;
      if (!reward || !reward.type) {
        return sendJSON(res, 400, { ok: false, msg: '该卡密无可用权益（可能是订单发货码）' });
      }
      let desc = '';
      if (reward.type === 'point') {
        const add = Number(reward.point || 0);
        acct.point = (Number(acct.point) || 0) + add;
        desc = `积分 +${add}`;
      } else if (reward.type === 'level') {
        acct.level = reward.level;
        if (reward.days) {
          const exp = new Date(Date.now() + Number(reward.days) * 86400000);
          acct.vipExpireAt = exp.toISOString().slice(0, 10);
        }
        desc = `会员等级提升至 ${levelInfo(reward.level).name}`;
      } else {
        return sendJSON(res, 400, { ok: false, msg: '卡密权益类型不支持' });
      }
      found.used = true;
      found.usedBy = String(acct.id);
      found.usedAt = new Date().toISOString();
      found.orderNo = 'REDEEM';
      acct.redemptions = acct.redemptions || [];
      acct.redemptions.unshift({ code: found.code, desc, time: new Date().toISOString().slice(0, 10), batch: foundBatch.name || '' });
      saveAccounts(ACCOUNTS);
      saveCards(CARDS);
      return sendJSON(res, 200, {
        ok: true, desc, point: acct.point, level: acct.level,
        expireAt: acct.vipExpireAt || '', name: levelInfo(acct.level).name,
      });
    }

    /* ---------- 下单（服务端权威计价） ---------- */
    if (pathname === '/api/order' && method === 'POST') {
      if (STORE.maintenance) {
        return sendJSON(res, 503, { ok: false, msg: '站点维护中，暂不可下单' });
      }
      const order = await readBody(req);
      const cap = await verifyCap(order);
      if (!cap.ok) return sendJSON(res, 403, { ok: false, msg: cap.msg });
      if (!order.no || !Array.isArray(order.items) || !order.items.length) {
        return sendJSON(res, 400, { ok: false, msg: '订单数据不完整' });
      }
      // 按规格价重算单价，不信任前端传来的价格
      order.items = order.items.map(it => {
        const prod = PRODUCTS.find(p => String(p.id) === String(it.id)) || PRODUCTS.find(p => p.title === it.title);
        const spec = (prod && Array.isArray(prod.specs)) ? prod.specs.find(s => s.name === it.spec) : null;
        let unit = (spec && spec.price !== undefined && spec.price !== null && spec.price !== '') ? Number(spec.price) : NaN;
        if (!Number.isFinite(unit)) unit = prod ? Number(prod.price) : NaN;
        if (!Number.isFinite(unit)) unit = Number(it.price) || 0;
        return Object.assign({}, it, { price: unit });
      });
      const originalTotal = Number(order.items.reduce((s, it) => s + (Number(it.price) || 0) * (Number(it.qty) || 0), 0).toFixed(2));
      const uid = order.uid;
      const acct = uid ? findAccount(uid) : null;
      if (acct && acct.banned) {
        return sendJSON(res, 403, { ok: false, msg: '该账户已被封禁，无法下单' });
      }
      for (const it of order.items) {
        const prod = PRODUCTS.find(p => String(p.id) === String(it.id)) || PRODUCTS.find(p => p.title === it.title);
        if (prod && prod.status === 'off') {
          return sendJSON(res, 400, { ok: false, msg: `商品「${it.title}」已下架，无法下单` });
        }
      }
      const level = acct ? effectiveLevel(acct) : '';
      const rate = levelRate(level);
      const discount = Number((originalTotal * (1 - rate)).toFixed(2));
      const afterMember = Number((originalTotal * rate).toFixed(2));

      /* 优惠券在会员折扣之后叠加（仅当券有效才计入，否则忽略，不阻断下单） */
      let couponDiscount = 0;
      let couponInfo = null;
      if (order.coupon) {
        const v = validateCoupon(order.coupon, afterMember, level, originalTotal);
        if (v.ok) {
          couponDiscount = v.discount;
          couponInfo = { code: v.coupon.code, name: v.coupon.name, type: v.coupon.type, value: v.coupon.value, discount: couponDiscount };
          v.coupon.used = (Number(v.coupon.used || 0) + 1);
          saveCoupons(COUPONS);
        }
      }
      const total = Number((afterMember - couponDiscount).toFixed(2));

      order.originalTotal = originalTotal;
      order.level = level;
      order.discount = discount;
      order.coupon = couponInfo;
      order.couponDiscount = couponDiscount;
      order.total = total;
      order.status = order.status || 'pending';
      order.serverTime = new Date().toLocaleString('zh-CN', { hour12: false });

      /* 卡密：按购买数量发放对应张数（买几份给几张） */
      order.cards = [];
      for (const it of order.items) {
        const qty = Number(it.qty) || 1;
        for (let k = 0; k < qty; k++) {
          const drawn = drawCard(it.title, order.no);
          const code = drawn || ('XJ-' + Math.random().toString(36).slice(2, 10).toUpperCase());
          order.cards.push(`${it.title}｜${it.spec || ''}｜卡密：${code}`);
        }
      }

      const list = loadOrders();
      const idx = list.findIndex(o => o.no === order.no);
      if (idx >= 0) list[idx] = order; else list.unshift(order);
      saveOrders(list);

      /* 同步写入会员购买记录（仅当为折扣会员时计入对应等级） */
      if (acct && rate < 1) {
        PURCHASES.unshift({
          id: (PURCHASES.reduce((m, p) => Math.max(m, p.id || 0), 0) + 1),
          accountId: acct.id, accountName: acct.name, level: String(level),
          productTitle: (order.items[0] && order.items[0].title) || '',
          amount: total, pay: order.pay || '', time: order.time || order.serverTime,
        });
        savePurchases(PURCHASES);
      }
      return sendJSON(res, 200, { ok: true, no: order.no, originalTotal, discount, couponDiscount, total, level });
    }

    if (pathname === '/api/order' && method === 'GET') {
      const no = u.searchParams.get('no');
      const mail = u.searchParams.get('mail');
      let list = loadOrders();
      if (no) list = list.filter(o => o.no === no);
      else if (mail) list = list.filter(o => (o.email || '').toLowerCase() === mail.toLowerCase());
      return sendJSON(res, 200, { ok: true, list });
    }

    /* ---------- 发起支付 ---------- */
    if (pathname === '/api/pay' || pathname === '/api/store/wechat/native-order') {
      const no = u.searchParams.get('no');
      /* 通道 type 优先级（修复，对齐说明 :4857）：用户所选 → 配置 payType → 兜底 wxpay。
         之前硬编码 usdt 导致配置被忽略、且商户未开 usdt 通道时永远下单失败。 */
      const rawType = String(u.searchParams.get('type') || '').toLowerCase();
      const displayType = normalizePaymentMethod(rawType) || 'wxpay';
      const gateType = normalizePaymentMethod(rawType) || (CFG.payType || 'wxpay');
      const list = loadOrders();
      const order = list.find(o => o.no === no);
      if (!order) return sendJSON(res, 404, { ok: false, msg: '订单不存在，请先提交订单' });

      const base = requestBase(req);
      const notifyUrl = CFG.notifyUrl || `${base}/api/notify`;
      /* 会员订单支付完成后回到账号中心，方便立即查看新等级 */
      const returnUrl = order.kind === 'member'
        ? (CFG.returnUrl || `${base}/account-center.html?upgraded=1`)
        : (CFG.returnUrl || `${base}/order.html?no=${encodeURIComponent(no)}`);

      const params = {
        pid: CFG.pid, type: gateType, out_trade_no: order.no,
        notify_url: notifyUrl, return_url: returnUrl,
        name: (order.items && order.items[0] && order.items[0].title) || 'XJ Store 商品',
        money: Number(order.total).toFixed(2),
        sitename: CFG.sitename,
      };

      if (CFG.mock) {
        markPaid(order, order.pay || METHOD_NAMES[displayType] || displayType, 'MOCK' + Date.now());
        saveOrders(list);
        return sendJSON(res, 200, {
          ok: true, mock: true,
          payUrl: `${base}/order.html?no=${encodeURIComponent(no)}&mock=1`,
          params, sign: makeSign(params).sign,
        });
      }

      const signed = makeSign(params);
      params.sign = signed.sign;
      params.sign_type = signed.signType;
      const qs = Object.keys(params).map(k => `${k}=${encodeURIComponent(params[k])}`).join('&');

      /* POST 提交：返回目标地址与已签名参数，由前端自动提交隐藏表单（兼容「root + POST」写法）；
         其余情况保持 GET 跳转（已验证可用的 apiBase+submitPath 拼接） */
      if (CFG.payMethod === 'POST') {
        const target = CFG.createUrl || `${CFG.apiBase}${CFG.submitPath}`;
        return sendJSON(res, 200, { ok: true, payMethod: 'POST', payUrl: target, payParams: params });
      }
      return sendJSON(res, 200, { ok: true, payUrl: `${CFG.apiBase}${CFG.submitPath}?${qs}` });
    }

    /* ---------- 支付回调 ---------- */
    if (pathname === '/api/notify' || pathname === '/api/store/wechat/notify') {
      const p = {};
      u.searchParams.forEach((v, k) => { p[k] = v; });
      if (method === 'POST') {
        const b = await readBody(req);
        return handleNotify(Object.assign(b, p), res);
      }
      return handleNotify(p, res);
    }

    /* 订单状态查询（对齐说明：/api/store/wechat/order-status） */
    if (pathname === '/api/store/wechat/order-status') {
      const no = u.searchParams.get('no');
      if (!no) return sendJSON(res, 400, { ok: false, msg: '缺少订单号' });
      const order = loadOrders().find(o => o.no === no);
      if (!order) return sendJSON(res, 404, { ok: false, msg: '订单不存在' });
      const paid = order.status === 'paid';
      return sendJSON(res, 200, {
        ok: true, no, status: order.status || 'pending', paid,
        pay: order.pay || '', total: order.total, time: order.time || order.serverTime || '',
      });
    }

    /* ---------- 管理后台 ---------- */
    if (pathname === '/api/admin/login' && method === 'POST') {
      const { user, pass } = await readBody(req);
      if (user !== ADMIN.user) return sendJSON(res, 403, { ok: false, msg: '该账号无权进入管理后台' });
      if (hashPass(String(pass || ''), ADMIN.salt) !== ADMIN.hash) {
        return sendJSON(res, 403, { ok: false, msg: '密码错误' });
      }
      return sendJSON(res, 200, { ok: true, token: newAdminToken(), user: ADMIN.user });
    }

    if (pathname.startsWith('/api/admin/')) {
      if (!checkAdminAuth(req, u)) return sendJSON(res, 401, { ok: false, msg: '未登录或登录已过期' });

      /* 图片上传：base64 落盘到 assets/uploads */
      if (pathname === '/api/admin/upload' && method === 'POST') {
        const b = await readBody(req);
        const m = String(b.data || '').match(/^data:image\/(png|jpeg|jpg|webp|gif);base64,([A-Za-z0-9+/=]+)$/);
        if (!m) return sendJSON(res, 400, { ok: false, msg: '仅支持 png / jpg / webp / gif 图片' });
        const type = m[1] === 'jpg' ? 'jpeg' : m[1];
        const buf = Buffer.from(m[2], 'base64');
        if (!buf.length) return sendJSON(res, 400, { ok: false, msg: '图片内容为空' });
        if (buf.length > 5 * 1024 * 1024) return sendJSON(res, 400, { ok: false, msg: '图片不能超过 5MB' });
        const upDir = path.join(ROOT, 'assets', 'uploads');
        try { fs.mkdirSync(upDir, { recursive: true }); } catch (e) {}
        const ext = type === 'jpeg' ? '.jpg' : ('.' + type);
        const name = 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6) + ext;
        fs.writeFileSync(path.join(upDir, name), buf);
        return sendJSON(res, 200, { ok: true, url: 'assets/uploads/' + name });
      }

      if (pathname === '/api/admin/state') {
        // config 中的密钥不下发明文，仅回报是否已配置
        const safeConfig = Object.assign({}, cfgRaw);
        delete safeConfig.key;
        delete safeConfig.honglingPayApiKey;
        delete safeConfig.stellarSecret;
        delete safeConfig.aiApiKey; /* XJ AI 密钥同样不下发明文 */
        delete safeConfig.aiModelKeys; /* 模型专属密钥映射（DeepSeek 等分组 key）不下发明文 */
        safeConfig.aiModelKeysSet = Object.keys(cfgRaw.aiModelKeys || {}).length; /* 已配专属密钥的模型数 */
        /* 兼容后台旧表单字段：把 honglingPay* 映射成展示字段 */
        safeConfig.apiBase = cfgRaw.apiBase || cfgRaw.honglingPayCreateUrl || '';
        safeConfig.submitPath = CFG.submitPath;
        safeConfig.pid = CFG.pid;
        safeConfig.signType = String(cfgRaw.honglingPaySignType || cfgRaw.signType || 'MD5').toUpperCase();
        safeConfig.notifyUrl = CFG.notifyUrl;
        safeConfig.returnUrl = CFG.returnUrl;
        safeConfig.keySet = !!CFG.key;
        safeConfig.stellarSecretSet = !!cfgRaw.stellarSecret;
        safeConfig.aiKeySet = !!(cfgRaw.aiApiKey || process.env.XJ_AI_API_KEY);
        return sendJSON(res, 200, {
          ok: true,
          admin: { user: ADMIN.user },
          config: safeConfig,
          products: PRODUCTS,
          categories: CATEGORIES,
          orders: loadOrders(),
          levels: LEVELS,
          memberPlans: memberPlans(),
          runtime: {
            signType: USE_RSA ? 'RSA' : 'MD5',
            mock: CFG.mock,
            privateKeySet: !!RSA_PRIV,
            gatewayPublicKeySet: !!RSA_PUB,
          },
        });
      }

      if (pathname === '/api/admin/categories' && method === 'POST') {
        const list = (await readBody(req)).list;
        if (!Array.isArray(list)) return sendJSON(res, 400, { ok: false, msg: '数据格式错误' });
        const clean = [];
        for (const c of list) {
          if (!c || !c.id || !String(c.name || '').trim()) continue;
          clean.push({ id: String(c.id).trim(), name: String(c.name).trim(), icon: String(c.icon || 'grid').trim() });
        }
        const seen = new Set();
        for (const c of clean) {
          if (seen.has(c.id)) return sendJSON(res, 400, { ok: false, msg: `分类标识「${c.id}」重复` });
          seen.add(c.id);
        }
        saveCategories(clean);
        return sendJSON(res, 200, { ok: true, count: CATEGORIES.length });
      }

      if (pathname === '/api/admin/products' && method === 'POST') {
        const list = (await readBody(req)).list;
        if (!Array.isArray(list)) return sendJSON(res, 400, { ok: false, msg: '数据格式错误' });
        saveProducts(list.filter(p => p && p.id != null));
        return sendJSON(res, 200, { ok: true, count: PRODUCTS.length });
      }

      if (pathname === '/api/admin/config' && method === 'POST') {
        const patch = (await readBody(req)).config || {};
        /* 后台表单仍用旧字段名，这里翻译成 honglingPay* 写回，保持配置文件格式统一 */
        const next = Object.assign({}, cfgRaw);
        Object.keys(patch).forEach(k => {
          if (k === 'aiApiKey' && !String(patch[k] || '').trim()) return; /* 留空表示不改 XJ AI 密钥 */
          if (k === 'aiModelKeys') return; /* 模型专属密钥映射暂不开放后台编辑（防止脱敏值回写），改请直接编辑 config.json */
          if (k === 'apiBase') {
            const v = String(patch[k] || '').replace(/\/+$/, '');
            next.honglingPayCreateUrl = v ? v + '/' : '';   /* 存成站点根，加载时自动补 submitPath */
          } else if (k === 'pid') { next.honglingPayMerchantId = patch[k];
          } else if (k === 'key') { next.honglingPayApiKey = patch[k];
          } else if (k === 'signType') { next.honglingPaySignType = patch[k];
          } else if (k === 'notifyUrl') { next.honglingPayNotifyUrl = patch[k];
          } else if (k === 'returnUrl') { next.honglingPayReturnUrl = patch[k];
          } else if (k === 'queryUrl') { next.honglingPayQueryUrl = patch[k];
          } else { next[k] = patch[k]; }  /* submitPath / sitename / rsaAlgo / mock / payType */
        });
        writeJson(CONFIG_FILE, next);
        reloadConfig();
        return sendJSON(res, 200, { ok: true, runtime: { signType: USE_RSA ? 'RSA' : 'MD5', mock: CFG.mock } });
      }

      if (pathname === '/api/admin/password' && method === 'POST') {
        const { oldPass, newPass } = await readBody(req);
        if (hashPass(String(oldPass || ''), ADMIN.salt) !== ADMIN.hash) {
          return sendJSON(res, 403, { ok: false, msg: '原密码不正确' });
        }
        if (!newPass || String(newPass).length < 6) {
          return sendJSON(res, 400, { ok: false, msg: '新密码至少 6 位' });
        }
        const salt = crypto.randomBytes(8).toString('hex');
        ADMIN = { user: ADMIN.user, salt, hash: hashPass(String(newPass), salt) };
        writeJson(FILES.admin, ADMIN);
        ADMIN_TOKENS.clear();
        return sendJSON(res, 200, { ok: true, msg: '密码已更新，请重新登录' });
      }

      if (pathname === '/api/admin/accounts' && method === 'GET') {
        const q = (u.searchParams.get('q') || '').trim().toLowerCase();
        const banned = u.searchParams.get('banned');
        let list = ACCOUNTS.slice();
        if (q) list = list.filter(a => (a.name + a.mail + a.phone).toLowerCase().includes(q));
        if (banned === '1') list = list.filter(a => a.banned);
        if (banned === '0') list = list.filter(a => !a.banned);
        return sendJSON(res, 200, { ok: true, list, total: ACCOUNTS.length });
      }
      if (pathname === '/api/admin/member/plans' && method === 'GET') {
        return sendJSON(res, 200, { ok: true, plans: memberPlans(), levels: LEVELS });
      }
      if (pathname === '/api/admin/member/plans' && method === 'POST') {
        const { plans } = await readBody(req);
        const next = normalizeMemberPlans(plans);
        const cfg = Object.assign({}, cfgRaw);
        cfg.memberPlans = next;
        writeJson(CONFIG_FILE, cfg);
        reloadConfig();
        return sendJSON(res, 200, { ok: true, plans: memberPlans() });
      }
      /* 手动开通/续期会员（后台赠送或线下收款后补录） */
      if (pathname === '/api/admin/member/grant' && method === 'POST') {
        const { id, level, days, mode } = await readBody(req);
        const acct = findAccount(id);
        if (!acct) return sendJSON(res, 404, { ok: false, msg: '账户不存在' });
        const lv = String(level || '');
        if (!LEVELS[lv]) return sendJSON(res, 400, { ok: false, msg: '会员等级不合法' });
        const d = Math.max(0, Math.round(Number(days) || 0));
        if (mode === 'permanent') {
          acct.level = lv;
          acct.levelTimed = false;
          acct.vipExpireAt = '';
        } else {
          const plan = { id: 'admin', planName: '后台开通 ' + levelInfo(lv).name, level: lv, days: d || 30 };
          const grant = applyMemberPurchase(acct, plan);
          acct.levelTimed = true;
          saveAccounts(ACCOUNTS);
          return sendJSON(res, 200, { ok: true, account: publicAccount(acct), grant });
        }
        saveAccounts(ACCOUNTS);
        return sendJSON(res, 200, { ok: true, account: publicAccount(acct) });
      }

      if (pathname === '/api/admin/accounts' && method === 'POST') {
        const { id, patch } = await readBody(req);
        const acct = findAccount(id);
        if (!acct) return sendJSON(res, 404, { ok: false, msg: '账户不存在' });
        Object.assign(acct, patch);
        saveAccounts(ACCOUNTS);
        return sendJSON(res, 200, { ok: true, account: publicAccount(acct) });
      }
      if (pathname === '/api/admin/accounts/batch' && method === 'POST') {
        const { ids, action } = await readBody(req);
        if (!Array.isArray(ids) || !action) return sendJSON(res, 400, { ok: false, msg: '参数错误' });
        let n = 0;
        ACCOUNTS.forEach(a => {
          if (!ids.includes(a.id)) return;
          if (action.level !== undefined) a.level = action.level;
          if (action.banned !== undefined) a.banned = !!action.banned;
          if (action.pointSet !== undefined) a.point = Number(action.pointSet) || 0;
          if (action.pointDelta !== undefined) a.point = Math.max(0, (a.point || 0) + Number(action.pointDelta));
          if (action.permsAdd) a.perms = Array.from(new Set([...(a.perms || []), ...action.permsAdd]));
          if (action.permsRemove) a.perms = (a.perms || []).filter(p => !action.permsRemove.includes(p));
          n++;
        });
        saveAccounts(ACCOUNTS);
        return sendJSON(res, 200, { ok: true, updated: n });
      }

      if (pathname === '/api/admin/purchases' && method === 'GET') {
        return sendJSON(res, 200, { ok: true, list: PURCHASES, total: PURCHASES.length });
      }

      if (pathname === '/api/admin/coupons' && method === 'GET') {
        return sendJSON(res, 200, { ok: true, list: COUPONS });
      }
      if (pathname === '/api/admin/coupons' && method === 'POST') {
        const list = (await readBody(req)).list;
        if (!Array.isArray(list)) return sendJSON(res, 400, { ok: false, msg: '数据格式错误' });
        saveCoupons(list);
        return sendJSON(res, 200, { ok: true, count: COUPONS.length });
      }

      if (pathname === '/api/admin/cards' && method === 'GET') {
        return sendJSON(res, 200, { ok: true, batches: CARDS.batches || [], issued: issuedCards() });
      }
      if (pathname === '/api/admin/cards/generate' && method === 'POST') {
        const { name, count } = await readBody(req);
        const n = Math.max(1, Math.min(500, Number(count) || 10));
        const keys = [];
        for (let i = 0; i < n; i++) {
          keys.push({
            code: 'XJ-' + crypto.randomBytes(5).toString('hex').toUpperCase().slice(0, 10),
            used: false, usedBy: '', usedAt: '', orderNo: '', productTitle: '',
          });
        }
        const batch = {
          id: (CARDS.batches || []).reduce((m, b) => Math.max(m, b.id || 0), 0) + 1,
          name: name || ('批次 ' + new Date().toLocaleString('zh-CN')),
          createdAt: new Date().toISOString().slice(0, 10), keys,
        };
        CARDS.batches = CARDS.batches || [];
        CARDS.batches.unshift(batch);
        saveCards(CARDS);
        return sendJSON(res, 200, { ok: true, batch });
      }
      if (pathname === '/api/admin/cards' && method === 'POST') {
        const v = await readBody(req);
        if (v.batches) { CARDS.batches = v.batches; saveCards(CARDS); }
        return sendJSON(res, 200, { ok: true });
      }

      if (pathname === '/api/admin/interactions' && method === 'GET') {
        return sendJSON(res, 200, { ok: true, data: INTERACTIONS });
      }
      if (pathname === '/api/admin/interactions' && method === 'POST') {
        const body = await readBody(req);
        if (body.action === 'deleteComment') {
          const it = INTERACTIONS[String(body.productId)];
          if (it && it.comments) { it.comments.splice(Number(body.index), 1); saveInteractions(INTERACTIONS); }
          return sendJSON(res, 200, { ok: true });
        }
        if (body.action === 'reset') {
          delete INTERACTIONS[String(body.productId)];
          saveInteractions(INTERACTIONS);
          return sendJSON(res, 200, { ok: true });
        }
        if (body.data) { INTERACTIONS = body.data; saveInteractions(INTERACTIONS); }
        return sendJSON(res, 200, { ok: true });
      }

      if (pathname === '/api/admin/store' && method === 'GET') {
        return sendJSON(res, 200, { ok: true, store: STORE });
      }
      if (pathname === '/api/admin/store' && method === 'POST') {
        const patch = (await readBody(req)).store || {};
        STORE = Object.assign({}, STORE, patch);
        saveStore(STORE);
        return sendJSON(res, 200, { ok: true, store: STORE });
      }

      if (pathname === '/api/admin/dashboard' && method === 'GET') {
        const dist = { svip: 0, lvip: 0, vip: 0, none: 0, '': 0 };
        ACCOUNTS.forEach(a => { dist[a.level || ''] = (dist[a.level || ''] || 0) + 1; });
        const pDist = { svip: 0, lvip: 0, vip: 0 };
        PURCHASES.forEach(p => { if (pDist[p.level] !== undefined) pDist[p.level]++; });
        const orders = loadOrders();
        const revenue = orders.filter(o => o.status === 'paid').reduce((s, o) => s + (Number(o.total) || 0), 0);
        const cardIssued = issuedCards().length;
        const cardPool = (CARDS.batches || []).reduce((s, b) => s + (b.keys || []).length, 0);
        const intTotal = Object.values(INTERACTIONS).reduce((s, it) => s + (it.likes || 0) + (it.views || 0) + ((it.comments || []).length), 0);
        return sendJSON(res, 200, {
          ok: true,
          stats: {
            accountTotal: ACCOUNTS.length,
            distribution: dist,
            purchaseTotal: PURCHASES.length,
            purchaseByLevel: pDist,
            orderTotal: orders.length,
            paidOrderTotal: orders.filter(o => o.status === 'paid').length,
            revenue: Number(revenue.toFixed(2)),
            productTotal: PRODUCTS.length,
            couponTotal: COUPONS.length,
            cardIssued, cardPool,
            interactionTotal: intTotal,
          },
        });
      }

      return sendJSON(res, 404, { ok: false, msg: '未知接口' });
    }

    /* 非 API 路径交给静态托管 */
    return serveStatic(req, res, pathname);
  } catch (err) {
    console.error('[error] 处理请求异常', pathname, err);
    if (!res.headersSent) return sendJSON(res, 500, { ok: false, msg: '服务器内部错误' });
    try { res.end(); } catch (e) {}
  }
});

/* ============================================================
   6. 启动
   ============================================================ */

const PORT = Number(process.argv[2] || process.env.PORT || 8080);
server.listen(PORT, () => {
  console.log('XJ Store 服务已启动');
  console.log('  站点   http://localhost:' + PORT + '/');
  console.log('  后台   http://localhost:' + PORT + '/admin.html');
  console.log('  管理员 ' + ADMIN.user);
  console.log('  支付   ' + (CFG.mock ? '本地演练模式' : CFG.apiBase) + ' / 商户号 ' + CFG.pid);
  console.log('  签名   ' + (USE_RSA ? 'RSA（' + CFG.rsaAlgo + '）' : 'MD5'));
  if (USE_RSA && !RSA_PUB) console.log('  警告   未配置平台公钥，回调验签会失败');
});
