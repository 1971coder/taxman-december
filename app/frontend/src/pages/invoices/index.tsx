import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { InvoiceForm, type InvoiceDetail } from "../../components/forms/invoice-form";
import { Button } from "../../components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { apiFetch } from "../../lib/api";

interface InvoiceSummary {
  id: string;
  invoiceNumber: number;
  clientId: string;
  issueDate: string;
  dueDate?: string;
  cashReceivedDate?: string | null;
  clientName?: string | null;
  status: string;
  totalIncCents: number;
}

type InvoiceDetailResponse = InvoiceDetail & {
  totalExCents: number;
  totalGstCents: number;
  totalIncCents: number;
};

export default function InvoicesPage() {
  const queryClient = useQueryClient();
  const [editingInvoiceId, setEditingInvoiceId] = useState<string | null>(null);

  const invoicesQuery = useQuery({
    queryKey: ["invoices"],
    queryFn: () => apiFetch<{ data: InvoiceSummary[] }>("/invoices")
  });

  const invoiceDetailQuery = useQuery({
    queryKey: ["invoice-detail", editingInvoiceId],
    enabled: Boolean(editingInvoiceId),
    queryFn: () => apiFetch<{ data: InvoiceDetailResponse }>(`/invoices/${editingInvoiceId}`),
    staleTime: 0
  });

  useEffect(() => {
    if (invoiceDetailQuery.isError) {
      const message = invoiceDetailQuery.error instanceof Error ? invoiceDetailQuery.error.message : "Unable to load invoice";
      toast.error(message);
      setEditingInvoiceId(null);
    }
  }, [invoiceDetailQuery.isError, invoiceDetailQuery.error]);

  const deleteMutation = useMutation({
    mutationFn: (invoiceId: string) => apiFetch<null>(`/invoices/${invoiceId}`, { method: "DELETE" }),
    onSuccess: (_data, invoiceId) => {
      toast.success("Invoice deleted");
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      if (editingInvoiceId === invoiceId) {
        setEditingInvoiceId(null);
      }
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : "Unable to delete invoice";
      toast.error(message);
    }
  });

  const invoices = invoicesQuery.data?.data ?? [];
  const editingInvoice = editingInvoiceId ? invoiceDetailQuery.data?.data ?? null : null;
  const isLoadingExistingInvoice = Boolean(editingInvoiceId && invoiceDetailQuery.isLoading && !invoiceDetailQuery.data);

  const handleEdit = (invoiceId: string) => {
    setEditingInvoiceId(invoiceId);
  };

  const handleDelete = (invoiceId: string) => {
    const confirmed = window.confirm("Delete this invoice? This action cannot be undone.");
    if (!confirmed) return;
    deleteMutation.mutate(invoiceId);
  };

  const formSection = isLoadingExistingInvoice ? (
    <Card>
      <CardHeader className="flex items-center justify-between">
        <div>
          <CardTitle>Loading invoice…</CardTitle>
          <CardDescription>Fetching invoice details so you can edit them.</CardDescription>
        </div>
        <Button variant="ghost" type="button" onClick={() => setEditingInvoiceId(null)}>
          Cancel
        </Button>
      </CardHeader>
    </Card>
  ) : (
    <InvoiceForm
      editingInvoice={editingInvoice}
      onEditCancel={() => setEditingInvoiceId(null)}
      onEditComplete={() => setEditingInvoiceId(null)}
    />
  );

  return (
    <div className="space-y-6">
      {formSection}
      <Card>
        <CardHeader>
          <CardTitle>Recent Invoices</CardTitle>
          <CardDescription>Drafts appear here after saving.</CardDescription>
        </CardHeader>
        <div className="rounded-xl border border-slate-200">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2">Invoice #</th>
                <th className="px-4 py-2">Issue Date</th>
                <th className="px-4 py-2">Cash Received</th>
                <th className="px-4 py-2">Client</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2 text-right">Total inc GST</th>
                <th className="px-4 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {invoicesQuery.isLoading && (
                <tr>
                  <td className="px-4 py-4 text-center text-slate-500" colSpan={7}>
                    Loading...
                  </td>
                </tr>
              )}
              {!invoicesQuery.isLoading && invoices.map((invoice) => (
                <tr key={invoice.id} className="border-b border-slate-100">
                  <td className="px-4 py-2 font-mono text-xs">{invoice.invoiceNumber}</td>
                  <td className="px-4 py-2 font-medium">{invoice.issueDate}</td>
                  <td className="px-4 py-2 text-slate-600">
                    {invoice.cashReceivedDate ?? "—"}
                  </td>
                  <td className="px-4 py-2 text-slate-600">{invoice.clientName ?? invoice.clientId}</td>
                  <td className="px-4 py-2 capitalize">{invoice.status}</td>
                  <td className="px-4 py-2 text-right">
                    ${(invoice.totalIncCents / 100).toFixed(2)}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <button
                      type="button"
                      className="text-xs font-medium text-slate-600 hover:text-slate-900"
                      onClick={() => handleEdit(invoice.id)}
                    >
                      Edit
                    </button>
                    <span className="mx-2 text-slate-300">•</span>
                    <button
                      type="button"
                      className="text-xs font-medium text-rose-600 hover:text-rose-700 disabled:opacity-60"
                      onClick={() => handleDelete(invoice.id)}
                      disabled={deleteMutation.isPending && deleteMutation.variables === invoice.id}
                    >
                      {deleteMutation.isPending && deleteMutation.variables === invoice.id ? "Deleting…" : "Delete"}
                    </button>
                  </td>
                </tr>
              ))}
              {!invoicesQuery.isLoading && invoices.length === 0 && (
                <tr>
                  <td className="px-4 py-4 text-center text-slate-500" colSpan={7}>
                    No invoices yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
