import { Card, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";

export default function DashboardPage() {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Today</CardTitle>
          <CardDescription>Quick stats for drafts, overdue invoices, and BAS tasks.</CardDescription>
        </CardHeader>
        <div className="text-sm text-slate-500">
          Wire data hooks once persistence is ready.
        </div>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Upcoming BAS</CardTitle>
          <CardDescription>FY-aligned period picker connects to BAS helper.</CardDescription>
        </CardHeader>
        <div className="text-sm text-slate-500">No BAS runs scheduled.</div>
      </Card>
    </div>
  );
}
