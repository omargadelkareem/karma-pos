import React, { useContext, useMemo, useState } from "react";
import { Users2, Save, Wallet, MinusCircle, PlusCircle, HandCoins, Search } from "lucide-react";
import { PosContext } from "../context/PosContext";
import { currency } from "../utils/format";
import Card from "../components/Card";
import SectionTitle from "../components/SectionTitle";

function monthInputValue() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function typeLabel(t) {
  if (t === "deduction") return "خصم";
  if (t === "bonus") return "إضافة";
  if (t === "advance") return "سلفة";
  return t;
}

export default function Employees() {
  const {
    settings,
    employees,
    employeeForm,
    setEmployeeForm,
    savingEmployee,
    saveEmployee,
    addEmployeeTransaction,
    getEmployeeLedger,
    totalMonthlySalaries,
    netCurrentMonthPayroll,
    currentMonthTxTotals,
  } = useContext(PosContext);

  const [query, setQuery] = useState("");
  const [expandedId, setExpandedId] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState(monthInputValue());

  const [txType, setTxType] = useState("deduction");
  const [txAmount, setTxAmount] = useState("");
  const [txNotes, setTxNotes] = useState("");

  const filteredEmployees = useMemo(() => {
    const q = String(query || "").trim().toLowerCase();
    if (!q) return employees;
    return employees.filter((e) =>
      `${e.name || ""} ${e.phone || ""} ${e.roleTitle || ""}`.toLowerCase().includes(q)
    );
  }, [employees, query]);

  const toggle = (id) => {
    setExpandedId((p) => (p === id ? null : id));
    setTxAmount("");
    setTxNotes("");
    setTxType("deduction");
  };

  const handleAddTx = async (emp) => {
    await addEmployeeTransaction({
      employeeId: emp.id,
      employeeName: emp.name,
      type: txType,
      amount: txAmount,
      notes: txNotes,
    });
    setTxAmount("");
    setTxNotes("");
  };

  const monthLedger = (empId) => getEmployeeLedger(empId, selectedMonth);

  const calcNetForEmployee = (emp) => {
    const list = monthLedger(emp.id);
    const bonus = list.filter((t) => t.type === "bonus").reduce((s, t) => s + Number(t.amount || 0), 0);
    const deduction = list.filter((t) => t.type === "deduction").reduce((s, t) => s + Number(t.amount || 0), 0);
    const advance = list.filter((t) => t.type === "advance").reduce((s, t) => s + Number(t.amount || 0), 0);
    return Number(emp.monthlySalary || 0) + bonus - deduction - advance;
  };

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
      <Card className="xl:col-span-4">
        <SectionTitle title="إضافة موظف" subtitle="بيانات الموظف والمرتب الشهري" icon={Users2} />

        <div className="space-y-4">
          <input
            value={employeeForm.name}
            onChange={(e) => setEmployeeForm((s) => ({ ...s, name: e.target.value }))}
            placeholder="اسم الموظف"
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
          />

          <input
            value={employeeForm.phone}
            onChange={(e) => setEmployeeForm((s) => ({ ...s, phone: e.target.value }))}
            placeholder="رقم الهاتف"
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
          />

          <input
            value={employeeForm.roleTitle}
            onChange={(e) => setEmployeeForm((s) => ({ ...s, roleTitle: e.target.value }))}
            placeholder="الوظيفة (كاشير / مخزن / ...)"
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
          />

          <input
            type="number"
            value={employeeForm.monthlySalary}
            onChange={(e) => setEmployeeForm((s) => ({ ...s, monthlySalary: e.target.value }))}
            placeholder="المرتب الشهري"
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
          />

          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={!!employeeForm.isActive}
              onChange={(e) => setEmployeeForm((s) => ({ ...s, isActive: e.target.checked }))}
            />
            موظف نشط
          </label>

          <button
            onClick={saveEmployee}
            disabled={savingEmployee}
            className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-bold text-white"
          >
            <Save className="h-4 w-4" />
            {savingEmployee ? "جاري الحفظ..." : "حفظ الموظف"}
          </button>
        </div>
      </Card>

      <Card className="xl:col-span-8">
        <SectionTitle
          title="الموظفين والرواتب"
          subtitle="اضغط على موظف لعرض سجل الخصومات والإضافات والسلف"
          icon={Wallet}
          action={
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="بحث باسم الموظف أو الهاتف أو الوظيفة"
              className="w-full max-w-sm rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none"
            />
          }
        />

        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl bg-slate-50 p-4">
            <p className="text-sm text-slate-500">عدد الموظفين</p>
            <p className="mt-2 text-2xl font-black">{employees.length}</p>
          </div>

          <div className="rounded-2xl bg-slate-50 p-4">
            <p className="text-sm text-slate-500">إجمالي الرواتب الشهرية (أساسي)</p>
            <p className="mt-2 text-xl font-black">{currency(totalMonthlySalaries, settings.currencyCode)}</p>
          </div>

          <div className="rounded-2xl bg-red-50 p-4">
            <p className="text-sm text-red-700">خصومات الشهر الحالي</p>
            <p className="mt-2 text-xl font-black text-red-700">
              {currency(currentMonthTxTotals.deduction, settings.currencyCode)}
            </p>
          </div>

          <div className="rounded-2xl bg-emerald-50 p-4">
            <p className="text-sm text-emerald-700">صافي رواتب الشهر الحالي</p>
            <p className="mt-2 text-xl font-black text-emerald-700">
              {currency(netCurrentMonthPayroll, settings.currencyCode)}
            </p>
          </div>
        </div>

        <div className="mt-5">
          <label className="mb-2 block text-sm font-medium text-slate-700">اختيار الشهر</label>
          <input
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="w-full max-w-xs rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
          />
        </div>

        <div className="mt-5 space-y-3">
          {filteredEmployees.map((emp) => {
            const expanded = expandedId === emp.id;
            const ledger = expanded ? monthLedger(emp.id) : [];
            const netSalary = expanded ? calcNetForEmployee(emp) : null;

            return (
              <div key={emp.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                <button
                  type="button"
                  onClick={() => toggle(emp.id)}
                  className="flex w-full items-center justify-between gap-3 px-4 py-4 text-right hover:bg-slate-50"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-slate-900">{emp.name}</p>
                    <p className="text-sm text-slate-500">
                      {emp.roleTitle || "—"} {emp.phone ? `• ${emp.phone}` : ""}
                    </p>
                  </div>
                  <div className="text-left text-sm font-bold text-slate-900">
                    {currency(emp.monthlySalary || 0, settings.currencyCode)}
                  </div>
                </button>

                {expanded ? (
                  <div className="border-t border-slate-200 bg-slate-50 p-4">
                    <div className="rounded-2xl bg-white p-4">
                      <p className="font-black">تسجيل عملية للموظف</p>

                      <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
                        <select
                          value={txType}
                          onChange={(e) => setTxType(e.target.value)}
                          className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
                        >
                          <option value="deduction">خصم</option>
                          <option value="bonus">إضافة</option>
                          <option value="advance">سلفة</option>
                        </select>

                        <input
                          type="number"
                          value={txAmount}
                          onChange={(e) => setTxAmount(e.target.value)}
                          placeholder="المبلغ"
                          className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
                        />

                        <input
                          value={txNotes}
                          onChange={(e) => setTxNotes(e.target.value)}
                          placeholder="ملاحظات"
                          className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
                        />
                      </div>

                      <button
                        onClick={() => handleAddTx(emp)}
                        className="mt-4 inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-bold text-white"
                      >
                        {txType === "deduction" ? <MinusCircle className="h-4 w-4" /> : null}
                        {txType === "bonus" ? <PlusCircle className="h-4 w-4" /> : null}
                        {txType === "advance" ? <HandCoins className="h-4 w-4" /> : null}
                        حفظ العملية
                      </button>
                    </div>

                    <div className="mt-4 rounded-2xl bg-white p-4">
                      <div className="flex items-center justify-between">
                        <p className="font-black">سجل الشهر</p>
                        <p className="font-black text-emerald-700">
                          صافي هذا الشهر: {currency(netSalary || 0, settings.currencyCode)}
                        </p>
                      </div>

                      <div className="mt-3 space-y-3">
                        {ledger.map((t) => (
                          <div key={t.id} className="rounded-2xl bg-slate-50 p-4">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="font-bold">{typeLabel(t.type)}</p>
                                <p className="text-xs text-slate-500">
                                  {t.createdAt ? new Date(t.createdAt).toLocaleString("ar-EG") : ""}
                                </p>
                                {t.notes ? <p className="mt-2 text-sm text-slate-600">{t.notes}</p> : null}
                              </div>
                              <div className={`font-black ${t.type === "bonus" ? "text-emerald-700" : "text-red-700"}`}>
                                {currency(t.amount || 0, settings.currencyCode)}
                              </div>
                            </div>
                          </div>
                        ))}

                        {ledger.length === 0 ? (
                          <div className="rounded-2xl border border-dashed border-slate-300 p-6 text-center text-slate-500">
                            لا توجد عمليات لهذا الشهر
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })}

          {filteredEmployees.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-slate-500">
              لا يوجد موظفون مطابقون
            </div>
          ) : null}
        </div>
      </Card>
    </div>
  );
}