import { Router } from "express";

export const employeesRouter = Router();

employeesRouter.get("/", (_req, res) => {
  res.json({ data: [], message: "Employees list stub" });
});

employeesRouter.post("/", (_req, res) => {
  res.status(201).json({ message: "Employee creation stub" });
});
