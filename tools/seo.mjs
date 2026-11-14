// سكربت السيو: بيقرأ data/site.js وبيولّد
//  1) محتوى HTML ثابت جوه index.html (بيشوفه جوجل وواتساب وفيسبوك قبل ما الـJS يشتغل)
//  2) وسوم og / twitter / canonical / JSON-LD في <head>
//  3) sitemap.xml و robots.txt
// التشغيل (من فولدر الموقع):  node tools/seo.mjs
// رابط الموقع النهائي بيتحط في tools/seo.config.json (SITE_URL) أو: SITE_URL=https://example.com/ node tools/seo.mjs
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const rd = f => fs.readFileSync(path.join(root, f), 'utf8');
const wr = (f, s) => fs.writeFileSync(path.join(root, f), s);

const cfg = JSON.parse(rd('tools/seo.config.json'));
let site = (process.env.SITE_URL || cfg.SITE_URL || '').trim();
if (site && !site.endsWith('/')) site += '/';
if (site && !/^https:\/\/[^\s]+$/.test(site)) throw new Error('SITE_URL لازم يبدأ بـ https://');

const ctx = { window: {} };
vm.runInNewContext(rd('data/site.js'), ctx);
const D = ctx.window.SITE;
const Q = D.seo || {};   // إعدادات SEO من لوحة التحكم (بتغلّب على tools/seo.config.json)

