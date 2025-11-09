import { randomUUID } from "node:crypto";

import { asc, eq } from "drizzle-orm";
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

employeesRouter.put(
  "/:id",
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const payload = employeeSchema.omit({ id: true }).parse(req.body);

    const existing = await db.select().from(employees).where(eq(employees.id, id)).limit(1);
    if (existing.length === 0) {
      res.status(404).json({ error: "Employee not found" });
      return;
    }

    await db.update(employees).set(payload).where(eq(employees.id, id));
    const [updated] = await db.select().from(employees).where(eq(employees.id, id)).limit(1);
    res.json({ data: updated });
  })
);

employeesRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const deleted = await db.delete(employees).where(eq(employees.id, id));

    if (deleted.changes === 0) {
      res.status(404).json({ error: "Employee not found" });
      return;
    }

    res.status(204).send();
  })
);
