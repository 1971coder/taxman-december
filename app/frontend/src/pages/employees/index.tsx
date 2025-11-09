import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { EmployeeInput } from "@taxman/api-types";
import { employeeSchema } from "@taxman/api-types";
import { useForm } from "react-hook-form";
import { useState } from "react";
import { toast } from "sonner";

import { apiFetch } from "../../lib/api";
import { Button } from "../../components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Select } from "../../components/ui/select";

type EmployeeFormValues = Pick<
  EmployeeInput,
  "fullName" | "email" | "baseRateCents" | "defaultUnit" | "superContributionPercent"
>;

const DEFAULT_FORM_VALUES: EmployeeFormValues = {
  fullName: "",
  email: "",
  baseRateCents: 0,
  defaultUnit: "hour",
  superContributionPercent: 11
};

const EMPLOYEES_QUERY_KEY = ["employees"];

const superPercentFormatter = new Intl.NumberFormat(undefined, {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2
});

export default function EmployeesPage() {
  const queryClient = useQueryClient();
  const [editingEmployee, setEditingEmployee] = useState<EmployeeInput | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const form = useForm<EmployeeFormValues>({
    resolver: zodResolver(
      employeeSchema.pick({
        fullName: true,
        email: true,
        baseRateCents: true,
        defaultUnit: true,
        superContributionPercent: true
      })
    ),
    defaultValues: DEFAULT_FORM_VALUES
  });

  const employeesQuery = useQuery({
    queryKey: EMPLOYEES_QUERY_KEY,
    queryFn: () => apiFetch<{ data: EmployeeInput[] }>("/employees")
  });

  const createMutation = useMutation({
    mutationFn: (values: EmployeeFormValues) =>
      apiFetch<{ data: EmployeeInput }>("/employees", { method: "POST", body: values }),
    onSuccess: (response) => {
      queryClient.setQueryData(EMPLOYEES_QUERY_KEY, (current?: { data: EmployeeInput[] }) => {
        if (!current) return { data: [response.data] };
        return { data: [...current.data, response.data] };
      });
      toast.success("Employee saved");
      form.reset({ ...DEFAULT_FORM_VALUES });
    },
    onError: () => toast.error("Unable to save employee")
  });

  const updateMutation = useMutation({
    mutationFn: (input: { id: string; values: EmployeeFormValues }) =>
      apiFetch<{ data: EmployeeInput }>(`/employees/${input.id}`, {
        method: "PUT",
        body: input.values
      }),
    onSuccess: (response) => {
      queryClient.setQueryData(EMPLOYEES_QUERY_KEY, (current?: { data: EmployeeInput[] }) => {
        if (!current) return { data: [response.data] };
        return {
          data: current.data.map((employee) =>
            employee.id === response.data.id ? response.data : employee
          )
        };
      });
      toast.success("Employee updated");
      setEditingEmployee(null);
      form.reset({ ...DEFAULT_FORM_VALUES });
    },
    onError: () => toast.error("Unable to update employee")
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      apiFetch<void>(`/employees/${id}`, {
        method: "DELETE"
      }),
    onMutate: (id) => {
      setDeletingId(id);
    },
    onSuccess: (_, id) => {
      queryClient.setQueryData(EMPLOYEES_QUERY_KEY, (current?: { data: EmployeeInput[] }) => {
        if (!current) return { data: [] };
        return { data: current.data.filter((employee) => employee.id !== id) };
      });
      toast.success("Employee deleted");
    },
    onError: () => toast.error("Unable to delete employee"),
    onSettled: () => setDeletingId(null)
  });

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  const handleEdit = (employee: EmployeeInput) => {
    setEditingEmployee(employee);
    form.reset({
      fullName: employee.fullName,
      email: employee.email ?? "",
      baseRateCents: employee.baseRateCents,
      defaultUnit: employee.defaultUnit,
      superContributionPercent: employee.superContributionPercent
    });
  };

  const handleDelete = (employee: EmployeeInput) => {
    if (!window.confirm(`Delete ${employee.fullName}?`)) {
      return;
    }
    deleteMutation.mutate(employee.id);
  };

  const handleCancelEdit = () => {
    setEditingEmployee(null);
    form.reset({ ...DEFAULT_FORM_VALUES });
  };

  const onSubmit = (values: EmployeeFormValues) => {
    if (editingEmployee) {
      updateMutation.mutate({ id: editingEmployee.id, values });
    } else {
      createMutation.mutate(values);
    }
  };

  const formatSuperPercent = (value: number) => superPercentFormatter.format(value);

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
                <th className="px-4 py-2 text-right">Super %</th>
                <th className="px-4 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {employeesQuery.isLoading && (
                <tr>
                  <td className="px-4 py-4 text-center text-slate-500" colSpan={6}>
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
                  <td className="px-4 py-2 text-right">
                    {formatSuperPercent(employee.superContributionPercent)}%
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="ghost"
                        className="h-8 px-3 text-xs"
                        type="button"
                        onClick={() => handleEdit(employee)}
                        disabled={isSubmitting || deletingId === employee.id}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="outline"
                        className="h-8 px-3 text-xs"
                        type="button"
                        onClick={() => handleDelete(employee)}
                        disabled={deletingId === employee.id || isSubmitting}
                      >
                        {deletingId === employee.id ? "Deleting..." : "Delete"}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {!employeesQuery.isLoading && (employeesQuery.data?.data?.length ?? 0) === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-4 text-center text-slate-500">
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
        <form className="grid gap-4 md:grid-cols-2" onSubmit={form.handleSubmit(onSubmit)}>
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
          <div className="space-y-2">
            <Label htmlFor="superContributionPercent">Super contribution (%)</Label>
            <Input
              id="superContributionPercent"
              type="number"
              step="0.01"
              min={0}
              max={100}
              {...form.register("superContributionPercent", { valueAsNumber: true })}
            />
          </div>
          <div className="flex flex-col gap-2 md:col-span-2 md:flex-row md:items-center md:justify-end">
            {editingEmployee && (
              <Button type="button" variant="ghost" onClick={handleCancelEdit} disabled={isSubmitting}>
                Cancel
              </Button>
            )}
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting
                ? editingEmployee
                  ? "Updating..."
                  : "Saving..."
                : editingEmployee
                  ? "Update employee"
                  : "Save employee"}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
