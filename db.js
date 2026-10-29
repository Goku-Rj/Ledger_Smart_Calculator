const fs = require('fs');
const path = require('path');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'ledger_db.json');
const SEED_FILE = path.join(__dirname, 'data', 'seed_db.json');

function ensureDbInitialized() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(DB_FILE)) {
    const initialData = fs.existsSync(SEED_FILE)
      ? fs.readFileSync(SEED_FILE, 'utf-8')
      : JSON.stringify({
          settings: { shopName: 'Chamundeshwari Provision Store', theme: 'light' },
          transactions: []
        }, null, 2);
    fs.writeFileSync(DB_FILE, initialData, 'utf-8');
  }
}

function readDb() {
  ensureDbInitialized();
  try {
    const raw = fs.readFileSync(DB_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    return {
      settings: { shopName: 'Chamundeshwari Provision Store', theme: 'light' },
      transactions: []
    };
  }
}

function writeDb(data) {
  ensureDbInitialized();
  const tempFile = `${DB_FILE}.tmp`;
  fs.writeFileSync(tempFile, JSON.stringify(data, null, 2), 'utf-8');
  fs.renameSync(tempFile, DB_FILE);
}

function resetDb(restoreSample = false) {
  if (restoreSample && fs.existsSync(SEED_FILE)) {
    const seed = JSON.parse(fs.readFileSync(SEED_FILE, 'utf-8'));
    const current = readDb();
    current.transactions = seed.transactions || [];
    writeDb(current);
    return current;
  }
  const current = readDb();
  current.transactions = [];
  writeDb(current);
  return current;
}

module.exports = {
  readDb,
  writeDb,
  resetDb
};
