#!/usr/bin/env node
/* 支付通道探测工具（对齐说明：scripts/check-payment-channel.js）
 *
 * 逐个 type 打真实网关 submit.php，根据返回文案判断该商户开通了哪些通道。
 * 注意：
 *  - 会向网关产生 PROBE 开头的【未支付】订单，不会真实扣款；
 *  - 标准易支付验签用的是【原始值】拼接（中文/空格原样），不要做 URL 编码——否则永远「签名计算失败」；
 *  - ThinkPHP 网关必须带 User-Agent 头，否则 500（Undefined array key "HTTP_USER_AGENT"）；
 *  - 请求间有间隔，避免高频触发网关限流/把商户 IP 打黑。
 *
 * 用法：
 *   node scripts/check-payment-channel.js main 15.00     # 主通道（红行 dash.bxyvps.cn）
 *   node scripts/check-payment-channel.js backup 15.00   # 备用通道（七香 api.payqixiang.cn）
 */

const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');
const CONFIG_FILE = path.join(ROOT, 'server', 'config.json');

function readConfig() {
  let raw = {};
  try { raw = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8')); } catch (e) { raw = {}; }
  // 读 .env 不覆盖已有环境变量
  try {
    const env = fs.readFileSync(path.join(ROOT, '.env'), 'utf8');
    env.split(/\r?\n/).forEach(line => {
      const t = line.trim();
      if (!t || t.startsWith('#')) return;
      const i = t.indexOf('=');
      if (i < 0) return;
      const k = t.slice(0, i).trim();
      const v = t.slice(i + 1).trim().replace(/^["']|["']$/g, '');
      if (k && process.env[k] === undefined) process.env[k] = v;
    });
  } catch (e) { /* 无 .env 也可 */ }

  const pick = (envKey, ...fields) => {
    const e = process.env[envKey];
    if (e !== undefined && e !== null && String(e) !== '') return e;
    for (const f of fields) {
      const v = raw[f];
      if (v !== undefined && v !== null && String(v) !== '') return v;
    }
    return '';
  };

  const rawApiBase = String(pick('XJ_PAY_API', 'apiBase')).replace(/\/+$/, '');
  const rawCreate = String(pick('XJ_PAY_CREATE_URL', 'honglingPayCreateUrl', 'createUrl')).trim();
  let createUrl;
  if (!rawCreate) createUrl = rawApiBase ? rawApiBase + '/submit.php' : '';
  else if (/\/$/.test(rawCreate)) createUrl = rawCreate.replace(/\/+$/, '') + '/submit.php';
  else createUrl = rawCreate;

  const main = {
    label: '红行支付 (dash.bxyvps.cn)',
    merchantId: pick('XJ_PAY_PID', 'honglingPayMerchantId', 'pid'),
    apiKey: pick('XJ_PAY_KEY', 'honglingPayApiKey', 'key'),
    createUrl,
    signType: String(pick('honglingPaySignType', 'signType', 'MD5')),
    payType: String(pick('payType', 'usdt')).toLowerCase(),
  };

  const backup = {
    label: '七香支付 (api.payqixiang.cn)',
    merchantId: pick('WECHAT_BACKUP_MERCHANT_ID', 'wechatPayBackupMerchantId', 'wechatPayBackupPid'),
    apiKey: pick('WECHAT_BACKUP_API_KEY', 'wechatPayBackupApiKey', 'wechatPayBackupKey'),
    createUrl: String(pick('WECHAT_BACKUP_CREATE_URL', 'wechatPayBackupCreateUrl', 'wechatPayBackupUrl')).trim(),
    signType: 'MD5',
  };

  return { main, backup };
}

function buildSign(params, key) {
  const keys = Object.keys(params)
    .filter(k => k !== 'sign' && k !== 'sign_type')
    .filter(k => params[k] !== '' && params[k] !== undefined && params[k] !== null)
    .sort();
  const str = keys.map(k => `${k}=${params[k]}`).join('&') + key; // 原始值拼接，不编码
  return crypto.createHash('md5').update(str, 'utf8').digest('hex');
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function classify(body, status) {
  if (status === 302) return 'OPEN（302 跳转收银台，通道可用）';
  if (/签名计算失败|sign|密钥/.test(body)) return 'SIGN_FAIL（签名/密钥不对）';
  if (/商户不存在|merchant|pid/.test(body)) return 'MERCHANT_NOT_FOUND（商户号不对）';
  if (/无可用通道|未开通|没有开通|支付渠道/.test(body)) return 'CHANNEL_NOT_OPEN（该通道未开通）';
  if (/系统发生错误|thinkphp|exception|sql/i.test(body)) return 'SYS_ERROR（网关异常/限流/重复单号）';
  if (/支付|二维码|scan|qrcode|redirect|submit|订单/i.test(body)) return 'OPEN（疑似可用，需人工确认跳转/二维码）';
  return 'UNKNOWN（返回内容无明确特征，见下方原文）';
}

function postGateway(url, params) {
  return new Promise((resolve) => {
    let u;
    try { u = new URL(url); } catch (e) { return resolve({ err: 'URL 非法: ' + url }); }
    const bodyStr = Object.keys(params).map(k => `${k}=${encodeURIComponent(params[k])}`).join('&');
    const lib = u.protocol === 'https:' ? https : http;
    const opt = {
      method: 'POST',
      hostname: u.hostname,
      port: u.port || (u.protocol === 'https:' ? 443 : 80),
      path: u.pathname + u.search,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120 Safari/537.36',
        'Referer': 'http://localhost/checkout.html',
      },
    };
    const req = lib.request(opt, (r) => {
      let d = '';
      r.on('data', c => d += c);
      r.on('end', () => resolve({ status: r.statusCode, body: d }));
    });
    req.on('error', e => resolve({ err: String(e) }));
    req.write(bodyStr);
    req.end();
  });
}

async function probeChannel(cfg, type, money) {
  const outTradeNo = 'PROBE' + Date.now() + Math.floor(Math.random() * 1000);
  const params = {
    pid: cfg.merchantId,
    type,
    out_trade_no: outTradeNo,
    notify_url: 'http://localhost/api/notify',
    return_url: 'http://localhost/order.html?no=' + outTradeNo,
    name: '通道探测',
    money: Number(money || '0.01').toFixed(2),
    sitename: 'XJ Store',
  };
  const sign = buildSign(params, cfg.apiKey);
  params.sign = sign;
  params.sign_type = String(cfg.signType || 'MD5').toUpperCase();
  const res = await postGateway(cfg.createUrl, params);
  if (res.err) return { type, result: 'REQ_ERR', detail: res.err };
  const result = classify(res.body, res.status);
  return { type, result, http: res.status, snippet: res.body.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120) };
}

async function run(which, money) {
  const cfgAll = readConfig();
  const cfg = which === 'backup' ? cfgAll.backup : cfgAll.main;
  console.log(`\n=== 探测目标：${cfg.label} ===`);
  if (!cfg.merchantId || !cfg.apiKey || !cfg.createUrl) {
    console.log('配置未就绪（merchantId / apiKey / createUrl 缺失），跳过。');
    console.log(`  merchantId=${cfg.merchantId || '(空)'}  createUrl=${cfg.createUrl || '(空)'}`);
    return;
  }
  console.log(`  merchantId=${cfg.merchantId}  createUrl=${cfg.createUrl}  signType=${cfg.signType}`);

  const types = which === 'backup'
    ? ['wxpay']
    : ['alipay', 'wxpay', 'qqpay', 'usdt', 'bank', 'alipay_hk'];
  for (const t of types) {
    const r = await probeChannel(cfg, t, money);
    console.log(`  [${t}]  ->  ${r.result}${r.http ? '  (HTTP ' + r.http + ')' : ''}`);
    if (r.snippet && /UNKNOWN|SYS_ERROR|OPEN/.test(r.result)) console.log(`         原文: ${r.snippet}`);
    await sleep(1500); // 间隔，避免高频触发限流
  }
}

(async () => {
  const which = (process.argv[2] || 'main').toLowerCase();
  const money = process.argv[3] || '15.00';
  if (!['main', 'backup'].includes(which)) {
    console.log('用法：');
    console.log('  node scripts/check-payment-channel.js main 15.00');
    console.log('  node scripts/check-payment-channel.js backup 15.00');
    process.exit(1);
  }
  await run(which, money);
  console.log('\n探测完成（PROBE 开头订单均为未支付，不会真实扣款）。');
})();
