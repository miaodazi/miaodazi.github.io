/* 喵搭子 · 页面逻辑（B 手账大头贴）。只用 Chrome 61 认识的语法，不用 innerHTML。 */
(function () {
  'use strict';

  var D = window.MiaoData, C = window.MiaoCore, P = window.MiaoPlatform, Poster = window.MiaoPoster;
  var OWN_KEY = 'miao.own', NICK_KEY = 'miao.nick', JUST_KEY = 'miao.just';
  var catBy = {};
  D.cats.forEach(function (c) { catBy[c.key] = c; });
  var COMP_COLORS = ['#F2C14E', '#1F1B1B', '#C9A27A'];

  var S = {
    nick: '',
    own: null,       // 这台手机上自己最近一次的结果（单人串解出来的对象）
    inviter: null,   // 从邀请链接进来时，邀请人的结果
    answers: [],
    idx: 0,
    locked: false,
    soloView: null,  // 当前单人页展示的是谁
    duoView: null,   // 当前双人页 { a, b, res, theme }
    duoRole: 'guest',
    posters: {}
  };

  /* ---------- 小工具函数 ---------- */
  function $(id) { return document.getElementById(id); }
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function add(parent) {
    for (var i = 1; i < arguments.length; i++) parent.appendChild(arguments[i]);
    return parent;
  }
  function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }
  function show(id) {
    ['cover', 'quiz', 'solo', 'duo'].forEach(function (s) { $(s).classList.toggle('on', s === id); });
    window.scrollTo(0, 0);
  }
  var toastTimer = null;
  function toast(msg) {
    var t = $('toast');
    t.textContent = msg;
    t.classList.remove('hidden');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.add('hidden'); }, 2800);
  }
  function silhouette(color, cls) {
    var s = el('span', 'sil' + (cls ? ' ' + cls : ''));
    s.style.color = color;
    add(s, el('b', 'l'), el('b', 'r'), el('i'));
    return s;
  }
  function catImg(cat, cls) {
    var img = el('img', cls || '');
    img.alt = cat.name;
    img.onerror = function () { if (img.parentNode) img.parentNode.replaceChild(silhouette(cat.color, cls), img); };
    img.src = 'assets/cats/' + cat.key + '.webp';
    return img;
  }
  function stickerImg(name) {
    var img = el('img');
    img.alt = '';
    img.onerror = function () { img.style.visibility = 'hidden'; };
    img.src = 'assets/stickers/' + name + '.webp';
    return img;
  }
  function today() {
    var d = new Date();
    return d.getFullYear() + '.' + String(d.getMonth() + 1).padStart(2, '0') + '.' + String(d.getDate()).padStart(2, '0');
  }

  /* ---------- 封面 ---------- */
  function renderCoverCats() {
    var box = $('coverCats');
    clear(box);
    D.cats.forEach(function (c) { box.appendChild(catImg(c)); });
    $('quizPeek').src = 'assets/cats/orange.webp';
  }
  function enterCover() {
    $('nickInput').value = S.nick;
    var reuse = !!(S.inviter && S.own);
    if (S.inviter) {
      $('coverLine1').textContent = (S.inviter.nick || '你的搭子') + '已经测出了';
      $('coverLine2').textContent = 'ta 的猫猫';
      $('coverSub').textContent = '测完看看你们是哪对猫猫搭子';
    } else {
      $('coverLine1').textContent = '测测我们是';
      $('coverLine2').textContent = '哪对猫猫搭子';
      $('coverSub').textContent = '1 分钟测出你是哪只猫，再叫上你的搭子';
    }
    $('reuseBtn').classList.toggle('hidden', !reuse);
    $('startBtn').className = reuse ? 'btn ghost' : 'btn primary';
    $('startBtn').textContent = reuse ? '重新测一次' : '开始测试';
    $('lastBtn').classList.toggle('hidden', !S.own || !!S.inviter);
    show('cover');
  }

  /* ---------- 答题 ---------- */
  function shuffled(n) {
    var a = [];
    for (var i = 0; i < n; i++) a.push(i);
    for (var j = n - 1; j > 0; j--) {
      var k = Math.floor(Math.random() * (j + 1));
      var t = a[j]; a[j] = a[k]; a[k] = t;
    }
    return a;
  }
  function startQuiz() {
    S.nick = C.sanitizeNick($('nickInput').value);
    P.store.set(NICK_KEY, S.nick);
    S.answers = [];
    S.idx = 0;
    renderQ();
    show('quiz');
  }
  function renderQ() {
    var q = D.questions[S.idx];
    S.locked = false;
    $('progText').textContent = (S.idx + 1) + ' / ' + D.questions.length;
    $('barFill').style.width = ((S.idx + 1) / D.questions.length * 100) + '%';
    $('backBtn').style.visibility = S.idx === 0 ? 'hidden' : 'visible';
    $('qTitle').textContent = q.title;
    var box = $('opts');
    clear(box);
    shuffled(q.options.length).forEach(function (oi) {
      var b = el('button', 'opt shadow-soft');
      b.type = 'button';
      add(b, add(el('span', 'paper torn'), el('i', 'dot'), el('span', 'txt', q.options[oi].text)));
      if (S.answers[S.idx] === oi) b.classList.add('pick');
      b.addEventListener('click', function () { pick(oi, b); });
      box.appendChild(b);
    });
  }
  function pick(oi, btn) {
    if (S.locked) return;
    S.locked = true;
    btn.classList.add('pick');
    S.answers[S.idx] = oi;
    setTimeout(function () {
      if (S.idx < D.questions.length - 1) { S.idx++; renderQ(); } else { finishQuiz(); }
    }, 260);
  }
  function finishQuiz() {
    var me = { v: D.version, rel: 0, nick: S.nick, answers: S.answers.slice(0, D.questions.length) };
    S.own = me;
    P.store.set(OWN_KEY, C.encodeSingle(me));
    try { sessionStorage.setItem(JUST_KEY, '1'); } catch (e) {}
    P.track('done');
    P.track('cat_' + C.computeSolo(D, me.answers).cat);
    if (S.inviter) { P.track('duo_done'); showDuo(S.inviter, me); }
    else { showSolo(me); }
  }

  /* ---------- 单人结果 ---------- */
  function inviteTitle(me) {
    var cat = catBy[C.computeSolo(D, me.answers).cat];
    return '我是' + cat.name + '·' + cat.nick + '，测测我们是哪对猫猫搭子';
  }
  function invitePayload(me, rel) {
    return C.encodeSingle({ v: me.v, rel: rel, nick: me.nick, answers: me.answers });
  }
  function showSolo(me, note) {
    var r = C.computeSolo(D, me.answers);
    var cat = catBy[r.cat];
    S.soloView = me;
    S.posters = {};

    var hero = $('soloHero');
    clear(hero);
    hero.appendChild(el('h1', 'h1 center', (me.nick ? me.nick + '的' : '你的') + '猫猫是'));
    var pol = el('div', 'polaroid');
    add(pol, el('i', 'tape kraft tl'), el('i', 'tape mustard tr'), add(el('div', 'photo'), catImg(cat)), el('p', 'cap', cat.name + ' · ' + cat.nick));
    hero.appendChild(pol);
    var tags = el('div', 'tags');
    cat.kw.forEach(function (k) { tags.appendChild(el('span', '', k)); });
    hero.appendChild(tags);
    hero.appendChild(add(el('div', 'note shadow-soft'), el('span', 'paper torn', cat.joke)));

    var body = $('soloBody');
    clear(body);
    add(body, el('i', 'tape mustard top'), el('p', 'desc', cat.desc), el('p', 'sec', '猫猫成分表'));
    r.composition.forEach(function (c, i) {
      var cc = catBy[c.cat];
      var fill = el('i', 'fill');
      fill.style.width = c.pct + '%';
      fill.style.background = COMP_COLORS[i];
      body.appendChild(add(el('div', 'comp-row'), catImg(cc), el('span', 'n', cc.name), add(el('span', 'track'), fill), el('span', 'p', c.pct + '%')));
    });
    var best = catBy[cat.best];
    var bestDuo = D.duos[C.pairKey(D, cat.key, best.key)];
    body.appendChild(el('p', 'sec', '最配的搭子猫'));
    var bestP = el('p', 'best');
    add(bestP, el('b', '', best.name + '·' + best.nick + '「' + bestDuo.name + '」'), document.createTextNode(' ' + bestDuo.line));
    body.appendChild(bestP);

    P.setShareState({ type: 'invite', payload: invitePayload(me, me.rel || 0), title: inviteTitle(me) });
    show('solo');
    refreshFollow('soloFollow');
    if (note) toast(note);
    setTimeout(soloPoster, 50);
  }

  /* ---------- 双人结果 ---------- */
  function applyTheme(node, th) {
    node.style.setProperty('--rel', th.tint);
    node.style.setProperty('--rel-ink', th.ink);
    node.style.setProperty('--rel-soft', th.soft);
  }
  function showDuo(a, b) {
    var res = C.computeDuo(D, a, b);
    var ca = catBy[res.a.cat], cb = catBy[res.b.cat];
    var rel = D.relations[a.rel] || D.relations[0];
    var th = D.relationThemes[a.rel] || D.relationThemes[0];
    S.duoView = { a: a, b: b, res: res, theme: th };
    S.posters = {};
    S.duoRole = S.own && C.sameSingle(S.own, b) ? 'b' : (S.own && C.sameSingle(S.own, a) ? 'a' : 'guest');
    applyTheme($('duo'), th);

    var hero = $('duoHero');
    clear(hero);
    hero.appendChild(el('h1', 'h1 duo-title', res.duo.name));
    hero.appendChild(add(el('p', 'duo-names'), el('span', 'hl', (a.nick || 'ta') + ' × ' + (b.nick || 'ta'))));
    var stage = el('div', 'duo-stage');
    var strip = el('div', 'strip');
    var photo = el('img', 'photo');
    photo.alt = ca.name + '和' + cb.name;
    photo.onerror = function () {
      var fb = add(el('div', 'strip-fb'), catImg(ca), catImg(cb));
      if (photo.parentNode) photo.parentNode.replaceChild(fb, photo);
    };
    photo.src = 'assets/duo/' + res.key.replace('+', '_') + '.webp';
    add(strip, el('i', 'tape top'), photo, el('i', 'tint'), el('i', 'tape bl'));
    var sticker = add(el('div', 'rel-sticker'), stickerImg(th.sticker), el('span', '', rel));
    var badge = add(el('div', 'badge'), el('span', 'k', rel + '默契度'), el('span', 'v', res.score + '%'), el('span', 'f', D.frames[res.frame].name));
    add(stage, strip, sticker, badge);
    hero.appendChild(stage);
    hero.appendChild(el('p', 'date', today() + ' · 喵搭子'));
    hero.appendChild(add(el('p', 'duo-line'), el('span', 'hl', res.duo.line)));

    var body = $('duoBody');
    clear(body);
    add(body, el('i', 'tape rel top'), el('p', 'sec', '你们选得一样的题'));
    if (res.same.length) {
      var ul = el('ul', 'same');
      res.same.forEach(function (s) {
        ul.appendChild(add(el('li'), el('em', '', s.title), document.createTextNode('都选了：' + s.text)));
      });
      body.appendChild(ul);
    } else {
      body.appendChild(el('p', 'desc', D.noSameLine));
    }
    body.appendChild(el('p', 'desc', D.frames[res.frame].line));
    body.appendChild(el('p', 'sec', '相处说明书'));
    var tl = el('ul', 'tips');
    res.duo.tips.forEach(function (t, i) { tl.appendChild(add(el('li'), el('em', '', D.tipLabels[i]), document.createTextNode(t))); });
    body.appendChild(tl);

    var send = $('sendBackBtn'), nextBtn = $('duoNextBtn');
    send.classList.toggle('hidden', S.duoRole === 'a');
    send.textContent = S.duoRole === 'guest' ? '我也来测测' : '把结果发回给 ta';
    nextBtn.classList.toggle('hidden', S.duoRole === 'guest');
    nextBtn.textContent = S.duoRole === 'a' ? '再邀请一个搭子' : '我也去邀请别人';

    P.setShareState({ type: 'duo', payload: C.encodeDuo(a, b), title: '我们是「' + res.duo.name + '」！' + rel + '默契度 ' + res.score + '%' });
    show('duo');
    refreshFollow('duoFollow');
    setTimeout(duoPoster, 50);
  }

  /* ---------- 海报（先画好缓存，点分享时直接用，保证是「用户点击直接触发」） ---------- */
  function soloPoster() {
    if (S.posters.solo) return Promise.resolve(S.posters.solo);
    var me = S.soloView, r = C.computeSolo(D, me.answers);
    return Poster.renderSolo($('posterCanvas'), {
      cat: catBy[r.cat],
      nick: me.nick,
      comp: r.composition.map(function (c) { return { cat: catBy[c.cat], pct: c.pct }; }),
      qr: P.posterQr ? P.posterQr('invite', invitePayload(me, 0)) : null
    }).then(function (url) { S.posters.solo = url; return url; });
  }
  function duoPoster() {
    if (S.posters.duo) return Promise.resolve(S.posters.duo);
    var v = S.duoView;
    return Poster.renderDuo($('posterCanvas'), {
      rel: D.relations[v.a.rel] || D.relations[0],
      theme: v.theme,
      catA: catBy[v.res.a.cat],
      catB: catBy[v.res.b.cat],
      nickA: v.a.nick || 'ta',
      nickB: v.b.nick || 'ta',
      duo: v.res.duo,
      score: v.res.score,
      frameName: D.frames[v.res.frame].name,
      pair: v.res.key.replace('+', '_'),
      qr: P.posterQr ? (S.own ? P.posterQr('invite', invitePayload(S.own, 0)) : P.posterQr()) : null
    }).then(function (url) { S.posters.duo = url; return url; });
  }
  function openPoster(getter) {
    getter().then(function (url) {
      $('posterImg').src = url;
      $('posterTip').textContent = '长按图片保存';
      $('posterSave').classList.toggle('hidden', P.kind !== 'xhs');
      $('posterBox').classList.remove('hidden');
    }).catch(function () { toast('海报没画出来，直接截图保存也行'); });
  }

  /* ---------- 分享 ---------- */
  function shareResult(r) {
    if (r === 'shared' || r === 'cancel' || r === 'comment' || r === 'guided') return;
    if (r === 'copied') toast('链接已复制，发给 ta 吧');
    else if (r === 'unsupported' || r === 'failed') toast('先保存海报发给 ta 吧');
    else toast('点右上角 ··· 发送给朋友');
  }
  function invite(rel) {
    var me = S.soloView;
    var payload = invitePayload(me, rel);
    P.setShareState({ type: 'invite', payload: payload, title: inviteTitle(me), guide: true });
    soloPoster().catch(function () { return ''; }).then(function (url) {
      return P.share({ type: 'invite', payload: payload, title: inviteTitle(me), text: '我测出了我的猫，你也来测测，看看我们是哪对猫猫搭子', dataUrl: url });
    }).then(shareResult);
  }

  /* ---------- 关注作者（只有小工具里有） ---------- */
  function refreshFollow(id) {
    var box = $(id);
    box.classList.add('hidden');
    P.canFollow().then(function (ok) { box.classList.toggle('hidden', !ok); });
  }

  /* ---------- 按钮 ---------- */
  $('startBtn').addEventListener('click', startQuiz);
  $('reuseBtn').addEventListener('click', function () { P.track('duo_done'); showDuo(S.inviter, S.own); });
  $('lastBtn').addEventListener('click', function () { showSolo(S.own); });
  $('backBtn').addEventListener('click', function () {
    if (S.idx === 0 || S.locked) return;
    S.idx--;
    renderQ();
  });
  $('retakeBtn').addEventListener('click', function () { S.inviter = null; enterCover(); });
  $('inviteBtn').addEventListener('click', function () {
    var chips = $('relChips');
    clear(chips);
    D.relations.forEach(function (label, i) {
      var th = D.relationThemes[i];
      var b = add(el('button'), stickerImg(th.sticker), el('span', '', label));
      b.type = 'button';
      b.style.borderColor = th.tint;
      b.style.background = th.soft;
      b.addEventListener('click', function () { $('relSheet').classList.add('hidden'); invite(i); });
      chips.appendChild(b);
    });
    $('relSheet').classList.remove('hidden');
  });
  $('relCancel').addEventListener('click', function () { $('relSheet').classList.add('hidden'); });
  $('soloPosterBtn').addEventListener('click', function () { openPoster(soloPoster); });
  $('duoPosterBtn').addEventListener('click', function () { openPoster(duoPoster); });
  $('posterClose').addEventListener('click', function () { $('posterBox').classList.add('hidden'); });
  $('posterSave').addEventListener('click', function () {
    P.saveImage($('posterImg').src).then(function (r) {
      $('posterTip').textContent = r === 'saved' ? '已存到相册' : '长按图片保存';
    });
  });
  $('sendBackBtn').addEventListener('click', function () {
    if (S.duoRole === 'guest') { S.inviter = null; enterCover(); return; }
    var v = S.duoView;
    duoPoster().catch(function () { return ''; }).then(function (url) {
      return P.share({ type: 'duo', payload: C.encodeDuo(v.a, v.b), title: document.title, text: '我们测出来是「' + v.res.duo.name + '」，点开看看我们的大头贴', dataUrl: url });
    }).then(shareResult);
  });
  $('duoNextBtn').addEventListener('click', function () { S.inviter = null; showSolo(S.own); });
  Array.prototype.forEach.call(document.querySelectorAll('[data-follow]'), function (b) {
    b.addEventListener('click', function () {
      P.follow().then(function (s) {
        if (s === 1) {
          toast('关注好啦，下期见');
          $('soloFollow').classList.add('hidden');
          $('duoFollow').classList.add('hidden');
        }
      });
    });
  });

  /* ---------- 启动：看链接里带的是邀请、双人结果，还是什么都没有 ---------- */
  function boot() {
    renderCoverCats();
    var just = false;
    try { just = sessionStorage.getItem(JUST_KEY) === '1'; sessionStorage.removeItem(JUST_KEY); } catch (e) {}
    Promise.all([P.store.get(NICK_KEY), P.store.get(OWN_KEY), P.readLaunch()]).then(function (r) {
      S.nick = C.sanitizeNick(r[0] || '');
      S.own = r[1] ? C.decodeSingle(D, r[1]) : null;
      var launch = r[2];
      if (launch && launch.type === 'duo') {
        var pair = C.decodeDuo(D, launch.payload);
        if (pair) { if (!just) P.track('duo_open'); showDuo(pair.a, pair.b); return; }  // 刚测完跳转回来的不算「回传打开」
      }
      if (launch && launch.type === 'invite') {
        var inv = C.decodeSingle(D, launch.payload);
        if (inv && S.own && C.sameSingle(S.own, inv)) {
          showSolo(inv, just ? null : '这是你自己的邀请链接，发给搭子吧');  // 用链接里的关系，别改回默认（网页版有时会真跳转，改回去就又跳一次）
          return;
        }
        if (inv) { S.inviter = inv; P.track('invite_open'); }
      }
      enterCover();
    }, function () { enterCover(); });
  }

  /* 网页版平台层给了 tipBox 才放（小工具版没有） */
  if (P.tipBox) ['soloTip', 'duoTip'].forEach(function (id) { $(id).appendChild(P.tipBox()); });

  boot();
})();
