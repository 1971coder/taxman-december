import { Card, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";

export default function ExpensesPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Expenses & Bills</CardTitle>
        <CardDescription>Supplier bills with GST codes land here.</CardDescription>
      </CardHeader>
      <p className="text-sm text-slate-500">Wire up CRUD once API endpoints exist.</p>
    </Card>
  );
}
