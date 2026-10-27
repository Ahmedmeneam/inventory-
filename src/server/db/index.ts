import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema.ts';
import path from 'path';
import fs from 'fs';

// Store sqlite database locally
const DB_DIR = path.resolve(process.cwd(), 'data');
if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

const DB_PATH = path.join(DB_DIR, 'warehouse_v67.db');

export const sqlite = new Database(DB_PATH);

// Apply strict WAL and PRAGMA settings as per specifications
sqlite.pragma('journal_mode = WAL');
sqlite.pragma('foreign_keys = ON');
sqlite.pragma('busy_timeout = 5000');

export const db = drizzle(sqlite, { schema });

// Initialize database schema tables cleanly (NO dummy or seed data)
export function initDbSchema() {
  // Ensure new columns exist if upgraded
  try {
    const custodyCols = sqlite.pragma('table_info(custodies)') as any[];
    if (custodyCols && custodyCols.length > 0 && !custodyCols.some((c: any) => c.name === 'is_initial_import_locked')) {
      sqlite.exec('ALTER TABLE custodies ADD COLUMN is_initial_import_locked INTEGER NOT NULL DEFAULT 0;');
    }
  } catch (e) {
    // Table may not exist yet
  }

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS company_settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company_name TEXT NOT NULL,
      admin_email TEXT,
      is_configured INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS custodies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      is_initial_import_locked INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS warehouses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      custody_id INTEGER REFERENCES custodies(id),
      is_main INTEGER NOT NULL DEFAULT 0,
      is_general INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_code TEXT NOT NULL UNIQUE,
      full_name TEXT NOT NULL,
      phone TEXT,
      role TEXT NOT NULL,
      custody_id INTEGER REFERENCES custodies(id),
      password_hash TEXT,
      temp_password_hash TEXT,
      temp_password_expires_at TEXT,
      must_change_password INTEGER NOT NULL DEFAULT 1,
      status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      prefix TEXT NOT NULL UNIQUE
    );

    CREATE TABLE IF NOT EXISTS units (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      symbol TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      item_code TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      category_id INTEGER NOT NULL REFERENCES categories(id),
      unit_id INTEGER NOT NULL REFERENCES units(id),
      min_limit_milli INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS custody_items (
      custody_id INTEGER NOT NULL REFERENCES custodies(id),
      item_id INTEGER NOT NULL REFERENCES items(id),
      PRIMARY KEY (custody_id, item_id)
    );

    CREATE TABLE IF NOT EXISTS stock_balances (
      custody_id INTEGER NOT NULL REFERENCES custodies(id),
      warehouse_id INTEGER NOT NULL REFERENCES warehouses(id),
      item_id INTEGER NOT NULL REFERENCES items(id),
      quantity_milli INTEGER NOT NULL DEFAULT 0,
      reserved_qty_milli INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (custody_id, warehouse_id, item_id)
    );

    CREATE TABLE IF NOT EXISTS delegation_rules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      custody_id INTEGER NOT NULL REFERENCES custodies(id),
      warehouse_id INTEGER NOT NULL REFERENCES warehouses(id),
      item_id INTEGER NOT NULL REFERENCES items(id),
      max_qty_per_op_milli INTEGER NOT NULL,
      daily_limit_milli INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS movements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      trx_number TEXT NOT NULL UNIQUE,
      custody_id INTEGER NOT NULL REFERENCES custodies(id),
      movement_type TEXT NOT NULL,
      status TEXT NOT NULL,
      source_warehouse_id INTEGER REFERENCES warehouses(id),
      target_warehouse_id INTEGER REFERENCES warehouses(id),
      item_id INTEGER NOT NULL REFERENCES items(id),
      quantity_milli INTEGER NOT NULL,
      notes TEXT,
      created_by INTEGER NOT NULL REFERENCES users(id),
      created_at TEXT NOT NULL,
      approved_by INTEGER REFERENCES users(id),
      approved_at TEXT,
      rejection_reason TEXT,
      reversal_of_id INTEGER
    );

    CREATE TABLE IF NOT EXISTS inventory_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      custody_id INTEGER NOT NULL REFERENCES custodies(id),
      warehouse_id INTEGER NOT NULL REFERENCES warehouses(id),
      started_by INTEGER NOT NULL REFERENCES users(id),
      started_at TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'in_progress',
      completed_by INTEGER REFERENCES users(id),
      completed_at TEXT,
      cancellation_reason TEXT,
      notes TEXT
    );

    CREATE TABLE IF NOT EXISTS inventory_counts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id INTEGER NOT NULL REFERENCES inventory_sessions(id),
      item_id INTEGER NOT NULL REFERENCES items(id),
      book_quantity_milli INTEGER NOT NULL,
      actual_quantity_milli INTEGER NOT NULL,
      difference_milli INTEGER NOT NULL,
      notes TEXT
    );

    CREATE TABLE IF NOT EXISTS item_proposals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      custody_id INTEGER NOT NULL REFERENCES custodies(id),
      suggested_name TEXT NOT NULL,
      suggested_category_id INTEGER NOT NULL REFERENCES categories(id),
      suggested_unit_id INTEGER NOT NULL REFERENCES units(id),
      min_limit_milli INTEGER NOT NULL DEFAULT 0,
      notes TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      rejection_reason TEXT,
      created_by INTEGER NOT NULL REFERENCES users(id),
      created_at TEXT NOT NULL,
      reviewed_by INTEGER REFERENCES users(id),
      reviewed_at TEXT
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      user_code TEXT,
      action TEXT NOT NULL,
      details TEXT NOT NULL,
      ip_address TEXT,
      created_at TEXT NOT NULL
    );
  `);
}
