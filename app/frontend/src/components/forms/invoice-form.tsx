import { zodResolver } from "@hookform/resolvers/zod";
import { useMemo } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { z } from "zod";

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

const invoiceSchema = z.object({
  clientId: z.string().min(1),
  issueDate: z.string().min(1),
  reference: z.string().optional(),
  notes: z.string().optional(),
  lines: z.array(invoiceLineSchema).min(1)
});

export type InvoiceFormValues = z.infer<typeof invoiceSchema>;

const defaultLine: InvoiceFormValues["lines"][number] = {
  employeeId: "",
  description: "",
  quantity: 1,
  unit: "hour",
  rate: 0,
  gstCodeId: "",
  overrideRate: false
};

export function InvoiceForm() {
  const form = useForm<InvoiceFormValues>({
    resolver: zodResolver(invoiceSchema),
    defaultValues: {
      clientId: "",
      issueDate: new Date().toISOString().slice(0, 10),
      reference: "",
      notes: "",
      lines: [defaultLine]
    }
  });

  const { fields, append, remove } = useFieldArray({ control: form.control, name: "lines" });

  const watchedLines = form.watch("lines");

  const totals = useMemo(() => {
    const amountEx = watchedLines.reduce((sum, line) => sum + line.quantity * line.rate, 0);
    const gst = amountEx * 0.1;
    return {
      amountEx,
      gst,
      amountInc: amountEx + gst,
      unresolvedRate: watchedLines.some((line) => line.rate <= 0)
    };
  }, [watchedLines]);

  const onSubmit = (values: InvoiceFormValues) => {
    console.log("Invoice payload", values);
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
        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="client">Client</Label>
            <Select id="client" {...form.register("clientId")}> 
              <option value="">Select client</option>
              <option value="demo">Demo Client</option>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="issueDate">Issue date</Label>
            <Input id="issueDate" type="date" {...form.register("issueDate")}/>
          </div>
          <div className="space-y-2">
            <Label htmlFor="reference">Reference</Label>
            <Input id="reference" placeholder="INV-0001" {...form.register("reference")} />
          </div>
        </div>

        <div className="space-y-4">
          {fields.map((field, index) => {
            const rateField = form.register(`lines.${index}.rate` as const, {
              valueAsNumber: true
            });
            const qtyField = form.register(`lines.${index}.quantity` as const, {
              valueAsNumber: true
            });
            const override = form.watch(`lines.${index}.overrideRate`);

            return (
              <div key={field.id} className="rounded-xl border border-slate-200 p-4">
                <div className="grid gap-4 md:grid-cols-4">
                  <div className="space-y-2">
                    <Label>Employee</Label>
                    <Select {...form.register(`lines.${index}.employeeId` as const)}>
                      <option value="">Select employee</option>
                      <option value="emp-1">Alice Smith</option>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Quantity</Label>
                    <Input type="number" step="0.25" {...qtyField} />
                  </div>
                  <div className="space-y-2">
                    <Label>Rate (ex GST)</Label>
                    <Input type="number" step="1" {...rateField} />
                    {override && <span className="text-xs text-amber-600">Overridden</span>}
                  </div>
                  <div className="space-y-2">
                    <Label>GST Code</Label>
                    <Select {...form.register(`lines.${index}.gstCodeId` as const)}>
                      <option value="">Code</option>
                      <option value="gst">GST 10%</option>
                    </Select>
                  </div>
                </div>
                <div className="mt-4 space-y-2">
                  <Label>Description</Label>
                  <Textarea {...form.register(`lines.${index}.description` as const)} rows={2} />
                </div>
                <div className="mt-4 flex items-center justify-between text-sm text-slate-500">
                  <button
                    type="button"
                    className="text-rose-600"
                    onClick={() => remove(index)}
                  >
                    Remove line
                  </button>
                  <span>
                    Line total: {(form.getValues(`lines.${index}.quantity`) * form.getValues(`lines.${index}.rate`)).toFixed(2)}
                  </span>
                </div>
              </div>
            );
          })}
          <Button
            type="button"
            variant="outline"
            onClick={() => append({ ...defaultLine })}
          >
            Add line
          </Button>
        </div>

        <div className="grid gap-2 rounded-xl border border-dashed border-slate-300 p-4 text-sm">
          <div className="flex justify-between">
            <span>Total ex GST</span>
            <span>${totals.amountEx.toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span>GST 10%</span>
            <span>${totals.gst.toFixed(2)}</span>
          </div>
          <div className="flex justify-between font-semibold">
            <span>Total inc GST</span>
            <span>${totals.amountInc.toFixed(2)}</span>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="notes">Notes (PDF footer)</Label>
          <Textarea id="notes" rows={3} {...form.register("notes")} />
        </div>

        <Button type="submit" disabled={totals.unresolvedRate || !form.formState.isValid}>
          Save Draft
        </Button>
      </form>
    </Card>
  );
}
