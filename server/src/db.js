import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let database;
let depth = 0;

export function dbPath() {
  const configured = process.env.NOTELY_DB?.trim();
  if (configured) return configured;
  return path.join(__dirname, '..', 'data', 'notely.db');
}

export function getDb() {
  if (!database) {
    const target = dbPath();
    if (target !== ':memory:') {
      fs.mkdirSync(path.dirname(path.resolve(target)), { recursive: true });
    }
    database = new DatabaseSync(target);
    database.exec('PRAGMA foreign_keys = ON');
    if (target !== ':memory:') database.exec('PRAGMA journal_mode = WAL');
  }
  return database;
}

export function closeDb() {
  if (database) {
    database.close();
    database = null;
    depth = 0;
  }
}

export function migrate() {
  const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  const db = getDb();
  db.exec(sql);
  const columns = db.prepare('PRAGMA table_info(workspaces)').all();
  if (!columns.some((column) => column.name === 'user_id')) {
    db.exec('ALTER TABLE workspaces ADD COLUMN user_id INTEGER REFERENCES users(id) ON DELETE CASCADE');
  }
  db.exec('CREATE INDEX IF NOT EXISTS idx_workspaces_user ON workspaces(user_id)');
}

export function resetDatabase() {
  const db = getDb();
  db.exec('PRAGMA foreign_keys = OFF');
  const tables = db
    .prepare("SELECT name FROM sqlite_master WHERE type IN ('table', 'view') AND name NOT LIKE 'sqlite_%'")
    .all();
  for (const table of tables) {
    db.exec(`DROP TABLE IF EXISTS "${table.name}"`);
  }
  db.exec('PRAGMA foreign_keys = ON');
  migrate();
}

export function tx(fn) {
  const db = getDb();
  const outer = depth === 0;
  if (outer) db.exec('BEGIN IMMEDIATE');
  depth += 1;
  try {
    const result = fn();
    depth -= 1;
    if (outer) db.exec('COMMIT');
    return result;
  } catch (error) {
    depth -= 1;
    if (outer) {
      try {
        db.exec('ROLLBACK');
      } catch {
        /* The transaction may already be closed. */
      }
    }
    throw error;
  }
}

export function insertedId(result) {
  return Number(result.lastInsertRowid);
}
