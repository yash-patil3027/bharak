# Bharat Raksha - setup
    npm install
    npm start          # http://localhost:3000  (PORT=8080 npm start to change)
Open the site through the server, not by double-clicking index.html.

## Structure
- public/index.html           existing page, patched: jump bar, "All Entries" link, API-backed eligibility, visit counter
- public/pages/*.html         army, navy, air-force, special-forces, modernization, recruitment, awards
- public/entries.html         searchable/filterable list;  entry.html?slug=...  detail page
- public/js/site.js           SECTIONS array = the one place to edit navigation
- public/css/base.css         copy of index.html styles (for sub-pages);  components.css = new styles
- server.js                   Express API;  db/schema.sql, db/database.js, db/entries.seed.json
- scripts/extract_entries.py  regenerate the seed JSON after adding cards to index.html

## Everyday tasks
- Change a cut-off:  UPDATE schemes SET max_age=25 WHERE code='nda';  (sqlite3 db/bharat-raksha.sqlite)
- Add an entry: edit db/entries.seed.json (optional "body"), restart.
- Deploy: NODE_ENV=production TRUST_PROXY=1, keep db/ on a persistent disk, back it up.
