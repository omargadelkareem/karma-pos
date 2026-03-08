import React, { useContext, useMemo, useState } from "react";
import {
  HandCoins,
  Save,
  Search,
  Download,
  CalendarDays,
  CircleDollarSign,
  FileText,
} from "lucide-react";
import { PosContext } from "../context/PosContext";
import { currency } from "../utils/format";
import Card from "../components/Card";
import SectionTitle from "../components/SectionTitle";

function getLocalDateInputValue(timestamp) {
  if (!timestamp) return "";
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function todayInputValue() {
  return getLocalDateInputValue(Date.now());
}

export default function Expenses() {
  const {
    settings,
    expenses,
    expenseForm,
    setExpenseForm,
    savingExpense,
    saveExpense,
    exportExpensesCsv,
    totalExpenses,
    todayExpenses,
    currentMonthExpenses,
  } = useContext(PosContext);

  const [query, setQuery] = useState("");
  const [fromDate, setFromDate] = useState(todayInputValue());
  const [toDate, setToDate] = useState(todayInputValue());

  const filteredExpenses = useMemo(() => {
    const q = String(query || "").trim().toLowerCase();

    return expenses.filter((item) => {
      const itemDate = getLocalDateInputValue(item.createdAt);

      const matchesDate =
        (!fromDate || itemDate >= fromDate) &&
        (!toDate || itemDate <= toDate);

      const matchesQuery = q
        ? `${item.title || ""} ${item.category || ""} ${item.notes || ""} ${item.createdBy || ""}`
            .toLowerCase()
            .includes(q)
        : true;

      return matchesDate && matchesQuery;
    });
  }, [expenses, query, fromDate, toDate]);

  const filteredExpensesTotal = useMemo(() => {
    return filteredExpenses.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  }, [filteredExpenses]);

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
      <Card className="xl:col-span-4">
        <SectionTitle
          title="إضافة مصروف"
          subtitle="سجل أي مصروف يومي أو شهري"
          icon={HandCoins}
        />

        <div className="space-y-4">
          <input
            value={expenseForm.title}
            onChange={(e) => setExpenseForm((s) => ({ ...s, title: e.target.value }))}
            placeholder="اسم المصروف"
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
          />

          <input
            value={expenseForm.category}
            onChange={(e) => setExpenseForm((s) => ({ ...s, category: e.target.value }))}
            placeholder="التصنيف (مثل: كهرباء / إيجار / مرتبات)"
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
          />

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <input
              type="number"
              value={expenseForm.amount}
              onChange={(e) => setExpenseForm((s) => ({ ...s, amount: e.target.value }))}
              placeholder="المبلغ"
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
            />

            <input
              type="date"
              value={expenseForm.expenseDate}
              onChange={(e) => setExpenseForm((s) => ({ ...s, expenseDate: e.target.value }))}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
            />
          </div>

          <textarea
            rows={4}
            value={expenseForm.notes}
            onChange={(e) => setExpenseForm((s) => ({ ...s, notes: e.target.value }))}
            placeholder="ملاحظات"
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
          />

          <button
            onClick={saveExpense}
            disabled={savingExpense}
            className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-bold text-white"
          >
            <Save className="h-4 w-4" />
            {savingExpense ? "جاري الحفظ..." : "حفظ المصروف"}
          </button>
        </div>
      </Card>

      <Card className="xl:col-span-8">
        <SectionTitle
          title="المصروفات"
          subtitle="بحث وفلترة وتصدير جدول المصروفات"
          icon={FileText}
          action={
            <button
              onClick={() => exportExpensesCsv(filteredExpenses)}
              className="inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              <Download className="h-4 w-4" />
              تصدير Excel
            </button>
          }
        />

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl bg-slate-50 p-4">
            <div className="flex items-center gap-2 text-slate-500">
              <CircleDollarSign className="h-4 w-4" />
              <span className="text-sm">إجمالي المصروفات</span>
            </div>
            <p className="mt-2 text-xl font-black text-slate-900">
              {currency(totalExpenses, settings.currencyCode)}
            </p>
          </div>

          <div className="rounded-2xl bg-slate-50 p-4">
            <div className="flex items-center gap-2 text-slate-500">
              <FileText className="h-4 w-4" />
              <span className="text-sm">عدد المصروفات</span>
            </div>
            <p className="mt-2 text-2xl font-black text-slate-900">{expenses.length}</p>
          </div>

          <div className="rounded-2xl bg-amber-50 p-4">
            <div className="flex items-center gap-2 text-amber-700">
              <CalendarDays className="h-4 w-4" />
              <span className="text-sm">مصروفات اليوم</span>
            </div>
            <p className="mt-2 text-xl font-black text-amber-700">
              {currency(todayExpenses, settings.currencyCode)}
            </p>
          </div>

          <div className="rounded-2xl bg-emerald-50 p-4">
            <div className="flex items-center gap-2 text-emerald-700">
              <CalendarDays className="h-4 w-4" />
              <span className="text-sm">مصروفات الشهر</span>
            </div>
            <p className="mt-2 text-xl font-black text-emerald-700">
              {currency(currentMonthExpenses, settings.currencyCode)}
            </p>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-4 xl:grid-cols-12">
          <div className="xl:col-span-3">
            <label className="mb-2 block text-sm font-medium text-slate-700">من تاريخ</label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
            />
          </div>

          <div className="xl:col-span-3">
            <label className="mb-2 block text-sm font-medium text-slate-700">إلى تاريخ</label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
            />
          </div>

          <div className="xl:col-span-6">
            <label className="mb-2 block text-sm font-medium text-slate-700">بحث</label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="ابحث باسم المصروف أو التصنيف أو الملاحظات"
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-4 outline-none"
              />
            </div>
          </div>
        </div>

        <div className="mt-5 rounded-2xl bg-slate-950 p-4 text-white">
          <p className="text-sm text-slate-300">إجمالي المصروفات حسب الفلاتر الحالية</p>
          <p className="mt-1 text-2xl font-black">
            {currency(filteredExpensesTotal, settings.currencyCode)}
          </p>
        </div>

        <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200">
          <div className="overflow-x-auto">
            <table className="min-w-full bg-white text-sm">
              <thead className="bg-slate-100 text-slate-700">
                <tr>
                  <th className="px-4 py-3 text-right">التاريخ</th>
                  <th className="px-4 py-3 text-right">اسم المصروف</th>
                  <th className="px-4 py-3 text-right">التصنيف</th>
                  <th className="px-4 py-3 text-right">المبلغ</th>
                  <th className="px-4 py-3 text-right">الملاحظات</th>
                  <th className="px-4 py-3 text-right">تم بواسطة</th>
                </tr>
              </thead>
              <tbody>
                {filteredExpenses.map((item) => (
                  <tr key={item.id} className="border-t border-slate-100">
                    <td className="px-4 py-3">
                      {item.createdAt ? new Date(item.createdAt).toLocaleString("ar-EG") : ""}
                    </td>
                    <td className="px-4 py-3 font-semibold text-slate-900">{item.title}</td>
                    <td className="px-4 py-3">{item.category || "—"}</td>
                    <td className="px-4 py-3 font-bold text-red-700">
                      {currency(item.amount, settings.currencyCode)}
                    </td>
                    <td className="px-4 py-3">{item.notes || "—"}</td>
                    <td className="px-4 py-3">{item.createdBy || "—"}</td>
                  </tr>
                ))}

                {filteredExpenses.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="px-4 py-8 text-center text-slate-500">
                      لا توجد مصروفات مطابقة
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      </Card>
    </div>
  );
}