import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { clientRateSchema } from "@taxman/api-types";
import type { ClientRateInput, EmployeeInput } from "@taxman/api-types";
import { format } from "date-fns";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { apiFetch } from "../../lib/api";
import { Button } from "../ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Select } from "../ui/select";

const clientRateFormSchema = clientRateSchema.omit({ id: true }).extend({
  effectiveFrom: z.string().min(1),
  effectiveTo: z.string().optional().nullable()
});

type ClientRateFormValues = z.infer<typeof clientRateFormSchema>;

type ClientRateRow = Omit<ClientRateInput, "effectiveFrom" | "effectiveTo"> & {
  effectiveFrom: string;
  effectiveTo?: string | null;
  employeeName?: string | null;
};

interface ClientRatesCardProps {
  clientId: string | null;
  clientName?: string;
}

export function ClientRatesCard({ clientId, clientName }: ClientRatesCardProps) {
  const queryClient = useQueryClient();
  const form = useForm<ClientRateFormValues>({
    resolver: zodResolver(clientRateFormSchema),
    defaultValues: {
      clientId: clientId ?? "",
      employeeId: "",
      rateCents: 0,
      unit: "hour",
      effectiveFrom: new Date().toISOString().slice(0, 10),
      effectiveTo: undefined
    }
  });

  useEffect(() => {
    form.reset({
      clientId: clientId ?? "",
      employeeId: "",
      rateCents: 0,
      unit: "hour",
      effectiveFrom: new Date().toISOString().slice(0, 10),
      effectiveTo: undefined
    });
  }, [clientId, form]);

  const employeesQuery = useQuery({
    queryKey: ["employees"],
    queryFn: () => apiFetch<{ data: EmployeeInput[] }>("/employees")
  });

  const ratesQuery = useQuery({
    queryKey: ["clientRates", clientId],
    enabled: Boolean(clientId),
    queryFn: () => apiFetch<{ data: ClientRateRow[] }>(`/client-rates?clientId=${clientId}`)
  });

  const mutation = useMutation({
    mutationFn: (values: ClientRateFormValues) =>
      apiFetch<{ data: ClientRateInput }>("/client-rates", { method: "POST", body: values }),
    onSuccess: () => {
      toast.success("Rate saved");
      queryClient.invalidateQueries({ queryKey: ["clientRates", clientId] });
      form.reset({
        clientId: clientId ?? "",
        employeeId: "",
        rateCents: 0,
        unit: form.getValues("unit"),
        effectiveFrom: new Date().toISOString().slice(0, 10),
        effectiveTo: undefined
      });
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : "Unable to save rate";
      toast.error(message);
    }
  });

  if (!clientId) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Client Rates</CardTitle>
          <CardDescription>Select a client to manage rate cards.</CardDescription>
        </CardHeader>
        <p className="px-6 pb-6 text-sm text-slate-500">Choose a client from the list above.</p>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Client Rates — {clientName}</CardTitle>
        <CardDescription>Effective-dated rates per employee. Overlaps blocked server-side.</CardDescription>
      </CardHeader>
      <div className="space-y-6">
        <form className="grid gap-4 md:grid-cols-5" onSubmit={form.handleSubmit((values) => mutation.mutate(values))}>
          <input type="hidden" {...form.register("clientId")} value={clientId} />
          <div className="space-y-2 md:col-span-2">
            <Label>Employee</Label>
            <Select {...form.register("employeeId")}>
              <option value="">Select employee</option>
              {(employeesQuery.data?.data ?? []).map((employee: EmployeeInput) => (
                <option key={employee.id} value={employee.id}>
                  {employee.fullName}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Rate (cents)</Label>
            <Input type="number" {...form.register("rateCents", { valueAsNumber: true })} min={0} />
          </div>
          <div className="space-y-2">
            <Label>Unit</Label>
            <Select {...form.register("unit")}>
              <option value="hour">Hour</option>
              <option value="day">Day</option>
              <option value="item">Item</option>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Effective from</Label>
            <Input type="date" {...form.register("effectiveFrom")} />
          </div>
          <div className="space-y-2">
            <Label>Effective to (optional)</Label>
            <Input type="date" {...form.register("effectiveTo")} />
          </div>
          <Button type="submit" className="md:col-span-5" disabled={mutation.isPending}>
            {mutation.isPending ? "Saving..." : "Save rate"}
          </Button>
        </form>

        <div className="rounded-xl border border-slate-200">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2">Employee</th>
                <th className="px-4 py-2 text-right">Rate</th>
                <th className="px-4 py-2">Unit</th>
                <th className="px-4 py-2">Start</th>
                <th className="px-4 py-2">End</th>
              </tr>
            </thead>
            <tbody>
              {ratesQuery.isLoading && (
                <tr>
                  <td className="px-4 py-4 text-center text-slate-500" colSpan={5}>
                    Loading...
                  </td>
                </tr>
              )}
              {!ratesQuery.isLoading && (ratesQuery.data?.data ?? []).map((rate) => (
                <tr key={rate.id} className="border-b border-slate-100">
                  <td className="px-4 py-2 font-medium">{rate.employeeName ?? rate.employeeId}</td>
                  <td className="px-4 py-2 text-right">${(rate.rateCents / 100).toFixed(2)}</td>
                  <td className="px-4 py-2">{rate.unit}</td>
                  <td className="px-4 py-2">{format(new Date(rate.effectiveFrom), "dd MMM yyyy")}</td>
                  <td className="px-4 py-2">
                    {rate.effectiveTo ? format(new Date(rate.effectiveTo), "dd MMM yyyy") : "Open"}
                  </td>
                </tr>
              ))}
              {!ratesQuery.isLoading && (ratesQuery.data?.data?.length ?? 0) === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-4 text-center text-slate-500">
                    No rates yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </Card>
  );
}
