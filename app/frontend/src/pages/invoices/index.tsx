import { useQuery } from "@tanstack/react-query";
import { InvoiceForm } from "../../components/forms/invoice-form";
import { Card, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { apiFetch } from "../../lib/api";

interface InvoiceSummary {
  id: string;
  clientId: string;
  issueDate: string;
  dueDate?: string;
  clientName?: string | null;
  status: string;
  totalIncCents: number;
}

export default function InvoicesPage() {
  const invoicesQuery = useQuery({
    queryKey: ["invoices"],
    queryFn: () => apiFetch<{ data: InvoiceSummary[] }>("/invoices")
  });

  return (
    <div className="space-y-6">
      <InvoiceForm />
      <Card>
        <CardHeader>
          <CardTitle>Recent Invoices</CardTitle>
          <CardDescription>Drafts appear here after saving.</CardDescription>
        </CardHeader>
        <div className="rounded-xl border border-slate-200">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2">Issue Date</th>
                <th className="px-4 py-2">Client</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2 text-right">Total inc GST</th>
              </tr>
            </thead>
            <tbody>
              {invoicesQuery.isLoading && (
                <tr>
                  <td className="px-4 py-4 text-center text-slate-500" colSpan={4}>
                    Loading...
                  </td>
                </tr>
              )}
              {!invoicesQuery.isLoading && (invoicesQuery.data?.data ?? []).map((invoice) => (
                <tr key={invoice.id} className="border-b border-slate-100">
                  <td className="px-4 py-2 font-medium">{invoice.issueDate}</td>
                  <td className="px-4 py-2 text-slate-600">{invoice.clientName ?? invoice.clientId}</td>
                  <td className="px-4 py-2 capitalize">{invoice.status}</td>
                  <td className="px-4 py-2 text-right">
                    ${(invoice.totalIncCents / 100).toFixed(2)}
                  </td>
                </tr>
              ))}
              {!invoicesQuery.isLoading && (invoicesQuery.data?.data?.length ?? 0) === 0 && (
                <tr>
                  <td className="px-4 py-4 text-center text-slate-500" colSpan={4}>
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
