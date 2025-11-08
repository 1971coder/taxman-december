import { Router } from "express";

export const invoicesRouter = Router();

invoicesRouter.get("/", (_req, res) => {
  res.json({ data: [], message: "Invoices list stub" });
});

invoicesRouter.post("/", (_req, res) => {
  res.status(201).json({ message: "Invoice creation stub" });
});
