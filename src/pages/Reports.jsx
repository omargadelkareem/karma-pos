import React, { useContext, useMemo, useState } from "react";
import { BarChart3, CalendarDays } from "lucide-react";
import { PosContext } from "../context/PosContext";
import { currency } from "../utils/format";
import Card from "../components/Card";
import SectionTitle from "../components/SectionTitle";

function getLocalDateInputValue(timestamp) {
  if (!timestamp) return "";
  const d = new Date(timestamp);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function getMonthKeyFromTs(ts) {
  const d = new Date(ts);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function getYearKeyFromTs(ts) {
  const d = new Date(ts);
  return String(d.getFullYear());
}

function todayInputValue() {
  return getLocalDateInputValue(Date.now());
}

export default function Reports() {
  const { settings, invoices, salesReturns, purchaseInvoices, expenses } = useContext(PosContext);

  // modes: day | month | year | range
  const [mode, setMode] = useState("day");

  const [dayDate, setDayDate] = useState(todayInputValue());

  const [monthKey, setMonthKey] = useState(getMonthKeyFromTs(Date.now())); // YYYY-MM
  const [yearKey, setYearKey] = useState(getYearKeyFromTs(Date.now())); // YYYY

  const [fromDate, setFromDate] = useState(todayInputValue());
  const [toDate, setToDate] = useState(todayInputValue());

  const inRange = (createdAt) => {
    const d = getLocalDateInputValue(createdAt);

    if (mode === "day") return d === dayDate;
    if (mode === "month") return getMonthKeyFromTs(createdAt) === monthKey;
    if (mode === "year") return getYearKeyFromTs(createdAt) === yearKey;

    // range
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

  const filteredExpenses = useMemo(() => {
    return expenses.filter((e) => e.createdAt && inRange(e.createdAt));
  }, [expenses, mode, dayDate, monthKey, yearKey, fromDate, toDate]);

  const totalSales = useMemo(() => {
    return filteredInvoices.reduce((sum, i) => sum + Number(i.total || 0), 0);
  }, [filteredInvoices]);

  const totalReturns = useMemo(() => {
    return filteredReturns.reduce((sum, r) => sum + Number(r.total || 0), 0);
  }, [filteredReturns]);

  const netSales = useMemo(() => totalSales - totalReturns, [totalSales, totalReturns]);

  const totalPurchases = useMemo(() => {
    return filteredPurchases.reduce((sum, p) => sum + Number(p.subtotal || p.total || 0), 0);
  }, [filteredPurchases]);

  const totalExpenses = useMemo(() => {
    return filteredExpenses.reduce((sum, e) => sum + Number(e.amount || 0), 0);
  }, [filteredExpenses]);

  // بيع آجل = إجمالي المتبقي في الفواتير (remainingAmount)
  const totalCreditSales = useMemo(() => {
    return filteredInvoices.reduce((sum, i) => sum + Number(i.remainingAmount || 0), 0);
  }, [filteredInvoices]);

  // تكلفة المبيعات (تقريبية): نجمع purchasePackagePrice/ purchaseItemPrice من المنتج وقت حفظ الفاتورة
  // بما إن الفاتورة فيها unitPrice بيع، لكن مش فيها cost، هنحسب cost من current product prices
  // (تقريبي) — الأفضل لاحقًا نحفظ cost داخل الفاتورة وقت البيع.
  const estimatedCOGS = useMemo(() => {
    // لو ما عندك products في context هنا، هنكتفي بتقدير صفر
    // لو حابب نحسبها بدقة، قولّي وأضيف products من PosContext داخل Reports.
    return 0;
  }, []);

  // صافي الربح (تقريبي)
  const netProfit = useMemo(() => {
    // حاليا بدون COGS دقيقة => صافي = صافي المبيعات - المصروفات - المشتريات (كمقياس عام)
    return netSales - totalPurchases - totalExpenses;
  }, [netSales, totalPurchases, totalExpenses]);

  const titleSubtitle = useMemo(() => {
    if (mode === "day") return `تقرير يوم: ${dayDate}`;
    if (mode === "month") return `تقرير شهر: ${monthKey}`;
    if (mode === "year") return `تقرير سنة: ${yearKey}`;
    return `تقرير فترة: ${fromDate || "—"} إلى ${toDate || "—"}`;
  }, [mode, dayDate, monthKey, yearKey, fromDate, toDate]);

  return (
    <div className="space-y-6">
      <Card>
        <SectionTitle title="التقارير" subtitle={titleSubtitle} icon={BarChart3} />

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
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
              <option value="range">فترة (من/إلى)</option>
            </select>
          </div>

          {mode === "day" ? (
            <div className="xl:col-span-3">
              <label className="mb-2 block text-sm font-medium text-slate-700">اختر اليوم</label>
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
              <label className="mb-2 block text-sm font-medium text-slate-700">اختر الشهر</label>
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
              <label className="mb-2 block text-sm font-medium text-slate-700">اختر السنة</label>
              <input
                type="number"
                value={yearKey}
                onChange={(e) => setYearKey(e.target.value)}
                placeholder="2026"
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
              />
            </div>
          ) : null}

          {mode === "range" ? (
            <>
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
            </>
          ) : null}

          <div className="xl:col-span-3 xl:col-start-10">
            <div className="rounded-2xl bg-slate-50 p-4">
              <div className="flex items-center gap-2 text-slate-500">
                <CalendarDays className="h-4 w-4" />
                <span className="text-sm">عدد الفواتير</span>
              </div>
              <p className="mt-2 text-2xl font-black">{filteredInvoices.length}</p>
            </div>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
        <Card>
          <SectionTitle title="إجمالي المبيعات" subtitle="مجموع فواتير البيع" icon={BarChart3} />
          <p className="text-3xl font-black text-slate-900">
            {currency(totalSales, settings.currencyCode)}
          </p>
          <p className="mt-2 text-sm text-slate-500">
            صافي بعد المرتجع: {currency(netSales, settings.currencyCode)}
          </p>
        </Card>

        <Card>
          <SectionTitle title="إجمالي المرتجع" subtitle="مرتجع فواتير البيع" icon={BarChart3} />
          <p className="text-3xl font-black text-red-700">
            {currency(totalReturns, settings.currencyCode)}
          </p>
        </Card>

        <Card>
          <SectionTitle title="إجمالي البيع الآجل" subtitle="إجمالي المتبقي على العملاء" icon={BarChart3} />
          <p className="text-3xl font-black text-amber-700">
            {currency(totalCreditSales, settings.currencyCode)}
          </p>
        </Card>

        <Card>
          <SectionTitle title="إجمالي المشتريات" subtitle="فواتير الشراء" icon={BarChart3} />
          <p className="text-3xl font-black text-slate-900">
            {currency(totalPurchases, settings.currencyCode)}
          </p>
          <p className="mt-2 text-sm text-slate-500">
            عدد فواتير الشراء: {filteredPurchases.length}
          </p>
        </Card>

        <Card>
          <SectionTitle title="إجمالي المصروفات" subtitle="مصروفات المحل" icon={BarChart3} />
          <p className="text-3xl font-black text-red-700">
            {currency(totalExpenses, settings.currencyCode)}
          </p>
          <p className="mt-2 text-sm text-slate-500">
            عدد المصروفات: {filteredExpenses.length}
          </p>
        </Card>

        <Card>
          <SectionTitle title="صافي الربح (تقريبي)" subtitle="صافي المبيعات - المشتريات - المصروفات" icon={BarChart3} />
          <p className="text-3xl font-black text-emerald-700">
            {currency(netProfit, settings.currencyCode)}
          </p>
         
        </Card>
      </div>
    </div>
  );
}