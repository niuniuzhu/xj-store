/* 会员套餐购买链路测试（需要服务运行在 8080）
   覆盖：套餐列表 → 注册 → 下单（服务端定价）→ mock 支付回调 → 等级发放 → 到期叠加 → 越权防护 */
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
function post(path, data, headers) {
  return j(path, { method: 'POST', headers: Object.assign({ 'Content-Type': 'application/json' }, headers || {}), body: JSON.stringify(data) });
}

(async () => {
  console.log('\n=== M. 会员套餐购买 ===');

  // M1 公开套餐列表
  let r = await j('/api/member/plans');
  check('GET /api/member/plans 返回套餐列表', r.status === 200 && r.body.ok && Array.isArray(r.body.list) && r.body.list.length > 0);
  check('套餐覆盖 LVIP/VIP/SVIP 三档', ['lvip', 'vip', 'svip'].every(lv => r.body.list.some(p => p.level === lv)));
  const plan = r.body.list.find(p => p.level === 'svip');
  check('套餐含名称/天数/价格/折扣', !!plan && plan.name && plan.days > 0 && plan.price > 0 && plan.rate > 0);
  check('套餐接口不泄露密钥', JSON.stringify(r.body).indexOf('9ZUQMMQ') < 0);

  // M2 注册测试账户
  const uname = 'mtest' + Date.now().toString().slice(-8);
  r = await post('/api/account/register', { name: uname, mail: uname + '@t.com', pwd: 'abc12345' });
  check('注册会员测试账户', r.status === 200 && r.body.ok && r.body.token);
  const uid = r.body.account.id;
  const token = r.body.token;

  // M3 未登录不能下单
  r = await post('/api/member/order', { planId: plan.id });
  check('未登录下单被拒 401', r.status === 401, 'got ' + r.status);

  // M4 错误 token 不能下单
  r = await post('/api/member/order', { uid, token: 'badtoken', planId: plan.id });
  check('错误 token 下单被拒 401', r.status === 401, 'got ' + r.status);

  // M5 不存在的套餐
  r = await post('/api/member/order', { uid, token, planId: 'not-exist' });
  check('不存在的套餐被拒 404', r.status === 404, 'got ' + r.status);

  // M6 正常下单：服务端按套餐定价
  r = await post('/api/member/order', { uid, token, planId: plan.id, pay: '支付宝' });
  check('会员下单成功返回订单号', r.status === 200 && r.body.ok && r.body.no, 'got ' + r.status);
  const no = r.body.no;
  check('下单金额等于服务端套餐价（不信任前端）', Number(r.body.total) === Number(plan.price),
    'total=' + r.body.total + ' plan=' + plan.price);

  // M7 前端传假金额也无效：订单总价仍为套餐价
  r = await post('/api/member/order', { uid, token, planId: plan.id, price: 0.01 });
  const no2 = r.body.no;
  r = await j('/api/order?no=' + no2);
  check('前端伪造价格被忽略', r.status === 200 && Number(r.body.list[0].total) === Number(plan.price),
    'total=' + (r.body.list[0] && r.body.list[0].total));

  // M8 订单类型为 member
  r = await j('/api/order?no=' + no);
  const ord = r.body.list[0];
  check('订单标记为会员订单', ord && ord.kind === 'member' && ord.member && ord.member.planId === plan.id);
  check('会员订单未支付时状态为 pending', ord && ord.status === 'pending');

  // M9 未支付时不发放等级
  r = await j('/api/account/me?uid=' + uid + '&token=' + token);
  check('未支付不发放会员等级', r.body.account.level === 'none', 'level=' + r.body.account.level);

  // M10 模拟网关支付成功回调（服务端校验签名，需构造合法签名）
  const cfg = require('fs').readFileSync(__dirname + '/config.json', 'utf8');
  const key = JSON.parse(cfg).honglingPayApiKey;
  const pid = JSON.parse(cfg).honglingPayMerchantId;
  const params = {
    pid, type: 'alipay', out_trade_no: no, trade_no: 'T' + Date.now(),
    trade_status: 'TRADE_SUCCESS', money: String(plan.price),
  };
  const signStr = Object.keys(params).filter(k => params[k] !== '' && params[k] !== undefined && params[k] !== null).sort()
    .map(k => k + '=' + params[k]).join('&');
  const sign = crypto.createHash('md5').update(signStr + key, 'utf8').digest('hex');
  r = await post('/api/notify', Object.assign({}, params, { sign, sign_type: 'MD5' }));
  check('支付回调签名校验通过返回 success', r.status === 200 && (r.body === null || r.body === '' || r.body === 'success'),
    'body=' + JSON.stringify(r.body));

  // M11 支付后等级已发放
  r = await j('/api/account/me?uid=' + uid + '&token=' + token);
  check('支付成功后等级提升为 SVIP', r.body.account.level === 'svip', 'level=' + r.body.account.level);
  check('支付成功后写入有效期', !!r.body.account.vipExpireAt, 'expire=' + r.body.account.vipExpireAt);
  check('支付成功后标记为限时会员', r.body.account.levelTimed === true);
  check('发放后记录购买记录', Array.isArray(r.body.account.memberOrders) && r.body.account.memberOrders.length > 0);

  // M12 重复回调幂等（不重复发放）
  const exp1 = r.body.account.vipExpireAt;
  await post('/api/notify', Object.assign({}, params, { sign, sign_type: 'MD5' }));
  r = await j('/api/account/me?uid=' + uid + '&token=' + token);
  check('重复回调不重复发放（幂等）', r.body.account.vipExpireAt === exp1 && r.body.account.memberOrders.length === 1,
    'exp=' + r.body.account.vipExpireAt + ' orders=' + (r.body.account.memberOrders || []).length);

  // M13 同级再买：到期日叠加，等级不变
  r = await j('/api/member/plans?uid=' + uid + '&token=' + token);
  const lvipPlan = r.body.list.find(p => p.level === 'lvip');
  r = await post('/api/member/order', { uid, token, planId: lvipPlan.id });
  const no3 = r.body.no;
  const p3 = { pid, type: 'alipay', out_trade_no: no3, trade_no: 'T' + Date.now(), trade_status: 'TRADE_SUCCESS', money: String(lvipPlan.price) };
  const s3 = crypto.createHash('md5').update(
    Object.keys(p3).filter(k => p3[k] !== '' && p3[k] !== undefined).sort().map(k => k + '=' + p3[k]).join('&') + key, 'utf8'
  ).digest('hex');
  await post('/api/notify', Object.assign({}, p3, { sign: s3, sign_type: 'MD5' }));
  r = await j('/api/account/me?uid=' + uid + '&token=' + token);
  check('买更低档不降级（保持 SVIP）', r.body.account.level === 'svip', 'level=' + r.body.account.level);
  const d1 = new Date(exp1 + 'T23:59:59').getTime();
  const d2 = new Date(r.body.account.vipExpireAt + 'T23:59:59').getTime();
  check('买更低档仍叠加有效期', d2 > d1, exp1 + ' -> ' + r.body.account.vipExpireAt);

  // M14 到期会员不再享受折扣（计价回落为无折扣）
  // 通过管理员接口把有效期改到过去（levelTimed 保持 true），验证等级回落
  const adminLogin0 = await post('/api/admin/login', { user: '星际Stellar', pass: 'XJai2026admin' });
  if (adminLogin0.status === 200 && adminLogin0.body.token) {
    const at0 = { 'x-admin-token': adminLogin0.body.token, 'Content-Type': 'application/json' };
    await post('/api/admin/accounts', { id: uid, patch: { level: 'vip', levelTimed: true, vipExpireAt: '2020-01-01' } }, at0);
    r = await j('/api/member/plans?uid=' + uid + '&token=' + token);
    check('到期会员等级回落为 none', r.body.current === 'none', 'current=' + r.body.current);
    r = await j('/api/account/me?uid=' + uid + '&token=' + token);
    check('到期会员对外显示无折扣等级', r.body.account.level === 'none', 'level=' + r.body.account.level);
    check('到期会员被标记 levelExpired', r.body.account.levelExpired === true);
    // 重新购买可正常恢复等级
    r = await post('/api/member/order', { uid, token, planId: lvipPlan.id });
    const no4 = r.body.no;
    const p4 = { pid, type: 'alipay', out_trade_no: no4, trade_no: 'T' + Date.now(), trade_status: 'TRADE_SUCCESS', money: String(lvipPlan.price) };
    const s4 = crypto.createHash('md5').update(
      Object.keys(p4).filter(k => p4[k] !== '' && p4[k] !== undefined).sort().map(k => k + '=' + p4[k]).join('&') + key, 'utf8'
    ).digest('hex');
    await post('/api/notify', Object.assign({}, p4, { sign: s4, sign_type: 'MD5' }));
    r = await j('/api/account/me?uid=' + uid + '&token=' + token);
    check('到期后重新购买可恢复等级', r.body.account.level === 'lvip', 'level=' + r.body.account.level);
    check('重新购买后恢复未到期状态', r.body.account.levelExpired === false);
  } else {
    check('管理员登录（用于到期用例）', false, 'status=' + adminLogin0.status);
  }

  // M15 后台开通会员
  const adminLogin = await post('/api/admin/login', { user: '星际Stellar', pass: 'XJai2026admin' });
  if (adminLogin.status === 200 && adminLogin.body.token) {
    const at = { 'x-admin-token': adminLogin.body.token, 'Content-Type': 'application/json' };
    r = await post('/api/admin/member/grant', { id: uid, level: 'vip', days: 60, mode: 'timed' }, at);
    check('后台开通限时会员成功', r.status === 200 && r.body.ok && r.body.account.level === 'vip', 'got ' + r.status);
    check('后台开通写入有效期', !!r.body.account.vipExpireAt);
    r = await post('/api/admin/member/grant', { id: uid, level: 'svip', days: 30, mode: 'permanent' }, at);
    check('后台开通永久会员成功', r.status === 200 && r.body.ok && r.body.account.level === 'svip' && !r.body.account.vipExpireAt);
    r = await post('/api/admin/member/grant', { id: uid, level: 'bogus', days: 30, mode: 'timed' }, at);
    check('后台开通非法等级被拒 400', r.status === 400, 'got ' + r.status);

    // M16 后台套餐配置保存
    const cur = await j('/api/admin/member/plans', { headers: { 'x-admin-token': adminLogin.body.token } });
    check('后台可读取套餐配置', cur.status === 200 && Array.isArray(cur.body.plans) && cur.body.plans.length > 0);
    const edited = cur.body.plans.map(p => Object.assign({}, p));
    edited[0].price = 21.5;
    r = await post('/api/admin/member/plans', { plans: edited }, at);
    check('后台保存套餐价格成功', r.status === 200 && r.body.ok && Number(r.body.plans[0].price) === 21.5, 'got ' + r.status);
    r = await j('/api/member/plans');
    check('保存后前台套餐价格同步更新', Number(r.body.list.find(p => p.id === edited[0].id).price) === 21.5);
    // 还原
    await post('/api/admin/member/plans', { plans: edited.map(p => p.id === edited[0].id ? Object.assign({}, p, { price: 19 }) : p) }, at);

    // M17 非法套餐被过滤
    r = await post('/api/admin/member/plans', { plans: [{ id: 'bad', level: 'xx', days: 10, price: 5 }] }, at);
    check('非法套餐被过滤（回落默认）', r.status === 200 && r.body.plans.length > 0 && !r.body.plans.some(p => p.id === 'bad'));

    // M18 清理：把测试账户等级复原
    await post('/api/admin/accounts', { id: uid, patch: { level: 'none', levelTimed: false, vipExpireAt: '', memberOrders: [] } }, at);
    r = await j('/api/account/me?uid=' + uid + '&token=' + token);
    check('测试账户等级已复原为 none', r.body.account.level === 'none', 'level=' + r.body.account.level);
  } else {
    check('管理员登录（用于后台用例）', false, 'status=' + adminLogin.status);
  }

  console.log('\n============================');
  console.log('通过: ' + pass + '  失败: ' + fail);
  if (failures.length) { console.log('失败项:'); failures.forEach(f => console.log('  - ' + f)); }
  console.log('测试会员订单号(供清理): ' + no + ' , ' + no2 + ' , ' + no3);
  console.log('测试账户: ' + uname + ' uid=' + uid);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('测试异常', e); process.exit(2); });
