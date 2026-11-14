(function () {
  var d = document, r = d.documentElement;
  var SUN = '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4"/></svg>';
  var MOON = '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M21 12.8A9 9 0 1111.2 3 7 7 0 0021 12.8z"/></svg>';
  function paint() { var b = d.querySelector('[data-act=mode]'); if (b) b.innerHTML = r.dataset.mode === 'light' ? MOON : SUN; }
  paint();
  var back = null;
  function closeLb() { var o = d.querySelector('.lbx'); if (o) o.remove(); d.body.style.overflow = ''; if (back && back.focus) back.focus(); back = null; }
  function openLb(src, alt) {
    back = d.activeElement;
    var o = d.createElement('div'); o.className = 'lbx'; o.setAttribute('role', 'dialog'); o.setAttribute('aria-modal', 'true'); o.setAttribute('aria-label', alt || 'صورة');
    var im = d.createElement('img'); im.src = src; im.alt = alt || '';
    var x = d.createElement('button'); x.type = 'button'; x.setAttribute('aria-label', 'إغلاق'); x.textContent = '×';
    o.appendChild(im); o.appendChild(x); d.body.appendChild(o); d.body.style.overflow = 'hidden'; x.focus();
  }
  d.addEventListener('click', function (e) {
    var t = e.target.closest('[data-act=mode]');
    if (t) {
      var m = r.dataset.mode === 'light' ? 'dark' : 'light'; r.dataset.mode = m;
      try { localStorage.setItem('sx.mode', m); } catch (_) {}
      var tc = d.querySelector('meta[name=theme-color]'); if (tc) tc.content = m === 'light' ? '#FAF7F0' : '#0B0A08';
      paint(); return;
    }
    if (e.target.closest('.lbx')) { closeLb(); return; }
    var z = e.target.closest('a[data-zoom]');
    if (z && !(e.metaKey || e.ctrlKey || e.shiftKey)) { e.preventDefault(); var im = z.querySelector('img'); openLb(z.href, im && im.alt); }
  });
  d.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeLb(); });
})();
