import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { EmployeeInput } from "@taxman/api-types";
import { employeeSchema } from "@taxman/api-types";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { apiFetch } from "../../lib/api";
import { Button } from "../../components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Select } from "../../components/ui/select";

type EmployeeFormValues = Pick<
  EmployeeInput,
  "fullName" | "email" | "baseRateCents" | "defaultUnit"
>;

const EMPLOYEES_QUERY_KEY = ["employees"];

export default function EmployeesPage() {
  const queryClient = useQueryClient();
  const form = useForm<EmployeeFormValues>({
    resolver: zodResolver(
      employeeSchema.pick({ fullName: true, email: true, baseRateCents: true, defaultUnit: true })
    ),
    defaultValues: {
      fullName: "",
      email: "",
      baseRateCents: 0,
      defaultUnit: "hour"
    }
  });

  const employeesQuery = useQuery({
    queryKey: EMPLOYEES_QUERY_KEY,
    queryFn: () => apiFetch<{ data: EmployeeInput[] }>("/employees")
  });

  const mutation = useMutation({
    mutationFn: (values: EmployeeFormValues) =>
      apiFetch<{ data: EmployeeInput }>("/employees", { method: "POST", body: values }),
    onSuccess: (response) => {
      queryClient.setQueryData(EMPLOYEES_QUERY_KEY, (current?: { data: EmployeeInput[] }) => {
        if (!current) return { data: [response.data] };
        return { data: [...current.data, response.data] };
      });
      toast.success("Employee saved");
      form.reset({ fullName: "", email: "", baseRateCents: 0, defaultUnit: "hour" });
    },
    onError: () => toast.error("Unable to save employee")
  });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Employees</CardTitle>
          <CardDescription>Manage billable staff and their default units/rates.</CardDescription>
        </CardHeader>
        <div className="rounded-xl border border-slate-200">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2">Name</th>
                <th className="px-4 py-2">Email</th>
                <th className="px-4 py-2">Unit</th>
                <th className="px-4 py-2 text-right">Base Rate</th>
              </tr>
            </thead>
            <tbody>
              {employeesQuery.isLoading && (
                <tr>
                  <td className="px-4 py-4 text-center text-slate-500" colSpan={4}>
                    Loading...
                  </td>
                </tr>
              )}
              {!employeesQuery.isLoading && (employeesQuery.data?.data ?? []).map((employee) => (
                <tr key={employee.id} className="border-b border-slate-100">
                  <td className="px-4 py-2 font-medium">{employee.fullName}</td>
                  <td className="px-4 py-2 text-slate-500">{employee.email ?? "—"}</td>
                  <td className="px-4 py-2">{employee.defaultUnit}</td>
                  <td className="px-4 py-2 text-right">
                    {employee.baseRateCents ? `$${(employee.baseRateCents / 100).toFixed(2)}` : "—"}
                  </td>
                </tr>
              ))}
              {!employeesQuery.isLoading && (employeesQuery.data?.data?.length ?? 0) === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-4 text-center text-slate-500">
                    No employees yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>New Employee</CardTitle>
          <CardDescription>Capture a staff member’s default billable rate.</CardDescription>
        </CardHeader>
        <form className="grid gap-4 md:grid-cols-2" onSubmit={form.handleSubmit((values) => mutation.mutate(values))}>
          <div className="space-y-2">
            <Label htmlFor="fullName">Full name</Label>
            <Input id="fullName" {...form.register("fullName")} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" {...form.register("email")} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="defaultUnit">Default unit</Label>
            <Select id="defaultUnit" {...form.register("defaultUnit")}>
              <option value="hour">Hour</option>
              <option value="day">Day</option>
              <option value="item">Item</option>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="baseRateCents">Base rate (cents)</Label>
            <Input
              id="baseRateCents"
              type="number"
              {...form.register("baseRateCents", { valueAsNumber: true })}
              min={0}
            />
          </div>
          <Button type="submit" className="md:col-span-2" disabled={mutation.isPending}>
            {mutation.isPending ? "Saving..." : "Save employee"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
