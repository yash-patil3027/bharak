-- =====================================================================
-- Bharat Raksha database schema (SQLite)
-- Idempotent: safe to run on every start (CREATE ... IF NOT EXISTS).
-- =====================================================================

-- ---------- Encyclopedia entries (powers the list page + detail pages) ----------
CREATE TABLE IF NOT EXISTS entries (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  slug        TEXT    NOT NULL UNIQUE,            -- used in URLs: /entry.html?slug=northern-command
  title       TEXT    NOT NULL,
  category    TEXT    NOT NULL,                   -- Army | Navy | Air Force | Special Forces | ...
  subcategory TEXT    NOT NULL DEFAULT '',        -- "Army Commands", "Equipment Library", ...
  summary     TEXT    NOT NULL DEFAULT '',
  body        TEXT,                               -- optional long-form text for the detail page
  keywords    TEXT    NOT NULL DEFAULT '',        -- searched together with title + summary
  anchor      TEXT    NOT NULL DEFAULT '',        -- section id on index.html, e.g. "services"
  panel       TEXT    NOT NULL DEFAULT '',        -- branch tab on index.html: army | navy | airforce
  created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_entries_category ON entries(category);
CREATE INDEX IF NOT EXISTS idx_entries_title    ON entries(title COLLATE NOCASE);

-- ---------- Eligibility checker: CRITERIA ----------
-- One row per entry scheme. The age window lives here instead of in JavaScript,
-- so you can change a cut-off with one UPDATE and no redeploy.
CREATE TABLE IF NOT EXISTS schemes (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  code     TEXT    NOT NULL UNIQUE,               -- stable key: 'nda', 'cds', ...
  name     TEXT    NOT NULL,
  min_age  REAL    NOT NULL CHECK (min_age >= 0),
  max_age  REAL    NOT NULL CHECK (max_age >= min_age),
  active   INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1))
);

-- Allowed education levels per scheme (many-to-many, flattened).
CREATE TABLE IF NOT EXISTS scheme_education (
  scheme_id INTEGER NOT NULL REFERENCES schemes(id) ON DELETE CASCADE,
  education TEXT    NOT NULL CHECK (education IN ('10','12','12pcm','grad','law')),
  PRIMARY KEY (scheme_id, education)
);

-- Services each scheme is open to. 'any' = open to every service.
CREATE TABLE IF NOT EXISTS scheme_branch (
  scheme_id INTEGER NOT NULL REFERENCES schemes(id) ON DELETE CASCADE,
  branch    TEXT    NOT NULL CHECK (branch IN ('any','army','navy','airforce')),
  PRIMARY KEY (scheme_id, branch)
);

-- ---------- Eligibility checker: SUBMISSIONS + RESULTS ----------
-- Deliberately NO personal data (no name, e-mail, IP). Only the three inputs.
CREATE TABLE IF NOT EXISTS eligibility_submissions (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  age        REAL    NOT NULL CHECK (age BETWEEN 15 AND 35),
  education  TEXT    NOT NULL CHECK (education IN ('10','12','12pcm','grad','law')),
  branch     TEXT    NOT NULL CHECK (branch    IN ('any','army','navy','airforce')),
  created_at TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS eligibility_results (
  submission_id INTEGER NOT NULL REFERENCES eligibility_submissions(id) ON DELETE CASCADE,
  scheme_id     INTEGER NOT NULL REFERENCES schemes(id),
  PRIMARY KEY (submission_id, scheme_id)
);
CREATE INDEX IF NOT EXISTS idx_results_scheme ON eligibility_results(scheme_id);

-- ---------- Visit counter ----------
CREATE TABLE IF NOT EXISTS site_stats (
  key   TEXT    PRIMARY KEY,                      -- 'total_visits'
  value INTEGER NOT NULL DEFAULT 0
);
INSERT OR IGNORE INTO site_stats (key, value) VALUES ('total_visits', 0);
