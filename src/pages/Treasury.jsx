import React, { useContext, useMemo, useState } from "react";
import { Download, Filter, Plus, Search, Vault } from "lucide-react";
import { PosContext } from "../context/PosContext";
import Card from "../components/Card";
import SectionTitle from "../components/SectionTitle";
import { currency } from "../utils/format";

export default function Treasury() {
  const {
    settings,
    treasuryTransactions,
    treasuryForm,
    setTreasuryForm,
    savingTreasury,
    saveTreasuryTransaction,
    exportTreasuryCsv,
  } = useContext(PosContext);

  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all"); // all | income | expense
  const [methodFilter, setMethodFilter] = useState("all"); // all | cash | wallet | card | transfer | credit
  const [categoryFilter, setCategoryFilter] = useState("all");

  const categories = useMemo(() => {
    const s = new Set();
    treasuryTransactions.forEach((t) => {
      const c = String(t.category || "").trim();
      if (c) s.add(c);
    });
    return Array.from(s).sort((a, b) => a.localeCompare(b, "ar"));
  }, [treasuryTransactions]);

  const filtered = useMemo(() => {
    const q = String(query || "").trim().toLowerCase();

    return treasuryTransactions.filter((t) => {
      const matchesQuery = q
        ? `${t.title || ""} ${t.category || ""} ${t.notes || ""} ${t.paymentMethod || ""}`.toLowerCase().includes(q)
        : true;

      const matchesType = typeFilter === "all" ? true : t.type === typeFilter;
      const matchesMethod = methodFilter === "all" ? true : t.paymentMethod === methodFilter;
      const matchesCategory =
        categoryFilter === "all" ? true : String(t.category || "").trim() === categoryFilter;

      return matchesQuery && matchesType && matchesMethod && matchesCategory;
    });
  }, [treasuryTransactions, query, typeFilter, methodFilter, categoryFilter]);

  const totals = useMemo(() => {
    const income = filtered
      .filter((t) => t.type === "income")
      .reduce((s, t) => s + Number(t.amount || 0), 0);

    const expense = filtered
      .filter((t) => t.type === "expense")
      .reduce((s, t) => s + Number(t.amount || 0), 0);

    return {
      income,
      expense,
      net: income - expense,
      count: filtered.length,
    };
  }, [filtered]);

  const onSave = async () => {
    await saveTreasuryTransaction();
  };

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
      {/* إضافة حركة */}
      <Card className="xl:col-span-4">
        <SectionTitle
          title="إضافة حركة خزينة"
          subtitle="سجل إيراد أو مصروف بسهولة"
          icon={Plus}
        />

        <div className="space-y-4">
          <select
            value={treasuryForm.type}
            onChange={(e) => setTreasuryForm((s) => ({ ...s, type: e.target.value }))}
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
          >
            <option value="income">إيراد</option>
            <option value="expense">مصروف</option>
          </select>

          <input
            value={treasuryForm.title}
            onChange={(e) => setTreasuryForm((s) => ({ ...s, title: e.target.value }))}
            placeholder="عنوان العملية (مثال: إيجار / كهرباء / إيراد إضافي)"
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
          />

          <input
            type="number"
            value={treasuryForm.amount}
            onChange={(e) => setTreasuryForm((s) => ({ ...s, amount: e.target.value }))}
            placeholder="المبلغ"
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
          />

          <select
            value={treasuryForm.paymentMethod}
            onChange={(e) => setTreasuryForm((s) => ({ ...s, paymentMethod: e.target.value }))}
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
          >
            <option value="cash">نقدي</option>
            <option value="wallet">محفظة</option>
            <option value="card">بطاقة</option>
            <option value="transfer">تحويل</option>
            <option value="credit">آجل</option>
          </select>

          <input
            value={treasuryForm.category}
            onChange={(e) => setTreasuryForm((s) => ({ ...s, category: e.target.value }))}
            placeholder="الفئة (مثال: مصروفات تشغيل / إيرادات أخرى)"
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
          />

          <input
            type="date"
            value={treasuryForm.entryDate}
            onChange={(e) => setTreasuryForm((s) => ({ ...s, entryDate: e.target.value }))}
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
          />

          <textarea
            rows={3}
            value={treasuryForm.notes}
            onChange={(e) => setTreasuryForm((s) => ({ ...s, notes: e.target.value }))}
            placeholder="ملاحظات (اختياري)"
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
          />

          <button
            onClick={onSave}
            disabled={savingTreasury}
            className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-bold text-white transition hover:bg-slate-800 disabled:bg-slate-400"
          >
            <Vault className="h-4 w-4" />
            {savingTreasury ? "جاري الحفظ..." : "حفظ الحركة"}
          </button>
        </div>
      </Card>

      {/* تقرير الخزينة */}
      <Card className="xl:col-span-8">
        <SectionTitle
          title="دفتر الخزينة"
          subtitle="بحث + فلترة + إجماليات + تصدير"
          icon={Vault}
          action={
            <button
              onClick={() => exportTreasuryCsv(filtered)}
              className="inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
            >
              <Download className="h-4 w-4" />
              تصدير CSV
            </button>
          }
        />

        {/* Summary */}
        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-4">
          <div className="rounded-2xl bg-emerald-50 p-4">
            <p className="text-sm text-emerald-700">إجمالي الإيرادات</p>
            <p className="mt-2 text-xl font-black text-emerald-800">
              {currency(totals.income, settings.currencyCode)}
            </p>
          </div>
          <div className="rounded-2xl bg-red-50 p-4">
            <p className="text-sm text-red-700">إجمالي المصروفات</p>
            <p className="mt-2 text-xl font-black text-red-800">
              {currency(totals.expense, settings.currencyCode)}
            </p>
          </div>
          <div className="rounded-2xl bg-slate-50 p-4">
            <p className="text-sm text-slate-600">صافي الخزينة</p>
            <p className="mt-2 text-xl font-black text-slate-900">
              {currency(totals.net, settings.currencyCode)}
            </p>
          </div>
          <div className="rounded-2xl bg-slate-50 p-4">
            <p className="text-sm text-slate-600">عدد الحركات</p>
            <p className="mt-2 text-xl font-black text-slate-900">{totals.count}</p>
          </div>
        </div>

        {/* Filters */}
        <div className="mt-5 grid grid-cols-1 gap-4 xl:grid-cols-12">
          <div className="xl:col-span-5">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="بحث (عنوان/فئة/ملاحظات/طريقة دفع)"
                autoComplete="off"
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-4 text-sm outline-none focus:border-slate-400"
              />
            </div>
          </div>

          <div className="xl:col-span-2">
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none"
            >
              <option value="all">الكل</option>
              <option value="income">إيراد</option>
              <option value="expense">مصروف</option>
            </select>
          </div>

          <div className="xl:col-span-2">
            <select
              value={methodFilter}
              onChange={(e) => setMethodFilter(e.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none"
            >
              <option value="all">كل الطرق</option>
              <option value="cash">نقدي</option>
              <option value="wallet">محفظة</option>
              <option value="card">بطاقة</option>
              <option value="transfer">تحويل</option>
              <option value="credit">آجل</option>
            </select>
          </div>

          <div className="xl:col-span-3">
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none"
            >
              <option value="all">كل الفئات</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* List */}
        <div className="mt-5 space-y-3">
          {filtered.map((t) => {
            const isIncome = t.type === "income";
            return (
              <div
                key={t.id}
                className={`rounded-2xl border p-4 ${
                  isIncome ? "border-emerald-200 bg-emerald-50" : "border-red-200 bg-red-50"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-black text-slate-900">
                      {t.title || (isIncome ? "إيراد" : "مصروف")}
                    </p>
                    <p className="mt-1 text-sm text-slate-600">
                      الفئة: <span className="font-bold">{t.category || "—"}</span> • طريقة الدفع:{" "}
                      <span className="font-bold">{t.paymentMethod || "—"}</span>
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {t.createdAt ? new Date(t.createdAt).toLocaleString("ar-EG") : ""}
                    </p>
                    {t.notes ? (
                      <p className="mt-2 text-sm text-slate-700">ملاحظات: {t.notes}</p>
                    ) : null}
                  </div>

                  <div className="text-left">
                    <div
                      className={`rounded-2xl px-4 py-2 text-sm font-black ${
                        isIncome ? "bg-white text-emerald-800" : "bg-white text-red-800"
                      }`}
                    >
                      {currency(t.amount || 0, settings.currencyCode)}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          {filtered.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-slate-500">
              لا توجد حركات مطابقة
            </div>
          ) : null}
        </div>
      </Card>
    </div>
  );
}