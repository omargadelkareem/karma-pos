    import React, { useContext, useMemo, useState } from "react";
import { Search, Wallet, Download, Receipt, CheckCircle2 } from "lucide-react";
import { PosContext } from "../context/PosContext";
import Card from "../components/Card";
import SectionTitle from "../components/SectionTitle";
import { currency, numberFormat } from "../utils/format";

function dateKeyFromTs(ts) {
  if (!ts) return "";
  return new Date(ts).toISOString().slice(0, 10);
}

export default function CreditSales() {
  const {
    settings,
    customers,
    invoices,
    creditStats,
    payCreditInstallment,
    exportCreditInvoicesCsv,
  } = useContext(PosContext);

  const [query, setQuery] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  // نافذة سداد دفعة
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [payAmount, setPayAmount] = useState("");
  const [payNotes, setPayNotes] = useState("");

  const creditInvoices = useMemo(() => {
    // عرض فواتير فيها متبقي (آجل/جزئي)
    return (invoices || []).filter((inv) => Number(inv.remainingAmount || 0) > 0);
  }, [invoices]);

  const filtered = useMemo(() => {
    const q = String(query || "").trim().toLowerCase();

    return creditInvoices.filter((inv) => {
      const matchesQuery = q
        ? `${inv.invoiceNumber || ""} ${inv.customerName || ""} ${inv.cashierName || ""}`
            .toLowerCase()
            .includes(q)
        : true;

      const invDate = inv.createdAt ? dateKeyFromTs(inv.createdAt) : "";

      const matchesFrom = fromDate ? invDate >= fromDate : true;
      const matchesTo = toDate ? invDate <= toDate : true;

      return matchesQuery && matchesFrom && matchesTo;
    });
  }, [creditInvoices, query, fromDate, toDate]);

  const handleOpenPay = (invoice) => {
    setSelectedInvoice(invoice);
    setPayAmount("");
    setPayNotes("");
  };

  const handleSavePay = async () => {
    if (!selectedInvoice) return;
    await payCreditInstallment(selectedInvoice.id, payAmount, payNotes);

    // اقفل النافذة
    setSelectedInvoice(null);
    setPayAmount("");
    setPayNotes("");
    setPayNotes("");
  };

  return (
    <div className="space-y-6">
      {/* إحصائيات */}
      <Card>
        <SectionTitle
          title="إدارة البيع الآجل"
          subtitle="متابعة الديون + تحصيل دفعات + تقارير سريعة"
          icon={Wallet}
          action={
            <button
              onClick={() => exportCreditInvoicesCsv(filtered)}
              className="inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              <Download className="h-4 w-4" />
              تصدير CSV
            </button>
          }
        />

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl bg-slate-50 p-4">
            <p className="text-sm text-slate-500">إجمالي البيع الآجل</p>
            <p className="mt-2 text-2xl font-black text-slate-900">
              {currency(creditStats.totalCreditSales, settings.currencyCode)}
            </p>
          </div>

          <div className="rounded-2xl bg-slate-50 p-4">
            <p className="text-sm text-slate-500">عدد العملاء (عليهم)</p>
            <p className="mt-2 text-2xl font-black text-slate-900">
              {numberFormat(creditStats.creditCustomersCount)}
            </p>
          </div>

          <div className="rounded-2xl bg-red-50 p-4">
            <p className="text-sm text-red-700">الأموال المستحقة (المتبقي)</p>
            <p className="mt-2 text-2xl font-black text-red-700">
              {currency(creditStats.totalOutstanding, settings.currencyCode)}
            </p>
          </div>

          <div className="rounded-2xl bg-emerald-50 p-4">
            <p className="text-sm text-emerald-700">الأموال المحصلة (المدفوع)</p>
            <p className="mt-2 text-2xl font-black text-emerald-700">
              {currency(creditStats.totalCollected, settings.currencyCode)}
            </p>
          </div>
        </div>
      </Card>

      {/* بحث + فلاتر */}
      <Card>
        <SectionTitle
          title="فواتير الآجل"
          subtitle="ابحث وفلتر بالتاريخ ثم حصّل دفعة"
          icon={Receipt}
        />

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
          <div className="xl:col-span-6">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="بحث برقم الفاتورة / اسم العميل / اسم الكاشير"
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-4 text-sm outline-none"
              />
            </div>
          </div>

          <div className="xl:col-span-3">
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none"
              placeholder="من"
            />
          </div>

          <div className="xl:col-span-3">
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none"
              placeholder="إلى"
            />
          </div>
        </div>

        <div className="mt-5 space-y-3">
          {filtered.map((inv) => (
            <div key={inv.id} className="rounded-3xl border border-slate-200 bg-white p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <p className="text-lg font-black text-slate-900">{inv.invoiceNumber}</p>
                  <p className="text-sm text-slate-500">
                    العميل: <span className="font-bold text-slate-800">{inv.customerName || "—"}</span>
                  </p>
                  <p className="text-xs text-slate-500">
                    {inv.createdAt ? new Date(inv.createdAt).toLocaleString("ar-EG") : ""}
                  </p>
                </div>

                <div className="text-sm md:text-left">
                  <p>الإجمالي: {currency(inv.total || 0, settings.currencyCode)}</p>
                  <p className="text-emerald-700 font-bold">
                    المدفوع: {currency(inv.paidAmount || 0, settings.currencyCode)}
                  </p>
                  <p className="text-red-700 font-bold">
                    المتبقي: {currency(inv.remainingAmount || 0, settings.currencyCode)}
                  </p>

                  <button
                    onClick={() => handleOpenPay(inv)}
                    className="mt-3 inline-flex items-center gap-2 rounded-2xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-700"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    تحصيل دفعة
                  </button>
                </div>
              </div>
            </div>
          ))}

          {filtered.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-slate-500">
              لا توجد فواتير آجل مطابقة
            </div>
          ) : null}
        </div>
      </Card>

      {/* نافذة تحصيل دفعة */}
      {selectedInvoice ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-xl rounded-[28px] bg-white p-6 shadow-2xl">
            <h3 className="text-xl font-black text-slate-900">تحصيل دفعة</h3>
            <p className="mt-1 text-sm text-slate-500">
              {selectedInvoice.invoiceNumber} • {selectedInvoice.customerName || "—"}
            </p>

            <div className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm">
              <div className="flex items-center justify-between">
                <span>إجمالي الفاتورة</span>
                <span className="font-bold">{currency(selectedInvoice.total, settings.currencyCode)}</span>
              </div>
              <div className="mt-2 flex items-center justify-between">
                <span>المدفوع</span>
                <span className="font-bold text-emerald-700">{currency(selectedInvoice.paidAmount, settings.currencyCode)}</span>
              </div>
              <div className="mt-2 flex items-center justify-between">
                <span>المتبقي</span>
                <span className="font-bold text-red-700">{currency(selectedInvoice.remainingAmount, settings.currencyCode)}</span>
              </div>
            </div>

            <div className="mt-4 space-y-3">
              <input
                type="number"
                value={payAmount}
                onChange={(e) => setPayAmount(e.target.value)}
                placeholder="قيمة الدفعة"
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
              />

              <input
                value={payNotes}
                onChange={(e) => setPayNotes(e.target.value)}
                placeholder="ملاحظات (اختياري)"
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
              />

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <button
                  onClick={handleSavePay}
                  className="rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white hover:bg-emerald-700"
                >
                  حفظ الدفعة
                </button>

                <button
                  onClick={() => setSelectedInvoice(null)}
                  className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-700 hover:bg-slate-100"
                >
                  إلغاء
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}