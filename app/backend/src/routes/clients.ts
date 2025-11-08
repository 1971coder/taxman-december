import { randomUUID } from "node:crypto";

import { asc, eq } from "drizzle-orm";
import { Router } from "express";

import { db } from "../db/client.js";
import { clients } from "../db/schema.js";
import { asyncHandler } from "../utils/async-handler.js";
import { clientSchema } from "../utils/zod-schemas.js";

export const clientsRouter: Router = Router();

clientsRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    const allClients = await db.select().from(clients).orderBy(asc(clients.displayName));
    res.json({ data: allClients });
  })
);

clientsRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const payload = clientSchema.parse(req.body);

    if (payload.displayName) {
      const existing = await db
        .select({ id: clients.id })
        .from(clients)
        .where(eq(clients.displayName, payload.displayName))
        .limit(1);

      if (existing.length > 0) {
        return res.status(409).json({ message: "Client already exists" });
      }
    }

    const record = { id: randomUUID(), ...payload };
    await db.insert(clients).values(record);
    res.status(201).json({ data: record });
  })
);
