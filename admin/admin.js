/* لوحة التحكم — بتعدّل data/site.js في ريبو GitHub مباشرة، وGitHub Pages بينشره لوحده */
(function () {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const I = (n, c) => window.icon(n, c);
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const LS = {
    get(k) { try { return localStorage.getItem('sx.admin.' + k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem('sx.admin.' + k, v); } catch (e) {} },
    del(k) { try { localStorage.removeItem('sx.admin.' + k); } catch (e) {} }
  };
  const get = (o, p) => p.split('.').reduce((a, k) => (a == null ? a : a[k]), o);
  const set = (o, p, v) => { const ks = p.split('.'); let a = o; ks.slice(0, -1).forEach(k => { if (a[k] == null) a[k] = {}; a = a[k]; }); a[ks[ks.length - 1]] = v; };
  const uid = p => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
  const b64 = txt => { const u = new TextEncoder().encode(txt); let s = ''; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(s); };
  const unb64 = c => new TextDecoder().decode(Uint8Array.from(atob(c.replace(/\s/g, '')), ch => ch.charCodeAt(0)));

  /* الوضع الليلي / النهاري */
  const curTheme = () => LS.get('theme') || 'dark';
  function applyTheme(t) {
    document.documentElement.dataset.theme = t; LS.set('theme', t);
    const tc = $('#tc'); if (tc) tc.content = t === 'light' ? '#F5F2EA' : '#0A0907';
    const b = $('#themeTg'); if (b) b.innerHTML = I(t === 'light' ? 'moon' : 'sun') + '<span>' + (t === 'light' ? 'الوضع الليلي' : 'الوضع النهاري') + '</span>';
  }
  applyTheme(curTheme());
  $('#themeTg').onclick = () => applyTheme(curTheme() === 'light' ? 'dark' : 'light');

  let S = null, orig = '', busy = false, buildTok = 0, view = 'home';
  const gh = { repo: '', token: '', branch: 'main', sha: '' };
  const vids = new Map();           // path -> {b64,url,done} فيديوهات مرفوعة
  const imgs = new Map();           // path -> {dataUrl,b64,done}
  const flt = { q: '', cat: 'all', st: 'all', vw: LS.get('works.vw') === 'grid' ? 'grid' : 'list' };
  let lastPub = '';
  let siteUrl = '';

  const VIEWS = [
    ['home', 'الرئيسية', 'home', 'نظرة سريعة على موقعك وأهم الإجراءات.', 'عام'],
    ['works', 'الأعمال', 'folder', 'أضف أعمالك ورتّبها وتحكم في ظهورها.', 'المحتوى'],
    ['cats', 'الأقسام', 'grid', 'أقسام الخدمات اللي بتظهر في الموقع وفلاتر الأعمال.', 'المحتوى'],
    ['pricing', 'الباقات والأسعار', 'star', 'باقات الخدمات وأسعارها وسياسة التعديلات.', 'المحتوى'],
    ['proof', 'ليه أنا وآراء العملاء', 'check', 'نقاط القوة وآراء العملاء اللي بتبني الثقة.', 'المحتوى'],
    ['content', 'محتوى الصفحة', 'user', 'الواجهة الرئيسية، نبذة عنك، المهارات والأرقام.', 'المحتوى'],
    ['contact', 'التواصل', 'mail', 'بيانات التواصل ونموذج الرسائل وحسابات السوشيال.', 'المحتوى'],
    ['texts', 'النصوص والأقسام', 'edit', 'إظهار وإخفاء الأقسام، الأسئلة الشائعة، وكل النصوص الثابتة.', 'الموقع'],
    ['seo', 'الموقع و SEO', 'globe', 'عنوان الموقع ووصفه وصورة المشاركة لمحركات البحث.', 'الموقع'],
    ['look', 'المظهر', 'sliders', 'الألوان والخطوط والمسافات وشكل الكروت.', 'الموقع'],
    ['account', 'الحساب والنسخ', 'key', 'الاتصال، النسخ الاحتياطي، وتسجيل الخروج.', 'النظام']
  ];
  const ICON_CHOICES = ['layers', 'code', 'pen', 'film', 'monitor', 'phone', 'camera', 'image', 'music', 'book', 'globe', 'bolt', 'star'];

  /* ---------- GitHub ---------- */
  async function api(path, opt = {}) {
    const r = await fetch(String(window.ADMIN_API || '').replace(/\/+$/, '') + '/gh' + path, Object.assign({}, opt, {
      cache: 'no-store',
      headers: Object.assign({ Authorization: 'Bearer ' + gh.token, 'Content-Type': 'application/json' }, opt.headers || {})
    }));
    if (!r.ok) { const e = new Error('HTTP ' + r.status); e.status = r.status; try { e.body = await r.json(); } catch (x) {} throw e; }
    return r.status === 204 ? null : r.json();
  }
  function explain(e) {
    if (e.status === 401) { try { sessionStorage.removeItem('sx.admin.sess'); } catch (x) {} return 'الجلسة انتهت. اعمل ريفريش للصفحة وادخل بكلمة السر تاني.'; }
    if (e.status === 429) return 'محاولات غلط كتير. استنى شوية وجرّب.';
    if (e.status === 403) return (e.body && /rate limit/i.test(e.body.message || '')) ? 'GitHub وقّفك شوية لكثرة الطلبات. استنى دقيقة وجرّب.' : 'العملية دي مش مسموحة.';
    if (e.status === 404) return 'الريبو مش موجود، أو التوكن مش مديله صلاحية عليه. اتأكد من الاسم ومن إن التوكن مخصص للريبو ده.';
    if (e.status === 409 || e.status === 422) return 'حصل تعارض في الحفظ. جرّب تنشر تاني.';
    if (e instanceof TypeError) return 'مفيش اتصال بالإنترنت أو GitHub مش بيرد.';
    return e.message || 'حصل خطأ غير متوقع.';
  }
  async function fetchFile(path) { return api('/repos/' + gh.repo + '/contents/' + path + '?ref=' + encodeURIComponent(gh.branch)); }
  async function put(path, content, message, isData) {
    for (let t = 0; t < 2; t++) {
      const body = { message, content, branch: gh.branch };
      if (isData && gh.sha) body.sha = gh.sha;
      try { return await api('/repos/' + gh.repo + '/contents/' + path, { method: 'PUT', body: JSON.stringify(body) }); }
      catch (e) { if (isData && (e.status === 409 || e.status === 422) && !t) { gh.sha = (await fetchFile(path)).sha; continue; } throw e; }
    }
  }
  const parseSite = t => JSON.parse(t.slice(t.indexOf('{'), t.lastIndexOf('}') + 1));
  function norm(d) {
    d = d || {};
    d.meta = d.meta || {}; d.theme = Object.assign({ accent: '#C9A24B', mode: 'dark', toggle: true }, d.theme);
    d.design = Object.assign({ bg:'', bg2:'', surface:'', surface2:'', ink:'', muted:'', line:'', bodyFont:'Plex', headingFont:'Kufi', bodySize:19, headingScale:1, contentWidth:1200, sectionSpace:110, cardRadius:22, cardGap:24, cardRatio:'4/3', buttonRadius:999, shadow:1 }, d.design);
    d.hero = d.hero || {}; d.about = d.about || {}; d.about.photos = Array.isArray(d.about.photos) ? d.about.photos : []; d.contact = d.contact || {}; d.contact.socials = d.contact.socials || []; d.contact.steps = Array.isArray(d.contact.steps) ? d.contact.steps : []; d.contact.when = Array.isArray(d.contact.when) ? d.contact.when : ['مستعجل', 'خلال أسبوع', 'مفيش استعجال']; d.contact.form = d.contact.form || {}; d.faq = Array.isArray(d.faq) ? d.faq : []; d.labels = d.labels || {}; d.show = d.show || {};
    ['stats', 'skills', 'categories', 'projects', 'why', 'testimonials', 'packages'].forEach(k => { if (!Array.isArray(d[k])) d[k] = []; });
    d.pricingPolicy = d.pricingPolicy || {}; if (!Array.isArray(d.pricingPolicy.points)) d.pricingPolicy.points = [];
    d.about.facts = Array.isArray(d.about.facts) ? d.about.facts : []; d.hero.facts = Array.isArray(d.hero.facts) ? d.hero.facts : []; d.seo = d.seo || {};
    return d;
  }
  const isDirty = () => !!S && JSON.stringify(S) !== orig;

  async function connect(repo, token) {
    gh.repo = String(repo || '').trim();
    gh.token = token;
    if (!/^[\w.-]+\/[\w.-]+$/.test(gh.repo)) throw new Error('إعدادات السيرفر ناقصة (REPO).');
    const r = await api('/repos/' + gh.repo);
    gh.branch = r.default_branch || 'main';
    let f;
    try { f = await fetchFile('data/site.js'); }
    catch (e) { if (e.status === 404) throw new Error('الريبو موجود بس مش لاقي data/site.js جواه. تأكد إنك رفعت كل ملفات الموقع.'); throw e; }
    gh.sha = f.sha;
    S = norm(parseSite(unb64(f.content)));
    orig = JSON.stringify(S);
    try { sessionStorage.setItem('sx.admin.sess', JSON.stringify({ repo: gh.repo, token: gh.token })); } catch (e) {}
    LS.del('token');
    const owner = gh.repo.split('/')[0], name = gh.repo.split('/')[1];
    siteUrl = location.hostname.endsWith('github.io') || location.hostname === 'localhost' ? new URL('../', location.href).href : 'https://' + owner.toLowerCase() + '.github.io/' + (name.toLowerCase() === owner.toLowerCase() + '.github.io' ? '' : name + '/');
    api('/repos/' + gh.repo + '/pages').then(p => { if (p && p.html_url) { siteUrl = p.html_url; $('#openSite').href = siteUrl; } }).catch(() => {});
  }

  /* ---------- UI helpers ---------- */
  function toast(msg, bad) {
    const t = document.createElement('div'); t.className = 'toast' + (bad ? ' bad' : '');
    t.innerHTML = I(bad ? 'alert' : 'check') + '<span>' + esc(msg) + '</span>'; $('#toasts').appendChild(t); setTimeout(() => t.remove(), bad ? 6000 : 3000);
  }
  function note(html, kind) { const n = $('#notice'); if (!html) { n.hidden = true; return; } n.hidden = false; n.className = 'notice ' + (kind || ''); n.innerHTML = html; }
  function ask(text, ok = 'تأكيد', danger = true) {
    return new Promise(res => {
      const d = $('#dlg');
      d.innerHTML = '<div class="db" style="padding:28px 24px"><h2 style="margin-bottom:10px">' + esc(text) + '</h2></div><div class="df"><button class="btn ' + (danger ? 'danger' : 'primary') + '" id="yes">' + esc(ok) + '</button><button class="btn ghost" id="no">إلغاء</button></div>';
      d.onclose = () => res(d.returnValue === 'y'); $('#yes', d).onclick = () => { d.returnValue = 'y'; d.close('y'); }; $('#no', d).onclick = () => { d.returnValue = ''; d.close(''); };
      d.showModal();
    });
  }
  const imgSrc = p => !p ? '' : imgs.has(p) ? imgs.get(p).dataUrl : /^(https?:|data:)/i.test(p) ? p : '../' + p;
  const imgList = p => (Array.isArray(p.images) && p.images.length ? p.images : (p.image ? [p.image] : [])).filter(Boolean);
  const catName = id => (S.categories.find(c => c.id === id) || { name: '—' }).name;
  const catIcon = id => (S.categories.find(c => c.id === id) || { icon: 'image' }).icon;
  const thumb = (p, round) => '<div class="th' + (round ? ' round' : '') + '">' + (p ? '<img src="' + esc(imgSrc(p)) + '" alt="" onerror="this.remove()">' : '') + '</div>';

  async function processImage(file, max, jpg) {
    const url = URL.createObjectURL(file);
    const im = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('الصورة دي مش مدعومة. جرّب JPG أو PNG أو WebP.')); i.src = url; });
    let w = im.naturalWidth || im.width, h = im.naturalHeight || im.height; const k = Math.min(1, max / Math.max(w, h));
    w = Math.round(w * k); h = Math.round(h * k);
    const c = document.createElement('canvas'); c.width = w; c.height = h; const cx = c.getContext('2d'); if (jpg) { cx.fillStyle = '#fff'; cx.fillRect(0, 0, w, h); } cx.drawImage(im, 0, 0, w, h); URL.revokeObjectURL(url);
    let type = jpg ? 'image/jpeg' : 'image/webp', blob = await new Promise(r => c.toBlob(r, type, .86));
    if (!blob || blob.type !== type) { type = 'image/jpeg'; blob = await new Promise(r => c.toBlob(r, type, .88)); }
    const dataUrl = await new Promise(r => { const f = new FileReader(); f.onload = () => r(f.result); f.readAsDataURL(blob); });
    const path = 'images/uploads/' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5) + '.' + (type === 'image/webp' ? 'webp' : 'jpg');
    imgs.set(path, { dataUrl, b64: dataUrl.split(',')[1], done: false });
    return path;
  }

  /* حقل صورة قابل لإعادة الاستخدام: يرجّع HTML، وbindImageField يربطه */
  function imageField(id, label, val, round) {
    return '<label>' + label + '</label><div class="drop" id="' + id + '" data-val="' + esc(val || '') + '">' + thumb(val, round) + '<div class="c"><div class="btns"><button type="button" class="btn sm" data-pick>' + I('upload') + ' رفع صورة</button><button type="button" class="btn sm ghost danger" data-clear ' + (val ? '' : 'hidden') + '>' + I('trash') + ' إزالة</button></div><input type="text" dir="ltr" data-url placeholder="أو الصق رابط صورة https://…" value="' + (/^https?:/i.test(val || '') ? esc(val) : '') + '"><small class="h">الصورة بتتصغّر وتتضغط أوتوماتيك قبل الرفع.</small></div><input type="file" accept="image/*" hidden></div>';
  }
  function bindImageField(el, max, onChange, jpg) {
    const set_ = v => { el.dataset.val = v || ''; $('.th', el).innerHTML = v ? '<img src="' + esc(imgSrc(v)) + '" alt="" onerror="this.remove()">' : ''; $('[data-clear]', el).hidden = !v; onChange(v || ''); };
    const fi = $('input[type=file]', el);
    $('[data-pick]', el).onclick = () => fi.click();
    $('[data-clear]', el).onclick = () => { $('[data-url]', el).value = ''; set_(''); };
    $('[data-url]', el).oninput = e => { const v = e.target.value.trim(); if (!v || /^https?:\/\//i.test(v)) set_(v); };
    const take = async f => { if (!f) return; try { set_(await processImage(f, max, jpg)); $('[data-url]', el).value = ''; } catch (e) { toast(e.message, true); } };
    fi.onchange = () => take(fi.files[0]);
    el.ondragover = e => { e.preventDefault(); el.classList.add('over'); }; el.ondragleave = () => el.classList.remove('over');
    el.ondrop = e => { e.preventDefault(); el.classList.remove('over'); take(e.dataTransfer.files[0]); };
  }

  /* معرض صور العمل: رفع أكتر من صورة، ترتيب، غلاف، حذف، ولصق روابط */
  function galleryField(id, label, note) {
    return '<label>' + (label || 'صور العمل') + ' <small class="h" style="font-weight:400">' + (note || '— أول صورة هي الغلاف اللي بتظهر في الكارت') + '</small></label>' +
      '<div class="gal" id="' + id + '"><div class="gl" data-gl></div>' +
      '<div class="ga"><button type="button" class="btn sm" data-add>' + I('upload') + ' رفع صور (تقدر تختار كذا صورة مرة واحدة)</button>' +
      '<textarea dir="ltr" data-urls rows="2" placeholder="أو الصق روابط صور — رابط في كل سطر"></textarea>' +
      '<button type="button" class="btn sm ghost" data-addurls>' + I('plus') + ' إضافة الروابط</button>' +
      '<small class="h">اسحب الصور هنا أو اضغط رفع. الصور بتتصغّر وتتضغط أوتوماتيك. استخدم الأسهم لترتيبها (ونجمة لتعيين الأولى).</small></div>' +
      '<input type="file" accept="image/*" multiple hidden></div>';
  }
  function bindGallery(el, arr, max, onChange) {
    const gl = $('[data-gl]', el), fi = $('input[type=file]', el);
    const paint = () => {
      gl.innerHTML = arr.length ? arr.map((v, k) => '<div class="gi' + (k === 0 ? ' cover' : '') + '" data-k="' + k + '"><div class="th"><img src="' + esc(imgSrc(v)) + '" alt="" onerror="this.remove()"></div>' +
        '<span class="gn">' + (k === 0 ? 'الغلاف' : (k + 1)) + '</span><div class="gb">' +
        '<button type="button" class="ib" data-gm="-1" aria-label="قدّم" title="قدّم" ' + (k === 0 ? 'disabled' : '') + '>' + I('up') + '</button>' +
        '<button type="button" class="ib" data-gm="1" aria-label="أخّر" title="أخّر" ' + (k === arr.length - 1 ? 'disabled' : '') + '>' + I('down') + '</button>' +
        (k === 0 ? '' : '<button type="button" class="ib" data-gc aria-label="خليها الغلاف" title="خليها الغلاف">' + I('star') + '</button>') +
        '<button type="button" class="ib bad" data-gd aria-label="احذف" title="احذف">' + I('trash') + '</button></div></div>').join('') : '<div class="gempty">لسه مفيش صور. ارفع صور العمل كلها هنا.</div>';
      onChange(arr.slice());
    };
    gl.onclick = e => {
      const it = e.target.closest('.gi'); if (!it) return; const k = +it.dataset.k;
      const m = e.target.closest('[data-gm]');
      if (m) { moveIdx(arr, k, k + +m.dataset.gm); paint(); }
      else if (e.target.closest('[data-gc]')) { moveIdx(arr, k, 0); paint(); }
      else if (e.target.closest('[data-gd]')) { arr.splice(k, 1); paint(); }
    };
    const take = async files => {
      files = [...files].filter(f => /^image\//.test(f.type)); if (!files.length) return;
      let n = 0;
      for (const f of files) { try { arr.push(await processImage(f, max)); n++; paint(); } catch (e) { toast(e.message, true); } }
      if (n > 1) toast('اتضافت ' + n + ' صور ✓');
    };
    $('[data-add]', el).onclick = () => fi.click();
    fi.onchange = async () => { await take(fi.files); fi.value = ''; };
    $('[data-addurls]', el).onclick = () => {
      const ta = $('[data-urls]', el), u = ta.value.split(/\s+/).map(x => x.trim()).filter(x => /^https?:\/\//i.test(x));
      if (!u.length) { toast('الصق رابط صورة واحد على الأقل (يبدأ بـ https://)', true); return; }
      u.forEach(x => { if (!arr.includes(x)) arr.push(x); }); ta.value = ''; paint();
    };
    el.ondragover = e => { e.preventDefault(); el.classList.add('over'); }; el.ondragleave = () => el.classList.remove('over');
    el.ondrop = e => { e.preventDefault(); el.classList.remove('over'); take(e.dataTransfer.files); };
    paint();
  }

  /* ---------- state / bar ---------- */
  function updateBar() {
    const d = isDirty();
    const st = $('#status'); st.className = 'status' + (d ? ' dirty' : ''); st.textContent = d ? 'فيه تعديلات لسه متنشرتش' : 'كل حاجة منشورة';
    $('#btnPublish').disabled = !d || busy; $('#btnDiscard').disabled = !d || busy;
    $('#btnPublish').innerHTML = I('rocket') + '<span>' + (busy ? 'جاري النشر…' : 'نشر التعديلات') + '</span>';
    updateNav();
  }
  function updateNav() {
    if (!S) return;
    const c = { works: S.projects.length, cats: S.categories.length, pricing: S.packages.length, proof: S.why.length + S.testimonials.length };
    $$('#nav button').forEach(b => { const e = $('.cnt', b); if (e) e.textContent = c[b.dataset.v]; });
  }
  const closeMenu = () => { $('#side').classList.remove('open'); $('#scrim').classList.remove('on'); };
  const openMenu = () => { $('#side').classList.add('open'); $('#scrim').classList.add('on'); };
  let pt = 0;
  function touch() { updateBar(); clearTimeout(pt); pt = setTimeout(pushPreview, 120); }
  function previewData() {
    const c = JSON.parse(JSON.stringify(S));
    const fix = p => (p && imgs.has(p)) ? imgs.get(p).dataUrl : p;
    c.hero.photo = fix(c.hero.photo); c.about.photos = (c.about.photos || []).map(fix); c.projects.forEach(p => { p.images = imgList(p).map(fix); p.image = p.images[0] || ''; });
    c.projects.forEach(p => { if (p.video && vids.has(p.video)) p.video = vids.get(p.video).url; });
    return c;
  }
  function pushPreview() {
    const f = $('#pframe'); if ($('#preview').hidden || !f.contentWindow) return;
    f.contentWindow.postMessage({ type: 'sx-preview', data: previewData() }, location.origin);
  }
  addEventListener('message', e => { if (e.origin === location.origin && e.data && e.data.type === 'sx-ready') pushPreview(); });
  addEventListener('beforeunload', e => { if (isDirty()) { e.preventDefault(); e.returnValue = ''; } });

  /* ---------- publish ---------- */
  const allImages = () => [S.hero.photo, S.seo && S.seo.ogImage].concat(S.about.photos || [], ...S.projects.map(imgList)).filter(Boolean);
  const okUrl = u => !u || /^https?:\/\/\S+$/i.test(String(u).trim());
  function validate() {
    const o = [];
    S.projects.forEach((p, i) => { const n = '«' + (p.title || ('عمل رقم ' + (i + 1))) + '»'; if (!String(p.title || '').trim()) o.push('عمل رقم ' + (i + 1) + ' من غير عنوان.'); if (!okUrl(p.link)) o.push('رابط ' + n + ' لازم يبدأ بـ https://'); if (p.video && !/^(https?:\/\/|videos\/)/i.test(p.video)) o.push('فيديو ' + n + ' مش رابط صالح.'); (p.links || []).forEach(x => { if (x && x.url && !okUrl(x.url)) o.push('أحد روابط ' + n + ' لازم يبدأ بـ https://'); }); });
    S.categories.forEach((c, i) => { if (!String(c.name || '').trim()) o.push('قسم رقم ' + (i + 1) + ' من غير اسم.'); });
    S.packages.forEach((k, i) => { if (!String(k.name || '').trim()) o.push('باقة رقم ' + (i + 1) + ' من غير اسم (مش هتظهر).'); });
    S.why.forEach((w, i) => { if (!String(w.t || '').trim() && (w.d || '').trim()) o.push('نقطة «ليه أنا» رقم ' + (i + 1) + ' من غير عنوان (مش هتظهر).'); });
    S.testimonials.forEach((t, i) => { if (!String(t.text || '').trim()) o.push('رأي العميل رقم ' + (i + 1) + ' من غير نص (مش هيظهر).'); else if (!okUrl(t.link)) o.push('رابط رأي «' + (t.name || (i + 1)) + '» لازم يبدأ بـ https://'); });
    S.contact.socials.forEach((x, i) => { if (!okUrl(x.url)) o.push('رابط ' + (x.name || 'حساب سوشيال رقم ' + (i + 1)) + ' لازم يبدأ بـ https://'); });
    const em = String(S.contact.email || '').trim(); if (em && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) o.push('الإيميل مش مكتوب صح.');
    const wa = String(S.contact.whatsapp || '').trim(); if (wa && !/^\d{8,15}$/.test(wa)) o.push('رقم واتساب لازم أرقام بس، بكود الدولة وبدون + وبدون صفر.');
    return o;
  }
  async function publish() {
    if (busy || !isDirty()) return;
    const bad = validate(); if (bad.length) { note(I('alert') + '<span><b>راجع الحاجات دي قبل النشر:</b><br>' + bad.map(esc).join('<br>') + '</span>', 'bad'); toast('فيه بيانات محتاجة تصليح', true); return; }
    busy = true; updateBar();
    try {
      const used = new Set(allImages());
      const todo = [...imgs].filter(([p, v]) => !v.done && used.has(p));
      let n = 0;
      for (const [p, v] of todo) { note('<span class="sp"></span>جاري رفع الصور… (' + (++n) + '/' + todo.length + ')'); await put(p, v.b64, 'إضافة صورة من لوحة التحكم'); v.done = true; }
      const usedV = new Set(S.projects.map(q => q.video).filter(Boolean)), vt = [...vids].filter(([q, v]) => !v.done && usedV.has(q)); let m = 0;
      for (const [q, v] of vt) { note('<span class="sp"></span>جاري رفع الفيديو… (' + (++m) + '/' + vt.length + ')'); try { await put(q, v.b64, 'إضافة فيديو من لوحة التحكم'); } catch (e) { if ([400, 403, 413].includes(e.status)) throw new Error('رفع ملف الفيديو اترفض. لازم تحدّث الـWorker (ملف worker/worker.js) أو الفيديو كبير. الأسهل ترفعه على يوتيوب وتلصق الرابط.'); throw e; } v.done = true; }
      note('<span class="sp"></span>جاري حفظ المحتوى…');
      const r = await put('data/site.js', b64('window.SITE=' + JSON.stringify(S, null, 1) + ';\n'), 'تحديث محتوى الموقع من لوحة التحكم', true);
      gh.sha = r.content.sha; orig = JSON.stringify(S); lastPub = new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
      toast('اتحفظ على GitHub ✓'); watchBuild(r.commit.sha);
    } catch (e) { note(I('alert') + '<span>' + esc(explain(e)) + '</span>', 'bad'); toast('فشل النشر', true); }
    finally { busy = false; updateBar(); }
  }
  async function watchBuild(sha) {
    const my = ++buildTok;
    note('<span class="sp"></span><span>جاري النشر على الموقع… (عادةً أقل من دقيقة)</span>');
    for (let k = 0; k < 45 && my === buildTok; k++) {
      await sleep(4000);
      try {
        const b = await api('/repos/' + gh.repo + '/pages/builds/latest');
        if (b.commit === sha && b.status === 'built') { note(I('check') + '<span>الموقع اتحدّث ✓ — لو مش باين اعمل تحديث للصفحة.</span>', 'ok'); return; }
        if (b.commit === sha && b.status === 'errored') { note(I('alert') + '<span>GitHub Pages رجّع خطأ في النشر. شوف تبويب Actions في الريبو.</span>', 'bad'); return; }
      } catch (e) { note(I('check') + '<span>اتحفظ ✓ — التعديل هيظهر على الموقع خلال دقيقة تقريبًا.</span>', 'ok'); return; }
    }
    if (my === buildTok) note(I('info') + '<span>اتحفظ ✓ — النشر أخد وقت أطول من المعتاد، هيظهر قريب.</span>');
  }

  /* ---------- sortable ---------- */
  function sortable(root, arr, done) {
    let from = null;
    root.addEventListener('pointerdown', e => { const g = e.target.closest('.grip'); if (g) g.closest('[data-i]').draggable = true; });
    root.addEventListener('dragstart', e => { const r = e.target.closest('[data-i]'); if (!r || !r.draggable) return; from = +r.dataset.i; r.classList.add('drag'); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', String(from)); });
    root.addEventListener('dragover', e => { if (from == null) return; e.preventDefault(); $$('.over', root).forEach(x => x.classList.remove('over')); const r = e.target.closest('[data-i]'); if (r) r.classList.add('over'); });
    root.addEventListener('drop', e => { e.preventDefault(); const r = e.target.closest('[data-i]'); if (r && from != null && +r.dataset.i !== from) { const a = arr(); a.splice(+r.dataset.i, 0, a.splice(from, 1)[0]); done(); } from = null; });
    root.addEventListener('dragend', () => { from = null; $$('[data-i]', root).forEach(x => { x.draggable = false; x.classList.remove('drag', 'over'); }); });
  }
  const moveIdx = (a, i, j) => { if (j < 0 || j >= a.length) return; a.splice(j, 0, a.splice(i, 1)[0]); };

  /* ---------- views ---------- */
  function vHome() {
    const P = S.projects, hid = P.filter(p => p.visible === false).length;
    const tips = [];
    if (!S.hero.photo) tips.push(['user', 'لسه مفيش صورة شخصية — الموقع بيعرض حرف بدلها.', 'content', 'أضف صورة']);
    S.categories.forEach(c => { if (!P.some(p => p.category === c.id && p.visible !== false)) tips.push(['folder', 'قسم «' + c.name + '» مفيهوش أعمال ظاهرة.', 'works', 'أضف عمل']); });
    const one = P.filter(p => p.visible !== false && imgList(p).length < 2 && (S.categories.find(c => c.id === p.category) || {}).type !== 'video').length;
    if (one) tips.push(['image', one + ' عمل فيهم صورة واحدة بس — أضف باقي صور العمل عشان يظهر كأنه كتالوج كامل.', 'works', 'راجعها']);
    if (hid) tips.push(['eyeoff', hid + ' عمل مخفي عن الزوار.', 'works', 'راجعها']);
    if (!S.packages.some(k => k.visible !== false && k.name)) tips.push(['star', 'مفيش باقات ظاهرة — قسم الباقات والأسعار مخفي.', 'pricing', 'أضف باقة']);
    if (!S.stats.length) tips.push(['star', 'تقدر تضيف أرقام (سنين خبرة، عدد عملاء…) تظهر بشكل جذاب في الموقع.', 'content', 'أضف أرقام']);
    if (!S.meta.description) tips.push(['globe', 'اكتب وصف لمحركات البحث (SEO).', 'seo', 'اكتبه']);
    const vis = P.length - hid, nm = esc(S.hero.name || '');
    const chk = [['الصورة الشخصية', !!S.hero.photo, 'content'], ['نبذة عنك', !!String(S.about.text || '').trim(), 'content'], ['3 أعمال ظاهرة على الأقل', vis >= 3, 'works'], ['باقة ظاهرة', S.packages.some(k => k.visible !== false && k.name), 'pricing'], ['وسيلة تواصل', !!(S.contact.email || S.contact.whatsapp), 'contact'], ['حساب سوشيال', S.contact.socials.length > 0, 'contact'], ['«ليه أنا» أو آراء عملاء', S.testimonials.length + S.why.length > 0, 'proof'], ['وصف SEO', !!S.meta.description, 'seo'], ['أسئلة شائعة', S.faq.length > 0, 'texts']];
    const done = chk.filter(c => c[1]).length, pct = Math.round(done / chk.length * 100);
    const comp = '<div class="panel comp"><div class="comp-h"><div><h2>اكتمال الموقع</h2><p class="sub" style="margin:4px 0 0">' + done + ' من ' + chk.length + ' خطوات مكتملة' + (lastPub ? ' · آخر نشر الساعة ' + lastPub : '') + '</p></div><b class="pct">' + pct + '%</b></div><div class="pbar2"><i style="width:' + pct + '%"></i></div><div class="cchips">' + chk.map(c => '<button type="button" class="cc2' + (c[1] ? ' ok' : '') + '" data-go="' + c[2] + '">' + I(c[1] ? 'check' : 'plus') + c[0] + '</button>').join('') + '</div></div>';
    const qc = (ic, t, d, attr, pri) => '<button type="button" class="qc' + (pri ? ' pri' : '') + '" ' + attr + '><span class="ic">' + I(ic) + '</span><span><b>' + t + '</b><small>' + d + '</small></span></button>';
    const kpi = (ic, n, l, sub) => '<div class="kpi"><span class="ic">' + I(ic) + '</span><div><b>' + n + '</b><span>' + l + '</span>' + (sub ? '<small>' + sub + '</small>' : '') + '</div></div>';
    return '<section class="welcome"><div><span class="eyebrow">لوحة التحكم</span><h2>أهلاً بيك' + (nm ? ' يا ' + nm : '') + '</h2><p>عدّل أي حاجة في موقعك من هنا، وشوفها في المعاينة، وبعدين انشرها بضغطة واحدة.</p></div>' +
      '<div class="wa"><button class="btn primary" data-act="addWork">' + I('plus') + ' إضافة عمل جديد</button><button class="btn" data-act="preview">' + I('eye') + ' معاينة الموقع</button></div></section>' +
      '<figure class="kidfig"><div class="kb kb-r" role="note">مرحبا بك في لوحة التحكم الرئيسية في موقعك</div><div class="kidfig-s"><img src="kid.webp" alt="" width="558" height="1251" decoding="async"></div><div class="kb kb-l" role="note">هنا تقدر تعدل وتضيف كل اللي نفسك فيه</div></figure>' +
      comp + '<div class="cards">' + kpi('folder', P.length, 'عمل', vis + ' ظاهر للزوار') + kpi('grid', S.categories.length, 'قسم') + kpi('star', S.packages.length, 'باقة') + kpi('bolt', S.skills.length, 'أداة / مهارة') + '</div>' +
      '<div class="sec-h"><h2>إجراءات سريعة</h2><span>اختصارات لأكتر الحاجات استخدامًا</span></div>' +
      '<div class="qa">' + qc('user', 'الصفحة الرئيسية', 'الاسم والصورة والنبذة', 'data-go="content"') + qc('star', 'الباقات والأسعار', 'أضف أو عدّل باقاتك', 'data-go="pricing"') + qc('mail', 'بيانات التواصل', 'الإيميل وواتساب والسوشيال', 'data-go="contact"') + qc('sliders', 'المظهر والألوان', 'غيّر هوية الموقع', 'data-go="look"') + '</div>' +
      '<div class="sec-h"><h2>اقتراحات لتحسين الموقع</h2><span>' + (tips.length ? tips.length + ' اقتراح' : '') + '</span></div>' +
      '<div class="panel">' + (tips.length ? '<ul class="tips">' + tips.map(t => '<li>' + I(t[0]) + '<span>' + t[1] + '</span><button class="btn sm ghost" data-go="' + t[2] + '">' + t[3] + '</button></li>').join('') + '</ul>' : '<ul class="tips"><li class="good">' + I('check') + '<span>كل حاجة تمام، مفيش أي اقتراحات دلوقتي.</span></li></ul>') + '</div>' +
      '<div class="sec-h"><h2>إزاي بتشتغل اللوحة؟</h2></div>' +
      '<ol class="steps"><li><span><b>عدّل</b> أي حاجة (أعمال، نصوص، ألوان…) وشوف النتيجة في <b>«معاينة»</b>.</span></li><li><span>اضغط <b>«نشر التعديلات»</b> وهتتحفظ على GitHub.</span></li><li><span>الموقع بيتحدّث لوحده، والتعديل بيظهر خلال دقيقة تقريبًا.</span></li></ol>';
  }

  const matchW = (p, q) => (flt.cat === 'all' || p.category === flt.cat) && (!q || (p.title + ' ' + p.desc + ' ' + p.tag).toLowerCase().includes(q)) &&
    (flt.st === 'all' || (flt.st === 'vis' && p.visible !== false) || (flt.st === 'hid' && p.visible === false) || (flt.st === 'feat' && p.featured));
  function wChips() {
    const P = S.projects, c = { all: P.length, vis: P.filter(p => p.visible !== false).length, hid: P.filter(p => p.visible === false).length, feat: P.filter(p => p.featured).length };
    return [['all', 'الكل'], ['vis', 'ظاهر'], ['hid', 'مخفي'], ['feat', 'مميّز']].map(([k, l]) => '<button type="button" class="fc' + (flt.st === k ? ' on' : '') + '" data-st="' + k + '">' + l + ' <em>' + c[k] + '</em></button>').join('');
  }
  function listWorks() {
    const fch = $('#fch'); if (fch) fch.innerHTML = wChips();
    const pl = $('#plist'); if (pl) pl.classList.toggle('grid', flt.vw === 'grid');
    const q = flt.q.toLowerCase();
    const rows = S.projects.map((p, i) => [p, i]).filter(([p]) => matchW(p, q));
    if (!rows.length) return '<div class="empty"><span class="ei">' + I(S.projects.length ? 'search' : 'folder') + '</span><b>' + (S.projects.length ? 'مفيش نتائج' : 'لسه مفيش أعمال') + '</b><p>' + (S.projects.length ? 'جرّب تغيّر البحث أو الفلتر.' : 'اضغط «إضافة عمل» وابدأ بأول شغل ليك.') + '</p></div>';
    const grid = flt.vw === 'grid';
    return rows.map(([p, i], k) => {
      const im = imgList(p)[0], hid = p.visible === false, n = imgList(p).length;
      const bd = (p.video ? '<span class="badge">فيديو</span>' : '') + (n > 1 ? '<span class="badge">' + n + ' صور</span>' : '') + (p.featured ? '<span class="badge gold">مميّز</span>' : '') + (p.tag ? '<span class="badge">' + esc(p.tag) + '</span>' : '') + (hid ? '<span class="badge">مخفي</span>' : '');
      const btn = (a, ic, lb, dis, bad) => '<button class="ib' + (bad ? ' bad' : '') + '" data-act="' + a + '" data-i="' + i + '" aria-label="' + lb + '" title="' + lb + '" ' + (dis ? 'disabled' : '') + '>' + I(ic) + '</button>';
      const acts = '<div class="acts">' + btn('up', 'up', 'فوق', k === 0) + btn('down', 'down', 'تحت', k === rows.length - 1) + btn('vis', hid ? 'eyeoff' : 'eye', 'إظهار/إخفاء') + btn('editWork', 'edit', 'تعديل') + btn('dup', 'copy', 'نسخ') + btn('delWork', 'trash', 'حذف', false, true) + '</div>';
      const thumbH = im ? '<img src="' + esc(imgSrc(im)) + '" alt="" onerror="this.remove()">' : I(catIcon(p.category));
      if (grid) return '<div class="wc' + (hid ? ' hid' : '') + '" data-i="' + i + '"><div class="wc-img">' + thumbH + '<span class="grip" title="اسحب لإعادة الترتيب">' + I('grip') + '</span><div class="wc-b">' + bd + '</div></div><div class="wc-t"><div><b dir="auto">' + esc(p.title || 'بدون عنوان') + '</b><small>' + esc(catName(p.category)) + '</small></div></div>' + acts + '</div>';
      return '<div class="row' + (hid ? ' hid' : '') + '" data-i="' + i + '"><span class="grip" title="اسحب لإعادة الترتيب">' + I('grip') + '</span><div class="th">' + thumbH + '</div><div class="rt"><b dir="auto">' + esc(p.title || 'بدون عنوان') + '</b><small>' + esc(catName(p.category)) + '</small></div><div class="bdgs">' + bd + '</div>' + acts + '</div>';
    }).join('');
  }
  function vWorks() {
    return '<div class="toolbar"><input type="search" id="q" placeholder="ابحث في الأعمال…" value="' + esc(flt.q) + '"><select id="fc"><option value="all">كل الأقسام</option>' + S.categories.map(c => '<option value="' + esc(c.id) + '"' + (flt.cat === c.id ? ' selected' : '') + '>' + esc(c.name) + '</option>').join('') + '</select><span class="seg vw" role="group" aria-label="طريقة العرض"><button type="button" data-vw="list" title="قائمة" aria-label="قائمة" class="' + (flt.vw === 'list' ? 'on' : '') + '">' + I('menu') + '</button><button type="button" data-vw="grid" title="معرض" aria-label="معرض" class="' + (flt.vw === 'grid' ? 'on' : '') + '">' + I('grid') + '</button></span><button class="btn primary" data-act="addWork">' + I('plus') + ' إضافة عمل</button></div><div class="fchips" id="fch">' + wChips() + '</div><div class="list' + (flt.vw === 'grid' ? ' grid' : '') + '" id="plist">' + listWorks() + '</div>';
  }

  const parseLinks = t => String(t).split('\n').map(l => l.trim()).filter(Boolean).map(l => { const k = l.indexOf('|'); return k < 0 ? { label: '', url: l } : { label: l.slice(0, k).trim(), url: l.slice(k + 1).trim() }; });
  function editWork(i) {
    if (!S.categories.length) { toast('أضف قسم الأول من تبويب «الأقسام».', true); return; }
    const isNew = i < 0;
    const p = isNew ? { id: uid('p'), category: flt.cat !== 'all' ? flt.cat : S.categories[0].id, title: '', desc: '', link: '', image: '', images: [], tag: '', client: '', year: '', visible: true, featured: false } : Object.assign({}, S.projects[i]);
    let gal = imgList(p).slice();
    const d = $('#dlg');
    d.innerHTML = '<form method="dialog" id="wf"><div class="dh"><h2>' + (isNew ? 'إضافة عمل جديد' : 'تعديل العمل') + '</h2><button type="button" class="ib" id="x" aria-label="إغلاق">' + I('x') + '</button></div><div class="tabs" role="tablist"><button type="button" class="tab on" data-t="a">' + I('edit') + ' الأساسيات</button><button type="button" class="tab" data-t="b">' + I('image') + ' الصور والفيديو</button><button type="button" class="tab" data-t="c">' + I('phone') + ' تفاصيل التطبيق</button><button type="button" class="tab" data-t="d">' + I('eye') + ' الظهور</button></div><div class="db">' +
      '<div class="tp on" data-p="a"><label>العنوان<input id="w_t" required dir="auto" value="' + esc(p.title) + '"></label>' +
      '<div class="g2"><label>القسم<select id="w_c">' + S.categories.map(c => '<option value="' + esc(c.id) + '"' + (c.id === p.category ? ' selected' : '') + '>' + esc(c.name) + '</option>').join('') + '</select></label><label>وسم قصير (اختياري)<input id="w_g" placeholder="مثلًا: منيو، Android" value="' + esc(p.tag) + '"></label></div>' +
      '<div class="g2"><label>العميل أو الجهة (اختياري)<input id="w_cl" dir="auto" placeholder="مثلًا: مطعم بيتزا لبنان" value="' + esc(p.client || '') + '"></label><label>السنة (اختياري)<input id="w_yr" dir="ltr" inputmode="numeric" maxlength="4" placeholder="2026" value="' + esc(p.year || '') + '"></label></div>' +
      '<label>رابط خارجي (اختياري) <small class="h" style="font-weight:400">— الصور بتترفع من تبويب «الصور والفيديو» ومش محتاجة رابط</small><input id="w_l" dir="ltr" placeholder="https://" value="' + esc(p.link) + '"></label>' +
      '<label>وصف قصير (اختياري)<textarea id="w_d" rows="2">' + esc(p.desc) + '</textarea></label>' +
      '</div><div class="tp" data-p="c"><label class="sw"><input type="checkbox" id="w_app"' + (p.layout === 'app' ? ' checked' : '') + '>عرض كتطبيق / لعبة (لقطات موبايل + مميزات + فيديو)</label>' +
      '<div class="g2"><label>الحالة (اختياري)<input id="w_st" dir="auto" placeholder="مثلًا: منشور على المتجر" value="' + esc(p.status || '') + '"></label><label>الأدوات (بفاصلة)<input id="w_tl" dir="auto" placeholder="Flutter, Dart, Android" value="' + esc((p.tools || []).join(', ')) + '"></label></div>' +
      '<label>المميزات (ميزة في كل سطر)<textarea id="w_ft" rows="4" dir="auto">' + esc((p.features || []).join('\n')) + '</textarea></label>' +
      '<label>روابط إضافية <small class="h" style="font-weight:400">— سطر لكل رابط: اسم الزر | الرابط (بتظهر في عرض التطبيقات)</small><textarea id="w_lk" rows="3" dir="ltr" placeholder="Google Play | https://play.google.com/…">' + esc((p.links || []).map(x => (x.label || '') + ' | ' + (x.url || '')).join('\n')) + '</textarea></label>' +
      '</div><div class="tp" data-p="b"><label>فيديو عن العمل <small class="h" style="font-weight:400">— رابط يوتيوب أو فيميو أو mp4، أو ارفع ملف (لحد 6MB)</small></label><div class="gal" id="w_vid"><div class="ga"><button type="button" class="btn sm" data-vpick>' + I('upload') + ' رفع فيديو</button><button type="button" class="btn sm ghost danger" data-vclear ' + (p.video ? '' : 'hidden') + '>' + I('trash') + ' إزالة</button><input type="text" dir="ltr" id="w_vu" placeholder="https://youtube.com/…" value="' + (/^https?:/i.test(p.video || '') ? esc(p.video) : '') + '"><small class="h" id="w_vn">' + (p.video && !/^https?:/i.test(p.video) ? 'فيديو مرفوع: ' + esc(p.video) : '') + '</small></div><input type="file" accept="video/mp4,video/webm" hidden></div>' +
      galleryField('w_gal') +
      '</div><div class="tp" data-p="d"><label class="sw"><input type="checkbox" id="w_v"' + (p.visible !== false ? ' checked' : '') + '>ظاهر في الموقع</label><label class="sw"><input type="checkbox" id="w_f"' + (p.featured ? ' checked' : '') + '>عمل مميّز (كارت أكبر)</label></div></div>' +
      '<div class="df"><button class="btn primary" type="submit">' + I('check') + ' حفظ</button><button class="btn ghost" type="button" id="cx">إلغاء</button></div></form>';
    d.onclose = null;
    const tab = k => { $$('.tab', d).forEach(x => x.classList.toggle('on', x.dataset.t === k)); $$('.tp', d).forEach(x => x.classList.toggle('on', x.dataset.p === k)); };
    $$('.tab', d).forEach(x => x.onclick = () => tab(x.dataset.t)); $('#w_t', d).addEventListener('invalid', () => tab('a'));
    bindGallery($('#w_gal', d), gal, 1600, v => { p.images = v; });
    let vurl = p.video || '';
    const vb = $('#w_vid', d), vfi = $('input[type=file]', vb), vn = $('#w_vn', d), vc = $('[data-vclear]', vb);
    const setV = (v, t) => { vurl = v || ''; vc.hidden = !vurl; vn.textContent = t || ''; };
    $('[data-vpick]', vb).onclick = () => vfi.click();
    vc.onclick = () => { $('#w_vu', d).value = ''; vfi.value = ''; setV(''); };
    $('#w_vu', d).oninput = e => { const v = e.target.value.trim(); if (!v || /^https?:\/\//i.test(v)) setV(v); };
    vfi.onchange = () => {
      const f = vfi.files[0]; if (!f) return;
      if (f.size > 6 * 1024 * 1024) { toast('الفيديو أكبر من 6MB. ارفعه على يوتيوب والصق الرابط.', true); vfi.value = ''; return; }
      const fr = new FileReader();
      fr.onload = () => { const path = 'videos/uploads/' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5) + '.' + (/webm/.test(f.type) ? 'webm' : 'mp4'); vids.set(path, { b64: String(fr.result).split(',')[1], url: URL.createObjectURL(f), done: false }); $('#w_vu', d).value = ''; setV(path, 'جاهز للرفع: ' + f.name + ' — اضغط حفظ ثم نشر'); };
      fr.onerror = () => toast('معرفتش أقرأ ملف الفيديو', true); fr.readAsDataURL(f);
    };
    const close = () => d.close(); $('#x', d).onclick = close; $('#cx', d).onclick = close;
    $('#wf', d).onsubmit = e => {
      e.preventDefault();
      p.images = gal.slice(); p.image = p.images[0] || '';
      Object.assign(p, { title: $('#w_t').value.trim(), category: $('#w_c').value, tag: $('#w_g').value.trim(), client: $('#w_cl').value.trim(), year: $('#w_yr').value.replace(/[^0-9]/g, '').slice(0, 4), link: $('#w_l').value.trim(), desc: $('#w_d').value.trim(), visible: $('#w_v').checked, featured: $('#w_f').checked, layout: $('#w_app').checked ? 'app' : '', status: $('#w_st').value.trim(), tools: $('#w_tl').value.split(/[,،]/).map(x => x.trim()).filter(Boolean), features: $('#w_ft').value.split('\n').map(x => x.trim()).filter(Boolean), links: parseLinks($('#w_lk').value), video: vurl });
      if (isNew) S.projects.unshift(p); else S.projects[i] = p;
      d.close(); touch(); if (view === 'works') { $('#plist').innerHTML = listWorks(); } else go('works');
      toast(isNew ? 'اتضاف ✓ (لسه محتاج نشر)' : 'اتعدّل ✓ (لسه محتاج نشر)');
    };
    d.showModal(); $('#w_t').focus();
  }

  const TXT = [["القائمة العلوية", [["navWork", "أعمالي", "أعمالي"], ["navServices", "خدماتي", "خدماتي"], ["navAbout", "عني", "عني"], ["navFaq", "أسئلة", "أسئلة"], ["navContact", "تواصل", "تواصل"], ["navPricing", "الباقات", "الباقات"], ["navProof", "ليه أنا", "ليه أنا"]]], ["قسم «بشتغل في إيه؟»", [["servicesTitle", "العنوان", "بشتغل في إيه؟"], ["servicesSub", "الجملة تحت العنوان", "اختار المجال وشوف شغلي فيه."], ["svcSee", "نص «شوفهم» في الصندوق", "شوفهم"], ["svcSoon", "نص القسم الفاضي", "قريبًا"], ["svcAsk", "زر طلب الخدمة", "اطلب الخدمة"]]], ["قسم «أعمالي»", [["workTitle", "العنوان", "أعمالي"], ["workSub", "الجملة تحت العنوان", "اضغط على أي عمل تشوفه بالحجم الكامل."], ["workMore", "زر صفحة الأعمال", "شوف صفحة الأعمال كاملة"], ["filterAll", "فلتر «الكل»", "الكل"], ["cardGoImg", "رابط الكارت (صور)", "شوف العمل"], ["cardGoVid", "رابط الكارت (فيديو)", "شاهد العمل"], ["emptyWorks", "لما مفيش أعمال", "لسه مفيش أعمال."]]], ["قسم الباقات والأسعار", [["pricingTitle", "العنوان", "الباقات والأسعار"], ["pricingSub", "الجملة تحت العنوان", "اختار الخدمة وشوف إيه اللي هتستلمه، والسعر بيتحدد حسب شغلك."], ["pkAsk", "زر الباقة", "تواصل معايا"], ["pkFrom", "كلمة قبل السعر", "ابتداءً من"], ["pkCustom", "لما مفيش سعر", "السعر حسب المشروع"]]], ["قسم «ليه أنا» وآراء العملاء", [["proofTitle", "العنوان", "ليه تشتغل معايا؟"], ["proofSub", "الجملة تحت العنوان", "حاجات بتفرق معاك في الشغل."], ["tstTitle", "عنوان آراء العملاء", "عملاء اشتغلت معاهم"]]], ["كروت التطبيقات والفيديو", [["cardGoApp", "زر تفاصيل التطبيق (الرئيسية)", "شوف تفاصيل التطبيق"], ["scShots", "تبويب اللقطات", "اللقطات"], ["scVideo", "تبويب الفيديو", "الفيديو"], ["scWatch", "زر شاهد الفيديو", "شاهد الفيديو"], ["wkOpenProj", "زر الرابط الافتراضي", "افتح المشروع"], ["wkVidBadge", "شارة الفيديو", "فيديو"]]], ["صفحة الأعمال (works)", [["wkEyebrow", "السطر الصغير", "معرض الأعمال"], ["wkTitle", "العنوان", "أعمالي"], ["wkSub", "الجملة تحت العنوان", "كل شغلي في مكان واحد. اختار القسم، واضغط على أي عمل تشوفه بالحجم الكامل."], ["wkNavHome", "رابط الرئيسية", "الرئيسية"], ["wkNavWorks", "رابط الأعمال", "الأعمال"], ["wkNavContact", "رابط التواصل", "تواصل"], ["wkGoImg", "زر العمل (صورة)", "شوف العمل"], ["wkGoGal", "زر العمل (عدة صور)", "تصفّح الصور"], ["wkGoVid", "زر العمل (فيديو)", "شاهد"], ["wkGoApp", "زر العمل (تطبيق)", "تفاصيل التطبيق"], ["wkEmpty", "لما القسم فاضي", "لسه مفيش أعمال في القسم ده."], ["wkOpenOrig", "رابط المشروع الأصلي", "افتح المشروع الأصلي"], ["wkPlayVid", "زر تشغيل الفيديو", "شغّل الفيديو"], ["wkOpenLink", "رابط افتراضي", "افتح الرابط"], ["wkSeeShots", "زر اللقطات", "شوف اللقطات"], ["wkWatchApp", "زر فيديو التطبيق", "شاهد فيديو التطبيق"]]], ["قسم «عني»", [["aboutSkills", "عنوان الأدوات", "الأدوات اللي بشتغل بيها"], ["aboutSpecs", "تسمية التخصصات", "التخصصات"], ["aboutBtn1", "الزر الأول", "كلمني"], ["aboutBtn2", "الزر التاني", "كل أعمالي"]]], ["أرقام الهيرو", [["factWorks", "بجانب عدد الأعمال", "أعمال"], ["factCats", "بجانب عدد المجالات", "مجالات"], ["factTools", "بجانب عدد الأدوات", "أدوات"]]], ["الأسئلة الشائعة", [["faqTitle", "العنوان", "أسئلة شائعة"], ["faqSub", "الجملة تحت العنوان", "إجابات سريعة قبل ما نتكلم."]]], ["نموذج التواصل", [["formTitle", "عنوان النموذج", "ابعتلي رسالتك"], ["formHint", "الجملة تحت عنوان النموذج", "اكتب تفاصيل شغلك وهتتجهز رسالة جاهزة تبعتها لي بضغطة واحدة."], ["formName", "عنوان خانة الاسم", "اسمك"], ["formNamePh", "نص إرشادي للاسم", "اكتب اسمك"], ["formSvc", "عنوان اختيار الخدمة", "محتاج إيه؟"], ["formWhen", "عنوان اختيار الميعاد", "الميعاد المطلوب"], ["formMsg", "عنوان خانة التفاصيل", "تفاصيل شغلك"], ["formPreview", "عنوان معاينة الرسالة", "الرسالة اللي هتتبعت"], ["formPreviewEmpty", "معاينة الرسالة وهي فاضية", "رسالتك هتظهر هنا وانت بتكتب."], ["msgSvc", "سطر الخدمة جوه الرسالة", "محتاج:"], ["msgWhen", "سطر الميعاد جوه الرسالة", "الميعاد:"], ["mailSubject", "عنوان رسالة الإيميل", "طلب شغل"]]], ["كروت التواصل", [["ccAvail", "كارت التوفر", "متاح دلوقتي"], ["ccWa", "كارت واتساب", "واتساب"], ["ccMail", "كارت الإيميل", "الإيميل"], ["ccCopy", "زر النسخ", "نسخ"], ["socTitle", "عنوان حسابات السوشيال", "تلاقيني كمان على"]]], ["رسائل صغيرة والفوتر", [["toastCopied", "بعد نسخ الإيميل", "اتنسخ الإيميل ✓"], ["toastNeed", "لو التفاصيل فاضية", "اكتب تفاصيل شغلك الأول"], ["toastReady", "بعد تجهيز الرسالة", "اتجهّزت الرسالة ✓"], ["footUp", "رابط الفوتر", "للأعلى"]]]];
  function faqList() { return simpleList('faq', S.faq, [['q', 'السؤال', 'n'], ['a', 'الإجابة', '', 'ta']]); }
  function vTexts() {
    const sh = S.show || {}, lb = S.labels || {};
    const SEC = [['services', 'بشتغل في إيه؟ (الخدمات)'], ['work', 'أعمالي'], ['pricing', 'الباقات والأسعار'], ['about', 'عني'], ['proof', 'ليه أنا وآراء العملاء'], ['faq', 'الأسئلة الشائعة'], ['contact', 'التواصل']];
    return '<div class=\"panel\"><h2>إظهار وإخفاء الأقسام</h2><p class="sub">اقفل أي قسم مش عايزه يظهر في الصفحة الرئيسية.</p><div class="g2">' + SEC.map(s => '<label class="sw"><input type="checkbox" data-b="show.' + s[0] + '"' + (sh[s[0]] !== false ? ' checked' : '') + '>' + s[1] + '</label>').join('') + '</div></div>' +
      '<div class="panel"><h2>الأسئلة الشائعة</h2><p class="sub">بتظهر كأكورديون قبل التواصل. لو فاضية القسم بيختفي.</p>' + faqList() + '<button class="btn sm" data-act="ladd" data-p="faq">' + I('plus') + ' إضافة سؤال</button></div>' +
      '<p style="color:var(--muted);margin:22px 0 0">كل النصوص الثابتة في الصفحة الرئيسية. سيب أي خانة فاضية لو عايز النص الأصلي (الظاهر باهت جواها).</p>' +
      TXT.map(g => '<div class="panel"><h2>' + g[0] + '</h2><div class="g2">' + g[1].map(f => '<label>' + f[1] + '<input data-b="labels.' + f[0] + '" placeholder="' + esc(f[2]) + '" value="' + esc(lb[f[0]]) + '"></label>').join('') + '</div></div>').join('');
  }
  const CPAL = ['#D4A64A', '#8CAA6E', '#CC7A6B', '#6FA3A0', '#AA8CAA'];
  const colorVal = (c, i) => /^#[0-9a-f]{6}$/i.test(c.color || '') ? c.color : CPAL[i % CPAL.length];
  function vCats() {
    return '<p style="color:var(--muted);margin-top:0">الأقسام هي اللي بتظهر في «بشتغل في إيه؟» وفلاتر الأعمال. نوع «فيديو» بيضيف زرار تشغيل على الكروت.</p>' +
      '<div id="clist">' + S.categories.map((c, i) => '<div class="crow" data-i="' + i + '"><span class="grip">' + I('grip') + '</span><div class="fields">' +
        '<label>اسم القسم<input data-b="categories.' + i + '.name" value="' + esc(c.name) + '"></label>' +
        '<label>الأيقونة<select data-b="categories.' + i + '.icon">' + ICON_CHOICES.map(n => '<option' + (n === c.icon ? ' selected' : '') + '>' + n + '</option>').join('') + '</select></label>' +
        '<label>النوع<select data-b="categories.' + i + '.type"><option value="image"' + (c.type !== 'video' ? ' selected' : '') + '>صور / مشاريع</option><option value="video"' + (c.type === 'video' ? ' selected' : '') + '>فيديو</option></select></label>' +
        '<label>طريقة العرض<select data-b="categories.' + i + '.layout"><option value=""' + (c.layout !== 'app' ? ' selected' : '') + '>عادي</option><option value="app"' + (c.layout === 'app' ? ' selected' : '') + '>تطبيقات / ألعاب (لقطات موبايل)</option></select></label>' +
        '<label class="w">وصف القسم<input data-b="categories.' + i + '.desc" value="' + esc(c.desc) + '"></label><div class="clrrow w"><span>لون الصندوق</span><input type="color" data-b="categories.' + i + '.color" value="' + colorVal(c, i) + '" aria-label="لون الصندوق"><button class="btn sm ghost" type="button" data-act="ccol" data-i="' + i + '">لون تلقائي</button></div></div>' +
        '<div class="acts"><button class="ib" data-act="cup" data-i="' + i + '" ' + (i === 0 ? 'disabled' : '') + ' aria-label="فوق">' + I('up') + '</button><button class="ib" data-act="cdown" data-i="' + i + '" ' + (i === S.categories.length - 1 ? 'disabled' : '') + ' aria-label="تحت">' + I('down') + '</button><button class="ib bad" data-act="cdel" data-i="' + i + '" aria-label="حذف">' + I('trash') + '</button></div></div>').join('') + '</div>' +
      '<button class="btn primary" data-act="cadd">' + I('plus') + ' قسم جديد</button>';
  }

  function simpleList(path, arr, fields) { /* fields: [[key,placeholder,class,'ta'?]] */
    const mv = (a, i, dis) => '<button class="ib" data-act="' + a + '" data-p="' + path + '" data-i="' + i + '" aria-label="' + (a === 'lup' ? 'فوق' : 'تحت') + '" ' + (dis ? 'disabled' : '') + '>' + I(a === 'lup' ? 'up' : 'down') + '</button>';
    return '<div id="l_' + path + '">' + arr.map((it, i) => '<div class="mini" data-i="' + i + '"><span class="grip">' + I('grip') + '</span>' + fields.map(f => { const key = path + '.' + i + (f[0] ? '.' + f[0] : ''), val = esc(f[0] ? it[f[0]] : it); return f[3] === 'ta' ? '<textarea rows="2" class="' + (f[2] || '') + '" data-b="' + key + '" placeholder="' + f[1] + '">' + val + '</textarea>' : '<input class="' + (f[2] || '') + '" data-b="' + key + '" placeholder="' + f[1] + '" value="' + val + '">'; }).join('') + mv('lup', i, i === 0) + mv('ldown', i, i === arr.length - 1) + '<button class="ib bad" data-act="ldel" data-p="' + path + '" data-i="' + i + '" aria-label="حذف">' + I('x') + '</button></div>').join('') + '</div>';
  }
  function vContent() {
    const h = S.hero, a = S.about;
    return '<div class="panel"><h2>الواجهة الرئيسية</h2><p class="sub">أول حاجة الزائر بيشوفها.</p>' +
      '<label>السطر الصغير فوق الاسم<input data-b="hero.eyebrow" value="' + esc(h.eyebrow) + '"></label><label>الاسم<input data-b="hero.name" value="' + esc(h.name) + '"></label><label>الجملة التعريفية<textarea rows="2" data-b="hero.sub">' + esc(h.sub) + '</textarea></label>' +
      imageField('hp', 'الصورة الشخصية (الرئيسية)', h.photo, true) + '<small class="h">الأفضل صورة رأسية (4:5) بخلفية واضحة أو غامقة.</small><div style="height:16px"></div>' +
      '<label>شكل إطار الصورة<select data-b="hero.photoStyle">' + [['card', 'كارت بيندمج مع الخلفية (الافتراضي)'], ['arch', 'قوس'], ['round', 'دائرة']].map(o => '<option value="' + o[0] + '"' + ((h.photoStyle || 'card') === o[0] ? ' selected' : '') + '>' + o[1] + '</option>').join('') + '</select></label><div style="height:8px"></div>' +
      '<label class="sw"><input type="checkbox" data-b="hero.available"' + (h.available ? ' checked' : '') + '>أظهر شارة «متاح للعمل»</label><label>نص الشارة<input data-b="hero.availableText" value="' + esc(h.availableText) + '"></label><label class="sw"><input type="checkbox" data-b="hero.badges"' + (h.badges !== false ? ' checked' : '') + '>أظهر بادجات المجالات حوالين الصورة</label>' +
      '<div class="g2"><label>نص الزر الأول<input data-b="hero.cta1Text" value="' + esc(h.cta1Text) + '"></label><label>رابط الزر الأول<input dir="ltr" list="anch" data-b="hero.cta1Link" value="' + esc(h.cta1Link) + '"></label><label>نص الزر التاني<input data-b="hero.cta2Text" value="' + esc(h.cta2Text) + '"></label><label>رابط الزر التاني<input dir="ltr" list="anch" data-b="hero.cta2Link" value="' + esc(h.cta2Link) + '"></label></div>' +
      '<datalist id="anch"><option value="#work"><option value="#services"><option value="#about"><option value="#contact"></datalist></div>' +
      '<div class="panel"><h2>نبذة عني</h2><p class="sub">&nbsp;</p><label>العنوان<input data-b="about.title" value="' + esc(a.title) + '"></label><label>النص<textarea rows="5" data-b="about.text">' + esc(a.text) + '</textarea></label>' +
      '<label>عنوان معرض الصور<input data-b="about.photosTitle" placeholder="لقطات مني" value="' + esc(a.photosTitle) + '"></label>' +
      galleryField('ap', 'صور شخصية إضافية', '— بتظهر في قسم «عني» وتتكبّر بالضغط عليها (الأفضل صور رأسية 4:5)') + '</div>' +
      '<div class="panel"><h2>الأدوات والمهارات</h2><p class="sub">بتظهر كشريط متحرك وفي قسم «عني».</p>' + simpleList('skills', S.skills, [['', 'اسم الأداة']]) + '<button class="btn sm" data-act="ladd" data-p="skills">' + I('plus') + ' إضافة</button></div>' +
      '<div class="panel"><h2>أرقام وإنجازات</h2><p class="sub">اختياري — لو فاضية، القسم بيختفي. (مثال: 5+ / سنين خبرة)</p>' + simpleList('stats', S.stats, [['value', '5+', 'n ltr'], ['label', 'سنين خبرة']]) + '<button class="btn sm" data-act="ladd" data-p="stats">' + I('plus') + ' إضافة رقم</button></div>' +
      '<div class="panel"><h2>أرقام الواجهة الرئيسية</h2><p class="sub">اختياري — لو فاضية الموقع بيعرض عدد الأعمال والمجالات والأدوات تلقائيًا.</p>' + simpleList('hero.facts', S.hero.facts, [['value', '5+', 'n ltr'], ['label', 'سنين خبرة']]) + '<button class="btn sm" data-act="ladd" data-p="hero.facts">' + I('plus') + ' إضافة رقم</button></div>' +
      '<div class="panel"><h2>معلومات سريعة في «عني»</h2><p class="sub">أسطر بتظهر تحت النبذة (مثال: من ← القاهرة).</p>' + simpleList('about.facts', S.about.facts, [['label', 'العنوان', 'n'], ['value', 'القيمة']]) + '<button class="btn sm" data-act="ladd" data-p="about.facts">' + I('plus') + ' إضافة معلومة</button></div>';
  }
  function vContact() {
    const c = S.contact;
    return '<div class="panel"><h2>بيانات التواصل</h2><p class="sub">&nbsp;</p><label>عنوان القسم<input data-b="contact.title" value="' + esc(c.title) + '"></label><label>نص ترحيبي<textarea rows="2" data-b="contact.text">' + esc(c.text) + '</textarea></label>' +
      '<div class="g2"><label>الإيميل<input dir="ltr" data-b="contact.email" value="' + esc(c.email) + '"></label><label>واتساب (بكود الدولة بدون + وبدون صفر)<input dir="ltr" data-b="contact.whatsapp" value="' + esc(c.whatsapp) + '"></label></div></div>' +
      '<div class="panel"><h2>نموذج التواصل</h2><p class="sub">النموذج اللي الزائر بيكتب فيه ويتحوّل لرسالة واتساب أو إيميل.</p>' +
      '<label class="sw"><input type="checkbox" data-b="contact.showForm"' + (c.showForm !== false ? ' checked' : '') + '>أظهر نموذج التواصل</label>' +
      '<div class="g2"><label>تحية بداية الرسالة<input data-b="contact.form.greeting" placeholder="أهلاً عصام" value="' + esc(c.form.greeting) + '"></label><label>نص زر واتساب<input data-b="contact.form.waBtn" placeholder="ابعت على واتساب" value="' + esc(c.form.waBtn) + '"></label><label>نص زر الإيميل<input data-b="contact.form.mailBtn" placeholder="ابعت بالإيميل" value="' + esc(c.form.mailBtn) + '"></label><label>نص إرشادي لخانة التفاصيل<input data-b="contact.form.msgPlaceholder" placeholder="احكيلي عن الشغل…" value="' + esc(c.form.msgPlaceholder) + '"></label></div></div>' +
      '<div class="panel"><h2>اختيارات الميعاد</h2><p class="sub">الأزرار اللي الزائر بيختار منها ميعاد الشغل. لو فاضية، الصف بيختفي.</p>' + simpleList('contact.when', c.when, [['', 'مثال: مستعجل']]) + '<button class="btn sm" data-act="ladd" data-p="contact.when">' + I('plus') + ' إضافة اختيار</button></div>' +
      '<div class="panel"><h2>خطوات الشغل</h2><p class="sub">بتظهر فوق نموذج التواصل. لو فاضية، القسم بيختفي.</p>' + simpleList('contact.steps', c.steps, [['t', 'عنوان الخطوة', 'n'], ['d', 'وصف قصير']]) + '<button class="btn sm" data-act="ladd" data-p="contact.steps">' + I('plus') + ' إضافة خطوة</button></div>' +
      '<div class="panel"><h2>حسابات السوشيال</h2><p class="sub">اسحب لإعادة الترتيب.</p>' + simpleList('contact.socials', c.socials, [['name', 'الاسم', 'n'], ['url', 'https://…', 'ltr']]) + '<button class="btn sm" data-act="ladd" data-p="contact.socials">' + I('plus') + ' إضافة حساب</button></div>';
  }
  const PRESETS = ['#C9A24B', '#E0B84F', '#D97706', '#E11D48', '#8B5CF6', '#3B82F6', '#10B981', '#14B8A6'];
  function vLook() {
    const t = S.theme, d = S.design || {};
    const colorField = (key, label, fallback) => '<label>' + label + '<span class="clrrow"><input type="color" data-b="design.' + key + '" value="' + esc(d[key] || fallback) + '"><input data-b="design.' + key + '" value="' + esc(d[key] || '') + '" dir="ltr" placeholder="اتركه فارغًا لاستخدام الافتراضي"></span></label>';
    const num = (key, label, min, max, step, unit) => '<label>' + label + ' <b class="unit">' + unit + '</b><input type="number" min="' + min + '" max="' + max + '" step="' + step + '" data-b="design.' + key + '" value="' + esc(d[key]) + '"></label>';
    return lookPreview() + '<div class="panel"><h2>الألوان والهوية</h2><p class="sub">تحكم في ألوان كل أجزاء الموقع. اترك أي لون فارغًا لاستخدام اللون الافتراضي.</p><div class="g2">' + colorField('bg','خلفية الموقع','#0B0A08') + colorField('bg2','الخلفية الثانوية','#100E0B') + colorField('surface','لون البطاقات','#14120E') + colorField('surface2','لون البطاقات الثانوي','#1C1913') + colorField('ink','لون النص الأساسي','#F4EEE1') + colorField('muted','لون النص الثانوي','#ABA392') + colorField('line','لون الحدود','#2B261A') + '</div><label>اللون الأساسي</label><div class="colors"><input type="color" id="accPick" value="' + esc(t.accent) + '" aria-label="اختيار لون">' + PRESETS.map(c => '<button type="button" class="sw-c' + (c.toLowerCase() === (t.accent || '').toLowerCase() ? ' on' : '') + '" style="background:' + c + '" data-act="acc" data-c="' + c + '" aria-label="' + c + '"></button>').join('') + '</div></div>' +
    '<div class="panel"><h2>الخطوط والطباعة</h2><p class="sub">اختار الخطوط وحجم النصوص وتدرج العناوين.</p><div class="g2"><label>خط النصوص<select data-b="design.bodyFont"><option value="Plex"' + (d.bodyFont==='Plex'?' selected':'') + '>Inter + IBM Plex Sans Arabic</option><option value="Tajawal"' + (d.bodyFont==='Tajawal'?' selected':'') + '>Tajawal</option><option value="Roboto"' + (d.bodyFont==='Roboto'?' selected':'') + '>Roboto</option><option value="Alexandria"' + (d.bodyFont==='Alexandria'?' selected':'') + '>Alexandria</option></select></label><label>خط العناوين<select data-b="design.headingFont"><option value="Kufi"' + (d.headingFont==='Kufi'?' selected':'') + '>Playfair Display + Noto Kufi Arabic</option><option value="Alexandria"' + (d.headingFont==='Alexandria'?' selected':'') + '>Alexandria</option><option value="Tajawal"' + (d.headingFont==='Tajawal'?' selected':'') + '>Tajawal</option><option value="Roboto"' + (d.headingFont==='Roboto'?' selected':'') + '>Roboto</option></select></label>' + num('bodySize','حجم النص الأساسي',14,24,1,'px') + num('headingScale','مقياس العناوين',0.8,1.4,0.05,'×') + '</div></div>' +
    '<div class="panel"><h2>تخطيط الصفحة والمسافات</h2><p class="sub">تحكم في عرض المحتوى والمسافات الرأسية بين الأقسام.</p><div class="g2">' + num('contentWidth','أقصى عرض للموقع',900,1600,20,'px') + num('sectionSpace','المسافة أعلى الأقسام',40,180,5,'px') + num('cardGap','المسافة بين الكروت',8,48,2,'px') + '</div></div>' +
    '<div class="panel"><h2>الكروت والأزرار</h2><p class="sub">تحكم في تدوير الحواف ونسبة صور الأعمال والظلال.</p><div class="g2">' + num('cardRadius','استدارة الكروت',0,48,2,'px') + num('buttonRadius','استدارة الأزرار',0,999,4,'px') + '<label>نسبة صورة العمل<select data-b="design.cardRatio"><option value="4/3"' + (d.cardRatio==='4/3'?' selected':'') + '>4:3 — متوسطة</option><option value="1/1"' + (d.cardRatio==='1/1'?' selected':'') + '>1:1 — مربعة</option><option value="3/4"' + (d.cardRatio==='3/4'?' selected':'') + '>3:4 — رأسية</option><option value="16/9"' + (d.cardRatio==='16/9'?' selected':'') + '>16:9 — عريضة</option></select></label><label>قوة الظلال<select data-b="design.shadow"><option value="0"' + (+d.shadow===0?' selected':'') + '>بدون</option><option value="0.5"' + (+d.shadow===.5?' selected':'') + '>خفيفة</option><option value="1"' + (+d.shadow===1?' selected':'') + '>متوسطة</option><option value="1.5"' + (+d.shadow===1.5?' selected':'') + '>قوية</option></select></label></div></div>' +
    '<div class="panel"><h2>الوضع</h2><label>الوضع الافتراضي<select data-b="theme.mode"><option value="dark"' + (t.mode==='dark'?' selected':'') + '>ليلي</option><option value="light"' + (t.mode==='light'?' selected':'') + '>نهاري</option><option value="auto"' + (t.mode==='auto'?' selected':'') + '>حسب جهاز الزائر</option></select></label><label class="sw"><input type="checkbox" data-b="theme.toggle"' + (t.toggle!==false?' checked':'') + '>أظهر زرار تبديل الوضع للزائر</label></div>';
  }
  function vAccount() {
    return '<div class="panel"><h2>الاتصال</h2><p class="sub">متصل بالريبو <b dir="ltr" style="color:var(--ink)">' + esc(gh.repo) + '</b> · فرع <b dir="ltr" style="color:var(--ink)">' + esc(gh.branch) + '</b></p><div class="chips"><a class="btn sm" target="_blank" rel="noopener" href="https://github.com/' + esc(gh.repo) + '/commits/' + esc(gh.branch) + '/data/site.js">' + I('history') + ' سجل التعديلات (ترجع لأي نسخة)</a><button class="btn sm danger" data-act="logout">' + I('logout') + ' تسجيل خروج</button></div></div>' +
      '<div class="panel"><h2>نسخة احتياطية</h2><p class="sub">نزّل كل محتوى موقعك كملف، أو استرجعه.</p><div class="chips"><button class="btn sm" data-act="export">' + I('download') + ' تنزيل نسخة</button><button class="btn sm" data-act="import">' + I('upload') + ' استرجاع من ملف</button><input type="file" id="impf" accept=".json,.js,application/json" hidden></div></div>' +
      '<div class="panel"><h2>مهم</h2><ul class="tips"><li>' + I('info') + '<span>كلمة السر بتتراجع على سيرفر محمي، والتوكن مش موجود في المتصفح ولا في الريبو. الجلسة بتنتهي لوحدها بعد 4 ساعات، ولو الجهاز مش بتاعك اعمل «تسجيل خروج».</span></li><li>' + I('info') + '<span>لو اتعدّل الموقع من مكان تاني (من GitHub مباشرة) افتح اللوحة تاني قبل ما تنشر عشان متمسحش تعديل.</span></li></ul></div>';
  }
  function vProof() {
    const sh = S.show || {};
    return '<div class="panel"><h2>قسم «ليه تشتغل معايا؟»</h2><p class="sub">نقاط وآراء العملاء في قسم واحد. لو الاتنين فاضيين القسم بيختفي. عناوين القسم من تبويب «النصوص والأقسام».</p><label class="sw"><input type="checkbox" data-b="show.proof"' + (sh.proof !== false ? ' checked' : '') + '>أظهر القسم</label></div>' +
      '<div class="panel"><h2>نقاط «ليه أنا»</h2><p class="sub">عنوان قصير وتحته سطر توضيح.</p>' + simpleList('why', S.why, [['t', 'العنوان', 'n'], ['d', 'التوضيح']]) + '<button class="btn sm" data-act="ladd" data-p="why">' + I('plus') + ' إضافة نقطة</button></div>' +
      '<div class="panel"><h2>آراء العملاء</h2><p class="sub">النص مطلوب عشان الرأي يظهر، والباقي اختياري.</p>' + simpleList('testimonials', S.testimonials, [['text', 'نص الرأي', '', 'ta'], ['name', 'اسم العميل', 'n'], ['role', 'الصفة أو الشغل'], ['link', 'رابط https://…', 'ltr']]) + '<button class="btn sm" data-act="ladd" data-p="testimonials">' + I('plus') + ' إضافة رأي</button></div>';
  }
  function listPackages() {
    if (!S.packages.length) return '<div class="empty">لسه مفيش باقات. اضغط «إضافة باقة».</div>';
    const b = (a, i, ic, lb, dis) => '<button class="ib" data-act="' + a + '" data-i="' + i + '" aria-label="' + lb + '" title="' + lb + '" ' + (dis ? 'disabled' : '') + '>' + I(ic) + '</button>';
    return S.packages.map((k, i) => '<div class="row' + (k.visible === false ? ' hid' : '') + '" data-i="' + i + '"><span class="grip" title="اسحب لإعادة الترتيب">' + I('grip') + '</span><div class="th">' + I(catIcon(k.category)) + '</div>' +
      '<div class="rt"><b dir="auto">' + esc(k.name || 'بدون اسم') + '</b><small>' + esc(k.category ? catName(k.category) : 'عام') + ' · ' + esc(k.price || 'السعر حسب المشروع') + '</small></div>' +
      '<div class="bdgs">' + (k.featured ? '<span class="badge gold">مميّزة</span>' : '') + (k.badge ? '<span class="badge">' + esc(k.badge) + '</span>' : '') + (k.visible === false ? '<span class="badge">مخفية</span>' : '') + '</div>' +
      '<div class="acts">' + b('pkUp', i, 'up', 'فوق', i === 0) + b('pkDown', i, 'down', 'تحت', i === S.packages.length - 1) + b('pkVis', i, k.visible === false ? 'eyeoff' : 'eye', 'إظهار/إخفاء') + b('pkEdit', i, 'edit', 'تعديل') + b('pkDup', i, 'copy', 'نسخ') + '<button class="ib bad" data-act="pkDel" data-i="' + i + '" aria-label="حذف" title="حذف">' + I('trash') + '</button></div></div>').join('');
  }
  function vPricing() {
    const sh = S.show || {}, pp = S.pricingPolicy;
    return '<div class="panel"><h2>قسم الباقات والأسعار</h2><p class="sub">كروت الخدمات في الصفحة الرئيسية. لو مفيش باقة ظاهرة القسم بيختفي. العنوان وأزرار الكروت من تبويب «النصوص والأقسام».</p><label class="sw"><input type="checkbox" data-b="show.pricing"' + (sh.pricing !== false ? ' checked' : '') + '>أظهر القسم</label></div>' +
      '<div class="toolbar"><button class="btn primary" data-act="addPk">' + I('plus') + ' إضافة باقة</button></div><div class="list" id="pklist">' + listPackages() + '</div>' +
      '<div class="panel"><h2>سياسة التعديلات</h2><p class="sub">صندوق صغير تحت الباقات. سيب العنوان والنقاط فاضيين لو مش عايزه.</p><label>عنوان الصندوق<input data-b="pricingPolicy.title" value="' + esc(pp.title) + '"></label>' + simpleList('pricingPolicy.points', pp.points, [['t', 'العنوان', 'n'], ['d', 'التوضيح']]) + '<button class="btn sm" data-act="ladd" data-p="pricingPolicy.points">' + I('plus') + ' إضافة نقطة</button></div>';
  }
  function editPackage(i) {
    const isNew = i < 0;
    const k = isNew ? { name: '', category: '', desc: '', features: [], price: '', note: '', badge: '', featured: false, visible: true } : Object.assign({}, S.packages[i]);
    const d = $('#dlg');
    d.innerHTML = '<form method="dialog" id="pf"><div class="dh"><h2>' + (isNew ? 'إضافة باقة' : 'تعديل الباقة') + '</h2><button type="button" class="ib" id="x" aria-label="إغلاق">' + I('x') + '</button></div><div class="db">' +
      '<label>اسم الباقة<input id="k_n" required dir="auto" value="' + esc(k.name) + '"></label>' +
      '<div class="g2"><label>القسم المرتبط<select id="k_c"><option value="">عام (بدون قسم)</option>' + S.categories.map(c => '<option value="' + esc(c.id) + '"' + (c.id === k.category ? ' selected' : '') + '>' + esc(c.name) + '</option>').join('') + '</select></label><label>شارة صغيرة (اختياري)<input id="k_b" dir="auto" placeholder="مثلًا: الأكتر طلبًا" value="' + esc(k.badge) + '"></label></div>' +
      '<label>وصف قصير<textarea id="k_d" rows="2" dir="auto">' + esc(k.desc) + '</textarea></label>' +
      '<label>المميزات (ميزة في كل سطر)<textarea id="k_f" rows="6" dir="auto">' + esc((k.features || []).join('\n')) + '</textarea></label>' +
      '<div class="g2"><label>السعر بالجنيه المصري (فاضي = «السعر حسب المشروع»)<input id="k_p" dir="auto" placeholder="مثلًا: 500 جنيه" value="' + esc(k.price) + '"></label><label>ملحوظة جنب السعر (اختياري)<input id="k_o" dir="auto" value="' + esc(k.note) + '"></label></div>' +
      '<div style="height:12px"></div><label class="sw"><input type="checkbox" id="k_v"' + (k.visible !== false ? ' checked' : '') + '>ظاهرة في الموقع</label><label class="sw"><input type="checkbox" id="k_h"' + (k.featured ? ' checked' : '') + '>باقة مميّزة (بتتبرز)</label></div>' +
      '<div class="df"><button class="btn primary" type="submit">' + I('check') + ' حفظ</button><button class="btn ghost" type="button" id="cx">إلغاء</button></div></form>';
    d.onclose = null;
    const close = () => d.close(); $('#x', d).onclick = close; $('#cx', d).onclick = close;
    $('#pf', d).onsubmit = e => {
      e.preventDefault();
      Object.assign(k, { name: $('#k_n').value.trim(), category: $('#k_c').value, badge: $('#k_b').value.trim(), desc: $('#k_d').value.trim(), features: $('#k_f').value.split('\n').map(x => x.trim()).filter(Boolean), price: $('#k_p').value.trim(), note: $('#k_o').value.trim(), visible: $('#k_v').checked, featured: $('#k_h').checked });
      if (isNew) S.packages.push(k); else S.packages[i] = k;
      d.close(); touch(); if (view === 'pricing') $('#pklist').innerHTML = listPackages();
      toast(isNew ? 'اتضافت ✓ (لسه محتاجة نشر)' : 'اتعدّلت ✓ (لسه محتاجة نشر)');
    };
    d.showModal(); $('#k_n').focus();
  }
  function vSeo() {
    const q = S.seo, v = key => esc(q[key]);
    return '<div class="panel"><h2>عنوان ووصف الموقع</h2><p class="sub">اللي بيظهر في جوجل وعند مشاركة الرابط على واتساب وفيسبوك.</p><label>عنوان الموقع<input data-b="meta.title" value="' + esc(S.meta.title) + '"><small class="h cc" data-cc="meta.title"></small></label><label>الوصف<textarea rows="3" data-b="meta.description">' + esc(S.meta.description) + '</textarea><small class="h cc" data-cc="meta.description"></small></label><div class="serp" id="serp"><span class="su"></span><b class="st"></b><p class="sd"></p></div></div>' +
      '<div class="panel"><h2>صورة المشاركة</h2><p class="sub">بتظهر لما حد يبعت رابط موقعك. الأفضل أفقية (1200×630). لو سبتها زي ما هي بتتستخدم الصورة الافتراضية.</p>' + imageField('og', 'صورة المشاركة', q.ogImage || 'images/og.jpg', false) + '</div>' +
      '<div class="panel"><h2>بيانات لمحركات البحث</h2><p class="sub">فاضية = القيم الافتراضية.</p><div class="g2"><label>المسمى الوظيفي<input data-b="seo.jobTitle" placeholder="مصمم جرافيك ومطوّر تطبيقات" value="' + v('jobTitle') + '"></label><label>المدينة<input data-b="seo.city" placeholder="القاهرة" value="' + v('city') + '"></label><label>كود الدولة<input dir="ltr" data-b="seo.country" placeholder="EG" value="' + v('country') + '"></label></div></div>' +
      '<div class="panel"><h2>صفحة الأعمال</h2><label>عنوان الصفحة<input data-b="seo.worksTitle" placeholder="أعمالي | ' + esc(S.hero.name || '') + '" value="' + v('worksTitle') + '"></label><label>وصف الصفحة<textarea rows="2" data-b="seo.worksDesc" placeholder="معرض أعمال…">' + v('worksDesc') + '</textarea></label></div>' +
      '<div class="panel"><h2>الفوتر</h2><label>نص الفوتر<input data-b="footer" value="' + esc(S.footer) + '"></label></div>';
  }
  function cc(k, n, max) {
    const e = $('[data-cc="' + k + '"]'); if (!e) return; const min = k === 'meta.title' ? 20 : 70, bad = n > max || (n && n < min);
    e.textContent = n + ' من ' + max + ' حرف' + (n > max ? ' — طويل وهيتقصّ في جوجل' : (n && n < min ? ' — قصير شوية' : (n ? ' — ممتاز' : ''))); e.className = 'h cc ' + (bad ? 'warn' : n ? 'ok' : '');
  }
  function updateSerp() {
    const el = $('#serp'); if (!el) return; const t = String(S.meta.title || '').trim(), d = String(S.meta.description || '').trim();
    $('.st', el).textContent = t || 'عنوان الموقع هيظهر هنا'; $('.sd', el).textContent = d || 'وصف الموقع هيظهر هنا…'; $('.su', el).textContent = (siteUrl || '').replace(/^https?:\/\//, '').replace(/\/$/, '');
    cc('meta.title', t.length, 60); cc('meta.description', d.length, 160);
  }
  function lookPreview() {
    return '<div class="panel lp"><h2>معاينة سريعة للمظهر</h2><p class="sub">بتتحدّث لحظيًا مع تعديلاتك. المعاينة الكاملة من زر «معاينة».</p><div class="lpv" id="lpv"><div><h4>عنوان تجريبي</h4><p>نص توضيحي بالخط والحجم اللي اخترتهم.</p></div><div class="pc"><span class="pimg"></span><div><b>اسم العمل</b><p>وصف قصير للعمل</p><button type="button" class="pb" tabindex="-1">زر تجريبي</button></div></div></div></div>';
  }
  function updateLook() {
    const el = $('#lpv'); if (!el) return; const d = S.design || {}, light = S.theme.mode === 'light';
    const df = light ? { bg: '#F6F3EC', surface: '#FFFFFF', ink: '#1C1810', muted: '#6B6454', line: '#E2DACA' } : { bg: '#0B0A08', surface: '#14120E', ink: '#F4EEE1', muted: '#ABA392', line: '#2B261A' };
    const v = { '--pbg': d.bg || df.bg, '--pcard': d.surface || df.surface, '--pink': d.ink || df.ink, '--pmuted': d.muted || df.muted, '--pline': d.line || df.line, '--pacc': S.theme.accent || '#C9A24B', '--prad': (+d.cardRadius || 0) + 'px', '--pbtn': (+d.buttonRadius || 0) + 'px', '--phs': +d.headingScale || 1, '--pbs': +d.bodySize || 19, '--psh': d.shadow == null || d.shadow === '' ? 1 : +d.shadow, '--pratio': d.cardRatio || '4/3', '--pgap': (+d.cardGap || 24) + 'px' };
    Object.keys(v).forEach(k => el.style.setProperty(k, v[k]));
  }
  let spy = null; addEventListener('scroll', () => spy && spy(), { passive: true });
  function buildToc(el, v) {
    spy = null;
    if (v === 'home' || v === 'works') return;
    const ps = $$('.panel', el).filter(p => !p.classList.contains('lp') && p.querySelector(':scope>h2'));
    if (ps.length < 4) return;
    el.insertAdjacentHTML('afterbegin', '<nav class="toc" aria-label="أقسام الصفحة">' + ps.map((p, i) => '<button type="button" data-ti="' + i + '">' + esc($('h2', p).textContent) + '</button>').join('') + '</nav>');
    const bs = $$('.toc button', el);
    bs.forEach((b, i) => b.onclick = () => ps[i].scrollIntoView({ behavior: 'smooth', block: 'start' }));
    spy = () => { let k = 0; ps.forEach((p, i) => { if (p.getBoundingClientRect().top < 190) k = i; }); bs.forEach((b, i) => b.classList.toggle('on', i === k)); const a = bs[k]; if (a && a.offsetParent) { const t = a.parentElement; t.scrollTo({ left: a.offsetLeft - t.clientWidth / 2 + a.clientWidth / 2, behavior: 'auto' }); } };
    spy();
  }
  const RENDER = { home: vHome, works: vWorks, cats: vCats, pricing: vPricing, proof: vProof, content: vContent, contact: vContact, texts: vTexts, seo: vSeo, look: vLook, account: vAccount };

  function go(v) {
    view = v;
    const vm = VIEWS.find(x => x[0] === v);
    $('#viewTitle').textContent = vm[1]; $('#viewDesc').textContent = vm[3]; document.title = vm[1] + ' · لوحة التحكم'; closeMenu();
    $$('#nav button').forEach(b => { b.classList.toggle('on', b.dataset.v === v); b.setAttribute('aria-current', b.dataset.v === v ? 'page' : 'false'); });
    const el = $('#view'); el.innerHTML = RENDER[v](); window.scrollTo(0, 0);
    if (v === 'works') sortable($('#plist'), () => S.projects, () => { touch(); $('#plist').innerHTML = listWorks(); });
    if (v === 'cats') sortable($('#clist'), () => S.categories, () => { touch(); go('cats'); });
    if (v === 'pricing') sortable($('#pklist'), () => S.packages, () => { touch(); $('#pklist').innerHTML = listPackages(); });
    ['skills', 'stats', 'contact.socials', 'contact.steps', 'contact.when', 'faq', 'hero.facts', 'about.facts', 'why', 'testimonials', 'pricingPolicy.points'].forEach(p => { const c = $('[id="l_' + p + '"]'); if (c) sortable(c, () => get(S, p), () => { touch(); go(view); }); });
    buildToc(el, v);
    if (v === 'look') updateLook(); if (v === 'seo') updateSerp();
    const hp = $('#hp'); if (hp) bindImageField(hp, 1200, v => { S.hero.photo = v; touch(); });
    const mg = $('#ap'); if (mg) bindGallery(mg, S.about.photos.slice(), 1200, v => { S.about.photos = v; touch(); });
    const og = $('#og'); if (og) bindImageField(og, 1200, v => { S.seo.ogImage = v === 'images/og.jpg' ? '' : v; touch(); }, true);
    const ap = $('#accPick'); if (ap) ap.oninput = () => { S.theme.accent = ap.value; touch(); updateLook(); $$('.sw-c').forEach(x => x.classList.remove('on')); };
  }

  const NEWITEM = { faq: () => ({ q: '', a: '' }), skills: () => '', 'contact.when': () => '', stats: () => ({ value: '', label: '' }), 'contact.steps': () => ({ t: '', d: '' }), 'contact.socials': () => ({ name: '', url: '' }), 'hero.facts': () => ({ value: '', label: '' }), 'about.facts': () => ({ label: '', value: '' }), why: () => ({ t: '', d: '' }), 'pricingPolicy.points': () => ({ t: '', d: '' }), testimonials: () => ({ text: '', name: '', role: '', link: '' }) };
  /* ---------- events ---------- */
  const view$ = () => $('#view');
  document.addEventListener('input', e => {
    const t = e.target;
    if (t.id === 'q') { flt.q = t.value; $('#plist').innerHTML = listWorks(); return; }
    if (t.id === 'fc') { flt.cat = t.value; $('#plist').innerHTML = listWorks(); return; }
    if (t.dataset && t.dataset.b && view$().contains(t)) {
      if (t.type === 'color') { const x = t.parentElement.querySelector('input:not([type=color])'); if (x) x.value = t.value; }
      else if (/^design\./.test(t.dataset.b) && /^#[0-9a-f]{6}$/i.test(t.value)) { const c = t.parentElement.querySelector('input[type=color]'); if (c) c.value = t.value; }
      set(S, t.dataset.b, t.type === 'checkbox' ? t.checked : t.value); touch(); updateLook(); updateSerp();
    }
  });
  document.addEventListener('change', e => { if (e.target.id === 'fc') { flt.cat = e.target.value; $('#plist').innerHTML = listWorks(); } });

  document.addEventListener('click', async e => {
    const t = e.target;
    const g = t.closest('[data-go]'); if (g) { go(g.dataset.go); return; }
    const vw_ = t.closest('[data-vw]'); if (vw_) { flt.vw = vw_.dataset.vw; LS.set('works.vw', flt.vw); $$('[data-vw]').forEach(x => x.classList.toggle('on', x === vw_)); $('#plist').innerHTML = listWorks(); return; }
    const fs_ = t.closest('[data-st]'); if (fs_) { flt.st = fs_.dataset.st; $('#plist').innerHTML = listWorks(); return; }
    const nv = t.closest('#nav button'); if (nv) { go(nv.dataset.v); return; }
    const b = t.closest('[data-act]'); if (!b) return;
    const a = b.dataset.act, i = +b.dataset.i;
    const list = () => { touch(); $('#plist').innerHTML = listWorks(); };
    const refPk = () => { touch(); const l = $('#pklist'); if (l) l.innerHTML = listPackages(); };
    if (a === 'preview') $('#btnPreview').click();
    else if (a === 'addWork') editWork(-1);
    else if (a === 'editWork') editWork(i);
    else if (a === 'vis') { S.projects[i].visible = S.projects[i].visible === false; list(); }
    else if (a === 'dup') { const c = Object.assign({}, S.projects[i], { id: uid('p'), title: S.projects[i].title + ' (نسخة)' }); S.projects.splice(i + 1, 0, c); list(); }
    else if (a === 'delWork') { if (await ask('تمسح «' + (S.projects[i].title || 'العمل') + '»؟', 'مسح')) { S.projects.splice(i, 1); list(); } }
    else if (a === 'up' || a === 'down') {
      const q = flt.q.toLowerCase();
      const idx = S.projects.map((p, k) => k).filter(k => matchW(S.projects[k], q));
      const pos = idx.indexOf(i), tgt = idx[pos + (a === 'up' ? -1 : 1)]; if (tgt != null) { moveIdx(S.projects, i, tgt); list(); }
    }
    else if (a === 'cadd') { S.categories.push({ id: uid('c'), name: 'قسم جديد', desc: '', icon: 'star', type: 'image' }); touch(); go('cats'); }
    else if (a === 'cup' || a === 'cdown') { moveIdx(S.categories, i, i + (a === 'cup' ? -1 : 1)); touch(); go('cats'); }
    else if (a === 'cdel') {
      const c = S.categories[i], n = S.projects.filter(p => p.category === c.id).length;
      if (await ask(n ? 'هتمسح قسم «' + c.name + '» و' + n + ' عمل جواه. متأكد؟' : 'تمسح قسم «' + c.name + '»؟', 'مسح')) { S.projects = S.projects.filter(p => p.category !== c.id); S.categories.splice(i, 1); touch(); go('cats'); }
    }
    else if (a === 'ladd') { const arr = get(S, b.dataset.p); arr.push((NEWITEM[b.dataset.p] || (() => ({})))()); touch(); go(view); const rows = $$('[id="l_' + b.dataset.p + '"] .mini'); if (rows.length) rows[rows.length - 1].querySelector('input,textarea').focus(); }
    else if (a === 'lup' || a === 'ldown') { moveIdx(get(S, b.dataset.p), i, i + (a === 'lup' ? -1 : 1)); touch(); go(view); }
    else if (a === 'addPk') editPackage(-1);
    else if (a === 'pkEdit') editPackage(i);
    else if (a === 'pkVis') { S.packages[i].visible = S.packages[i].visible === false; refPk(); }
    else if (a === 'pkDup') { const k = S.packages[i]; S.packages.splice(i + 1, 0, Object.assign({}, k, { name: k.name + ' (نسخة)', features: (k.features || []).slice() })); refPk(); }
    else if (a === 'pkDel') { if (await ask('تمسح باقة «' + (S.packages[i].name || '') + '»؟', 'مسح')) { S.packages.splice(i, 1); refPk(); } }
    else if (a === 'pkUp' || a === 'pkDown') { moveIdx(S.packages, i, i + (a === 'pkUp' ? -1 : 1)); refPk(); }
    else if (a === 'ccol') { delete S.categories[+b.dataset.i].color; touch(); go(view); }
    else if (a === 'ldel') { get(S, b.dataset.p).splice(i, 1); touch(); go(view); }
    else if (a === 'acc') { S.theme.accent = b.dataset.c; touch(); go('look'); }
    else if (a === 'export') { const l = document.createElement('a'); l.href = URL.createObjectURL(new Blob(['window.SITE=' + JSON.stringify(S, null, 1) + ';\n'], { type: 'text/javascript' })); l.download = 'site-backup-' + new Date().toISOString().slice(0, 10) + '.js'; l.click(); }
    else if (a === 'import') { const f = $('#impf'); f.onchange = async () => { try { const x = parseSite(await f.files[0].text()); if (!Array.isArray(x.projects)) throw 0; S = norm(x); touch(); go('account'); toast('اتسترجعت النسخة — اضغط نشر لتطبيقها'); } catch (er) { toast('الملف ده مش نسخة صالحة.', true); } }; f.click(); }
    else if (a === 'logout') { if (await ask('تسجّل خروج؟', 'خروج')) { LS.del('token'); try { sessionStorage.removeItem('sx.admin.sess'); } catch (e) {} isDirty() && (orig = JSON.stringify(S)); location.reload(); } }
  });

  document.addEventListener('error', e => { const t = e.target; if (t && t.tagName === 'IMG' && t.closest('.th,.wc-img')) t.remove(); }, true);
  addEventListener('keydown', e => { if (e.key === 'Escape') closeMenu(); });
  addEventListener('keydown', e => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); publish(); } });
  $('#btnPublish').onclick = publish;
  $('#btnDiscard').onclick = async () => { if (await ask('تتراجع عن كل التعديلات اللي لسه متنشرتش؟', 'تراجع')) { S = norm(parseSite('window.SITE=' + orig + ';')); touch(); go(view); toast('رجعنا لآخر نسخة منشورة'); } };
  $('#btnPreview').onclick = () => { $('#preview').hidden = false; $('#pframe').src = '../index.html?preview=1'; };
  $('#pClose').onclick = () => { $('#preview').hidden = true; $('#pframe').src = 'about:blank'; };
  $$('.seg button').forEach(b => b.onclick = () => { $$('.seg button').forEach(x => x.classList.toggle('on', x === b)); $('.pstage').classList.toggle('mob', b.dataset.dev === 'm'); });

  /* ---------- بحث سريع (Ctrl+K) ---------- */
  $('#dlg').addEventListener('close', () => { $('#dlg').className = ''; });
  function palette() {
    if (!S || $('#dlg').open) return;
    const d = $('#dlg'); d.className = 'pal';
    const items = VIEWS.map(v => ({ t: v[1], s: v[3], ic: v[2], g: 'انتقال إلى', run: () => go(v[0]) })).concat([
      { t: 'إضافة عمل جديد', s: 'افتح نافذة إضافة عمل', ic: 'plus', g: 'إجراء', run: () => editWork(-1) },
      { t: 'إضافة باقة جديدة', s: 'افتح نافذة إضافة باقة', ic: 'plus', g: 'إجراء', run: () => editPackage(-1) },
      { t: 'معاينة الموقع', s: 'شوف التعديلات قبل النشر', ic: 'eye', g: 'إجراء', run: () => $('#btnPreview').click() },
      { t: 'نشر التعديلات', s: 'احفظ التعديلات على الموقع', ic: 'rocket', g: 'إجراء', run: publish },
      { t: 'تبديل الوضع الليلي / النهاري', s: 'غيّر مظهر اللوحة', ic: 'sun', g: 'إجراء', run: () => $('#themeTg').click() }
    ]);
    let cur = [], act = 0;
    d.innerHTML = '<div class="pk"><div class="pks">' + I('search') + '<input id="pq" placeholder="اكتب للبحث عن صفحة أو إجراء…" autocomplete="off" aria-label="بحث"></div><div class="pkl" id="pkl" role="listbox"></div><div class="pkf"><span><kbd>↑</kbd><kbd>↓</kbd> تنقّل</span><span><kbd>Enter</kbd> فتح</span><span><kbd>Esc</kbd> إغلاق</span></div></div>';
    const list = $('#pkl', d), q = $('#pq', d);
    const paint = () => {
      const k = q.value.trim().toLowerCase(); cur = items.filter(i => !k || (i.t + ' ' + i.s).toLowerCase().includes(k)); act = Math.min(act, Math.max(cur.length - 1, 0));
      list.innerHTML = cur.length ? cur.map((i, n) => '<button type="button" class="pki' + (n === act ? ' on' : '') + '" data-n="' + n + '" role="option"><span class="ic">' + I(i.ic) + '</span><span class="tx"><b>' + esc(i.t) + '</b><small>' + esc(i.s) + '</small></span><em>' + i.g + '</em></button>').join('') : '<div class="pke">مفيش نتائج للبحث ده.</div>';
      const a = $('.pki.on', list); if (a) a.scrollIntoView({ block: 'nearest' });
    };
    const run = n => { const it = cur[n]; if (!it) return; d.close(); setTimeout(it.run, 60); };
    q.oninput = () => { act = 0; paint(); };
    q.onkeydown = e => { if (e.key === 'ArrowDown') { e.preventDefault(); act = (act + 1) % (cur.length || 1); paint(); } else if (e.key === 'ArrowUp') { e.preventDefault(); act = (act - 1 + cur.length) % (cur.length || 1); paint(); } else if (e.key === 'Enter') { e.preventDefault(); run(act); } };
    list.onclick = e => { const b = e.target.closest('.pki'); if (b) run(+b.dataset.n); };
    d.onclose = null; d.onclick = e => { if (e.target === d) d.close(); };
    paint(); d.showModal(); q.focus();
  }
  addEventListener('keydown', e => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); palette(); } });

  /* ---------- boot ---------- */
  function start() {
    $('#login').hidden = true; $('#app').hidden = false;
    $('#repoName').textContent = gh.repo; $('#openSite').href = siteUrl; $('#openSite').innerHTML = I('ext') + ' فتح الموقع';
    let lastG = '';
    $('#nav').innerHTML = VIEWS.map(v => { const h = v[4] !== lastG ? '<div class="ng">' + v[4] + '</div>' : ''; lastG = v[4]; return h + '<button type="button" data-v="' + v[0] + '">' + I(v[2]) + '<span>' + v[1] + '</span>' + (['works', 'cats', 'pricing', 'proof'].includes(v[0]) ? '<em class="cnt"></em>' : '') + '</button>'; }).join('');
    $('#btnSearch').innerHTML = I('search') + '<span>بحث سريع</span><kbd>Ctrl K</kbd>'; $('#btnSearch').onclick = palette;
    $('#btnMenu').innerHTML = I('menu'); $('#btnMenu').onclick = openMenu; $('#scrim').onclick = closeMenu;
    $('#btnPreview').innerHTML = I('eye') + '<span>معاينة</span>'; $('#btnDiscard').innerHTML = I('undo') + '<span>تراجع</span>';
    $('#pClose').innerHTML = I('x') + ' إغلاق'; $('#devM').innerHTML = I('smartphone') + ' موبايل'; $('#devD').innerHTML = I('monitor') + ' كمبيوتر';
    updateBar(); go('home');
  }
  $('#showTok').innerHTML = I('eye');
  $('#showTok').onclick = () => { const t = $('#pass'); t.type = t.type === 'password' ? 'text' : 'password'; };
  async function login() {
    const btn = $('#loginBtn'), er = $('#loginErr'); er.hidden = true; btn.disabled = true; btn.textContent = 'جاري الدخول…';
    try {
      const api0 = String(window.ADMIN_API || '').replace(/\/+$/, '');
      if (!/^https:\/\//.test(api0) || /[^\x00-\x7F]/.test(api0)) throw new Error('لسه متظبطش رابط السيرفر. افتح admin/config.js وحط رابط الـWorker.');
      let r;
      try { r = await fetch(api0 + '/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: $('#pass').value }), cache: 'no-store' }); }
      catch (e) { throw new Error('مفيش اتصال بالسيرفر. اتأكد من الإنترنت ومن رابط الـWorker.'); }
      const d = await r.json().catch(() => ({}));
      if (r.status === 401) throw new Error('كلمة السر غلط.');
      if (r.status === 429) throw new Error('محاولات غلط كتير. الدخول مقفول مؤقتًا — جرّب بعد 15 دقيقة.');
      if (r.status === 403) throw new Error('الرابط ده مش مسموح له يدخل اللوحة (راجع ALLOWED_ORIGIN).');
      if (!r.ok || !d.session) throw new Error('السيرفر مش متظبط صح (راجع الـSecrets).');
      $('#pass').value = '';
      await connect(d.repo, d.session); start();
    } catch (e) { er.textContent = e.status ? explain(e) : e.message; er.hidden = false; }
    finally { btn.disabled = false; btn.textContent = 'دخول'; }
  }
  $('#loginForm').onsubmit = e => { e.preventDefault(); login(); };
  (async function boot() {
    let s = null; try { s = JSON.parse(sessionStorage.getItem('sx.admin.sess') || 'null'); } catch (e) {}
    if (s && s.repo && s.token) { try { await connect(s.repo, s.token); start(); } catch (e) { try { sessionStorage.removeItem('sx.admin.sess'); } catch (x) {} } }
  })();
})();

/* بيظبط ارتفاع صورة الولد في الرئيسية على حسب مساحة الشاشة الفاضية، عشان تظهر كاملة من غير Scroll */
(function () {
  function fit() {
    var f = document.querySelector('.kidfig'); if (!f) return;
    var st = f.querySelector('.kidfig-s'), acts = document.querySelector('.bar-acts');
    var top = f.getBoundingClientRect().top + (window.pageYOffset || 0);
    var dock = acts && getComputedStyle(acts).position === 'fixed' ? acts.offsetHeight + 12 : 0;   // شريط الأزرار الثابت تحت في الموبايل
    var pad = st ? parseFloat(getComputedStyle(st).paddingTop) || 0 : 0;
    var h = Math.max(200, window.innerHeight - top - dock - pad - 24);
    document.documentElement.style.setProperty('--kidh', Math.floor(h) + 'px');
  }
  function soon() { requestAnimationFrame(fit); setTimeout(fit, 450); setTimeout(fit, 1300); }
  window.addEventListener('resize', soon);
  window.addEventListener('load', soon);
  new MutationObserver(soon).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden'] });
})();
