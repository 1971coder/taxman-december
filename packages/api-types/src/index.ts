import { z } from "zod";

export const gstBasisSchema = z.enum(["cash", "accrual"]);
export const basFrequencySchema = z.enum(["monthly", "quarterly", "annual"]);
export const unitSchema = z.enum(["hour", "day", "item"]);

export const gstCodeSchema = z.object({
  id: z.string().uuid().optional(),
  code: z.string().min(1),
  description: z.string().optional(),
  ratePercent: z.number().nonnegative().default(10),
  isActive: z.boolean().default(true)
});
export type GstCodeInput = z.infer<typeof gstCodeSchema>;

export const settingsSchema = z.object({
  legalName: z.string().min(1),
  abn: z.string().regex(/^\d{11}$/),
  gstBasis: gstBasisSchema,
  basFrequency: basFrequencySchema,
  fyStartMonth: z.number().int().min(1).max(12)
});
export type SettingsInput = z.infer<typeof settingsSchema>;

export const clientSchema = z.object({
  id: z.string().uuid().optional(),
  displayName: z.string().min(1),
  contactEmail: z.string().email(),
  defaultRateCents: z.number().int().nonnegative().optional(),
  isActive: z.boolean().default(true)
});
export type ClientInput = z.infer<typeof clientSchema>;

export const employeeSchema = z.object({
  id: z.string().uuid().optional(),
  fullName: z.string().min(1),
  email: z.string().email().optional(),
  baseRateCents: z.number().int().nonnegative(),
  defaultUnit: unitSchema.default("hour"),
  isActive: z.boolean().default(true)
});
export type EmployeeInput = z.infer<typeof employeeSchema>;

export const clientRateSchema = z.object({
  id: z.string().uuid().optional(),
  clientId: z.string().uuid(),
  employeeId: z.string().uuid(),
  rateCents: z.number().int().nonnegative(),
  unit: unitSchema.default("hour"),
  effectiveFrom: z.coerce.date(),
  effectiveTo: z.coerce.date().optional()
});
export type ClientRateInput = z.infer<typeof clientRateSchema>;

export const invoiceLineSchema = z.object({
  id: z.string().uuid().optional(),
  employeeId: z.string().uuid(),
  description: z.string().min(1),
  quantity: z.number().nonnegative().default(1),
  unit: unitSchema.default("hour"),
  rate: z.number().nonnegative(),
  gstCodeId: z.string().uuid(),
  overrideRate: z.boolean().default(false)
});

export const invoiceSchema = z.object({
  id: z.string().uuid().optional(),
  clientId: z.string().uuid(),
  issueDate: z.coerce.date(),
  dueDate: z.coerce.date().optional(),
  reference: z.string().optional(),
  notes: z.string().optional(),
  lines: z.array(invoiceLineSchema).min(1)
});
export type InvoiceInput = z.infer<typeof invoiceSchema>;

export const basRequestSchema = z.object({
  frequency: basFrequencySchema,
  fiscalYearStart: z.number().int(),
  fyStartMonth: z.number().int().min(1).max(12).default(7)
});
export type BasRequestInput = z.infer<typeof basRequestSchema>;
