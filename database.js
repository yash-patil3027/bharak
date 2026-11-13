/**
 * db/database.js
 * Opens the SQLite file, applies schema.sql and (idempotently) seeds data.
 * better-sqlite3 is synchronous, which keeps the route code short and simple.
 */
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'bharat-raksha.sqlite');

// The original hard-coded array from index.html, now data instead of code.
// branches: 'any' means "open to every service" (kept identical to the old behaviour).
const SCHEMES = [
  { code: 'agniveer', name: 'Agniveer (Agnipath)',          min: 17.5, max: 21,   edu: ['10','12','12pcm','grad','law'], branch: ['any','army','navy','airforce'] },
  { code: 'nda',      name: 'NDA',                          min: 16.5, max: 19.5, edu: ['12','12pcm'],                   branch: ['any','army','navy','airforce'] },
  { code: 'tes',      name: 'Technical Entry Scheme (TES)', min: 16.5, max: 19.5, edu: ['12pcm'],                        branch: ['army'] },
  { code: 'cds',      name: 'CDS',                          min: 19,   max: 25,   edu: ['grad','12pcm','law'],           branch: ['any','army','navy','airforce'] },
  { code: 'afcat',    name: 'AFCAT',                        min: 20,   max: 24,   edu: ['grad','12pcm'],                 branch: ['airforce','any'] },
  { code: 'jag',      name: 'JAG Entry',                    min: 21,   max: 27,   edu: ['law'],                          branch: ['army','navy','airforce','any'] },
];

function open({ reset = false } = {}) {
  if (reset && fs.existsSync(DB_PATH)) fs.unlinkSync(DB_PATH);

  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');   // better concurrency for readers + one writer
  db.pragma('foreign_keys = ON');    // SQLite ignores FKs unless you ask

  db.exec(fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8'));
  seed(db);
  return db;
}

function seed(db) {
  // ---- schemes: upsert by code so re-running updates criteria ----
  const upsertScheme = db.prepare(`
    INSERT INTO schemes (code, name, min_age, max_age) VALUES (@code, @name, @min, @max)
    ON CONFLICT(code) DO UPDATE SET name = excluded.name, min_age = excluded.min_age, max_age = excluded.max_age`);
  const getId   = db.prepare('SELECT id FROM schemes WHERE code = ?');
  const delEdu  = db.prepare('DELETE FROM scheme_education WHERE scheme_id = ?');
  const delBr   = db.prepare('DELETE FROM scheme_branch    WHERE scheme_id = ?');
  const addEdu  = db.prepare('INSERT INTO scheme_education (scheme_id, education) VALUES (?, ?)');
  const addBr   = db.prepare('INSERT INTO scheme_branch    (scheme_id, branch)    VALUES (?, ?)');

  // ---- entries: upsert by slug so edits to the JSON show up after a restart ----
  const upsertEntry = db.prepare(`
    INSERT INTO entries (slug, title, category, subcategory, summary, keywords, anchor, panel)
    VALUES (@slug, @title, @category, @subcategory, @summary, @keywords, @anchor, @panel)
    ON CONFLICT(slug) DO UPDATE SET
      title = excluded.title, category = excluded.category, subcategory = excluded.subcategory,
      summary = excluded.summary, keywords = excluded.keywords, anchor = excluded.anchor, panel = excluded.panel`);

  const entries = JSON.parse(fs.readFileSync(path.join(__dirname, 'entries.seed.json'), 'utf8'));

  db.transaction(() => {
    for (const s of SCHEMES) {
      upsertScheme.run(s);
      const id = getId.get(s.code).id;
      delEdu.run(id); delBr.run(id);
      s.edu.forEach(e => addEdu.run(id, e));
      s.branch.forEach(b => addBr.run(id, b));
    }
    for (const e of entries) upsertEntry.run(e);
  })();
}

module.exports = { open, DB_PATH };
