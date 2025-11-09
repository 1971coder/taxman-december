import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ClientInput } from "@taxman/api-types";
import { clientSchema } from "@taxman/api-types";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { apiFetch } from "../../lib/api";
import { ClientRatesCard } from "../../components/forms/client-rates-card";
import { Button } from "../../components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";

type ClientFormValues = Pick<
  ClientInput,
  "displayName" | "contactEmail" | "defaultRateCents" | "paymentTermsDays"
>;

const CLIENTS_QUERY_KEY = ["clients"];

export default function ClientsPage() {
  const queryClient = useQueryClient();
  const form = useForm<ClientFormValues>({
    resolver: zodResolver(
      clientSchema.pick({
        displayName: true,
        contactEmail: true,
        defaultRateCents: true,
        paymentTermsDays: true
      })
    ),
    defaultValues: {
      displayName: "",
      contactEmail: "",
      defaultRateCents: 0,
      paymentTermsDays: 0
    }
  });

  const clientsQuery = useQuery({
    queryKey: CLIENTS_QUERY_KEY,
    queryFn: () => apiFetch<{ data: ClientInput[] }>("/clients")
  });

  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedClientId && (clientsQuery.data?.data?.length ?? 0) > 0) {
      setSelectedClientId(clientsQuery.data!.data[0]!.id ?? null);
    }
  }, [clientsQuery.data, selectedClientId]);

  const mutation = useMutation({
    mutationFn: (values: ClientFormValues) =>
      apiFetch<{ data: ClientInput }>("/clients", { method: "POST", body: values }),
    onSuccess: (response) => {
      queryClient.setQueryData(CLIENTS_QUERY_KEY, (current?: { data: ClientInput[] }) => {
        if (!current) return { data: [response.data] };
        return { data: [...current.data, response.data] };
      });
      toast.success("Client saved");
      form.reset({
        displayName: "",
        contactEmail: "",
        defaultRateCents: 0,
        paymentTermsDays: 0
      });
    },
    onError: () => toast.error("Unable to save client")
  });

  const selectedClient = useMemo(() => {
    return clientsQuery.data?.data.find((client) => client.id === selectedClientId);
  }, [clientsQuery.data, selectedClientId]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Clients</CardTitle>
          <CardDescription>Client list + rate cards will appear here.</CardDescription>
        </CardHeader>
        <div className="rounded-xl border border-slate-200">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2">Name</th>
                <th className="px-4 py-2">Email</th>
                <th className="px-4 py-2 text-right">Default Rate</th>
                <th className="px-4 py-2 text-right">Terms (days)</th>
                <th className="px-4 py-2 text-right">Rates</th>
              </tr>
            </thead>
            <tbody>
              {clientsQuery.isLoading && (
                <tr>
                  <td className="px-4 py-4 text-center text-slate-500" colSpan={5}>
                    Loading...
                  </td>
                </tr>
              )}
              {!clientsQuery.isLoading && (clientsQuery.data?.data ?? []).map((client) => (
                <tr
                  key={client.id}
                  className={`border-b border-slate-100 ${
                    client.id === selectedClientId ? "bg-slate-50" : ""
                  }`}
                >
                  <td className="px-4 py-2 font-medium">{client.displayName}</td>
                  <td className="px-4 py-2 text-slate-500">{client.contactEmail ?? "—"}</td>
                  <td className="px-4 py-2 text-right">
                    {client.defaultRateCents ? `$${(client.defaultRateCents / 100).toFixed(2)}` : "—"}
                  </td>
                  <td className="px-4 py-2 text-right">{client.paymentTermsDays ?? 0}</td>
                  <td className="px-4 py-2 text-right">
                    <button
                      type="button"
                      className="text-sm text-slate-600 underline-offset-2 hover:underline"
                      onClick={() => setSelectedClientId(client.id ?? null)}
                    >
                      View rates
                    </button>
                  </td>
                </tr>
              ))}
              {!clientsQuery.isLoading && (clientsQuery.data?.data?.length ?? 0) === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-4 text-center text-slate-500">
                    No clients yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>New Client</CardTitle>
          <CardDescription>Add a customer with optional default rate.</CardDescription>
        </CardHeader>
        <form className="grid gap-4 md:grid-cols-3" onSubmit={form.handleSubmit((values) => mutation.mutate(values))}>
          <div className="space-y-2">
            <Label htmlFor="displayName">Display name</Label>
            <Input id="displayName" {...form.register("displayName")} />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="contactEmail">Contact email</Label>
            <Input id="contactEmail" type="email" {...form.register("contactEmail")} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="defaultRateCents">Default rate (cents)</Label>
            <Input
              id="defaultRateCents"
              type="number"
              {...form.register("defaultRateCents", { valueAsNumber: true })}
              min={0}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="paymentTermsDays">Payment terms (days)</Label>
            <Input
              id="paymentTermsDays"
              type="number"
              min={0}
              {...form.register("paymentTermsDays", { valueAsNumber: true })}
            />
          </div>
          <Button type="submit" className="md:col-span-3" disabled={mutation.isPending}>
            {mutation.isPending ? "Saving..." : "Save client"}
          </Button>
        </form>
      </Card>

      <ClientRatesCard clientId={selectedClientId} clientName={selectedClient?.displayName} />
    </div>
  );
}
