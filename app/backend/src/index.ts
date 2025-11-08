import "dotenv/config";
import express, { type Express, type NextFunction, type Request, type Response } from "express";
import cors from "cors";
import morgan from "morgan";
import createHttpError from "http-errors";

import { clientsRouter } from "./routes/clients.js";
import { clientRatesRouter } from "./routes/client-rates.js";
import { employeesRouter } from "./routes/employees.js";
import { invoicesRouter } from "./routes/invoices.js";
import { expensesRouter } from "./routes/expenses.js";
import { reportsRouter } from "./routes/reports.js";
import { gstCodesRouter } from "./routes/gst-codes.js";
import { settingsRouter } from "./routes/settings.js";

const app: Express = express();

app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use(morgan("dev"));

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/settings", settingsRouter);
app.use("/api/gst-codes", gstCodesRouter);
app.use("/api/clients", clientsRouter);
app.use("/api/client-rates", clientRatesRouter);
app.use("/api/employees", employeesRouter);
app.use("/api/invoices", invoicesRouter);
app.use("/api/expenses", expensesRouter);
app.use("/api/reports", reportsRouter);

app.use((req, _res, next) => {
  next(createHttpError(404, `Route ${req.method} ${req.path} not found`));
});

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  const error = createHttpError.isHttpError(err)
    ? err
    : createHttpError(500, "Internal Server Error");

  res.status(error.statusCode).json({
    message: error.message,
    ...(process.env.NODE_ENV === "development" && { stack: error.stack })
  });
});

const port = Number(process.env.PORT ?? 4000);

if (process.env.NODE_ENV !== "test") {
  app.listen(port, () => {
    console.log(`Backend listening on http://localhost:${port}`);
  });
}

export default app;
