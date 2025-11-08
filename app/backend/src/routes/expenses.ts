import { Router } from "express";

export const expensesRouter = Router();

expensesRouter.get("/", (_req, res) => {
  res.json({ data: [], message: "Expenses list stub" });
});

expensesRouter.post("/", (_req, res) => {
  res.status(201).json({ message: "Expense creation stub" });
});