const E = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const abs = u => !u ? '' : /^https?:/i.test(u) ? u : site ? site + u.replace(/^\.?\//, '') : '';
const safeUrl = u => /^(https?:\/\/|mailto:|tel:|#)/i.test(u || '') ? u : '#';

const title = D.meta?.title || D.hero?.name;
const desc = D.meta?.description || D.hero?.sub || '';
const ogImg = abs(Q.ogImage || cfg.OG_IMAGE || D.hero?.photo);
const NAME_EN = Q.nameEn || cfg.NAME_EN || '';
const ALT = [...new Set([NAME_EN, ...(cfg.ALT_NAMES || [])].filter(Boolean))];
const JOB_EN = cfg.JOB_TITLE_EN || '';
const JOB = Q.jobTitle || cfg.JOB_TITLE, CITY = Q.city || cfg.CITY, COUNTRY = Q.country || cfg.COUNTRY;
(D.projects || []).forEach((p, k) => { if (p && !p.id) p.id = 'x' + k; });   // نفس منطق site.js
const visible = (D.projects || []).filter(p => p && p.visible !== false);
/* ---------- روابط الأعمال (slugs): ثابتة لكل مشروع حتى لو العنوان اتغيّر ---------- */
let prevSlugs = {};
try { const sc = { window: {} }; vm.runInNewContext(rd('data/slugs.js'), sc); prevSlugs = sc.window.SLUGS || {}; } catch (e) {}
const asciiSlug = t => String(t || '').normalize('NFKD').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60).replace(/-+$/, '');
const slugs = {}, usedSlugs = new Set();
const takeSlug = (p, cand) => { let s0 = cand, n = 2; while (usedSlugs.has(s0)) s0 = cand + '-' + n++; usedSlugs.add(s0); slugs[String(p.id)] = s0; };
visible.forEach(p => { const c = asciiSlug(p.slug); if (c.length >= 2) takeSlug(p, c); });
visible.forEach(p => { const o = prevSlugs[String(p.id)]; if (!slugs[String(p.id)] && typeof o === 'string' && /^[a-z0-9-]{2,}$/.test(o) && !usedSlugs.has(o)) takeSlug(p, o); });
visible.forEach(p => { if (slugs[String(p.id)]) return; const b = asciiSlug(p.title); takeSlug(p, b.length >= 3 ? b : 'work-' + (asciiSlug(p.id) || 'x')); });
const workLi = p => {
  const u = safeUrl(p.link), sg = slugs[String(p.id)];
  const t = sg ? '<a href="work/' + E(sg) + '/">' + E(p.title) + '</a>' : u === '#' ? E(p.title) : '<a href="' + E(u) + '" rel="noopener">' + E(p.title) + '</a>';
  return '<li>' + t + ' (' + E(catName(p.category)) + ')' + (p.desc ? ': ' + E(p.desc) : '') + '</li>';
};
const catName = id => (D.categories || []).find(c => c.id === id)?.name || '';

/* ---------- 1) <head> ---------- */
const sameAs = (D.contact?.socials || []).map(s => s.url).filter(u => /^https:/.test(u));
const person = {
  '@context': 'https://schema.org', '@type': 'Person', ...(site && { '@id': site + '#person' }),
  name: D.hero?.name, ...(ALT.length && { alternateName: ALT }), description: desc, jobTitle: JOB,
  ...(site && { url: site }), ...(abs(D.hero?.photo) && { image: abs(D.hero.photo) }),
  ...(D.contact?.email && { email: D.contact.email }),
  ...(CITY && { address: { '@type': 'PostalAddress', addressLocality: CITY, addressCountry: COUNTRY } }),
  knowsAbout: D.skills, sameAs
};
const faq = (D.faq || []).length ? {
  '@context': 'https://schema.org', '@type': 'FAQPage',
  mainEntity: D.faq.map(f => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } }))
} : null;
const pkgs = (D.packages || []).filter(k => k.name && k.visible !== false);
const waDigits = String(D.contact?.whatsapp || '').replace(/\D/g, '');
/* نشاط الخدمات: بيخلّي جوجل يفهم إنك بتقدّم خدمات (مش مجرد شخص) وبيربط كل باقة بخدمة */
/* بيحوّل نص السعر ("500 جنيه") لسعر منظّم في السيو. الواجهة بتكتب "ابتداءً من" فبنستخدم minPrice */
const offerPrice = txt => {
  const AR = '٠١٢٣٤٥٦٧٨٩';
  const n = parseFloat(String(txt || '').replace(/[٠-٩]/g, d => AR.indexOf(d)).replace(/[,٬\s]/g, '').match(/\d+(?:\.\d+)?/)?.[0]);
  return Number.isFinite(n) ? { priceSpecification: { '@type': 'PriceSpecification', minPrice: n, priceCurrency: 'EGP' } } : {};
};
const biz = pkgs.length ? {
  '@context': 'https://schema.org', '@type': 'ProfessionalService',
  ...(site && { '@id': site + '#service', url: site }),
  name: D.hero?.name, ...(ALT.length && { alternateName: ALT }), description: desc,
  ...(abs(D.hero?.photo) && { image: abs(D.hero.photo) }),
  ...(waDigits && { telephone: '+' + waDigits }),
  ...(D.contact?.email && { email: D.contact.email }),
  ...(CITY && { address: { '@type': 'PostalAddress', addressLocality: CITY, addressCountry: COUNTRY } }),
  ...(site && { founder: { '@id': site + '#person' } }),
  sameAs,
  hasOfferCatalog: {
    '@type': 'OfferCatalog', name: 'الباقات والخدمات',
    itemListElement: pkgs.map(k => ({
      '@type': 'Offer',
      ...offerPrice(k.price),
      itemOffered: { '@type': 'Service', name: k.name, ...(k.desc && { description: k.desc }), ...(catName(k.category) && { serviceType: catName(k.category) }) }
    }))
  }
} : null;
const website = site ? { '@context': 'https://schema.org', '@type': 'WebSite', name: D.hero?.name, ...(ALT.length && { alternateName: ALT }), url: site, inLanguage: 'ar' } : null;
const ogDimsMeta = (!Q.ogImage && cfg.OG_IMAGE_WIDTH && cfg.OG_IMAGE_HEIGHT)
  ? ['<meta property="og:image:width" content="' + cfg.OG_IMAGE_WIDTH + '">', '<meta property="og:image:height" content="' + cfg.OG_IMAGE_HEIGHT + '">'] : [];
const ld = o => '<script type="application/ld+json">' + JSON.stringify(o).replace(/</g, '\\u003c') + '</script>';

