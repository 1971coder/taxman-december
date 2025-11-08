import { useMemo, useState } from "react";

import { Button } from "../../components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { Label } from "../../components/ui/label";
import { Select } from "../../components/ui/select";

const months = [
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun"
];

export default function ReportsPage() {
  const [frequency, setFrequency] = useState<"monthly" | "quarterly">("monthly");
  const periods = useMemo(() => buildPeriods(frequency), [frequency]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>BAS Worksheet</CardTitle>
        <CardDescription>FY helper will reuse backend generator.</CardDescription>
      </CardHeader>
      <div className="grid gap-4 md:grid-cols-3">
        <div className="space-y-2">
          <Label>Frequency</Label>
          <Select value={frequency} onChange={(event) => setFrequency(event.target.value as typeof frequency)}>
            <option value="monthly">Monthly</option>
            <option value="quarterly">Quarterly</option>
          </Select>
        </div>
        <div className="space-y-2 md:col-span-2">
          <Label>Period</Label>
          <Select>
            {periods.map((period) => (
              <option key={period} value={period}>
                {period}
              </option>
            ))}
          </Select>
        </div>
      </div>
      <div className="mt-4 flex gap-2">
        <Button>Compute BAS</Button>
        <Button variant="outline">Export CSV</Button>
      </div>
    </Card>
  );
}

function buildPeriods(frequency: "monthly" | "quarterly") {
  if (frequency === "monthly") {
    return months.map((month, idx) => `${month} FY 2025-${(26).toString().slice(-2)}`);
  }
  return ["Q1 FY 2025-26", "Q2 FY 2025-26", "Q3 FY 2025-26", "Q4 FY 2025-26"];
}
