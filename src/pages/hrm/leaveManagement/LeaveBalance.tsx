/**
 * Leave Balance — loaded from GET /hrm/leave/balance/all-employees.
 */

import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { HrmBreadcrumb } from "../hrmShared";
import { leaveApi } from "@/services/hrm";
import { toArray } from "@/services/_http";
import { UserRound } from "lucide-react";

type BalanceLine = {
  leave_type_id: string;
  leave_type_name: string;
  max_days_per_year: number;
  used_days: number;
  balance: number;
};

type EmployeeCard = {
  id: string;
  name: string;
  balances: BalanceLine[];
};

function mapEmployeeCard(row: Record<string, unknown>): EmployeeCard {
  const emp = row.employee as Record<string, unknown> | null | undefined;
  const name =
    (emp && typeof emp === "object" ? String(emp.name ?? emp.email ?? "") : "") ||
    String(row.employee_code ?? "Employee");
  const balances = (Array.isArray(row.balances) ? row.balances : []) as Record<string, unknown>[];
  return {
    id: String(row.employee_user_id ?? row.employee_profile_id ?? name),
    name,
    balances: balances.map((b) => ({
      leave_type_id: String(b.leave_type_id ?? ""),
      leave_type_name: String(b.leave_type_name ?? ""),
      max_days_per_year: Number(b.max_days_per_year ?? 0),
      used_days: Number(b.used_days ?? 0),
      balance: Number(b.balance ?? 0),
    })),
  };
}

export const LeaveBalance: React.FC = () => {
  const navigate = useNavigate();
  const [cards, setCards] = useState<EmployeeCard[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const payload = await leaveApi.balanceAllEmployees();
        const rows = toArray(payload).map((r) => mapEmployeeCard(r as Record<string, unknown>));
        if (!cancelled) setCards(rows);
      } catch {
        if (!cancelled) setCards([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="module-page-shell overflow-y-auto">
      <HrmBreadcrumb trail={[{ label: "Dashboard", to: "/" }, { label: "HRM" }]} current="Leave Balance" onNavigate={navigate} />

      <div className="px-4 sm:px-6 py-4">
        <h2 className="text-lg font-semibold text-gray-900">Leave Balance</h2>
      </div>

      <div className="px-4 sm:px-6 pb-8 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-5">
        {loading && (
          <div className="col-span-full py-12 text-center text-gray-500">Loading leave balances…</div>
        )}
        {!loading &&
          cards.map((emp) => (
            <div key={emp.id} className="bg-white border border-gray-200 rounded-xl p-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
                  <UserRound className="w-5 h-5 text-blue-600" />
                </div>
                <h3 className="text-base font-semibold text-gray-900">{emp.name}</h3>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-gray-500 border-b border-gray-100">
                    <th className="text-left font-medium pb-2">Leave Type</th>
                    <th className="text-right font-medium pb-2">Total</th>
                    <th className="text-right font-medium pb-2">Used</th>
                    <th className="text-right font-medium pb-2">Available</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {emp.balances.map((t) => (
                    <tr key={t.leave_type_id || t.leave_type_name} className="odd:bg-gray-50/50">
                      <td className="py-2.5 pr-2 text-gray-700">{t.leave_type_name}</td>
                      <td className="py-2.5 text-right text-gray-900">{t.max_days_per_year}</td>
                      <td className={`py-2.5 text-right font-medium ${t.used_days > 0 ? "text-red-500" : "text-red-400"}`}>{t.used_days}</td>
                      <td className="py-2.5 text-right font-semibold text-blue-600">{Math.max(0, t.balance)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {emp.balances.length === 0 && (
                <p className="text-sm text-gray-500 text-center py-4">No leave types configured.</p>
              )}
            </div>
          ))}
        {!loading && cards.length === 0 && (
          <div className="col-span-full py-12 text-center text-gray-500">No employees found.</div>
        )}
      </div>
    </div>
  );
};
