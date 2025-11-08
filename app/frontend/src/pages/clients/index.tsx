import { Button } from "../../components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";

export default function ClientsPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Clients</CardTitle>
        <CardDescription>Client list + rate cards (effective dating guard) renders here.</CardDescription>
      </CardHeader>
      <div className="flex items-center justify-between border-b border-slate-100 pb-4">
        <div>
          <p className="text-sm text-slate-500">No clients yet.</p>
        </div>
        <Button variant="outline">New client</Button>
      </div>
      <p className="pt-4 text-sm text-slate-500">Hook TanStack Query once API is live.</p>
    </Card>
  );
}
