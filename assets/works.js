/* صفحة الأعمال — بتقرأ نفس data/site.js اللي بتعدّله من لوحة التحكم. مفيش حاجة هنا محتاجة تتعدل بإيدك */
(function () {
  'use strict';
  const d = document, root = d.documentElement, app = d.getElementById('app');
  const ic = window.icon;
  const E = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const link = u => { u = String(u || '').trim(); return /^(https?:\/\/|mailto:|tel:|#)/i.test(u) ? u : '#'; };
  const img = u => { u = String(u || '').trim(); return /^(https?:\/\/|data:image\/|images\/|assets\/)/i.test(u) ? u : ''; };
  const pad = n => String(n).padStart(2, '0');
  /* كل صور العمل: لو فيه images[] بنستخدمها، ولو لأ بنرجع للصورة الواحدة القديمة (image) */
  const imgsOf = p => {
    let a = Array.isArray(p.images) ? p.images.map(img).filter(Boolean) : [];
    if (!a.length) { const s = img(p.image); if (s) a = [s]; }
    return a;
  };
  const LBW = { wkEyebrow: 'معرض الأعمال', wkTitle: 'أعمالي', wkSub: 'كل شغلي في مكان واحد. اختار القسم، واضغط على أي عمل تشوفه بالحجم الكامل.', wkNavHome: 'الرئيسية', wkNavWorks: 'الأعمال', wkNavContact: 'تواصل', wkGoImg: 'شوف العمل', wkGoGal: 'تصفّح الصور', wkGoVid: 'شاهد', wkGoApp: 'تفاصيل التطبيق', wkEmpty: 'لسه مفيش أعمال في القسم ده.', wkOpenOrig: 'افتح المشروع الأصلي', wkPlayVid: 'شغّل الفيديو', wkOpenLink: 'افتح الرابط', wkOpenProj: 'افتح المشروع', wkSeeShots: 'شوف اللقطات', wkWatchApp: 'شاهد فيديو التطبيق', wkVidBadge: 'فيديو', filterAll: 'الكل', wkMore: 'أعمال تانية', wkFeat: 'عمل مميّز', wkCopy: 'نسخ الرابط', wkCopied: 'اتنسخ ✓', wkEmptyT: 'بجهّز أعمالي الجديدة', wkEmptyD: 'الأعمال هتتضاف هنا قريبًا. لو عندك مشروع في بالك، كلمني ونتفق على التفاصيل.' };
  const T = k => { const v = D && D.labels && D.labels[k]; return v != null && String(v).trim() !== '' ? String(v).trim() : LBW[k]; };
  let D = null, cur = 'all', view = 'grid', io = null, q = '', sortBy = 'manual';
  let vw = null, vwList = [], vwCur = null, vwI = 0, vwSheet = false, vwPush = false, vwFocus = null, zoomed = false, swiped = false, vwVid = false;
  try { const v = localStorage.getItem('sx.wview'); if (v === 'grid' || v === 'big' || v === 'list') view = v; } catch (e) {}

  /* ---------- theme (نفس منطق الصفحة الرئيسية) ---------- */
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
    const rgb = h2r(acc), s = root.style;
    s.setProperty('--accent', acc);
    s.setProperty('--accent2', hex(m === 'light' ? mix(rgb, [0, 0, 0], .42) : mix(rgb, [255, 255, 255], .35)));
    s.setProperty('--accent-rgb', rgb.join(','));
    const tc = d.querySelector('meta[name=theme-color]');
    if (tc) tc.content = m === 'light' ? '#FAF7F0' : '#0B0A08';
  }

  /* لو الوضع "حسب جهاز الزائر" ومحدّش اختار بإيده: تابع تغيير إعداد الجهاز لحظيًا */
  try {
    matchMedia('(prefers-color-scheme: light)').addEventListener('change', () => {
      let sv = null; try { sv = localStorage.getItem('sx.mode'); } catch (e) {}
      if (sv === 'dark' || sv === 'light' || !D || !D.theme || D.theme.mode !== 'auto') return;
      theme(); const b = d.querySelector('[data-act=mode]'); if (b) b.innerHTML = ic(root.dataset.mode === 'light' ? 'moon' : 'sun');
    });
  } catch (e) {}

  /* ---------- data ---------- */
  function norm(x) {
    x = x || {};
    x.meta = x.meta || {}; x.theme = x.theme || {}; x.hero = x.hero || {};
    ['categories', 'projects'].forEach(k => { x[k] = Array.isArray(x[k]) ? x[k] : []; });
    x.projects.forEach((p, k) => { if (p && !p.id) p.id = 'x' + k; });
    return x;
  }
  const catOf = id => D.categories.find(c => c.id === id) || { name: '', icon: 'star', type: 'image' };
  const shown = () => D.projects.filter(p => p.visible !== false);
  const hay = p => [p.title, p.tag, p.client, p.year, p.desc, (Array.isArray(p.tools) ? p.tools.join(' ') : '')].join(' ').toLowerCase();
  const yr = p => { const y = parseInt(p && p.year, 10); return isNaN(y) ? null : y; };
  const sorted = a => { if (sortBy === 'manual') return a; const dir = sortBy === 'new' ? -1 : 1; return a.map((p, i) => [p, i]).sort((x, y) => { const m = yr(x[0]), n = yr(y[0]); if (m === n) return x[1] - y[1]; if (m === null) return 1; if (n === null) return -1; return (m - n) * dir; }).map(x => x[0]); };
  const list = () => { const k = q.trim().toLowerCase(); return sorted(shown().filter(p => (cur === 'all' || p.category === cur) && (!k || hay(p).includes(k)))); };
  /* الأعمال المميّزة بتظهر في بطاقة كبيرة فوق الشبكة (في عرض "الكل" ومن غير بحث) */
  const spots = () => { if (cur !== 'all' || q.trim()) return []; const f = shown().filter(p => p.featured).slice(0, 2); return f.length && shown().length > f.length ? f : []; };
  function embed(u) {
    u = String(u || '');
    let m = /(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/.exec(u);
    if (m) return 'https://www.youtube-nocookie.com/embed/' + m[1] + '?rel=0';
    m = /vimeo\.com\/(?:video\/)?(\d+)/.exec(u);
    return m ? 'https://player.vimeo.com/video/' + m[1] : '';
  }

  /* ---------- tiles ---------- */

  /* ---------- عرض التطبيقات: موكب موبايل بلقطات الشاشة ---------- */
  const isApp = (p, c) => !!(p && p.layout === 'app') || !!(c && c.layout === 'app');
  const phones = (all, c, title) => {
    const pics = all.slice(0, 3), cls = pics.length === 1 ? ['c'] : pics.length === 2 ? ['l', 'r'] : ['l', 'c', 'r'];
    const order = pics.length === 3 ? [pics[1], pics[0], pics[2]] : pics;
    return '<span class="phs n' + Math.max(1, pics.length) + '">' + (pics.length ? order.map((u, i) => '<span class="phn ' + cls[i] + '"><img loading="lazy" decoding="async" src="' + E(u) + '" alt="' + E(title) + '"></span>').join('') : '<span class="phn c"><span class="ps"><b dir="auto">' + E(String(title || '').split('|')[0].trim().slice(0, 14)) + '</b><i></i><i></i><i></i></span></span>') + '</span>';
  };
  const metaOf = p => { const a = [p && p.client, p && p.year].map(x => String(x == null ? '' : x).trim()).filter(Boolean); return a.length ? '<div class="wm" dir="auto">' + a.map(x => '<span>' + E(x) + '</span>').join('') + '</div>' : ''; };
  const chips = p => Array.isArray(p.tools) && p.tools.length ? '<ul class="tl" aria-label="الأدوات">' + p.tools.slice(0, 5).map(t => '<li>' + E(t) + '</li>').join('') + '</ul>' : '';
  /* فيديو العمل: يوتيوب / فيميو / ملف mp4 */
  const vOf = p => { const u = String((p && p.video) || '').trim(); if (!u) return null; let m = /(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/.exec(u); if (m) return { e: 'https://www.youtube-nocookie.com/embed/' + m[1] + '?rel=0' }; m = /vimeo\.com\/(?:video\/)?(\d+)/.exec(u); if (m) return { e: 'https://player.vimeo.com/video/' + m[1] }; return /^(https?:\/\/|videos\/|blob:)/i.test(u) ? { f: u } : null; };
  const player = (p, poster) => { const v = vOf(p); if (!v) return ''; return v.e ? '<iframe src="' + E(v.e) + '" title="' + E(p.title) + '" loading="lazy" allowfullscreen allow="autoplay; encrypted-media; picture-in-picture; fullscreen"></iframe>' : '<video src="' + E(v.f) + '" controls playsinline preload="metadata"' + (poster ? ' poster="' + E(poster) + '"' : '') + '></video>'; };

  function tile(p, i) {
    const c = catOf(p.category), all = imgsOf(p), src = all[0], n = all.length;
    const app = isApp(p, c);
    return '<button type="button" class="wk-t' + (app ? ' is-app' : '') + '" data-w="' + E(p.id) + '" aria-label="' + E(p.title) + (n > 1 ? ' — ' + n + ' صور' : '') + '">' +
      '<span class="wk-m' + (app ? ' app' : src ? '' : ' ld') + '">' + (app ? phones(all, c, p.title) : src ? '<img loading="lazy" decoding="async" src="' + E(src) + '" alt="' + E(p.title) + '">' : '<span class="ph">' + ic(c.icon) + '</span>') +
      (c.type === 'video' ? '<span class="pl"><span>' + ic('play') + '</span></span>' : '') +
      (vOf(p) ? '<span class="vd-b">' + ic('play') + ' ' + E(T('wkVidBadge')) + '</span>' : '') +
      (!app && c.type !== 'video' && n > 1 ? '<span class="wk-k">' + ic('layers') + '<b>' + n + '</b> صور</span>' : '') + '</span>' +
      '<span class="wk-n">' + pad(i + 1) + '</span>' +
      '<span class="wk-o">' + (p.tag ? '<span class="tg">' + E(p.tag) + '</span>' : '') + '<strong dir="auto">' + E(p.title) + '</strong>' + metaOf(p) +
      (p.desc ? '<small>' + E(p.desc) + '</small>' : '') + chips(p) + '<em>' + E(app ? T('wkGoApp') : c.type === 'video' ? T('wkGoVid') : n > 1 ? T('wkGoGal') : T('wkGoImg')) + ' ' + ic('arrowL') + '</em></span></button>';
  }
  function spot(p) {
    const c = catOf(p.category), all = imgsOf(p), src = all[0], app = isApp(p, c);
    return '<button type="button" class="wk-sp" data-w="' + E(p.id) + '" aria-label="' + E(p.title) + '"><span class="wk-m' + (app ? ' app' : src ? '' : ' ld') + '">' +
      (app ? phones(all, c, p.title) : src ? '<img loading="lazy" decoding="async" src="' + E(src) + '" alt="' + E(p.title) + '">' : '<span class="ph">' + ic(c.icon) + '</span>') +
      (c.type === 'video' ? '<span class="pl"><span>' + ic('play') + '</span></span>' : '') +
      (vOf(p) ? '<span class="vd-b">' + ic('play') + ' ' + E(T('wkVidBadge')) + '</span>' : '') + '</span>' +
      '<span class="wk-sp-b"><span class="wk-sp-k">' + ic('star') + ' ' + E(T('wkFeat')) + '</span>' + (p.tag ? '<span class="tg">' + E(p.tag) + '</span>' : '') +
      '<strong dir="auto">' + E(p.title) + '</strong>' + metaOf(p) + (p.desc ? '<small>' + E(p.desc) + '</small>' : '') + chips(p) +
      '<em>' + E(app ? T('wkGoApp') : c.type === 'video' ? T('wkGoVid') : all.length > 1 ? T('wkGoGal') : T('wkGoImg')) + ' ' + ic('arrowL') + '</em></span></button>';
  }
  function fit(im) {
    if (!im || !im.naturalWidth) return;
    const m = im.closest('.wk-m'); if (!m || m.classList.contains('app') || m.closest('.wk-sp')) return;
    const r = im.naturalWidth / im.naturalHeight;
    m.style.aspectRatio = String(Math.min(Math.max(r, view === 'big' ? .9 : .62), 2));
  }
  function observe() {
    const els = [].slice.call(d.querySelectorAll('.wk-t'));
    if (io) io.disconnect();
    if (!('IntersectionObserver' in window)) { els.forEach(e => e.classList.add('in')); return; }
    io = new IntersectionObserver(es => {
      let k = 0;
      es.forEach(e => { if (e.isIntersecting) { e.target.style.transitionDelay = (k++ * 70) + 'ms'; e.target.classList.add('in'); io.unobserve(e.target); } });
    }, { rootMargin: '0px 0px -5% 0px', threshold: .05 });
    els.forEach(e => io.observe(e));
  }
  function paint() {
    const g = d.getElementById('wg'); if (!g) return;
    const sp = spots(), L = list().filter(p => sp.indexOf(p) < 0);
    const sw = d.getElementById('wsp'); if (sw) sw.innerHTML = sp.map(spot).join('');
    g.dataset.view = view;
    g.innerHTML = L.length ? L.map(tile).join('') : sp.length ? '' : '<div class="empty">' + E(T('wkEmpty')) + '</div>';
    g.querySelectorAll('.wk-m img').forEach(fit);
    observe();
  }
  function moveInd(scroll) {
    const fl = d.getElementById('fl'), fi = d.getElementById('fi'); if (!fl || !fi) return;
    const b = fl.querySelector('[aria-pressed="true"]'); if (!b) return;
    fi.style.width = b.offsetWidth + 'px'; fi.style.transform = 'translateX(' + b.offsetLeft + 'px)';
    requestAnimationFrame(() => fi.classList.add('r'));
    if (scroll && b.scrollIntoView) b.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
  }
  function setFilter(id, scroll) {
    cur = id; paint();
    d.querySelectorAll('[data-f]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.f === id)));
    moveInd(scroll !== false);
  }
  function setView(v) {
    view = v; try { localStorage.setItem('sx.wview', v); } catch (e) {}
    d.querySelectorAll('[data-v]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.v === v)));
    paint();
  }

  /* ---------- page ---------- */
  function build() {
    const H = D.hero, P = shown();
    const cats = D.categories.filter(c => P.some(p => p.category === c.id));
    if (cur !== 'all' && !cats.some(c => c.id === cur)) cur = 'all';
    const name = H.name || '';
    const nav = '<header class="nav" id="nav"><div class="wrap nav-in"><a class="brand" href="index.html" aria-label="الرئيسية"><b>' + E((name || 'ع').trim().charAt(0)) + '</b><span>' + E(name) + '</span></a>' +
      '<nav class="menu" id="menu" aria-label="القائمة"><a href="index.html">' + E(T('wkNavHome')) + '</a><a href="#top" class="on">' + E(T('wkNavWorks')) + '</a><a href="index.html#contact">' + E(T('wkNavContact')) + '</a></nav>' +
      (D.theme.toggle === false ? '' : '<button type="button" class="ib" data-act="mode" aria-label="تبديل الوضع الليلي/النهاري">' + ic(root.dataset.mode === 'light' ? 'moon' : 'sun') + '</button>') +
      '<button type="button" class="ib burger" data-act="menu" aria-label="القائمة" aria-expanded="false">' + ic('menu') + '</button></div></header>';
    const hero = '<section class="wk-hero" id="top"><span class="wk-rings" aria-hidden="true"><svg viewBox="0 0 800 800" fill="none" stroke="currentColor" focusable="false"><circle cx="400" cy="400" r="110" opacity=".5"/><circle cx="400" cy="400" r="190" opacity=".34"/><circle class="dash" cx="400" cy="400" r="250" stroke-width="2.4" stroke-linecap="round" stroke-dasharray="1 11" opacity=".6"/><circle cx="400" cy="400" r="310" opacity=".22"/><circle cx="400" cy="400" r="380" opacity=".14"/><circle cx="522" cy="255" r="5" fill="currentColor" stroke="none" opacity=".85"/><circle cx="132" cy="555" r="3.5" fill="currentColor" stroke="none" opacity=".7"/><circle cx="757" cy="530" r="9" opacity=".6"/></svg></span><div class="wrap"><p class="eyebrow wa" style="--d:.05s">' + E(T('wkEyebrow')) + '</p>' +
      '<h1 class="wk-h wa" style="--d:.12s"><span class="g">' + E(T('wkTitle')) + '</span>' + (P.length ? '<b class="wk-c" aria-label="' + P.length + ' عمل">' + pad(P.length) + '</b>' : '') + '</h1>' +
      '<p class="wk-s wa" style="--d:.2s">' + E(T('wkSub')) + '</p></div></section>';
    const bar = P.length ? '<div class="wk-bar"><div class="wrap wk-bar-in">' +
      (cats.length > 1 ? '<div class="wk-f" id="fl" role="group" aria-label="فلترة الأعمال"><span class="fi" id="fi"></span><button type="button" data-f="all" aria-pressed="' + (cur === 'all') + '">' + E(T('filterAll')) + ' <small>' + P.length + '</small></button>' +
        cats.map(c => '<button type="button" data-f="' + E(c.id) + '" aria-pressed="' + (cur === c.id) + '">' + E(c.name) + ' <small>' + P.filter(p => p.category === c.id).length + '</small></button>').join('') + '</div>' : '<span></span>') +
      '<div class="wk-r">' + (P.filter(p => yr(p) !== null).length > 1 ? '<select class="wk-s" id="ws" aria-label="ترتيب الأعمال"><option value="manual"' + (sortBy === 'manual' ? ' selected' : '') + '>الترتيب الأصلي</option><option value="new"' + (sortBy === 'new' ? ' selected' : '') + '>الأحدث أولًا</option><option value="old"' + (sortBy === 'old' ? ' selected' : '') + '>الأقدم أولًا</option></select>' : '') + (P.length > 5 ? '<label class="wk-q">' + ic('search') + '<input type="search" id="wq" placeholder="ابحث في الأعمال…" aria-label="ابحث في الأعمال" autocomplete="off" value="' + E(q) + '"></label>' : '') + '<div class="wk-v" role="group" aria-label="طريقة العرض"><button type="button" data-v="grid" aria-pressed="' + (view === 'grid') + '" aria-label="عرض شبكة" title="شبكة">' + ic('grid') + '</button><button type="button" data-v="list" aria-pressed="' + (view === 'list') + '" aria-label="عرض قائمة" title="قائمة">' + ic('menu') + '</button><button type="button" data-v="big" aria-label="عرض كبير" title="عرض كبير">' + ic('monitor') + '</button></div></div></div></div>' : '';
    const grid = P.length ? '<section class="wk-sec"><div class="wrap"><div class="wk-spw" id="wsp"></div><div class="wk-grid" id="wg" data-view="' + view + '"></div></div></section>'
      : '<section class="wk-sec"><div class="wrap"><div class="wk-empty"><span class="wk-ei">' + ic('layers') + '</span><h2>' + E(T('wkEmptyT')) + '</h2><p>' + E(T('wkEmptyD')) + '</p><a class="btn primary" href="index.html#contact">' + E(T('wkNavContact')) + ' ' + ic('arrowL') + '</a></div></div></section>';
    const foot = '<footer class="f"><div class="wrap"><span>' + E(D.footer || '') + '</span><a class="up" href="index.html">' + E(T('wkNavHome')) + ' ' + ic('arrowL') + '</a></div></footer>';
    app.innerHTML = nav + '<main id="main">' + hero + bar + grid + '</main>' + foot;
    const vb = d.querySelector('[data-v="big"]'); if (vb) vb.setAttribute('aria-pressed', String(view === 'big'));
    paint(); moveInd(false); onScroll();
    if (d.fonts && d.fonts.ready) d.fonts.ready.then(() => moveInd(false));
  }
  function onScroll() { const n = d.getElementById('nav'); if (n) n.classList.toggle('stuck', scrollY > 24); }
  addEventListener('scroll', onScroll, { passive: true });
  addEventListener('resize', () => moveInd(false));

  /* ---------- العارض: كتالوج العمل (كل صور العمل) + تنقل بين الأعمال ---------- */
  function parts(p, i, n) {
    const c = catOf(p.category), href = link(p.link), em = c.type === 'video' ? embed(href) : '';
    const pics = em ? [] : imgsOf(p), k = Math.min(vwI, Math.max(0, pics.length - 1)), src = pics[k];
    const vd = vOf(p), vApp = isApp(p, c) && vd && vwVid, fig = vApp ? '<div class="vw-v' + (vd.f ? ' file' : '') + '">' + player(p, imgsOf(p)[0]) + '</div>' : em ? '<div class="vw-v"><iframe src="' + E(em) + '" title="' + E(p.title) + '" allowfullscreen allow="autoplay; encrypted-media; picture-in-picture; fullscreen"></iframe></div>'
      : src ? '<img src="' + E(src) + '" alt="' + E(p.title) + (pics.length > 1 ? ' — ' + (k + 1) : '') + '" draggable="false">' : '<div class="vw-ph">' + ic(c.icon) + '</div>';
    const app = isApp(p, c), lks = (Array.isArray(p.links) ? p.links : []).filter(x => x && x.url && link(x.url) !== '#');
    const ft = (Array.isArray(p.features) ? p.features : []).filter(Boolean);
    const appGo = app ? (lks.length ? lks : (href !== '#' ? [{ label: T('wkOpenProj'), url: href }] : [])).map((x, j) => '<a class="btn' + (j ? '' : ' primary') + ' vw-go" href="' + E(link(x.url)) + '" target="_blank" rel="noopener noreferrer">' + E(x.label || T('wkOpenLink')) + ' ' + ic('ext') + '</a>').join('') : '';
    const pgSg = window.SLUGS && window.SLUGS[p.id], pg = /^[a-z0-9-]+$/.test(pgSg || '') ? '<a class="btn ghost vw-go" href="work/' + pgSg + '/">صفحة العمل ' + ic('arrowL') + '</a>' : '';
    const go = app ? appGo : (c.type === 'video' && !em && href !== '#') ? '<a class="btn primary vw-go" href="' + E(href) + '" target="_blank" rel="noopener noreferrer">' + E(T('wkPlayVid')) + ' ' + ic('ext') + '</a>'
      : (c.type !== 'video' && href !== '#') ? '<a class="btn vw-go" href="' + E(href) + '" target="_blank" rel="noopener noreferrer">' + E(T('wkOpenOrig')) + ' ' + ic('ext') + '</a>' : '';
    return {
      cnt: pad(i + 1) + ' / ' + pad(n),
      cat: ic(c.icon) + ' ' + E(c.name),
      fig: fig, emb: !!em || !!vApp, pics: pics, k: k,
      info: (p.tag ? '<span class="tg">' + E(p.tag) + '</span>' : '') + '<h2 dir="auto">' + E(p.title) + '</h2>' + metaOf(p) + (p.status ? '<span class="pj-st">' + E(p.status) + '</span>' : '') + (p.desc ? '<p>' + E(p.desc) + '</p>' : '') + (app ? chips(p) : '') + (app && ft.length ? '<ul class="ft">' + ft.map(f => '<li>' + ic('check') + '<span dir="auto">' + E(f) + '</span></li>').join('') + '</ul>' : '') + (app && vd ? '<button type="button" class="btn ghost vw-vt" data-vvid>' + ic('play') + ' ' + E(vwVid ? T('wkSeeShots') : T('wkWatchApp')) + '</button>' : '') + go + pg + (function () {
        const o = []; for (let k = 1; k < n && o.length < 4; k++) o.push(vwList[(i + k) % n]);
        return o.length ? '<div class="vw-rel"><span>' + E(T('wkMore')) + '</span><div>' + o.map(x => { const im = imgsOf(x)[0]; return '<button type="button" data-vrel="' + E(x.id) + '" aria-label="' + E(x.title) + '" title="' + E(x.title) + '">' + (im ? '<img loading="lazy" decoding="async" src="' + E(im) + '" alt="">' : ic(catOf(x.category).icon)) + '</button>'; }).join('') + '</div></div>' : '';
      })() + (window.RV ? RV.html(p) : '')
    };
  }
  function vwOpen(id, k) {
    let L = list(), i = L.findIndex(p => p.id === id);
    if (i < 0) { L = shown(); i = L.findIndex(p => p.id === id); }
    if (i < 0) return;
    const same = !!vw && id === vwCur;
    vwList = L; vwCur = id; zoomed = false;
    if (!same) { vwI = k || 0; vwSheet = false; vwVid = false; } else if (k != null) vwI = k;
    if (!vw) {
      vw = d.createElement('div'); vw.className = 'vw'; vw.setAttribute('role', 'dialog'); vw.setAttribute('aria-modal', 'true');
      vw.innerHTML = '<div class="vw-top"><span class="vw-cnt" title="ترتيب العمل"></span><span class="vw-cat"></span><span class="vw-pg"></span>' +
        '<span class="vw-tools"><button type="button" class="vw-b" data-vcopy aria-label="' + E(T('wkCopy')) + '">' + ic('link') + '<span>' + E(T('wkCopy')) + '</span></button><button type="button" class="vw-b" data-vsheet aria-pressed="false" hidden>' + ic('grid') + '<span>كل الصور</span></button>' +
        '<button type="button" class="vw-b pvw" data-vw="-1" aria-label="العمل السابق">' + ic('arrowL') + '<span>العمل السابق</span></button>' +
        '<button type="button" class="vw-b" data-vw="1" aria-label="العمل التالي"><span>العمل التالي</span>' + ic('arrowL') + '</button></span>' +
        '<button type="button" class="vw-x" data-vclose aria-label="إغلاق">' + ic('x') + '</button></div>' +
        '<div class="vw-stage" id="vws"><figure class="vw-fig" id="vwf"></figure><div class="vw-sheet" id="vwsh"></div>' +
        '<button type="button" class="vw-nav nx" data-vn="1" aria-label="الصورة التالية">' + ic('arrowL') + '</button><button type="button" class="vw-nav pv" data-vn="-1" aria-label="الصورة السابقة">' + ic('arrowL') + '</button></div>' +
        '<div class="vw-bot"><div class="vw-info" id="vwi"></div><div class="vw-th" id="vwt"></div></div>';
      vwFocus = d.activeElement; d.body.appendChild(vw); root.classList.add('vwo'); app.inert = true;
      vw.querySelector('.vw-x').focus({ preventScroll: true });
    }
    vwUpdate();
    const h = '#w-' + encodeURIComponent(id);
    if (location.hash !== h) { try { if (vwPush) history.replaceState({ vw: 1 }, '', h); else { history.pushState({ vw: 1 }, '', h); vwPush = true; } } catch (e) {} }
  }
  function vwUpdate() {
    const L = vwList, n = L.length, i = Math.max(0, L.findIndex(p => p.id === vwCur)), p = L[i], x = parts(p, i, n), np = x.pics.length;
    const sheet = vwSheet && np > 1;
    vw.setAttribute('aria-label', p.title || '');
    vw.querySelector('.vw-cnt').textContent = x.cnt;
    vw.querySelector('.vw-cat').innerHTML = x.cat;
    vw.querySelector('.vw-pg').textContent = np > 1 && !sheet ? 'صورة ' + pad(x.k + 1) + ' / ' + pad(np) : (np > 1 ? np + ' صور' : '');
    const sb = vw.querySelector('[data-vsheet]'); sb.hidden = np < 2; sb.setAttribute('aria-pressed', String(sheet));
    vw.querySelectorAll('[data-vw]').forEach(b => { b.hidden = n < 2; });
    vw.classList.toggle('one', np < 2);
    vw.classList.toggle('app', isApp(p, catOf(p.category)));
    vw.classList.toggle('sheet', sheet);
    zoomed = false;
    const f = d.getElementById('vwf'); f.className = 'vw-fig' + (x.emb ? ' emb' : ''); f.innerHTML = x.fig;
    d.getElementById('vwsh').innerHTML = sheet ? x.pics.map((s, k) => '<button type="button" class="vw-sh' + (k === x.k ? ' on' : '') + '" data-vs="' + k + '" aria-label="صورة ' + (k + 1) + '"><img loading="lazy" decoding="async" src="' + E(s) + '" alt=""><span>' + pad(k + 1) + '</span></button>').join('') : '';
    d.getElementById('vwi').innerHTML = x.info;
    const t = d.getElementById('vwt');
    if (t.dataset.w !== p.id) {
      t.dataset.w = p.id;
      t.innerHTML = np > 1 ? x.pics.map((s, k) => '<button type="button" class="vw-t" data-vj="' + k + '" aria-label="صورة ' + (k + 1) + '"><img loading="lazy" decoding="async" src="' + E(s) + '" alt=""></button>').join('') : '';
    }
    [].forEach.call(t.children, (b, k) => { b.classList.toggle('on', k === x.k); b.setAttribute('aria-current', k === x.k ? 'true' : 'false'); });
    const on = t.children[x.k]; if (on) t.scrollLeft += (on.getBoundingClientRect().left + on.offsetWidth / 2) - (t.getBoundingClientRect().left + t.clientWidth / 2);
    const bt = vw.querySelector('.vw-bot'); if (bt) bt.scrollTop = 0;
    const pre = []; if (np > 1) pre.push(x.pics[(x.k + 1) % np], x.pics[(x.k - 1 + np) % np]);
    const nx = L[(i + 1) % n]; if (nx && nx !== p) pre.push(imgsOf(nx)[0]);
    pre.forEach(s => { if (s) new Image().src = s; });
  }
  /* تنقل بين صور العمل الواحد */
  function vwImg(dir) {
    if (!vw) return;
    const p = vwList.find(q => q.id === vwCur), np = p ? imgsOf(p).length : 0;
    if (np < 2) return;
    vwI = (vwI + dir + np) % np; vwSheet = false; vwVid = false; vwUpdate();
  }
  function vwGo(k) { vwI = k; vwSheet = false; vwVid = false; vwUpdate(); }
  /* تنقل بين الأعمال */
  function vwStep(dir) {
    if (!vw || vwList.length < 2) return;
    const i = vwList.findIndex(p => p.id === vwCur), n = vwList.length;
    vwOpen(vwList[(i + dir + n) % n].id);
  }
  function vwClose(fromPop) {
    if (!vw) return;
    vw.remove(); vw = null; zoomed = false; vwCur = null; vwI = 0; vwSheet = false; vwVid = false; root.classList.remove('vwo'); app.inert = false;
    if (!fromPop) {
      if (vwPush) { try { history.back(); } catch (e) {} }
      else if (/^#w-/.test(location.hash)) { try { history.replaceState(null, '', location.pathname + location.search); } catch (e) {} }
    }
    vwPush = false;
    if (vwFocus && vwFocus.focus && d.contains(vwFocus)) vwFocus.focus({ preventScroll: true });
  }
  function copyLink(b) {
    const p = vwList.find(x => x.id === vwCur), sg = window.SLUGS && p && window.SLUGS[p.id];
    let u = location.href;
    if (sg && /^[a-z0-9-]+$/.test(sg)) { try { u = new URL('work/' + sg + '/', location.href).href; } catch (e) {} }
    const done = () => { const sp = b.querySelector('span'); if (sp) { sp.textContent = T('wkCopied'); setTimeout(() => { sp.textContent = T('wkCopy'); }, 1600); } };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(u).then(done, () => {});
    else { const ta = d.createElement('textarea'); ta.value = u; d.body.appendChild(ta); ta.select(); try { d.execCommand('copy'); done(); } catch (e) {} ta.remove(); }
  }
  function origin(e, im) {
    const f = im.parentNode, fr = f.getBoundingClientRect();
    const px = Math.min(100, Math.max(0, (e.clientX - fr.left - im.offsetLeft) / im.offsetWidth * 100));
    const py = Math.min(100, Math.max(0, (e.clientY - fr.top - im.offsetTop) / im.offsetHeight * 100));
    im.style.transformOrigin = px + '% ' + py + '%';
  }
  function zoomAt(e, im) {
    if (swiped) return;
    if (!zoomed) origin(e, im);
    zoomed = !zoomed; im.parentNode.classList.toggle('z', zoomed);
  }
  d.addEventListener('mousemove', e => {
    if (!vw || !zoomed) return;
    const im = e.target.closest && e.target.closest('.vw-fig img'); if (im) origin(e, im);
  }, { passive: true });
  let sx = 0, sy = 0, st = false;
  d.addEventListener('pointerdown', e => { if (vw && e.pointerType === 'touch' && e.target.closest('.vw-stage')) { sx = e.clientX; sy = e.clientY; st = true; } });
  d.addEventListener('pointerup', e => {
    if (!st) return; st = false;
    if (!vw || zoomed) return;
    const dx = e.clientX - sx, dy = e.clientY - sy;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) { swiped = true; setTimeout(() => { swiped = false; }, 350); vwImg(dx > 0 ? 1 : -1); }
  });
  d.addEventListener('keydown', e => {
    if (!vw) return;
    const tg = e.target; if (tg && /^(INPUT|TEXTAREA|SELECT)$/.test(tg.tagName) && e.key !== 'Escape' && e.key !== 'Tab') return;
    if (e.key === 'Escape') vwClose();
    else if (e.key === 'ArrowLeft') vwImg(1);
    else if (e.key === 'ArrowRight') vwImg(-1);
    else if (e.key === 'ArrowDown' || e.key === 'PageDown') { e.preventDefault(); vwStep(1); }
    else if (e.key === 'ArrowUp' || e.key === 'PageUp') { e.preventDefault(); vwStep(-1); }
    else if (e.key === 'Tab') {
      const f = [].slice.call(vw.querySelectorAll('button,a[href],summary,input:not(.rvf-hp):not([type=radio]),textarea')).filter(x => !x.disabled && x.offsetParent !== null);
      if (!f.length) return;
      const a = d.activeElement;
      if (!vw.contains(a) || (e.shiftKey && a === f[0])) { e.preventDefault(); f[f.length - 1].focus(); }
      else if (!e.shiftKey && a === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
    }
  });
  addEventListener('popstate', () => {
    const w = /^#w-(.+)$/.exec(location.hash), c = /^#c-(.+)$/.exec(location.hash);
    if (w) { if (D) vwOpen(decodeURIComponent(w[1])); }
    else { if (vw) vwClose(true); if (c && D) setFilter(decodeURIComponent(c[1]), true); }
  });

  /* ---------- clicks ---------- */
  d.addEventListener('click', e => {
    const t = e.target;
    const a = t.closest('[data-act]');
    if (a) {
      if (a.dataset.act === 'mode') {
        const next = root.dataset.mode === 'light' ? 'dark' : 'light';
        try { localStorage.setItem('sx.mode', next); } catch (x) {}
        root.classList.add('theming'); clearTimeout(root._tm); root._tm = setTimeout(() => root.classList.remove('theming'), 400);
        theme(); a.innerHTML = ic(next === 'light' ? 'moon' : 'sun');
      }
      if (a.dataset.act === 'menu') { const m = d.getElementById('menu'), o = m.classList.toggle('open'); a.setAttribute('aria-expanded', String(o)); }
      return;
    }
    if (t.closest('#menu a')) { d.getElementById('menu').classList.remove('open'); const b = d.querySelector('.burger'); if (b) b.setAttribute('aria-expanded', 'false'); }
    if (t.closest('[data-vclose]')) { vwClose(); return; }
    const vcp = t.closest('[data-vcopy]'); if (vcp) { copyLink(vcp); return; }
    const vrl = t.closest('[data-vrel]'); if (vrl) { vwOpen(vrl.dataset.vrel); return; }
    const vn = t.closest('[data-vn]'); if (vn) { vwImg(+vn.dataset.vn); return; }
    const vk = t.closest('[data-vw]'); if (vk) { vwStep(+vk.dataset.vw); return; }
    const vh = t.closest('[data-vsheet]'); if (vh) { vwSheet = !vwSheet; vwUpdate(); return; }
    const vv = t.closest('[data-vvid]'); if (vv) { vwVid = !vwVid; vwUpdate(); return; }
    const vj = t.closest('[data-vj],[data-vs]'); if (vj) { vwGo(+(vj.dataset.vj != null ? vj.dataset.vj : vj.dataset.vs)); return; }
    const zi = t.closest('.vw-fig img'); if (zi) { zoomAt(e, zi); return; }
    if (vw && !t.closest('.vw-fig,.vw-sheet,.vw-nav,.vw-top,.vw-bot')) { vwClose(); return; }
    const f = t.closest('[data-f]'); if (f) { setFilter(f.dataset.f, true); return; }
    const v = t.closest('[data-v]'); if (v) { setView(v.dataset.v); return; }
    const w = t.closest('[data-w]'); if (w) { vwOpen(w.dataset.w); return; }
  });
  d.addEventListener('change', e => { if (e.target && e.target.id === 'ws') { sortBy = e.target.value; paint(); } });
  d.addEventListener('input', e => { if (e.target && e.target.id === 'wq') { q = e.target.value; paint(); } });
  d.addEventListener('load', e => { if (e.target && e.target.tagName === 'IMG') { fit(e.target); const m = e.target.closest && e.target.closest('.wk-m'); if (m) m.classList.add('ld'); } }, true);
  d.addEventListener('error', e => {
    const t = e.target;
    if (t && t.tagName === 'IMG' && t.closest('.wk-m')) { const m = t.parentNode; t.remove(); m.classList.add('ld'); if (!m.querySelector('.ph')) m.insertAdjacentHTML('afterbegin', '<span class="ph">' + ic('image') + '</span>'); }
  }, true);

  /* ---------- boot ---------- */
  function render(data) {
    D = norm(data);
    theme();
    const nm = D.hero.name || '';
    d.title = (D.seo && D.seo.worksTitle) || (T('wkTitle') + (nm ? ' | ' + nm : ''));
    const c = /^#c-(.+)$/.exec(location.hash); if (c) cur = decodeURIComponent(c[1]);
    build();
    const w = /^#w-(.+)$/.exec(location.hash); if (w) vwOpen(decodeURIComponent(w[1]));
  }
  function fail() {
    app.innerHTML = '<div class="boot"><div style="text-align:center;padding:24px"><h2 style="margin-bottom:10px">مقدرتش أحمّل الأعمال</h2><p>تأكد إن ملف data/site.js موجود.</p></div></div>';
  }
  const s = d.createElement('script');
  s.src = 'data/site.js?t=' + Math.floor(Date.now() / 30000);
  s.onload = () => window.SITE ? render(window.SITE) : fail();
  s.onerror = fail;
  d.head.appendChild(s);
})();

/* تسجيل الـService Worker (بيشتغل على https أو localhost بس) */
if ('serviceWorker' in navigator) addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
