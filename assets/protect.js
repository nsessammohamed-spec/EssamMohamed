/* حماية الأعمال: حواجز ضد النسخ العادي + علامة مائية باسمك.
   تنبيه: مفيش طريقة تمنع لقطة الشاشة 100% على الويب (كاميرا تانية أو سيستم الموبايل مش ممكن نكتشفهم).
   الهدف إنها تبقى صعبة ومزعجة، والعلامة المائية بتطلع في أي لقطة. بتتقفل من لوحة التحكم (الإعدادات ← حماية الأعمال). */
(function () {
  'use strict';
  var d = document, root = d.documentElement, tm = 0;
  var on = function () { return !(window.SITE && window.SITE.protect === false); };
  var isMedia = function (t) { return !!(t && t.closest && t.closest('img,video,picture,.wk-t,.wk-sp,.card,.vw,.pj,.sc')); };
  var show = function () { clearTimeout(tm); root.classList.remove('pt-hide'); };
  var hide = function (ms) { if (!on()) return; root.classList.add('pt-hide'); clearTimeout(tm); if (ms) tm = setTimeout(show, ms); };

  var st = d.createElement('style');
  st.textContent =
    'html.pt-on img,html.pt-on video{-webkit-user-drag:none;user-select:none;-webkit-user-select:none;-webkit-touch-callout:none}' +
    'html.pt-hide .wk-m,html.pt-hide .media,html.pt-hide .vw-fig,html.pt-hide .vw-sheet,html.pt-hide .vw-th,html.pt-hide .vw-rel,html.pt-hide .pj-fig,html.pt-hide .pj-g,html.pt-hide .pj-vid,html.pt-hide .pj-rc,html.pt-hide .sc-m{visibility:hidden}' +
    '@media print{html.pt-on body{display:none!important}}' +
    '#pt-wm{position:fixed;inset:0;z-index:2147483000;pointer-events:none;background-repeat:repeat}';
  (d.head || root).appendChild(st);

  /* العلامة المائية: اسمك مكرر بشكل مائل وخفيف فوق الصفحة كلها (بتطلع في أي لقطة) */
  var esc = function (s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  function layer() {
    var el = d.getElementById('pt-wm');
    if (!on()) { if (el) el.remove(); root.classList.remove('pt-on'); return; }
    root.classList.add('pt-on');
    var b = d.querySelector('.brand span');
    var name = (window.SITE && window.SITE.hero && window.SITE.hero.name) || (b && b.textContent) || String(d.title || '').split('|').pop().trim() || location.hostname;
    var fill = root.dataset.mode === 'light' ? '#000000' : '#ffffff';
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="360" height="240"><text x="180" y="120" text-anchor="middle" font-family="sans-serif" font-size="22" font-weight="700" fill="' + fill + '" fill-opacity=".09" transform="rotate(-24 180 120)">' + esc(name) + '</text></svg>';
    if (!el) { el = d.createElement('div'); el.id = 'pt-wm'; el.setAttribute('aria-hidden', 'true'); (d.body || root).appendChild(el); }
    el.style.backgroundImage = 'url("data:image/svg+xml;utf8,' + encodeURIComponent(svg) + '")';
  }
  layer(); addEventListener('load', layer); setTimeout(layer, 800); setTimeout(layer, 2500);
  try { new MutationObserver(layer).observe(root, { attributes: true, attributeFilter: ['data-mode'] }); } catch (e) {}

  /* منع القائمة اليمين والسحب وحفظ الصورة بالضغط المطوّل */
  d.addEventListener('contextmenu', function (e) { if (on() && isMedia(e.target)) e.preventDefault(); });
  d.addEventListener('dragstart', function (e) { if (on() && e.target && e.target.tagName === 'IMG') e.preventDefault(); });

  /* اختصارات الحفظ والطباعة ولقطات الشاشة (على قد ما المتصفح بيسمح) */
  function keys(e) {
    if (!on()) return;
    var k = String(e.key || '').toLowerCase(), c = e.code || '';
    if (k === 'printscreen' || c === 'PrintScreen') { hide(1600); try { navigator.clipboard.writeText(' '); } catch (x) {} return; }
    if (e.metaKey && e.shiftKey && (c === 'Digit3' || c === 'Digit4' || c === 'Digit5' || c === 'KeyS')) { hide(1600); return; }
    if ((e.ctrlKey || e.metaKey) && (k === 's' || k === 'p')) { e.preventDefault(); if (k === 'p') hide(2500); }
  }
  d.addEventListener('keydown', keys); d.addEventListener('keyup', keys);

  /* لما الصفحة تفقد التركيز (أداة قص اللقطات بتعمل كده) الأعمال بتختفي لحد ما ترجع */
  addEventListener('blur', function () { var a = d.activeElement; if (a && a.tagName === 'IFRAME') return; hide(); });
  addEventListener('focus', show);
  d.addEventListener('visibilitychange', function () { if (d.hidden) hide(); else show(); });
})();
