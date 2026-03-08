import React, { useContext, useMemo, useState } from "react";
import { BadgePercent, Save, CalendarDays } from "lucide-react";
import { PosContext } from "../context/PosContext";
import { currency } from "../utils/format";
import Card from "../components/Card";
import SectionTitle from "../components/SectionTitle";

function getLocalDateInputValue(ts) {
  if (!ts) return "";
  const d = new Date(ts);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function todayInputValue() {
  return getLocalDateInputValue(Date.now());
}
function getMonthKeyFromTs(ts) {
  const d = new Date(ts);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}
function getYearKeyFromTs(ts) {
  return String(new Date(ts).getFullYear());
}

export default function Taxes() {
  const {
    settings,
    taxSettings,
    setTaxSettings,
    savingTaxSettings,
    saveTaxSettings,
    invoices,
    salesReturns,
    purchaseInvoices,
    expenses,
  } = useContext(PosContext);

  const [mode, setMode] = useState("month"); // day | month | year | range
  const [dayDate, setDayDate] = useState(todayInputValue());
  const [monthKey, setMonthKey] = useState(getMonthKeyFromTs(Date.now()));
  const [yearKey, setYearKey] = useState(getYearKeyFromTs(Date.now()));
  const [fromDate, setFromDate] = useState(todayInputValue());
  const [toDate, setToDate] = useState(todayInputValue());

  const inRange = (createdAt) => {
    const d = getLocalDateInputValue(createdAt);
    if (mode === "day") return d === dayDate;
    if (mode === "month") return getMonthKeyFromTs(createdAt) === monthKey;
    if (mode === "year") return getYearKeyFromTs(createdAt) === yearKey;
    if (fromDate && d < fromDate) return false;
    if (toDate && d > toDate) return false;
    return true;
  };

  const filteredInvoices = useMemo(() => {
    return invoices.filter((i) => i.createdAt && inRange(i.createdAt));
  }, [invoices, mode, dayDate, monthKey, yearKey, fromDate, toDate]);

  const filteredReturns = useMemo(() => {
    return salesReturns.filter((r) => r.createdAt && inRange(r.createdAt));
  }, [salesReturns, mode, dayDate, monthKey, yearKey, fromDate, toDate]);

  const filteredPurchases = useMemo(() => {
    return purchaseInvoices.filter((p) => p.createdAt && inRange(p.createdAt));
  }, [purchaseInvoices, mode, dayDate, monthKey, yearKey, fromDate, toDate]);

  // مبيعات إجمالي
  const totalSales = useMemo(() => {
    return filteredInvoices.reduce((sum, i) => sum + Number(i.total || 0), 0);
  }, [filteredInvoices]);

  // المرتجع
  const totalReturns = useMemo(() => {
    return filteredReturns.reduce((sum, r) => sum + Number(r.total || 0), 0);
  }, [filteredReturns]);

  // مبيعات خاضعة للضريبة (صافي)
  const taxableSales = useMemo(() => {
    if (taxSettings.includeReturnsInVAT) return Math.max(0, totalSales - totalReturns);
    return totalSales;
  }, [totalSales, totalReturns, taxSettings.includeReturnsInVAT]);

  // مشتريات إجمالي (subtotal)
  const taxablePurchases = useMemo(() => {
    return filteredPurchases.reduce((sum, p) => sum + Number(p.subtotal || p.total || 0), 0);
  }, [filteredPurchases]);

  const vatSalesRate = Number(taxSettings.vatSalesRate || 0) / 100;
  const vatPurchaseRate = Number(taxSettings.vatPurchaseRate || 0) / 100;

  const outputVAT = useMemo(() => taxableSales * vatSalesRate, [taxableSales, vatSalesRate]);
  const inputVAT = useMemo(() => taxablePurchases * vatPurchaseRate, [taxablePurchases, vatPurchaseRate]);

  const netVAT = useMemo(() => outputVAT - inputVAT, [outputVAT, inputVAT]);

  // دمغة (على المبيعات افتراضيًا كنسبة)
  const stampDuty = useMemo(() => {
    const r = Number(taxSettings.stampDutyRate || 0) / 100;
    return taxableSales * r;
  }, [taxableSales, taxSettings.stampDutyRate]);

  // ضريبة دخل (تقديرية) - ممكن نخليها على (صافي الربح)
  // صافي الربح التقريبي هنا = صافي المبيعات - المشتريات - المصروفات
  const totalExpenses = useMemo(() => {
    return expenses.filter((e) => e.createdAt && inRange(e.createdAt)).reduce((s, e) => s + Number(e.amount || 0), 0);
  }, [expenses, mode, dayDate, monthKey, yearKey, fromDate, toDate]);

  const estimatedProfit = useMemo(() => {
    return taxableSales - taxablePurchases - totalExpenses;
  }, [taxableSales, taxablePurchases, totalExpenses]);

  const incomeTax = useMemo(() => {
    const r = Number(taxSettings.incomeTaxRate || 0) / 100;
    return Math.max(0, estimatedProfit) * r;
  }, [estimatedProfit, taxSettings.incomeTaxRate]);

  const totalTaxDue = useMemo(() => {
    return netVAT + stampDuty + incomeTax;
  }, [netVAT, stampDuty, incomeTax]);

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
      {/* إعدادات */}
      <Card className="xl:col-span-5">
        <SectionTitle
          title="إعدادات الضرائب المصرية"
          subtitle="بيانات التسجيل + نسب الضريبة"
          icon={BadgePercent}
        />

        <div className="space-y-4">
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">اسم المنشأة</label>
            <input
              value={taxSettings.registrationName || ""}
              onChange={(e) => setTaxSettings((s) => ({ ...s, registrationName: e.target.value }))}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">الرقم الضريبي</label>
            <input
              value={taxSettings.taxNumber || ""}
              onChange={(e) => setTaxSettings((s) => ({ ...s, taxNumber: e.target.value }))}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">رقم تسجيل القيمة المضافة (VAT)</label>
            <input
              value={taxSettings.vatRegistrationNumber || ""}
              onChange={(e) => setTaxSettings((s) => ({ ...s, vatRegistrationNumber: e.target.value }))}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">VAT على المبيعات (%)</label>
              <input
                type="number"
                value={taxSettings.vatSalesRate}
                onChange={(e) => setTaxSettings((s) => ({ ...s, vatSalesRate: e.target.value }))}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">VAT على المشتريات (%)</label>
              <input
                type="number"
                value={taxSettings.vatPurchaseRate}
                onChange={(e) => setTaxSettings((s) => ({ ...s, vatPurchaseRate: e.target.value }))}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">الدمغة (%)</label>
              <input
                type="number"
                value={taxSettings.stampDutyRate}
                onChange={(e) => setTaxSettings((s) => ({ ...s, stampDutyRate: e.target.value }))}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">ضريبة الدخل (%) (اختياري)</label>
              <input
                type="number"
                value={taxSettings.incomeTaxRate}
                onChange={(e) => setTaxSettings((s) => ({ ...s, incomeTaxRate: e.target.value }))}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
              />
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={!!taxSettings.includeReturnsInVAT}
              onChange={(e) => setTaxSettings((s) => ({ ...s, includeReturnsInVAT: e.target.checked }))}
            />
            خصم المرتجع من VAT المبيعات
          </label>

          <button
            onClick={saveTaxSettings}
            disabled={savingTaxSettings}
            className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-bold text-white"
          >
            <Save className="h-4 w-4" />
            {savingTaxSettings ? "جاري الحفظ..." : "حفظ إعدادات الضرائب"}
          </button>
        </div>
      </Card>

      {/* التقرير */}
      <Card className="xl:col-span-7">
        <SectionTitle
          title="تقرير الضرائب"
          subtitle="VAT المبيعات/المشتريات + صافي الضريبة المستحقة"
          icon={CalendarDays}
        />

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-12">
          <div className="xl:col-span-3">
            <label className="mb-2 block text-sm font-medium text-slate-700">نوع التقرير</label>
            <select
              value={mode}
              onChange={(e) => setMode(e.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
            >
              <option value="day">يومي</option>
              <option value="month">شهري</option>
              <option value="year">سنوي</option>
              <option value="range">فترة</option>
            </select>
          </div>

          {mode === "day" ? (
            <div className="xl:col-span-3">
              <label className="mb-2 block text-sm font-medium text-slate-700">اليوم</label>
              <input
                type="date"
                value={dayDate}
                onChange={(e) => setDayDate(e.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
              />
            </div>
          ) : null}

          {mode === "month" ? (
            <div className="xl:col-span-3">
              <label className="mb-2 block text-sm font-medium text-slate-700">الشهر</label>
              <input
                type="month"
                value={monthKey}
                onChange={(e) => setMonthKey(e.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
              />
            </div>
          ) : null}

          {mode === "year" ? (
            <div className="xl:col-span-3">
              <label className="mb-2 block text-sm font-medium text-slate-700">السنة</label>
              <input
                type="number"
                value={yearKey}
                onChange={(e) => setYearKey(e.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
              />
            </div>
          ) : null}

          {mode === "range" ? (
            <>
              <div className="xl:col-span-3">
                <label className="mb-2 block text-sm font-medium text-slate-700">من</label>
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
                />
              </div>
              <div className="xl:col-span-3">
                <label className="mb-2 block text-sm font-medium text-slate-700">إلى</label>
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
                />
              </div>
            </>
          ) : null}
        </div>

        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="rounded-2xl bg-slate-50 p-4">
            <p className="text-sm text-slate-500">إجمالي المبيعات (صافي)</p>
            <p className="mt-2 text-2xl font-black">{currency(taxableSales, settings.currencyCode)}</p>
            <p className="mt-2 text-sm text-slate-600">VAT مبيعات (Output): {currency(outputVAT, settings.currencyCode)}</p>
          </div>

          <div className="rounded-2xl bg-slate-50 p-4">
            <p className="text-sm text-slate-500">إجمالي المشتريات</p>
            <p className="mt-2 text-2xl font-black">{currency(taxablePurchases, settings.currencyCode)}</p>
            <p className="mt-2 text-sm text-slate-600">VAT مشتريات (Input): {currency(inputVAT, settings.currencyCode)}</p>
          </div>

          <div className="rounded-2xl bg-amber-50 p-4">
            <p className="text-sm text-amber-700">صافي VAT المستحق</p>
            <p className="mt-2 text-2xl font-black text-amber-700">{currency(netVAT, settings.currencyCode)}</p>
          </div>

          <div className="rounded-2xl bg-red-50 p-4">
            <p className="text-sm text-red-700">الدمغة + ضريبة الدخل (تقديري)</p>
            <p className="mt-2 text-sm text-red-700">دمغة: {currency(stampDuty, settings.currencyCode)}</p>
            <p className="mt-2 text-sm text-red-700">دخل (تقديري): {currency(incomeTax, settings.currencyCode)}</p>
            <p className="mt-3 text-xl font-black text-slate-900">
              إجمالي الضرائب: {currency(totalTaxDue, settings.currencyCode)}
            </p>
          </div>
        </div>

        <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
          <b>ملاحظة:</b> الحسابات هنا تعتمد على نسب عامة. لو عندك أصناف معفاة أو نسب مختلفة، نضيفها لكل منتج/قسم.
        </div>
      </Card>
    </div>
  );
}