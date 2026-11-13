// npm run db:init   -> create/upgrade the database and seed it
// npm run db:reset  -> delete the file first (visit counter and submissions are lost!)
const { open, DB_PATH } = require('./database');
const db = open({ reset: process.argv.includes('--reset') });
const n = db.prepare('SELECT COUNT(*) AS n FROM entries').get().n;
const s = db.prepare('SELECT COUNT(*) AS n FROM schemes').get().n;
console.log(`Database ready at ${DB_PATH}: ${n} entries, ${s} schemes.`);
db.close();
