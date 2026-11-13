/* يبني الموقع كله من data/site.js — مفيش حاجة هنا محتاجة تتعدل بإيدك */
(function () {
  'use strict';
  const d = document, root = d.documentElement, app = d.getElementById('app');
  const ic = window.icon;
  const E = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const link = u => { u = String(u || '').trim(); return /^(https?:\/\/|mailto:|tel:|#)/i.test(u) ? u : '#'; };
  const img = u => { u = String(u || '').trim(); return /^(https?:\/\/|data:image\/|images\/|assets\/)/i.test(u) ? u : ''; };
  const imgsOf = p => { let a = Array.isArray(p.images) ? p.images.map(img).filter(Boolean) : []; if (!a.length) { const s = img(p.image); if (s) a = [s]; } return a; };
  const ext = u => /^https?:/i.test(u);
  const ar = s => String(s == null ? '' : s).replace(/(^|[\s(،])و(?=[A-Za-z])/g, '$1و ');
  const PREVIEW = /[?&]preview=1/.test(location.search) && window.parent !== window;
  let D = null, cur = 'all', io = null;
  /* ألوان هادية متناسقة مع الدهبي: دهبي، أخضر مريمية، وردي طوبي، أزرق مخضر */
  const PAL = ['212,166,74', '140,170,110', '204,122,107', '111,163,160', '170,140,170'];
  const rgbOf = (c, i) => { const m = /^#([0-9a-f]{6})$/i.exec((c && c.color) || ''); return m ? h2r(m[1]).join(',') : PAL[i % PAL.length]; };
  const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;

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
    return [w[0] || '', w.slice(1).join(' ')];
  };
  const catOf = id => D.categories.find(c => c.id === id) || { name: '', icon: 'star', type: 'image' };
  const shown = () => D.projects.filter(p => p.visible !== false);

  /* ---------- sections ---------- */
  function norm(x) {
    x = x || {};
    x.meta = x.meta || {}; x.theme = x.theme || {}; x.hero = x.hero || {}; x.about = x.about || {};
    x.contact = x.contact || {}; x.contact.socials = x.contact.socials || [];
    ['stats', 'skills', 'categories', 'projects'].forEach(k => { x[k] = Array.isArray(x[k]) ? x[k] : []; });
    x.projects.forEach((p, k) => { if (p && !p.id) p.id = 'x' + k; });
    return x;
  }

  function card(p, i) {
    const c = catOf(p.category), all = imgsOf(p), src = all[0];
    const media = '<div class="media">' +
      (src ? '<img loading="lazy" decoding="async" src="' + E(src) + '" alt="' + E(p.title) + '">' : '<div class="ph">' + ic(c.icon) + '</div>') +
      '<span class="cat-b">' + ic(c.icon) + ' ' + E(c.name) + '</span>' +
      '<span class="idx">' + String(i + 1).padStart(2, '0') + '</span>' +
      (c.type !== 'video' && all.length > 1 ? '<span class="cnt">' + ic('layers') + all.length + ' صور</span>' : '') +
      (c.type === 'video' ? '<div class="pl"><span>' + ic('play') + '</span></div>' : '') + '</div>';
    const body = '<div class="cb">' + (p.tag ? '<span class="tg">' + E(p.tag) + '</span>' : '') + '<h3 dir="auto">' + E(p.title) + '</h3>' + (p.desc ? '<p dir="auto">' + E(p.desc) + '</p>' : '') +
      '<span class="go">' + (c.type === 'video' ? 'شاهد العمل' : 'شوف العمل') + ' ' + ic('arrowL') + '</span></div>';
    return '<a class="card' + (p.featured ? ' feat' : '') + '" style="--i:' + i + ';--c:' + rgbOf(c, Math.max(0, D.categories.findIndex(x => x.id === p.category))) + '" href="works.html#w-' + encodeURIComponent(p.id) + '" aria-label="' + E(p.title) + '">' + media + body + '</a>';
  }

  function grid() {
    const list = shown().filter(p => cur === 'all' || p.category === cur);
    return list.length ? list.map(card).join('') : '<div class="empty">لسه مفيش أعمال.</div>';
  }

  function build() {
    const H = D.hero, A = D.about, C = D.contact, P = shown();
    const [n1, n2] = splitName(H.name);
    const skills = D.skills.filter(Boolean);
    let no = 0; const num = () => String(++no).padStart(2, '0');
    const menu = [];
    const sections = [];

    if (D.stats.length) sections.push('<section class="s" style="padding-top:60px"><div class="wrap rv"><div class="stats">' +
      D.stats.map(s => '<div class="stat"><b>' + E(s.value) + '</b><span>' + E(s.label) + '</span></div>').join('') + '</div></div></section>');

    if (D.categories.length) {
      menu.push(['#services', 'خدماتي']);
      sections.push('<section class="s" id="services"><div class="wrap"><div class="sh ctr rv"><span class="no">' + num() + '</span><h2>بشتغل في إيه؟</h2><p>اختار المجال وشوف شغلي فيه.</p></div><div class="svc">' +
        D.categories.map((c, i) => {
          const n = P.filter(p => p.category === c.id).length;
          return '<div class="svc-w rv" style="--d:' + (i * .08) + 's"><button type="button" style="--c:' + rgbOf(c, i) + '" data-cat="' + E(c.id) + '"><span class="ico">' + ic(c.icon) + '</span><h3>' + E(c.name) + '</h3><p>' + E(c.desc) + '</p><em>' + (n ? n + ' ' + (n > 2 && n < 11 ? 'أعمال' : 'عمل') + ' · شوفهم' : 'قريبًا') + ' ' + ic('arrowL') + '</em></button></div>';
        }).join('') + '</div></div></section>');
    }

    if (P.length) {
      menu.unshift(['#work', 'أعمالي']);
      sections.push('<section class="s" id="work"><div class="wrap"><div class="sh ctr rv"><span class="no">' + num() + '</span><h2>أعمالي</h2><p>اضغط على أي عمل تشوفه بالحجم الكامل.</p></div>' +
        (function () {
        const cs = D.categories.filter(c => P.some(p => p.category === c.id));
        if (cs.length < 2) return '';
        return '<div class="filters ctr rv" role="group" aria-label="تصفية الأعمال">' + [['all', 'الكل', P.length]].concat(cs.map(c => [c.id, c.name, P.filter(p => p.category === c.id).length])).map(f => '<button type="button" class="fc" data-f="' + E(f[0]) + '" aria-pressed="' + (f[0] === 'all') + '">' + E(f[1]) + ' <small>' + f[2] + '</small></button>').join('') + '</div>';
      })() + '<div class="grid rv" id="grid">' + grid() + '</div><div class="more rv"><a class="btn ghost" href="works.html">شوف صفحة الأعمال كاملة ' + ic('arrowL') + '</a></div></div></section>');
    }

    const mine = (Array.isArray(A.photos) ? A.photos : []).map(img).filter(Boolean);
    if (A.text || skills.length || mine.length) {
      menu.push(['#about', 'عني']);
      const facts = (Array.isArray(A.facts) ? A.facts : []).filter(f => f && f.label && f.value);
      if (D.categories.length) facts.push({ label: 'التخصصات', value: D.categories.map(c => c.name).join('، ') });
      sections.push('<section class="s" id="about"><div class="wrap"><div class="ab' + (mine.length ? '' : ' solo') + '">' +
        '<div class="ab-tx"><div class="sh rv"><h2>' + E(A.title || 'نبذة عني') + '</h2></div>' +
        '<p class="tx rv">' + E(ar(A.text)) + '</p>' +
        (facts.length ? '<dl class="facts rv">' + facts.map(f => '<div><dt>' + E(f.label) + '</dt><dd>' + E(ar(f.value)) + '</dd></div>').join('') + '</dl>' : '') +
        (skills.length ? '<div class="skills rv"><h3>الأدوات اللي بشتغل بيها</h3>' + skills.map((s, k) => '<span class="sk" style="--c:' + PAL[k % PAL.length] + '">' + E(s) + '</span>').join('') + '</div>' : '') +
        '<div class="cta rv"><a class="btn primary" href="#contact">كلمني ' + ic('arrowL') + '</a><a class="btn ghost" href="works.html">كل أعمالي</a></div></div>' +
        (mine.length ? '<div class="mine rv"><div class="mine-g n' + Math.min(mine.length, 5) + '">' + mine.slice(0, 5).map((u, i) => '<button type="button" class="mine-i" data-lb="' + E(u) + '" aria-label="تكبير الصورة ' + (i + 1) + '"><img loading="lazy" decoding="async" src="' + E(u) + '" alt="' + E(H.name) + ' — صورة ' + (i + 1) + '"></button>').join('') + '</div></div>' : '') +
        '</div></div></section>');
    }

    const wa = String(C.whatsapp || '').replace(/\D/g, '');
    const CF = C.form || {}, showF = C.showForm !== false, whens = (Array.isArray(C.when) ? C.when : ['مستعجل', 'خلال أسبوع', 'مفيش استعجال']).map(x => String(x == null ? '' : x).trim()).filter(Boolean);
    if (C.email || wa || C.socials.length) {
      menu.push(['#contact', 'تواصل']);
      sections.push('<section class="s" id="contact"><div class="wrap"><div class="cx rv"><h2>' + E(C.title || 'تواصل معايا') + '</h2>' + (C.text ? '<p>' + E(ar(C.text)) + '</p>' : '') +
        (C.steps && C.steps.length ? '<ol class="stp">' + C.steps.filter(x => x && x.t).map((x, i) => '<li style="--c:' + PAL[i % PAL.length] + '"><b>' + (i + 1) + '</b><div><h3>' + E(x.t) + '</h3>' + (x.d ? '<p>' + E(ar(x.d)) + '</p>' : '') + '</div></li>').join('') + '</ol>' : '') +
          '<div class="ct' + (showF ? '' : ' nf') + '">' + (showF ? ('<form class="cf" id="cf" data-g="' + E(CF.greeting || ('أهلاً ' + splitName(H.name)[0])) + '" novalidate autocomplete="off">' +
          '<label class="fl"><span>اسمك</span><input name="nm" dir="rtl" type="text" maxlength="60" placeholder="اكتب اسمك"></label>' +
          (D.categories.length ? '<div class="fl"><span>محتاج إيه؟</span><div class="svs">' + D.categories.map((c, i) => '<button type="button" class="sv" style="--c:' + rgbOf(c, i) + '" data-svc="' + E(c.name) + '" aria-pressed="false">' + ic(c.icon) + E(c.name) + '</button>').join('') + '</div></div>' : '') +
          (whens.length ? '<div class="fl"><span>الميعاد المطلوب</span><div class="svs">' + whens.map((w, i) => '<button type="button" class="sv" style="--c:' + PAL[(i + 1) % PAL.length] + '" data-when="' + E(w) + '" aria-pressed="false">' + E(w) + '</button>').join('') + '</div></div>' : '') +
          '<label class="fl"><span>تفاصيل شغلك</span><textarea name="ms" dir="rtl" rows="4" maxlength="1200" placeholder="' + E(CF.msgPlaceholder || 'احكيلي عن الشغل: المطلوب، الميعاد، أي تفاصيل تفيد') + '"></textarea></label>' +
          '<div class="pv"><span>الرسالة اللي هتتبعت</span><p id="pv" class="empty" dir="auto">رسالتك هتظهر هنا وانت بتكتب.</p></div><div class="cf-b">' + (wa ? '<button type="button" class="btn primary" data-send="wa" data-to="' + wa + '">' + E(CF.waBtn || 'ابعت على واتساب') + ' ' + ic('arrowL') + '</button>' : '') + (C.email ? '<button type="button" class="btn ghost" data-send="mail" data-to="' + E(C.email) + '">' + E(CF.mailBtn || 'ابعت بالإيميل') + '</button>' : '') + '</div></form>') : '') +
          '<div class="ct-s">' +
          (H.available && H.availableText ? '<div class="cc av"><span class="pulse"></span><div><b>متاح دلوقتي</b><span>' + E(H.availableText) + '</span></div></div>' : '') +
          (wa ? '<a class="cc" style="--c:140,170,110" href="https://wa.me/' + wa + '" target="_blank" rel="noopener noreferrer"><div><b>واتساب</b><span class="ltr">+' + wa + '</span></div>' + ic('ext') + '</a>' : '') +
          (C.email ? '<div class="cc" style="--c:212,166,74"><a href="mailto:' + E(C.email) + '"><b>الإيميل</b><span class="ltr">' + E(C.email) + '</span></a><button type="button" class="cp" data-copy="' + E(C.email) + '">نسخ</button></div>' : '') +
          '</div></div>' + (C.socials.length ? '<div class="soc">' + C.socials.filter(s => s && s.url).map(s => '<a href="' + E(link(s.url)) + '" target="_blank" rel="noopener noreferrer">' + E(s.name || s.url) + ' ' + ic('ext') + '</a>').join('') + '</div>' : '') +
        '</div></div></section>');
    }

    const mord = ['#work', '#services', '#about', '#contact']; menu.sort((x, y) => mord.indexOf(x[0]) - mord.indexOf(y[0]));
    const nav = '<header class="nav" id="nav"><div class="wrap nav-in"><a class="brand" href="#top" aria-label="الرئيسية"><b>' + E((H.name || 'ع').trim().charAt(0)) + '</b><span>' + E(H.name) + '</span></a>' +
      '<nav class="menu" id="menu" aria-label="القائمة">' + menu.map(m => '<a href="' + m[0] + '">' + m[1] + '</a>').join('') + '</nav>' +
      (D.theme.toggle === false ? '' : '<button type="button" class="ib" data-act="mode" aria-label="تبديل الوضع الليلي/النهاري">' + ic(root.dataset.mode === 'light' ? 'moon' : 'sun') + '</button>') +
      '<button type="button" class="ib burger" data-act="menu" aria-label="القائمة" aria-expanded="false">' + ic('menu') + '</button></div></header>';

    const photo = img(H.photo), ps = ['card', 'arch', 'round'].indexOf(H.photoStyle) > -1 ? H.photoStyle : 'card';
    /* الاسم في سطر واحد، وتحته خط بالقلم بيترسم (روح السبورة البيضاء) */
    const l1 = String(H.name || '').trim(), l2 = '';
    const pen = '<svg class="pen" viewBox="0 0 400 30" preserveAspectRatio="none" aria-hidden="true"><path pathLength="1" d="M3 15H397"/></svg>';
    const nameHtml = l2 ? '<span class="nl">' + E(l1) + '</span><span class="nl">' + E(l2) + pen + '</span>' : '<span class="nl">' + E(l1) + pen + '</span>';
    const eyebrow = E(H.eyebrow).replace(/\s*[·•|]\s*/g, '، ');
    const fx = [[P.length, 'أعمال'], [D.categories.length, 'مجالات'], [skills.length, 'أدوات']].filter(x => x[0] > 0);
    const facts = fx.length ? '<div class="hero-facts rv" style="--d:.34s">' + fx.map(x => '<div><b data-n="' + x[0] + '">0</b><span>' + x[1] + '</span></div>').join('') + '</div>' : '';
    const hero = '<section class="hero" id="top"><span class="hero-glow" aria-hidden="true"></span><div class="wrap hero-in"><div class="hero-tx">' +
      (H.eyebrow ? '<p class="eyebrow rv">' + eyebrow + '</p>' : '') +
      '<h1 class="name rv" style="--d:.08s" aria-label="' + E(H.name) + '">' + nameHtml + '</h1>' +
      (H.sub ? '<p class="sub rv" style="--d:.16s">' + E(ar(H.sub)) + '</p>' : '') +
      '<div class="cta rv" style="--d:.24s">' +
      (H.cta1Text ? '<a class="btn primary" href="' + E(link(H.cta1Link)) + '">' + E(H.cta1Text) + ' ' + ic('arrowL') + '</a>' : '') +
      (H.cta2Text ? '<a class="btn ghost" href="' + E(link(H.cta2Link)) + '">' + E(H.cta2Text) + '</a>' : '') + '</div>' +
      (H.available && H.availableText ? '<p class="avail rv" style="--d:.3s"><span class="pulse"></span>' + E(H.availableText) + '</p>' : '') +
      '</div><figure class="hero-ph rv" data-ps="' + ps + '" style="--d:.2s"><div class="arch"' + (photo ? ' data-lb="' + E(photo) + '" title="تكبير الصورة"' : '') + '>' +
      (photo ? '<img src="' + E(photo) + '" alt="' + E(H.name) + '" fetchpriority="high" decoding="async">' : '<div class="mono" aria-hidden="true">' + E((H.name || 'ع').trim().charAt(0)) + '</div>') +
      '</div>' + (photo && H.badges !== false ? D.categories.slice(0, 4).map((c, i) => '<span class="fb fb' + i + '" style="--c:' + rgbOf(c, i) + '" aria-hidden="true">' + ic(c.icon) + E(c.name) + '</span>').join('') : '') + '</figure>' + facts + '</div></section>';

    let base = []; while (skills.length && base.length < 8) base = base.concat(skills);
    const mk = k => base.map(s => '<span' + (k ? ' class="dup"' : '') + '>' + E(s) + '</span><i' + (k ? ' class="dup"' : '') + '></i>').join('');
    const marq = skills.length ? '<div class="marq" aria-hidden="true"><div class="mt">' + mk(0) + mk(1) + '</div></div>' : '';

    const foot = '<footer class="f"><div class="wrap"><span>' + E(D.footer || '') + '</span><a class="up" href="#top">للأعلى ' + ic('arrowUp') + '</a></div></footer>';

    const ord = ['work', 'services', 'about', 'contact'], idOf = h => { const m = /id="(\w+)"/.exec(h); return m ? ord.indexOf(m[1]) : -1; };
    sections.sort((x, y) => idOf(x) - idOf(y));
    app.innerHTML = nav + '<main id="main">' + hero + sections.join('') + '</main>' + foot;
    onScroll(); reveal(); life();
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
  d.addEventListener('pointermove', e => {
    const c = e.target.closest && e.target.closest('.card'); if (!c) return;
    const r = c.getBoundingClientRect();
    c.style.setProperty('--mx', (e.clientX - r.left) + 'px'); c.style.setProperty('--my', (e.clientY - r.top) + 'px');
  }, { passive: true });

  /* ---------- حياة وتفاعل ---------- */
  let sio = null;
  function life() {
    d.querySelectorAll('.hero-facts b[data-n]').forEach(b => {
      const n = +b.dataset.n;
      if (RM || !('IntersectionObserver' in window)) { b.textContent = n; return; }
      const o = new IntersectionObserver(es => {
        if (!es[0].isIntersecting) return; o.disconnect();
        const t0 = performance.now() + 450;
        const tick = t => { const k = Math.max(0, Math.min(1, (t - t0) / 1100)); b.textContent = Math.round(n * (1 - Math.pow(1 - k, 3))); if (k < 1) requestAnimationFrame(tick); };
        requestAnimationFrame(tick);
      }, { threshold: .6 });
      o.observe(b);
    });
    if (sio) sio.disconnect();
    if ('IntersectionObserver' in window) {
      sio = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) d.querySelectorAll('.menu a').forEach(a => a.classList.toggle('on', a.getAttribute('href') === '#' + e.target.id)); }), { rootMargin: '-45% 0px -50% 0px' });
      d.querySelectorAll('main section[id]').forEach(x => sio.observe(x));
    }
  }
  const prog = d.createElement('div'); prog.className = 'prog'; prog.setAttribute('aria-hidden', 'true'); d.body.appendChild(prog);
  addEventListener('scroll', () => { const h = root.scrollHeight - innerHeight; prog.style.setProperty('--p', h > 0 ? Math.min(1, scrollY / h).toFixed(4) : 0); }, { passive: true });
  if (!RM) {
    d.addEventListener('pointermove', e => {
      if (e.pointerType === 'touch') return;
      const hero = d.querySelector('.hero');
      if (hero && scrollY < innerHeight) {
        const r = hero.getBoundingClientRect(); hero.classList.add('hot');
        hero.style.setProperty('--gx', (e.clientX - r.left) + 'px'); hero.style.setProperty('--gy', (e.clientY - r.top) + 'px');
        hero.style.setProperty('--nx', (e.clientX / innerWidth - .5).toFixed(3)); hero.style.setProperty('--ny', (e.clientY / innerHeight - .5).toFixed(3));
      }
      const m = e.target.closest && e.target.closest('.btn.primary');
      if (m) { const r = m.getBoundingClientRect(); m.style.translate = ((e.clientX - r.left - r.width / 2) * .16).toFixed(1) + 'px ' + ((e.clientY - r.top - r.height / 2) * .28).toFixed(1) + 'px'; }
      const t = e.target.closest && e.target.closest('.svc button');
      if (t) {
        const r = t.getBoundingClientRect(), x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
        t.style.setProperty('--mx', (x * 100).toFixed(1) + '%'); t.style.setProperty('--my', (y * 100).toFixed(1) + '%');
        t.style.setProperty('--rx', ((.5 - y) * 9).toFixed(2) + 'deg'); t.style.setProperty('--ry', ((x - .5) * 9).toFixed(2) + 'deg');
      }
    }, { passive: true });
    d.addEventListener('pointerout', e => {
      const m = e.target.closest && e.target.closest('.btn.primary');
      if (m && !m.contains(e.relatedTarget)) m.style.translate = '';
      const t = e.target.closest && e.target.closest('.svc button');
      if (t && !t.contains(e.relatedTarget)) { t.style.removeProperty('--rx'); t.style.removeProperty('--ry'); }
    });
  }

  const top = d.createElement('a'); top.className = 'topb'; top.href = '#top'; top.setAttribute('aria-label', 'للأعلى'); top.innerHTML = ic('arrowUp'); d.body.appendChild(top);
  addEventListener('scroll', () => top.classList.toggle('show', scrollY > 700), { passive: true });
  let tt = null;
  function toast(msg) {
    let t = d.querySelector('.toast'); if (!t) { t = d.createElement('div'); t.className = 'toast'; t.setAttribute('role', 'status'); d.body.appendChild(t); }
    t.textContent = msg; t.classList.add('show'); clearTimeout(tt); tt = setTimeout(() => t.classList.remove('show'), 2200);
  }
  d.addEventListener('click', e => {
    const c = e.target.closest && e.target.closest('[data-copy]'); if (!c) return;
    const v = c.dataset.copy;
    const ok = () => toast('اتنسخ الإيميل ✓'), no = () => toast('مقدرتش أنسخ، انسخه بإيدك');
    if (navigator.clipboard) navigator.clipboard.writeText(v).then(ok, no); else no();
  });

  d.addEventListener('submit', e => e.preventDefault());
  d.addEventListener('input', e => { const t = e.target; if (!t.closest || !t.closest('.cf')) return; const m = t.value.match(/[A-Za-z\u0590-\u08FF]/); t.dir = m && /[A-Za-z]/.test(m[0]) ? 'ltr' : 'rtl'; });
  function compose() {
    const f = d.getElementById('cf'); if (!f) return '';
    const nm = f.elements.nm.value.trim(), ms = f.elements.ms.value.trim();
    const sv = d.querySelector('[data-svc][aria-pressed=true]'), wn = d.querySelector('[data-when][aria-pressed=true]');
    const L = [(f.dataset.g || 'أهلاً') + (nm ? '، أنا ' + nm : '') + '.'];
    if (sv) L.push('محتاج: ' + sv.dataset.svc);
    if (wn) L.push('الميعاد: ' + wn.dataset.when);
    if (ms) L.push('', ms);
    return L.join('\n');
  }
  function pv() {
    const o = d.getElementById('pv'), f = d.getElementById('cf'); if (!o || !f) return;
    const has = f.elements.ms.value.trim() || f.elements.nm.value.trim() || d.querySelector('[data-svc][aria-pressed=true],[data-when][aria-pressed=true]');
    o.textContent = has ? compose() : 'رسالتك هتظهر هنا وانت بتكتب.'; o.classList.toggle('empty', !has);
  }
  d.addEventListener('input', e => { if (e.target.closest && e.target.closest('.cf')) pv(); });
  d.addEventListener('click', e => {
    const g = e.target.closest && e.target.closest('[data-svc],[data-when]');
    if (g) {
      const k = g.hasAttribute('data-svc') ? 'data-svc' : 'data-when', on = g.getAttribute('aria-pressed') === 'true';
      d.querySelectorAll('[' + k + ']').forEach(b => b.setAttribute('aria-pressed', 'false')); g.setAttribute('aria-pressed', String(!on)); pv(); return;
    }
    const sd = e.target.closest && e.target.closest('[data-send]'); if (!sd) return;
    const f = d.getElementById('cf'); if (!f) return;
    if (!f.elements.ms.value.trim()) { f.classList.remove('shake'); void f.offsetWidth; f.classList.add('shake'); f.elements.ms.focus(); toast('اكتب تفاصيل شغلك الأول'); return; }
    const txt = compose(), sv = d.querySelector('[data-svc][aria-pressed=true]');
    if (sd.dataset.send === 'wa') window.open('https://wa.me/' + sd.dataset.to + '?text=' + encodeURIComponent(txt), '_blank', 'noopener');
    else location.href = 'mailto:' + sd.dataset.to + '?subject=' + encodeURIComponent('طلب شغل' + (sv ? ' - ' + sv.dataset.svc : '')) + '&body=' + encodeURIComponent(txt);
    toast('اتجهّزت الرسالة ✓');
  });

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
    if (c) { if (!PREVIEW) location.href = 'works.html#c-' + encodeURIComponent(c.dataset.cat); return; }
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
    if (t && t.tagName === 'IMG' && t.closest('.media')) { const m = t.parentNode; t.remove(); const pr = D.projects.find(p => imgsOf(p)[0] === t.getAttribute('src')); if (!m.querySelector('.ph')) m.insertAdjacentHTML('afterbegin', '<div class="ph">' + ic(pr ? catOf(pr.category).icon : 'image') + '</div>'); }
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
