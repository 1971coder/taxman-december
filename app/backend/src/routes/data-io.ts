import { randomUUID } from "node:crypto";
import { existsSync, promises as fs } from "node:fs";
import path from "node:path";

import { asc, desc, eq } from "drizzle-orm";
import { Router } from "express";
import createHttpError from "http-errors";
import { z, ZodError } from "zod";

import { db, databasePath, type DatabaseClient } from "../db/client.js";
import { clients, employees, expenses, invoices } from "../db/schema.js";
import { asyncHandler } from "../utils/async-handler.js";
import { clientSchema, employeeSchema, expenseSchema } from "../utils/zod-schemas.js";

export const dataRouter: Router = Router();

const exportEntities = ["clients", "employees", "expenses", "invoices"] as const;
type ExportEntity = (typeof exportEntities)[number];

const importEntities = ["clients", "employees", "expenses"] as const;
type ImportEntity = (typeof importEntities)[number];

const exportQuerySchema = z.object({
  entity: z.enum(exportEntities)
});

const importPayloadSchema = z.object({
  entity: z.enum(importEntities),
  rows: z.array(z.record(z.string(), z.unknown()))
});

const restorePayloadSchema = z.object({
  fileBase64: z.string().min(1),
  filename: z.string().optional()
});

dataRouter.get(
  "/export",
  asyncHandler(async (req, res) => {
    const { entity } = exportQuerySchema.parse({
      entity: getQueryValue(req.query.entity)
    });

    const exporter = exportConfig[entity];
    const rows = await exporter.fetch();
    const csv = buildCsv(exporter.headers, rows);
    const filename = `taxman-${entity}-${new Date().toISOString().slice(0, 10)}.csv`;

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(csv);
  })
);

dataRouter.post(
  "/import",
  asyncHandler(async (req, res) => {
    const payload = importPayloadSchema.parse(req.body);
    const importer = importHandlers[payload.entity];

    const result = await db.transaction(async (tx) => importer(payload.rows, tx));

    res.json({
      data: {
        ...result,
        entity: payload.entity
      }
    });
  })
);

dataRouter.get(
  "/backup",
  asyncHandler(async (_req, res) => {
    const dbPath = resolveDatabaseFile();
    const file = await fs.readFile(dbPath);
    const filename = `taxman-backup-${new Date().toISOString().replace(/[:.]/g, "-")}.sqlite`;

    res.setHeader("Content-Type", "application/octet-stream");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(file);
  })
);

dataRouter.post(
  "/restore",
  asyncHandler(async (req, res) => {
    const payload = restorePayloadSchema.parse(req.body);
    const buffer = decodeBase64File(payload.fileBase64);
    const dbPath = resolveDatabaseFile();

    await fs.writeFile(dbPath, buffer);

    res.json({
      data: {
        restored: true,
        bytes: buffer.length
      }
    });
  })
);

const exportConfig: Record<
  ExportEntity,
  {
    headers: string[];
    fetch: () => Promise<Record<string, unknown>[]>;
  }
> = {
  clients: {
    headers: [
      "id",
      "displayName",
      "contactEmail",
      "defaultRateCents",
      "paymentTermsDays",
      "isActive"
    ],
    fetch: async () =>
      db
        .select({
          id: clients.id,
          displayName: clients.displayName,
          contactEmail: clients.contactEmail,
          defaultRateCents: clients.defaultRateCents,
          paymentTermsDays: clients.paymentTermsDays,
          isActive: clients.isActive
        })
        .from(clients)
        .orderBy(asc(clients.displayName))
  },
  employees: {
    headers: ["id", "fullName", "email", "baseRateCents", "defaultUnit", "isActive"],
    fetch: async () =>
      db
        .select({
          id: employees.id,
          fullName: employees.fullName,
          email: employees.email,
          baseRateCents: employees.baseRateCents,
          defaultUnit: employees.defaultUnit,
          isActive: employees.isActive
        })
        .from(employees)
        .orderBy(asc(employees.fullName))
  },
  expenses: {
    headers: ["id", "supplierName", "category", "amountExCents", "gstCents", "gstCodeId", "incurredDate", "notes"],
    fetch: async () =>
      db
        .select({
          id: expenses.id,
          supplierName: expenses.supplierName,
          category: expenses.category,
          amountExCents: expenses.amountExCents,
          gstCents: expenses.gstCents,
          gstCodeId: expenses.gstCodeId,
          incurredDate: expenses.incurredDate,
          notes: expenses.notes
        })
        .from(expenses)
        .orderBy(desc(expenses.incurredDate))
  },
  invoices: {
    headers: [
      "id",
      "invoiceNumber",
      "clientId",
      "issueDate",
      "dueDate",
      "cashReceivedDate",
      "status",
      "reference",
      "totalExCents",
      "totalGstCents",
      "totalIncCents",
      "notes"
    ],
    fetch: async () =>
      db
        .select({
          id: invoices.id,
          invoiceNumber: invoices.invoiceNumber,
          clientId: invoices.clientId,
          issueDate: invoices.issueDate,
          dueDate: invoices.dueDate,
          cashReceivedDate: invoices.cashReceivedDate,
          status: invoices.status,
          reference: invoices.reference,
          totalExCents: invoices.totalExCents,
          totalGstCents: invoices.totalGstCents,
          totalIncCents: invoices.totalIncCents,
          notes: invoices.notes
        })
        .from(invoices)
        .orderBy(desc(invoices.issueDate))
  }
};

