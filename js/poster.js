/* 喵搭子 · 海报（1080×1440，小红书 3:4，B 手账大头贴风）。
 * 图里只有猫，名字、分数、关系这些字都在这里画；图片没加载出来就画剪影，不卡流程。 */
(function (root) {
  'use strict';

  var W = 1080, H = 1440;
  var BODY = '-apple-system, "PingFang SC", "Hiragino Sans GB", sans-serif';
  var TITLE = 'MiaoTitle, ' + BODY;
  var C = { ink: '#1F1B1B', sub: '#6E625A', mute: '#A69887', cream: '#FBF6EC', paper: '#FFFDF7', kraft: '#C9A27A', kraftSoft: '#EFE3D2', mustard: '#F2C14E', mustardSoft: '#FBE7A9' };
  var FOOT = '娱乐测试 · 小红书搜「喵搭子」一起测';

  function load(src) {
    return new Promise(function (resolve) {
      var img = new Image();
      img.onload = function () { resolve(img); };
      img.onerror = function () { resolve(null); };
      img.src = src;
    });
  }

  /* 标题字体要先加载，不然 canvas 会用系统字体画 */
  function fontReady() {
    if (!document.fonts || !document.fonts.load) return Promise.resolve();
    return document.fonts.load('40px MiaoTitle').then(function () {}, function () {});
  }

  function rr(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  /* 要拆成两行时：优先在中间附近的逗号后断开，没有合适的就按宽度平分（免得第二行只剩一两个字）；标点不放行首 */
  function splitTwo(ctx, text, maxW) {
    var chars = Array.from(text), half = ctx.measureText(text).width / 2, best = null;
    for (var i = 1; i < chars.length; i++) {
      if (/[，。！？、；：」）…]/.test(chars[i])) continue;
      var a = chars.slice(0, i).join(''), b = chars.slice(i).join(''), wa = ctx.measureText(a).width;
      if (wa > maxW || ctx.measureText(b).width > maxW) continue;
      var score = Math.abs(wa - half) - (/[，、；：]/.test(chars[i - 1]) ? half : 0);
      if (!best || score < best.score) best = { score: score, a: a, b: b };
    }
    return best;
  }

  /* 按字换行，超过 maxLines 行在最后一行末尾加省略号；正好两行时改用 splitTwo 断得更匀 */
  function wrap(ctx, text, x, y, maxW, lh, maxLines) {
    var w = ctx.measureText(text).width;
    if (maxLines >= 2 && w > maxW && w <= maxW * 2) {
      var two = splitTwo(ctx, text, maxW);
      if (two) {
        ctx.fillText(two.a, x, y);
        ctx.fillText(two.b, x, y + lh);
        return y + lh * 2;
      }
    }
    var chars = Array.from(text), line = '', lines = 0;
    for (var i = 0; i < chars.length; i++) {
      var test = line + chars[i];
      if (ctx.measureText(test).width > maxW && line) {
        lines++;
        if (lines >= maxLines) {
          ctx.fillText(Array.from(line).slice(0, -1).join('') + '…', x, y);
          return y + lh;
        }
        ctx.fillText(line, x, y);
        y += lh;
        line = chars[i];
      } else {
        line = test;
      }
    }
    if (line) { ctx.fillText(line, x, y); y += lh; }
    return y;
  }

  function grid(ctx) {
    ctx.fillStyle = C.cream;
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(201, 162, 122, 0.18)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (var x = 0; x <= W; x += 44) { ctx.moveTo(x, 0); ctx.lineTo(x, H); }
    for (var y = 0; y <= H; y += 44) { ctx.moveTo(0, y); ctx.lineTo(W, y); }
    ctx.stroke();
  }

  /* 纸胶带：中心 (cx, cy)，旋转 deg 度 */
  function tape(ctx, cx, cy, w, h, deg, color) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(deg * Math.PI / 180);
    ctx.globalAlpha = 0.92;
    ctx.fillStyle = color;
    ctx.fillRect(-w / 2, -h / 2, w, h);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.38)';
    for (var i = -w / 2; i < w / 2; i += 20) ctx.fillRect(i, -h / 2, 10, h);
    for (var j = -h / 2; j < h / 2; j += 20) ctx.fillRect(-w / 2, j, w, 10);
    ctx.restore();
  }

  /* 带芥末黄错位阴影的标题 */
  function title(ctx, text, x, y, size, shadow) {
    ctx.font = size + 'px ' + TITLE;
    ctx.fillStyle = shadow || C.mustard;
    ctx.fillText(text, x + size * 0.08, y + size * 0.08);
    ctx.fillStyle = C.ink;
    ctx.fillText(text, x, y);
  }

  function highlight(ctx, text, cx, y, size, color) {
    ctx.font = size + 'px ' + TITLE;
    var w = ctx.measureText(text).width;
    ctx.fillStyle = color;
    ctx.fillRect(cx - w / 2 - 10, y - size * 0.35, w + 20, size * 0.42);
    ctx.fillStyle = C.ink;
    ctx.fillText(text, cx, y);
  }

  /* 图按比例放进 w×h 的格子、底部居中；没图就画剪影 */
  function drawImg(ctx, img, color, x, y, w, h) {
    if (img) {
      var s = Math.min(w / img.width, h / img.height);
      var dw = img.width * s, dh = img.height * s;
      ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh), dw, dh);
      return;
    }
    var cx = x + w / 2, cy = y + h * 0.62, r = Math.min(w, h) * 0.32;
    ctx.save();
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.85;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
    [-1, 1].forEach(function (d) {
      ctx.beginPath();
      ctx.moveTo(cx + d * r * 0.95, cy - r * 0.35);
      ctx.lineTo(cx + d * r * 0.75, cy - r * 1.25);
      ctx.lineTo(cx + d * r * 0.2, cy - r * 0.9);
      ctx.closePath();
      ctx.fill();
    });
    ctx.restore();
  }

  function labelSticker(ctx, text, cx, cy) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(-3 * Math.PI / 180);
    ctx.font = '40px ' + TITLE;
    var w = ctx.measureText(text).width + 56;
    ctx.fillStyle = C.mustard;
    ctx.fillRect(-w / 2, -32, w, 64);
    ctx.fillStyle = C.ink;
    ctx.textAlign = 'center';
    ctx.fillText(text, 0, 14);
    ctx.restore();
  }

  /* 二维码卡片（只有网页版的海报有，o.qr = { size, dark(r, c), caption }）：放右下角；
   * 有它的时候，下半部分的字挪到左栏（中心 LX、宽 LW），不和卡片打架 */
  var QX = 815, QY = 1095, QS = 200, LX = 400, LW = 700;
  function qrCard(ctx, qr) {
    ctx.save();
    ctx.shadowColor = 'rgba(90, 64, 40, 0.16)';
    ctx.shadowBlur = 20;
    ctx.shadowOffsetY = 6;
    ctx.fillStyle = '#FFFFFF';
    rr(ctx, QX - 24, QY - 24, QS + 48, QS + 88, 18); ctx.fill();
    ctx.restore();
    var cell = Math.floor(QS / qr.size), off = (QS - cell * qr.size) / 2;
    ctx.fillStyle = C.ink;
    for (var r = 0; r < qr.size; r++) {
      for (var c = 0; c < qr.size; c++) {
        if (qr.dark(r, c)) ctx.fillRect(QX + off + c * cell, QY + off + r * cell, cell, cell);
      }
    }
    ctx.textAlign = 'center';
    ctx.font = '30px ' + TITLE;
    ctx.fillText(qr.caption, QX + QS / 2, QY + QS + 44);
  }

  function footer(ctx) {
    ctx.textAlign = 'center';
    ctx.fillStyle = C.mute;
    ctx.font = '400 26px ' + BODY;
    ctx.fillText(FOOT, W / 2, 1400);
  }

  /* o = { cat, nick, comp: [{ cat, pct }] }，cat 是 MiaoData.cats 里的对象 */
  function renderSolo(canvas, o) {
    return Promise.all([fontReady(), load('assets/cats/' + o.cat.key + '.webp')]).then(function (r) {
      var img = r[1], ctx = canvas.getContext('2d');
      grid(ctx);
      ctx.textAlign = 'center';
      labelSticker(ctx, '喵搭子', W / 2, 92);
      title(ctx, (o.nick ? o.nick + '的' : '我的') + '猫猫是', W / 2, 232, 84);
      // 拍立得
      ctx.save();
      ctx.translate(W / 2, 640);
      ctx.rotate(-2 * Math.PI / 180);
      ctx.shadowColor = 'rgba(90, 64, 40, 0.18)';
      ctx.shadowBlur = 30;
      ctx.shadowOffsetY = 10;
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(-330, -340, 660, 720);
      ctx.shadowColor = 'transparent';
      ctx.fillStyle = '#F3EBDD';
      ctx.fillRect(-300, -310, 600, 560);
      drawImg(ctx, img, o.cat.color, -270, -290, 540, 520);
      ctx.font = '52px ' + TITLE;
      ctx.fillStyle = C.ink;
      ctx.fillText(o.cat.name + ' · ' + o.cat.nick, 0, 330);
      ctx.restore();
      tape(ctx, 290, 310, 170, 46, -38, C.kraft);
      tape(ctx, 800, 300, 170, 46, 36, C.mustard);
      // 关键词贴纸
      var cx = o.qr ? LX : W / 2;
      ctx.font = '40px ' + TITLE;
      var widths = o.cat.kw.map(function (k) { return ctx.measureText(k).width + 64; });
      var total = widths.reduce(function (a, b) { return a + b; }, 0) + (widths.length - 1) * 22;
      var x = cx - total / 2;
      o.cat.kw.forEach(function (k, i) {
        ctx.fillStyle = '#FFFFFF';
        rr(ctx, x, 1060, widths[i], 70, 35); ctx.fill();
        ctx.strokeStyle = C.mustard; ctx.lineWidth = 4; ctx.stroke();
        ctx.fillStyle = C.ink;
        ctx.fillText(k, x + widths[i] / 2, 1109);
        x += widths[i] + 22;
      });
      // 自嘲 + 成分表
      ctx.font = '42px ' + TITLE;
      ctx.fillStyle = C.ink;
      wrap(ctx, o.cat.joke, cx, 1215, o.qr ? LW : 900, 56, 2);
      ctx.font = '500 32px ' + BODY;
      ctx.fillStyle = C.sub;
      ctx.fillText(o.comp.map(function (c) { return c.pct + '% ' + c.cat.name; }).join(' · '), cx, 1315);
      if (o.qr) qrCard(ctx, o.qr);
      footer(ctx);
      return canvas.toDataURL('image/png');
    });
  }

  /* o = { rel, theme, catA, catB, nickA, nickB, duo, score, frameName, pair, sticker } */
  function renderDuo(canvas, o) {
    return Promise.all([
      fontReady(),
      load('assets/duo/' + o.pair + '.webp'),
      load('assets/cats/' + o.catA.key + '.webp'),
      load('assets/cats/' + o.catB.key + '.webp'),
      load('assets/stickers/' + o.theme.sticker + '.webp')
    ]).then(function (r) {
      var strip = r[1], ctx = canvas.getContext('2d');
      grid(ctx);
      ctx.textAlign = 'center';
      labelSticker(ctx, '喵搭子 · ' + o.rel, W / 2, 86);
      title(ctx, o.duo.name, W / 2, 236, o.duo.name.length > 6 ? 86 : 104);
      highlight(ctx, o.nickA + ' × ' + o.nickB, W / 2, 322, 50, C.mustardSoft);
      // 大头贴（带关系色滤镜）
      var sw = 560, sh = strip ? sw * strip.height / strip.width : 760;
      if (sh > 840) { sw = sw * 840 / sh; sh = 840; }  // 留出一句话和落款的位置
      ctx.save();
      ctx.translate(120 + sw / 2, 380 + sh / 2);
      ctx.rotate(-3 * Math.PI / 180);
      if (strip) {
        ctx.shadowColor = 'rgba(90, 64, 40, 0.22)';
        ctx.shadowBlur = 26;
        ctx.shadowOffsetY = 12;
        ctx.drawImage(strip, -sw / 2, -sh / 2, sw, sh);
        ctx.shadowColor = 'transparent';
        ctx.globalCompositeOperation = 'multiply';
        ctx.globalAlpha = 0.14;
        ctx.fillStyle = o.theme.tint;
        ctx.fillRect(-sw / 2, -sh / 2, sw, sh);
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = 1;
      } else {
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(-sw / 2, -sh / 2, sw, sh);
        drawImg(ctx, r[2], o.catA.color, -sw / 2 + 20, -120, sw / 2 - 30, 300);
        drawImg(ctx, r[3], o.catB.color, 10, -120, sw / 2 - 30, 300);
      }
      ctx.restore();
      tape(ctx, 120 + sw / 2, 380, 180, 48, -4, o.theme.tint);
      tape(ctx, 140, 380 + sh - 20, 150, 44, 34, o.theme.tint);
      // 默契度徽章
      var bx = 860, by = 560, br = 150;
      ctx.save();
      ctx.shadowColor = 'rgba(90, 64, 40, 0.2)';
      ctx.shadowBlur = 24;
      ctx.shadowOffsetY = 8;
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath(); ctx.arc(bx, by, br, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      ctx.save();
      ctx.setLineDash([12, 10]);
      ctx.strokeStyle = o.theme.tint; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(bx, by, br - 16, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
      ctx.fillStyle = C.ink;
      ctx.font = '700 30px ' + BODY;
      ctx.fillText(o.rel + '默契度', bx, by - 52);
      ctx.fillStyle = o.theme.ink;
      ctx.font = '96px ' + TITLE;
      ctx.fillText(o.score + '%', bx, by + 40);
      ctx.font = '700 28px ' + BODY;
      var fw = ctx.measureText(o.frameName).width + 36;
      ctx.fillStyle = o.theme.soft;
      rr(ctx, bx - fw / 2, by + 62, fw, 46, 23); ctx.fill();
      ctx.fillStyle = o.theme.ink;
      ctx.fillText(o.frameName, bx, by + 95);
      // 关系贴纸
      drawImg(ctx, r[4], o.theme.tint, 790, 790, 150, 150);
      ctx.font = '40px ' + TITLE;
      var lw = ctx.measureText(o.rel).width + 40;
      ctx.fillStyle = '#FFFFFF';
      rr(ctx, 865 - lw / 2, 950, lw, 58, 29); ctx.fill();
      ctx.fillStyle = o.theme.ink;
      ctx.fillText(o.rel, 865, 993);
      // 一句话
      ctx.font = '44px ' + TITLE;
      ctx.fillStyle = C.ink;
      wrap(ctx, o.duo.line, o.qr ? LX : W / 2, 380 + sh + 70, o.qr ? LW : 940, 60, 2);
      if (o.qr) qrCard(ctx, o.qr);
      footer(ctx);
      return canvas.toDataURL('image/png');
    });
  }

  root.MiaoPoster = { renderSolo: renderSolo, renderDuo: renderDuo };
})(this);
