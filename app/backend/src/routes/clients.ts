import { Router } from "express";

export const clientsRouter = Router();

clientsRouter.get("/", (_req, res) => {
  res.json({ data: [], message: "Clients list stub" });
});

clientsRouter.post("/", (_req, res) => {
  res.status(201).json({ message: "Client creation stub" });
});
