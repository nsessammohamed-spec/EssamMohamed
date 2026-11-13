/* يبني الموقع كله من data/site.js — مفيش حاجة هنا محتاجة تتعدل بإيدك */
(function () {
  'use strict';
  const d = document, root = d.documentElement, app = d.getElementById('app');
  const ic = window.icon;
  const E = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const link = u => { u = String(u || '').trim(); return /^(https?:\/\/|mailto:|tel:|#)/i.test(u) ? u : '#'; };
  const img = u => { u = String(u || '').trim(); return /^(https?:\/\/|data:image\/|images\/|assets\/)/i.test(u) ? u : ''; };
  const ext = u => /^https?:/i.test(u);
  const PREVIEW = /[?&]preview=1/.test(location.search) && window.parent !== window;
  let D = null, cur = 'all', io = null;

  /* ---------- theme ---------- */
  const h2r = h => { h = h.replace('#', ''); if (h.length === 3) h = h.split('').map(c => c + c).join(''); const n = parseInt(h, 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
  const hex = a => '#' + a.map(v => v.toString(16).padStart(2, '0')).join('');
  function mode() {
    let m = null;
    try { m = localStorage.getItem('sx.mode'); } catch (e) {}
    if (m !== 'dark' && m !== 'light') m = (D.theme && D.theme.mode) || 'dark';
    if (m === 'auto') m = matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
    return m;
  }
  function theme() {
    const m = mode();
    root.dataset.mode = m;
    let acc = (D.theme && D.theme.accent) || '#C9A24B';
    if (!/^#[0-9a-f]{3}([0-9a-f]{3})?$/i.test(acc)) acc = '#C9A24B';
    const rgb = h2r(acc);
    const s = root.style;
    s.setProperty('--accent', acc);
    s.setProperty('--accent2', hex(m === 'light' ? mix(rgb, [0, 0, 0], .42) : mix(rgb, [255, 255, 255], .35)));
    s.setProperty('--accent-rgb', rgb.join(','));
    const tc = d.querySelector('meta[name=theme-color]');
    if (tc) tc.content = m === 'light' ? '#FAF7F0' : '#0B0A08';
  }

  /* ---------- helpers ---------- */
  const splitName = n => {
    const w = String(n || '').trim().split(/\s+/);
    if (w.length < 2) return [w[0] || '', ''];
    const k = Math.ceil(w.length / 2);
    return [w.slice(0, k).join(' '), w.slice(k).join(' ')];
  };
  const catOf = id => D.categories.find(c => c.id === id) || { name: '', icon: 'star', type: 'image' };
  const shown = () => D.projects.filter(p => p.visible !== false);

  /* ---------- sections ---------- */
  function norm(x) {
    x = x || {};
    x.meta = x.meta || {}; x.theme = x.theme || {}; x.hero = x.hero || {}; x.about = x.about || {};
    x.contact = x.contact || {}; x.contact.socials = x.contact.socials || [];
    ['stats', 'skills', 'categories', 'projects'].forEach(k => { x[k] = Array.isArray(x[k]) ? x[k] : []; });
    return x;
  }

  function card(p) {
    const c = catOf(p.category), src = img(p.image), href = link(p.link);
    const hasLink = href !== '#';
    const media = '<div class="media">' +
      (src ? '<img loading="lazy" decoding="async" src="' + E(src) + '" alt="' + E(p.title) + '">' : '') +
      (src ? '' : '<div class="ph">' + ic(c.icon) + '</div>') +
      (c.type === 'video' ? '<div class="pl"><span>' + ic('play') + '</span></div>' : '') +
      (hasLink ? '<span class="open">' + (c.type === 'video' ? 'شغّل' : 'شوف المشروع') + ' ' + ic('ext') + '</span>' : (src ? '<span class="open">تكبير ' + ic('image') + '</span>' : '')) +
      '</div>';
    const body = '<div class="cb">' + (p.tag ? '<span class="tg">' + E(p.tag) + '</span>' : '') + '<h3 dir="auto">' + E(p.title) + '</h3>' + (p.desc ? '<p>' + E(p.desc) + '</p>' : '') + '</div>';
    const cls = 'card' + (p.featured ? ' feat' : '');
    if (hasLink) return '<a class="' + cls + '" href="' + E(href) + '"' + (ext(href) ? ' target="_blank" rel="noopener noreferrer"' : '') + '>' + media + body + '</a>';
    if (src) return '<button type="button" class="' + cls + '" data-lb="' + E(src) + '" aria-label="تكبير: ' + E(p.title) + '">' + media + body + '</button>';
    return '<div class="' + cls + '">' + media + body + '</div>';
  }

  function grid() {
    const list = shown().filter(p => cur === 'all' || p.category === cur);
    return list.length ? list.map(card).join('') : '<div class="empty">لسه مفيش أعمال في القسم ده.</div>';
  }

  function build() {
    const H = D.hero, A = D.about, C = D.contact, P = shown();
    const [n1, n2] = splitName(H.name);
    const skills = D.skills.filter(Boolean);
    const catsWithWork = D.categories.filter(c => P.some(p => p.category === c.id));
    if (cur !== 'all' && !catsWithWork.some(c => c.id === cur)) cur = 'all';
    let no = 0; const num = () => String(++no).padStart(2, '0');
    const menu = [];
    const sections = [];

    if (D.stats.length) sections.push('<section class="s" style="padding-top:60px"><div class="wrap rv"><div class="stats">' +
      D.stats.map(s => '<div class="stat"><b>' + E(s.value) + '</b><span>' + E(s.label) + '</span></div>').join('') + '</div></div></section>');

    if (D.categories.length) {
      menu.push(['#services', 'خدماتي']);
      sections.push('<section class="s" id="services"><div class="wrap"><div class="sh rv"><span class="no">' + num() + '</span><h2>بشتغل في إيه؟</h2><p>اختار المجال وشوف شغلي فيه.</p></div><div class="svc">' +
        D.categories.map((c, i) => {
          const n = P.filter(p => p.category === c.id).length;
          return '<button type="button" class="rv" style="--d:' + (i * .08) + 's" data-cat="' + E(c.id) + '"><span class="ico">' + ic(c.icon) + '</span><h3>' + E(c.name) + '</h3><p>' + E(c.desc) + '</p><em>' + (n ? n + ' ' + (n > 2 && n < 11 ? 'أعمال' : 'عمل') + ' · شوفهم' : 'قريبًا') + ' ' + ic('arrowL') + '</em></button>';
        }).join('') + '</div></div></section>');
    }

    if (P.length) {
      menu.unshift(['#work', 'أعمالي']);
      sections.push('<section class="s" id="work"><div class="wrap"><div class="sh rv"><span class="no">' + num() + '</span><h2>أعمالي</h2><p>مختارات من الشغل اللي اشتغلته.</p></div>' +
        (catsWithWork.length > 1 ? '<div class="filters rv" role="group" aria-label="فلترة الأعمال"><button type="button" class="fc" data-f="all" aria-pressed="' + (cur === 'all') + '">الكل <small>' + P.length + '</small></button>' +
          catsWithWork.map(c => '<button type="button" class="fc" data-f="' + E(c.id) + '" aria-pressed="' + (cur === c.id) + '">' + E(c.name) + ' <small>' + P.filter(p => p.category === c.id).length + '</small></button>').join('') + '</div>' : '') +
        '<div class="grid rv" id="grid">' + grid() + '</div></div></section>');
    }

    if (A.text || skills.length) {
      menu.push(['#about', 'عني']);
      sections.push('<section class="s" id="about"><div class="wrap"><div class="sh rv"><span class="no">' + num() + '</span><h2>' + E(A.title || 'نبذة عني') + '</h2></div><div class="about"><p class="tx rv">' + E(A.text) + '</p>' +
        (skills.length ? '<div class="skills rv"><h3>الأدوات والمهارات</h3>' + skills.map(s => '<span class="sk">' + E(s) + '</span>').join('') + '</div>' : '') + '</div></div></section>');
    }

    const wa = String(C.whatsapp || '').replace(/\D/g, '');
    if (C.email || wa || C.socials.length) {
      menu.push(['#contact', 'تواصل']);
      sections.push('<section class="s" id="contact"><div class="wrap"><div class="cx rv"><h2>' + E(C.title || 'تواصل معايا') + '</h2>' + (C.text ? '<p>' + E(C.text) + '</p>' : '') +
        (C.email ? '<a class="mail" href="mailto:' + E(C.email) + '">' + E(C.email) + '</a>' : '') +
        (wa ? '<div class="cta"><a class="btn primary" href="https://wa.me/' + wa + '" target="_blank" rel="noopener noreferrer">كلمني على واتساب ' + ic('arrowL') + '</a></div>' : '') +
        (C.socials.length ? '<div class="soc">' + C.socials.filter(s => s && s.url).map(s => '<a href="' + E(link(s.url)) + '" target="_blank" rel="noopener noreferrer">' + E(s.name || s.url) + ' ' + ic('ext') + '</a>').join('') + '</div>' : '') +
        '</div></div></section>');
    }

    const nav = '<header class="nav" id="nav"><div class="wrap nav-in"><a class="brand" href="#top" aria-label="الرئيسية"><b>' + E((H.name || 'ع').trim().charAt(0)) + '</b><span>' + E(H.name) + '</span></a>' +
      '<nav class="menu" id="menu" aria-label="القائمة">' + menu.map(m => '<a href="' + m[0] + '">' + m[1] + '</a>').join('') + '</nav>' +
      (D.theme.toggle === false ? '' : '<button type="button" class="ib" data-act="mode" aria-label="تبديل الوضع الليلي/النهاري">' + ic(root.dataset.mode === 'light' ? 'moon' : 'sun') + '</button>') +
      '<button type="button" class="ib burger" data-act="menu" aria-label="القائمة" aria-expanded="false">' + ic('menu') + '</button></div></header>';

    const chips = skills.slice(0, 3).map(s => '<span class="chip">' + E(s) + '</span>').join('');
    const photo = img(H.photo);
    const hero = '<section class="hero" id="top"><div class="wrap hero-in"><div>' +
      (H.eyebrow ? '<p class="eyebrow rv">' + E(H.eyebrow) + '</p>' : '') +
      '<h1 class="name rv" style="--d:.08s"><span>' + E(n1) + '</span>' + (n2 ? '<span class="g">' + E(n2) + '</span>' : '') + '</h1>' +
      (H.sub ? '<p class="sub rv" style="--d:.16s">' + E(H.sub) + '</p>' : '') +
      '<div class="cta rv" style="--d:.24s">' +
      (H.cta1Text ? '<a class="btn primary" href="' + E(link(H.cta1Link)) + '">' + E(H.cta1Text) + ' ' + ic('arrowL') + '</a>' : '') +
      (H.cta2Text ? '<a class="btn ghost" href="' + E(link(H.cta2Link)) + '">' + E(H.cta2Text) + '</a>' : '') + '</div>' +
      (H.available && H.availableText ? '<p class="avail rv" style="--d:.3s"><span class="pulse"></span>' + E(H.availableText) + '</p>' : '') +
      '</div><figure class="hero-ph rv" style="--d:.2s"><div class="arch">' +
      (photo ? '<img src="' + E(photo) + '" alt="' + E(H.name) + '">' : '<div class="mono" aria-hidden="true">' + E((H.name || 'ع').trim().charAt(0)) + '</div>') +
      '</div>' + chips + '</figure></div></section>';

    let base = []; while (skills.length && base.length < 8) base = base.concat(skills);
    const mk = k => base.map(s => '<span' + (k ? ' class="dup"' : '') + '>' + E(s) + '</span><i' + (k ? ' class="dup"' : '') + '></i>').join('');
    const marq = skills.length ? '<div class="marq" aria-hidden="true"><div class="mt">' + mk(0) + mk(1) + '</div></div>' : '';

    const foot = '<footer class="f"><div class="wrap"><span>' + E(D.footer || '') + '</span><a class="up" href="#top">للأعلى ' + ic('arrowUp') + '</a></div></footer>';

    app.innerHTML = nav + '<main id="main">' + hero + marq + sections.join('') + '</main>' + foot;
    onScroll(); reveal();
  }

  /* ---------- behaviours ---------- */
  function reveal() {
    const els = [].slice.call(d.querySelectorAll('.rv'));
    if (!('IntersectionObserver' in window)) { els.forEach(e => e.classList.add('in')); return; }
    if (io) io.disconnect();
    io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { rootMargin: '0px 0px -6% 0px', threshold: .08 });
    els.forEach(e => io.observe(e));
  }
  function onScroll() { const n = d.getElementById('nav'); if (n) n.classList.toggle('stuck', scrollY > 24); }
  addEventListener('scroll', onScroll, { passive: true });

  function setFilter(id) {
    cur = id;
    const g = d.getElementById('grid'); if (!g) return;
    g.innerHTML = grid(); g.classList.remove('swap'); void g.offsetWidth; g.classList.add('swap');
    d.querySelectorAll('.fc').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.f === id)));
  }

  d.addEventListener('click', e => {
    const t = e.target;
    const a = t.closest('[data-act]');
    if (a) {
      if (a.dataset.act === 'mode') {
        const next = root.dataset.mode === 'light' ? 'dark' : 'light';
        try { localStorage.setItem('sx.mode', next); } catch (x) {}
        theme(); a.innerHTML = ic(next === 'light' ? 'moon' : 'sun');
      }
      if (a.dataset.act === 'menu') {
        const m = d.getElementById('menu'), o = m.classList.toggle('open'); a.setAttribute('aria-expanded', String(o));
      }
      return;
    }
    if (t.closest('#menu a')) { d.getElementById('menu').classList.remove('open'); const b = d.querySelector('.burger'); if (b) b.setAttribute('aria-expanded', 'false'); }
    const f = t.closest('[data-f]'); if (f) { setFilter(f.dataset.f); return; }
    const c = t.closest('[data-cat]');
    if (c) { setFilter(c.dataset.cat); const w = d.getElementById('work'); if (w) w.scrollIntoView({ behavior: 'smooth' }); return; }
    const lb = t.closest('[data-lb]');
    if (lb) {
      const o = d.createElement('div'); o.className = 'lb'; o.setAttribute('role', 'dialog'); o.setAttribute('aria-modal', 'true');
      o.innerHTML = '<img alt=""><button type="button" aria-label="إغلاق">' + ic('x') + '</button>'; o.firstChild.src = lb.dataset.lb;
      const close = () => { o.remove(); d.removeEventListener('keydown', k); };
      const k = ev => { if (ev.key === 'Escape') close(); };
      o.addEventListener('click', close); d.addEventListener('keydown', k); d.body.appendChild(o); o.querySelector('button').focus();
    }
  });
  /* لو صورة مش بتحمّل نرجّع الأيقونة بدلها */
  d.addEventListener('error', e => {
    const t = e.target;
    if (t && t.tagName === 'IMG' && t.closest('.media')) { const m = t.parentNode; t.remove(); const pr = D.projects.find(p => img(p.image) === t.getAttribute('src')); if (!m.querySelector('.ph')) m.insertAdjacentHTML('afterbegin', '<div class="ph">' + ic(pr ? catOf(pr.category).icon : 'image') + '</div>'); }
  }, true);

  /* ---------- boot ---------- */
  function render(data) {
    D = norm(data);
    theme();
    d.title = D.meta.title || D.hero.name || d.title;
    const md = d.querySelector('meta[name=description]'); if (md && D.meta.description) md.content = D.meta.description;
    const ot = d.querySelector('meta[property="og:title"]'); if (ot) ot.content = d.title;
    const od = d.querySelector('meta[property="og:description"]'); if (od && D.meta.description) od.content = D.meta.description;
    build();
  }
  function fail() {
    app.innerHTML = '<div class="boot"><div style="text-align:center;padding:24px"><h2 style="margin-bottom:10px">مقدرتش أحمّل محتوى الموقع</h2><p>تأكد إن ملف data/site.js موجود جنب الصفحة.</p></div></div>';
  }
  if (PREVIEW) {
    addEventListener('message', e => { if (e.origin === location.origin && e.data && e.data.type === 'sx-preview') render(e.data.data); });
    parent.postMessage({ type: 'sx-ready' }, location.origin);
  } else {
    const s = d.createElement('script');
    s.src = 'data/site.js?t=' + Math.floor(Date.now() / 30000);
    s.onload = () => window.SITE ? render(window.SITE) : fail();
    s.onerror = fail;
    d.head.appendChild(s);
  }
})();
