import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  ClientInput,
  ClientRateInput,
  EmployeeInput,
  GstCodeInput,
  InvoiceInput
} from "@taxman/api-types";
import { useEffect, useMemo } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { apiFetch } from "../../lib/api";
import { Button } from "../ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Select } from "../ui/select";
import { Textarea } from "../ui/textarea";

const invoiceLineSchema = z.object({
  employeeId: z.string().min(1),
  description: z.string().min(1),
  quantity: z.coerce.number().nonnegative().default(1),
  unit: z.enum(["hour", "day", "item"]).default("hour"),
  rate: z.coerce.number().nonnegative(),
  gstCodeId: z.string().min(1),
  overrideRate: z.boolean().default(false)
});

const formSchema = z.object({
  clientId: z.string().min(1),
  issueDate: z.string().min(1),
  dueDate: z.string().min(1).optional(),
  cashReceivedDate: z.string().optional(),
  reference: z.string().optional(),
  notes: z.string().optional(),
  lines: z.array(invoiceLineSchema).min(1)
});

export type InvoiceFormValues = z.infer<typeof formSchema>;

const defaultLine: InvoiceFormValues["lines"][number] = {
  employeeId: "",
  description: "",
  quantity: 1,
  unit: "hour",
  rate: 0,
  gstCodeId: "",
  overrideRate: false
};

const CLIENTS_QUERY_KEY = ["clients"];
const EMPLOYEES_QUERY_KEY = ["employees"];
const GST_CODES_QUERY_KEY = ["gstCodes"];

