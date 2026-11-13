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

  let S = null, orig = '', busy = false, buildTok = 0, view = 'home';
  const gh = { repo: '', token: '', branch: 'main', sha: '' };
  const imgs = new Map();           // path -> {dataUrl,b64,done}
  const flt = { q: '', cat: 'all' };
  let siteUrl = '';

  const VIEWS = [
    ['home', 'الرئيسية', 'home'], ['works', 'الأعمال', 'folder'], ['cats', 'الأقسام', 'grid'],
    ['content', 'محتوى الصفحة', 'user'], ['contact', 'التواصل', 'mail'], ['texts', 'النصوص والأقسام', 'edit'], ['look', 'المظهر و SEO', 'sliders'], ['account', 'الحساب والنسخ', 'key']
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
    d.design = Object.assign({ bg:'', bg2:'', surface:'', surface2:'', ink:'', muted:'', line:'', bodyFont:'Tajawal', headingFont:'Alexandria', bodySize:19, headingScale:1, contentWidth:1200, sectionSpace:110, cardRadius:22, cardGap:24, cardRatio:'4/3', buttonRadius:999, shadow:1 }, d.design);
    d.hero = d.hero || {}; d.about = d.about || {}; d.about.photos = Array.isArray(d.about.photos) ? d.about.photos : []; d.contact = d.contact || {}; d.contact.socials = d.contact.socials || []; d.contact.steps = Array.isArray(d.contact.steps) ? d.contact.steps : []; d.contact.when = Array.isArray(d.contact.when) ? d.contact.when : ['مستعجل', 'خلال أسبوع', 'مفيش استعجال']; d.contact.form = d.contact.form || {}; d.faq = Array.isArray(d.faq) ? d.faq : []; d.labels = d.labels || {}; d.show = d.show || {};
    ['stats', 'skills', 'categories', 'projects'].forEach(k => { if (!Array.isArray(d[k])) d[k] = []; });
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

  async function processImage(file, max) {
    const url = URL.createObjectURL(file);
    const im = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('الصورة دي مش مدعومة. جرّب JPG أو PNG أو WebP.')); i.src = url; });
    let w = im.naturalWidth || im.width, h = im.naturalHeight || im.height; const k = Math.min(1, max / Math.max(w, h));
    w = Math.round(w * k); h = Math.round(h * k);
    const c = document.createElement('canvas'); c.width = w; c.height = h; c.getContext('2d').drawImage(im, 0, 0, w, h); URL.revokeObjectURL(url);
    let type = 'image/webp', blob = await new Promise(r => c.toBlob(r, type, .86));
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
  function bindImageField(el, max, onChange) {
    const set_ = v => { el.dataset.val = v || ''; $('.th', el).innerHTML = v ? '<img src="' + esc(imgSrc(v)) + '" alt="" onerror="this.remove()">' : ''; $('[data-clear]', el).hidden = !v; onChange(v || ''); };
    const fi = $('input[type=file]', el);
    $('[data-pick]', el).onclick = () => fi.click();
    $('[data-clear]', el).onclick = () => { $('[data-url]', el).value = ''; set_(''); };
    $('[data-url]', el).oninput = e => { const v = e.target.value.trim(); if (!v || /^https?:\/\//i.test(v)) set_(v); };
    const take = async f => { if (!f) return; try { set_(await processImage(f, max)); $('[data-url]', el).value = ''; } catch (e) { toast(e.message, true); } };
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
    $('#btnPublish').innerHTML = I('rocket') + (busy ? ' جاري النشر…' : ' نشر التعديلات');
  }
  let pt = 0;
  function touch() { updateBar(); clearTimeout(pt); pt = setTimeout(pushPreview, 120); }
  function previewData() {
    const c = JSON.parse(JSON.stringify(S));
    const fix = p => (p && imgs.has(p)) ? imgs.get(p).dataUrl : p;
    c.hero.photo = fix(c.hero.photo); c.about.photos = (c.about.photos || []).map(fix); c.projects.forEach(p => { p.images = imgList(p).map(fix); p.image = p.images[0] || ''; });
    return c;
  }
  function pushPreview() {
    const f = $('#pframe'); if ($('#preview').hidden || !f.contentWindow) return;
    f.contentWindow.postMessage({ type: 'sx-preview', data: previewData() }, location.origin);
  }
  addEventListener('message', e => { if (e.origin === location.origin && e.data && e.data.type === 'sx-ready') pushPreview(); });
  addEventListener('beforeunload', e => { if (isDirty()) { e.preventDefault(); e.returnValue = ''; } });

  /* ---------- publish ---------- */
  const allImages = () => [S.hero.photo].concat(S.about.photos || [], ...S.projects.map(imgList)).filter(Boolean);
  async function publish() {
    if (busy || !isDirty()) return;
    busy = true; updateBar();
    try {
      const used = new Set(allImages());
      const todo = [...imgs].filter(([p, v]) => !v.done && used.has(p));
      let n = 0;
      for (const [p, v] of todo) { note('<span class="sp"></span>جاري رفع الصور… (' + (++n) + '/' + todo.length + ')'); await put(p, v.b64, 'إضافة صورة من لوحة التحكم'); v.done = true; }
      note('<span class="sp"></span>جاري حفظ المحتوى…');
      const r = await put('data/site.js', b64('window.SITE=' + JSON.stringify(S, null, 1) + ';\n'), 'تحديث محتوى الموقع من لوحة التحكم', true);
      gh.sha = r.content.sha; orig = JSON.stringify(S);
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
    if (!S.stats.length) tips.push(['star', 'تقدر تضيف أرقام (سنين خبرة، عدد عملاء…) تظهر بشكل جذاب في الموقع.', 'content', 'أضف أرقام']);
    if (!S.meta.description) tips.push(['globe', 'اكتب وصف لمحركات البحث (SEO).', 'look', 'اكتبه']);
    return '<div class="cards"><div class="kpi"><b>' + P.length + '</b><span>عمل</span></div><div class="kpi"><b>' + S.categories.length + '</b><span>قسم</span></div><div class="kpi"><b>' + S.skills.length + '</b><span>أداة/مهارة</span></div><div class="kpi"><b>' + S.contact.socials.length + '</b><span>حساب سوشيال</span></div></div>' +
      '<div class="panel"><h2>إجراءات سريعة</h2><p class="sub">اضغط وابدأ.</p><div class="chips"><button class="btn primary sm" data-act="addWork">' + I('plus') + ' إضافة عمل جديد</button><button class="btn sm" data-go="content">' + I('user') + ' تعديل الصفحة الرئيسية</button><button class="btn sm" data-go="contact">' + I('mail') + ' بيانات التواصل</button><button class="btn sm" data-go="look">' + I('sliders') + ' تغيير الألوان</button></div></div>' +
      '<div class="panel"><h2>اقتراحات لتحسين الموقع</h2><p class="sub">&nbsp;</p>' + (tips.length ? '<ul class="tips">' + tips.map(t => '<li>' + I(t[0]) + '<span>' + t[1] + '</span><button class="btn sm ghost" data-go="' + t[2] + '">' + t[3] + '</button></li>').join('') + '</ul>' : '<ul class="tips"><li class="good">' + I('check') + '<span>كل حاجة تمام ✓</span></li></ul>') + '</div>' +
      '<div class="panel"><h2>إزاي بتشتغل اللوحة؟</h2><p class="sub">&nbsp;</p><ol class="steps"><li><span><b>عدّل</b> أي حاجة (أعمال، نصوص، ألوان…) وشوف النتيجة في <b>«معاينة»</b>.</span></li><li><span>اضغط <b>«نشر التعديلات»</b> — اللوحة بتحفظ على GitHub.</span></li><li><span>GitHub Pages بينشر الموقع لوحده، والتعديل بيظهر خلال دقيقة تقريبًا.</span></li></ol></div>';
  }

  function listWorks() {
    const q = flt.q.toLowerCase();
    const rows = S.projects.map((p, i) => [p, i]).filter(([p]) => (flt.cat === 'all' || p.category === flt.cat) && (!q || (p.title + ' ' + p.desc + ' ' + p.tag).toLowerCase().includes(q)));
    if (!rows.length) return '<div class="empty">' + (S.projects.length ? 'مفيش نتائج.' : 'لسه مفيش أعمال. اضغط «إضافة عمل».') + '</div>';
    return rows.map(([p, i], k) => '<div class="row' + (p.visible === false ? ' hid' : '') + '" data-i="' + i + '"><span class="grip" title="اسحب لإعادة الترتيب">' + I('grip') + '</span>' + '<div class="th">' + (imgList(p)[0] ? '<img src="' + esc(imgSrc(imgList(p)[0])) + '" alt="" onerror="this.remove()">' : I(catIcon(p.category))) + '</div>' +
      '<div class="rt"><b dir="auto">' + esc(p.title || 'بدون عنوان') + '</b><small>' + esc(catName(p.category)) + '</small></div>' +
      (imgList(p).length > 1 ? '<span class="badge">' + imgList(p).length + ' صور</span>' : '') + (p.featured ? '<span class="badge gold">مميّز</span>' : '') + (p.tag ? '<span class="badge">' + esc(p.tag) + '</span>' : '') + (p.visible === false ? '<span class="badge">مخفي</span>' : '') +
      '<div class="acts"><button class="ib" data-act="up" data-i="' + i + '" aria-label="فوق" ' + (k === 0 ? 'disabled' : '') + '>' + I('up') + '</button><button class="ib" data-act="down" data-i="' + i + '" aria-label="تحت" ' + (k === rows.length - 1 ? 'disabled' : '') + '>' + I('down') + '</button>' +
      '<button class="ib" data-act="vis" data-i="' + i + '" aria-label="إظهار/إخفاء" title="إظهار/إخفاء">' + I(p.visible === false ? 'eyeoff' : 'eye') + '</button><button class="ib" data-act="editWork" data-i="' + i + '" aria-label="تعديل" title="تعديل">' + I('edit') + '</button><button class="ib" data-act="dup" data-i="' + i + '" aria-label="نسخ" title="نسخ">' + I('copy') + '</button><button class="ib bad" data-act="delWork" data-i="' + i + '" aria-label="حذف" title="حذف">' + I('trash') + '</button></div></div>').join('');
  }
  function vWorks() {
    return '<div class="toolbar"><input type="search" id="q" placeholder="ابحث في الأعمال…" value="' + esc(flt.q) + '"><select id="fc"><option value="all">كل الأقسام</option>' + S.categories.map(c => '<option value="' + esc(c.id) + '"' + (flt.cat === c.id ? ' selected' : '') + '>' + esc(c.name) + '</option>').join('') + '</select><button class="btn primary" data-act="addWork">' + I('plus') + ' إضافة عمل</button></div><div class="list" id="plist">' + listWorks() + '</div>';
  }

  function editWork(i) {
    if (!S.categories.length) { toast('أضف قسم الأول من تبويب «الأقسام».', true); return; }
    const isNew = i < 0;
    const p = isNew ? { id: uid('p'), category: flt.cat !== 'all' ? flt.cat : S.categories[0].id, title: '', desc: '', link: '', image: '', images: [], tag: '', visible: true, featured: false } : Object.assign({}, S.projects[i]);
    let gal = imgList(p).slice();
    const d = $('#dlg');
    d.innerHTML = '<form method="dialog" id="wf"><div class="dh"><h2>' + (isNew ? 'إضافة عمل جديد' : 'تعديل العمل') + '</h2><button type="button" class="ib" id="x" aria-label="إغلاق">' + I('x') + '</button></div><div class="db">' +
      '<label>العنوان<input id="w_t" required dir="auto" value="' + esc(p.title) + '"></label>' +
      '<div class="g2"><label>القسم<select id="w_c">' + S.categories.map(c => '<option value="' + esc(c.id) + '"' + (c.id === p.category ? ' selected' : '') + '>' + esc(c.name) + '</option>').join('') + '</select></label><label>وسم قصير (اختياري)<input id="w_g" placeholder="مثلًا: منيو، Android" value="' + esc(p.tag) + '"></label></div>' +
      '<label>الرابط (Behance / يوتيوب / متجر…)<input id="w_l" dir="ltr" placeholder="https://" value="' + esc(p.link) + '"></label>' +
      '<label>وصف قصير (اختياري)<textarea id="w_d" rows="2">' + esc(p.desc) + '</textarea></label>' +
      galleryField('w_gal') +
      '<div style="height:18px"></div><label class="sw"><input type="checkbox" id="w_v"' + (p.visible !== false ? ' checked' : '') + '>ظاهر في الموقع</label><label class="sw"><input type="checkbox" id="w_f"' + (p.featured ? ' checked' : '') + '>عمل مميّز (كارت أكبر)</label></div>' +
      '<div class="df"><button class="btn primary" type="submit">' + I('check') + ' حفظ</button><button class="btn ghost" type="button" id="cx">إلغاء</button></div></form>';
    d.onclose = null;
    bindGallery($('#w_gal', d), gal, 1600, v => { p.images = v; });
    const close = () => d.close(); $('#x', d).onclick = close; $('#cx', d).onclick = close;
    $('#wf', d).onsubmit = e => {
      e.preventDefault();
      p.images = gal.slice(); p.image = p.images[0] || '';
      Object.assign(p, { title: $('#w_t').value.trim(), category: $('#w_c').value, tag: $('#w_g').value.trim(), link: $('#w_l').value.trim(), desc: $('#w_d').value.trim(), visible: $('#w_v').checked, featured: $('#w_f').checked });
      if (isNew) S.projects.unshift(p); else S.projects[i] = p;
      d.close(); touch(); if (view === 'works') { $('#plist').innerHTML = listWorks(); } else go('works');
      toast(isNew ? 'اتضاف ✓ (لسه محتاج نشر)' : 'اتعدّل ✓ (لسه محتاج نشر)');
    };
    d.showModal(); $('#w_t').focus();
  }

  const TXT = [["القائمة العلوية", [["navWork", "أعمالي", "أعمالي"], ["navServices", "خدماتي", "خدماتي"], ["navAbout", "عني", "عني"], ["navFaq", "أسئلة", "أسئلة"], ["navContact", "تواصل", "تواصل"]]], ["قسم «بشتغل في إيه؟»", [["servicesTitle", "العنوان", "بشتغل في إيه؟"], ["servicesSub", "الجملة تحت العنوان", "اختار المجال وشوف شغلي فيه."], ["svcSee", "نص «شوفهم» في الصندوق", "شوفهم"], ["svcSoon", "نص القسم الفاضي", "قريبًا"]]], ["قسم «أعمالي»", [["workTitle", "العنوان", "أعمالي"], ["workSub", "الجملة تحت العنوان", "اضغط على أي عمل تشوفه بالحجم الكامل."], ["workMore", "زر صفحة الأعمال", "شوف صفحة الأعمال كاملة"], ["filterAll", "فلتر «الكل»", "الكل"], ["cardGoImg", "رابط الكارت (صور)", "شوف العمل"], ["cardGoVid", "رابط الكارت (فيديو)", "شاهد العمل"], ["emptyWorks", "لما مفيش أعمال", "لسه مفيش أعمال."]]], ["قسم «عني»", [["aboutSkills", "عنوان الأدوات", "الأدوات اللي بشتغل بيها"], ["aboutSpecs", "تسمية التخصصات", "التخصصات"], ["aboutBtn1", "الزر الأول", "كلمني"], ["aboutBtn2", "الزر التاني", "كل أعمالي"]]], ["أرقام الهيرو", [["factWorks", "بجانب عدد الأعمال", "أعمال"], ["factCats", "بجانب عدد المجالات", "مجالات"], ["factTools", "بجانب عدد الأدوات", "أدوات"]]], ["الأسئلة الشائعة", [["faqTitle", "العنوان", "أسئلة شائعة"], ["faqSub", "الجملة تحت العنوان", "إجابات سريعة قبل ما نتكلم."]]], ["نموذج التواصل", [["formName", "عنوان خانة الاسم", "اسمك"], ["formNamePh", "نص إرشادي للاسم", "اكتب اسمك"], ["formSvc", "عنوان اختيار الخدمة", "محتاج إيه؟"], ["formWhen", "عنوان اختيار الميعاد", "الميعاد المطلوب"], ["formMsg", "عنوان خانة التفاصيل", "تفاصيل شغلك"], ["formPreview", "عنوان معاينة الرسالة", "الرسالة اللي هتتبعت"], ["formPreviewEmpty", "معاينة الرسالة وهي فاضية", "رسالتك هتظهر هنا وانت بتكتب."], ["msgSvc", "سطر الخدمة جوه الرسالة", "محتاج:"], ["msgWhen", "سطر الميعاد جوه الرسالة", "الميعاد:"], ["mailSubject", "عنوان رسالة الإيميل", "طلب شغل"]]], ["كروت التواصل", [["ccAvail", "كارت التوفر", "متاح دلوقتي"], ["ccWa", "كارت واتساب", "واتساب"], ["ccMail", "كارت الإيميل", "الإيميل"], ["ccCopy", "زر النسخ", "نسخ"]]], ["رسائل صغيرة والفوتر", [["toastCopied", "بعد نسخ الإيميل", "اتنسخ الإيميل ✓"], ["toastNeed", "لو التفاصيل فاضية", "اكتب تفاصيل شغلك الأول"], ["toastReady", "بعد تجهيز الرسالة", "اتجهّزت الرسالة ✓"], ["footUp", "رابط الفوتر", "للأعلى"]]]];
  function faqList() {
    return '<div id="l_faq">' + S.faq.map((it, i) => '<div class="mini" data-i="' + i + '"><span class="grip">' + I('grip') + '</span><input class="n" data-b="faq.' + i + '.q" placeholder="السؤال" value="' + esc(it.q) + '"><textarea rows="2" data-b="faq.' + i + '.a" placeholder="الإجابة">' + esc(it.a) + '</textarea><button class="ib bad" data-act="ldel" data-p="faq" data-i="' + i + '" aria-label="حذف">' + I('x') + '</button></div>').join('') + '</div>';
  }
  function vTexts() {
    const sh = S.show || {}, lb = S.labels || {};
    const SEC = [['services', 'بشتغل في إيه؟ (الخدمات)'], ['work', 'أعمالي'], ['about', 'عني'], ['faq', 'الأسئلة الشائعة'], ['contact', 'التواصل']];
    return '<div class="panel"><h2>إظهار وإخفاء الأقسام</h2><p class="sub">اقفل أي قسم مش عايزه يظهر في الصفحة الرئيسية.</p><div class="g2">' + SEC.map(s => '<label class="sw"><input type="checkbox" data-b="show.' + s[0] + '"' + (sh[s[0]] !== false ? ' checked' : '') + '>' + s[1] + '</label>').join('') + '</div></div>' +
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
        '<label class="w">وصف القسم<input data-b="categories.' + i + '.desc" value="' + esc(c.desc) + '"></label><div class="clrrow w"><span>لون الصندوق</span><input type="color" data-b="categories.' + i + '.color" value="' + colorVal(c, i) + '" aria-label="لون الصندوق"><button class="btn sm ghost" type="button" data-act="ccol" data-i="' + i + '">لون تلقائي</button></div></div>' +
        '<div class="acts"><button class="ib" data-act="cup" data-i="' + i + '" ' + (i === 0 ? 'disabled' : '') + ' aria-label="فوق">' + I('up') + '</button><button class="ib" data-act="cdown" data-i="' + i + '" ' + (i === S.categories.length - 1 ? 'disabled' : '') + ' aria-label="تحت">' + I('down') + '</button><button class="ib bad" data-act="cdel" data-i="' + i + '" aria-label="حذف">' + I('trash') + '</button></div></div>').join('') + '</div>' +
      '<button class="btn primary" data-act="cadd">' + I('plus') + ' قسم جديد</button>';
  }

  function simpleList(path, arr, fields) { /* fields: [[key,placeholder,class]] */
    return '<div id="l_' + path + '">' + arr.map((it, i) => '<div class="mini" data-i="' + i + '"><span class="grip">' + I('grip') + '</span>' + fields.map(f => '<input class="' + (f[2] || '') + '" data-b="' + path + '.' + i + (f[0] ? '.' + f[0] : '') + '" placeholder="' + f[1] + '" value="' + esc(f[0] ? it[f[0]] : it) + '">').join('') + '<button class="ib bad" data-act="ldel" data-p="' + path + '" data-i="' + i + '" aria-label="حذف">' + I('x') + '</button></div>').join('') + '</div>';
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
      '<div class="panel"><h2>أرقام وإنجازات</h2><p class="sub">اختياري — لو فاضية، القسم بيختفي. (مثال: 5+ / سنين خبرة)</p>' + simpleList('stats', S.stats, [['value', '5+', 'n ltr'], ['label', 'سنين خبرة']]) + '<button class="btn sm" data-act="ladd" data-p="stats">' + I('plus') + ' إضافة رقم</button></div>';
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
    return '<div class="panel"><h2>الألوان والهوية</h2><p class="sub">تحكم في ألوان كل أجزاء الموقع. اترك أي لون فارغًا لاستخدام اللون الافتراضي.</p><div class="g2">' + colorField('bg','خلفية الموقع','#0B0A08') + colorField('bg2','الخلفية الثانوية','#100E0B') + colorField('surface','لون البطاقات','#14120E') + colorField('surface2','لون البطاقات الثانوي','#1C1913') + colorField('ink','لون النص الأساسي','#F4EEE1') + colorField('muted','لون النص الثانوي','#ABA392') + colorField('line','لون الحدود','#2B261A') + '</div><label>اللون الأساسي</label><div class="colors"><input type="color" id="accPick" value="' + esc(t.accent) + '" aria-label="اختيار لون">' + PRESETS.map(c => '<button type="button" class="sw-c' + (c.toLowerCase() === (t.accent || '').toLowerCase() ? ' on' : '') + '" style="background:' + c + '" data-act="acc" data-c="' + c + '" aria-label="' + c + '"></button>').join('') + '</div></div>' +
    '<div class="panel"><h2>الخطوط والطباعة</h2><p class="sub">اختار الخطوط وحجم النصوص وتدرج العناوين.</p><div class="g2"><label>خط النصوص<select data-b="design.bodyFont"><option value="Tajawal"' + (d.bodyFont==='Tajawal'?' selected':'') + '>Tajawal</option><option value="Roboto"' + (d.bodyFont==='Roboto'?' selected':'') + '>Roboto</option><option value="Alexandria"' + (d.bodyFont==='Alexandria'?' selected':'') + '>Alexandria</option></select></label><label>خط العناوين<select data-b="design.headingFont"><option value="Alexandria"' + (d.headingFont==='Alexandria'?' selected':'') + '>Alexandria</option><option value="Tajawal"' + (d.headingFont==='Tajawal'?' selected':'') + '>Tajawal</option><option value="Roboto"' + (d.headingFont==='Roboto'?' selected':'') + '>Roboto</option></select></label>' + num('bodySize','حجم النص الأساسي',14,24,1,'px') + num('headingScale','مقياس العناوين',0.8,1.4,0.05,'×') + '</div></div>' +
    '<div class="panel"><h2>تخطيط الصفحة والمسافات</h2><p class="sub">تحكم في عرض المحتوى والمسافات الرأسية بين الأقسام.</p><div class="g2">' + num('contentWidth','أقصى عرض للموقع',900,1600,20,'px') + num('sectionSpace','المسافة أعلى الأقسام',40,180,5,'px') + num('cardGap','المسافة بين الكروت',8,48,2,'px') + '</div></div>' +
    '<div class="panel"><h2>الكروت والأزرار</h2><p class="sub">تحكم في تدوير الحواف ونسبة صور الأعمال والظلال.</p><div class="g2">' + num('cardRadius','استدارة الكروت',0,48,2,'px') + num('buttonRadius','استدارة الأزرار',0,999,4,'px') + '<label>نسبة صورة العمل<select data-b="design.cardRatio"><option value="4/3"' + (d.cardRatio==='4/3'?' selected':'') + '>4:3 — متوسطة</option><option value="1/1"' + (d.cardRatio==='1/1'?' selected':'') + '>1:1 — مربعة</option><option value="3/4"' + (d.cardRatio==='3/4'?' selected':'') + '>3:4 — رأسية</option><option value="16/9"' + (d.cardRatio==='16/9'?' selected':'') + '>16:9 — عريضة</option></select></label><label>قوة الظلال<select data-b="design.shadow"><option value="0"' + (+d.shadow===0?' selected':'') + '>بدون</option><option value="0.5"' + (+d.shadow===.5?' selected':'') + '>خفيفة</option><option value="1"' + (+d.shadow===1?' selected':'') + '>متوسطة</option><option value="1.5"' + (+d.shadow===1.5?' selected':'') + '>قوية</option></select></label></div></div>' +
    '<div class="panel"><h2>الوضع و SEO</h2><label>الوضع الافتراضي<select data-b="theme.mode"><option value="dark"' + (t.mode==='dark'?' selected':'') + '>ليلي</option><option value="light"' + (t.mode==='light'?' selected':'') + '>نهاري</option><option value="auto"' + (t.mode==='auto'?' selected':'') + '>حسب جهاز الزائر</option></select></label><label class="sw"><input type="checkbox" data-b="theme.toggle"' + (t.toggle!==false?' checked':'') + '>أظهر زرار تبديل الوضع للزائر</label><label>عنوان الموقع<input data-b="meta.title" value="' + esc(S.meta.title) + '"></label><label>الوصف<textarea rows="3" data-b="meta.description">' + esc(S.meta.description) + '</textarea></label><label>نص الفوتر<input data-b="footer" value="' + esc(S.footer) + '"></label></div>';
  }
  function vAccount() {
    return '<div class="panel"><h2>الاتصال</h2><p class="sub">متصل بالريبو <b dir="ltr" style="color:var(--ink)">' + esc(gh.repo) + '</b> · فرع <b dir="ltr" style="color:var(--ink)">' + esc(gh.branch) + '</b></p><div class="chips"><a class="btn sm" target="_blank" rel="noopener" href="https://github.com/' + esc(gh.repo) + '/commits/' + esc(gh.branch) + '/data/site.js">' + I('history') + ' سجل التعديلات (ترجع لأي نسخة)</a><button class="btn sm danger" data-act="logout">' + I('logout') + ' تسجيل خروج</button></div></div>' +
      '<div class="panel"><h2>نسخة احتياطية</h2><p class="sub">نزّل كل محتوى موقعك كملف، أو استرجعه.</p><div class="chips"><button class="btn sm" data-act="export">' + I('download') + ' تنزيل نسخة</button><button class="btn sm" data-act="import">' + I('upload') + ' استرجاع من ملف</button><input type="file" id="impf" accept=".json,.js,application/json" hidden></div></div>' +
      '<div class="panel"><h2>مهم</h2><ul class="tips"><li>' + I('info') + '<span>كلمة السر بتتراجع على سيرفر محمي، والتوكن مش موجود في المتصفح ولا في الريبو. الجلسة بتنتهي لوحدها بعد 4 ساعات، ولو الجهاز مش بتاعك اعمل «تسجيل خروج».</span></li><li>' + I('info') + '<span>لو اتعدّل الموقع من مكان تاني (من GitHub مباشرة) افتح اللوحة تاني قبل ما تنشر عشان متمسحش تعديل.</span></li></ul></div>';
  }
  const RENDER = { home: vHome, works: vWorks, cats: vCats, content: vContent, contact: vContact, texts: vTexts, look: vLook, account: vAccount };

  function go(v) {
    view = v;
    $('#viewTitle').textContent = VIEWS.find(x => x[0] === v)[1];
    $$('#nav button').forEach(b => { b.classList.toggle('on', b.dataset.v === v); b.setAttribute('aria-current', b.dataset.v === v ? 'page' : 'false'); });
    const el = $('#view'); el.innerHTML = RENDER[v](); window.scrollTo(0, 0);
    if (v === 'works') sortable($('#plist'), () => S.projects, () => { touch(); $('#plist').innerHTML = listWorks(); });
    if (v === 'cats') sortable($('#clist'), () => S.categories, () => { touch(); go('cats'); });
    ['skills', 'stats', 'contact.socials', 'contact.steps', 'contact.when', 'faq'].forEach(p => { const c = $('#l_' + p); if (c) sortable(c, () => get(S, p), () => { touch(); go(view); }); });
    const hp = $('#hp'); if (hp) bindImageField(hp, 1200, v => { S.hero.photo = v; touch(); });
    const mg = $('#ap'); if (mg) bindGallery(mg, S.about.photos.slice(), 1200, v => { S.about.photos = v; touch(); });
    const ap = $('#accPick'); if (ap) ap.oninput = () => { S.theme.accent = ap.value; touch(); $$('.sw-c').forEach(x => x.classList.remove('on')); };
  }

  /* ---------- events ---------- */
  const view$ = () => $('#view');
  document.addEventListener('input', e => {
    const t = e.target;
    if (t.id === 'q') { flt.q = t.value; $('#plist').innerHTML = listWorks(); return; }
    if (t.id === 'fc') { flt.cat = t.value; $('#plist').innerHTML = listWorks(); return; }
    if (t.dataset && t.dataset.b && view$().contains(t)) { set(S, t.dataset.b, t.type === 'checkbox' ? t.checked : t.value); touch(); }
  });
  document.addEventListener('change', e => { if (e.target.id === 'fc') { flt.cat = e.target.value; $('#plist').innerHTML = listWorks(); } });

  document.addEventListener('click', async e => {
    const t = e.target;
    const g = t.closest('[data-go]'); if (g) { go(g.dataset.go); return; }
    const nv = t.closest('#nav button'); if (nv) { go(nv.dataset.v); return; }
    const b = t.closest('[data-act]'); if (!b) return;
    const a = b.dataset.act, i = +b.dataset.i;
    const list = () => { touch(); $('#plist').innerHTML = listWorks(); };
    if (a === 'addWork') editWork(-1);
    else if (a === 'editWork') editWork(i);
    else if (a === 'vis') { S.projects[i].visible = S.projects[i].visible === false; list(); }
    else if (a === 'dup') { const c = Object.assign({}, S.projects[i], { id: uid('p'), title: S.projects[i].title + ' (نسخة)' }); S.projects.splice(i + 1, 0, c); list(); }
    else if (a === 'delWork') { if (await ask('تمسح «' + (S.projects[i].title || 'العمل') + '»؟', 'مسح')) { S.projects.splice(i, 1); list(); } }
    else if (a === 'up' || a === 'down') {
      const q = flt.q.toLowerCase();
      const idx = S.projects.map((p, k) => k).filter(k => { const p = S.projects[k]; return (flt.cat === 'all' || p.category === flt.cat) && (!q || (p.title + ' ' + p.desc + ' ' + p.tag).toLowerCase().includes(q)); });
      const pos = idx.indexOf(i), tgt = idx[pos + (a === 'up' ? -1 : 1)]; if (tgt != null) { moveIdx(S.projects, i, tgt); list(); }
    }
    else if (a === 'cadd') { S.categories.push({ id: uid('c'), name: 'قسم جديد', desc: '', icon: 'star', type: 'image' }); touch(); go('cats'); }
    else if (a === 'cup' || a === 'cdown') { moveIdx(S.categories, i, i + (a === 'cup' ? -1 : 1)); touch(); go('cats'); }
    else if (a === 'cdel') {
      const c = S.categories[i], n = S.projects.filter(p => p.category === c.id).length;
      if (await ask(n ? 'هتمسح قسم «' + c.name + '» و' + n + ' عمل جواه. متأكد؟' : 'تمسح قسم «' + c.name + '»؟', 'مسح')) { S.projects = S.projects.filter(p => p.category !== c.id); S.categories.splice(i, 1); touch(); go('cats'); }
    }
    else if (a === 'ladd') { const arr = get(S, b.dataset.p); arr.push(b.dataset.p === 'faq' ? { q: '', a: '' } : b.dataset.p === 'skills' || b.dataset.p === 'contact.when' ? '' : b.dataset.p === 'stats' ? { value: '', label: '' } : b.dataset.p === 'contact.steps' ? { t: '', d: '' } : { name: '', url: '' }); touch(); go(view); const rows = $$('#l_' + b.dataset.p + ' .mini'); if (rows.length) rows[rows.length - 1].querySelector('input').focus(); }
    else if (a === 'ccol') { delete S.categories[+b.dataset.i].color; touch(); go(view); }
    else if (a === 'ldel') { get(S, b.dataset.p).splice(i, 1); touch(); go(view); }
    else if (a === 'acc') { S.theme.accent = b.dataset.c; touch(); go('look'); }
    else if (a === 'export') { const l = document.createElement('a'); l.href = URL.createObjectURL(new Blob(['window.SITE=' + JSON.stringify(S, null, 1) + ';\n'], { type: 'text/javascript' })); l.download = 'site-backup-' + new Date().toISOString().slice(0, 10) + '.js'; l.click(); }
    else if (a === 'import') { const f = $('#impf'); f.onchange = async () => { try { const x = parseSite(await f.files[0].text()); if (!Array.isArray(x.projects)) throw 0; S = norm(x); touch(); go('account'); toast('اتسترجعت النسخة — اضغط نشر لتطبيقها'); } catch (er) { toast('الملف ده مش نسخة صالحة.', true); } }; f.click(); }
    else if (a === 'logout') { if (await ask('تسجّل خروج؟', 'خروج')) { LS.del('token'); try { sessionStorage.removeItem('sx.admin.sess'); } catch (e) {} isDirty() && (orig = JSON.stringify(S)); location.reload(); } }
  });

  addEventListener('keydown', e => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); publish(); } });
  $('#btnPublish').onclick = publish;
  $('#btnDiscard').onclick = async () => { if (await ask('تتراجع عن كل التعديلات اللي لسه متنشرتش؟', 'تراجع')) { S = norm(parseSite('window.SITE=' + orig + ';')); touch(); go(view); toast('رجعنا لآخر نسخة منشورة'); } };
  $('#btnPreview').onclick = () => { $('#preview').hidden = false; $('#pframe').src = '../index.html?preview=1'; };
  $('#pClose').onclick = () => { $('#preview').hidden = true; $('#pframe').src = 'about:blank'; };
  $$('.seg button').forEach(b => b.onclick = () => { $$('.seg button').forEach(x => x.classList.toggle('on', x === b)); $('.pstage').classList.toggle('mob', b.dataset.dev === 'm'); });

  /* ---------- boot ---------- */
  function start() {
    $('#login').hidden = true; $('#app').hidden = false;
    $('#repoName').textContent = gh.repo; $('#openSite').href = siteUrl; $('#openSite').innerHTML = I('ext') + ' فتح الموقع';
    $('#nav').innerHTML = VIEWS.map(v => '<button type="button" data-v="' + v[0] + '">' + I(v[2]) + '<span>' + v[1] + '</span></button>').join('');
    $('#btnPreview').innerHTML = I('eye') + ' معاينة'; $('#btnDiscard').innerHTML = I('undo') + ' تراجع';
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
