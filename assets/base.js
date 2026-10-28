/* ============================================================
   XJ Store · 公共脚本
   提供：顶栏/页脚注入、主题切换、Toast、购物车(localStorage)、
        按钮涟漪、回到顶部、入场动画绑定
   用法：页面底部调用  XJ.init({ active: 'home' })
   ============================================================ */
(function () {
  'use strict';

  const ICON = {
    home:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/></svg>',
    blog:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><path d="M4 4h16v16H4z"/><path d="M8 9h8M8 13h5"/></svg>',
    bull:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><path d="M4 9v6h3l6 4V5L7 9H4z"/><path d="M17 8a5 5 0 0 1 0 8"/></svg>',
    about: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><circle cx="12" cy="12" r="9"/><path d="M12 16v-5M12 8.5h.01"/></svg>',
    cart:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><circle cx="9" cy="20" r="1.4"/><circle cx="18" cy="20" r="1.4"/><path d="M2 3h3l2.4 12.2a2 2 0 0 0 2 1.6h7.7a2 2 0 0 0 2-1.6L21 7H6"/></svg>',
    cart2: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><path d="M3 4h2l1.6 9.4a2 2 0 0 0 2 1.6h6.8a2 2 0 0 0 2-1.6L19 7H6"/><circle cx="9" cy="19" r="1.3"/><circle cx="17" cy="19" r="1.3"/></svg>',
    user:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><path d="M16 20v-1.5a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4V20"/><circle cx="9.5" cy="7.5" r="3.5"/></svg>',
    guest: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><path d="M16 20v-1.5a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4V20"/><circle cx="9.5" cy="7.5" r="3.5"/><path d="M21 20v-1.5a4 4 0 0 0-3-3.8"/></svg>',
    login: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><path d="M14 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><path d="M10 17l5-5-5-5"/><path d="M15 12H3"/></svg>',
    moon:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z"/></svg>',
    sun:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="4.2"/><path d="M12 2v2.6M12 19.4V22M2 12h2.6M19.4 12H22M4.9 4.9l1.9 1.9M17.2 17.2l1.9 1.9M19.1 4.9l-1.9 1.9M6.8 17.2l-1.9 1.9"/></svg>',
    globe: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a15 15 0 0 1 0 18 15 15 0 0 1 0-18z"/></svg>',
    mail:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg>',
    qq:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><path d="M12 3.5c-3.6 0-6 2.4-6 5.6 0 .9-.1 1.4-.4 2.1-.2.5-.5 1-.7 1.5-.3.7-.5 1.3-.5 1.8 0 .9.7 1.5 1.6 1.5.6 0 1-.2 1.5-.6.5-.4 1-.7 1.5-.9.9-.3 1.7-.4 2.5-.4s1.6.1 2.5.4c.5.2 1 .5 1.5.9.5.4.9.6 1.5.6.9 0 1.6-.6 1.6-1.5 0-.5-.2-1.1-.5-1.8-.2-.5-.5-1-.7-1.5-.3-.7-.4-1.2-.4-2.1 0-3.2-2.4-5.6-6-5.6z"/><path d="M10.2 8.2h.01M13.8 8.2h.01"/></svg>',
    help:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><path d="M21 12a9 9 0 1 1-3.6-7.2"/><path d="M8 12h8M12 8v8"/></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="m5 13 4 4L19 7"/></svg>',
    top:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="m6 14 6-6 6 6"/></svg>',
    shield:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><path d="M12 3l7.5 3v5.4c0 4.5-3.2 8.2-7.5 9.6-4.3-1.4-7.5-5.1-7.5-9.6V6z"/><path d="m9.2 12 2 2 3.6-3.8"/></svg>',
    gift:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><rect x="3" y="8" width="18" height="13" rx="2"/><path d="M3 12h18M12 8v13"/><path d="M12 8S9 3 7.5 4.5 9.5 8 12 8zM12 8s3-5 4.5-3.5S14.5 8 12 8z"/></svg>',
    /* 质感切换：玻璃态（晶体） / 普通态（实心方块） */
    glass: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M6 3h12l3 6-9 12L3 9z"/><path d="M3 9h18M9 3 6 9l6 12M15 3l3 6-6 12"/></svg>',
    square: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="4" y="4" width="16" height="16" rx="4.5"/><path d="M4 4v16h16V4z" fill="currentColor" opacity=".18"/></svg>',
    /* 风格选择：ore ui（矿石 / 宝石切面） */
    ore:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M5 9l7-5 7 5-7 11z"/><path d="M5 9h14M9 11l3 9 3-9"/></svg>',
    /* 手机端样式切换：手机 / 桌面（晶体） */
    mobile:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="6" y="2" width="12" height="20" rx="2.5"/><path d="M11 18h2"/></svg>',
    /* 手机端抽屉导航：汉堡 / 关闭 */
    menu:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg>',
    close:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    /* XJ AI：主星芒 + 小星芒 */
    ai:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"><path d="M11 3.2l1.85 5.05L17.9 10.1l-5.05 1.85L11 17l-1.85-5.05L4.1 10.1l5.05-1.85z"/><path d="M18.4 14.6l.85 2.35 2.35.85-2.35.85-.85 2.35-.85-2.35-2.35-.85 2.35-.85z"/></svg>',
    desktop: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/></svg>',
  };

  /* ============================================================
     多语言：中文 / English / 日本語
     - I18N 以「中文原文」为键，值为 { en, ja }
     - tr(zh)：按当前语言返回译文，缺省回退中文
     - applyLang()：重渲顶栏/页脚 + 遍历正文静态文本与 title/placeholder 翻译 + 派发 xj:langchange
     - 动态文案（含变量）请在页面脚本里用 XJ.tr() 包裹静态片段
     - 商品/分类等结构化数据用 XJ.loc(obj, field) 读取 i18n 字段（回退中文）
     ============================================================ */
  const LANG_KEY = 'xj_lang';
  const LANGS = [
    { code: 'zh', label: '中文' },
    { code: 'zhHant', label: '繁體中文' },
    { code: 'en', label: 'English' },
    { code: 'ja', label: '日本語' },
  ];
  let curLang = 'zh';
  try { curLang = localStorage.getItem(LANG_KEY) || 'zh'; } catch (e) {}
  if (!LANGS.some(l => l.code === curLang)) curLang = 'zh';

  /* ---------- 简体 -> 繁体 字符映射（繁体中文模式兜底自动转换） ----------
     覆盖常用异体字（一对一 + 少数约定俗成的多义字取常见繁体）。
     用词优先级：I18N 显式 zhHant > 本映射自动转换 > 原文。 */
  const S2T = {
    '爱':'愛','碍':'礙','肮':'骯','袄':'襖','罢':'罷','摆':'擺','败':'敗','颁':'頒','办':'辦','绊':'絆',
    '帮':'幫','绑':'綁','谤':'謗','镑':'鎊','饱':'飽','宝':'寶','报':'報','备':'備','惫':'憊','辈':'輩',
    '绷':'繃','笔':'筆','币':'幣','毕':'畢','毙':'斃','闭':'閉','边':'邊','编':'編','变':'變','辩':'辯',
    '辫':'辮','标':'標','别':'別','宾':'賓','滨':'濱','饼':'餅','并':'並','拨':'撥','剥':'剝','钵':'缽',
    '驳':'駁','补':'補','财':'財','采':'採','参':'參','惨':'慘','惭':'慚','残':'殘','蚕':'蠶','仓':'倉',
    '苍':'蒼','册':'冊','测':'測','层':'層','搀':'攙','掺':'摻','蝉':'蟬','馋':'饞','缠':'纏','产':'產',
    '铲':'鏟','颤':'顫','场':'場','尝':'嘗','偿':'償','肠':'腸','厂':'廠','畅':'暢','钞':'鈔','车':'車',
    '尘':'塵','衬':'襯','称':'稱','撑':'撐','诚':'誠','惩':'懲','迟':'遲','齿':'齒','耻':'恥','冲':'衝',
    '虫':'蟲','宠':'寵','绸':'綢','筹':'籌','丑':'醜','储':'儲','触':'觸','处':'處','传':'傳','疮':'瘡',
    '闯':'闖','创':'創','锤':'錘','词':'詞','丛':'叢','凑':'湊','窜':'竄','错':'錯','达':'達','带':'帶',
    '贷':'貸','单':'單','担':'擔','胆':'膽','弹':'彈','当':'當','档':'檔','导':'導','岛':'島','盗':'盜',
    '灯':'燈','邓':'鄧','敌':'敵','递':'遞','颠':'顛','点':'點','电':'電','垫':'墊','淀':'澱','钓':'釣',
    '调':'調','东':'東','动':'動','冻':'凍','斗':'鬥','读':'讀','独':'獨','赌':'賭','锻':'鍛','队':'隊',
    '对':'對','吨':'噸','顿':'頓','夺':'奪','堕':'墮','鹅':'鵝','额':'額','恶':'惡','饿':'餓','儿':'兒',
    '尔':'爾','发':'發','罚':'罰','阀':'閥','烦':'煩','范':'範','贩':'販','饭':'飯','废':'廢','费':'費',
    '纷':'紛','坟':'墳','奋':'奮','愤':'憤','粪':'糞','丰':'豐','风':'風','疯':'瘋','锋':'鋒','冯':'馮',
    '缝':'縫','凤':'鳳','肤':'膚','抚':'撫','辅':'輔','妇':'婦','负':'負','复':'復','赋':'賦','盖':'蓋',
    '杆':'桿','赶':'趕','刚':'剛','纲':'綱','钢':'鋼','岗':'崗','个':'個','给':'給','购':'購','顾':'顧',
    '挂':'掛','关':'關','观':'觀','馆':'館','惯':'慣','贯':'貫','广':'廣','规':'規','归':'歸','龟':'龜',
    '轨':'軌','贵':'貴','柜':'櫃','锅':'鍋','国':'國','过':'過','汉':'漢','号':'號','红':'紅','后':'後',
    '华':'華','哗':'嘩','画':'畫','划':'劃','话':'話','怀':'懷','坏':'壞','欢':'歡','还':'還','环':'環',
    '缓':'緩','换':'換','黄':'黃','挥':'揮','辉':'輝','毁':'毀','汇':'匯','会':'會','绘':'繪','浑':'渾',
    '货':'貨','祸':'禍','击':'擊','饥':'飢','机':'機','鸡':'雞','积':'積','极':'極','挤':'擠','计':'計',
    '记':'紀','际':'際','济':'濟','继':'繼','剂':'劑','见':'見','剑':'劍','舰':'艦','渐':'漸','践':'踐',
    '鉴':'鑒','将':'將','浆':'漿','蒋':'蔣','奖':'獎','讲':'講','酱':'醬','浇':'澆','骄':'驕','胶':'膠',
    '脚':'腳','搅':'攪','缴':'繳','轿':'轎','较':'較','阶':'階','节':'節','杰':'傑','结':'結','届':'屆',
    '紧':'緊','锦':'錦','尽':'盡','进':'進','晋':'晉','惊':'驚','颈':'頸','镜':'鏡','静':'靜','纠':'糾',
    '旧':'舊','举':'舉','据':'據','惧':'懼','决':'決','绝':'絕','觉':'覺','军':'軍','开':'開','凯':'凱',
    '壳':'殼','课':'課','库':'庫','裤':'褲','扩':'擴','阔':'闊','蜡':'蠟','腊':'臘','来':'來','赖':'賴',
    '兰':'蘭','拦':'攔','栏':'欄','蓝':'藍','篮':'籃','览':'覽','懒':'懶','烂':'爛','滥':'濫','捞':'撈',
    '劳':'勞','乐':'樂','离':'離','类':'類','泪':'淚','礼':'禮','里':'裡','丽':'麗','励':'勵','隶':'隸',
    '俩':'倆','连':'連','莲':'蓮','帘':'簾','怜':'憐','联':'聯','练':'練','炼':'煉','恋':'戀','链':'鏈',
    '脸':'臉','凉':'涼','粮':'糧','两':'兩','辆':'輛','谅':'諒','疗':'療','猎':'獵','临':'臨','邻':'鄰',
    '灵':'靈','铃':'鈴','龄':'齡','领':'領','刘':'劉','龙':'龍','笼':'籠','拢':'攏','聋':'聾','楼':'樓',
    '卢':'盧','芦':'蘆','炉':'爐','鲁':'魯','陆':'陸','录':'錄','吕':'呂','虑':'慮','绿':'綠','滤':'濾',
    '驴':'驢','罗':'羅','骡':'騾','妈':'媽','马':'馬','码':'碼','蚂':'螞','骂':'罵','吗':'嗎','买':'買',
    '麦':'麥','卖':'賣','迈':'邁','脉':'脈','蛮':'蠻','满':'滿','猫':'貓','贸':'貿','么':'麼','没':'沒',
    '梦':'夢','谜':'謎','灭':'滅','庙':'廟','鸣':'鳴','纳':'納','难':'難','恼':'惱','脑':'腦','闹':'鬧',
    '拟':'擬','腻':'膩','酿':'釀','鸟':'鳥','宁':'寧','纽':'紐','农':'農','浓':'濃','欧':'歐','呕':'嘔',
    '盘':'盤','庞':'龐','赔':'賠','评':'評','凭':'憑','苹':'蘋','扑':'撲','铺':'鋪','仆':'僕','朴':'樸',
    '谱':'譜','齐':'齊','骑':'騎','启':'啟','气':'氣','弃':'棄','迁':'遷','牵':'牽','铅':'鉛','谦':'謙',
    '签':'簽','钱':'錢','潜':'潛','浅':'淺','枪':'槍','墙':'牆','蔷':'薔','强':'強','抢':'搶','桥':'橋',
    '乔':'喬','亲':'親','轻':'輕','氢':'氫','倾':'傾','请':'請','庆':'慶','穷':'窮','区':'區','驱':'驅',
    '趋':'趨','权':'權','劝':'勸','确':'確','鹊':'鵲','让':'讓','绕':'繞','热':'熱','认':'認','韧':'韌',
    '荣':'榮','软':'軟','润':'潤','洒':'灑','萨':'薩','赛':'賽','伞':'傘','丧':'喪','扫':'掃','骚':'騷',
    '杀':'殺','纱':'紗','厦':'廈','筛':'篩','晒':'曬','闪':'閃','伤':'傷','赏':'賞','摄':'攝','审':'審',
    '婶':'嬸','肾':'腎','渗':'滲','声':'聲','绳':'繩','圣':'聖','胜':'勝','师':'師','诗':'詩','狮':'獅',
    '湿':'濕','时':'時','识':'識','实':'實','饰':'飾','视':'視','试':'試','释':'釋','寿':'壽','兽':'獸',
    '书':'書','输':'輸','属':'屬','术':'術','树':'樹','竖':'豎','数':'數','帅':'帥','双':'雙','谁':'誰',
    '说':'說','丝':'絲','饲':'飼','松':'鬆','颂':'頌','苏':'蘇','随':'隨','岁':'歲','孙':'孫','损':'損',
    '笋':'筍','缩':'縮','锁':'鎖','台':'臺','态':'態','贪':'貪','摊':'攤','滩':'灘','谈':'談','坛':'壇',
    '叹':'嘆','汤':'湯','烫':'燙','讨':'討','腾':'騰','体':'體','题':'題','条':'條','贴':'貼','铁':'鐵',
    '厅':'廳','听':'聽','统':'統','头':'頭','图':'圖','涂':'塗','团':'團','椭':'橢','袜':'襪','弯':'彎',
    '湾':'灣','顽':'頑','万':'萬','网':'網','卫':'衛','伟':'偉','伪':'偽','纬':'緯','温':'溫','闻':'聞',
    '纹':'紋','稳':'穩','问':'問','乌':'烏','无':'無','务':'務','误':'誤','雾':'霧','细':'細','系':'係',
    '虾':'蝦','峡':'峽','狭':'狹','闲':'閒','贤':'賢','显':'顯','险':'險','县':'縣','现':'現','线':'線',
    '乡':'鄉','详':'詳','响':'響','项':'項','协':'協','挟':'挾','谐':'諧','写':'寫','泻':'瀉','谢':'謝',
    '兴':'興','锈':'鏽','须':'鬚','许':'許','叙':'敘','续':'續','悬':'懸','选':'選','寻':'尋','逊':'遜',
    '压':'壓','鸦':'鴉','鸭':'鴨','哑':'啞','亚':'亞','烟':'煙','盐':'鹽','严':'嚴','颜':'顏','阎':'閻',
    '厌':'厭','艳':'艷','验':'驗','阳':'陽','养':'養','样':'樣','药':'藥','爷':'爺','业':'業','叶':'葉',
    '页':'頁','医':'醫','仪':'儀','遗':'遺','亿':'億','义':'義','艺':'藝','忆':'憶','议':'議','异':'異',
    '译':'譯','阴':'陰','银':'銀','饮':'飲','隐':'隱','樱':'櫻','婴':'嬰','鹰':'鷹','营':'營','蝇':'蠅',
    '拥':'擁','优':'優','忧':'憂','邮':'郵','与':'與','屿':'嶼','御':'禦','誉':'譽','园':'園','圆':'圓',
    '远':'遠','愿':'願','阅':'閱','云':'雲','运':'運','韵':'韻','杂':'雜','灾':'災','载':'載','暂':'暫',
    '赞':'贊','脏':'髒','灶':'竈','枣':'棗','则':'則','择':'擇','责':'責','泽':'澤','贼':'賊','赠':'贈',
    '扎':'紮','斩':'斬','盏':'盞','战':'戰','张':'張','涨':'漲','帐':'帳','账':'賬','这':'這','针':'針',
    '诊':'診','阵':'陣','镇':'鎮','争':'爭','征':'徵','挣':'掙','证':'證','郑':'鄭','织':'織','执':'執',
    '职':'職','纸':'紙','制':'製','质':'質','钟':'鐘','种':'種','众':'眾','皱':'皺','骤':'驟','猪':'豬',
    '诸':'諸','烛':'燭','驻':'駐','筑':'築','专':'專','砖':'磚','转':'轉','庄':'莊','装':'裝','壮':'壯',
    '状':'狀','坠':'墜','准':'準','钻':'鑽',
    '党':'黨','仅':'僅','荐':'薦','岭':'嶺','庐':'廬','铝':'鋁','亩':'畝','辟':'闢','扰':'擾','涩':'澀',
    '舍':'捨','虽':'雖','誊':'謄','牺':'犧','咸':'鹹','向':'嚮','胁':'脅','应':'應','佣':'傭',
    '员':'員','长':'長','贝':'貝','鱼':'魚','语':'語','论':'論','诉':'訴','讯':'訊','谋':'謀',
    '谊':'誼','讽':'諷','诞':'誕','诬':'誣','顺':'順','顶':'頂','阁':'閣'
  };
  function s2t(s) {
    if (s == null) return s;
    return String(s).replace(/[一-鿿]/g, ch => S2T[ch] || ch);
  }
  /* 取某条目的当前语言译文；繁体中文优先用显式 zhHant，否则按简繁映射自动转换 */
  function trVal(key) {
    if (key == null) return key;
    const e = I18N[key];
    if (e && e[curLang] != null) return e[curLang];
    if (curLang === 'zhHant') { const t = s2t(key); if (t !== key) return t; }
    return key;
  }

  const I18N = {
    /* 顶栏 / 页脚 */
    '首页': { en: 'Home', ja: 'ホーム' },
    '博客': { en: 'Blog', ja: 'ブログ' },
    '公告': { en: 'Announcements', ja: 'お知らせ' },
    '知道了': { en: 'Got it', ja: 'わかりました' },
    '今日不再提示': { en: 'Don\'t show today', ja: '今日は表示しない' },
    '查看详情': { en: 'View details', ja: '詳細を見る' },
    '兑换': { en: 'Redeem', ja: '引き換え' },
    '关于': { en: 'About', ja: 'について' },
    '切换手机端': { en: 'Mobile View', ja: 'モバイル表示' },
    '已切换到手机端样式': { en: 'Switched to mobile layout', ja: 'モバイル表示に切り替え' },
    '已切换到桌面端样式': { en: 'Switched to desktop layout', ja: 'デスクトップ表示に切り替え' },
    '购物车': { en: 'Cart', ja: 'カート' },
    '游客登录': { en: 'Guest Login', ja: 'ゲストログイン' },
    '登录': { en: 'Login', ja: 'ログイン' },
    '进入后台': { en: 'Admin', ja: '管理へ' },
    '进入管理后台': { en: 'Enter Admin', ja: '管理画面へ' },
    '切换主题': { en: 'Toggle Theme', ja: 'テーマ切替' },
    '语言': { en: 'Language', ja: '言語' },
    'XJ Store': { en: 'XJ Store', ja: 'XJ Store' },
    'XJ 的商店': { en: 'XJ Store', ja: 'XJ ストア' },
    '数字商品与自动化服务的本地演示站点。': { en: 'Local demo site for digital goods and automation services.', ja: 'デジタル商品と自動化サービスのローカルデモサイト。' },
    '快速链接': { en: 'Quick Links', ja: 'クイックリンク' },
    '联系我们': { en: 'Contact Us', ja: 'お問い合わせ' },
    '帮助中心': { en: 'Help Center', ja: 'ヘルプセンター' },
    '隐私政策': { en: 'Privacy Policy', ja: 'プライバシーポリシー' },
    '服务条款': { en: 'Terms of Service', ja: '利用規約' },
    '管理后台': { en: 'Admin Panel', ja: '管理画面' },
    '© 2026 XJ Store. 保留所有权利': { en: '© 2026 XJ Store. All Rights Reserved', ja: '© 2026 XJ Store. 全著作権所有' },
    '会员中心': { en: 'Member Center', ja: 'メンバーセンター' },
    '未设置': { en: 'Not set', ja: '未設定' },
    '无折扣': { en: 'No discount', ja: '割引なし' },

    /* 分类 */
    '云珩公会': { en: 'Yunheng Guild', ja: '雲珩ギルド' },
    '指令代做': { en: 'Command Customization', ja: 'コマンド作成' },
    '服务器宣传': { en: 'Server Promotion', ja: 'サーバー宣伝' },
    '商品服务': { en: 'Goods & Services', ja: '商品・サービス' },
    '测试分类': { en: 'Test Category', ja: 'テスト分類' },
    '测试商品': { en: 'Test Product', ja: 'テスト商品' },
    '测试机器人': { en: 'Test Bot', ja: 'テストBot' },
    '测试插件': { en: 'Test Plugin', ja: 'テストプラグイン' },
    '测试资源': { en: 'Test Resource', ja: 'テストリソース' },
    '测试服务': { en: 'Test Service', ja: 'テストサービス' },
    '测试': { en: 'Test', ja: 'テスト' },
    '全部商品': { en: 'All Products', ja: 'すべての商品' },

    /* 标签 / 状态 */
    '有库存': { en: 'In Stock', ja: '在庫あり' },
    '缺货': { en: 'Out of Stock', ja: '在庫切れ' },
    '已下架': { en: 'Off Shelf', ja: '販売停止' },
    '代理': { en: 'Agent', ja: '代理' },
    '测试品': { en: 'Test Item', ja: 'テスト品' },
    '商店须知': { en: 'Store Notice', ja: 'ショップ案内' },
    '公会管理': { en: 'Guild Management', ja: 'ギルド管理' },
    '自由交付': { en: 'Flexible Delivery', ja: '自由配送' },
    '指令': { en: 'Command', ja: 'コマンド' },

    /* 规格名 */
    '默认规格': { en: 'Default', ja: '標準' },
    '30秒': { en: '30s', ja: '30秒' },
    '1分钟': { en: '1 min', ja: '1分' },
    '1个月': { en: '1 month', ja: '1ヶ月' },
    '3个月': { en: '3 months', ja: '3ヶ月' },
    '永久': { en: 'Permanent', ja: '永久' },
    '含源码': { en: 'With source', ja: 'ソース付き' },
    '标准服务': { en: 'Standard', ja: '標準' },
    '含运维 1 个月': { en: 'With 1-month maintenance', ja: '1ヶ月運用付き' },
    '需求评估': { en: 'Requirement assessment', ja: '要件評価' },

    /* 商店页 */
    '没有找到相关商品，换个关键词试试': { en: 'No matching products — try another keyword', ja: '該当する商品が見つかりません。別のキーワードをお試しください' },
    '起': { en: 'from', ja: 'から' },
    'CNY': { en: 'CNY', ja: 'CNY' },
    '加入购物车': { en: 'Add to Cart', ja: 'カートに入れる' },
    '已加入购物车：': { en: 'Added to cart: ', ja: 'カートに追加：' },
    '件': { en: ' item', ja: ' 点' },
    '库存 ': { en: 'Stock ', ja: '在庫 ' },

    /* 详情页 */
    '商店': { en: 'Store', ja: 'ストア' },
    '商品中心': { en: 'Products', ja: '商品一覧' },
    '游客可购': { en: 'Guests can buy', ja: 'ゲスト購入可' },
    '限购': { en: 'Purchase limit', ja: '購入制限' },
    '价格': { en: 'Price', ja: '価格' },
    '（按规格）': { en: '(by spec)', ja: '（仕様ごと）' },
    '选择规格': { en: 'Select Spec', ja: '仕様を選択' },
    '商品描述': { en: 'Description', ja: '商品説明' },
    '购买数量': { en: 'Quantity', ja: '数量' },
    '立即购买': { en: 'Buy Now', ja: '今すぐ購入' },
    '收藏': { en: 'Favorite', ja: 'お気に入り' },
    '已收藏': { en: 'Favorited', ja: 'お気に入り済み' },
    '详细信息': { en: 'Details', ja: '詳細情報' },
    '商品互动': { en: 'Interactions', ja: '商品インタラクション' },
    '点赞': { en: 'Like', ja: 'いいね' },
    '浏览': { en: 'Views', ja: '閲覧' },
    '评论': { en: 'Comments', ja: 'コメント' },
    '说点什么吧…（登录后将以会员名发布）': { en: 'Say something… (posted as your member name after login)', ja: '何か書いてください…（ログイン後はメンバー名で投稿）' },
    '发送': { en: 'Send', ja: '送信' },
    '返回商品列表': { en: 'Back to Products', ja: '商品一覧へ戻る' },
    '该商品已下架，暂时无法购买': { en: 'This item is off-shelf and cannot be purchased', ja: 'この商品は販売停止中で購入できません' },
    '库存充足，当前规格可下单 ': { en: 'In stock — current spec can order ', ja: '在庫あり、現在の仕様で' },
    ' 件）': { en: ' items)', ja: ' 点）' },
    '当前库存不足以满足该商品的最小购买数量（': { en: 'Current stock is below the minimum purchase quantity (', ja: '現在の在庫が最小購入数量（' },
    '暂无可售库存': { en: 'No available stock', ja: '販売可能在庫なし' },
    '最多可购 ': { en: 'Max ', ja: '最大 ' },
    '已售罄': { en: 'Sold out', ja: '完売' },
    '商品不存在或已下架': { en: 'Product not found or off-shelf', ja: '商品が見つからないか販売停止中' },
    '该商品可能已被管理员删除': { en: 'This product may have been removed by an admin', ja: 'この商品は管理者により削除された可能性があります' },
    '请先登录再收藏': { en: 'Please log in before favoriting', ja: 'お気に入りにはログインが必要です' },
    '已加入收藏': { en: 'Added to favorites', ja: 'お気に入りに追加しました' },
    '已取消收藏': { en: 'Removed from favorites', ja: 'お気に入りを解除しました' },
    '该商品已下架，无法购买': { en: 'This item is off-shelf and cannot be purchased', ja: 'この商品は販売停止中で購入できません' },
    '感谢点赞': { en: 'Thanks for the like', ja: 'いいねありがとう' },
    '评论内容不能为空': { en: 'Comment cannot be empty', ja: 'コメントは空にできません' },
    '评论失败，请确认服务已启动': { en: 'Comment failed — please ensure the server is running', ja: 'コメント失敗 — サーバー起動を確認してください' },
    '操作失败，请确认服务已启动': { en: 'Operation failed — please ensure the server is running', ja: '操作失敗 — サーバー起動を確認してください' },
    '暂无评论，快来抢沙发': { en: 'No comments yet — be the first!', ja: 'コメントはまだありません' },
    '您的': { en: 'Your ', ja: 'あなたの' },
    '价': { en: ' price', ja: ' 価格' },
    '折': { en: ' off', ja: '引き' },
    '分类：': { en: 'Category: ', ja: 'カテゴリ：' },

    /* 购物车 */
    '购物车还是空的': { en: 'Your cart is empty', ja: 'カートは空です' },
    '去逛逛': { en: 'Go Shopping', ja: '買い物へ' },
    '继续挑选商品': { en: 'Continue Shopping', ja: '買い物を続ける' },
    '共 ': { en: 'Total ', ja: '合計 ' },
    '规格：': { en: 'Spec: ', ja: '仕様：' },
    '移除': { en: 'Remove', ja: '削除' },
    '订单摘要': { en: 'Order Summary', ja: '注文概要' },
    '商品件数': { en: 'Items', ja: '商品点数' },
    '商品总额': { en: 'Subtotal', ja: '小計' },
    '优惠减免': { en: 'Discount', ja: '割引' },
    '应付合计': { en: 'Total Payable', ja: 'お支払い合計' },
    '去结算': { en: 'Checkout', ja: 'レジへ' },
    '清空购物车': { en: 'Clear Cart', ja: 'カートを空にする' },
    '购物车已清空': { en: 'Cart cleared', ja: 'カートを空にしました' },
    '已移除该商品': { en: 'Item removed', ja: '商品を削除しました' },
    '回到顶部': { en: 'Back to Top', ja: 'トップへ' },

    /* 结算 */
    '确认订单': { en: 'Confirm Order', ja: '注文確定' },
    '联系方式': { en: 'Contact', ja: '連絡先' },
    '联系方式类型': { en: 'Contact Type', ja: '連絡先タイプ' },
    'QQ': { en: 'QQ', ja: 'QQ' },
    '手机号': { en: 'Phone', ja: '電話番号' },
    '手机': { en: 'Phone', ja: '電話' },
    '微信': { en: 'WeChat', ja: 'WeChat' },
    '邮箱': { en: 'Email', ja: 'メール' },
    '订单备注（选填）': { en: 'Order Note (optional)', ja: '備考（任意）' },
    '支付方式': { en: 'Payment Method', ja: '支払方法' },
    '支付宝': { en: 'Alipay', ja: 'Alipay' },
    '微信支付': { en: 'WeChat Pay', ja: 'WeChat Pay' },
    '跳转支付宝完成付款': { en: 'Pay via Alipay', ja: 'Alipayで支払い' },
    '扫码完成付款': { en: 'Scan QR to pay', ja: 'QRコードで支払い' },
    '优惠券': { en: 'Coupon', ja: 'クーポン' },
    '应用': { en: 'Apply', ja: '適用' },
    '我已阅读并同意 ': { en: 'I have read and agree to the ', ja: '以下に同意します：' },
    ' 与 ': { en: ' and ', ja: ' と ' },
    '，数字商品一经交付不支持退款': { en: ', digital goods are non-refundable once delivered', ja: '、デジタル商品は配送後返金不可' },
    '商品清单': { en: 'Items', ja: '商品リスト' },
    '商品总额（原价）': { en: 'Subtotal (original)', ja: '小計（定価）' },
    '会员折扣': { en: 'Member Discount', ja: '会員割引' },
    '手续费': { en: 'Fee', ja: '手数料' },
    '提交订单': { en: 'Submit Order', ja: '注文を確定' },
    '正在创建订单…': { en: 'Creating order…', ja: '注文作成中…' },
    '请输入优惠券码': { en: 'Enter coupon code', ja: 'クーポンコードを入力' },
    '校验中…': { en: 'Validating…', ja: '検証中…' },
    '优惠券不可用': { en: 'Coupon unavailable', ja: 'クーポン利用不可' },
    '已应用': { en: 'Applied', ja: '適用済み' },
    '立减': { en: 'off', ja: '割引' },
    '校验失败，请稍后再试': { en: 'Validation failed, try later', ja: '検証失敗、後でもう一度' },
    '请先勾选同意服务条款': { en: 'Please accept the Terms of Service', ja: '利用規約に同意してください' },
    '购物车是空的': { en: 'Your cart is empty', ja: 'カートは空です' },
    '当前环境不支持在线支付，已保存为待支付订单': { en: 'Online payment unavailable; saved as pending order', ja: 'オンライン決済不可、注文を保留保存' },
    '正在跳转支付…': { en: 'Redirecting to payment…', ja: '決済へ転送中…' },
    '支付服务不可用，已保存为待支付订单': { en: 'Payment service unavailable; saved as pending order', ja: '決済サービス不可、注文を保留保存' },
    'QQ 号码（用于发送卡密与订单通知）': { en: 'QQ number (for card & order notices)', ja: 'QQ番号（カード・注文通知用）' },
    '请输入 QQ 号，例如 3805506653': { en: 'Enter QQ, e.g. 3805506653', ja: 'QQを入力、例 3805506653' },
    '请输入 5-12 位 QQ 号': { en: 'Enter a 5-12 digit QQ', ja: '5〜12桁のQQを入力' },
    '微信号（用于发送卡密与订单通知）': { en: 'WeChat ID (for card & order notices)', ja: 'WeChat ID（カード・注文通知用）' },
    '请输入微信号': { en: 'Enter WeChat ID', ja: 'WeChat IDを入力' },
    '请输入 5-20 位微信号': { en: 'Enter a 5-20 char WeChat ID', ja: '5〜20文字のWeChat IDを入力' },
    '邮箱（用于发送卡密与订单通知）': { en: 'Email (for card & order notices)', ja: 'メール（カード・注文通知用）' },
    '请输入正确的邮箱地址': { en: 'Enter a valid email', ja: '正しいメールアドレスを入力' },
    '手机号（用于发送卡密与订单通知）': { en: 'Phone (for card & order notices)', ja: '電話番号（カード・注文通知用）' },
    '请输入手机号': { en: 'Enter phone number', ja: '電話番号を入力' },
    '请输入正确的 11 位手机号': { en: 'Enter a valid 11-digit phone', ja: '正しい11桁の電話番号を入力' },

    /* 登录 / 注册 / 游客 */
    '欢迎回到': { en: 'Welcome back to', ja: 'ようこそ' },
    '登录后可以管理订单、查看已购商品与卡密，并享受更快捷的结算体验。': { en: 'After login you can manage orders, view purchases and keys, and enjoy a faster checkout.', ja: 'ログインすると注文管理・購入履歴・カード確認ができ、スムーズな決済が利用できます。' },
    '订单集中管理': { en: 'Centralized Orders', ja: '注文一元管理' },
    '历史订单、卡密与发票一站查看': { en: 'View past orders, keys and invoices in one place', ja: '過去の注文・カード・領収書を一括確認' },
    '即时交付': { en: 'Instant Delivery', ja: '即時配送' },
    '支持自动发货，付款后秒到账': { en: 'Auto-delivery: keys arrive instantly after payment', ja: '自動発送対応、入金後即時反映' },
    '账户安全': { en: 'Account Security', ja: 'アカウントセキュリティ' },
    '登录状态加密存储，支持异地提醒': { en: 'Encrypted sessions with unusual-login alerts', ja: '暗号化セッション・異常ログイン通知' },
    '注册': { en: 'Register', ja: '登録' },
    '游客': { en: 'Guest', ja: 'ゲスト' },
    '登录账户': { en: 'Sign In', ja: 'ログイン' },
    '还没有账号？': { en: "Don't have an account?", ja: 'アカウントをお持ちでない方' },
    '立即注册': { en: 'Sign up now', ja: '今すぐ登録' },
    '邮箱 / 用户名': { en: 'Email / Username', ja: 'メール / ユーザー名' },
    '请输入邮箱或用户名': { en: 'Enter email or username', ja: 'メールまたはユーザー名を入力' },
    '密码': { en: 'Password', ja: 'パスワード' },
    '请输入密码': { en: 'Enter password', ja: 'パスワードを入力' },
    '显示密码': { en: 'Show password', ja: 'パスワード表示' },
    '密码至少 6 位': { en: 'At least 6 characters', ja: '6文字以上' },
    '记住我': { en: 'Remember me', ja: 'ログイン状態を保持' },
    '忘记密码？': { en: 'Forgot password?', ja: 'パスワードをお忘れですか？' },
    '登 录': { en: 'Log In', ja: 'ログイン' },
    '免登录体验 SVIP 折扣': { en: 'Try SVIP discount without login', ja: 'ログインせずSVIP割引を体験' },
    '或使用以下方式': { en: 'Or use the following', ja: 'または以下をご利用' },
    '邮箱码': { en: 'Email code', ja: 'メールコード' },
    '创建账号': { en: 'Create Account', ja: 'アカウント作成' },
    '已有账号？': { en: 'Already have an account?', ja: 'アカウントをお持ちの方' },
    '去登录': { en: 'Go to login', ja: 'ログインへ' },
    '用户名': { en: 'Username', ja: 'ユーザー名' },
    '2-16 个字符': { en: '2-16 characters', ja: '2〜16文字' },
    '用户名至少 2 个字符': { en: 'At least 2 characters', ja: '2文字以上' },
    '至少 8 位，含字母和数字': { en: '8+ chars with letters and numbers', ja: '8文字以上、英数字混在' },
    '密码需至少 8 位且包含字母与数字': { en: '8+ chars including letters and numbers', ja: '8文字以上かつ英数字を含む' },
    '确认密码': { en: 'Confirm Password', ja: 'パスワード確認' },
    '再次输入密码': { en: 'Re-enter password', ja: 'パスワード再入力' },
    '两次输入的密码不一致': { en: 'Passwords do not match', ja: 'パスワードが一致しません' },
    '注 册': { en: 'Register', ja: '登録' },
    '不注册也能下单，凭邮箱和订单号查询交付内容。': { en: 'Order without registering; track delivery by email and order number.', ja: '登録せず注文可能。メールと注文番号で配送確認。' },
    '接收邮箱': { en: 'Receiving Email', ja: '受信用メール' },
    '用于接收卡密与订单通知': { en: 'For receiving keys & order notices', ja: 'カード・注文通知受信用' },
    '验证码': { en: 'Verification Code', ja: '認証コード' },
    '6 位验证码': { en: '6-digit code', ja: '6桁のコード' },
    '发送验证码': { en: 'Send Code', ja: 'コード送信' },
    '请输入 6 位验证码': { en: 'Enter 6-digit code', ja: '6桁のコードを入力' },
    '进入商店': { en: 'Enter Store', ja: 'ストアへ' },
    '游客订单保留 30 天，建议注册账号长期使用': { en: 'Guest orders kept 30 days; register for long-term use', ja: 'ゲスト注文は30日保存、長期利用は登録推奨' },
    '登录成功，正在跳转…': { en: 'Login success, redirecting…', ja: 'ログイン成功、転送中…' },
    '登录失败，请确认服务已启动': { en: 'Login failed; please ensure server is running', ja: 'ログイン失敗、サーバー起動を確認' },
    '已以 SVIP 体验身份登录，下单享受 1.5 折': { en: 'Logged in as SVIP trial; enjoy 1.5 off', ja: 'SVIP体験でログイン、1.5引き適用' },
    '体验登录失败': { en: 'Trial login failed', ja: '体験ログイン失敗' },
    '注册成功，已自动登录': { en: 'Registered and signed in', ja: '登録完了、自動ログイン' },
    '注册失败，请确认服务已启动': { en: 'Registration failed; ensure server is running', ja: '登録失敗、サーバー起動を確認' },
    '验证码已发送至 ': { en: 'Code sent to ', ja: 'コード送信先：' },
    '已进入商店': { en: 'Entered store', ja: 'ストアへ移動' },

    /* 个人中心 */
    '会员等级与折扣': { en: 'Membership & Discounts', ja: '会員ランクと割引' },
    '折扣试算（会员价仅在下单时计入，列表仍为原价）': { en: 'Discount calculator (member price applies at checkout only)', ja: '割引シミュレーション（会員価格は決済時のみ適用）' },
    '原价（CNY）': { en: 'Original Price (CNY)', ja: '定価（CNY）' },
    '最近订单': { en: 'Recent Orders', ja: '最近の注文' },
    '我的购买记录': { en: 'My Purchases', ja: '購入履歴' },
    '我的收藏': { en: 'My Favorites', ja: 'お気に入り' },
    '加载中…': { en: 'Loading…', ja: '読み込み中…' },
    '我的兑换记录': { en: 'My Redemptions', ja: '引き換え履歴' },
    '尚未登录': { en: 'Not Logged In', ja: '未ログイン' },
    '登录后可查看会员等级、折扣与购买记录': { en: 'Log in to view levels, discounts and purchases', ja: 'ログインでランク・割引・購入履歴を表示' },
    '去登录 / 注册': { en: 'Log in / Register', ja: 'ログイン / 登録' },
    '登录后查看订单': { en: 'Log in to view orders', ja: 'ログインで注文表示' },
    '登录后查看购买记录': { en: 'Log in to view purchases', ja: 'ログインで購入履歴表示' },
    '卡密兑换': { en: 'Redeem Card', ja: 'カード引き換え' },
    '账户设置': { en: 'Account Settings', ja: 'アカウント設定' },
    /* 会员升级购买 */
    '升级会员': { en: 'Upgrade Membership', ja: '会員ランク升级' },
    '支付方式': { en: 'Payment Method', ja: '支払い方法' },
    '购买 LVIP / VIP / SVIP 会员，支付成功后立即生效，可在有效期内叠加时长': { en: 'Buy LVIP / VIP / SVIP membership — takes effect right after payment, duration stacks within the validity period', ja: 'LVIP / VIP / SVIP 会員を購入 — 支払い後すぐに発効、期間はその有効期限に加算されます' },
    '会员权益以服务端记录为准：升级后等级立即提升，同级购买可在原到期日上叠加时长；到期后自动恢复为无折扣。': { en: 'Membership benefits follow server records: upgrades take effect immediately, same-tier purchases stack onto the current expiry date, and expired memberships fall back to no discount.', ja: '会員特典はサーバー記録が正です：アップグレードは即時反映、同じランクは有効期限に加算、期限切れ後は割引なしに戻ります。' },
    '立即开通': { en: 'Buy Now', ja: '今すぐ購入' },
    '已拥有': { en: 'Owned', ja: '購入済み' },
    '可升级': { en: 'Upgrade', ja: 'アップグレード可' },
    '当前等级': { en: 'Current Level', ja: '現在のランク' },
    '正在创建订单…': { en: 'Creating order…', ja: '注文を作成中…' },
    '下单中…': { en: 'Ordering…', ja: '注文中…' },
    '正在跳转支付…': { en: 'Redirecting to payment…', ja: '支払いへ移動中…' },
    '会员已升级，到账生效': { en: 'Membership upgraded and applied', ja: '会員アップグレードが反映されました' },
    '请先登录': { en: 'Please sign in first', ja: '先にログインしてください' },
    '账号中心': { en: 'Account', ja: 'アカウント' },
    '退出登录': { en: 'Log Out', ja: 'ログアウト' },
    '应用接入 · 开发者密钥': { en: 'App Integration · Developer Key', ja: 'アプリ連携 · 開発者キー' },
    'App ID（公开，用于跳转参数）': { en: 'App ID (public, used in redirect)', ja: 'App ID（公開、リダイレクト用）' },
    'App Key（密钥，仅服务端使用）': { en: 'App Key (secret, server-side only)', ja: 'App Key（秘密、サーバー側のみ）' },
    '接入代码示例（替换你的域名后使用）': { en: 'Integration code (replace with your domain)', ja: '連携コード（独自ドメインに置換）' },
    '显示': { en: 'Show', ja: '表示' },
    '隐藏': { en: 'Hide', ja: '非表示' },
    '轮换': { en: 'Rotate', ja: 'ローテーション' },
    'App ID 已复制': { en: 'App ID copied', ja: 'App ID をコピーしました' },
    'App Key 已复制': { en: 'App Key copied', ja: 'App Key をコピーしました' },
    '获取密钥失败': { en: 'Failed to get key', ja: 'キー取得に失敗' },
    '复制失败，请手动复制': { en: 'Copy failed, please copy manually', ja: 'コピー失敗、手動でコピーしてください' },
    'App Key 已轮换': { en: 'App Key rotated', ja: 'App Key をローテーションしました' },
    '轮换后旧密钥立即失效，确定继续？': { en: 'Old key becomes invalid immediately after rotation. Continue?', ja: 'ローテーション後、旧キーは即時無効になります。続行しますか？' },
    '累计订单': { en: 'Total Orders', ja: '累計注文' },
    '累计消费 CNY': { en: 'Total Spent CNY', ja: '累計利用額 CNY' },
    '我的积分': { en: 'My Points', ja: 'マイポイント' },
    '我的折扣': { en: 'My Discount', ja: 'マイ割引' },
    '至尊会员专享': { en: 'SVIP Exclusive', ja: 'SVIP限定' },
    'VIP 尊享': { en: 'VIP Exclusive', ja: 'VIP限定' },
    '超级会员': { en: 'Super Member', ja: 'スーパー会員' },
    '未设置等级': { en: 'No Level Set', ja: 'ランク未設定' },
    '默认等级': { en: 'Default Level', ja: 'デフォルトランク' },
    '当前等级': { en: 'Current Level', ja: '現在のランク' },
    '订单号': { en: 'Order No.', ja: '注文番号' },
    '下单时间': { en: 'Placed At', ja: '注文日時' },
    '金额': { en: 'Amount', ja: '金額' },
    '状态': { en: 'Status', ja: 'ステータス' },
    '查看': { en: 'View', ja: '表示' },
    '还没有订单记录，': { en: 'No orders yet. ', ja: '注文履歴はまだありません。' },
    '去商店看看': { en: 'Go to store', ja: 'ストアへ' },
    '暂无购买记录': { en: 'No purchases yet', ja: '購入履歴なし' },
    '无法加载（请确认服务已启动）': { en: 'Failed to load (ensure server is running)', ja: '読み込み失敗（サーバー起動を確認）' },
    '暂无兑换记录，': { en: 'No redemptions yet. ', ja: '引き換え履歴はまだありません。' },
    '去兑换卡密': { en: 'Redeem a card', ja: 'カードを引き換え' },
    '还没有收藏，': { en: 'No favorites yet. ', ja: 'お気に入りはまだありません。' },
    '去商店逛逛': { en: 'Browse the store', ja: 'ストアを眺める' },
    '操作': { en: 'Action', ja: '操作' },
    '取消收藏': { en: 'Unfavorite', ja: 'お気に入り解除' },
    '已退出登录': { en: 'Logged out', ja: 'ログアウトしました' },
    '你的等级': { en: 'Your level', ja: 'あなたのランク' },
    '原价': { en: 'Original', ja: '定価' },
    '实付': { en: 'Paid', ja: 'お支払い' },
    '已省': { en: 'Saved', ja: '節約' },

    /* 博客 / 文章 */
    '记录产品更新、技术实践与运营笔记': { en: 'Product updates, engineering notes and ops tips', ja: 'プロダクト更新・技術記事・運営ノート' },
    '全部': { en: 'All', ja: 'すべて' },
    '该分类下暂无文章': { en: 'No articles in this category', ja: 'このカテゴリの記事はありません' },
    '产品更新': { en: 'Product Update', ja: 'プロダクト更新' },
    '技术实践': { en: 'Engineering', ja: '技術実践' },
    '运营笔记': { en: 'Ops Notes', ja: '運営ノート' },
    '分钟阅读': { en: 'min read', ja: '分で読了' },
    '目录': { en: 'Contents', ja: '目次' },
    '相关阅读': { en: 'Related', ja: '関連記事' },
    '次浏览': { en: 'views', ja: '閲覧' },
    '有帮助': { en: 'Helpful', ja: '役に立った' },
    '复制链接': { en: 'Copy Link', ja: 'リンクをコピー' },
    '感谢反馈！': { en: 'Thanks for the feedback!', ja: 'フィードバックありがとう！' },
    '链接已复制': { en: 'Link copied', ja: 'リンクをコピーしました' },
    '返回博客列表': { en: 'Back to Blog', ja: 'ブログへ戻る' },

    /* 卡密兑换 */
    '请先 ': { en: 'Please ', ja: '最初に ' },
    ' 后兑换卡密权益。': { en: ' to redeem card benefits.', ja: ' してカード特典を引き換え。' },
    '积分': { en: 'Points', ja: 'ポイント' },
    '有效期至': { en: 'Valid until', ja: '有効期限' },
    '输入卡密兑换权益': { en: 'Enter a card to redeem', ja: 'カードを入力して引き換え' },
    '卡密兑换后将直接发放到当前账号（升级会员等级或增加积分）。每张卡密仅可使用一次，请确认输入无误。': { en: 'Redeemed benefits go to your account (upgrade level or add points). Each code is one-time use.', ja: '引き換え特典はアカウントへ付与（ランク昇格またはポイント付与）。各コードは1回限り。' },
    '暂无兑换记录': { en: 'No redemptions yet', ja: '引き換え履歴なし' },
    '兑换成功': { en: 'Redeemed', ja: '引き換え完了' },
    '请输入卡密': { en: 'Enter a card code', ja: 'カードコードを入力' },
    '兑换中…': { en: 'Redeeming…', ja: '引き換え中…' },
    '兑换失败': { en: 'Redemption failed', ja: '引き換え失敗' },

    /* 订单查询 */
    '订单查询': { en: 'Order Lookup', ja: '注文照会' },
    '按订单号': { en: 'By Order No.', ja: '注文番号で' },
    '按联系方式': { en: 'By Contact', ja: '連絡先で' },
    '请输入订单号，例如 XJ1234567890': { en: 'Enter order no., e.g. XJ1234567890', ja: '注文番号を入力、例 XJ1234567890' },
    '请输入下单时填写的 QQ / 微信 / 邮箱 / 手机号': { en: 'Enter the QQ / WeChat / email / phone used at checkout', ja: '注文時のQQ/WeChat/メール/電話を入力' },
    '查询': { en: 'Search', ja: '検索' },
    '已完成': { en: 'Completed', ja: '完了' },
    '待支付': { en: 'Pending', ja: '未払い' },
    '交付中': { en: 'Delivering', ja: '配送中' },
    '已退款': { en: 'Refunded', ja: '返金済み' },
    '联系方式：': { en: 'Contact: ', ja: '連絡先：' },
    '支付方式：': { en: 'Payment: ', ja: '支払方法：' },
    '备注：': { en: 'Note: ', ja: '備考：' },
    '交付内容': { en: 'Delivery', ja: '配送内容' },
    '复制': { en: 'Copy', ja: 'コピー' },
    '实付合计': { en: 'Total Paid', ja: '合計支払額' },
    '再来一单': { en: 'Order Again', ja: 'もう一度注文' },
    '继续购物': { en: 'Keep Shopping', ja: '買い物を続ける' },
    '没有查询到相关订单': { en: 'No matching orders', ja: '該当する注文がありません' },
    '请输入查询条件': { en: 'Enter a search term', ja: '検索条件を入力' },
    '未找到该订单': { en: 'Order not found', ja: '注文が見つかりません' },
    '还没有任何订单，先去商店逛逛吧': { en: 'No orders yet — browse the store', ja: '注文はまだありません、ストアへ' },
    '已复制到剪贴板': { en: 'Copied to clipboard', ja: 'クリップボードにコピー' },
    '已重新加入购物车': { en: 'Re-added to cart', ja: 'カートに再追加' },

    /* 维护 / 封禁 */
    '网站维护中': { en: 'Under Maintenance', ja: 'メンテナンス中' },
    '亲爱的用户，本站正在升级维护，暂时无法访问。给您带来不便，敬请谅解，我们会尽快恢复服务。': { en: 'We are upgrading and temporarily unavailable. Sorry for the inconvenience; service will resume soon.', ja: 'アップグレードのため一時的にご利用いただけません。ご不便お詫びし、早期復旧します。' },
    '管理员请前往 ': { en: 'Admins: go to ', ja: '管理者は ' },
    ' 关闭「维护模式」后恢复访问。': { en: ' to disable maintenance mode.', ja: ' でメンテナンスモードを解除してください。' },
    '商店：': { en: 'Store: ', ja: 'ストア：' },
    '账户已被封禁': { en: 'Account Banned', ja: 'アカウント停止' },
    '您的账户因违反相关规定已被封禁，当前无法浏览商店、下单或查看个人中心。': { en: 'Your account was banned for policy violations. You cannot browse, order, or view your profile.', ja: '規約違反によりアカウントを停止しました。ストア閲覧・注文・プロフィール確認はできません。' },
    '当前账户：': { en: 'Current account: ', ja: '現在のアカウント：' },
    '· 封禁期间 ': { en: '· During the ban ', ja: '· 停止期間中 ' },
    '，无法访问商店内容': { en: ', store content is inaccessible', ja: '、ストアコンテンツは閲覧不可' },
    '· 如需继续使用，请切换至其他正常账户登录': { en: '· Switch to another active account to continue', ja: '· 別の正常アカウントでログインして継続' },
    '· 若有疑问，请联系客服邮箱 ': { en: '· Questions? Contact support email ', ja: '· ご質問はサポートメール ' },
    '切换账户': { en: 'Switch Account', ja: 'アカウント切替' },

    /* 质感 / 风格（普通 / 玻璃 / ore ui） */
    '风格': { en: 'Style', ja: 'スタイル' },
    '普通': { en: 'Normal', ja: 'ノーマル' },
    '玻璃': { en: 'Glass', ja: 'ガラス' },
    'ore ui': { en: 'Ore UI', ja: 'Ore UI' },
    '玻璃效果': { en: 'Glass Effect', ja: 'ガラス効果' },
    '已切换到玻璃质感': { en: 'Glass effect on', ja: 'ガラス効果 オン' },
    '已切换到普通质感': { en: 'Glass effect off', ja: 'ガラス効果 オフ' },
    '已切换到 ore ui 风格': { en: 'Switched to Ore UI', ja: 'Ore UI に切り替え' },

    /* 账户设置（个人中心） */
    '账户设置': { en: 'Account Settings', ja: 'アカウント設定' },
    '用户名': { en: 'Username', ja: 'ユーザー名' },
    '邮箱': { en: 'Email', ja: 'メール' },
    '手机号': { en: 'Phone', ja: '電話番号' },
    'QQ': { en: 'QQ', ja: 'QQ' },
    '默认联系方式': { en: 'Default Contact', ja: '優先連絡方法' },
    '修改密码（留空则不修改）': { en: 'New Password (leave blank to keep)', ja: '新しいパスワード（空欄は変更なし）' },
    '新密码': { en: 'New password', ja: '新しいパスワード' },
    '保存': { en: 'Save', ja: '保存' },
    '取消': { en: 'Cancel', ja: 'キャンセル' },
    '用户名不能为空': { en: 'Username is required', ja: 'ユーザー名は必須です' },
    '邮箱格式不正确': { en: 'Invalid email format', ja: 'メール形式が正しくありません' },
    '账户设置已保存': { en: 'Settings saved', ja: '設定を保存しました' },
    '保存失败': { en: 'Save failed', ja: '保存に失敗しました' },
    '保存失败，请确认服务已启动': { en: 'Save failed, please ensure the server is running', ja: '保存に失敗しました。サーバー起動を確認してください' },
    '关闭': { en: 'Close', ja: '閉じる' },
    '查看公告': { en: 'View announcement', ja: 'お知らせを見る' },

    /* 星际账号管理中心 */
    '星际账号管理中心': { en: 'Stellar Account Center', ja: 'ステラ アカウントセンター' },
    '欢迎来到星际账号管理中心': { en: 'Welcome to the Stellar Account Center', ja: 'ステラ アカウントセンターへようこそ' },
    '创建你的星际账号': { en: 'Create your Stellar account', ja: 'ステラアカウントを作成' },
    '已有账号？去登录': { en: 'Already have an account? Sign in', ja: 'アカウントをお持ちの方はログイン' },
    '还没有账号？立即注册': { en: "Don't have an account? Sign up", ja: 'アカウントをお持ちでない方は登録' },
    '确认密码': { en: 'Confirm Password', ja: 'パスワード（確認）' },
    '进入商店': { en: 'Enter Store', ja: 'ストアへ' },
    '注册星际账号': { en: 'Sign up for Stellar', ja: 'ステラに登録' },
  };

  function getLang() { return curLang; }
  function curLangLabel() { const l = LANGS.find(x => x.code === curLang); return l ? l.label : '中文'; }
  function tr(zh) {
    return trVal(zh);
  }
  function loc(obj, field) {
    if (obj && obj.i18n && obj.i18n[curLang] && obj.i18n[curLang][field] != null) return obj.i18n[curLang][field];
    if (curLang === 'zhHant') {
      if (obj && obj.i18n && obj.i18n.zh && obj.i18n.zh[field] != null) return s2t(obj.i18n.zh[field]);
      if (obj && obj[field] != null) return s2t(String(obj[field]));
    }
    return obj ? (obj[field] != null ? obj[field] : '') : '';
  }
  function translateStatic(root) {
    if (!root) return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(node => {
      const pn = node.parentNode;
      if (!pn) return;
      const tag = pn.tagName;
      if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'TEXTAREA' || tag === 'INPUT' || tag === 'CODE' || tag === 'PRE') return;
      if (pn.closest && pn.closest('#langSw')) return;
      const key = node.nodeValue.trim();
      if (!key) return;
      const val = trVal(key);
      if (val !== key) {
        // 首次翻译：记下中文原文，便于在多种语言之间来回切换
        node.__i18nOrig = key;
        node.nodeValue = val;
      } else if (node.__i18nOrig) {
        // 已是译文：按当前语言重新取值（zhHant 会走 s2t 兜底）
        node.nodeValue = trVal(node.__i18nOrig);
      }
    });
    root.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      el.textContent = trVal(key);
    });
    ['title', 'placeholder', 'aria-label'].forEach(attr => {
      root.querySelectorAll('[' + attr + ']').forEach(el => {
        const v = el.getAttribute(attr);
        const val = trVal(v);
        if (val !== v) {
          if (el.__i18nAttrOrig == null) el.__i18nAttrOrig = v;
          el.setAttribute(attr, val);
        } else if (el.__i18nAttrOrig != null) {
          el.setAttribute(attr, trVal(el.__i18nAttrOrig));
        }
      });
    });
  }
  function bindLangSwitcher() {
    const sw = document.getElementById('langSw');
    const toggle = document.getElementById('langToggle');
    const menu = document.getElementById('langMenu');
    if (!sw || !toggle || !menu) return;
    toggle.addEventListener('click', (e) => { e.stopPropagation(); sw.classList.toggle('open'); });
    menu.querySelectorAll('.lang-item').forEach(b => {
      b.addEventListener('click', () => { setLang(b.getAttribute('data-lang')); });
    });
  }
  function bindStyleSwitcher() {
    const sw = document.getElementById('styleSw');
    const toggle = document.getElementById('styleToggle');
    const menu = document.getElementById('styleMenu');
    if (!sw || !toggle || !menu) return;
    toggle.addEventListener('click', (e) => { e.stopPropagation(); sw.classList.toggle('open'); });
    menu.querySelectorAll('.style-item').forEach(b => {
      b.addEventListener('click', () => {
        const mode = b.getAttribute('data-style');
        applyStyle(mode, true);
        menu.querySelectorAll('.style-item').forEach(x => x.classList.toggle('active', x === b));
        sw.classList.remove('open');
      });
    });
  }

  /* ---------- 手机端抽屉导航 ----------
     窄屏下顶栏放不下横向导航（真实手机尤其如此），改为汉堡按钮 + 侧滑抽屉。
     抽屉内的链接直接指向各页面，移动端也能完整访问全站。 */
  function bindNavDrawer() {
    const burger = document.getElementById('navBurger');
    const drawer = document.getElementById('navDrawer');
    const mask = document.getElementById('navMask');
    const close = document.getElementById('navClose');
    if (!drawer || !mask) return;

    const open = () => {
      drawer.classList.add('open');
      mask.hidden = false;
      requestAnimationFrame(() => mask.classList.add('show'));
      document.documentElement.classList.add('drawer-open');
      if (close) close.focus();
    };
    const shut = () => {
      drawer.classList.remove('open');
      mask.classList.remove('show');
      document.documentElement.classList.remove('drawer-open');
      setTimeout(() => { if (!drawer.classList.contains('open')) mask.hidden = true; }, 240);
    };
    if (burger) burger.addEventListener('click', open);
    if (close) close.addEventListener('click', shut);
    mask.addEventListener('click', shut);
    drawer.querySelectorAll('a').forEach(a => a.addEventListener('click', shut));
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && drawer.classList.contains('open')) shut();
    });
  }
  function applyLang(lang) {
    if (lang) curLang = lang;
    if (!LANGS.some(l => l.code === curLang)) curLang = 'zh';
    try { document.documentElement.setAttribute('lang', curLang); } catch (e) {}
    const head = document.getElementById('header');
    if (head) { head.outerHTML = headerHTML(window.__xjActive || ''); }
    const foot = document.getElementById('footer');
    if (foot) foot.outerHTML = footerHTML();
    translateStatic(document.body);
    bindLangSwitcher();
    bindStyleSwitcher();
    bindNavDrawer();
    try { document.dispatchEvent(new CustomEvent('xj:langchange', { detail: { lang: curLang } })); } catch (e) {}
  }
  function setLang(lang) {
    if (!LANGS.some(l => l.code === lang)) lang = 'zh';
    curLang = lang;
    try { localStorage.setItem(LANG_KEY, lang); } catch (e) {}
    applyLang(lang);
  }

  /* ---------- 会员等级（展示用镜像，计价以服务端为准） ---------- */
  const LEVELS = {
    '':     { key: '',     name: '未设置', rate: 1,    zhe: null, color: '#8f959e' },
    none:   { key: 'none', name: '无折扣', rate: 1,    zhe: null, color: '#646a73' },
    lvip:   { key: 'lvip', name: 'LVIP',  rate: 0.70, zhe: 7,   color: '#0ea5e9' },
    vip:    { key: 'vip',  name: 'VIP',   rate: 0.45, zhe: 4.5, color: '#8b5cf6' },
    svip:   { key: 'svip', name: 'SVIP',  rate: 0.15, zhe: 1.5, color: '#f59e0b' },
  };
  function levelInfo(level) { return LEVELS[String(level || '')] || LEVELS['']; }

  /* ---------- 风格（普通 / 玻璃 / ore ui） ---------- */
  const STYLE_KEY = 'xj_style';
  const STYLE_MODES = ['normal', 'glass', 'ore'];
  let styleMode = 'glass'; // 默认开启玻璃质感；首次访问即为玻璃，可由顶栏「风格」菜单切换
  try {
    const s = localStorage.getItem(STYLE_KEY);
    if (s && STYLE_MODES.includes(s)) {
      styleMode = s;
    } else {
      // 兼容旧版 xj_glass 存储（'on' → 玻璃，'off' → 普通）
      const g = localStorage.getItem('xj_glass');
      if (g !== null) styleMode = g === 'on' ? 'glass' : 'normal';
    }
  } catch (e) {}

  /* ---------- 主题 ---------- */
  const THEME_KEY = 'xj_theme';

  function currentTheme() {
    return document.documentElement.getAttribute('data-theme') || 'light';
  }

  function applyTheme(t, animate) {
    if (animate) {
      document.documentElement.classList.add('theme-anim');
      setTimeout(() => document.documentElement.classList.remove('theme-anim'), 280);
    }
    document.documentElement.setAttribute('data-theme', t);
    localStorage.setItem(THEME_KEY, t);
    const btn = document.getElementById('themeToggle');
    if (btn) btn.innerHTML = t === 'dark' ? ICON.sun : ICON.moon;
    // 切换到深色/浅色后，背景遮罩色需跟随主题重绘，否则遮罩仍是旧主题色
    if (SITE_BG) paintSiteBg();
  }

  function applyStyle(mode, animate) {
    if (!STYLE_MODES.includes(mode)) mode = 'glass';
    styleMode = mode;
    try { localStorage.setItem(STYLE_KEY, styleMode); } catch (e) {}
    if (animate) {
      document.documentElement.classList.add('theme-anim');
      setTimeout(() => document.documentElement.classList.remove('theme-anim'), 280);
    }
    document.documentElement.classList.toggle('glass-mode', styleMode === 'glass');
    document.documentElement.classList.toggle('ore-mode', styleMode === 'ore');
    const btn = document.getElementById('styleToggle');
    if (btn) btn.innerHTML = styleMode === 'glass' ? ICON.glass : styleMode === 'ore' ? ICON.ore : ICON.square;
    // 玻璃态下减弱背景遮罩，让卡片透出更多底色/图片，质感更明显
    if (SITE_BG) paintSiteBg();
    if (animate) {
      const msg = styleMode === 'glass' ? tr('已切换到玻璃质感')
                : styleMode === 'ore' ? tr('已切换到 ore ui 风格')
                : tr('已切换到普通质感');
      toast(msg);
    }
  }

  /* ---------- 手机端样式 ----------
     两个概念分开管理：
     - mobile-layout：手机端「排版层」。真实窄屏（≤900px）自动生效；
       桌面端可用顶栏「手机」按钮手动预览。承载全部响应式排版规则。
     - mobile-mode：桌面端预览时的「机身外观」（430px 居中 + 圆角边框）。
       真实手机本身就是机身，不需要这层，故只在宽屏 + 手动开启时出现。
     状态存 xj_mobile（'on'/'off'），表示用户的手动偏好。 */
  const MOBILE_KEY = 'xj_mobile';
  const MOBILE_MAX = 900;
  let mobileOn = false;
  try { mobileOn = localStorage.getItem(MOBILE_KEY) === 'on'; } catch (e) {}

  function isNarrowScreen() {
    return window.innerWidth <= MOBILE_MAX;
  }
  /* 排版层是否生效：真实窄屏自动生效，或用户手动开启预览 */
  function mobileLayoutActive() {
    return mobileOn || isNarrowScreen();
  }

  function applyMobile(on, animate) {
    mobileOn = !!on;
    try { localStorage.setItem(MOBILE_KEY, mobileOn ? 'on' : 'off'); } catch (e) {}
    if (animate) {
      document.documentElement.classList.add('theme-anim');
      setTimeout(() => document.documentElement.classList.remove('theme-anim'), 280);
    }
    syncMobile();
    const btn = document.getElementById('mobileToggle');
    if (btn) btn.innerHTML = mobileOn ? ICON.desktop : ICON.mobile;
  }

  /* 同步 html 上的两个类：mobile-layout（排版）/ mobile-mode（机身外观） */
  function syncMobile() {
    const html = document.documentElement;
    const narrow = isNarrowScreen();
    html.classList.toggle('mobile-layout', mobileOn || narrow);
    html.classList.toggle('mobile-mode', mobileOn && !narrow);
  }

  /* 窗口尺寸跨越 900px 时（如真机横竖屏切换、桌面端拖窄窗口）自动重算 */
  let mobileResizeTimer = null;
  window.addEventListener('resize', () => {
    clearTimeout(mobileResizeTimer);
    mobileResizeTimer = setTimeout(syncMobile, 120);
  });

  /* ---------- 购物车 ---------- */
  const CART_KEY = 'xj_cart';
  const cart = {
    all() {
      try { return JSON.parse(localStorage.getItem(CART_KEY) || '[]'); } catch (e) { return []; }
    },
    save(list) { localStorage.setItem(CART_KEY, JSON.stringify(list)); cart.syncBadge(); },
    count() { return cart.all().reduce((n, i) => n + (i.qty || 0), 0); },
    total() { return cart.all().reduce((n, i) => n + (i.price || 0) * (i.qty || 0), 0); },
    add(item) {
      const list = cart.all();
      const hit = list.find(i => i.id === item.id && i.spec === item.spec);
      if (hit) hit.qty += item.qty; else list.push(item);
      cart.save(list);
    },
    remove(id, spec) {
      cart.save(cart.all().filter(i => !(i.id === id && i.spec === spec)));
    },
    setQty(id, spec, qty) {
      const list = cart.all();
      const hit = list.find(i => i.id === id && i.spec === spec);
      if (hit) { hit.qty = Math.max(1, qty); cart.save(list); }
    },
    clear() { cart.save([]); },
    syncBadge() {
      const n = cart.count();
      localStorage.setItem('xj_cart_count', n);
      document.querySelectorAll('#cartBadge').forEach(el => {
        el.textContent = n;
        el.classList.toggle('show', n > 0);
      });
    },
  };

  /* ---------- Toast ---------- */
  let toastTimer;
  function toast(msg) {
    let wrap = document.getElementById('toastWrap');
    if (!wrap) {
      wrap = document.createElement('div');
      wrap.id = 'toastWrap';
      wrap.className = 'toast-wrap';
      document.body.appendChild(wrap);
    }
    const el = document.createElement('div');
    el.className = 'toast';
    el.innerHTML = ICON.check + '<span>' + msg + '</span>';
    wrap.appendChild(el);
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      el.style.transition = 'opacity .25s, transform .25s';
      el.style.opacity = '0';
      el.style.transform = 'translateY(8px)';
      setTimeout(() => el.remove(), 260);
    }, 1800);
  }

  /* ---------- 顶栏 ---------- */
  const NAVS = [
    { key: 'home',  text: '首页', href: 'store.html',    icon: ICON.home },
    { key: 'blog',  text: '博客', href: 'blog.html',     icon: ICON.blog },
    /* XJ AI：顶栏入口，cls 用于高亮样式（gradient 胶囊） */
    { key: 'ai',    text: 'XJ AI', href: 'ai.html',      icon: ICON.ai, cls: 'nav-ai' },
    { key: 'account', text: '账号中心', href: 'account-center.html', icon: ICON.user },
  ];

  function user() {
    try { return JSON.parse(localStorage.getItem('xj_user') || 'null'); } catch (e) { return null; }
  }
  /* 单点登录/登出联动：其他标签页改动 xj_user 时，本页自动刷新以同步登录态
     （storage 事件只在「别的标签页」改动时触发，本页自己的登出已由各页自行 reload，不会重复触发） */
  if (typeof window !== 'undefined') {
    window.addEventListener('storage', function (e) {
      if (e.key === 'xj_user') location.reload();
    });
  }
  function memberPill(u) {
    const L = levelInfo(u.level);
    const hasDiscount = L.rate < 1;
    return `
      <a class="member-pill" href="me.html" title="${tr('会员中心')}">
        <span class="mp-dot" style="background:${L.color}"></span>
        <span class="mp-name">${u.name}</span>
        <span class="mp-level" style="background:${L.color}">${tr(L.name)}${hasDiscount ? ' · ' + L.zhe + tr('折') : ''}</span>
      </a>`;
  }

  function headerHTML(active) {
    const navs = NAVS.map(n =>
      `<a class="nav-item ${n.cls || ''} ${n.key === active ? 'active' : ''}" href="${n.href}">${n.icon}<span class="nav-text">${tr(n.text)}</span></a>`
    ).join('');

    const u = user();
    const isMember = u && u.uid;
    const rightInner = isMember
      ? `${memberPill(u)}
         <a class="hbtn" href="cart.html">${ICON.cart}<span>${tr('购物车')}</span></a>
         <a class="enter-btn ${active === 'admin' ? 'active' : ''}" href="admin.html" title="${tr('进入管理后台')}">${ICON.shield}<span>${tr('进入后台')}</span></a>`
      : `<a class="hbtn" href="cart.html">${ICON.cart}<span>${tr('购物车')}</span></a>
         <a class="hbtn guest-btn" href="login.html">${ICON.guest}<span>${tr('游客登录')}</span></a>
         <a class="hbtn login-btn" href="login.html">${ICON.login}<span>${tr('登录')}</span></a>
         <a class="enter-btn ${active === 'admin' ? 'active' : ''}" href="admin.html" title="${tr('进入管理后台')}">${ICON.shield}<span>${tr('进入后台')}</span></a>`;

    const langOpts = LANGS.map(l =>
      `<button class="lang-item ${l.code === curLang ? 'active' : ''}" data-lang="${l.code}">${l.label}</button>`
    ).join('');

    return `
    <header class="header" id="header">
      <div class="header-inner">
      <button class="icon-btn nav-burger" id="navBurger" title="${tr('打开菜单')}" aria-label="${tr('打开菜单')}">${ICON.menu}</button>
      <a class="brand" href="store.html">
        <span class="brand-logo">X</span>
        <span class="brand-name">XJ Store</span>
      </a>
      <nav class="nav">${navs}</nav>
      <div class="header-right">
        ${rightInner}
        <div class="divider-v"></div>
        <div class="lang-sw" id="langSw">
          <button class="icon-btn lang-btn" id="langToggle" title="${tr('语言')}">${ICON.globe}<span class="lang-cur">${curLangLabel()}</span></button>
          <div class="lang-menu" id="langMenu">${langOpts}</div>
        </div>
        <div class="lang-sw" id="styleSw">
          <button class="icon-btn" id="styleToggle" title="${tr('风格')}">${styleMode === 'glass' ? ICON.glass : styleMode === 'ore' ? ICON.ore : ICON.square}</button>
          <div class="lang-menu" id="styleMenu">
            <button class="style-item lang-item ${styleMode === 'normal' ? 'active' : ''}" data-style="normal">${ICON.square}<span>${tr('普通')}</span></button>
            <button class="style-item lang-item ${styleMode === 'glass' ? 'active' : ''}" data-style="glass">${ICON.glass}<span>${tr('玻璃')}</span></button>
            <button class="style-item lang-item ${styleMode === 'ore' ? 'active' : ''}" data-style="ore">${ICON.ore}<span>${tr('ore ui')}</span></button>
          </div>
        </div>
        <button class="icon-btn" id="themeToggle" title="${tr('切换主题')}">${currentTheme() === 'dark' ? ICON.sun : ICON.moon}</button>
        <button class="icon-btn" id="mobileToggle" title="${tr('切换手机端')}">${mobileOn ? ICON.desktop : ICON.mobile}</button>
        <a class="icon-btn cart-btn" href="cart.html" title="${tr('购物车')}">
          ${ICON.cart2}<span class="cart-badge" id="cartBadge">0</span>
        </a>
      </div>
      </div>
    </header>
    <div class="nav-drawer-mask" id="navMask" hidden></div>
    <aside class="nav-drawer" id="navDrawer" aria-hidden="true">
      <div class="drawer-head">
        <a class="brand" href="store.html"><span class="brand-logo">X</span><span class="brand-name">XJ Store</span></a>
        <button class="icon-btn" id="navClose" title="${tr('关闭菜单')}" aria-label="${tr('关闭菜单')}">${ICON.close}</button>
      </div>
      <nav class="drawer-nav">
        ${navs}
        <a class="nav-item" href="me.html">${ICON.user}<span class="nav-text">${tr('会员中心')}</span></a>
      </nav>
      <div class="drawer-foot">
        <a class="hbtn" href="cart.html">${ICON.cart}<span>${tr('购物车')}</span></a>
        <a class="enter-btn" href="admin.html">${ICON.shield}<span>${tr('进入后台')}</span></a>
      </div>
    </aside>`;
  }

  /* ---------- 页脚 ---------- */
  function footerHTML() {
    return `
    <footer class="footer">
      <div class="footer-inner">
        <div>
          <div class="f-brand"><span class="brand-logo">X</span> XJ Store</div>
          <div class="f-desc">${tr('XJ 的商店')}<br />${tr('数字商品与自动化服务的本地演示站点。')}</div>
        </div>
        <div>
          <div class="f-title">${tr('快速链接')}</div>
          <div class="f-links">
            <a href="store.html">${ICON.home} ${tr('首页')}</a>
            <a href="blog.html">${ICON.blog} ${tr('博客')}</a>
            <a href="me.html">${ICON.about} ${tr('关于')}</a>
          </div>
        </div>
        <div>
          <div class="f-title">${tr('联系我们')}</div>
          <div class="f-links">
            <a href="mailto:3805506653@qq.com">${ICON.mail} 3805506653@qq.com</a>
            <a href="https://wpa.qq.com/msgrd?v=3&amp;uin=3805506653&amp;site=qq&amp;menu=yes" target="_blank" rel="noopener">${ICON.qq} QQ：3805506653</a>
            <a href="#">${ICON.help} ${tr('帮助中心')}</a>
          </div>
        </div>
      </div>
      <div class="footer-bottom">
        <div>${tr('© 2026 XJ Store. 保留所有权利')}</div>
        <div class="links"><a href="#">${tr('隐私政策')}</a><a href="#">${tr('服务条款')}</a><a href="admin.html">${tr('管理后台')}</a></div>
      </div>
    </footer>`;
  }

  /* ---------- 涟漪 ---------- */
  function bindRipple() {
    document.addEventListener('pointerdown', e => {
      const btn = e.target.closest('.btn');
      if (!btn || btn.disabled) return;
      const r = btn.getBoundingClientRect();
      const size = Math.max(r.width, r.height);
      const span = document.createElement('span');
      span.className = 'ripple';
      span.style.width = span.style.height = size + 'px';
      span.style.left = (e.clientX - r.left - size / 2) + 'px';
      span.style.top = (e.clientY - r.top - size / 2) + 'px';
      btn.appendChild(span);
      setTimeout(() => span.remove(), 600);
    });
  }

  /* ---------- 回到顶部 ---------- */
  function bindToTop() {
    const btn = document.getElementById('toTop');
    if (!btn) return;
    btn.innerHTML = ICON.top;
    window.addEventListener('scroll', () => {
      btn.classList.toggle('show', window.scrollY > 400);
    }, { passive: true });
    btn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
  }

  /* ---------- 初始化 ---------- */
  function init(opts) {
    opts = opts || {};
    const p = location.pathname.split('/').pop();
    const isAdminPage = /(^|\/)admin\.html$/.test(location.pathname) || /account-admin\.html$/.test(location.pathname);
    const isMaint = p === 'maintenance.html';
    const isBanned = p === 'banned.html';
    window.__xjActive = opts.active || '';
    const head = document.getElementById('header');
    const foot = document.getElementById('footer');
    if (head) head.outerHTML = headerHTML(opts.active);
    if (foot) foot.outerHTML = footerHTML();

    applyTheme(currentTheme(), false);
    applyLang(curLang); // 应用语言：重渲顶栏/页脚 + 翻译正文 + 绑定切换
    applyStyle(styleMode, false); // 应用风格：默认玻璃质感，可由顶栏「风格」菜单切换（普通 / 玻璃 / ore ui）
    applyMobile(mobileOn, false); // 应用手机端样式：可由顶栏「手机」按钮切换，状态持久化

    // 顶栏开关统一用事件委托绑定：语言切换会重建顶栏 DOM（outerHTML 替换），
    // 委托到 document 可避免重建后主题/玻璃/手机按钮的点击事件失效
    document.addEventListener('click', (e) => {
      const tEl = e.target.closest('#themeToggle');
      if (tEl) {
        const next = currentTheme() === 'dark' ? 'light' : 'dark';
        applyTheme(next, true);
        toast(next === 'dark' ? '已切换到黑夜模式' : '已切换到白天模式');
        return;
      }
      const mEl = e.target.closest('#mobileToggle');
      if (mEl) {
        /* 真实窄屏下排版本就固定为手机端，按钮只切换「机身预览」的观感 */
        const next = !mobileOn;
        applyMobile(next, true);
        toast(next ? tr('已切换到手机端样式') : tr('已切换到桌面端样式'));
        return;
      }
    });

    // 点击空白处关闭语言菜单 / 风格菜单（只绑定一次）
    document.addEventListener('click', (e) => {
      const sw = document.getElementById('langSw');
      if (sw && !sw.contains(e.target)) sw.classList.remove('open');
      const ssw = document.getElementById('styleSw');
      if (ssw && !ssw.contains(e.target)) ssw.classList.remove('open');
    });

    cart.syncBadge();
    bindRipple();
    bindToTop();

    // 维护模式拦截：仅对前台访客页面生效，后台/维护页/封禁页放行
    if (!isAdminPage && !isMaint && !isBanned) guardMaintenance();

    // 随机背景图：每次进入/刷新请求一次图源；后台页不应用，避免影响操作
    applySiteBackground(isAdminPage);

    // 站点公告横幅：顶栏下方；后台/维护/封禁页不显示
    applyAnnouncement(isAdminPage || isMaint || isBanned);
    applyUpdatePopup(isAdminPage || isMaint || isBanned);
  }

  /* ---------- 随机背景图 ----------
     图源地址由后台「随机背景图」配置，接口每次返回一张随机图。
     - 每次页面加载请求一次（URL 带时间戳，确保刷新能换图）
     - 图片加载成功后才应用，失败/关闭时保持原有主题背景，不会出现空白或破图
     - 直接铺在 body 背景上（不能用 z-index:-1 的图层：body 自身有不透明背景色，
       负 z-index 图层会绘制在 body 背景之下而被完全遮住）
     - 浓度用「半透明同色遮罩」实现：遮罩色取自当前主题背景色，故深浅色主题都自然 */
  let SITE_BG = null; // { url, opacity }

  function paintSiteBg() {
    if (!SITE_BG || !document.body) return;
    const op = Math.min(Math.max(Number(SITE_BG.opacity), 0.05), 1);
    // 取当前主题背景色做遮罩，浓度 = 1 - 图片不透明度（玻璃态下再减弱，让底图透出）
    let r = 255, g = 255, b = 255;
    try {
      const bgc = getComputedStyle(document.body).backgroundColor || '';
      const m = bgc.match(/(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
      if (m) { r = +m[1]; g = +m[2]; b = +m[3]; }
    } catch (e) {}
    const a = Math.min(Math.max((1 - op) - (styleMode === 'glass' ? 0.45 : 0), 0.05), 1);
    const fade = 'rgba(' + r + ', ' + g + ', ' + b + ', ' + a.toFixed(3) + ')';
    const s = document.body.style;
    s.backgroundImage = 'linear-gradient(' + fade + ', ' + fade + '), url("' + SITE_BG.url + '")';
    s.backgroundSize = 'cover';
    s.backgroundPosition = 'center';
    s.backgroundRepeat = 'no-repeat';
    s.backgroundAttachment = 'fixed';
  }

  function applySiteBackground(isAdminPage) {
    if (isAdminPage || typeof fetch !== 'function') return;
    // 复用近期已解析好的直链，避免每次刷新/切页都打随机图源导致被限流
    let cached = null;
    try {
      const cu = localStorage.getItem('xj_bg_url');
      const ct = Number(localStorage.getItem('xj_bg_ts') || 0);
      if (cu && Date.now() - ct < 6 * 3600 * 1000) cached = cu;
    } catch (e) {}
    const tryLoad = (url, op, allowRetry, doCache) => {
      const img = new Image();
      img.onload = () => {
        SITE_BG = { url, opacity: op };
        paintSiteBg();
        if (document.body) document.body.classList.remove('bg-fallback');
        if (doCache) { try { localStorage.setItem('xj_bg_url', url); localStorage.setItem('xj_bg_ts', String(Date.now())); } catch (e) {} }
      };
      img.onerror = () => {
        if (allowRetry) tryLoad(url + (url.indexOf('?') >= 0 ? '&' : '?') + '_r=' + Date.now(), op, false, doCache);
        else if (document.body) document.body.classList.add('bg-fallback');
      };
      img.src = url;
    };
    if (cached) { tryLoad(cached, 0.18, false, false); return; }
    fetch('/api/site')
      .then(r => r.ok ? r.json() : null)
      .then(j => {
        const bg = j && j.ok && j.site && j.site.background;
        if (!bg || !bg.enabled || !String(bg.url || '').trim()) return;
        const url = String(bg.url).trim();
        const op = Math.min(Math.max(Number(bg.opacity != null ? bg.opacity : 0.18), 0.05), 1);
        // 加时间戳向随机图源取图，成功后缓存最终直链
        const finalUrl = url + (url.indexOf('?') >= 0 ? '&' : '?') + '_t=' + Date.now();
        tryLoad(finalUrl, op, true, true);
      })
      .catch(() => { /* 服务未起：保持原背景 */ });
  }

  /* ---------- 站点公告弹窗 ----------
     读取 /api/site 的 announcement 字段，以居中弹窗（modal）形式展示。
     - 访问页面时自动弹出（同一内容只自动弹一次，按内容哈希持久化）
     - 关闭后右下角浮出 📢 按钮，可随时再次点击查看
     - 后台修改公告内容后哈希变化，会重新自动弹出 */
  function applyAnnouncement(isAdminPage) {
    if (isAdminPage || typeof fetch !== 'function') return;
    if (document.getElementById('announceModal')) return;
    const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    const hashStr = s => { let h = 0; for (let i = 0; i < s.length; i++) { h = (h * 31 + s.charCodeAt(i)) | 0; } return 'a' + (h >>> 0).toString(36); };
    fetch('/api/site')
      .then(r => r.ok ? r.json() : null)
      .then(j => {
        const text = j && j.ok && j.site && String(j.site.announcement || '').trim();
        if (!text) return;
        const key = 'xj_announce_popup_' + hashStr(text);

        const overlay = document.createElement('div');
        overlay.className = 'announce-overlay';
        overlay.id = 'announceModal';
        overlay.innerHTML =
          '<div class="announce-dialog" role="alertdialog" aria-label="' + tr('公告') + '">' +
            '<button class="announce-x" id="announceX" title="' + tr('关闭') + '" aria-label="' + tr('关闭') + '">✕</button>' +
            '<div class="announce-head"><span class="announce-ico">' + ICON.bull + '</span>' +
              '<span class="announce-title" id="announceTitle">' + tr('公告') + '</span></div>' +
            '<div class="announce-body">' + esc(text) + '</div>' +
            '<button class="announce-ok" id="announceOk">' + tr('知道了') + '</button>' +
          '</div>';
        document.body.appendChild(overlay);

        const bell = document.createElement('button');
        bell.className = 'announce-bell';
        bell.id = 'announceBell';
        bell.title = tr('查看公告');
        bell.setAttribute('aria-label', tr('查看公告'));
        bell.innerHTML = '<span class="announce-bell-ico">' + ICON.bull + '</span>';
        document.body.appendChild(bell);

        const open = () => {
          overlay.classList.add('show');
          bell.classList.remove('show');
          document.body.classList.add('announce-locked');
        };
        const close = (persist) => {
          overlay.classList.remove('show');
          bell.classList.add('show');
          document.body.classList.remove('announce-locked');
          if (persist) { try { localStorage.setItem(key, '1'); } catch (e) {} }
        };

        let dismissed = false;
        try { dismissed = !!localStorage.getItem(key); } catch (e) {}
        if (dismissed) {
          bell.classList.add('show'); // 已读：只显示浮动按钮，不自动弹
        } else {
          requestAnimationFrame(() => requestAnimationFrame(open)); // 首次访问自动弹出
        }

        document.getElementById('announceX').addEventListener('click', () => close(true));
        document.getElementById('announceOk').addEventListener('click', () => close(true));
        overlay.addEventListener('click', (e) => { if (e.target === overlay) close(true); });
        bell.addEventListener('click', open);

        // 语言切换时同步弹窗文案
        document.addEventListener('xj:langchange', () => {
          const t = document.getElementById('announceTitle');
          const ok = document.getElementById('announceOk');
          const xb = document.getElementById('announceX');
          if (t) t.textContent = tr('公告');
          if (ok) ok.textContent = tr('知道了');
          if (xb) { const c = tr('关闭'); xb.title = c; xb.setAttribute('aria-label', c); }
          const b = document.getElementById('announceBell');
          if (b) { const v = tr('查看公告'); b.title = v; b.setAttribute('aria-label', v); }
        });
      })
      .catch(() => { /* 取不到公告就不显示，不影响购物 */ });
  }

  /* ---------- 版本更新弹窗（原 store.html 专属，现全站通用） ----------
     读取 /api/site 的 popup 字段（后台「弹窗公告」维护）：
     - enabled 且 title 非空 才弹
     - 同一天 + 同一 version 只弹一次（localStorage 记录）
     - 支持 link / linkText 跳转按钮；「今日不再提示」按天关闭 */
  function applyUpdatePopup(isAdminPage) {
    if (isAdminPage || typeof fetch !== 'function') return;
    if (document.getElementById('popupMask')) return;
    const escHtml = s => String(s == null ? '' : s).replace(/[&<>"']/g, m =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
    const todayStr = () => {
      const d = new Date();
      return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    };
    const POPUP_KEY = 'xj_popup_seen';
    const popupSeen = p => {
      let seen = {};
      try { seen = JSON.parse(localStorage.getItem(POPUP_KEY) || '{}'); } catch (e) { seen = {}; }
      return !!(seen.date === todayStr() && String(seen.version || '') === String(p.version || ''));
    };
    const markPopupSeen = p => {
      try { localStorage.setItem(POPUP_KEY, JSON.stringify({ date: todayStr(), version: String(p.version || '') })); } catch (e) {}
    };
    fetch('/api/site')
      .then(r => r.ok ? r.json() : null)
      .then(j => {
        const p = j && j.ok && j.site ? j.site.popup : null;
        if (!p || !p.enabled || !String(p.title || '').trim() || popupSeen(p)) return;
        const mask = document.createElement('div');
        mask.className = 'popup-mask';
        mask.id = 'popupMask';
        mask.innerHTML =
          '<div class="popup-card anim-zoom">' +
            '<div class="popup-head">' +
              '<span class="popup-badge">' + escHtml(p.version || '公告') + '</span>' +
              '<button class="popup-close" id="popClose" title="' + tr('关闭') + '" aria-label="' + tr('关闭') + '">✕</button>' +
            '</div>' +
            '<h3 class="popup-title">' + escHtml(p.title) + '</h3>' +
            '<div class="popup-body">' + escHtml(p.content || '') + '</div>' +
            '<div class="popup-foot">' +
              (p.link ? '<a class="btn btn-primary btn-sm" href="' + escHtml(p.link) + '">' + escHtml(p.linkText || tr('查看详情')) + '</a>' : '') +
              '<button class="btn btn-ghost btn-sm" id="popToday">' + tr('今日不再提示') + '</button>' +
            '</div>' +
          '</div>';
        document.body.appendChild(mask);
        const close = () => { mask.remove(); markPopupSeen(p); };
        mask.addEventListener('click', e => { if (e.target === mask) close(); });
        const xb = document.getElementById('popClose'); if (xb) xb.addEventListener('click', close);
        const td = document.getElementById('popToday'); if (td) td.addEventListener('click', close);
      })
      .catch(() => { /* 取不到就不弹，不影响购物 */ });
  }

  /* ---------- 维护模式拦截 ----------
     站点开启维护模式时，非管理员访客被引导至 maintenance.html。
     - 管理员（持有 xj_admin_token）放行，可正常进入后台与站点
     - 后台页、维护页、封禁页不触发本拦截
     - 接口异常/服务未起：不误拦截 */
  function guardMaintenance() {
    const isAdmin = !!sessionStorage.getItem('xj_admin_token');
    if (isAdmin) return false;
    fetch('/api/site')
      .then(r => r.ok ? r.json() : null)
      .then(j => {
        if (j && j.ok && j.site && j.site.maintenance) {
          location.replace('maintenance.html');
        }
      })
      .catch(() => { /* 离线/服务未起：保留本地状态，不误拦截 */ });
    return false;
  }

  /* ---------- 封禁拦截（会员页调用） ----------
     封禁状态不可查看商店，只能切换账户。
     - 先按本地 xj_user.banned 同步拦截（无闪烁）
     - 再向 /api/account/me 拉取权威状态纠偏（管理员后台封禁后即时生效）
     返回 true 表示已跳转封禁页 */
  function guardBanned() {
    const u = user();
    if (!u || !u.uid) return false;

    // 同步拦截：本地已知封禁
    if (u.banned) { location.replace('banned.html'); return true; }

    // 异步纠偏：本地未标封禁，但服务端可能已封禁
    fetch('/api/account/me?uid=' + encodeURIComponent(u.uid))
      .then(r => r.ok ? r.json() : null)
      .then(j => {
        if (!j || !j.ok || !j.account) return;
        const a = j.account;
        if (a.banned) { location.replace('banned.html'); return; }
        // 刷新本地会话中的权威字段，避免陈旧
        const cur = user();
        if (cur && cur.uid === a.id) {
          localStorage.setItem('xj_user', JSON.stringify({
            uid: a.id, name: a.name, mail: a.mail, level: a.level,
            point: a.point, banned: !!a.banned, type: 'member',
          }));
        }
      })
      .catch(() => { /* 离线/服务未起：保留本地状态，不误拦截 */ });
    return false;
  }

  window.XJ = { init, toast, cart, applyTheme, applyStyle, setStyle: applyStyle, styleMode: function () { return styleMode; }, applyGlass: applyStyle, setGlass: applyStyle, glassOn: function () { return styleMode === 'glass'; }, applyMobile, setMobile: applyMobile, mobileOn: function () { return mobileLayoutActive(); }, isNarrowScreen, icon: ICON, user, levelInfo, LEVELS, guardBanned, guardMaintenance, tr, loc, setLang, currentLang: getLang, LANGS, applyLang, retranslate: translateStatic };
})();
