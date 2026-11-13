/**
 * server.js - Bharat Raksha
 * Serves /public as static files and exposes a small JSON API backed by SQLite.
 *
 *   GET  /api/categories            -> [{category, count}]
 *   GET  /api/entries?category=&q=  -> entry list (search + filter)
 *   GET  /api/entries/:slug         -> one entry (+ related)
 *   GET  /api/schemes               -> eligibility criteria (read-only)
 *   POST /api/eligibility           -> validate input, match schemes, store submission + results
 *   POST /api/visit                 -> count a visit once per browser session
 *   GET  /api/visits                -> current total
 */
const path = require('path');
const crypto = require('crypto');
const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');
const { open } = require('./db/database');

const PORT = process.env.PORT || 3000;
const IS_PROD = process.env.NODE_ENV === 'production';
const db = open();

const app = express();
if (process.env.TRUST_PROXY) app.set('trust proxy', 1);   // set when behind nginx / Render / Heroku
app.disable('x-powered-by');

// ---------- Security headers ----------
// The existing index.html uses inline <script>, inline onclick="" handlers, Google Fonts
// and Wikimedia images, so the CSP has to allow those. Tighten it later by moving
// inline JS into files and removing 'unsafe-inline'.
app.use(helmet({
  contentSecurityPolicy: {
    useDefaults: true,
    directives: {
      'default-src':     ["'self'"],
      'script-src':      ["'self'", "'unsafe-inline'"],
      'script-src-attr': ["'unsafe-inline'"],
      'style-src':       ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      'font-src':        ["'self'", 'https://fonts.gstatic.com'],
      'img-src':         ["'self'", 'data:', 'https://commons.wikimedia.org', 'https://upload.wikimedia.org'],
      'connect-src':     ["'self'"],
      'object-src':      ["'none'"],
      'frame-ancestors': ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false,
}));

app.use(express.json({ limit: '2kb' }));   // our only JSON body is tiny; reject anything bigger
app.use(cookieParser());

// ---------- Rate limits ----------
const apiLimiter   = rateLimit({ windowMs: 60_000, limit: 120, standardHeaders: true, legacyHeaders: false });
const writeLimiter = rateLimit({ windowMs: 60_000, limit: 20,  standardHeaders: true, legacyHeaders: false,
                                 message: { error: 'Too many requests, slow down.' } });
app.use('/api', apiLimiter);

// =====================================================================
// 3) ENTRIES (list + search + filter + detail)
// =====================================================================
const countByCategory = db.prepare(
  'SELECT category, COUNT(*) AS count FROM entries GROUP BY category ORDER BY category');

app.get('/api/categories', (_req, res) => res.json(countByCategory.all()));

// Escape LIKE wildcards so a user typing "%" or "_" searches for the literal character.
const likeEscape = s => s.replace(/[\\%_]/g, '\\$&');

app.get('/api/entries', (req, res) => {
  const category = typeof req.query.category === 'string' ? req.query.category.trim().slice(0, 40) : '';
  const q        = typeof req.query.q        === 'string' ? req.query.q.trim().slice(0, 80)        : '';
  const limit    = Math.min(Math.max(parseInt(req.query.limit, 10) || 200, 1), 500);

  // Build the WHERE clause from fixed fragments only; user values are always bound parameters (?).
  const where = [], params = [];
  if (category) { where.push('category = ? COLLATE NOCASE'); params.push(category); }
  if (q) {
    const like = `%${likeEscape(q)}%`;
    where.push("(title LIKE ? ESCAPE '\\' OR keywords LIKE ? ESCAPE '\\' OR summary LIKE ? ESCAPE '\\')");
    params.push(like, like, like);
  }
  const sql = `SELECT slug, title, category, subcategory, summary
               FROM entries ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
               ORDER BY category, subcategory, title LIMIT ?`;
  res.json(db.prepare(sql).all(...params, limit));
});

const getEntry = db.prepare(
  'SELECT slug, title, category, subcategory, summary, body, anchor, panel FROM entries WHERE slug = ?');
const getRelated = db.prepare(
  `SELECT slug, title FROM entries WHERE category = ? AND subcategory = ? AND slug <> ? ORDER BY title LIMIT 6`);

app.get('/api/entries/:slug', (req, res) => {
  const slug = String(req.params.slug).slice(0, 80);
  const entry = getEntry.get(slug);
  if (!entry) return res.status(404).json({ error: 'Entry not found' });
  entry.related = getRelated.all(entry.category, entry.subcategory, entry.slug);
  res.json(entry);
});

// =====================================================================
// 2) ELIGIBILITY CHECKER (reads criteria, writes submission + results)
// =====================================================================
const EDUCATION = new Set(['10', '12', '12pcm', 'grad', 'law']);
const BRANCH    = new Set(['any', 'army', 'navy', 'airforce']);

app.get('/api/schemes', (_req, res) => {
  res.json(db.prepare('SELECT code, name, min_age AS minAge, max_age AS maxAge FROM schemes WHERE active = 1').all());
});

// Same rules as the old JavaScript, expressed in SQL:
//   age inside window  AND  education allowed  AND  (user picked "any" OR scheme open to that branch / to any)
const matchSchemes = db.prepare(`
  SELECT s.id, s.code, s.name, s.min_age AS minAge, s.max_age AS maxAge
  FROM schemes s
  WHERE s.active = 1
    AND @age BETWEEN s.min_age AND s.max_age
    AND EXISTS (SELECT 1 FROM scheme_education e WHERE e.scheme_id = s.id AND e.education = @education)
    AND (@branch = 'any'
         OR EXISTS (SELECT 1 FROM scheme_branch b WHERE b.scheme_id = s.id AND b.branch IN (@branch, 'any')))
  ORDER BY s.min_age, s.name`);
const insSubmission = db.prepare('INSERT INTO eligibility_submissions (age, education, branch) VALUES (?, ?, ?)');
const insResult     = db.prepare('INSERT INTO eligibility_results (submission_id, scheme_id) VALUES (?, ?)');

const saveSubmission = db.transaction((age, education, branch, matches) => {
  const id = insSubmission.run(age, education, branch).lastInsertRowid;
  for (const m of matches) insResult.run(id, m.id);
  return Number(id);
});

app.post('/api/eligibility', writeLimiter, (req, res) => {
  const { age, education, branch } = req.body || {};

  // --- validation: type, range, and allow-lists ---
  const ageNum = typeof age === 'number' ? age : parseFloat(age);
  if (!Number.isFinite(ageNum) || ageNum < 15 || ageNum > 35)
    return res.status(400).json({ error: 'Please enter a valid age between 15 and 35.' });
  if (!EDUCATION.has(education)) return res.status(400).json({ error: 'Unknown education level.' });
  if (!BRANCH.has(branch))       return res.status(400).json({ error: 'Unknown service preference.' });

  const matches = matchSchemes.all({ age: ageNum, education, branch });
  const submissionId = saveSubmission(ageNum, education, branch, matches);

  res.json({
    submissionId,
    matches: matches.map(({ id, ...rest }) => rest),
    note: 'Simplified estimate, not an official eligibility ruling. Check the current notification.',
  });
});

// =====================================================================
// 4) VISIT COUNTER (once per browser session)
// =====================================================================
const bumpVisits = db.prepare("UPDATE site_stats SET value = value + 1 WHERE key = 'total_visits'");
const readVisits = db.prepare("SELECT value FROM site_stats WHERE key = 'total_visits'");
const BOT_RE = /bot|crawl|spider|slurp|preview|monitor|curl|wget/i;

app.get('/api/visits', (_req, res) => res.json({ total: readVisits.get().value }));

app.post('/api/visit', writeLimiter, (req, res) => {
  // A session cookie (no Max-Age) lives until the browser is closed, so a person who clicks
  // through ten pages is counted once. HttpOnly keeps JavaScript away from it.
  const isBot = BOT_RE.test(req.get('user-agent') || '');
  let counted = false;
  if (!req.cookies.br_sid && !isBot) {
    res.cookie('br_sid', crypto.randomUUID(), { httpOnly: true, sameSite: 'lax', secure: IS_PROD });
    bumpVisits.run();                       // single atomic UPDATE: no read-modify-write race
    counted = true;
  }
  res.json({ total: readVisits.get().value, counted });
});

app.use('/api', (_req, res) => res.status(404).json({ error: 'Not found' }));

// =====================================================================
// Static site
// =====================================================================
// extensions:['html'] lets /entries work as well as /entries.html
app.use(express.static(path.join(__dirname, 'public'), { extensions: ['html'], maxAge: IS_PROD ? '1h' : 0 }));

// Never leak stack traces to clients.
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: 'Server error' });
});

if (require.main === module) {
  app.listen(PORT, () => console.log(`Bharat Raksha running at http://localhost:${PORT}`));
}
module.exports = app;
