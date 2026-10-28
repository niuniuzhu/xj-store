/* ============================================================
   XJ Store · 数据种子
   生成会员账户 / 购买记录 / 折扣券 / 卡密池 / 商品互动 / 商店设置
   运行： node server/seed.js            （仅当文件不存在时创建）
          node server/seed.js --force    （强制覆盖重建）
   ============================================================ */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_DIR = path.join(__dirname, 'data');
const FORCE = process.argv.includes('--force');

/* 确定性随机，保证可重复生成 */
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rnd = mulberry32(20261010);
const pick = arr => arr[Math.floor(rnd() * arr.length)];
const randint = (a, b) => a + Math.floor(rnd() * (b - a + 1));

function writeJson(name, data) {
  const f = path.join(DATA_DIR, name);
  if (fs.existsSync(f) && !FORCE) {
    console.log('  跳过（已存在）', name);
    return;
  }
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(f, JSON.stringify(data, null, 2), 'utf8');
  console.log('  生成', name, '（' + (Array.isArray(data) ? data.length : 'obj') + '）');
}

const DEMO_PWD = crypto.createHash('sha256').update('123456').digest('hex');

/* ------------- 1. 账户（严格匹配分布） ------------- */
// SVIP 104 / LVIP 1 / none 15 / 未设置 43 = 163
const LEVELS = ['svip', 'lvip', 'none', ''];  // '' = 未设置
const plan = [
  { level: 'svip', n: 104 },
  { level: 'lvip', n: 1 },
  { level: 'none', n: 15 },
  { level: '',    n: 43 },
];

const accounts = [];
let aid = 1;
const levelPointBase = { svip: 8800, lvip: 5200, '': 0, none: 800 };
plan.forEach(({ level, n }) => {
  for (let k = 0; k < n; k++) {
    const seq = String(aid).padStart(4, '0');
    const name = (level === 'svip' ? '至尊会员' : level === 'lvip' ? '超级会员' : level === 'none' ? '普通会员' : '访客') + seq;
    const mail = 'member' + seq + '@xjstore.demo';
    const phone = '1' + randint(30, 99) + String(randint(10000000, 99999999));
    const contactType = pick(['qq', 'wechat', 'mail', 'phone']);
    const point = level ? randint(levelPointBase[level], levelPointBase[level] + 4000) : randint(0, 200);
    accounts.push({
      id: aid,
      name,
      mail,
      phone,
      contactType,
      qq: contactType === 'qq' ? String(randint(10000000, 99999999)) : '',
      level,
      point,
      banned: false,
      perms: ['buy', 'comment', 'view'],
      createdAt: '2026-0' + randint(1, 9) + '-' + String(randint(10, 28)).padStart(2, '0'),
      pwd: DEMO_PWD,
    });
    aid++;
  }
});

/* ------------- 2. 购买记录 ------------- */
const PRODUCT_NAMES = [
  '测试机器人 · 入门版', '测试机器人 · 标准版', '测试机器人 · 进阶版', '测试机器人 · 旗舰版',
  '测试插件 · 自动发货', '测试插件 · 数据同步', '测试资源 · 素材包', '测试资源 · 模板合集',
  '测试服务 · 一对一部署', '测试服务 · 定制开发',
];
const PAYS = ['微信支付', '支付宝'];
const purchases = [];
let pid = 1;
function mkPurchase(level, account) {
  const price = Number((randint(5, 199) + rnd()).toFixed(2));
  const months = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10'];
  purchases.push({
    id: pid++,
    accountId: account.id,
    accountName: account.name,
    level,
    productTitle: pick(PRODUCT_NAMES),
    amount: price,
    pay: pick(PAYS),
    time: '2026-' + pick(months) + '-' + String(randint(10, 28)).padStart(2, '0') + ' ' +
          String(randint(0, 23)).padStart(2, '0') + ':' + String(randint(0, 59)).padStart(2, '0'),
  });
}
const svipAccounts = accounts.filter(a => a.level === 'svip');
// SVIP 购买 135 条
for (let i = 0; i < 135; i++) mkPurchase('svip', pick(svipAccounts));
// VIP 购买 16 条（历史购买，按当时等级 VIP 统计；关联至既有账户）
for (let i = 0; i < 16; i++) mkPurchase('vip', pick(svipAccounts));

