import { randomUUID } from "node:crypto";

import { asc } from "drizzle-orm";
import { Router } from "express";

import { db } from "../db/client.js";
import { employees } from "../db/schema.js";
import { asyncHandler } from "../utils/async-handler.js";
import { employeeSchema } from "../utils/zod-schemas.js";

export const employeesRouter: Router = Router();

employeesRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    const data = await db.select().from(employees).orderBy(asc(employees.fullName));
    res.json({ data });
  })
);

employeesRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const payload = employeeSchema.parse(req.body);
    const record = { id: randomUUID(), ...payload };
    await db.insert(employees).values(record);
    res.status(201).json({ data: record });
  })
);
