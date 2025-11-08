import { NavLink, Navigate, Route, Routes } from "react-router-dom";

import ClientsPage from "./pages/clients";
import DashboardPage from "./pages/dashboard";
import EmployeesPage from "./pages/employees";
import ExpensesPage from "./pages/expenses";
import InvoicesPage from "./pages/invoices";
import ReportsPage from "./pages/reports";
import SettingsPage from "./pages/settings";

const navItems = [
  { to: "/dashboard", label: "Dashboard" },
  { to: "/clients", label: "Clients" },
  { to: "/employees", label: "Employees" },
  { to: "/invoices", label: "Invoices" },
  { to: "/expenses", label: "Expenses" },
  { to: "/reports", label: "Reports" },
  { to: "/settings", label: "Settings" }
];

function App() {
  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-400">Offline BAS + Invoicing</p>
            <h1 className="text-xl font-semibold">Taxman Manager</h1>
          </div>
          <nav className="flex gap-4 text-sm">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `rounded-full px-3 py-1 ${
                    isActive ? "bg-slate-900 text-white" : "text-slate-600 hover:text-slate-900"
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-10">
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/clients" element={<ClientsPage />} />
          <Route path="/employees" element={<EmployeesPage />} />
          <Route path="/invoices" element={<InvoicesPage />} />
          <Route path="/expenses" element={<ExpensesPage />} />
          <Route path="/reports" element={<ReportsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;
