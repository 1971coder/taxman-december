import type { Express } from "express";
import request from "supertest";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import { resetDatabase, setupTestApp, withDatabase } from "./test-utils.js";

let app: Express;
let dbPath: string;
const EXISTING_ID = "11111111-1111-4111-8111-111111111111";

describe("/api/data routes", () => {
  beforeAll(async () => {
    ({ app, dbPath } = await setupTestApp());
  });

  beforeEach(() => {
    resetDatabase(dbPath);
  });

  it("exports CSV with quoted fields when needed", async () => {
    insertClient({ id: "client-1", displayName: 'Acme, "Pty"' });

    const response = await request(app).get("/api/data/export").query({ entity: "clients" }).expect(200);

    expect(response.headers["content-type"]).toContain("text/csv");
    const lines = response.text.trim().split("\n");
    expect(lines[0]).toBe(
      "id,displayName,contactEmail,defaultRateCents,paymentTermsDays,isActive"
    );
    expect(lines[1]).toContain('"Acme, ""Pty"""');
  });

  it("imports rows and upserts existing records", async () => {
    insertClient({ id: EXISTING_ID, displayName: "Existing Co" });

    const response = await request(app)
      .post("/api/data/import")
      .send({
        entity: "clients",
        rows: [
          {
            displayName: "New Client",
            contactEmail: "new@example.com",
            defaultRateCents: 15000,
            paymentTermsDays: 30
          },
          {
            id: EXISTING_ID,
            displayName: "Existing Co Updated",
            defaultRateCents: 18000,
            paymentTermsDays: 14
          }
        ]
      })
      .expect(200);

    expect(response.body.data).toMatchObject({
      entity: "clients",
      inserted: 1,
      updated: 1
    });

    const clients = withDatabase(dbPath, (sqlite) =>
      sqlite.prepare("SELECT display_name AS name FROM clients ORDER BY display_name").all()
    );
    expect(clients).toHaveLength(2);
    expect(clients[0].name).toBe("Existing Co Updated");
    expect(clients[1].name).toBe("New Client");
  });

  it("rejects invalid import rows with contextual errors", async () => {
    const response = await request(app)
      .post("/api/data/import")
      .send({
        entity: "clients",
        rows: [{ contactEmail: "missing@client.com" }]
      })
      .expect(400);

    expect(response.body.message).toContain("Row 2");
  });

  it("backs up and restores the SQLite database", async () => {
    insertClient({ id: "client-a", displayName: "Client A" });
    insertClient({ id: "client-b", displayName: "Client B" });

    const backupResponse = await request(app)
      .get("/api/data/backup")
      .buffer()
      .parse(binaryParser)
      .expect(200);

    const backupBuffer: Buffer = backupResponse.body;
    expect(backupBuffer.length).toBeGreaterThan(0);

    resetDatabase(dbPath);
    insertClient({ id: "client-temp", displayName: "Temp Client" });

    await request(app)
      .post("/api/data/restore")
      .send({
        fileBase64: backupBuffer.toString("base64"),
        filename: "backup.sqlite"
      })
      .expect(200);

    const restoredClients = withDatabase(dbPath, (sqlite) =>
      sqlite.prepare("SELECT id, display_name FROM clients ORDER BY display_name").all()
    );
    expect(restoredClients.map((row) => row.display_name)).toEqual(["Client A", "Client B"]);
  });
});

function insertClient({ id, displayName }: { id: string; displayName: string }) {
  withDatabase(dbPath, (sqlite) => {
    sqlite
      .prepare(
        `
        INSERT INTO clients (id, display_name, contact_email, default_rate_cents, payment_terms_days, is_active)
        VALUES (@id, @displayName, 'client@example.com', 10000, 0, 1)
      `
      )
      .run({ id, displayName });
  });
}

function binaryParser(res: NodeJS.ReadableStream, callback: (err: Error | null, data?: Buffer) => void) {
  const chunks: Buffer[] = [];
  res.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
  res.on("end", () => callback(null, Buffer.concat(chunks)));
  res.on("error", (error) => callback(error as Error));
}
