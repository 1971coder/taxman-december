import Database from "better-sqlite3";
import { mkdtemp } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import type { Express } from "express";
import { vi } from "vitest";

const CREATE_TABLES_SQL = `
CREATE TABLE IF NOT EXISTS company_settings (
  id TEXT PRIMARY KEY,
  legal_name TEXT NOT NULL,
  abn TEXT NOT NULL,
  gst_basis TEXT NOT NULL,
  bas_frequency TEXT NOT NULL,
  fy_start_month INTEGER NOT NULL DEFAULT 7,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
);

CREATE TABLE IF NOT EXISTS gst_codes (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL,
  description TEXT,
  rate_percent REAL NOT NULL DEFAULT 10,
  is_active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS clients (
  id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  contact_email TEXT,
  address TEXT,
  default_rate_cents INTEGER,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
);

CREATE TABLE IF NOT EXISTS employees (
  id TEXT PRIMARY KEY,
  full_name TEXT NOT NULL,
  email TEXT,
  base_rate_cents INTEGER NOT NULL DEFAULT 0,
  default_unit TEXT NOT NULL DEFAULT 'hour',
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
);

CREATE TABLE IF NOT EXISTS client_rates (
  id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL,
  employee_id TEXT NOT NULL,
  rate_cents INTEGER NOT NULL,
  unit TEXT NOT NULL DEFAULT 'hour',
  effective_from TEXT NOT NULL,
  effective_to TEXT
);

CREATE TABLE IF NOT EXISTS invoices (
  id TEXT PRIMARY KEY,
  invoice_number INTEGER NOT NULL UNIQUE,
  client_id TEXT NOT NULL,
  issue_date TEXT NOT NULL,
  due_date TEXT NOT NULL,
  cash_received_date TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  reference TEXT,
  total_ex_cents INTEGER NOT NULL DEFAULT 0,
  total_gst_cents INTEGER NOT NULL DEFAULT 0,
  total_inc_cents INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
);

CREATE TABLE IF NOT EXISTS invoice_items (
  id TEXT PRIMARY KEY,
  invoice_id TEXT NOT NULL,
  employee_id TEXT NOT NULL,
  description TEXT NOT NULL,
  quantity REAL NOT NULL DEFAULT 0,
  unit TEXT NOT NULL DEFAULT 'hour',
  rate_cents INTEGER NOT NULL DEFAULT 0,
  amount_ex_cents INTEGER NOT NULL DEFAULT 0,
  gst_code_id TEXT NOT NULL,
  FOREIGN KEY (invoice_id) REFERENCES invoices(id)
);

CREATE TABLE IF NOT EXISTS expenses (
  id TEXT PRIMARY KEY,
  supplier_name TEXT NOT NULL,
  category TEXT,
  amount_ex_cents INTEGER NOT NULL DEFAULT 0,
  gst_cents INTEGER NOT NULL DEFAULT 0,
  gst_code_id TEXT,
  incurred_date TEXT NOT NULL,
  attachment_path TEXT,
  notes TEXT
);
`;

export interface TestContext {
  app: Express;
  dbPath: string;
}

export async function setupTestApp(): Promise<TestContext> {
  const dir = await mkdtemp(path.join(tmpdir(), "taxman-test-"));
  const dbPath = path.join(dir, "app.db");
  initializeDatabase(dbPath);
  process.env.NODE_ENV = "test";
  process.env.DATABASE_PATH = dbPath;
  vi.resetModules();
  const { default: app } = await import("../index.js");
  return { app, dbPath };
}

export function resetDatabase(dbPath: string) {
  withDatabase(dbPath, (sqlite) => {
    sqlite.exec(`
      DELETE FROM invoice_items;
      DELETE FROM invoices;
      DELETE FROM expenses;
      DELETE FROM client_rates;
      DELETE FROM clients;
      DELETE FROM employees;
      DELETE FROM gst_codes;
      DELETE FROM company_settings;
    `);
  });
}

export function withDatabase<T>(dbPath: string, fn: (db: Database) => T): T {
  const sqlite = new Database(dbPath);
  try {
    return fn(sqlite);
  } finally {
    sqlite.close();
  }
}

function initializeDatabase(dbPath: string) {
  withDatabase(dbPath, (sqlite) => {
    sqlite.exec(CREATE_TABLES_SQL);
  });
}
