import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ExpenseInput, GstCodeInput } from "@taxman/api-types";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { apiFetch } from "../../lib/api";
import { Button } from "../../components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Select } from "../../components/ui/select";
import { Textarea } from "../../components/ui/textarea";

const expenseFormSchema = z.object({
  supplierName: z.string().min(1),
  category: z.string().min(1),
  amountEx: z.coerce.number().nonnegative(),
  gstAmount: z.coerce.number().nonnegative(),
  gstCodeId: z.string().min(1),
  incurredDate: z.string().min(1),
  attachmentPath: z.string().optional(),
  notes: z.string().optional()
});

type ExpenseFormValues = z.infer<typeof expenseFormSchema>;

type ExpenseRow = Omit<ExpenseInput, "incurredDate"> & { incurredDate: string };

export default function ExpensesPage() {
  const queryClient = useQueryClient();

  const expensesQuery = useQuery({
    queryKey: ["expenses"],
    queryFn: () => apiFetch<{ data: ExpenseRow[] }>("/expenses")
  });

  const gstCodesQuery = useQuery({
    queryKey: ["gstCodes"],
    queryFn: () => apiFetch<{ data: GstCodeInput[] }>("/gst-codes")
  });

  const form = useForm<ExpenseFormValues>({
    resolver: zodResolver(expenseFormSchema),
    defaultValues: {
      supplierName: "",
      category: "",
      amountEx: 0,
      gstAmount: 0,
      gstCodeId: "",
      incurredDate: new Date().toISOString().slice(0, 10),
      attachmentPath: "",
      notes: ""
    }
  });

  const mutation = useMutation({
    mutationFn: (values: ExpenseFormValues) =>
      apiFetch<{ data: ExpenseInput }>("/expenses", {
        method: "POST",
        body: {
          supplierName: values.supplierName,
          category: values.category,
          amountExCents: Math.round(values.amountEx * 100),
          gstCents: Math.round(values.gstAmount * 100),
          gstCodeId: values.gstCodeId,
          incurredDate: values.incurredDate,
          attachmentPath: values.attachmentPath,
          notes: values.notes
        }
      }),
    onSuccess: () => {
      toast.success("Expense saved");
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      form.reset({
        supplierName: "",
        category: "",
        amountEx: 0,
        gstAmount: 0,
        gstCodeId: "",
        incurredDate: new Date().toISOString().slice(0, 10),
        attachmentPath: "",
        notes: ""
      });
    },
    onError: () => toast.error("Unable to save expense")
  });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Expenses</CardTitle>
          <CardDescription>Track supplier bills and GST splits.</CardDescription>
        </CardHeader>
        <div className="rounded-xl border border-slate-200">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2">Date</th>
                <th className="px-4 py-2">Supplier</th>
                <th className="px-4 py-2">Category</th>
                <th className="px-4 py-2 text-right">Amount ex</th>
                <th className="px-4 py-2 text-right">GST</th>
              </tr>
            </thead>
            <tbody>
              {expensesQuery.isLoading && (
                <tr>
                  <td className="px-4 py-4 text-center text-slate-500" colSpan={5}>
                    Loading...
                  </td>
                </tr>
              )}
              {!expensesQuery.isLoading && (expensesQuery.data?.data ?? []).map((expense) => (
                <tr key={expense.id} className="border-b border-slate-100">
                  <td className="px-4 py-2 font-medium">{expense.incurredDate}</td>
                  <td className="px-4 py-2">{expense.supplierName}</td>
                  <td className="px-4 py-2 text-slate-500">{expense.category}</td>
                  <td className="px-4 py-2 text-right">${(expense.amountExCents / 100).toFixed(2)}</td>
                  <td className="px-4 py-2 text-right">${(expense.gstCents / 100).toFixed(2)}</td>
                </tr>
              ))}
              {!expensesQuery.isLoading && (expensesQuery.data?.data?.length ?? 0) === 0 && (
                <tr>
                  <td className="px-4 py-4 text-center text-slate-500" colSpan={5}>
                    No expenses yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Add Expense</CardTitle>
          <CardDescription>Amounts captured in dollars; backend stores cents.</CardDescription>
        </CardHeader>
        <form className="grid gap-4 md:grid-cols-2" onSubmit={form.handleSubmit((values) => mutation.mutate(values))}>
          <div className="space-y-2">
            <Label htmlFor="supplierName">Supplier</Label>
            <Input id="supplierName" {...form.register("supplierName")} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="category">Category</Label>
            <Input id="category" {...form.register("category")} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="amountEx">Amount ex GST</Label>
            <Input id="amountEx" type="number" step="0.01" {...form.register("amountEx", { valueAsNumber: true })} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="gstAmount">GST amount</Label>
            <Input id="gstAmount" type="number" step="0.01" {...form.register("gstAmount", { valueAsNumber: true })} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="gstCodeId">GST Code</Label>
            <Select id="gstCodeId" {...form.register("gstCodeId")}>
              <option value="">Select code</option>
              {(gstCodesQuery.data?.data ?? []).map((code) => (
                <option key={code.id} value={code.id}>
                  {code.code} ({code.ratePercent}%)
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="incurredDate">Date</Label>
            <Input id="incurredDate" type="date" {...form.register("incurredDate")} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="attachmentPath">Attachment path</Label>
            <Input id="attachmentPath" {...form.register("attachmentPath")} placeholder="/files/receipt.pdf" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea id="notes" rows={2} {...form.register("notes")} />
          </div>
          <Button type="submit" className="md:col-span-2" disabled={mutation.isPending}>
            {mutation.isPending ? "Saving..." : "Save expense"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
