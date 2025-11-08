import { eq } from "drizzle-orm";
import { Router } from "express";

import { db } from "../db/client.js";
import { companySettings } from "../db/schema.js";
import { asyncHandler } from "../utils/async-handler.js";
import { settingsSchema } from "../utils/zod-schemas.js";

const SETTINGS_ID = "company-settings";

export const settingsRouter = Router();

settingsRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    const [record] = await db.select().from(companySettings).limit(1);
    res.json({ data: record ?? null });
  })
);

settingsRouter.put(
  "/",
  asyncHandler(async (req, res) => {
    const payload = settingsSchema.parse(req.body);
    const values = { id: SETTINGS_ID, ...payload };
    const existing = await db.select().from(companySettings).where(eq(companySettings.id, SETTINGS_ID));

    if (existing.length > 0) {
      await db.update(companySettings).set(payload).where(eq(companySettings.id, SETTINGS_ID));
    } else {
      await db.insert(companySettings).values(values);
    }

    res.json({ data: values });
  })
);
