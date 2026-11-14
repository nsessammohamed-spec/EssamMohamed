/* آراء العملاء: عرض (سكرينات + نصوص) ونموذج للزوار.
   الرأي اللي الزائر بيبعته بيروح للـ Worker وبيستنى موافقتك من لوحة التحكم قبل ما يظهر.
   بيشتغل في نافذة العمل (works.html) وفي صفحة العمل المستقلة (work/<slug>/). */
(function () {
  'use strict';
  var d = document;
  var API = String(window.REVIEWS_API || 'https://site-admin.nsessammohamed.workers.dev').replace(/\/+$/, '');
  var BASE = window.RV_BASE || '';           // مسار الجذر للصور (صفحة العمل بتحط ../../)

  var E = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var src = function (u) { u = String(u || '').trim(); return /^(https?:|data:)/i.test(u) ? u : BASE + u.replace(/^\.?\//, ''); };
  var STAR = '<svg viewBox="0 0 24 24" aria-hidden="true"><polygon points="12 2 15.1 8.3 22 9.3 17 14.1 18.2 21 12 17.8 5.8 21 7 14.1 2 9.3 8.9 8.3"/></svg>';
  var stars = function (n) {
    n = Math.max(0, Math.min(5, parseInt(n, 10) || 0)); if (!n) return '';
    var o = ''; for (var i = 1; i <= 5; i++) o += '<i class="' + (i <= n ? 'on' : '') + '">' + STAR + '</i>';
    return '<span class="rv-st" role="img" aria-label="' + n + ' من 5">' + o + '</span>';
  };

  function card(r) {
    var meta = '<div class="rv-m"><b dir="auto">' + E(r.name || 'عميل') + '</b>' + stars(r.rating) + '</div>';
    var txt = r.text ? '<p dir="auto">' + E(r.text) + '</p>' : '';
    if (r.img) {
      return '<figure class="rvc shot"><a class="rvc-i" href="' + E(src(r.img)) + '" data-rvz aria-label="تكبير صورة الرأي"><img loading="lazy" decoding="async" src="' + E(src(r.img)) + '" alt="رأي ' + E(r.name || 'عميل') + '"></a>' +
        ((r.name || r.text || r.rating) ? '<figcaption>' + meta + txt + '</figcaption>' : '') + '</figure>';
    }
    return '<figure class="rvc"><blockquote>' + txt + '</blockquote><figcaption>' + meta + '</figcaption></figure>';
  }

  function form(pid) {
    var ratingBtns = [5, 4, 3, 2, 1].map(function (n) {
      return '<input type="radio" name="rt" id="rt' + n + '-' + pid + '" value="' + n + '"><label for="rt' + n + '-' + pid + '" title="' + n + ' من 5">' + STAR + '</label>';
    }).join('');
    return '<details class="rvf"><summary>✍️ شاركنا رأيك في العمل ده</summary>' +
      '<form class="rvf-f" novalidate data-rvf="' + E(pid) + '">' +
      '<label>اسمك<input name="nm" maxlength="40" autocomplete="name" dir="auto" placeholder="اكتب اسمك" required></label>' +
      '<div class="rvf-r"><span>تقييمك (اختياري)</span><div class="rvf-s" role="radiogroup" aria-label="التقييم">' + ratingBtns + '</div></div>' +
      '<label>رأيك<textarea name="tx" rows="4" maxlength="600" dir="auto" placeholder="احكيلنا تجربتك أو رأيك في العمل…" required></textarea></label>' +
      '<input class="rvf-hp" name="hp" tabindex="-1" autocomplete="off" aria-hidden="true">' +
      '<p class="rvf-n">الرأي بيظهر بعد ما صاحب الموقع يراجعه. من فضلك من غير روابط.</p>' +
      '<p class="rvf-e" role="alert" hidden></p>' +
      '<button class="btn primary" type="submit">إرسال الرأي</button></form></details>';
  }

  function html(p) {
    if (!p || !p.id) return '';
    var list = (Array.isArray(p.reviews) ? p.reviews : []).filter(function (r) { return r && (r.img || String(r.text || '').trim()); });
    var cards = list.length ? '<div class="rvs-l">' + list.map(card).join('') + '</div>' : '<p class="rvs-0">لسه مفيش آراء على العمل ده. كن أول من يشاركنا رأيه.</p>';
    return '<section class="rvs" data-rv="' + E(p.id) + '" aria-label="آراء العملاء"><div class="rvs-h"><h2>آراء العملاء</h2>' + (list.length ? '<span class="rvs-n">' + list.length + '</span>' : '') + '</div>' + cards + form(p.id) + '</section>';
  }

  /* صفحة العمل المستقلة: السيرفر كتب الكروت، وهنا بنضيف النموذج بس */
  function enhance() {
    d.querySelectorAll('.rvs[data-rv-static]').forEach(function (s) {
      if (!s.querySelector('.rvf')) s.insertAdjacentHTML('beforeend', form(s.getAttribute('data-rv-static')));
      s.setAttribute('data-rv', s.getAttribute('data-rv-static'));
    });
  }

  /* ---------- تكبير السكرين ---------- */
  var lb = null, back = null;
  function closeLb() { if (!lb) return; lb.remove(); lb = null; if (back && back.focus) back.focus(); back = null; }
  function openLb(u, alt) {
    back = d.activeElement;
    lb = d.createElement('div'); lb.className = 'rvx'; lb.setAttribute('role', 'dialog'); lb.setAttribute('aria-modal', 'true'); lb.setAttribute('aria-label', alt || 'صورة');
    lb.innerHTML = '<img src="' + E(u) + '" alt="' + E(alt || '') + '"><button type="button" aria-label="إغلاق">×</button>';
    d.body.appendChild(lb); lb.querySelector('button').focus();
  }
  d.addEventListener('click', function (e) {
    var z = e.target.closest && e.target.closest('[data-rvz]');
    if (z) { e.preventDefault(); e.stopPropagation(); var im = z.querySelector('img'); openLb(z.href, im && im.alt); return; }
    if (lb && e.target.closest('.rvx')) { e.stopPropagation(); closeLb(); }
  }, true);
  d.addEventListener('keydown', function (e) { if (lb && e.key === 'Escape') { e.stopImmediatePropagation(); closeLb(); } }, true);

  /* ---------- إرسال الرأي ---------- */
  var MSG = {
    name: 'اكتب اسمك (حرفين على الأقل).', text: 'اكتب رأيك (10 حروف على الأقل).', links: 'من فضلك من غير روابط في الرأي.',
    too_many: 'بعتّ آراء كتير في وقت قصير. جرّب بعد ساعة.', full: 'صندوق الآراء ممتلئ حاليًا. جرّب بعد شوية.',
    net: 'مقدرتش أبعت الرأي. اتأكد من النت وجرّب تاني.'
  };
  d.addEventListener('submit', function (e) {
    var f = e.target.closest && e.target.closest('[data-rvf]'); if (!f) return;
    e.preventDefault(); e.stopPropagation();
    var er = f.querySelector('.rvf-e'), btn = f.querySelector('button[type=submit]');
    var nm = f.nm.value.trim(), tx = f.tx.value.trim(), rt = (f.querySelector('input[name=rt]:checked') || {}).value || 0;
    var fail = function (m) { er.textContent = m; er.hidden = false; };
    er.hidden = true;
    if (nm.length < 2) return fail(MSG.name);
    if (tx.length < 10) return fail(MSG.text);
    btn.disabled = true; btn.textContent = 'جاري الإرسال…';
    fetch(API + '/reviews', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pid: f.getAttribute('data-rvf'), name: nm, text: tx, rating: +rt, hp: f.hp.value }) })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { return { ok: r.ok && j.ok, j: j }; }); })
      .then(function (x) {
        if (x.ok) { f.innerHTML = '<p class="rvf-ok">شكرًا ليك ♥ رأيك وصل وهيظهر بعد المراجعة.</p>'; return; }
        btn.disabled = false; btn.textContent = 'إرسال الرأي'; fail(MSG[x.j && x.j.error] || MSG.net);
      })
      .catch(function () { btn.disabled = false; btn.textContent = 'إرسال الرأي'; fail(MSG.net); });
  }, true);

  window.RV = { html: html, card: card };
  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', enhance); else enhance();
})();
