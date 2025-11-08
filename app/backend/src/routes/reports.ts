import { Router } from "express";

export const reportsRouter = Router();

reportsRouter.get("/bas", (_req, res) => {
  res.json({
    data: { periods: [], summary: {} },
    message: "BAS report stub"
  });
});
