import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { SettingsInput } from "@taxman/api-types";
import { settingsSchema } from "@taxman/api-types";

import { apiFetch } from "../../lib/api";
import { Button } from "../ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Select } from "../ui/select";

const SETTINGS_QUERY_KEY = ["settings"];

export function SettingsForm() {
  const queryClient = useQueryClient();
  const form = useForm<SettingsInput>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      legalName: "",
      abn: "",
      gstBasis: "cash",
      basFrequency: "quarterly",
      fyStartMonth: 7
    }
  });

  const settingsQuery = useQuery({
    queryKey: SETTINGS_QUERY_KEY,
    queryFn: () => apiFetch<{ data: SettingsInput | null }>("/settings")
  });

  useEffect(() => {
    if (settingsQuery.data?.data) {
      form.reset(settingsQuery.data.data);
    }
  }, [settingsQuery.data, form]);

  const mutation = useMutation({
    mutationFn: (values: SettingsInput) =>
      apiFetch<{ data: SettingsInput }>("/settings", { method: "PUT", body: values }),
    onSuccess: (response) => {
      queryClient.setQueryData(SETTINGS_QUERY_KEY, response);
      toast.success("Settings saved");
    }
  });

  const onSubmit = (values: SettingsInput) => {
    mutation.mutate(values);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Company + BAS Settings</CardTitle>
        <CardDescription>These drive BAS calculators and invoice headers.</CardDescription>
      </CardHeader>
      <form className="grid gap-4" onSubmit={form.handleSubmit(onSubmit)}>
        <div className="space-y-2">
          <Label htmlFor="legalName">Legal name</Label>
          <Input id="legalName" {...form.register("legalName")} disabled={settingsQuery.isLoading} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="abn">ABN</Label>
          <Input id="abn" inputMode="numeric" {...form.register("abn")} disabled={settingsQuery.isLoading} />
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <Label>GST Basis</Label>
            <Select {...form.register("gstBasis")} disabled={settingsQuery.isLoading}>
              <option value="cash">Cash</option>
              <option value="accrual">Accrual</option>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>BAS Frequency</Label>
            <Select {...form.register("basFrequency")} disabled={settingsQuery.isLoading}>
              <option value="monthly">Monthly</option>
              <option value="quarterly">Quarterly</option>
              <option value="annual">Annual</option>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>FY Start Month</Label>
            <Input
              type="number"
              min={1}
              max={12}
              {...form.register("fyStartMonth", { valueAsNumber: true })}
              disabled={settingsQuery.isLoading}
            />
          </div>
        </div>
        <Button type="submit" disabled={mutation.isPending || settingsQuery.isLoading}>
          {mutation.isPending ? "Saving..." : "Save settings"}
        </Button>
      </form>
    </Card>
  );
}