const head = [
  '<title>' + E(title) + '</title>',
  '<meta name="description" content="' + E(desc) + '">',
  '<meta property="og:type" content="website">',
  '<meta property="og:title" content="' + E(title) + '">',
  '<meta property="og:description" content="' + E(desc) + '">',
  '<meta name="sx-mode" content="' + E(['light', 'auto'].includes(D.theme?.mode) ? D.theme.mode : 'dark') + '">',
  '<meta name="robots" content="index,follow,max-image-preview:large">',
  '<meta name="author" content="' + E(D.hero?.name) + '">',
  '<meta property="og:locale" content="ar_AR">',
  '<meta property="og:site_name" content="' + E(D.hero?.name) + '">',
  site && '<link rel="canonical" href="' + E(site) + '">',
  site && '<meta property="og:url" content="' + E(site) + '">',
  ogImg && '<meta property="og:image" content="' + E(ogImg) + '">',
  ogImg && '<meta property="og:image:alt" content="' + E(D.hero?.name) + '">',
  ...ogDimsMeta,
  '<meta name="twitter:card" content="' + (ogImg ? 'summary_large_image' : 'summary') + '">',
  '<meta name="twitter:title" content="' + E(title) + '">',
  '<meta name="twitter:description" content="' + E(desc) + '">',
  ogImg && '<meta name="twitter:image" content="' + E(ogImg) + '">',
  ld(person), biz && ld(biz), website && ld(website), faq && ld(faq)
].filter(Boolean).join('\n');

/* ---------- 2) المحتوى الثابت ---------- */
const body = [
  '<main class="seo-static" style="max-width:760px;margin:0 auto;padding:48px 20px;line-height:1.9">',
  '<header><p>' + E(D.hero?.eyebrow) + '</p><h1>' + E(D.hero?.name) + '</h1>' + (NAME_EN ? '<p lang="en" dir="ltr">' + E(NAME_EN) + (JOB_EN ? ' — ' + E(JOB_EN) : '') + '</p>' : '') + '<p>' + E(D.hero?.sub) + '</p></header>',
  D.about?.text && '<section><h2>' + E(D.about.title || 'نبذة عني') + '</h2><p>' + E(D.about.text) + '</p></section>',
  (D.skills || []).length && '<section><h2>الأدوات والمهارات</h2><ul>' + D.skills.map(s => '<li>' + E(s) + '</li>').join('') + '</ul></section>',
  (D.categories || []).length && '<section><h2>المجالات</h2><ul>' + D.categories.map(c => '<li><strong>' + E(c.name) + '</strong>: ' + E(c.desc) + '</li>').join('') + '</ul></section>',
  visible.length && '<section><h2>أعمالي</h2><ul>' + visible.map(workLi).join('') + '</ul><p><a href="works.html">كل الأعمال</a></p></section>',
  (D.packages || []).filter(k => k.name && k.visible !== false).length && '<section><h2>الباقات والخدمات</h2><ul>' + D.packages.filter(k => k.name && k.visible !== false).map(k => '<li><strong>' + E(k.name) + '</strong>' + (k.desc ? ': ' + E(k.desc) : '') + '</li>').join('') + '</ul></section>',
  (D.why || []).filter(w => w.t).length && '<section><h2>ليه تشتغل معايا؟</h2><ul>' + D.why.filter(w => w.t).map(w => '<li><strong>' + E(w.t) + '</strong>' + (w.d ? ': ' + E(w.d) : '') + '</li>').join('') + '</ul></section>',
  (D.faq || []).length && '<section><h2>أسئلة شائعة</h2>' + D.faq.map(f => '<h3>' + E(f.q) + '</h3><p>' + E(f.a) + '</p>').join('') + '</section>',
  '<section><h2>' + E(D.contact?.title || 'تواصل') + '</h2><p>' + E(D.contact?.text) + '</p><ul>' +
    (D.contact?.email ? '<li><a href="mailto:' + E(D.contact.email) + '">' + E(D.contact.email) + '</a></li>' : '') +
    (D.contact?.whatsapp ? '<li><a href="https://wa.me/' + E(D.contact.whatsapp) + '">واتساب</a></li>' : '') +
    (D.contact?.socials || []).map(s => '<li><a href="' + E(safeUrl(s.url)) + '" rel="me noopener">' + E(s.name) + '</a></li>').join('') + '</ul></section>',
  '</main>'
].filter(Boolean).join('\n');

/* ---------- حقن في index.html ---------- */
function inject(html, name, content) {
  const re = new RegExp('<!--' + name + ':START-->[\\s\\S]*?<!--' + name + ':END-->');
  const block = '<!--' + name + ':START-->\n' + content + '\n<!--' + name + ':END-->';
  return re.test(html) ? html.replace(re, () => block) : null;
}
let html = rd('index.html');
const h1 = inject(html, 'SEO-HEAD', head), h2 = h1 && inject(h1, 'SEO-BODY', body);
if (!h2) throw new Error('علامات SEO-HEAD / SEO-BODY مش موجودة في index.html');
wr('index.html', h2);

