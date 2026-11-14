/* طبقة التأثيرات: بتضيف أشكال وأيقونات وحركة فوق الموقع بعد ما يتبني.
   مفيش أي تعديل على المحتوى، فلوحة التحكم والسيو مش بتتأثر. */
(function () {
  'use strict';
  var d = document, app = d.getElementById('app');
  if (!app) return;
  var RM = matchMedia('(prefers-reduced-motion: reduce)').matches;

  var TOOLS = [
    ['Photoshop', 'Ps', '212,166,74'],
    ['InDesign', 'Id', '212,166,74'],
    ['CapCut', 'Cc', '212,166,74'],
    ['Flutter', 'Fl', '212,166,74'],
    ['Illustrator', 'Ai', '212,166,74'],
    ['Premiere', 'Pr', '212,166,74'],
    ['After Effects', 'Ae', '212,166,74'],
    ['Figma', 'Fi', '212,166,74'],
    ['Canva', 'Ca', '212,166,74']
  ];

  var ART = {
    design: '<svg viewBox="0 0 120 120"><rect pathLength="1" x="14" y="26" width="52" height="52" rx="12" style="--j:0"/><rect pathLength="1" x="40" y="44" width="52" height="52" rx="12" style="--j:1"/><circle pathLength="1" cx="92" cy="30" r="14" style="--j:2"/><path pathLength="1" d="M20 100h30M105 70v18M96 79h18" style="--j:3"/><rect class="fill" x="40" y="44" width="52" height="52" rx="12"/></svg>',
    code: '<svg viewBox="0 0 120 120"><path pathLength="1" d="M42 38 20 60l22 22" style="--j:0"/><path pathLength="1" d="M78 38l22 22-22 22" style="--j:1"/><path pathLength="1" d="M66 30 54 90" style="--j:2"/><path pathLength="1" d="M20 102h40M70 102h30" style="--j:3"/><circle class="fill" cx="100" cy="20" r="6"/></svg>',
    board: '<svg viewBox="0 0 120 120"><path pathLength="1" d="M10 78c14-34 24 22 38-10s22-26 30-4 20 6 30-18" style="--j:0"/><path pathLength="1" d="M92 36l8-6 2 10" style="--j:2"/><circle pathLength="1" cx="30" cy="34" r="14" style="--j:1"/><path pathLength="1" d="M30 52v8M24 62h12" style="--j:2"/><path pathLength="1" d="M14 104h92" style="--j:3"/></svg>',
    edit: '<svg viewBox="0 0 120 120"><rect pathLength="1" x="8" y="30" width="104" height="52" rx="10" style="--j:0"/><path pathLength="1" d="M34 30v52M60 30v52M86 30v52" style="--j:1"/><path pathLength="1" d="M8 100h104M30 96v8M60 96v8M90 96v8" style="--j:2"/><path class="play" pathLength="1" d="M48 18v90" style="--j:3;stroke:var(--accent2)"/><rect class="fill" x="34" y="30" width="26" height="52"/></svg>'
  };

  function artFor(txt, i) {
    if (/تصميم|جراف/.test(txt)) return ART.design;
    if (/برمج|تطبيق|كود/.test(txt)) return ART.code;
    if (/سبورة/.test(txt)) return ART.board;
    if (/مونتاج|فيديو/.test(txt)) return ART.edit;
    return [ART.design, ART.code, ART.board, ART.edit][i % 4];
  }

  function shapes(hero) {
    if (hero.querySelector('.fx-shapes')) return;
    var s = d.createElement('div'); s.className = 'fx-shapes'; s.setAttribute('aria-hidden', 'true');
    s.innerHTML = '<span class="o o1"></span><span class="o o2"></span><span class="pl"></span><span class="pl pl2"></span>' +
      '<span class="tri"><svg viewBox="0 0 60 60" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M30 6 56 52H4z"/></svg></span>' +
      '<span class="dots"></span><span class="sq"></span><span class="sq sq2"></span><span class="sq sq3"></span><span class="sq sq4"></span>' +
      '<span class="sqg"><svg viewBox="0 0 150 30" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path pathLength="1" d="M2 18c14-18 24 16 38 0s24-16 38 0 24 16 38 0 20-12 32-4"/></svg></span>';
    hero.insertBefore(s, hero.firstChild);
  }

  function esc(x) { return String(x == null ? '' : x).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  /* أدوات الهيرو: بتتحكم فيها من لوحة التحكم (hero.tools + hero.showTools)، ولو القايمة فاضية بتتاخد من المهارات */
  function tools(hero, skills) {
    if (hero.querySelector('.fx-tools')) return;
    var H = (window.SITE && SITE.hero) || {};
    if (H.showTools === false) return;
    var host = hero.querySelector('.hero-cta') || hero.querySelector('.sub');
    if (!host) return;
    var list = [];
    if (Array.isArray(H.tools) && H.tools.length) {
      H.tools.forEach(function (t) {
        if (!t || !String(t.name || '').trim()) return;
        var n = String(t.name).trim(), a = String(t.abbr || '').trim() || n.replace(/\s+/g, '').slice(0, 2);
        list.push([n, a, '212,166,74']);
      });
    } else {
      var low = skills.join(' | ').toLowerCase();
      TOOLS.forEach(function (t) { if (low.indexOf(t[0].toLowerCase()) > -1) list.push(t); });
    }
    if (!list.length) return;
    var w = d.createElement('div'); w.className = 'fx-tools'; w.setAttribute('aria-hidden', 'true');
    w.innerHTML = '<small>الأدوات:</small>' + list.slice(0, 8).map(function (t, i) {
      return '<span class="fx-t" title="' + esc(t[0]) + '" style="--tc:' + t[2] + ';--i:' + i + '">' + esc(t[1]) + '</span>';
    }).join('');
    host.parentNode.insertBefore(w, host.nextSibling);
  }

  function arts() {
    d.querySelectorAll('.svc button').forEach(function (b, i) {
      if (b.querySelector('.fx-art')) return;
      var h = b.querySelector('h3'), a = d.createElement('span');
      a.className = 'fx-art'; a.setAttribute('aria-hidden', 'true');
      a.innerHTML = artFor(h ? h.textContent : '', i);
      b.insertBefore(a, b.firstChild);
    });
  }

  function words() {
    d.querySelectorAll('.sh h2, .cx h2').forEach(function (h) {
      if (h.dataset.fx || h.children.length) return;
      h.dataset.fx = '1';
      var t = h.textContent.trim(); if (!t) return;
      h.setAttribute('aria-label', t);
      h.innerHTML = t.split(/\s+/).map(function (w, k) {
        return '<span class="fx-w" aria-hidden="true"><span style="--k:' + k + '">' + w + '</span></span>';
      }).join(' ');
    });
  }

  function dividers() {
    var secs = d.querySelectorAll('main > section.s');
    secs.forEach(function (s, i) {
      if (i === 0 || s.previousElementSibling && s.previousElementSibling.classList.contains('fx-div')) return;
      var x = d.createElement('div'); x.className = 'fx-div'; x.setAttribute('aria-hidden', 'true'); x.innerHTML = '<i></i>';
      s.parentNode.insertBefore(x, s);
      if ('IntersectionObserver' in window) {
        var o = new IntersectionObserver(function (es) { if (es[0].isIntersecting) { x.classList.add('in'); o.disconnect(); } }, { rootMargin: '0px 0px -15% 0px' });
        o.observe(x);
      } else x.classList.add('in');
    });
  }

  function spots() {
    d.querySelectorAll('.pk, .wy, .cc, .tq').forEach(function (c) {
      if (c.querySelector(':scope > .fx-spot')) return;
      var i = d.createElement('i'); i.className = 'fx-spot'; i.setAttribute('aria-hidden', 'true'); c.appendChild(i);
    });
  }

  function decorate() {
    var hero = d.querySelector('.hero'); if (!hero || hero.dataset.fx) return;
    hero.dataset.fx = '1';
    var skills = [].map.call(d.querySelectorAll('.skills .sk'), function (x) { return x.textContent; });
    if (!skills.length && window.SITE && SITE.skills) skills = SITE.skills.map(String);
    shapes(hero); tools(hero, skills); arts(); words(); dividers(); spots();
  }

  if (!RM) {
    d.addEventListener('pointermove', function (e) {
      if (e.pointerType === 'touch') return;
      var c = e.target.closest && e.target.closest('.pk, .wy, .cc, .tq'); if (!c) return;
      var r = c.getBoundingClientRect();
      c.style.setProperty('--sx', (e.clientX - r.left) + 'px'); c.style.setProperty('--sy', (e.clientY - r.top) + 'px');
    }, { passive: true });
  }

  decorate();
  new MutationObserver(function () { decorate(); }).observe(app, { childList: true });
})();
