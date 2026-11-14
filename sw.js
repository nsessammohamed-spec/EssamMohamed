/* Service Worker بسيط: الموقع يفتح أسرع في الزيارات الجاية وبيفضل شغال لو النت ضعف.
   - الصفحات والكود والبيانات: الشبكة الأول (عشان تعديلات لوحة التحكم تظهر فورًا)، والنسخة المخزنة احتياطي.
   - الخطوط والصور: من الكاش مباشرة وبتتحدّث في الخلفية.
   - لوحة التحكم /admin/ مستثناة تمامًا ومش بتتخزن أبدًا. */
const CACHE = 'site-v1';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(
  caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())
));

const isStatic = u => /\/(fonts|images)\//.test(u.pathname);

self.addEventListener('fetch', e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin || url.pathname.includes('/admin/')) return;

  if (isStatic(url)) {
    e.respondWith(caches.open(CACHE).then(async c => {
      const hit = await c.match(req);
      const net = fetch(req).then(r => { if (r.ok) c.put(req, r.clone()); return r; }).catch(() => hit);
      return hit || net;
    }));
    return;
  }

  const key = new Request(url.origin + url.pathname); // من غير ?t= و ?v= عشان الكاش ما يتكدّسش
  e.respondWith(fetch(req).then(r => {
    if (r.ok) { const copy = r.clone(); caches.open(CACHE).then(c => c.put(key, copy)); }
    return r;
  }).catch(async () => (await caches.match(key)) || (req.mode === 'navigate' ? await caches.match('./') : Response.error())));
});
