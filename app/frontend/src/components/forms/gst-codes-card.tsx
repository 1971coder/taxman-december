import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import type { GstCodeInput } from "@taxman/api-types";

import { apiFetch } from "../../lib/api";
import { Button } from "../ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { Input } from "../ui/input";
import { Label } from "../ui/label";

const gstCodeFormSchema = z.object({
  code: z.string().min(1, "Code required"),
  description: z.string().optional(),
  ratePercent: z.coerce.number().min(0).max(100).default(10)
});

type GstCodeFormValues = z.infer<typeof gstCodeFormSchema>;

const GST_CODES_QUERY_KEY = ["gstCodes"];

export function GstCodesCard() {
  const queryClient = useQueryClient();
  const form = useForm<GstCodeFormValues>({
    resolver: zodResolver(gstCodeFormSchema),
    defaultValues: {
      code: "GST",
      description: "GST 10%",
      ratePercent: 10
    }
  });

  const listQuery = useQuery({
    queryKey: GST_CODES_QUERY_KEY,
    queryFn: () => apiFetch<{ data: GstCodeInput[] }>("/gst-codes")
  });

  const mutation = useMutation({
    mutationFn: (values: GstCodeFormValues) =>
      apiFetch<{ data: GstCodeInput }>("/gst-codes", { method: "POST", body: values }),
    onSuccess: (response) => {
      queryClient.setQueryData(GST_CODES_QUERY_KEY, (current?: { data: GstCodeInput[] }) => {
        if (!current) return { data: [response.data] };
        return { data: [...current.data, response.data] };
      });
      toast.success("GST code added");
      form.reset({ code: "", description: "", ratePercent: 10 });
    }
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>GST Codes</CardTitle>
        <CardDescription>Define GST rates referenced by invoices and bills.</CardDescription>
      </CardHeader>
      <div className="space-y-4">
        <form
          className="grid gap-4 md:grid-cols-3"
          onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
        >
          <div className="space-y-2">
            <Label htmlFor="code">Code</Label>
            <Input id="code" {...form.register("code")} placeholder="GST" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Input id="description" {...form.register("description")} placeholder="GST 10%" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="rate">Rate %</Label>
            <Input id="rate" type="number" step="0.1" {...form.register("ratePercent", { valueAsNumber: true })} />
          </div>
          <Button
            type="submit"
            className="md:col-span-3"
            disabled={mutation.isPending}
          >
            {mutation.isPending ? "Adding..." : "Add code"}
          </Button>
        </form>
        <div className="rounded-xl border border-slate-200">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2">Code</th>
                <th className="px-4 py-2">Description</th>
                <th className="px-4 py-2 text-right">Rate %</th>
              </tr>
            </thead>
            <tbody>
              {listQuery.data?.data.map((code) => (
                <tr key={code.id ?? code.code} className="border-b border-slate-100">
                  <td className="px-4 py-2 font-medium">{code.code}</td>
                  <td className="px-4 py-2 text-slate-500">{code.description}</td>
                  <td className="px-4 py-2 text-right">{code.ratePercent}</td>
                </tr>
              ))}
              {listQuery.data?.data.length === 0 && (
                <tr>
                  <td className="px-4 py-4 text-center text-slate-500" colSpan={3}>
                    No GST codes yet.
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