export function InvoiceForm() {
  const queryClient = useQueryClient();
  const today = new Date().toISOString().slice(0, 10);

  const form = useForm<InvoiceFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      clientId: "",
      issueDate: today,
      dueDate: today,
      cashReceivedDate: "",
      reference: "",
      notes: "",
      lines: [{ ...defaultLine }]
    }
  });

  const { fields, append, remove } = useFieldArray({ control: form.control, name: "lines" });

  const clientId = form.watch("clientId");
  const issueDate = form.watch("issueDate");
  const lines = form.watch("lines");

  const clientsQuery = useQuery({
    queryKey: CLIENTS_QUERY_KEY,
    queryFn: () => apiFetch<{ data: ClientInput[] }>("/clients")
  });

  const clients = clientsQuery.data?.data ?? [];
  const selectedClient = useMemo(
    () => clients.find((client) => client.id === clientId),
    [clients, clientId]
  );

  const employeesQuery = useQuery({
    queryKey: EMPLOYEES_QUERY_KEY,
    queryFn: () => apiFetch<{ data: EmployeeInput[] }>("/employees")
  });

  const gstCodesQuery = useQuery({
    queryKey: GST_CODES_QUERY_KEY,
    queryFn: () => apiFetch<{ data: GstCodeInput[] }>("/gst-codes")
  });

  const clientRatesQuery = useQuery({
    queryKey: ["clientRates", clientId],
    enabled: Boolean(clientId),
    queryFn: () => apiFetch<{ data: ClientRateInput[] }>(`/client-rates?clientId=${clientId}`)
  });

  useEffect(() => {
    // when issue date changes, refresh line rates (non overridden)
    if (!clientId) return;
    lines.forEach((line, index) => {
      if (!line.employeeId || line.overrideRate) return;
      const cents = pickLocalRateCents({
        employeeId: line.employeeId,
        issueDate,
        clientRates: clientRatesQuery.data?.data ?? [],
        employees: employeesQuery.data?.data ?? []
      });
      if (cents !== null) {
        const dollars = cents / 100;
        if (line.rate !== dollars) {
          form.setValue(`lines.${index}.rate`, dollars, { shouldDirty: true });
        }
      }
    });
  }, [clientId, issueDate, clientRatesQuery.data, employeesQuery.data]);

  useEffect(() => {
    if (!clientId || !issueDate) return;
    const terms = selectedClient?.paymentTermsDays ?? 0;
    const computedDueDate = addDays(issueDate, terms);
    if (!computedDueDate) return;
    const currentDueDate = form.getValues("dueDate");
    if (currentDueDate !== computedDueDate) {
      form.setValue("dueDate", computedDueDate, { shouldDirty: true });
    }
  }, [clientId, form, issueDate, selectedClient?.paymentTermsDays]);

  const gstLookup = useMemo(() => {
    const entries: [string, number][] = (gstCodesQuery.data?.data ?? [])
      .filter((code): code is GstCodeInput & { id: string } => Boolean(code.id))
      .map((code) => [code.id!, code.ratePercent ?? 0]);
    return new Map(entries);
  }, [gstCodesQuery.data]);

  const totals = useMemo(() => {
    return lines.reduce(
      (acc, line) => {
        const amount = Number(line.quantity ?? 0) * Number(line.rate ?? 0);
        const gstRate = gstLookup.get(line.gstCodeId) ?? 0;
        const gst = amount * (gstRate / 100);
        acc.amountEx += amount;
        acc.gst += gst;
        acc.unresolvedRate = acc.unresolvedRate || line.rate <= 0;
        return acc;
      },
      { amountEx: 0, gst: 0, unresolvedRate: false }
    );
  }, [lines, gstLookup]);

  const mutation = useMutation({
    mutationFn: (values: InvoiceFormValues) =>
      apiFetch<{ data: InvoiceInput }>("/invoices", {
        method: "POST",
        body: {
          ...values,
          dueDate: values.dueDate ?? values.issueDate,
          cashReceivedDate: values.cashReceivedDate ? values.cashReceivedDate : undefined,
          lines: values.lines.map((line) => ({
            ...line,
            quantity: Number(line.quantity),
            rate: Number(line.rate)
          }))
        }
      }),
    onSuccess: () => {
      toast.success("Invoice saved");
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      form.reset({
        clientId: "",
        issueDate: today,
        dueDate: today,
        cashReceivedDate: "",
        reference: "",
        notes: "",
        lines: [{ ...defaultLine }]
      });
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : "Unable to save invoice";
      toast.error(message);
    }
  });

  const onEmployeeChange = (index: number, employeeId: string) => {
    form.setValue(`lines.${index}.employeeId`, employeeId, { shouldDirty: true });
    form.setValue(`lines.${index}.overrideRate`, false);
    if (!employeeId || !clientId) return;
    const cents = pickLocalRateCents({
      employeeId,
      issueDate,
      clientRates: clientRatesQuery.data?.data ?? [],
      employees: employeesQuery.data?.data ?? []
    });
    form.setValue(`lines.${index}.rate`, cents ? cents / 100 : 0, { shouldDirty: true });
  };

  const onSubmit = (values: InvoiceFormValues) => {
    mutation.mutate(values);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>New Invoice</CardTitle>
        <CardDescription>
          Client selection will cache rate cards. Employee rows auto-fill rates; chip appears when user overrides.
        </CardDescription>
      </CardHeader>
      <form className="space-y-6" onSubmit={form.handleSubmit(onSubmit)}>
        <div className="grid gap-4 md:grid-cols-5">
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="client">Client</Label>
            <Select
              id="client"
              name="clientId"
              value={clientId}
              onChange={(event) =>
                form.setValue("clientId", event.target.value, {
                  shouldDirty: true,
                  shouldValidate: true
                })
              }
            >
              <option value="">Select client</option>
              {(clientsQuery.data?.data ?? []).map((client) => (
                <option key={client.id} value={client.id}>
                  {client.displayName}
                </option>
              ))}
            </Select>
            <input type="hidden" {...form.register("clientId")} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="issueDate">Issue date</Label>
            <Input id="issueDate" type="date" {...form.register("issueDate")} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="dueDate">Due date</Label>
            <Input id="dueDate" type="date" {...form.register("dueDate")} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cashReceivedDate">Cash received date</Label>
            <Input id="cashReceivedDate" type="date" {...form.register("cashReceivedDate")} />
            <p className="text-xs text-slate-500">Needed for cash-basis BAS totals.</p>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="reference">Reference</Label>
            <Input id="reference" placeholder="INV-0001" {...form.register("reference")} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="notes">Notes (PDF footer)</Label>
            <Textarea id="notes" rows={2} {...form.register("notes")} />
          </div>
        </div>

        <div className="space-y-4">
          {fields.map((field, index) => {
            const quantityField = form.register(`lines.${index}.quantity` as const, {
              valueAsNumber: true
            });
            const rateField = form.register(`lines.${index}.rate` as const, {
              valueAsNumber: true
            });
            const override = form.watch(`lines.${index}.overrideRate`);
            const lineQuantity = form.getValues(`lines.${index}.quantity`);
            const lineRate = form.getValues(`lines.${index}.rate`);

            return (
              <div key={field.id} className="rounded-xl border border-slate-200 p-4">
                <div className="grid gap-4 md:grid-cols-5">
                  <div className="space-y-2 md:col-span-2">
                    <Label>Employee</Label>
                    <Select
                      name={`lines.${index}.employeeId`}
                      value={form.getValues(`lines.${index}.employeeId`)}
                      onChange={(event) => onEmployeeChange(index, event.target.value)}
                    >
                      <option value="">Select employee</option>
                      {(employeesQuery.data?.data ?? []).map((employee) => (
                        <option key={employee.id} value={employee.id}>
                          {employee.fullName}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Quantity</Label>
                    <Input type="number" step="0.25" {...quantityField} />
                  </div>
                  <div className="space-y-2">
                    <Label>Rate (ex GST)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      {...rateField}
                      onChange={(event) => {
                        rateField.onChange(event);
                        form.setValue(`lines.${index}.overrideRate`, true, {
                          shouldDirty: true
                        });
                      }}
                    />
                    {override && <span className="text-xs text-amber-600">Overridden</span>}
                  </div>
                  <div className="space-y-2">
                    <Label>GST Code</Label>
                    <Select {...form.register(`lines.${index}.gstCodeId` as const)}>
                      <option value="">Code</option>
                      {(gstCodesQuery.data?.data ?? []).map((code) => (
                        <option key={code.id} value={code.id}>
                          {code.code} ({code.ratePercent}%)
                        </option>
                      ))}
                    </Select>
                  </div>
                </div>
                <div className="mt-4 space-y-2">
                  <Label>Description</Label>
                  <Textarea {...form.register(`lines.${index}.description` as const)} rows={2} />
                </div>
                <div className="mt-4 flex items-center justify-between text-sm text-slate-500">
                  <button type="button" className="text-rose-600" onClick={() => remove(index)}>
                    Remove line
                  </button>
                  <span>Line total: ${(lineQuantity * lineRate).toFixed(2)}</span>
                </div>
              </div>
            );
          })}
          <Button type="button" variant="outline" onClick={() => append({ ...defaultLine })}>
            Add line
          </Button>
        </div>

        <div className="grid gap-2 rounded-xl border border-dashed border-slate-300 p-4 text-sm">
          <div className="flex justify-between">
            <span>Total ex GST</span>
            <span>${totals.amountEx.toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span>GST</span>
            <span>${totals.gst.toFixed(2)}</span>
          </div>
          <div className="flex justify-between font-semibold">
            <span>Total inc GST</span>
            <span>${(totals.amountEx + totals.gst).toFixed(2)}</span>
          </div>
        </div>

        <Button type="submit" disabled={totals.unresolvedRate || mutation.isPending}>
          {mutation.isPending ? "Saving..." : "Save Draft"}
        </Button>
      </form>
    </Card>
  );
}

function pickLocalRateCents({
  employeeId,
  issueDate,
  clientRates,
  employees
}: {
  employeeId: string;
  issueDate: string;
  clientRates: ClientRateInput[];
  employees: EmployeeInput[];
}) {
  const target = new Date(issueDate);
  const match = clientRates
    .filter((rate) => rate.employeeId === employeeId)
    .filter((rate) => isWithin(target, new Date(rate.effectiveFrom), rate.effectiveTo ? new Date(rate.effectiveTo) : null))
    .sort((a, b) => new Date(b.effectiveFrom).getTime() - new Date(a.effectiveFrom).getTime())[0];

  if (match) {
    return match.rateCents;
  }

  const employee = employees.find((emp) => emp.id === employeeId);
  return employee?.baseRateCents ?? null;
}

function isWithin(date: Date, start: Date, end: Date | null) {
  const time = date.getTime();
  const startTime = start.getTime();
  const endTime = end ? end.getTime() : Number.POSITIVE_INFINITY;
  return startTime <= time && time <= endTime;
}

function addDays(date: string, days: number) {
  if (!date) return null;
  const base = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(base.getTime())) {
    return null;
  }
  base.setUTCDate(base.getUTCDate() + days);
  return base.toISOString().slice(0, 10);
}
