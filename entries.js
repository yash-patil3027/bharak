/* All-entries list: live search + category filter, state kept in the URL. */
(async () => {
  const qBox = document.getElementById('q'), pills = document.getElementById('pills'),
        list = document.getElementById('list'), count = document.getElementById('count');
  const params = new URLSearchParams(location.search);
  let category = params.get('category') || '';
  qBox.value = params.get('q') || '';

  function highlight(text, q) {           // safe highlight: split + <mark>, never innerHTML
    const frag = document.createDocumentFragment();
    if (!q) { frag.append(text); return frag; }
    const i = text.toLowerCase().indexOf(q.toLowerCase());
    if (i < 0) { frag.append(text); return frag; }
    frag.append(text.slice(0, i), el('mark', { text: text.slice(i, i + q.length) }), text.slice(i + q.length));
    return frag;
  }
  async function load() {
    const q = qBox.value.trim();
    const u = new URLSearchParams(); if (q) u.set('q', q); if (category) u.set('category', category);
    history.replaceState(null, '', u.toString() ? '?' + u : location.pathname);
    pills.querySelectorAll('.pill').forEach(p => p.classList.toggle('on', p.dataset.c === category));
    try {
      const rows = await api('/api/entries?' + u);
      count.textContent = rows.length + (rows.length === 1 ? ' entry' : ' entries');
      list.replaceChildren(el('div', { class: 'entryrow head' }, el('span', { text: 'Title' }), el('span', { text: 'Category' }), el('span', { text: 'Summary' })));
      if (!rows.length) list.append(el('p', { class: 'status', text: 'No entries match. Try a shorter search or clear the filter.' }));
      rows.forEach(r => {
        const a = el('a', { class: 't', href: '/entry.html?slug=' + encodeURIComponent(r.slug) }); a.append(highlight(r.title, q));
        list.append(el('div', { class: 'entryrow' }, a, el('span', { class: 'c', text: r.category }), el('span', { class: 's', text: r.summary })));
      });
    } catch (e) { count.textContent = ''; list.replaceChildren(el('p', { class: 'status err', text: e.message })); }
  }
  const cats = await api('/api/categories').catch(() => []);
  const mk = (label, c) => { const b = el('button', { class: 'pill', 'data-c': c, text: label }); b.onclick = () => { category = c; load(); }; return b; };
  pills.append(mk('All', ''), ...cats.map(c => mk(`${c.category} (${c.count})`, c.category)));
  let t; qBox.addEventListener('input', () => { clearTimeout(t); t = setTimeout(load, 200); });   // debounce
  load();
})();