/* ---------- 2b) works.html ---------- */
if (fs.existsSync(path.join(root, 'works.html'))) {
  const wTitle = Q.worksTitle || ((D.labels?.wkTitle || 'أعمالي') + ' | ' + (D.hero?.name || ''));
  const wDesc = Q.worksDesc || ('معرض أعمال ' + (D.hero?.name || '') + ': ' + (D.categories || []).map(c => c.name).filter(Boolean).join('، ') + '.');
  const wUrl = site ? site + 'works.html' : '';
  const itemList = {
    '@context': 'https://schema.org', '@type': 'CollectionPage', name: wTitle, description: wDesc,
    ...(wUrl && { url: wUrl }),
    mainEntity: { '@type': 'ItemList', itemListElement: visible.map((p, i) => ({
      '@type': 'ListItem', position: i + 1, name: p.title,
      ...(/^https:/.test(p.link || '') && { url: p.link }), ...(abs(p.image) && { image: abs(p.image) })
    })) }
  };
  const crumbs = site ? {
    '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
      { '@type': 'ListItem', position: 1, name: D.hero?.name, item: site },
      { '@type': 'ListItem', position: 2, name: 'أعمالي', item: wUrl }]
  } : null;
  const wHead = [
    '<title>' + E(wTitle) + '</title>',
    '<meta name="description" content="' + E(wDesc) + '">',
    '<meta property="og:type" content="website">',
    '<meta property="og:title" content="' + E(wTitle) + '">',
    '<meta property="og:description" content="' + E(wDesc) + '">',
    '<meta property="og:locale" content="ar_AR">',
    wUrl && '<link rel="canonical" href="' + E(wUrl) + '">',
    wUrl && '<meta property="og:url" content="' + E(wUrl) + '">',
    ...ogDimsMeta,
    ogImg && '<meta property="og:image" content="' + E(ogImg) + '">',
    '<meta name="sx-mode" content="' + E(['light', 'auto'].includes(D.theme?.mode) ? D.theme.mode : 'dark') + '">',
    '<meta name="robots" content="index,follow,max-image-preview:large">',
    '<meta name="author" content="' + E(D.hero?.name) + '">',
    '<meta property="og:site_name" content="' + E(D.hero?.name) + '">',
    '<meta name="twitter:card" content="' + (ogImg ? 'summary_large_image' : 'summary') + '">',
    '<meta name="twitter:title" content="' + E(wTitle) + '">',
    '<meta name="twitter:description" content="' + E(wDesc) + '">',
    ogImg && '<meta name="twitter:image" content="' + E(ogImg) + '">',
    ld(itemList), crumbs && ld(crumbs)
  ].filter(Boolean).join('\n');
  const wBody = '<main class="seo-static" style="max-width:760px;margin:0 auto;padding:48px 20px;line-height:1.9">' +
    '<header><h1>أعمالي</h1><p><a href="./">' + E(D.hero?.name) + '</a></p></header>' +
    (D.categories || []).map(c => {
      const ps = visible.filter(p => p.category === c.id);
      return ps.length ? '<section><h2>' + E(c.name) + '</h2><ul>' + ps.map(workLi).join('') + '</ul></section>' : '';
    }).join('') + '</main>';
  let w = rd('works.html');
  const w1 = inject(w, 'SEO-HEAD', wHead), w2 = w1 && inject(w1, 'SEO-BODY', wBody);
  if (w2) wr('works.html', w2); else console.warn('تنبيه: علامات SEO مش موجودة في works.html');
}

