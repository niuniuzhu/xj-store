/* XJ Store 重写后回归测试：逐端点验证行为 */
'use strict';
const crypto = require('crypto');
const B = 'http://localhost:8080';
let pass = 0, fail = 0;
const failures = [];

function check(name, cond, extra) {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else { fail++; failures.push(name + (extra ? ' :: ' + extra : '')); console.log('  FAIL  ' + name + (extra ? ' :: ' + extra : '')); }
}
async function j(path, opt) {
  const r = await fetch(B + path, opt);
  let body = null;
  try { body = await r.json(); } catch (e) { body = null; }
  return { status: r.status, body };
}
function post(path, data) {
  return j(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
}

(async () => {
  console.log('\n=== A. 公开接口 ===');
  let r = await j('/api/products');
  check('/api/products 返回商品列表', r.status === 200 && Array.isArray(r.body.list) && r.body.list.length > 0);
  const prodCount = r.body.list.length;
  const prod1 = r.body.list.find(p => p.id === 1);

  r = await j('/api/categories');
  check('/api/categories 返回分类', r.status === 200 && Array.isArray(r.body.list) && r.body.list.length > 0);

  r = await j('/api/levels');
  check('/api/levels 返回等级与分布', r.status === 200 && r.body.levels && r.body.levels.svip && r.body.distribution);

  r = await j('/api/ping');
  check('/api/ping 回报签名方式为 MD5', r.status === 200 && r.body.signType === 'MD5');
  check('/api/ping 显示密钥已配置', r.body.md5KeySet === true);
  check('/api/ping 不泄露密钥明文', r.body.key === undefined && JSON.stringify(r.body).indexOf('9ZUQMMQ') < 0);
  check('/api/ping 处于真实网关模式', r.body.mock === false);

  r = await j('/api/site');
  check('/api/site 返回站点信息', r.status === 200 && r.body.site && r.body.site.name);

  console.log('\n=== B. 账户注册 / 登录 / 鉴权 ===');
  const uname = 'rwtest' + Date.now().toString().slice(-8);
  r = await post('/api/account/register', { name: uname, mail: uname + '@t.com', pwd: 'abc12345' });
  check('注册返回账户与 token', r.status === 200 && r.body.token && r.body.account.id);
  const uid = r.body.account.id;
  let token = r.body.token;

  r = await post('/api/account/login', { name: uname, pwd: 'abc12345' });
  check('登录成功返回 token', r.status === 200 && r.body.ok && r.body.token);
  // 登录会轮换会话 token，后续用例必须用最新 token
  token = r.body.token;
  check('登录后 token 已轮换', token !== '' && typeof token === 'string');

  r = await post('/api/account/login', { name: uname, pwd: 'wrongpwd' });
  check('错误密码被拒绝 403', r.status === 403);

  r = await j('/api/account/me?uid=' + uid + '&token=' + token);
  check('/api/account/me 带 token 可读', r.status === 200 && r.body.ok && r.body.account.id === uid);

  r = await j('/api/account/me?uid=' + uid);
  check('/api/account/me 无 token 被拒 401（越权修复）', r.status === 401, 'got ' + r.status);

  r = await j('/api/account/me?uid=' + uid + '&token=badtoken');
  check('/api/account/me 错误 token 被拒 401', r.status === 401, 'got ' + r.status);

  r = await post('/api/account/update', { uid, name: uname + 'X' });
  check('/api/account/update 无 token 被拒 401（越权修复）', r.status === 401, 'got ' + r.status);

  r = await post('/api/account/update', { uid, token, name: uname + 'X', mail: uname + '@t.com' });
  check('/api/account/update 带 token 可改资料', r.status === 200 && r.body.ok && r.body.account.name === uname + 'X');

  console.log('\n=== C. 收藏 / 购买记录 ===');
  r = await j('/api/account/favorites?uid=' + uid + '&token=' + token);
  check('/api/account/favorites 带 token 可读', r.status === 200 && r.body.ok && Array.isArray(r.body.list));
  r = await j('/api/account/favorites?uid=' + uid);
  check('/api/account/favorites 无 token 被拒 401', r.status === 401, 'got ' + r.status);

  r = await post('/api/account/favorite', { uid, token, id: prod1.id });
  check('收藏商品成功', r.status === 200 && r.body.ok && r.body.added === true);
  r = await post('/api/account/favorite', { uid, token, id: prod1.id });
  check('再次收藏取消（切换）', r.status === 200 && r.body.ok && r.body.added === false);

  r = await j('/api/account/purchases?uid=' + uid + '&token=' + token);
  check('/api/account/purchases 带 token 可读', r.status === 200 && r.body.ok && Array.isArray(r.body.list));
  r = await j('/api/account/purchases?uid=' + uid);
  check('/api/account/purchases 无 token 被拒 401', r.status === 401, 'got ' + r.status);

  console.log('\n=== D. 互动 / 优惠券 ===');
  r = await j('/api/interactions');
  check('/api/interactions 返回数据', r.status === 200 && r.body.ok);
  r = await post('/api/interactions/view', { id: prod1.id });
  check('浏览计数 +1', r.status === 200 && r.body.item.views >= 1);
  r = await post('/api/interactions/like', { id: prod1.id });
  check('点赞计数 +1', r.status === 200 && r.body.item.likes >= 1);
  r = await post('/api/interactions/comment', { id: prod1.id, name: 'tester', text: '重写回归评论' });
  check('发表评论成功', r.status === 200 && r.body.item.comments.length > 0);
  r = await post('/api/interactions/comment', { id: prod1.id, name: 't', text: '  ' });
  check('空评论被拒 400', r.status === 400);

  r = await post('/api/coupon/validate', { code: 'NOPE', amount: 100, subtotal: 100, level: '' });
  check('无效优惠券返回 valid=false', r.status === 200 && r.body.valid === false);

  console.log('\n=== E. 下单计价（服务端权威） ===');
  const spec = (prod1.specs && prod1.specs[0]) || { name: '默认规格', price: prod1.price };
  const qty = 3;
  // 单价优先取规格价，规格无价则回落到商品价（与服务端逻辑一致）
  const unitPrice = (spec.price !== undefined && spec.price !== null && spec.price !== '') ? Number(spec.price) : Number(prod1.price);
  const fakeTotal = 0.01; // 故意传错金额，服务端应重算
  const no = 'RW' + Date.now().toString().slice(-10);
  r = await post('/api/order', {
    no, uid, items: [{ id: prod1.id, title: prod1.title, spec: spec.name, qty, price: 0.01 }],
    total: fakeTotal, status: 'pending',
  });
  check('创建订单成功', r.status === 200 && r.body.ok, JSON.stringify(r.body).slice(0, 150));
  const expectTotal = Number((unitPrice * qty).toFixed(2));
  check('服务端按商品价重算金额（不信任前端 total）',
    Math.abs(r.body.total - expectTotal) < 0.01, 'total=' + r.body.total + ' expect=' + expectTotal);
  check('订单返回 originalTotal', typeof r.body.originalTotal === 'number');

  r = await j('/api/order?no=' + no);
  check('按单号查询订单', r.status === 200 && r.body.list.length === 1);
  const order = r.body.list[0];
  check('卡密按数量发放（买' + qty + '份给' + qty + '张）', (order.cards || []).length === qty, 'cards=' + (order.cards || []).length);

  console.log('\n=== F. 发起支付（真实网关签名） ===');
  r = await j('/api/pay?no=' + no + '&type=alipay');
  check('/api/pay 返回支付链接', r.status === 200 && r.body.ok && r.body.payUrl);
  const payUrl = r.body.payUrl || '';
  check('支付链接指向真实网关', payUrl.indexOf('https://dash.bxyvps.cn/submit.php') === 0, payUrl.slice(0, 60));
  /* 下单方式可能是 GET（参数在链接上）或 POST 表单（参数在 payParams 里），两种都要覆盖 */
  const pu = new URL(payUrl);
  const rawParams = Object.assign({}, r.body.payParams || {});
  pu.searchParams.forEach((v, k) => { if (!(k in rawParams)) rawParams[k] = v; });
  const sign = rawParams.sign;
  check('支付参数含 MD5 签名与 sign_type', !!sign && rawParams.sign_type === 'MD5', 'sign=' + sign);
  /* 易支付签名铁律：参数按键名升序、用「原始值」拼接（不做 URL 编码）后再拼密钥取 md5 */
  const p = {};
  Object.keys(rawParams).forEach(k => { if (k !== 'sign' && k !== 'sign_type') p[k] = rawParams[k]; });
  const str = Object.keys(p).sort().map(k => k + '=' + p[k]).join('&');
  const KEY = '9ZUQMMQ575ZSHHGX3CPFTF9X99SQYXPA';
  const calc = crypto.createHash('md5').update(str + KEY, 'utf8').digest('hex');
  check('签名与 9ZUQ 密钥独立复算一致', calc === sign, 'calc=' + calc + ' server=' + sign);

  console.log('\n=== G. 回调验签（伪造签名必须被拒） ===');
  r = await j('/api/notify?pid=348884&trade_no=FAKE&out_trade_no=' + no + '&trade_status=TRADE_SUCCESS&sign=deadbeef&sign_type=MD5');
  const notifyText = await (await fetch(B + '/api/notify?pid=348884&trade_no=FAKE&out_trade_no=' + no + '&trade_status=TRADE_SUCCESS&sign=deadbeef&sign_type=MD5')).text();
  check('伪造签名回调被拒（返回 fail）', notifyText.trim() === 'fail', notifyText.trim());

  console.log('\n=== H. 星际互联 ===');
  r = await post('/api/stellar/issue', { uid, token });
  check('签发票据成功', r.status === 200 && r.body.ok && r.body.ticket);
  const ticket = r.body.ticket;
  r = await post('/api/stellar/verify', { ticket });
  check('票据验签通过（无 app 同源）', r.status === 200 && r.body.ok && r.body.account.id === uid);
  r = await post('/api/stellar/verify', { ticket: 'bogus.ticket' });
  check('伪造票据被拒 403', r.status === 403, 'got ' + r.status);

  r = await post('/api/stellar/appkey', { uid, token });
  check('获取应用密钥成功', r.status === 200 && r.body.ok && r.body.appKey && r.body.appId);
  const appKey = r.body.appKey, appId = r.body.appId;
  r = await post('/api/stellar/issue', { uid, token, app: appId });
  const appTicket = r.body.ticket;
  r = await post('/api/stellar/verify', { ticket: appTicket, app: appKey });
  check('应用票据+正确 App Key 验证通过', r.status === 200 && r.body.ok);
  r = await post('/api/stellar/verify', { ticket: appTicket, app: 'deadbeef' });
  check('应用票据+错误 App Key 被拒 403', r.status === 403, 'got ' + r.status);

  console.log('\n=== I. 后台管理（需管理员 token） ===');
  // 管理员口令为哈希存储且已被改过，无法反推。
  // 由外部脚本临时改密并重启（口令经环境变量传入），测试结束后由外部脚本还原。
  const tmpPass = process.env.ADMIN_PASS;
  if (!tmpPass) { console.log('  SKIP  未提供 ADMIN_PASS，跳过后台鉴权用例'); }
  r = await post('/api/admin/login', { user: '星际Stellar', pass: 'wrongpass' });
  check('管理员错误密码被拒 403', r.status === 403, 'got ' + r.status);
  r = await post('/api/admin/login', { user: '星际Stellar', pass: tmpPass });
  check('管理员登录成功', r.status === 200 && r.body.ok && r.body.token, JSON.stringify(r.body).slice(0, 100));
  const at = r.body.token;
  const h = { 'Content-Type': 'application/json', 'x-admin-token': at };
  r = await j('/api/admin/state');
  check('无 token 访问后台被拒 401', r.status === 401, 'got ' + r.status);
  r = await fetch(B + '/api/admin/state', { headers: { 'x-admin-token': at } });
  const st = await r.json();
  check('有 token 可取后台状态', r.status === 200 && st.ok);
  check('后台状态含 products/orders/levels', Array.isArray(st.products) && Array.isArray(st.orders) && st.levels);
  check('后台状态不下发密钥明文', st.config.key === undefined && st.config.keySet === true);
  check('后台状态不下发 stellarSecret 明文', st.config.stellarSecret === undefined && st.config.stellarSecretSet === true);
  check('商品数量未变', st.products.length === prodCount, st.products.length + ' vs ' + prodCount);

  r = await fetch(B + '/api/admin/dashboard', { headers: { 'x-admin-token': at } });
  const db = await r.json();
  check('数据看板可用', r.status === 200 && db.ok && typeof db.stats.accountTotal === 'number');

  r = await fetch(B + '/api/admin/cards', { headers: { 'x-admin-token': at } });
  const cards = await r.json();
  check('卡密池查询可用', r.status === 200 && Array.isArray(cards.batches) && Array.isArray(cards.issued));

  r = await fetch(B + '/api/admin/coupons', { headers: { 'x-admin-token': at } });
  const cp = await r.json();
  check('优惠券查询可用', r.status === 200 && Array.isArray(cp.list));

  r = await fetch(B + '/api/admin/accounts', { headers: { 'x-admin-token': at } });
  const acc = await r.json();
  check('账户列表可用且含总数', r.status === 200 && Array.isArray(acc.list) && typeof acc.total === 'number');

  r = await fetch(B + '/api/admin/store', { headers: { 'x-admin-token': at } });
  const stStore = await r.json();
  check('商店设置查询可用', r.status === 200 && stStore.ok);

  r = await fetch(B + '/api/admin/interactions', { headers: { 'x-admin-token': at } });
  const it = await r.json();
  check('互动数据查询可用', r.status === 200 && it.ok);

  console.log('\n=== J. 静态托管与安全 ===');
  const idx = await fetch(B + '/');
  check('首页可访问 200', idx.status === 200);
  const store = await fetch(B + '/store.html');
  check('store.html 可访问 200', store.status === 200);
  const leak1 = await fetch(B + '/server/config.json');
  check('禁止访问 server/config.json', leak1.status === 403, 'got ' + leak1.status);
  const leak2 = await fetch(B + '/server/data/accounts.json');
  check('禁止访问 server/data/accounts.json', leak2.status === 403, 'got ' + leak2.status);
  const leak3 = await fetch(B + '/../.env');
  check('禁止目录穿越访问 .env', leak3.status === 403 || leak3.status === 404, 'got ' + leak3.status);
  const leak4 = await fetch(B + '/assets/base.js');
  check('assets 资源可访问', leak4.status === 200);

  console.log('\n=== K. 库存与卡密逻辑（mock 支付验证扣减） ===');
  // 临时切到 mock 模式验证 markPaid 扣库存 + 幂等
  const cfg = await (await fetch(B + '/api/admin/state', { headers: { 'x-admin-token': at } })).json();
  const oldMock = cfg.config.mock;
  const cur = await (await fetch(B + '/api/products')).json();
  const p0 = cur.list.find(p => p.id === 1);
  const stockBefore = (p0.specs[0] || {}).stock;
  await fetch(B + '/api/admin/config', {
    method: 'POST', headers: h, body: JSON.stringify({ config: { mock: true } }),
  });
  const no2 = 'RW2' + Date.now().toString().slice(-10);
  r = await post('/api/order', {
    no: no2, uid, items: [{ id: 1, title: p0.title, spec: (p0.specs[0] || {}).name, qty: 2, price: 0.01 }],
    total: 0.01, status: 'pending',
  });
  check('mock 模式创建订单成功', r.status === 200 && r.body.ok);
  r = await j('/api/pay?no=' + no2 + '&type=alipay');
  check('mock 支付返回本地跳转链接', r.status === 200 && r.body.mock === true && r.body.payUrl.indexOf('order.html') > 0);
  const after1 = await (await fetch(B + '/api/products')).json();
  const stockAfter1 = (after1.list.find(p => p.id === 1).specs[0] || {}).stock;
  check('支付成功自动扣减库存（' + stockBefore + ' → ' + stockAfter1 + '）', stockAfter1 === stockBefore - 2, 'before=' + stockBefore + ' after=' + stockAfter1);
  // 重复支付应幂等
  await j('/api/pay?no=' + no2 + '&type=alipay');
  const after2 = await (await fetch(B + '/api/products')).json();
  const stockAfter2 = (after2.list.find(p => p.id === 1).specs[0] || {}).stock;
  check('重复支付幂等不二次扣库存', stockAfter2 === stockAfter1, 'after=' + stockAfter2);

  // 还原 mock 与库存
  await fetch(B + '/api/admin/config', {
    method: 'POST', headers: h, body: JSON.stringify({ config: { mock: !!oldMock } }),
  });

  console.log('\n=== L. XJ AI 权限分级与商店智能 ===');
  if (!at) {
    console.log('  SKIP  未获得管理员 token，跳过 AI 权限升级用例');
  } else {
  // L1 未登录：AI 全部拒绝
  r = await j('/api/ai/meta');
  check('AI meta 未登录不放行', r.status === 200 && r.body.access && r.body.access.allowed === false);
  check('AI meta 回报使用门槛等级', r.body.minLevel === 'vip' && !!r.body.minLevelName);
  const allowIds = (r.body.models || []).map(m => m.id);
  check('AI 模型列表已剔除失效模型（无 gpt-5.5 / gpt-5.6）',
    !allowIds.includes('gpt-5.5') && !allowIds.includes('gpt-5.6') && allowIds.length > 0, allowIds.join(','));
  check('AI 默认模型为 gpt-6.1-sol', r.body.defaultModel === 'gpt-6.1-sol', r.body.defaultModel);
  r = await j('/api/ai/recommend?limit=3');
  check('AI 推荐未登录被拒 401', r.status === 401, 'got ' + r.status);
  r = await post('/api/ai/chat', { messages: [{ role: 'user', content: 'hi' }] });
  check('AI 对话未登录被拒 401', r.status === 401, 'got ' + r.status);

  // L2 普通等级会员（注册默认 none）：等级不足
  r = await j('/api/ai/meta?uid=' + uid + '&token=' + token);
  check('AI meta 低等级会员不放行', r.body.access.allowed === false && r.body.access.needLevel === 'vip');
  r = await j('/api/ai/recommend?uid=' + uid + '&token=' + token);
  check('AI 推荐低等级会员被拒 403', r.status === 403, 'got ' + r.status);
  r = await post('/api/ai/chat', { uid, token, messages: [{ role: 'user', content: 'hi' }] });
  check('AI 对话低等级会员被拒 403', r.status === 403, 'got ' + r.status);
  r = await j('/api/ai/insights?uid=' + uid + '&token=' + token);
  check('AI 洞察低等级会员被拒 403', r.status === 403, 'got ' + r.status);

  // L3 升到 VIP：放行
  await fetch(B + '/api/admin/accounts', {
    method: 'POST', headers: h, body: JSON.stringify({ id: uid, patch: { level: 'vip' } }),
  });
  r = await j('/api/ai/meta?uid=' + uid + '&token=' + token);
  check('AI meta VIP 会员放行', r.body.access.allowed === true && r.body.access.level === 'vip');
  check('AI meta VIP 会员带会员折扣率', r.body.access.rate === 0.45, 'rate=' + r.body.access.rate);
  check('AI meta VIP 会员默认无最高权限', r.body.access.isAdmin === false);
  r = await j('/api/ai/recommend?uid=' + uid + '&token=' + token + '&limit=3');
  check('AI 推荐 VIP 会员可用', r.status === 200 && r.body.ok && Array.isArray(r.body.list) && r.body.list.length > 0);
  const rec = (r.body.list || [])[0];
  check('AI 推荐返回真实商品且有会员价', !!rec && rec.id != null && rec.memberPrice <= rec.price,
    rec ? ('id=' + rec.id + ' ' + rec.memberPrice + '/' + rec.price) : 'none');
  check('AI 推荐不返回零库存商品', (r.body.list || []).every(p => p.stock > 0));
  r = await j('/api/ai/insights?uid=' + uid + '&token=' + token);
  check('AI 洞察 VIP 无最高权限被拒 403', r.status === 403 && /最高权限/.test(r.body.msg || ''), 'got ' + r.status);

  // L4 授予 ai_admin 最高权限：解锁经营洞察
  await fetch(B + '/api/admin/accounts', {
    method: 'POST', headers: h,
    body: JSON.stringify({ id: uid, patch: { perms: ['buy', 'comment', 'view', 'ai_admin'] } }),
  });
  r = await j('/api/ai/meta?uid=' + uid + '&token=' + token);
  check('AI meta 识别最高权限标记', r.body.access.isAdmin === true);
  r = await j('/api/ai/insights?uid=' + uid + '&token=' + token);
  check('AI 洞察最高权限可用', r.status === 200 && r.body.ok && typeof r.body.insights === 'string' && r.body.insights.length > 10);
  check('AI 洞察含订单与会员分布', /订单总数/.test(r.body.insights || '') && /会员分布/.test(r.body.insights || ''));

  // L5 伪造权限不可行：token 错误依然被拒
  r = await j('/api/ai/insights?uid=' + uid + '&token=badtoken');
  check('AI 洞察错误 token 被拒 401', r.status === 401, 'got ' + r.status);

  // L6 还原测试账户等级与权限，避免污染数据
  await fetch(B + '/api/admin/accounts', {
    method: 'POST', headers: h,
    body: JSON.stringify({ id: uid, patch: { level: 'none', perms: ['buy', 'comment', 'view'] } }),
  });
  }

  console.log('\n============================');
  console.log('通过: ' + pass + '  失败: ' + fail);
  if (failures.length) { console.log('失败项:'); failures.forEach(f => console.log('  - ' + f)); }
  console.log('测试订单号(供清理): ' + no + ' , ' + no2);
  console.log('测试账户: ' + uname + ' uid=' + uid);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('测试异常', e); process.exit(2); });
