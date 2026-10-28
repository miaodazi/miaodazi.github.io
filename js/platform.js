/* 喵搭子 · 网页版平台层（打包时改名为 js/platform.js；小工具版用 platform-xhs.js）
 * 管：读链接里的邀请、改网址和标题、分享 / 复制、存图、本地存储、计数。 */
(function () {
  'use strict';

  /* apizero 的计数只认名字（site 参数不起作用，2026-10-28 实测），名字全网共用，所以必须带自己的前缀。
   * 改前缀要同步改 tools/read_counters.py。 */
  var PREFIX = 'miaodazi_v1_';
  var COUNTER = 'https://v1.apizero.cn/api/visits-counter?site=miaodazi&mode=total&name=';
  /* 微信里只能点右上角「···」分享当前网页：系统分享面板在微信里选「微信」会没反应（10-28 iPhone 实测）。
   * iOS 微信还可能分享第一次打开的网址，所以在微信里出结果、选关系时真跳转一次到带 ?a= / ?d= 的新网址，让它成为「当前页面」。 */
  var IN_WECHAT = /MicroMessenger/i.test(navigator.userAgent);
  var USE_QUERY_NAV = IN_WECHAT;
  var GUIDE_KEY = 'miao.guide';

  /* ---------- 计数：接口限每秒 2 次，排队、间隔 650ms ---------- */
  var queue = [], busy = false;
  function next() {
    var name = queue.shift();
    if (!name) { busy = false; return; }
    busy = true;
    try {
      fetch(COUNTER + encodeURIComponent(PREFIX + name), { mode: 'no-cors', cache: 'no-store', keepalive: true }).catch(function () {});
    } catch (e) {}
    setTimeout(next, 650);
  }
  function track(name) {
    queue.push(name);
    if (!busy) next();
  }
  function afterTracking(fn) {
    var start = Date.now();
    (function wait() {
      if ((!busy && !queue.length) || Date.now() - start > 3000) fn();
      else setTimeout(wait, 150);
    })();
  }

  /* ---------- 链接 ---------- */
  function parse(str) {
    var m = String(str || '').match(/[#?&]([ad])=([^&#]+)/);
    if (!m) return null;
    try { return { type: m[1] === 'a' ? 'invite' : 'duo', payload: decodeURIComponent(m[2]) }; } catch (e) { return null; }
  }
  function readLaunch() {
    return Promise.resolve(parse(location.hash) || parse(location.search));
  }
  function shareUrl(type, payload) {
    return location.origin + location.pathname + (USE_QUERY_NAV ? '?' : '#') + (type === 'invite' ? 'a' : 'd') + '=' + payload;
  }
  /* state = { type: 'invite' | 'duo', payload, title, guide }；guide：微信里要接着引导用户点右上角分享 */
  function setShareState(state) {
    if (state.title) document.title = state.title;
    var url = shareUrl(state.type, state.payload);
    if (USE_QUERY_NAV) {
      var now = parse(location.search);
      if (!now || now.payload !== state.payload) {
        if (state.guide) { try { sessionStorage.setItem(GUIDE_KEY, '1'); } catch (e) {} }  // 跳转后再弹引导
        afterTracking(function () { location.replace(url); });
      } else if (state.guide) {
        showGuide();
      }
      return;
    }
    try { history.replaceState(null, '', url); } catch (e) { location.hash = url.split('#')[1]; }
  }

  /* ---------- 分享：系统分享 → 复制链接 → 提示点右上角 ---------- */
  function copy(text) {
    return new Promise(function (resolve) {
      function legacy() {
        var ta = document.createElement('textarea');
        ta.value = text;
        ta.setAttribute('readonly', '');
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        var ok = false;
        try { ok = document.execCommand('copy'); } catch (e) {}
        document.body.removeChild(ta);
        resolve(ok ? 'copied' : 'hint');
      }
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(function () { resolve('copied'); }, legacy);
      } else {
        legacy();
      }
    });
  }
  /* opts = { type, payload, title, text, dataUrl }；返回 'guided' | 'shared' | 'cancel' | 'copied' | 'hint' */
  function share(opts) {
    if (IN_WECHAT) { showGuide(); return Promise.resolve('guided'); }
    var url = shareUrl(opts.type, opts.payload);
    if (navigator.share) {
      return navigator.share({ title: opts.title, text: opts.text, url: url }).then(function () { return 'shared'; }, function (err) {
        if (err && err.name === 'AbortError') return 'cancel';
        return copy(opts.text + ' ' + url);
      });
    }
    return copy(opts.text + ' ' + url);
  }

  /* ---------- 微信：盖一层引导，箭头指向右上角「···」 ---------- */
  var guide = null;
  function showGuide() {
    if (!guide) {
      guide = document.createElement('div');
      guide.className = 'share-guide';
      [['arrow', '↗'], ['t1', '点右上角 ···'], ['t2', '选「发送给朋友」，发给你的搭子'], ['t3', '点任意处关闭']].forEach(function (p) {
        var d = document.createElement('div');
        d.className = p[0];
        d.textContent = p[1];
        guide.appendChild(d);
      });
      guide.addEventListener('click', function () { guide.classList.add('hidden'); });
      document.body.appendChild(guide);
    }
    guide.classList.remove('hidden');
  }
  try {
    if (sessionStorage.getItem(GUIDE_KEY) === '1') { sessionStorage.removeItem(GUIDE_KEY); showGuide(); }
  } catch (e) {}

  /* ---------- 海报二维码（只有网页版有：js/qrcode.js 只打进网页版，小工具里不能放外部链接） ---------- */
  function posterQr(type, payload) {
    if (typeof qrcode !== 'function') return null;
    var base = location.origin + location.pathname;
    var q = qrcode(0, 'M');
    q.addData(type ? base + '?' + (type === 'invite' ? 'a' : 'd') + '=' + payload : base);
    q.make();
    return {
      size: q.getModuleCount(),
      dark: function (r, c) { return q.isDark(r, c); },
      caption: type ? '扫码和我配对' : '扫码也来测测'
    };
  }

  /* ---------- 赞赏码（只有网页版有） ---------- */
  var TIP_IMG = null;  // 赞赏码图放进 src/web/assets/ 后改成 'assets/zanshang.webp'
  function tipBox() {
    var box = document.createElement('div');
    box.className = 'tip';
    [['t1', '觉得好玩，请作者喝杯奶茶'], ['img', ''], ['t2', '长按识别 · 随缘就好']].forEach(function (p) {
      var d = document.createElement(p[0] === 'img' ? 'img' : 'div');
      if (p[0] === 'img') { d.src = TIP_IMG; d.alt = '赞赏码'; } else { d.className = p[0]; d.textContent = p[1]; }
      box.appendChild(d);
    });
    return box;
  }

  function saveImage() { return Promise.resolve('longpress'); }

  var store = {
    get: function (k) {
      try { var v = localStorage.getItem(k); return Promise.resolve(v == null ? null : JSON.parse(v)); }
      catch (e) { return Promise.resolve(null); }
    },
    set: function (k, v) {
      try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {}
      return Promise.resolve();
    }
  };

  window.MiaoPlatform = {
    kind: 'web',
    readLaunch: readLaunch,
    setShareState: setShareState,
    share: share,
    saveImage: saveImage,
    store: store,
    canFollow: function () { return Promise.resolve(false); },
    follow: function () { return Promise.resolve(-1); },
    track: track,
    posterQr: posterQr,
    tipBox: TIP_IMG ? tipBox : null
  };
})();
