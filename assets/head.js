/* ============================================================
   XJ Store · 首屏预置脚本（放在 <head> 内，阻塞加载）
   作用：在样式生效前就把主题与「手机端布局」标记写好，
        避免真机首屏先渲染成桌面排版再跳变（FOUC）。
   - data-theme：白天 / 黑夜
   - mobile-layout：手机端排版层（真实窄屏自动生效，桌面端可手动预览）
   - mobile-mode：仅桌面预览时的「手机机身」外观（430px 居中 + 圆角）
   ============================================================ */
(function () {
  var html = document.documentElement;
  try {
    var t = localStorage.getItem('xj_theme');
    if (!t) t = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    html.setAttribute('data-theme', t);
  } catch (e) {}
  try {
    var on = localStorage.getItem('xj_mobile') === 'on';
    var narrow = window.matchMedia('(max-width: 900px)').matches;
    /* 窄屏（真实手机）一律走手机端排版；桌面端则按用户上次的选择 */
    if (on || narrow) html.classList.add('mobile-layout');
    /* 机身外观只在「桌面端预览手机」时出现，真实手机不需要 */
    if (on && !narrow) html.classList.add('mobile-mode');
  } catch (e) {}
})();
