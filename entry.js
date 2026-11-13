(async () => {
  const slug = new URLSearchParams(location.search).get('slug'), host = document.getElementById('detail');
  try {
    const e = await api('/api/entries/' + encodeURIComponent(slug || ''));
    document.title = e.title + ' | Bharat Raksha';
    host.replaceChildren(
      el('h1', { text: e.title }),
      el('p', { class: 'meta', text: e.category + (e.subcategory ? ' / ' + e.subcategory : '') }),
      el('p', { text: e.summary }),
      e.body ? el('p', { text: e.body }) : '',
      el('div', { class: 'actions' },
        el('a', { class: 'btn btn-outline', href: '/entries.html?category=' + encodeURIComponent(e.category), text: 'More in ' + e.category }),
        el('a', { class: 'btn btn-outline', href: '/#' + (e.anchor || 'services'), text: 'See on main page' })),
      e.related.length ? el('div', { class: 'related' }, el('h2', { text: 'Related' }),
        e.related.map(r => el('a', { href: '/entry.html?slug=' + encodeURIComponent(r.slug), text: r.title }))) : '');
  } catch (err) { host.replaceChildren(el('h1', { text: 'Entry not found' }), el('p', { class: 'status err', text: err.message }),
      el('a', { class: 'btn btn-primary', href: '/entries.html', text: 'Browse all entries' })); }
})();
