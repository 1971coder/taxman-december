import { randomUUID } from "node:crypto";

import { Router } from "express";

import { db } from "../db/client.js";
import { gstCodes } from "../db/schema.js";
import { asyncHandler } from "../utils/async-handler.js";
import { gstCodeSchema } from "../utils/zod-schemas.js";

export const gstCodesRouter = Router();

gstCodesRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    const codes = await db.select().from(gstCodes).orderBy(gstCodes.code);
    res.json({ data: codes });
  })
);

gstCodesRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const payload = gstCodeSchema.parse(req.body);
    const record = { id: randomUUID(), ...payload };
    await db.insert(gstCodes).values(record);
    res.status(201).json({ data: record });
  })
);