type CsvRow = Record<string, unknown>;

interface ImportStats {
  inserted: number;
  updated: number;
}

type ImportHandler = (rows: CsvRow[], database: DatabaseClient) => Promise<ImportStats>;

const importHandlers: Record<ImportEntity, ImportHandler> = {
  clients: async (rows, database) => {
    let inserted = 0;
    let updated = 0;

    for (const [index, row] of rows.entries()) {
      const normalized = normalizeRow(row);
      const parsed = parseRow(
        () =>
          clientSchema.parse({
            id: getOptionalString(normalized, ["id"]),
            displayName: getString(normalized, ["displayName", "name"]),
            contactEmail: getOptionalString(normalized, ["contactEmail", "email"]),
            defaultRateCents: getOptionalNumber(normalized, ["defaultRateCents"]),
            paymentTermsDays: getOptionalNumber(normalized, ["paymentTermsDays", "terms", "paymentTerms"]),
            isActive: getOptionalBoolean(normalized, ["isActive"])
          }),
        index
      );

      const recordId = parsed.id ?? randomUUID();
      const values = {
        displayName: parsed.displayName,
        contactEmail: parsed.contactEmail ?? null,
        defaultRateCents: parsed.defaultRateCents ?? null,
        paymentTermsDays: parsed.paymentTermsDays ?? 0,
        isActive: parsed.isActive
      };

      const existing = parsed.id
        ? await database.select({ id: clients.id }).from(clients).where(eq(clients.id, recordId)).limit(1)
        : [];

      if (existing.length > 0) {
        await database.update(clients).set(values).where(eq(clients.id, recordId));
        updated += 1;
      } else {
        await database.insert(clients).values({ id: recordId, ...values });
        inserted += 1;
      }
    }

    return { inserted, updated };
  },
  employees: async (rows, database) => {
    let inserted = 0;
    let updated = 0;

    for (const [index, row] of rows.entries()) {
      const normalized = normalizeRow(row);
      const parsed = parseRow(
        () =>
          employeeSchema.parse({
            id: getOptionalString(normalized, ["id"]),
            fullName: getString(normalized, ["fullName", "name"]),
            email: getOptionalString(normalized, ["email"]),
            baseRateCents: getNumber(normalized, ["baseRateCents", "rateCents"], index),
            defaultUnit: getOptionalString(normalized, ["defaultUnit"]),
            isActive: getOptionalBoolean(normalized, ["isActive"])
          }),
        index
      );

      const recordId = parsed.id ?? randomUUID();
      const values = {
        fullName: parsed.fullName,
        email: parsed.email ?? null,
        baseRateCents: parsed.baseRateCents,
        defaultUnit: parsed.defaultUnit,
        isActive: parsed.isActive
      };

      const existing = parsed.id
        ? await database.select({ id: employees.id }).from(employees).where(eq(employees.id, recordId)).limit(1)
        : [];

      if (existing.length > 0) {
        await database.update(employees).set(values).where(eq(employees.id, recordId));
        updated += 1;
      } else {
        await database.insert(employees).values({ id: recordId, ...values });
        inserted += 1;
      }
    }

    return { inserted, updated };
  },
  expenses: async (rows, database) => {
    let inserted = 0;
    let updated = 0;

    for (const [index, row] of rows.entries()) {
      const normalized = normalizeRow(row);
      const parsed = parseRow(
        () =>
          expenseSchema.parse({
            id: getOptionalString(normalized, ["id"]),
            supplierName: getString(normalized, ["supplierName", "supplier"]),
            category: getString(normalized, ["category"]),
            amountExCents: getNumber(normalized, ["amountExCents", "amountEx"], index),
            gstCents: getNumber(normalized, ["gstCents", "gstAmount"], index),
            gstCodeId: getOptionalString(normalized, ["gstCodeId"]),
            incurredDate: getString(normalized, ["incurredDate", "date"]),
            attachmentPath: getOptionalString(normalized, ["attachmentPath", "attachment"]),
            notes: getOptionalString(normalized, ["notes"])
          }),
        index
      );

      const recordId = parsed.id ?? randomUUID();
      const values = {
        supplierName: parsed.supplierName,
        category: parsed.category,
        amountExCents: parsed.amountExCents,
        gstCents: parsed.gstCents,
        gstCodeId: parsed.gstCodeId ?? null,
        incurredDate: parsed.incurredDate.toISOString().slice(0, 10),
        attachmentPath: parsed.attachmentPath ?? null,
        notes: parsed.notes ?? null
      };

      const existing = parsed.id
        ? await database.select({ id: expenses.id }).from(expenses).where(eq(expenses.id, recordId)).limit(1)
        : [];

      if (existing.length > 0) {
        await database.update(expenses).set(values).where(eq(expenses.id, recordId));
        updated += 1;
      } else {
        await database.insert(expenses).values({ id: recordId, ...values });
        inserted += 1;
      }
    }

    return { inserted, updated };
  }
};

