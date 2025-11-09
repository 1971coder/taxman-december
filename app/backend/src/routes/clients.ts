import { randomUUID } from "node:crypto";

import { asc, eq } from "drizzle-orm";
import { Router } from "express";
import { z } from "zod";

import { db } from "../db/client.js";
import { clients } from "../db/schema.js";
import { asyncHandler } from "../utils/async-handler.js";
import { clientSchema } from "../utils/zod-schemas.js";

const clientPayloadSchema = clientSchema.pick({
  displayName: true,
  contactEmail: true,
  defaultRateCents: true,
  address: true
});

type ClientPayload = z.infer<typeof clientPayloadSchema>;

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
    const payload = clientPayloadSchema.parse(req.body);
    const values = sanitizeClientPayload(payload);

    if (values.displayName.length === 0) {
      return res.status(400).json({ message: "Display name is required" });
    }

    if (values.displayName) {
      const existing = await db
        .select({ id: clients.id })
        .from(clients)
        .where(eq(clients.displayName, values.displayName))
        .limit(1);

      if (existing.length > 0) {
        return res.status(409).json({ message: "Client already exists" });
      }
    }

    const record = { id: randomUUID(), ...values };
    await db.insert(clients).values(record);
    res.status(201).json({ data: record });
  })
);

clientsRouter.put(
  "/:id",
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const payload = clientPayloadSchema.parse(req.body);
    const values = sanitizeClientPayload(payload);

    if (values.displayName.length === 0) {
      return res.status(400).json({ message: "Display name is required" });
    }

    const existing = await db.select().from(clients).where(eq(clients.id, id)).limit(1);
    if (existing.length === 0) {
      return res.status(404).json({ message: "Client not found" });
    }

    const duplicates = await db
      .select({ id: clients.id })
      .from(clients)
      .where(eq(clients.displayName, values.displayName))
      .limit(1);

    if (duplicates.length > 0 && duplicates[0]!.id !== id) {
      return res.status(409).json({ message: "Client already exists" });
    }

    await db.update(clients).set(values).where(eq(clients.id, id));
    const updated = await db.select().from(clients).where(eq(clients.id, id)).limit(1);

    res.json({ data: updated[0] });
  })
);

function sanitizeClientPayload(payload: ClientPayload) {
  const contactEmail = payload.contactEmail?.trim();
  const address = payload.address?.trim();

  return {
    displayName: payload.displayName.trim(),
    contactEmail: contactEmail && contactEmail.length > 0 ? contactEmail : null,
    address: address && address.length > 0 ? address : null,
    defaultRateCents:
      typeof payload.defaultRateCents === "number" ? payload.defaultRateCents : null
  };
}
