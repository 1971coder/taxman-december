import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";

import * as schema from "./schema.js";

export const databasePath = process.env.DATABASE_PATH ?? "./db/sqlite/app.db";

const sqlite = new Database(databasePath);

export const db = drizzle(sqlite, { schema });

export type DatabaseClient = typeof db;
