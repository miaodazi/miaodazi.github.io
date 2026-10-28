/* 喵搭子 · 纯计算：计分、链接编码、双人配对
 * 不碰页面，Node 里可直接 require 测试。只用 Chrome 61 认识的语法（小红书小工具要求）。
 */
(function (root) {
  'use strict';

  var MAX_NICK = 8;

  /* ---------- 单人：票数最多的猫 ----------
   * 平票时用答案算一个固定号码，在平票的猫里挑一只：同样的答案永远挑同一只，
   * 每只猫被挑中的机会一样。（「谁最后被选中」会偏向最后一题里的猫，模拟测试实测橘猫只剩 10.3%。）
   * 上线后别改这条规则：链接里只存答案，规则一改，旧链接算出来的猫就变了。 */
  function computeSolo(data, answers) {
    var order = data.cats.map(function (c) { return c.key; });
    var counts = {};
    for (var i = 0; i < answers.length; i++) {
      var cat = data.questions[i].options[answers[i]].cat;
      counts[cat] = (counts[cat] || 0) + 1;
    }
    var ranked = Object.keys(counts).sort(function (a, b) {
      return (counts[b] - counts[a]) || (order.indexOf(a) - order.indexOf(b));
    });
    var tied = ranked.filter(function (k) { return counts[k] === counts[ranked[0]]; });
    var h = 0;
    for (var j = 0; j < answers.length; j++) h = (h * 31 + answers[j] + 1) % 1000003;
    var winner = tied[h % tied.length];
    ranked.splice(ranked.indexOf(winner), 1);
    ranked.unshift(winner);
    return {
      cat: winner,
      counts: counts,
      composition: ranked.slice(0, 3).map(function (k) {
        return { cat: k, pct: Math.round(counts[k] / answers.length * 100) };
      })
    };
  }

  /* ---------- UTF-8 ↔ base64url（昵称可能有中文和 emoji） ---------- */
  function b64urlEncode(str) {
    var bytes = new TextEncoder().encode(str);
    var bin = '';
    for (var i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  function b64urlDecode(s) {
    var b64 = s.replace(/-/g, '+').replace(/_/g, '/');
    while (b64.length % 4) b64 += '=';
    var bin = atob(b64);
    var bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  }

  function sanitizeNick(s) {
    var clean = String(s == null ? '' : s).replace(/[\s\u0000-\u001f\u007f]/g, '');
    return Array.from(clean).slice(0, MAX_NICK).join('');
  }

  /* ---------- 单人串：版本.关系.昵称.12个答案 ---------- */
  function encodeSingle(p) {
    return p.v + '.' + p.rel + '.' + b64urlEncode(sanitizeNick(p.nick)) + '.' + p.answers.join('');
  }

  function decodeSingle(data, str) {
    var parts = String(str == null ? '' : str).split('.');
    if (parts.length !== 4) return null;
    if (parts[0] !== String(data.version)) return null;
    var rel = Number(parts[1]);
    if (!/^\d$/.test(parts[1]) || rel >= data.relations.length) return null;
    var n = data.questions.length;
    if (!new RegExp('^[0-3]{' + n + '}$').test(parts[3])) return null;
    var nick = '';
    if (parts[2]) {
      try { nick = sanitizeNick(b64urlDecode(parts[2])); } catch (e) { return null; }
    }
    return { v: data.version, rel: rel, nick: nick, answers: parts[3].split('').map(Number) };
  }

  /* ---------- 双人串：邀请人串~搭子串 ---------- */
  function encodeDuo(a, b) { return encodeSingle(a) + '~' + encodeSingle(b); }

  function decodeDuo(data, str) {
    var halves = String(str == null ? '' : str).split('~');
    if (halves.length !== 2) return null;
    var a = decodeSingle(data, halves[0]), b = decodeSingle(data, halves[1]);
    return a && b ? { a: a, b: b } : null;
  }

  function sameSingle(a, b) {
    return !!a && !!b && a.nick === b.nick && a.answers.join('') === b.answers.join('');
  }

  function pairKey(data, catA, catB) {
    var order = data.cats.map(function (c) { return c.key; });
    return order.indexOf(catA) <= order.indexOf(catB) ? catA + '+' + catB : catB + '+' + catA;
  }

  /* ---------- 双人：合拍题数 → 默契度（70–99）和三种叫法 ---------- */
  function computeDuo(data, a, b) {
    var soloA = computeSolo(data, a.answers), soloB = computeSolo(data, b.answers);
    var same = [];
    for (var i = 0; i < a.answers.length; i++) if (a.answers[i] === b.answers[i]) same.push(i);
    var m = same.length;
    var key = pairKey(data, soloA.cat, soloB.cat);
    return {
      a: soloA,
      b: soloB,
      key: key,
      duo: data.duos[key],
      matches: m,
      score: Math.round(70 + m * 29 / 12),
      frame: m >= 7 ? 'sync' : (m >= 4 ? 'tune' : 'comp'),
      same: same.slice(0, 2).map(function (qi) {
        return { title: data.questions[qi].title, text: data.questions[qi].options[a.answers[qi]].text };
      })
    };
  }

  var api = {
    MAX_NICK: MAX_NICK,
    computeSolo: computeSolo,
    b64urlEncode: b64urlEncode,
    b64urlDecode: b64urlDecode,
    sanitizeNick: sanitizeNick,
    encodeSingle: encodeSingle,
    decodeSingle: decodeSingle,
    encodeDuo: encodeDuo,
    decodeDuo: decodeDuo,
    sameSingle: sameSingle,
    pairKey: pairKey,
    computeDuo: computeDuo
  };

  if (typeof module === 'object' && module.exports) { module.exports = api; }
  else { root.MiaoCore = api; }
})(this);
