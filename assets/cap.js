/* XJ Store · Cap 人机验证前端封装（trycap.dev / cap-widget）
 * 用法：
 *   const cap = await CapGuard.mount(el, token => { ... });
 *   // 提交时： if (cap.enabled && !cap.token()) { 提示完成验证; return; }
 *   // 请求体里带上 capToken: cap.token()
 *   // 提交失败后需要重新验证时： cap.rerender();
 * 仅在服务端 capEnabled 时挂载组件；未启用则完全无感（不影响原流程）。
 */
(function () {
  'use strict';
  var SCRIPT_SRC = 'https://cdn.jsdelivr.net/npm/cap-widget@latest';

  var Lib = {
    _cfg: null,
    _scriptLoading: null,

    loadScript: function () {
      if (window.customElements && window.customElements.get && window.customElements.get('cap-widget')) {
        return Promise.resolve(true);
      }
      if (this._scriptLoading) return this._scriptLoading;
      this._scriptLoading = new Promise(function (resolve) {
        var s = document.createElement('script');
        s.src = SCRIPT_SRC;
        s.async = true;
        s.onload = function () { resolve(true); };
        s.onerror = function () { resolve(false); };
        document.head.appendChild(s);
      });
      return this._scriptLoading;
    },

    config: function () {
      var self = this;
      if (this._cfg) return Promise.resolve(this._cfg);
      return fetch('/api/cap/config', { headers: { Accept: 'application/json' } })
        .then(function (r) { return r.json(); })
        .then(function (j) { self._cfg = j || { enabled: false }; return self._cfg; })
        .catch(function () { self._cfg = { enabled: false }; return self._cfg; });
    },

    /* 在 el 内渲染 Cap 验证组件（仅 enabled 时）；onSolve(token) 解出时回调。
       返回 { enabled, token(), rerender(), failed } */
    mount: function (el, onSolve) {
      var self = this;
      var ctrl = {
        enabled: false, token: function () { return ''; }, rerender: function () {},
        failed: false, _state: { t: '' }, _el: el, _onSolve: onSolve,
      };
      return this.config().then(function (cfg) {
        if (!cfg || !cfg.enabled) {
          if (el) el.style.display = 'none';
          return ctrl;
        }
        return self.loadScript().then(function (ok) {
          if (!ok) {
            ctrl.enabled = true; ctrl.failed = true;
            if (el) el.innerHTML = '<div style="font-size:13px;color:#e0533d;padding:8px 0">人机验证组件加载失败，请刷新页面重试</div>';
            return ctrl;
          }
          var endpoint = String(cfg.instance || '').replace(/\/+$/, '') + '/' + String(cfg.siteKey || '') + '/';
          var render = function () {
            ctrl._state.t = '';
            if (!el) return;
            el.style.display = '';
            el.innerHTML = '';
            var w = document.createElement('cap-widget');
            w.setAttribute('data-cap-api-endpoint', endpoint);
            el.appendChild(w);
            w.addEventListener('solve', function (e) {
              ctrl._state.t = (e && e.detail && e.detail.token) || '';
              if (ctrl._onSolve) ctrl._onSolve(ctrl._state.t);
            });
          };
          ctrl.rerender = render;
          ctrl.token = function () { return ctrl._state.t; };
          ctrl.enabled = true;
          render();
          return ctrl;
        });
      });
    },
  };

  window.CapGuard = Lib;
})();