function normalizeRow(row: CsvRow): Record<string, unknown> {
  const normalized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    normalized[key] = value;
    normalized[key.toLowerCase()] = value;
    normalized[key.replace(/[\s_-]+/g, "").toLowerCase()] = value;
  }
  return normalized;
}

function getString(row: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = row[key] ?? row[key.toLowerCase()];
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
    if (typeof value === "number" && !Number.isNaN(value)) {
      return String(value);
    }
  }
  return "";
}

function getOptionalString(row: Record<string, unknown>, keys: string[]): string | undefined {
  const value = getString(row, keys);
  return value.length > 0 ? value : undefined;
}

function getNumber(row: Record<string, unknown>, keys: string[], index: number): number {
  const maybe = getOptionalNumber(row, keys);
  if (maybe === undefined) {
    throw createHttpError(400, `Row ${index + 2}: expected numeric value for ${keys[0]}`);
  }
  return maybe;
}

function getOptionalNumber(row: Record<string, unknown>, keys: string[]): number | undefined {
  for (const key of keys) {
    const value = row[key] ?? row[key.toLowerCase()];
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === "string" && value.trim().length > 0) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }
  return undefined;
}

function getOptionalBoolean(row: Record<string, unknown>, keys: string[], defaultValue = true): boolean {
  for (const key of keys) {
    const value = row[key] ?? row[key.toLowerCase()];
    if (typeof value === "boolean") {
      return value;
    }
    if (typeof value === "string" && value.trim().length > 0) {
      const normalized = value.trim().toLowerCase();
      if (["true", "1", "yes", "y"].includes(normalized)) {
        return true;
      }
      if (["false", "0", "no", "n"].includes(normalized)) {
        return false;
      }
    }
  }
  return defaultValue;
}

function buildCsv(headers: string[], rows: Record<string, unknown>[]): string {
  const lines = [headers.join(",")];

  for (const row of rows) {
    const line = headers
      .map((header) => formatCsvValue(row[header]))
      .join(",");
    lines.push(line);
  }

  return lines.join("\n");
}

function formatCsvValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }

  const raw = value instanceof Date ? value.toISOString() : String(value);
  if (raw.includes('"') || raw.includes(",") || raw.includes("\n")) {
    return `"${raw.replace(/"/g, '""')}"`;
  }
  return raw;
}

function getQueryValue(value: unknown): string | undefined {
  if (typeof value === "string") {
    return value;
  }
  if (Array.isArray(value) && value.length > 0 && typeof value[0] === "string") {
    return value[0];
  }
  return undefined;
}

function resolveDatabaseFile(): string {
  if (path.isAbsolute(databasePath)) {
    return databasePath;
  }

  const candidates = [
    path.resolve(process.cwd(), databasePath),
    path.resolve(process.cwd(), "app/backend", databasePath)
  ];

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  return candidates[0];
}

function decodeBase64File(input: string): Buffer {
  const payload = input.includes(",") ? input.split(",").pop() ?? "" : input;
  try {
    return Buffer.from(payload, "base64");
  } catch (_error) {
    throw createHttpError(400, "Invalid base64 payload");
  }
}

function parseRow<T>(parser: () => T, rowIndex: number): T {
  try {
    return parser();
  } catch (error) {
    if (error instanceof ZodError) {
      const issues = error.issues.map((issue) => issue.message).join("; ");
      throw createHttpError(400, `Row ${rowIndex + 2}: ${issues}`);
    }
    throw error;
  }
}
