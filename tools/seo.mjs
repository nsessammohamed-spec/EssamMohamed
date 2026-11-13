// سكربت السيو: بيقرأ data/site.js وبيولّد
//  1) محتوى HTML ثابت جوه index.html (بيشوفه جوجل وواتساب وفيسبوك قبل ما الـJS يشتغل)
//  2) وسوم og / twitter / canonical / JSON-LD في <head>
//  3) sitemap.xml و robots.txt
// التشغيل (من فولدر الموقع):  node tools/seo.mjs
// رابط الموقع النهائي بيتحط في tools/seo.config.json (SITE_URL) أو: SITE_URL=https://example.com/ node tools/seo.mjs
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
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

const E = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const abs = u => !u ? '' : /^https?:/i.test(u) ? u : site ? site + u.replace(/^\.?\//, '') : '';
const safeUrl = u => /^(https?:\/\/|mailto:|tel:|#)/i.test(u || '') ? u : '#';

const title = D.meta?.title || D.hero?.name;
const desc = D.meta?.description || D.hero?.sub || '';
const ogImg = abs(cfg.OG_IMAGE || D.hero?.photo);
const visible = (D.projects || []).filter(p => p.visible !== false);
const workLi = p => {
  const u = safeUrl(p.link);
  const t = u === '#' ? E(p.title) : '<a href="' + E(u) + '" rel="noopener">' + E(p.title) + '</a>';
  return '<li>' + t + ' (' + E(catName(p.category)) + ')' + (p.desc ? ': ' + E(p.desc) : '') + '</li>';
};
const catName = id => (D.categories || []).find(c => c.id === id)?.name || '';

/* ---------- 1) <head> ---------- */
const sameAs = (D.contact?.socials || []).map(s => s.url).filter(u => /^https:/.test(u));
const person = {
  '@context': 'https://schema.org', '@type': 'Person',
  name: D.hero?.name, description: desc, jobTitle: cfg.JOB_TITLE,
  ...(site && { url: site }), ...(abs(D.hero?.photo) && { image: abs(D.hero.photo) }),
  ...(D.contact?.email && { email: D.contact.email }),
  ...(cfg.CITY && { address: { '@type': 'PostalAddress', addressLocality: cfg.CITY, addressCountry: cfg.COUNTRY } }),
  knowsAbout: D.skills, sameAs
};
const faq = (D.faq || []).length ? {
  '@context': 'https://schema.org', '@type': 'FAQPage',
  mainEntity: D.faq.map(f => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } }))
} : null;
const ld = o => '<script type="application/ld+json">' + JSON.stringify(o).replace(/</g, '\\u003c') + '</script>';

const head = [
  '<meta name="sx-mode" content="' + E(['light', 'auto'].includes(D.theme?.mode) ? D.theme.mode : 'dark') + '">',
  '<meta name="robots" content="index,follow,max-image-preview:large">',
  '<meta name="author" content="' + E(D.hero?.name) + '">',
  '<meta property="og:locale" content="ar_AR">',
  '<meta property="og:site_name" content="' + E(D.hero?.name) + '">',
  site && '<link rel="canonical" href="' + E(site) + '">',
  site && '<meta property="og:url" content="' + E(site) + '">',
  ogImg && '<meta property="og:image" content="' + E(ogImg) + '">',
  ogImg && '<meta property="og:image:alt" content="' + E(D.hero?.name) + '">',
  '<meta name="twitter:card" content="' + (ogImg ? 'summary_large_image' : 'summary') + '">',
  '<meta name="twitter:title" content="' + E(title) + '">',
  '<meta name="twitter:description" content="' + E(desc) + '">',
  ogImg && '<meta name="twitter:image" content="' + E(ogImg) + '">',
  ld(person), faq && ld(faq)
].filter(Boolean).join('\n');

/* ---------- 2) المحتوى الثابت ---------- */
const body = [
  '<main class="seo-static" style="max-width:760px;margin:0 auto;padding:48px 20px;line-height:1.9">',
  '<header><p>' + E(D.hero?.eyebrow) + '</p><h1>' + E(D.hero?.name) + '</h1><p>' + E(D.hero?.sub) + '</p></header>',
  D.about?.text && '<section><h2>' + E(D.about.title || 'نبذة عني') + '</h2><p>' + E(D.about.text) + '</p></section>',
  (D.skills || []).length && '<section><h2>الأدوات والمهارات</h2><ul>' + D.skills.map(s => '<li>' + E(s) + '</li>').join('') + '</ul></section>',
  (D.categories || []).length && '<section><h2>المجالات</h2><ul>' + D.categories.map(c => '<li><strong>' + E(c.name) + '</strong>: ' + E(c.desc) + '</li>').join('') + '</ul></section>',
  visible.length && '<section><h2>أعمالي</h2><ul>' + visible.map(workLi).join('') + '</ul><p><a href="works.html">كل الأعمال</a></p></section>',
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
  const wTitle = 'أعمالي | ' + (D.hero?.name || '');
  const wDesc = 'معرض أعمال ' + (D.hero?.name || '') + ': تصميم جرافيك، برمجة، فيديوهات السبورة البيضاء ومونتاج.';
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

/* ---------- 3) sitemap + robots ---------- */
if (site) {
  const day = new Date().toISOString().slice(0, 10);
  wr('sitemap.xml', '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    [['', '1.0'], ['works.html', '0.8']].map(([p, pr]) => '  <url><loc>' + E(site + p) + '</loc><lastmod>' + day + '</lastmod><priority>' + pr + '</priority></url>').join('\n') +
    '\n</urlset>\n');
  wr('robots.txt', 'User-agent: *\nAllow: /\nDisallow: /admin/\nDisallow: /make-password.html\n\nSitemap: ' + site + 'sitemap.xml\n');
} else {
  console.warn('تنبيه: SITE_URL فاضي. اتولّد المحتوى الثابت والـJSON-LD، لكن canonical وog:image وsitemap.xml وrobots.txt محتاجين الرابط النهائي.');
}
console.log('تم. المشاريع الظاهرة:', visible.length, '| الرابط:', site || '(غير محدد)');