/* ------------- 3. 折扣券 ------------- */
const coupons = [
  { code: 'XJ-NEW10',  name: '新人立减券',   type: 'amount', value: 10,  minSpend: 50,  level: '',     total: 200, used: 36, expiresAt: '2026-12-31', active: true,  createdAt: '2026-01-01' },
  { code: 'XJ-VIP20',  name: 'VIP 专享券',   type: 'amount', value: 20,  minSpend: 100, level: 'vip',   total: 100, used: 12, expiresAt: '2026-12-31', active: true,  createdAt: '2026-02-01' },
  { code: 'XJ-SVIP30', name: 'SVIP 尊享券',  type: 'amount', value: 30,  minSpend: 200, level: 'svip',  total: 100, used: 8,  expiresAt: '2026-12-31', active: true,  createdAt: '2026-02-01' },
  { code: 'XJ-OFF85',  name: '全场 8.5 折券', type: 'rate',   value: 0.85, minSpend: 0,  level: '',     total: 300, used: 120, expiresAt: '2026-11-30', active: true,  createdAt: '2026-03-01' },
  { code: 'XJ-EXP',    name: '已过期测试券',  type: 'amount', value: 15,  minSpend: 30,  level: '',     total: 50,  used: 50, expiresAt: '2026-06-30', active: false, createdAt: '2026-01-15' },
];

/* ------------- 4. 卡密池 ------------- */
function genCardCode() {
  return 'XJ-' + crypto.randomBytes(5).toString('hex').toUpperCase().slice(0, 10);
}
const cardKeys = [];
for (let i = 0; i < 24; i++) {
  cardKeys.push({ code: genCardCode(), used: false, usedBy: '', usedAt: '', orderNo: '', productTitle: '' });
}
const cards = {
  batches: [
    { id: 1, name: '首发卡密批次', createdAt: '2026-01-20', keys: cardKeys },
  ],
};

/* ------------- 5. 商品互动 ------------- */
const interactions = {};
for (let id = 1; id <= 10; id++) {
  interactions[id] = {
    likes: randint(20, 980),
    views: randint(300, 12000),
    comments: [
      { name: 'member' + String(randint(1, 50)).padStart(4, '0'), text: pick(['很好用，已回购', '发货很快，服务到位', '性价比高，推荐', '客服响应及时']), time: '2026-0' + randint(3, 9) + '-' + String(randint(10, 28)).padStart(2, '0') },
    ],
  };
}

/* ------------- 6. 商店设置 ------------- */
const store = {
  name: 'XJ Store',
  slogan: '数字商品与自动化服务的优选商店',
  desc: 'XJ Store 提供测试机器人、插件、资源与一对一部署服务，支持会员折扣与多种支付方式。',
  contactMail: '3805506653@qq.com',
  contactQq: '3805506653',
  contactWechat: 'xj_store',
  contactPhone: '13800000000',
  footerText: '© 2026 XJ Store. 保留所有权利',
  announcement: '🎉 会员折扣上线：SVIP 低至 1.5 折，VIP 4.5 折，LVIP 7 折！',
};

fs.mkdirSync(DATA_DIR, { recursive: true });
writeJson('accounts.json', accounts);
writeJson('purchases.json', purchases);
writeJson('coupons.json', coupons);
writeJson('cards.json', cards);
writeJson('interactions.json', interactions);
writeJson('store.json', store);
console.log('数据种子完成。账户', accounts.length, '｜购买', purchases.length);
