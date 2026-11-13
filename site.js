/* site.js - shared by index.html and every sub-page.
   ONE place to edit navigation: the SECTIONS array. */
const SECTIONS = [
  { key: 'Army',             label: 'Army',          href: '/pages/army.html' },
  { key: 'Navy',             label: 'Navy',          href: '/pages/navy.html' },
  { key: 'Air Force',        label: 'Air Force',     href: '/pages/air-force.html' },
  { key: 'Special Forces',   label: 'Special Forces',href: '/pages/special-forces.html' },
  { key: 'Modernization',    label: 'Modernization', href: '/pages/modernization.html' },
  { key: 'Recruitment',      label: 'Join',          href: '/pages/recruitment.html' },
  { key: 'Gallantry Awards', label: 'Awards',        href: '/pages/awards.html' },
];

// Tiny DOM helper: builds elements with textContent only (no innerHTML => no XSS).
function el(tag, attrs = {}, ...kids) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') n.className = v; else if (k === 'text') n.textContent = v; else n.setAttribute(k, v);
  }
  kids.flat().forEach(k => n.append(k));
  return n;
}

async function api(path, opts) {
  const r = await fetch(path, opts);
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || 'Request failed');
  return data;
}

/* ---- Sub-pages get header/nav/footer injected (index.html already has its own) ---- */
function buildHeader() {
  const nav = el('nav', { class: 'mainnav' },
    el('div', { class: 'container navrow' },
      el('a', { class: 'brand', href: '/' },
        el('div', {}, el('span', { class: 'name' }, 'BHARAT ', el('b', { text: 'RAKSHA' })),
                      el('span', { class: 'tag', text: 'DEFENCE ENCYCLOPEDIA' }))),
      el('div', { class: 'navlinks', id: 'navLinks' },
        el('a', { href: '/#services', text: 'Services' }),
        el('a', { href: '/entries.html', text: 'Entries' }),
        el('a', { href: '/#recruitment', text: 'Eligibility Check' }),
        el('a', { href: '/#faq', text: 'FAQ' })),
      el('div', { class: 'navtools' },
        el('button', { class: 'iconbtn', id: 'themeBtn', 'aria-label': 'Toggle theme', text: '☾' }),
        el('button', { class: 'iconbtn hamburger', id: 'burger', 'aria-label': 'Menu', text: '☰' }))));
  return nav;
}
function buildFooter() {
  return el('footer', {}, el('div', { class: 'container footbottom' },
    el('span', { text: '© 2026 BHARAT RAKSHA — EDUCATIONAL PROJECT · NOT AFFILIATED WITH THE MINISTRY OF DEFENCE' }),
    el('span', { class: 'visits' }, 'TOTAL VISITS', el('b', { id: 'visitCount', text: '—' }))));
}

/* ---- Jump bar: category buttons with live counts ---- */
async function buildJumpBar(host) {
  const here = location.pathname;
  const list = el('div', { class: 'jumplist' });
  const btns = {};
  SECTIONS.forEach(s => {
    const a = el('a', { class: 'jumpbtn', href: s.href }, s.label, el('span', { class: 'ct' }));
    if (here === s.href) a.setAttribute('aria-current', 'page');
    btns[s.key] = a; list.append(a);
  });
  list.append(el('a', { class: 'jumpbtn all', href: '/entries.html', text: 'All entries' }));
  host.className = 'jumpbar';
  host.replaceChildren(el('div', { class: 'container' }, el('span', { class: 'jumplabel', text: 'JUMP TO' }), list));
  try {  // counts are a bonus; the buttons work without them
    (await api('/api/categories')).forEach(c => {
      if (btns[c.category]) btns[c.category].querySelector('.ct').textContent = c.count;
    });
  } catch (_) {}
}

function setupBackToTop() {
  const b = el('button', { class: 'totop', 'aria-label': 'Back to top', text: '↑' });
  b.onclick = () => window.scrollTo({ top: 0, behavior: 'smooth' });
  document.body.append(b);
  addEventListener('scroll', () => b.classList.toggle('show', scrollY > 600), { passive: true });
}

/* ---- Visit counter: server counts once per session cookie ---- */
async function trackVisit() {
  const box = document.getElementById('visitCount');
  try {
    const d = await api('/api/visit', { method: 'POST' });
    if (box) box.textContent = d.total.toLocaleString('en-IN');
  } catch (_) { if (box) box.textContent = '—'; }
}

document.addEventListener('DOMContentLoaded', () => {
  if (document.body.hasAttribute('data-subpage')) {
    document.body.prepend(buildHeader());
    document.body.append(buildFooter());
    const t = document.getElementById('themeBtn');
    t.onclick = () => { const h = document.documentElement, n = h.dataset.theme === 'dark' ? 'light' : 'dark';
      h.dataset.theme = n; t.textContent = n === 'dark' ? '☾' : '☀'; };
    document.getElementById('burger').onclick = () => document.getElementById('navLinks').classList.toggle('open');
  }
  const bar = document.getElementById('jumpBar');
  if (bar) buildJumpBar(bar);
  setupBackToTop();
  trackVisit();
});
