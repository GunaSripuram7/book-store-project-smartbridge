const fs = require('fs');
const path = require('path');
const seed = require('./data/seed');

const dbPath = path.join(__dirname, '..', 'data', 'db.json');

function ensureStore() {
  if (!fs.existsSync(path.dirname(dbPath))) {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  }

  if (!fs.existsSync(dbPath)) {
    fs.writeFileSync(
      dbPath,
      JSON.stringify(
        {
          users: seed.users,
          books: seed.books,
          orders: seed.orders
        },
        null,
        2
      ),
      'utf8'
    );
  }
}

function readStore() {
  ensureStore();
  const raw = fs.readFileSync(dbPath, 'utf8');
  return JSON.parse(raw);
}

function writeStore(store) {
  ensureStore();
  fs.writeFileSync(dbPath, JSON.stringify(store, null, 2), 'utf8');
}

function safeUser(user) {
  if (!user) {
    return null;
  }

  const { passwordHash, ...rest } = user;
  return rest;
}

module.exports = {
  dbPath,
  ensureStore,
  readStore,
  writeStore,
  safeUser
};
