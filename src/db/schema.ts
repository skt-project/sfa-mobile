import * as SQLite from "expo-sqlite";

let _db: SQLite.SQLiteDatabase | null = null;

export async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (_db) return _db;
  _db = await SQLite.openDatabaseAsync("sfa_local.db");
  await migrate(_db);
  return _db;
}

async function migrate(db: SQLite.SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS local_visits (
      local_id        TEXT PRIMARY KEY,
      server_visit_id TEXT,
      salesman_sk     TEXT NOT NULL,
      outlet_sk       TEXT,
      outlet_name     TEXT,
      schedule_id     TEXT,
      visit_date      TEXT NOT NULL,
      visit_type      TEXT NOT NULL DEFAULT 'ROUTE',
      checkin_time    TEXT,
      checkin_lat     REAL,
      checkin_lon     REAL,
      checkin_photo_path TEXT,
      checkout_time   TEXT,
      checkout_lat    REAL,
      checkout_lon    REAL,
      checkout_photo_path TEXT,
      total_demand    REAL NOT NULL DEFAULT 0,
      effective_call  TEXT NOT NULL DEFAULT 'NO',
      notes           TEXT,
      items_json      TEXT,
      sync_status     TEXT NOT NULL DEFAULT 'local',
      created_at      TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sync_queue (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      action      TEXT NOT NULL,
      visit_id    TEXT,
      payload     TEXT NOT NULL,
      photo_path  TEXT,
      created_at  TEXT NOT NULL,
      retry_count INTEGER NOT NULL DEFAULT 0,
      status      TEXT NOT NULL DEFAULT 'pending'
    );

    CREATE TABLE IF NOT EXISTS cached_schedule (
      week         TEXT NOT NULL,
      salesman_sk  TEXT NOT NULL,
      data_json    TEXT NOT NULL,
      cached_at    TEXT NOT NULL,
      PRIMARY KEY (week, salesman_sk)
    );

    CREATE TABLE IF NOT EXISTS cached_sku (
      sku_id      TEXT PRIMARY KEY,
      data_json   TEXT NOT NULL,
      cached_at   TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_local_visits_date ON local_visits (visit_date);
    CREATE INDEX IF NOT EXISTS idx_sync_queue_status ON sync_queue (status);
  `);

  // v2: add submitted_at — ALTER TABLE fails silently if column already exists
  try {
    await db.execAsync("ALTER TABLE local_visits ADD COLUMN submitted_at TEXT");
  } catch { /* column already exists */ }
}
