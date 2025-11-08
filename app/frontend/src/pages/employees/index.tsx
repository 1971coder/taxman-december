import { Button } from "../../components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";

export default function EmployeesPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Employees</CardTitle>
        <CardDescription>Manage billable staff and their default units/rates.</CardDescription>
      </CardHeader>
      <div className="flex items-center justify-between border-b border-slate-100 pb-4">
        <div>
          <p className="text-sm text-slate-500">No employees yet.</p>
        </div>
        <Button variant="outline">New employee</Button>
      </div>
    </Card>
  );
}
