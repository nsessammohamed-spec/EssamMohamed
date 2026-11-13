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
  /* كل النصوص الثابتة — بتتعدل من لوحة التحكم (تاب النصوص والأقسام) */
  const LB = {"navWork": "أعمالي", "navServices": "خدماتي", "navAbout": "عني", "navFaq": "أسئلة", "navPricing": "الباقات", "navProof": "ليه أنا", "pricingTitle": "الباقات والأسعار", "pricingSub": "اختار الخدمة وشوف إيه اللي هتستلمه، والسعر بيتحدد حسب شغلك.", "pkAsk": "اطلب عرض سعر", "pkFrom": "ابتداءً من", "pkCustom": "السعر حسب المشروع", "proofTitle": "ليه تشتغل معايا؟", "proofSub": "حاجات بتفرق معاك في الشغل.", "tstTitle": "عملاء اشتغلت معاهم", "svcAsk": "اطلب الخدمة", "navContact": "تواصل", "servicesTitle": "بشتغل في إيه؟", "servicesSub": "اختار المجال وشوف شغلي فيه.", "svcSee": "شوفهم", "svcSoon": "قريبًا", "workTitle": "أعمالي", "workSub": "اضغط على أي عمل تشوفه بالحجم الكامل.", "workMore": "شوف صفحة الأعمال كاملة", "filterAll": "الكل", "cardGoImg": "شوف العمل", "cardGoVid": "شاهد العمل", "emptyWorks": "لسه مفيش أعمال.", "aboutSkills": "الأدوات اللي بشتغل بيها", "aboutSpecs": "التخصصات", "aboutBtn1": "كلمني", "aboutBtn2": "كل أعمالي", "factWorks": "أعمال", "factCats": "مجالات", "factTools": "أدوات", "faqTitle": "أسئلة شائعة", "faqSub": "إجابات سريعة قبل ما نتكلم.", "formName": "اسمك", "formNamePh": "اكتب اسمك", "formSvc": "محتاج إيه؟", "formWhen": "الميعاد المطلوب", "formMsg": "تفاصيل شغلك", "formPreview": "الرسالة اللي هتتبعت", "formPreviewEmpty": "رسالتك هتظهر هنا وانت بتكتب.", "msgSvc": "محتاج:", "msgWhen": "الميعاد:", "mailSubject": "طلب شغل", "ccAvail": "متاح دلوقتي", "ccWa": "واتساب", "ccMail": "الإيميل", "ccCopy": "نسخ", "toastCopied": "اتنسخ الإيميل ✓", "toastNeed": "اكتب تفاصيل شغلك الأول", "toastReady": "اتجهّزت الرسالة ✓", "footUp": "للأعلى", "cardGoApp": "شوف تفاصيل التطبيق", "scShots": "اللقطات", "scVideo": "الفيديو", "scWatch": "شاهد الفيديو", "wkOpenProj": "افتح المشروع", "wkVidBadge": "فيديو"};
  const T = k => { const v = D && D.labels && D.labels[k]; return v != null && String(v).trim() !== '' ? String(v).trim() : LB[k]; };

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
    const z = D.design || {};
    const validColor = v => /^#[0-9a-f]{6}$/i.test(String(v || '')) ? v : '';
    [['--bg','bg'],['--bg2','bg2'],['--surface','surface'],['--surface2','surface2'],['--ink','ink'],['--muted','muted'],['--line','line']].forEach(([css,key]) => { const c = validColor(z[key]); if (c) s.setProperty(css,c); });
    const clamp = (v,a,b,def) => Number.isFinite(+v) ? Math.max(a,Math.min(b,+v)) : def;
    s.setProperty('--r',clamp(z.cardRadius,0,48,22)+'px');
    s.setProperty('--design-body-size',clamp(z.bodySize,14,24,19)+'px');
    s.setProperty('--design-content-width',clamp(z.contentWidth,900,1600,1200)+'px');
    s.setProperty('--design-section-space',clamp(z.sectionSpace,40,180,110)+'px');
    s.setProperty('--design-card-gap',clamp(z.cardGap,8,48,24)+'px');
    s.setProperty('--design-card-ratio',['4/3','1/1','3/4','16/9'].includes(z.cardRatio)?z.cardRatio:'4/3');
    s.setProperty('--design-button-radius',clamp(z.buttonRadius,0,999,999)+'px');
    s.setProperty('--design-shadow',clamp(z.shadow,0,1.5,1));
    const fonts={Tajawal:'\"Tajawal\",sans-serif',Alexandria:'\"Alexandria\",sans-serif',Roboto:'\"Roboto\",sans-serif',
      Plex:'\"Inter\",\"IBM Plex Sans Arabic\",\"Tajawal\",system-ui,sans-serif',
      Kufi:'\"Playfair Display\",\"Noto Kufi Arabic\",\"Alexandria\",\"Tajawal\",system-ui,sans-serif'};
    s.setProperty('--f-body',fonts[z.bodyFont]||fonts.Plex);
    s.setProperty('--f-head',fonts[z.headingFont]||fonts.Kufi);
    s.setProperty('--design-heading-scale',clamp(z.headingScale,.8,1.4,1));
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
    x.contact = x.contact || {}; x.contact.socials = x.contact.socials || []; x.labels = x.labels || {}; x.show = x.show || {};
    ['stats', 'skills', 'categories', 'projects', 'faq', 'testimonials', 'packages', 'why'].forEach(k => { x[k] = Array.isArray(x[k]) ? x[k] : []; });
    x.projects.forEach((p, k) => { if (p && !p.id) p.id = 'x' + k; });
    return x;
  }


  /* ---------- عرض التطبيقات: موكب موبايل بلقطات الشاشة ---------- */
  const isApp = (p, c) => !!(p && p.layout === 'app') || !!(c && c.layout === 'app');
  const phones = (all, c, title) => {
    const pics = all.slice(0, 3), cls = pics.length === 1 ? ['c'] : pics.length === 2 ? ['l', 'r'] : ['l', 'c', 'r'];
    const order = pics.length === 3 ? [pics[1], pics[0], pics[2]] : pics;
    return '<span class="phs n' + Math.max(1, pics.length) + '">' + (pics.length ? order.map((u, i) => '<span class="phn ' + cls[i] + '"><img loading="lazy" decoding="async" src="' + E(u) + '" alt="' + E(title) + '"></span>').join('') : '<span class="phn c"><span class="ps"><b dir="auto">' + E(String(title || '').split('|')[0].trim().slice(0, 14)) + '</b><i></i><i></i><i></i></span></span>') + '</span>';
  };
  const chips = p => Array.isArray(p.tools) && p.tools.length ? '<ul class="tl" aria-label="الأدوات">' + p.tools.slice(0, 5).map(t => '<li>' + E(t) + '</li>').join('') + '</ul>' : '';
  /* فيديو العمل: يوتيوب / فيميو / ملف mp4 */
  const vOf = p => { const u = String((p && p.video) || '').trim(); if (!u) return null; let m = /(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/.exec(u); if (m) return { e: 'https://www.youtube-nocookie.com/embed/' + m[1] + '?rel=0' }; m = /vimeo\.com\/(?:video\/)?(\d+)/.exec(u); if (m) return { e: 'https://player.vimeo.com/video/' + m[1] }; return /^(https?:\/\/|videos\/|blob:)/i.test(u) ? { f: u } : null; };
  const player = (p, poster) => { const v = vOf(p); if (!v) return ''; return v.e ? '<iframe src="' + E(v.e) + '" title="' + E(p.title) + '" loading="lazy" allowfullscreen allow="autoplay; encrypted-media; picture-in-picture; fullscreen"></iframe>' : '<video src="' + E(v.f) + '" controls playsinline preload="metadata"' + (poster ? ' poster="' + E(poster) + '"' : '') + '></video>'; };

  /* رابط صفحة العمل المستقلة (من data/slugs.js)، ولو مش موجودة بيرجع لعارض الأعمال */
  const pageHref = p => { const sg = window.SLUGS && window.SLUGS[p.id]; return /^[a-z0-9-]+$/.test(sg || '') ? 'work/' + sg + '/' : 'works.html#w-' + encodeURIComponent(p.id); };
  function card(p, i) {
    const c = catOf(p.category), all = imgsOf(p), src = all[0];
    const app = isApp(p, c);
    const media = '<div class="media' + (app ? ' app' : '') + '">' +
      (app ? phones(all, c, p.title) : src ? '<img loading="lazy" decoding="async" src="' + E(src) + '" alt="' + E(p.title) + '">' : '<div class="ph">' + ic(c.icon) + '</div>') +
      '<span class="cat-b">' + ic(c.icon) + ' ' + E(c.name) + '</span>' +
      '<span class="idx">' + String(i + 1).padStart(2, '0') + '</span>' +
      (vOf(p) ? '<span class="vd-b">' + ic('play') + ' ' + E(T('wkVidBadge')) + '</span>' : '') +
      (!app && c.type !== 'video' && all.length > 1 ? '<span class="cnt">' + ic('layers') + all.length + ' صور</span>' : '') +
      (c.type === 'video' ? '<div class="pl"><span>' + ic('play') + '</span></div>' : '') + '</div>';
    const body = '<div class="cb">' + (p.tag ? '<span class="tg">' + E(p.tag) + '</span>' : '') + '<h3 dir="auto">' + E(p.title) + '</h3>' + (p.desc ? '<p dir="auto">' + E(p.desc) + '</p>' : '') + chips(p) +
      '<span class="go">' + E(app ? T('cardGoApp') : T(c.type === 'video' ? 'cardGoVid' : 'cardGoImg')) + ' ' + ic('arrowL') + '</span></div>';
    return '<a class="card' + (p.featured ? ' feat' : '') + '" style="--i:' + i + ';--c:' + rgbOf(c, Math.max(0, D.categories.findIndex(x => x.id === p.category))) + '" href="' + pageHref(p) + '" aria-label="' + E(p.title) + '">' + media + body + '</a>';
  }

  /* لوحة تطبيق/لعبة تفاعلية: لقطات بتتبدّل لوحدها + تبويب فيديو + مميزات */
  function showcase(p) {
    const c = catOf(p.category), all = imgsOf(p), href = pageHref(p), vd = vOf(p), shots = all.slice(0, 8);
    const ft = (Array.isArray(p.features) ? p.features : []).filter(Boolean).slice(0, 6);
    const lks = (Array.isArray(p.links) ? p.links : []).filter(x => x && x.url && link(x.url) !== '#').slice(0, 2);
    const scr = shots.length ? shots.map((u, k) => '<img class="sc-s' + (k ? '' : ' on') + '" loading="lazy" decoding="async" src="' + E(u) + '" alt="' + E(p.title) + ' — ' + (k + 1) + '">').join('') : '<span class="ps"><b dir="auto">' + E(String(p.title || '').split('|')[0].trim().slice(0, 14)) + '</b><i></i><i></i><i></i></span>';
    const tabs = vd ? '<div class="sc-tabs" role="group" aria-label="طريقة العرض"><button type="button" data-sct="shots" aria-pressed="true">' + ic('layers') + ' ' + E(T('scShots')) + '</button><button type="button" data-sct="vid" aria-pressed="false">' + ic('play') + ' ' + E(T('scVideo')) + '</button></div>' : '';
    const dots = shots.length > 1 ? '<div class="sc-dots">' + shots.map((u, k) => '<button type="button" data-scs="' + k + '" aria-label="لقطة ' + (k + 1) + '" aria-current="' + (k === 0) + '"></button>').join('') + '</div>' : '';
    return '<article class="sc" style="--c:' + rgbOf(c, Math.max(0, D.categories.findIndex(x => x.id === p.category))) + '">' +
      '<div class="sc-b">' + (p.tag ? '<span class="tg">' + E(p.tag) + '</span>' : '') + (p.status ? '<span class="pj-st">' + E(p.status) + '</span>' : '') +
      '<h3 dir="auto">' + E(p.title) + '</h3>' + (p.desc ? '<p dir="auto">' + E(p.desc) + '</p>' : '') +
      (ft.length ? '<ul class="ft">' + ft.map(x => '<li>' + ic('check') + '<span dir="auto">' + E(x) + '</span></li>').join('') + '</ul>' : '') + chips(p) +
      '<div class="sc-go"><a class="btn primary" href="' + href + '">' + E(T('cardGoApp')) + ' ' + ic('arrowL') + '</a>' +
      (vd ? '<button type="button" class="btn ghost" data-sct="vid">' + ic('play') + ' ' + E(T('scWatch')) + '</button>' : '') +
      lks.map(x => '<a class="btn ghost" href="' + E(link(x.url)) + '" target="_blank" rel="noopener noreferrer">' + E(x.label || T('wkOpenProj')) + ' ' + ic('ext') + '</a>').join('') + '</div></div>' +
      '<div class="media app sc-m"><span class="phs n1"><span class="phn c">' + scr + '</span></span><div class="sc-vid" hidden></div>' + tabs + dots +
      (vd ? '<template class="sc-tpl">' + player(p, shots[0]) + '</template>' : '') + '</div></article>';
  }

  function grid() {
    const list = shown().filter(p => cur === 'all' || p.category === cur);
    if (cur !== 'all' && list.length && list.every(x => isApp(x, catOf(x.category)))) return list.map(x => showcase(x)).join('');
    return list.length ? list.map(card).join('') : '<div class="empty">' + E(T('emptyWorks')) + '</div>';
  }

  function build() {
    const H = D.hero, A = D.about, C = D.contact, P = shown();
    const [n1, n2] = splitName(H.name);
    const skills = D.skills.filter(Boolean);
    let no = 0; const num = () => String(++no).padStart(2, '0'); const on = k => !(D.show && D.show[k] === false);
    const menu = [];
    const sections = [];
    const policy = () => {
      const PP = D.pricingPolicy, pts = PP && Array.isArray(PP.points) ? PP.points.filter(x => x && x.t) : [];
      if (!pts.length) return '';
      const icn = ['history', 'edit', 'info'];
      return '<aside class="pol rv" aria-label="' + E(PP.title || '') + '">' + (PP.title ? '<h3>' + E(PP.title) + '</h3>' : '') +
        '<ul>' + pts.map((x, i) => '<li><span class="pi">' + ic(icn[i % icn.length]) + '</span><b dir="auto">' + E(x.t) + '</b>' + (x.d ? '<span dir="auto">' + E(x.d) + '</span>' : '') + '</li>').join('') + '</ul></aside>';
    };

    if (D.stats.length) sections.push('<section class="s" style="padding-top:60px"><div class="wrap rv"><div class="stats">' +
      D.stats.map(s => '<div class="stat"><b>' + E(s.value) + '</b><span>' + E(s.label) + '</span></div>').join('') + '</div></div></section>');

    if (on('services') && D.categories.length) {
      menu.push(['#services', T('navServices')]);
      sections.push('<section class="s" id="services"><div class="wrap"><div class="sh ctr rv"><span class="no">' + num() + '</span><h2>' + E(T('servicesTitle')) + '</h2><p>' + E(T('servicesSub')) + '</p></div><div class="svc">' +
        D.categories.map((c, i) => {
          const n = P.filter(p => p.category === c.id).length;
          return '<div class="svc-w rv" style="--d:' + (i * .08) + 's"><button type="button" style="--c:' + rgbOf(c, i) + '" ' + (n ? 'data-cat' : 'data-ask') + '="' + E(n ? c.id : c.name) + '"><span class="ico">' + ic(c.icon) + '</span><h3>' + E(c.name) + '</h3><p>' + E(c.desc) + '</p><em>' + (n ? n + ' ' + (n > 2 && n < 11 ? 'أعمال' : 'عمل') + ' · ' + E(T('svcSee')) : E(T('svcAsk'))) + ' ' + ic('arrowL') + '</em></button></div>';
        }).join('') + '</div></div></section>');
    }

    if (on('work') && P.length) {
      menu.unshift(['#work', T('navWork')]);
      sections.push('<section class="s" id="work"><div class="wrap"><div class="sh ctr rv"><span class="no">' + num() + '</span><h2>' + E(T('workTitle')) + '</h2><p>' + E(T('workSub')) + '</p></div>' +
        (function () {
        const cs = D.categories.filter(c => P.some(p => p.category === c.id));
        if (cs.length < 2) return '';
        return '<div class="filters ctr rv" role="group" aria-label="تصفية الأعمال">' + [['all', T('filterAll'), P.length]].concat(cs.map(c => [c.id, c.name, P.filter(p => p.category === c.id).length])).map(f => '<button type="button" class="fc" data-f="' + E(f[0]) + '" aria-pressed="' + (f[0] === 'all') + '">' + E(f[1]) + ' <small>' + f[2] + '</small></button>').join('') + '</div>';
      })() + '<div class="grid rv" id="grid">' + grid() + '</div><div class="more rv"><a class="btn ghost" href="works.html">' + E(T('workMore')) + ' ' + ic('arrowL') + '</a></div></div></section>');
    }

    const mine = (Array.isArray(A.photos) ? A.photos : []).map(img).filter(Boolean);
    if (on('about') && (A.text || skills.length || mine.length)) {
      menu.push(['#about', T('navAbout')]);
      const facts = (Array.isArray(A.facts) ? A.facts : []).filter(f => f && f.label && f.value);
      if (D.categories.length) facts.push({ label: T('aboutSpecs'), value: D.categories.map(c => c.name).join('، ') });
      sections.push('<section class="s" id="about"><div class="wrap"><div class="ab' + (mine.length ? '' : ' solo') + '">' +
        '<div class="ab-tx"><div class="sh rv"><h2>' + E(A.title || 'نبذة عني') + '</h2></div>' +
        '<p class="tx rv">' + E(ar(A.text)) + '</p>' +
        (facts.length ? '<dl class="facts rv">' + facts.map(f => '<div><dt>' + E(f.label) + '</dt><dd>' + E(ar(f.value)) + '</dd></div>').join('') + '</dl>' : '') +
        (skills.length ? '<div class="skills rv"><h3>' + E(T('aboutSkills')) + '</h3>' + skills.map((s, k) => '<span class="sk" style="--c:' + PAL[k % PAL.length] + '">' + E(s) + '</span>').join('') + '</div>' : '') +
        '<div class="cta rv"><a class="btn primary" href="#contact">' + E(T('aboutBtn1')) + ' ' + ic('arrowL') + '</a><a class="btn ghost" href="works.html">' + E(T('aboutBtn2')) + '</a></div></div>' +
        (mine.length ? '<div class="mine rv"><div class="mine-g n' + Math.min(mine.length, 5) + '">' + mine.slice(0, 5).map((u, i) => '<button type="button" class="mine-i" data-lb="' + E(u) + '" aria-label="تكبير الصورة ' + (i + 1) + '"><img loading="lazy" decoding="async" src="' + E(u) + '" alt="' + E(H.name) + ' — صورة ' + (i + 1) + '"></button>').join('') + '</div></div>' : '') +
        '</div></div></section>');
    }


    const why = (Array.isArray(D.why) ? D.why : []).filter(x => x && x.t);
    const tst = (Array.isArray(D.testimonials) ? D.testimonials : []).filter(x => x && x.text);
    if (on('proof') && (why.length || tst.length)) {
      menu.push(['#proof', T('navProof')]);
      sections.push('<section class="s" id="proof"><div class="wrap"><div class="sh ctr rv"><h2>' + E(T('proofTitle')) + '</h2><p>' + E(T('proofSub')) + '</p></div>' +
        (why.length ? '<div class="why">' + why.map((x, i) => '<div class="wy rv" style="--d:' + (i * .08) + 's;--c:' + PAL[i % PAL.length] + '"><span class="wn">' + String(i + 1).padStart(2, '0') + '</span><h3 dir="auto">' + E(x.t) + '</h3>' + (x.d ? '<p dir="auto">' + E(ar(x.d)) + '</p>' : '') + '</div>').join('') + '</div>' : '') +
        (tst.length ? '<h3 class="sub-h rv">' + E(T('tstTitle')) + '</h3><div class="tst">' + tst.map((x, i) => '<figure class="tq rv" style="--d:' + (i * .08) + 's"><blockquote dir="auto">' + E(ar(x.text)) + '</blockquote><figcaption><b>' + E(x.name || '') + '</b>' + (x.role ? '<span>' + E(x.role) + '</span>' : '') + (x.link ? ' <a href="' + E(link(x.link)) + '" target="_blank" rel="noopener noreferrer">' + ic('ext') + '</a>' : '') + '</figcaption></figure>').join('') + '</div>' : '') +
        '</div></section>');
    }

    const pk = (Array.isArray(D.packages) ? D.packages : []).filter(x => x && x.name && x.visible !== false);
    if (on('pricing') && pk.length) {
      menu.push(['#pricing', T('navPricing')]);
      sections.push('<section class="s" id="pricing"><div class="wrap"><div class="sh ctr rv"><span class="no">' + num() + '</span><h2>' + E(T('pricingTitle')) + '</h2><p>' + E(T('pricingSub')) + '</p></div><div class="pk-car"><button type="button" class="pk-nav pk-r" aria-label="السابق">' + ic('arrowL') + '</button><div class="pks" tabindex="0" role="region" aria-label="' + E(T('pricingTitle')) + '">' +
        pk.map((x, i) => {
          const c = D.categories.find(k => k.id === x.category) || null, feats = (Array.isArray(x.features) ? x.features : []).filter(Boolean);
          return '<article class="pk' + (x.featured ? ' hot' : '') + '" style="--c:' + rgbOf(c, i) + '">' + (x.badge ? '<span class="pk-b">' + E(x.badge) + '</span>' : '') +
            (c ? '<span class="ico">' + ic(c.icon) + '</span>' : '') + '<h3 dir="auto">' + E(x.name) + '</h3>' + (x.desc ? '<p class="pk-d" dir="auto">' + E(ar(x.desc)) + '</p>' : '') +
            '<div class="pk-p">' + (x.price ? '<small>' + E(T('pkFrom')) + '</small><b>' + E(x.price) + '</b>' : '<b class="cs">' + E(T('pkCustom')) + '</b>') + (x.note ? '<em>' + E(x.note) + '</em>' : '') + '</div>' +
            (feats.length ? '<ul>' + feats.map(f => '<li>' + ic('check') + '<span dir="auto">' + E(ar(f)) + '</span></li>').join('') + '</ul>' : '') +
            '<button type="button" class="btn ' + (x.featured ? 'primary' : 'ghost') + '" data-ask="' + E(c ? c.name : x.name) + '">' + E(T('pkAsk')) + ' ' + ic('arrowL') + '</button></article>';
        }).join('') + '</div><button type="button" class="pk-nav pk-l" aria-label="التالي">' + ic('arrowL') + '</button></div>' + policy() + '</div></section>');
    }

    const faq = (Array.isArray(D.faq) ? D.faq : []).filter(x => x && x.q && x.a);
    if (on('faq') && faq.length) {
      menu.push(['#faq', T('navFaq')]);
      sections.push('<section class="s" id="faq"><div class="wrap"><div class="sh ctr rv"><h2>' + E(T('faqTitle')) + '</h2><p>' + E(T('faqSub')) + '</p></div><div class="faq">' +
        faq.map((x, i) => '<details class="fq rv" name="faq" style="--d:' + (i * .06) + 's;--c:' + PAL[i % PAL.length] + '"><summary><span dir="auto">' + E(x.q) + '</span><i class="ch" aria-hidden="true"></i></summary><div class="fa"><p dir="auto">' + E(ar(x.a)) + '</p></div></details>').join('') + '</div></div></section>');
    }
    const wa = String(C.whatsapp || '').replace(/\D/g, '');
    const CF = C.form || {}, showF = C.showForm !== false, whens = (Array.isArray(C.when) ? C.when : ['مستعجل', 'خلال أسبوع', 'مفيش استعجال']).map(x => String(x == null ? '' : x).trim()).filter(Boolean);
    if (on('contact') && (C.email || wa || C.socials.length)) {
      menu.push(['#contact', T('navContact')]);
      sections.push('<section class="s" id="contact"><div class="wrap"><div class="cx rv"><h2>' + E(C.title || 'تواصل معايا') + '</h2>' + (C.text ? '<p>' + E(ar(C.text)) + '</p>' : '') +
        (C.steps && C.steps.length ? '<ol class="stp">' + C.steps.filter(x => x && x.t).map((x, i) => '<li style="--c:' + PAL[i % PAL.length] + '"><b>' + (i + 1) + '</b><div><h3>' + E(x.t) + '</h3>' + (x.d ? '<p>' + E(ar(x.d)) + '</p>' : '') + '</div></li>').join('') + '</ol>' : '') +
          '<div class="ct' + (showF ? '' : ' nf') + '">' + (showF ? ('<form class="cf" id="cf" data-g="' + E(CF.greeting || ('أهلاً ' + splitName(H.name)[0])) + '" novalidate autocomplete="off">' +
          '<label class="fl"><span>' + E(T('formName')) + '</span><input name="nm" dir="rtl" type="text" maxlength="60" placeholder="' + E(T('formNamePh')) + '"></label>' +
          (D.categories.length ? '<div class="fl"><span>' + E(T('formSvc')) + '</span><div class="svs">' + D.categories.map((c, i) => '<button type="button" class="sv" style="--c:' + rgbOf(c, i) + '" data-svc="' + E(c.name) + '" aria-pressed="false">' + ic(c.icon) + E(c.name) + '</button>').join('') + '</div></div>' : '') +
          (whens.length ? '<div class="fl"><span>' + E(T('formWhen')) + '</span><div class="svs">' + whens.map((w, i) => '<button type="button" class="sv" style="--c:' + PAL[(i + 1) % PAL.length] + '" data-when="' + E(w) + '" aria-pressed="false">' + E(w) + '</button>').join('') + '</div></div>' : '') +
          '<label class="fl"><span>' + E(T('formMsg')) + '</span><textarea name="ms" dir="rtl" rows="4" maxlength="1200" placeholder="' + E(CF.msgPlaceholder || 'احكيلي عن الشغل: المطلوب، الميعاد، أي تفاصيل تفيد') + '"></textarea></label>' +
          '<div class="pv"><span>' + E(T('formPreview')) + '</span><p id="pv" class="empty" dir="auto">' + E(T('formPreviewEmpty')) + '</p></div><div class="cf-b">' + (wa ? '<button type="button" class="btn primary" data-send="wa" data-to="' + wa + '">' + E(CF.waBtn || 'ابعت على واتساب') + ' ' + ic('arrowL') + '</button>' : '') + (C.email ? '<button type="button" class="btn ghost" data-send="mail" data-to="' + E(C.email) + '">' + E(CF.mailBtn || 'ابعت بالإيميل') + '</button>' : '') + '</div></form>') : '') +
          '<div class="ct-s">' +
          (H.available && H.availableText ? '<div class="cc av"><span class="pulse"></span><div><b>' + E(T('ccAvail')) + '</b><span>' + E(H.availableText) + '</span></div></div>' : '') +
          (wa ? '<a class="cc" style="--c:140,170,110" href="https://wa.me/' + wa + '" target="_blank" rel="noopener noreferrer"><div><b>' + E(T('ccWa')) + '</b><span class="ltr">+' + wa + '</span></div>' + ic('ext') + '</a>' : '') +
          (C.email ? '<div class="cc" style="--c:212,166,74"><a href="mailto:' + E(C.email) + '"><b>' + E(T('ccMail')) + '</b><span class="ltr">' + E(C.email) + '</span></a><button type="button" class="cp" data-copy="' + E(C.email) + '">' + E(T('ccCopy')) + '</button></div>' : '') +
          '</div></div>' + (C.socials.length ? '<div class="soc">' + C.socials.filter(s => s && s.url).map(s => '<a href="' + E(link(s.url)) + '" target="_blank" rel="noopener noreferrer">' + E(s.name || s.url) + ' ' + ic('ext') + '</a>').join('') + '</div>' : '') +
        '</div></div></section>');
    }

    const mord = ['#work', '#services', '#pricing', '#about', '#proof', '#faq', '#contact']; menu.sort((x, y) => mord.indexOf(x[0]) - mord.indexOf(y[0]));
    const nav = '<header class="nav" id="nav"><div class="wrap nav-in"><a class="brand" href="#top" aria-label="الرئيسية"><b>' + E((H.name || 'ع').trim().charAt(0)) + '</b><span>' + E(H.name) + '</span></a>' +
      '<nav class="menu" id="menu" aria-label="القائمة">' + menu.map(m => '<a href="' + m[0] + '">' + E(m[1]) + '</a>').join('') + '</nav>' +
      (D.theme.toggle === false ? '' : '<button type="button" class="ib" data-act="mode" aria-label="تبديل الوضع الليلي/النهاري">' + ic(root.dataset.mode === 'light' ? 'moon' : 'sun') + '</button>') +
      '<button type="button" class="ib burger" data-act="menu" aria-label="القائمة" aria-expanded="false">' + ic('menu') + '</button></div></header>';

    const photo = img(H.photo), ps = ['card', 'arch', 'round'].indexOf(H.photoStyle) > -1 ? H.photoStyle : 'card';
    /* الاسم في سطر واحد، وتحته خط بالقلم بيترسم (روح السبورة البيضاء) */
    const l1 = String(H.name || '').trim(), l2 = '';
    const pen = '<svg class="pen" viewBox="0 0 400 30" preserveAspectRatio="none" aria-hidden="true"><path pathLength="1" d="M3 15H397"/></svg>';
    const nameHtml = l2 ? '<span class="nl">' + E(l1) + '</span><span class="nl">' + E(l2) + pen + '</span>' : '<span class="nl">' + E(l1) + pen + '</span>';
    const eyebrow = E(H.eyebrow).replace(/\s*[·•|]\s*/g, '، ');
    const hf = (Array.isArray(H.facts) ? H.facts : []).filter(x => x && x.value && x.label).map(x => [x.value, x.label]);
    const fx = hf.length ? hf : [[P.length, T('factWorks')], [D.categories.length, T('factCats')], [skills.length, T('factTools')]].filter(x => x[0] > 0);
    const facts = fx.length ? '<div class="hero-facts rv" style="--d:.34s">' + fx.map(x => /^\d+$/.test(String(x[0])) ? '<div><b data-n="' + x[0] + '">0</b><span>' + E(x[1]) + '</span></div>' : '<div><b>' + E(x[0]) + '</b><span>' + E(x[1]) + '</span></div>').join('') + '</div>' : '';
    const RINGS = '<svg viewBox="0 0 800 800" fill="none" stroke="currentColor" stroke-linecap="round" focusable="false"><circle cx="400" cy="400" r="110" opacity=".5"/><circle cx="400" cy="400" r="190" opacity=".34"/><circle class="dash" cx="400" cy="400" r="250" stroke-width="2.4" stroke-dasharray="1 11" opacity=".6"/><circle cx="400" cy="400" r="310" opacity=".22"/><circle cx="400" cy="400" r="380" opacity=".14"/><circle cx="522" cy="255" r="5" fill="currentColor" stroke="none" opacity=".85"/><circle cx="132" cy="555" r="3.5" fill="currentColor" stroke="none" opacity=".7"/><circle cx="757" cy="530" r="9" opacity=".6"/><circle cx="318" cy="293" r="3" fill="currentColor" stroke="none" opacity=".6"/></svg>';
    const ctaList = [[H.cta1Text, H.cta1Link, 'primary'], [H.cta2Text, H.cta2Link, 'ghost']].filter(x => x[0] && String(x[0]).trim());
    const heroAv = H.available && H.availableText ? '<div class="hero-av rv" style="--d:.2s"><span class="pulse" aria-hidden="true"></span><span>' + E(H.availableText) + '</span></div>' : '';
    const heroCta = ctaList.length ? '<div class="hero-cta rv" style="--d:.26s">' + ctaList.map(x => '<a class="btn ' + x[2] + '" href="' + E(link(x[1] || '#')) + '">' + E(String(x[0]).trim()) + (x[2] === 'primary' ? ' ' + ic('arrowL') : '') + '</a>').join('') + '</div>' : '';
    const heroActions = heroAv + heroCta;
    const hero = '<section class="hero" id="top"><span class="hero-glow" aria-hidden="true"></span><div class="wrap hero-in"><span class="hero-rings" aria-hidden="true">' + RINGS + '</span><div class="hero-tx">' +
      (eyebrow ? '<span class="eyebrow rv" style="--d:.02s">' + eyebrow + '</span>' : '') + '<h1 class="name rv" style="--d:.08s" aria-label="' + E(H.name) + '">' + nameHtml + '</h1>' +
      (H.sub ? '<p class="sub rv" style="--d:.16s">' + E(ar(H.sub)) + '</p>' : '') +
      heroActions +
      '</div><figure class="hero-ph rv" data-ps="' + ps + '" style="--d:.2s"><div class="arch"' + (photo ? ' data-lb="' + E(photo) + '" title="تكبير الصورة"' : '') + '>' +
      (photo ? '<img src="' + E(photo) + '" alt="' + E(H.name) + '" fetchpriority="high" decoding="async">' : '<div class="mono" aria-hidden="true">' + E((H.name || 'ع').trim().charAt(0)) + '</div>') +
      '</div>' + (photo && H.badges !== false ? D.categories.slice(0, 4).map((c, i) => '<span class="fb fb' + i + '" style="--c:' + rgbOf(c, i) + '" aria-hidden="true">' + ic(c.icon) + E(c.name) + '</span>').join('') : '') + '</figure>' + facts + '</div></section>';

    let base = []; while (skills.length && base.length < 8) base = base.concat(skills);
    const mk = k => base.map(s => '<span' + (k ? ' class="dup"' : '') + '>' + E(s) + '</span><i' + (k ? ' class="dup"' : '') + '></i>').join('');
    const marq = skills.length && on('marquee') ? '<div class="marq" aria-hidden="true"><div class="mt">' + mk(0) + mk(1) + '</div></div>' : '';

    const foot = '<footer class="f"><div class="wrap"><span>' + E(D.footer || '') + '</span><a class="up" href="#top">' + E(T('footUp')) + ' ' + ic('arrowUp') + '</a></div></footer>';

    const ord = ['work', 'services', 'pricing', 'about', 'proof', 'faq', 'contact'], idOf = h => { const m = /id="(\w+)"/.exec(h); return m ? ord.indexOf(m[1]) : -1; };
    sections.sort((x, y) => idOf(x) - idOf(y));
    app.innerHTML = nav + '<main id="main">' + hero + sections.join('') + '</main>' + foot;
    onScroll(); reveal(); life(); pkCar();
  }


  /* ---------- سلايدر الباقات (أسهم يمين وشمال) ---------- */
  function pkCar() {
    const car = d.querySelector('.pk-car'); if (!car) return;
    const tr = car.querySelector('.pks'), bl = car.querySelector('.pk-l'), br = car.querySelector('.pk-r');
    const step = () => { const c = tr.querySelector('.pk'); return c ? c.getBoundingClientRect().width + (parseFloat(getComputedStyle(tr).columnGap) || 20) : tr.clientWidth; };
    const upd = () => {
      const max = tr.scrollWidth - tr.clientWidth, l = tr.scrollLeft, rtl = getComputedStyle(tr).direction === 'rtl';
      const left = rtl ? (-l < max - 12) : (l > 12), right = rtl ? (-l > 12) : (l < max - 12);
      bl.disabled = !left || max < 4; br.disabled = !right || max < 4;
      car.classList.toggle('no-nav', max < 4);
    };
    bl.addEventListener('click', () => tr.scrollBy({ left: -step(), behavior: 'smooth' }));
    br.addEventListener('click', () => tr.scrollBy({ left: step(), behavior: 'smooth' }));
    tr.addEventListener('scroll', () => requestAnimationFrame(upd), { passive: true });
    tr.addEventListener('keydown', e => { if (e.key === 'ArrowLeft') { e.preventDefault(); bl.click(); } else if (e.key === 'ArrowRight') { e.preventDefault(); br.click(); } });
    addEventListener('resize', upd, { passive: true });
    upd(); setTimeout(upd, 400);
  }

  /* ---------- behaviours ---------- */
  let lio = null;
  function reveal() {
    const cx = d.querySelector('.cx');
    if (cx && 'IntersectionObserver' in window) { if (lio) lio.disconnect(); lio = new IntersectionObserver(es => es.forEach(e => e.target.classList.toggle('live', e.isIntersecting))); lio.observe(cx); }
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
    const ok = () => toast(T('toastCopied')), no = () => toast('مقدرتش أنسخ، انسخه بإيدك');
    if (navigator.clipboard) navigator.clipboard.writeText(v).then(ok, no); else no();
  });

  d.addEventListener('submit', e => e.preventDefault());
  d.addEventListener('input', e => { const t = e.target; if (!t.closest || !t.closest('.cf')) return; const m = t.value.match(/[A-Za-z\u0590-\u08FF]/); t.dir = m && /[A-Za-z]/.test(m[0]) ? 'ltr' : 'rtl'; });
  function compose() {
    const f = d.getElementById('cf'); if (!f) return '';
    const nm = f.elements.nm.value.trim(), ms = f.elements.ms.value.trim();
    const sv = d.querySelector('[data-svc][aria-pressed=true]'), wn = d.querySelector('[data-when][aria-pressed=true]');
    const L = [(f.dataset.g || 'أهلاً') + (nm ? '، أنا ' + nm : '') + '.'];
    if (sv) L.push(T('msgSvc') + ' ' + sv.dataset.svc);
    if (wn) L.push(T('msgWhen') + ' ' + wn.dataset.when);
    if (ms) L.push('', ms);
    return L.join('\n');
  }
  function pv() {
    const o = d.getElementById('pv'), f = d.getElementById('cf'); if (!o || !f) return;
    const has = f.elements.ms.value.trim() || f.elements.nm.value.trim() || d.querySelector('[data-svc][aria-pressed=true],[data-when][aria-pressed=true]');
    o.textContent = has ? compose() : T('formPreviewEmpty'); o.classList.toggle('empty', !has);
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
    if (!f.elements.ms.value.trim()) { f.classList.remove('shake'); void f.offsetWidth; f.classList.add('shake'); f.elements.ms.focus(); toast(T('toastNeed')); return; }
    const txt = compose(), sv = d.querySelector('[data-svc][aria-pressed=true]');
    if (sd.dataset.send === 'wa') window.open('https://wa.me/' + sd.dataset.to + '?text=' + encodeURIComponent(txt), '_blank', 'noopener');
    else location.href = 'mailto:' + sd.dataset.to + '?subject=' + encodeURIComponent(T('mailSubject') + (sv ? ' - ' + sv.dataset.svc : '')) + '&body=' + encodeURIComponent(txt);
    toast(T('toastReady'));
  });

  /* عرض التطبيقات التفاعلي: تبديل اللقطات، تبويب الفيديو، وتبديل تلقائي هادي */
  function scShot(sc, k) { const im = sc.querySelectorAll('.sc-s'); if (!im.length) return; k = (k + im.length) % im.length; im.forEach((x, j) => x.classList.toggle('on', j === k)); sc.querySelectorAll('[data-scs]').forEach((b, j) => b.setAttribute('aria-current', String(j === k))); sc._k = k; }
  function scTab(sc, mode) { const box = sc.querySelector('.sc-vid'), tpl = sc.querySelector('.sc-tpl'); if (!box || !tpl) return; const v = mode === 'vid'; sc.classList.toggle('vid', v); box.hidden = !v; box.innerHTML = v ? tpl.innerHTML : ''; sc.querySelectorAll('.sc-tabs [data-sct]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.sct === mode))); }
  d.addEventListener('click', e => {
    const t = e.target.closest && e.target.closest('[data-scs],[data-sct]'); if (!t) return;
    const sc = t.closest('.sc'); if (!sc) return; sc._hold = true;
    if (t.hasAttribute('data-scs')) { scTab(sc, 'shots'); scShot(sc, +t.dataset.scs); } else scTab(sc, t.dataset.sct);
  });
  setInterval(() => {
    if (RM || d.hidden) return;
    d.querySelectorAll('.sc').forEach(sc => { if (sc._hold || sc.classList.contains('vid') || sc.matches(':hover')) return; const r = sc.getBoundingClientRect(); if (r.bottom < 0 || r.top > innerHeight) return; scShot(sc, (sc._k || 0) + 1); });
  }, 3800);

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
        root.classList.add('theming'); clearTimeout(root._tm); root._tm = setTimeout(() => root.classList.remove('theming'), 400);
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
    const ak = t.closest('[data-ask]');
    if (ak) {
      const ct = d.getElementById('contact'); if (ct) ct.scrollIntoView({ behavior: RM ? 'auto' : 'smooth', block: 'start' });
      d.querySelectorAll('[data-svc]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.svc === ak.dataset.ask)));
      if (typeof pv === 'function') pv();
      return;
    }
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