/* ---------- 2c) صفحة مستقلة لكل عمل: work/<slug>/index.html + data/slugs.js ---------- */
const PJ_IC = {
  sun: '<circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4"/>',
  arrowL: '<path d="M19 12H5M12 19l-7-7 7-7"/>',
  ext: '<path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3"/>',
  check: '<path d="M20 6L9 17l-5-5"/>'
};
const pjIc = n => '<svg class="i" viewBox="0 0 24 24" aria-hidden="true">' + PJ_IC[n] + '</svg>';
const fileHash = f => { try { return crypto.createHash('md5').update(fs.readFileSync(path.join(root, f))).digest('hex').slice(0, 8); } catch (e) { return ''; } };
const vSite = (/assets\/site\.css\?v=(\w+)/.exec(rd('index.html')) || [])[1];
const withV = (f, v) => f + (v ? '?v=' + v : '');
const okImg = u => /^(https?:\/\/|data:image\/|images\/|assets\/)/i.test(String(u || '').trim()) ? String(u).trim() : '';
const imgsOf = p => { let a = Array.isArray(p.images) ? p.images.map(okImg).filter(Boolean) : []; if (!a.length) { const s0 = okImg(p.image); if (s0) a = [s0]; } return a; };
const vOf = p => {
  const u = String((p && p.video) || '').trim(); if (!u) return null;
  let m = /(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/.exec(u);
  if (m) return { e: 'https://www.youtube-nocookie.com/embed/' + m[1] + '?rel=0' };
  m = /vimeo\.com\/(?:video\/)?(\d+)/.exec(u); if (m) return { e: 'https://player.vimeo.com/video/' + m[1] };
  return /^(https?:\/\/|videos\/)/i.test(u) ? { f: u } : null;
};
const relU = u => /^(https?:|data:)/i.test(u) ? u : '../../' + String(u).replace(/^\.?\//, '');
const shortT = t => String(t || '').split('|')[0].trim();

fs.mkdirSync(path.join(root, 'work'), { recursive: true });
const keep = new Set(Object.values(slugs));
for (const dn of fs.readdirSync(path.join(root, 'work'))) if (!keep.has(dn)) fs.rmSync(path.join(root, 'work', dn), { recursive: true, force: true });
wr('data/slugs.js', '/* بيتولّد أوتوماتيك من tools/seo.mjs: رابط صفحة كل عمل */\nwindow.SLUGS=' + JSON.stringify(slugs) + ';\n');

const pjName = D.hero?.name || '';
const pjModeMeta = ['light', 'auto'].includes(D.theme?.mode) ? D.theme.mode : 'dark';
const themeScript = "<script>try{var d=document.documentElement,x=document.querySelector('meta[name=sx-mode]'),m=localStorage.getItem('sx.mode');if(m!=='light'&&m!=='dark')m=x?x.content:'dark';if(m==='auto')m=matchMedia('(prefers-color-scheme: light)').matches?'light':'dark';if(m==='light'||m==='dark'){d.dataset.mode=m;var t=document.querySelector('meta[name=theme-color]');if(t&&m==='light')t.content='#FAF7F0'}}catch(e){}</script>";
visible.forEach(p => {
  const sg = slugs[String(p.id)]; if (!sg) return;
  const cat = (D.categories || []).find(c => c.id === p.category) || { name: '', type: 'image' };
  const app = p.layout === 'app' || cat.layout === 'app';
  const pics = imgsOf(p);
  const vd = vOf(p) || (cat.type === 'video' ? vOf({ video: p.link }) : null);
  const tools = (Array.isArray(p.tools) ? p.tools : []).filter(Boolean);
  const feats = (Array.isArray(p.features) ? p.features : []).filter(Boolean);
  const st = shortT(p.title);
  let desc = String(p.desc || '').trim() || (st + ' — من أعمال ' + pjName + (cat.name ? ' في مجال ' + cat.name : '') + '.');
  if (desc.length > 200) desc = desc.slice(0, 197).replace(/\s+\S*$/, '') + '...';
  const pageUrl = site ? site + 'work/' + sg + '/' : '';
  const title = (p.title || '') + (pjName ? ' | ' + pjName : '');
  const ogI = pics[0] ? abs(pics[0]) : ogImg;
  const origin = safeUrl(p.link);
  const lks = (Array.isArray(p.links) ? p.links : []).filter(x => x && x.url && safeUrl(x.url) !== '#').slice(0, 3).map(x => ({ label: x.label || 'افتح الرابط', url: x.url }));
  const ext = lks.length ? lks : origin !== '#' ? [{ label: /behance\.net/i.test(origin) ? 'شوف العمل على Behance' : cat.type === 'video' ? 'شاهد العمل' : 'افتح العمل الأصلي', url: origin }] : [];
  const waMsg = (D.contact?.form?.greeting || 'أهلاً') + '، شفت عملك "' + st + '" وعايز أطلب شغل زيه.';

  const ld1 = {
    '@context': 'https://schema.org', '@type': 'CreativeWork', name: p.title, description: desc, inLanguage: 'ar',
    ...(pageUrl && { url: pageUrl }), ...(ogI && { image: ogI }), ...(cat.name && { genre: cat.name }), ...(/^\d{4}$/.test(String(p.year || '').trim()) && { dateCreated: String(p.year).trim() }),
    ...(tools.length && { keywords: tools.join(', ') }),
    author: site ? { '@id': site + '#person' } : { '@type': 'Person', name: pjName },
    ...(site && { isPartOf: { '@type': 'CollectionPage', name: 'أعمالي', url: site + 'works.html' } })
  };
  const ld2 = site ? {
    '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
      { '@type': 'ListItem', position: 1, name: pjName, item: site },
      { '@type': 'ListItem', position: 2, name: 'أعمالي', item: site + 'works.html' },
      { '@type': 'ListItem', position: 3, name: st, item: pageUrl }]
  } : null;
  const head = [
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">',
    '<meta name="theme-color" content="#0B0A08">',
    '<title>' + E(title) + '</title>',
    '<meta name="description" content="' + E(desc) + '">',
    '<meta name="robots" content="index,follow,max-image-preview:large">',
    pageUrl && '<link rel="canonical" href="' + E(pageUrl) + '">',
    '<meta name="sx-mode" content="' + E(pjModeMeta) + '">',
    '<meta property="og:type" content="website">',
    '<meta property="og:title" content="' + E(title) + '">',
    '<meta property="og:description" content="' + E(desc) + '">',
    '<meta property="og:locale" content="ar_AR">',
    '<meta property="og:site_name" content="' + E(pjName) + '">',
    pageUrl && '<meta property="og:url" content="' + E(pageUrl) + '">',
    ogI && '<meta property="og:image" content="' + E(ogI) + '">',
    ogI && '<meta property="og:image:alt" content="' + E(st) + '">',
    '<meta name="twitter:card" content="' + (ogI ? 'summary_large_image' : 'summary') + '">',
    '<meta name="twitter:title" content="' + E(title) + '">',
    '<meta name="twitter:description" content="' + E(desc) + '">',
    ogI && '<meta name="twitter:image" content="' + E(ogI) + '">',
    '<link rel="manifest" href="../../manifest.webmanifest">',
    '<link rel="icon" type="image/png" sizes="48x48" href="../../images/icons/favicon-48.png">',
    '<link rel="icon" type="image/png" sizes="192x192" href="../../images/icons/icon-192.png">',
    '<link rel="apple-touch-icon" href="../../images/icons/apple-touch-icon.png">',
    '<link rel="preload" href="../../fonts/kufi_bold.woff" as="font" type="font/woff" crossorigin>',
    '<link rel="preload" href="../../fonts/plexarabic_regular.woff" as="font" type="font/woff" crossorigin>',
    '<link rel="stylesheet" href="' + withV('../../assets/site.css', vSite) + '">',
    '<link rel="stylesheet" href="' + withV('../../assets/project.css', fileHash('assets/project.css')) + '">',
    '<link rel="stylesheet" href="' + withV('../../assets/reviews.css', fileHash('assets/reviews.css')) + '">',
    themeScript, ld(ld1), ld2 && ld(ld2)
  ].filter(Boolean).join('\n');

  const media = vd
    ? '<div class="pj-vid">' + (vd.e ? '<iframe src="' + E(vd.e) + '" title="' + E(st) + '" loading="lazy" allowfullscreen allow="autoplay; encrypted-media; picture-in-picture; fullscreen"></iframe>'
      : '<video controls preload="none" playsinline' + (pics[0] ? ' poster="' + E(relU(pics[0])) + '"' : '') + '><source src="' + E(relU(vd.f)) + '"></video>') + '</div>' : '';
  const zoomA = (u, i, big) => '<a href="' + E(relU(u)) + '" data-zoom><img src="' + E(relU(u)) + '" alt="' + E(st + (pics.length > 1 ? ' — ' + (i + 1) : '')) + '"' + (big ? ' fetchpriority="high"' : ' loading="lazy"') + ' decoding="async"></a>';
  const gallery = !pics.length ? '' : app
    ? '<div class="pj-g app">' + pics.map((u, i) => zoomA(u, i, i === 0 && !vd)).join('') + '</div>'
    : (vd ? '' : '<figure class="pj-fig">' + zoomA(pics[0], 0, true) + '</figure>') +
      (pics.length - (vd ? 0 : 1) > 0 ? '<div class="pj-g">' + pics.slice(vd ? 0 : 1).map((u, i) => zoomA(u, i + (vd ? 0 : 1), false)).join('') + '</div>' : '');

  const others = visible.filter(x => x !== p && slugs[String(x.id)]);
  const rel = [...others.filter(x => x.category === p.category), ...others.filter(x => x.category !== p.category)].slice(0, 3);
  const relHtml = rel.length ? '<section class="pj-rel" aria-labelledby="rel"><h2 id="rel">أعمال تانية</h2><div class="pj-rg">' + rel.map(x => {
    const im = imgsOf(x)[0];
    return '<a class="pj-rc" href="../' + E(slugs[String(x.id)]) + '/"><span>' + (im ? '<img src="' + E(relU(im)) + '" alt="' + E(shortT(x.title)) + '" loading="lazy" decoding="async">' : '') + '</span><strong>' + E(shortT(x.title)) + '</strong></a>';
  }).join('') + '</div></section>' : '';

  const cta = '<div class="pj-cta">' +
    ext.map((x, i) => '<a class="btn ' + (i ? 'ghost' : 'primary') + '" href="' + E(safeUrl(x.url)) + '" target="_blank" rel="noopener noreferrer">' + E(x.label) + ' ' + pjIc('ext') + '</a>').join('') +
    (waDigits ? '<a class="btn ' + (ext.length ? 'ghost' : 'primary') + '" href="https://wa.me/' + E(waDigits) + '?text=' + encodeURIComponent(waMsg) + '" target="_blank" rel="noopener noreferrer">اطلب شغل زي ده ' + pjIc('arrowL') + '</a>' : '') +
    '<a class="btn ghost" href="../../works.html">كل الأعمال ' + pjIc('arrowL') + '</a></div>';

  /* آراء العملاء (ثابتة في الـHTML عشان جوجل والزوار من غير JavaScript؛ النموذج بيتضاف من assets/reviews.js) */
  const rvStar = '<svg viewBox="0 0 24 24" aria-hidden="true"><polygon points="12 2 15.1 8.3 22 9.3 17 14.1 18.2 21 12 17.8 5.8 21 7 14.1 2 9.3 8.9 8.3"/></svg>';
  const rvStars = n => { n = Math.max(0, Math.min(5, parseInt(n, 10) || 0)); return n ? '<span class="rv-st" role="img" aria-label="' + n + ' من 5">' + [1, 2, 3, 4, 5].map(i => '<i' + (i <= n ? ' class="on"' : '') + '>' + rvStar + '</i>').join('') + '</span>' : ''; };
  const rvList = (Array.isArray(p.reviews) ? p.reviews : []).filter(r => r && (okImg(r.img) || String(r.text || '').trim()));
  const rvCard = r => {
    const nm = String(r.name || '').trim() || 'عميل', tx = String(r.text || '').trim(), im = okImg(r.img);
    const meta = '<div class="rv-m"><b dir="auto">' + E(nm) + '</b>' + rvStars(r.rating) + '</div>';
    return im
      ? '<figure class="rvc shot"><a class="rvc-i" href="' + E(relU(im)) + '" data-rvz aria-label="تكبير صورة الرأي"><img loading="lazy" decoding="async" src="' + E(relU(im)) + '" alt="رأي ' + E(nm) + '"></a><figcaption>' + meta + (tx ? '<p dir="auto">' + E(tx) + '</p>' : '') + '</figcaption></figure>'
      : '<figure class="rvc"><blockquote><p dir="auto">' + E(tx) + '</p></blockquote><figcaption>' + meta + '</figcaption></figure>';
  };
  const reviewsHtml = '<section class="rvs" data-rv-static="' + E(String(p.id)) + '" aria-label="آراء العملاء"><div class="rvs-h"><h2>آراء العملاء</h2>' + (rvList.length ? '<span class="rvs-n">' + rvList.length + '</span>' : '') + '</div>' +
    (rvList.length ? '<div class="rvs-l">' + rvList.map(rvCard).join('') + '</div>' : '<p class="rvs-0">لسه مفيش آراء على العمل ده. كن أول من يشاركنا رأيه.</p>') + '</section>';

  const body = [
    '<a class="skip" href="#main">تخطي للمحتوى</a>',
    '<header class="nav stuck" id="nav"><div class="wrap nav-in"><a class="brand" href="../../" aria-label="الرئيسية"><b>' + E((pjName || 'ع').trim().charAt(0)) + '</b><span>' + E(pjName) + '</span></a>' +
      '<nav class="pj-links" aria-label="القائمة"><a href="../../works.html">أعمالي</a><a href="../../#contact">تواصل</a></nav>' +
      '<button type="button" class="ib" data-act="mode" aria-label="تبديل الوضع الليلي/النهاري">' + pjIc('sun') + '</button></div></header>',
    '<main id="main" class="pj"><div class="wrap">',
    '<nav class="crumbs" aria-label="مسار الصفحة"><a href="../../">الرئيسية</a><span aria-hidden="true">›</span><a href="../../works.html">أعمالي</a><span aria-hidden="true">›</span><span aria-current="page">' + E(st) + '</span></nav>',
    '<article>',
    '<header class="pj-h">' + (p.tag ? '<span class="tg">' + E(p.tag) + '</span>' : '') + '<h1>' + E(p.title) + '</h1>' +
      (p.status ? '<span class="pj-st">' + E(p.status) + '</span>' : '') +
      (String(p.desc || '').trim() ? '<p class="pj-lead">' + E(String(p.desc).trim()) + '</p>' : '') +
      ((cat.name || tools.length || p.client || p.year) ? '<ul class="pj-meta" aria-label="تفاصيل العمل">' + (cat.name ? '<li class="c">' + E(cat.name) + '</li>' : '') + (String(p.client || '').trim() ? '<li>' + E(String(p.client).trim()) + '</li>' : '') + (/^\d{4}$/.test(String(p.year || '').trim()) ? '<li>' + E(String(p.year).trim()) + '</li>' : '') + tools.map(t => '<li>' + E(t) + '</li>').join('') + '</ul>' : '') + '</header>',
    media, gallery,
    feats.length ? '<section aria-labelledby="ft"><h2 id="ft">المميزات</h2><ul class="pj-ft">' + feats.map(f => '<li>' + pjIc('check') + '<span dir="auto">' + E(f) + '</span></li>').join('') + '</ul></section>' : '',
    cta, '</article>', reviewsHtml, relHtml, '</div></main>',
    '<footer class="f"><div class="wrap"><span>' + E(D.footer || '') + '</span><a class="up" href="../../works.html">كل الأعمال ' + pjIc('arrowL') + '</a></div></footer>',
    '<script>window.RV_BASE="../../"</script>',
    '<script src="' + withV('../../assets/reviews.js', fileHash('assets/reviews.js')) + '"></script>',
    '<script src="' + withV('../../assets/project.js', fileHash('assets/project.js')) + '"></script>'
  ].filter(Boolean).join('\n');

  fs.mkdirSync(path.join(root, 'work', sg), { recursive: true });
  wr('work/' + sg + '/index.html', '<!DOCTYPE html>\n<html lang="ar" dir="rtl" data-mode="dark">\n<head>\n' + head + '\n</head>\n<body>\n' + body + '\n</body>\n</html>\n');
});

/* ---------- 3) sitemap + robots ---------- */
if (site) {
  const day = new Date().toISOString().slice(0, 10);
  wr('sitemap.xml', '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    [['', '1.0'], ['works.html', '0.8'], ...Object.values(slugs).map(sg => ['work/' + sg + '/', '0.7'])].map(([p, pr]) => '  <url><loc>' + E(site + p) + '</loc><lastmod>' + day + '</lastmod><priority>' + pr + '</priority></url>').join('\n') +
    '\n</urlset>\n');
  wr('robots.txt', 'User-agent: *\nAllow: /\nDisallow: /admin/\nDisallow: /make-password.html\n\nSitemap: ' + site + 'sitemap.xml\n');
} else {
  console.warn('تنبيه: SITE_URL فاضي. اتولّد المحتوى الثابت والـJSON-LD، لكن canonical وog:image وsitemap.xml وrobots.txt محتاجين الرابط النهائي.');
}
console.log('تم. المشاريع الظاهرة:', visible.length, '| صفحات الأعمال:', Object.keys(slugs).length, '| الرابط:', site || '(غير محدد)');
