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
    ['content', 'محتوى الصفحة', 'user'], ['contact', 'التواصل', 'mail'], ['look', 'المظهر و SEO', 'sliders'], ['account', 'الحساب والنسخ', 'key']
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
    d.hero = d.hero || {}; d.about = d.about || {}; d.contact = d.contact || {}; d.contact.socials = d.contact.socials || [];
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
    c.hero.photo = fix(c.hero.photo); c.projects.forEach(p => p.image = fix(p.image));
    return c;
  }
  function pushPreview() {
    const f = $('#pframe'); if ($('#preview').hidden || !f.contentWindow) return;
    f.contentWindow.postMessage({ type: 'sx-preview', data: previewData() }, location.origin);
  }
  addEventListener('message', e => { if (e.origin === location.origin && e.data && e.data.type === 'sx-ready') pushPreview(); });
  addEventListener('beforeunload', e => { if (isDirty()) { e.preventDefault(); e.returnValue = ''; } });

  /* ---------- publish ---------- */
  const allImages = () => [S.hero.photo].concat(S.projects.map(p => p.image)).filter(Boolean);
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
    return rows.map(([p, i], k) => '<div class="row' + (p.visible === false ? ' hid' : '') + '" data-i="' + i + '"><span class="grip" title="اسحب لإعادة الترتيب">' + I('grip') + '</span>' + '<div class="th">' + (p.image ? '<img src="' + esc(imgSrc(p.image)) + '" alt="" onerror="this.remove()">' : I(catIcon(p.category))) + '</div>' +
      '<div class="rt"><b dir="auto">' + esc(p.title || 'بدون عنوان') + '</b><small>' + esc(catName(p.category)) + '</small></div>' +
      (p.featured ? '<span class="badge gold">مميّز</span>' : '') + (p.tag ? '<span class="badge">' + esc(p.tag) + '</span>' : '') + (p.visible === false ? '<span class="badge">مخفي</span>' : '') +
      '<div class="acts"><button class="ib" data-act="up" data-i="' + i + '" aria-label="فوق" ' + (k === 0 ? 'disabled' : '') + '>' + I('up') + '</button><button class="ib" data-act="down" data-i="' + i + '" aria-label="تحت" ' + (k === rows.length - 1 ? 'disabled' : '') + '>' + I('down') + '</button>' +
      '<button class="ib" data-act="vis" data-i="' + i + '" aria-label="إظهار/إخفاء" title="إظهار/إخفاء">' + I(p.visible === false ? 'eyeoff' : 'eye') + '</button><button class="ib" data-act="editWork" data-i="' + i + '" aria-label="تعديل" title="تعديل">' + I('edit') + '</button><button class="ib" data-act="dup" data-i="' + i + '" aria-label="نسخ" title="نسخ">' + I('copy') + '</button><button class="ib bad" data-act="delWork" data-i="' + i + '" aria-label="حذف" title="حذف">' + I('trash') + '</button></div></div>').join('');
  }
  function vWorks() {
    return '<div class="toolbar"><input type="search" id="q" placeholder="ابحث في الأعمال…" value="' + esc(flt.q) + '"><select id="fc"><option value="all">كل الأقسام</option>' + S.categories.map(c => '<option value="' + esc(c.id) + '"' + (flt.cat === c.id ? ' selected' : '') + '>' + esc(c.name) + '</option>').join('') + '</select><button class="btn primary" data-act="addWork">' + I('plus') + ' إضافة عمل</button></div><div class="list" id="plist">' + listWorks() + '</div>';
  }

  function editWork(i) {
    if (!S.categories.length) { toast('أضف قسم الأول من تبويب «الأقسام».', true); return; }
    const isNew = i < 0;
    const p = isNew ? { id: uid('p'), category: flt.cat !== 'all' ? flt.cat : S.categories[0].id, title: '', desc: '', link: '', image: '', tag: '', visible: true, featured: false } : Object.assign({}, S.projects[i]);
    const d = $('#dlg');
    d.innerHTML = '<form method="dialog" id="wf"><div class="dh"><h2>' + (isNew ? 'إضافة عمل جديد' : 'تعديل العمل') + '</h2><button type="button" class="ib" id="x" aria-label="إغلاق">' + I('x') + '</button></div><div class="db">' +
      '<label>العنوان<input id="w_t" required dir="auto" value="' + esc(p.title) + '"></label>' +
      '<div class="g2"><label>القسم<select id="w_c">' + S.categories.map(c => '<option value="' + esc(c.id) + '"' + (c.id === p.category ? ' selected' : '') + '>' + esc(c.name) + '</option>').join('') + '</select></label><label>وسم قصير (اختياري)<input id="w_g" placeholder="مثلًا: منيو، Android" value="' + esc(p.tag) + '"></label></div>' +
      '<label>الرابط (Behance / يوتيوب / متجر…)<input id="w_l" dir="ltr" placeholder="https://" value="' + esc(p.link) + '"></label>' +
      '<label>وصف قصير (اختياري)<textarea id="w_d" rows="2">' + esc(p.desc) + '</textarea></label>' +
      imageField('w_img', 'الصورة', p.image, false) +
      '<div style="height:18px"></div><label class="sw"><input type="checkbox" id="w_v"' + (p.visible !== false ? ' checked' : '') + '>ظاهر في الموقع</label><label class="sw"><input type="checkbox" id="w_f"' + (p.featured ? ' checked' : '') + '>عمل مميّز (كارت أكبر)</label></div>' +
      '<div class="df"><button class="btn primary" type="submit">' + I('check') + ' حفظ</button><button class="btn ghost" type="button" id="cx">إلغاء</button></div></form>';
    d.onclose = null;
    bindImageField($('#w_img', d), 1600, v => { p.image = v; });
    const close = () => d.close(); $('#x', d).onclick = close; $('#cx', d).onclick = close;
    $('#wf', d).onsubmit = e => {
      e.preventDefault();
      Object.assign(p, { title: $('#w_t').value.trim(), category: $('#w_c').value, tag: $('#w_g').value.trim(), link: $('#w_l').value.trim(), desc: $('#w_d').value.trim(), visible: $('#w_v').checked, featured: $('#w_f').checked });
      if (isNew) S.projects.unshift(p); else S.projects[i] = p;
      d.close(); touch(); if (view === 'works') { $('#plist').innerHTML = listWorks(); } else go('works');
      toast(isNew ? 'اتضاف ✓ (لسه محتاج نشر)' : 'اتعدّل ✓ (لسه محتاج نشر)');
    };
    d.showModal(); $('#w_t').focus();
  }

  function vCats() {
    return '<p style="color:var(--muted);margin-top:0">الأقسام هي اللي بتظهر في «بشتغل في إيه؟» وفلاتر الأعمال. نوع «فيديو» بيضيف زرار تشغيل على الكروت.</p>' +
      '<div id="clist">' + S.categories.map((c, i) => '<div class="crow" data-i="' + i + '"><span class="grip">' + I('grip') + '</span><div class="fields">' +
        '<label>اسم القسم<input data-b="categories.' + i + '.name" value="' + esc(c.name) + '"></label>' +
        '<label>الأيقونة<select data-b="categories.' + i + '.icon">' + ICON_CHOICES.map(n => '<option' + (n === c.icon ? ' selected' : '') + '>' + n + '</option>').join('') + '</select></label>' +
        '<label>النوع<select data-b="categories.' + i + '.type"><option value="image"' + (c.type !== 'video' ? ' selected' : '') + '>صور / مشاريع</option><option value="video"' + (c.type === 'video' ? ' selected' : '') + '>فيديو</option></select></label>' +
        '<label class="w">وصف القسم<input data-b="categories.' + i + '.desc" value="' + esc(c.desc) + '"></label></div>' +
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
      imageField('hp', 'الصورة الشخصية', h.photo, true) + '<small class="h">الأفضل صورة رأسية (4:5) بخلفية واضحة.</small><div style="height:16px"></div>' +
      '<label class="sw"><input type="checkbox" data-b="hero.available"' + (h.available ? ' checked' : '') + '>أظهر شارة «متاح للعمل»</label><label>نص الشارة<input data-b="hero.availableText" value="' + esc(h.availableText) + '"></label>' +
      '<div class="g2"><label>نص الزر الأول<input data-b="hero.cta1Text" value="' + esc(h.cta1Text) + '"></label><label>رابط الزر الأول<input dir="ltr" list="anch" data-b="hero.cta1Link" value="' + esc(h.cta1Link) + '"></label><label>نص الزر التاني<input data-b="hero.cta2Text" value="' + esc(h.cta2Text) + '"></label><label>رابط الزر التاني<input dir="ltr" list="anch" data-b="hero.cta2Link" value="' + esc(h.cta2Link) + '"></label></div>' +
      '<datalist id="anch"><option value="#work"><option value="#services"><option value="#about"><option value="#contact"></datalist></div>' +
      '<div class="panel"><h2>نبذة عني</h2><p class="sub">&nbsp;</p><label>العنوان<input data-b="about.title" value="' + esc(a.title) + '"></label><label>النص<textarea rows="5" data-b="about.text">' + esc(a.text) + '</textarea></label></div>' +
      '<div class="panel"><h2>الأدوات والمهارات</h2><p class="sub">بتظهر كشريط متحرك وفي قسم «عني».</p>' + simpleList('skills', S.skills, [['', 'اسم الأداة']]) + '<button class="btn sm" data-act="ladd" data-p="skills">' + I('plus') + ' إضافة</button></div>' +
      '<div class="panel"><h2>أرقام وإنجازات</h2><p class="sub">اختياري — لو فاضية، القسم بيختفي. (مثال: 5+ / سنين خبرة)</p>' + simpleList('stats', S.stats, [['value', '5+', 'n ltr'], ['label', 'سنين خبرة']]) + '<button class="btn sm" data-act="ladd" data-p="stats">' + I('plus') + ' إضافة رقم</button></div>';
  }
  function vContact() {
    const c = S.contact;
    return '<div class="panel"><h2>بيانات التواصل</h2><p class="sub">&nbsp;</p><label>عنوان القسم<input data-b="contact.title" value="' + esc(c.title) + '"></label><label>نص ترحيبي<textarea rows="2" data-b="contact.text">' + esc(c.text) + '</textarea></label>' +
      '<div class="g2"><label>الإيميل<input dir="ltr" data-b="contact.email" value="' + esc(c.email) + '"></label><label>واتساب (بكود الدولة بدون + وبدون صفر)<input dir="ltr" data-b="contact.whatsapp" value="' + esc(c.whatsapp) + '"></label></div></div>' +
      '<div class="panel"><h2>حسابات السوشيال</h2><p class="sub">اسحب لإعادة الترتيب.</p>' + simpleList('contact.socials', c.socials, [['name', 'الاسم', 'n'], ['url', 'https://…', 'ltr']]) + '<button class="btn sm" data-act="ladd" data-p="contact.socials">' + I('plus') + ' إضافة حساب</button></div>';
  }
  const PRESETS = ['#C9A24B', '#E0B84F', '#D97706', '#E11D48', '#8B5CF6', '#3B82F6', '#10B981', '#14B8A6'];
  function vLook() {
    const t = S.theme;
    return '<div class="panel"><h2>اللون الأساسي</h2><p class="sub">بيتطبق على الأزرار والعناوين وكل التفاصيل.</p><div class="colors"><input type="color" id="accPick" value="' + esc(t.accent) + '" aria-label="اختيار لون">' + PRESETS.map(c => '<button type="button" class="sw-c' + (c.toLowerCase() === (t.accent || '').toLowerCase() ? ' on' : '') + '" style="background:' + c + '" data-act="acc" data-c="' + c + '" aria-label="' + c + '"></button>').join('') + '</div></div>' +
      '<div class="panel"><h2>الوضع</h2><p class="sub">&nbsp;</p><label>الوضع الافتراضي<select data-b="theme.mode"><option value="dark"' + (t.mode === 'dark' ? ' selected' : '') + '>ليلي</option><option value="light"' + (t.mode === 'light' ? ' selected' : '') + '>نهاري</option><option value="auto"' + (t.mode === 'auto' ? ' selected' : '') + '>حسب جهاز الزائر</option></select></label><label class="sw"><input type="checkbox" data-b="theme.toggle"' + (t.toggle !== false ? ' checked' : '') + '>أظهر زرار تبديل الوضع للزائر</label></div>' +
      '<div class="panel"><h2>محركات البحث (SEO)</h2><p class="sub">العنوان والوصف اللي بيظهروا في جوجل وعند مشاركة الرابط.</p><label>عنوان الموقع<input data-b="meta.title" value="' + esc(S.meta.title) + '"></label><label>الوصف<textarea rows="3" data-b="meta.description">' + esc(S.meta.description) + '</textarea></label><label>نص الفوتر<input data-b="footer" value="' + esc(S.footer) + '"></label></div>';
  }
  function vAccount() {
    return '<div class="panel"><h2>الاتصال</h2><p class="sub">متصل بالريبو <b dir="ltr" style="color:var(--ink)">' + esc(gh.repo) + '</b> · فرع <b dir="ltr" style="color:var(--ink)">' + esc(gh.branch) + '</b></p><div class="chips"><a class="btn sm" target="_blank" rel="noopener" href="https://github.com/' + esc(gh.repo) + '/commits/' + esc(gh.branch) + '/data/site.js">' + I('history') + ' سجل التعديلات (ترجع لأي نسخة)</a><button class="btn sm danger" data-act="logout">' + I('logout') + ' تسجيل خروج</button></div></div>' +
      '<div class="panel"><h2>نسخة احتياطية</h2><p class="sub">نزّل كل محتوى موقعك كملف، أو استرجعه.</p><div class="chips"><button class="btn sm" data-act="export">' + I('download') + ' تنزيل نسخة</button><button class="btn sm" data-act="import">' + I('upload') + ' استرجاع من ملف</button><input type="file" id="impf" accept=".json,.js,application/json" hidden></div></div>' +
      '<div class="panel"><h2>مهم</h2><ul class="tips"><li>' + I('info') + '<span>كلمة السر بتتراجع على سيرفر محمي، والتوكن مش موجود في المتصفح ولا في الريبو. الجلسة بتنتهي لوحدها بعد 4 ساعات، ولو الجهاز مش بتاعك اعمل «تسجيل خروج».</span></li><li>' + I('info') + '<span>لو اتعدّل الموقع من مكان تاني (من GitHub مباشرة) افتح اللوحة تاني قبل ما تنشر عشان متمسحش تعديل.</span></li></ul></div>';
  }
  const RENDER = { home: vHome, works: vWorks, cats: vCats, content: vContent, contact: vContact, look: vLook, account: vAccount };

  function go(v) {
    view = v;
    $('#viewTitle').textContent = VIEWS.find(x => x[0] === v)[1];
    $$('#nav button').forEach(b => { b.classList.toggle('on', b.dataset.v === v); b.setAttribute('aria-current', b.dataset.v === v ? 'page' : 'false'); });
    const el = $('#view'); el.innerHTML = RENDER[v](); window.scrollTo(0, 0);
    if (v === 'works') sortable($('#plist'), () => S.projects, () => { touch(); $('#plist').innerHTML = listWorks(); });
    if (v === 'cats') sortable($('#clist'), () => S.categories, () => { touch(); go('cats'); });
    ['skills', 'stats', 'contact.socials'].forEach(p => { const c = $('#l_' + p); if (c) sortable(c, () => get(S, p), () => { touch(); go(view); }); });
    const hp = $('#hp'); if (hp) bindImageField(hp, 1200, v => { S.hero.photo = v; touch(); });
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
    else if (a === 'ladd') { const arr = get(S, b.dataset.p); arr.push(b.dataset.p === 'skills' ? '' : b.dataset.p === 'stats' ? { value: '', label: '' } : { name: '', url: '' }); touch(); go(view); const rows = $$('#l_' + b.dataset.p + ' .mini'); if (rows.length) rows[rows.length - 1].querySelector('input').focus(); }
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
