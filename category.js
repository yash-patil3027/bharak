/* Renders one category page. <body data-category="Army"> decides what to load. */
(async () => {
  const cat = document.body.dataset.category, host = document.getElementById('groups');
  try {
    const rows = await api('/api/entries?category=' + encodeURIComponent(cat));
    if (!rows.length) { host.append(el('p', { class: 'status', text: 'No entries yet.' })); return; }
    const groups = {};
    rows.forEach(r => (groups[r.subcategory || 'Overview'] ||= []).push(r));
    for (const [name, items] of Object.entries(groups)) {
      host.append(el('div', { class: 'group' },
        el('h2', { text: name }),
        el('div', { class: 'cardgrid' }, items.map(i => el('div', { class: 'card' },
          el('h4', { text: i.title }), el('p', { text: i.summary }),
          el('a', { class: 'more', href: '/entry.html?slug=' + encodeURIComponent(i.slug), text: 'Read entry' }))))));
    }
  } catch (e) { host.append(el('p', { class: 'status err', text: 'Could not load entries: ' + e.message })); }
})();
