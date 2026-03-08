import React, { useContext, useMemo, useState } from "react";
import {
  Save,
  Users,
  Wallet,
  ChevronDown,
  Printer,
  Receipt,
  BadgePlus,
  Search,
  Download,
  MessageCircle,
  FileText,
} from "lucide-react";
import { PosContext } from "../context/PosContext";
import { currency, numberFormat } from "../utils/format";
import Card from "../components/Card";
import SectionTitle from "../components/SectionTitle";
import { downloadCsv } from "../utils/csv";

function toNumber(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function cleanPhone(phone) {
  // تحويل رقم مصري/عام لرقم يصلح ل wa.me
  // مثال: 010xxxx -> 2010xxxx
  const raw = String(phone || "").replace(/[^\d]/g, "");
  if (!raw) return "";
  if (raw.startsWith("00")) return raw.slice(2);
  if (raw.startsWith("0")) return `20${raw.slice(1)}`; // مصر
  if (raw.startsWith("2")) return raw; // already country-like
  return raw;
}

function openWhatsApp(phone, message) {
  const p = cleanPhone(phone);
  if (!p) {
    window.alert("لا يوجد رقم هاتف صالح لهذا العميل");
    return;
  }
  const url = `https://wa.me/${p}?text=${encodeURIComponent(message)}`;
  window.open(url, "_blank", "noopener,noreferrer");
}

function formatDate(ts) {
  return ts ? new Date(ts).toLocaleString("ar-EG") : "";
}

export default function Customers() {
  const {
    settings,
    customers,
    customerForm,
    setCustomerForm,
    savingCustomer,
    saveCustomer,
    addCustomerPayment,
    customerBalances,
    getCustomerLedger,
    invoices, // ✅ هنحتاجها للفواتير في الواتساب والتقارير
  } = useContext(PosContext);

  const [expandedCustomerId, setExpandedCustomerId] = useState(null);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentNotes, setPaymentNotes] = useState("");

  const [query, setQuery] = useState("");
  const [filterMode, setFilterMode] = useState("all"); // all | debt | settled

  const selectedCustomer = useMemo(
    () => customers.find((item) => item.id === expandedCustomerId) || null,
    [customers, expandedCustomerId]
  );

  const ledger = useMemo(
    () => (expandedCustomerId ? getCustomerLedger(expandedCustomerId) : []),
    [expandedCustomerId, getCustomerLedger]
  );

  // ✅ إحصائيات
  const totalCustomers = customers.length;

  const totalDebts = useMemo(() => {
    // إجمالي "عليه" (أرصدة موجبة)
    return customers.reduce((sum, c) => {
      const b = toNumber(customerBalances[c.id] || 0);
      return sum + (b > 0 ? b : 0);
    }, 0);
  }, [customers, customerBalances]);

  const totalCredits = useMemo(() => {
    // إجمالي "له" (أرصدة سالبة لو عندك الحالة دي)
    return customers.reduce((sum, c) => {
      const b = toNumber(customerBalances[c.id] || 0);
      return sum + (b < 0 ? Math.abs(b) : 0);
    }, 0);
  }, [customers, customerBalances]);

  // ✅ فلترة + بحث
  const filteredCustomers = useMemo(() => {
    const q = String(query || "").trim().toLowerCase();

    return customers.filter((c) => {
      const balance = toNumber(customerBalances[c.id] || 0);

      if (filterMode === "debt" && balance <= 0) return false;
      if (filterMode === "settled" && balance !== 0) return false;

      if (!q) return true;

      const text = `${c.name || ""} ${c.phone || ""} ${c.address || ""}`.toLowerCase();
      return text.includes(q);
    });
  }, [customers, customerBalances, query, filterMode]);

  const handleToggleCustomer = (customerId) => {
    setExpandedCustomerId((prev) => (prev === customerId ? null : customerId));
    setPaymentAmount("");
    setPaymentNotes("");
  };

  const handleAddPayment = async () => {
    if (!selectedCustomer) return;

    await addCustomerPayment({
      customerId: selectedCustomer.id,
      customerName: selectedCustomer.name,
      amount: paymentAmount,
      notes: paymentNotes,
    });

    setPaymentAmount("");
    setPaymentNotes("");
  };

  // ✅ تصدير تقرير العملاء (CSV Excel)
  const exportCustomersCsv = () => {
    const headers = ["اسم العميل", "رقم الهاتف", "العنوان", "مديونية سابقة", "عليه", "له", "ملاحظات"];

    const rows = filteredCustomers.map((c) => {
      const b = toNumber(customerBalances[c.id] || 0);
      return [
        c.name || "",
        c.phone || "",
        c.address || "",
        toNumber(c.openingBalance || 0),
        b > 0 ? b : 0,
        b < 0 ? Math.abs(b) : 0,
        c.notes || "",
      ];
    });

    downloadCsv("karma-customers.csv", headers, rows);
  };

  // ✅ تصدير كشف حساب عميل (CSV)
  const exportCustomerLedgerCsv = (customer) => {
    if (!customer) return;

    const list = getCustomerLedger(customer.id);

    const headers = ["التاريخ", "العملية", "عليه", "له", "ملاحظات", "مرجع"];
    const rows = list.map((e) => [
      e.createdAt ? new Date(e.createdAt).toLocaleString("ar-EG") : "",
      e.label || "",
      toNumber(e.debit || 0),
      toNumber(e.credit || 0),
      e.notes || "",
      e.invoiceNumber || e.receiptNumber || "",
    ]);

    downloadCsv(`ledger-${customer.name || "customer"}.csv`, headers, rows);
  };

  // ✅ تجهيز نص واتساب للعميل (كشف + آخر فواتير)
  const buildCustomerWhatsAppMessage = (customer) => {
    const balance = toNumber(customerBalances[customer.id] || 0);
    const opening = toNumber(customer.openingBalance || 0);

    const customerInvoices = (invoices || [])
      .filter((inv) => inv.customerId === customer.id)
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
      .slice(0, 8);

    const lines = [];
    lines.push(`🧾 تقرير حساب العميل`);
    lines.push(`الاسم: ${customer.name || ""}`);
    if (customer.phone) lines.push(`الهاتف: ${customer.phone}`);
    lines.push(`----------------------------`);
    if (opening > 0) lines.push(`مديونية سابقة: ${opening} ${settings.currencyCode}`);
    lines.push(`عليه الآن: ${balance > 0 ? balance : 0} ${settings.currencyCode}`);
    lines.push(`له الآن: ${balance < 0 ? Math.abs(balance) : 0} ${settings.currencyCode}`);
    lines.push(`----------------------------`);
    lines.push(`📌 آخر الفواتير:`);

    if (customerInvoices.length === 0) {
      lines.push(`لا توجد فواتير مسجلة.`);
    } else {
      customerInvoices.forEach((inv) => {
        const dt = inv.createdAt ? new Date(inv.createdAt).toLocaleDateString("ar-EG") : "";
        lines.push(
          `- ${inv.invoiceNumber || "فاتورة"} | ${dt} | إجمالي: ${toNumber(inv.total)} | مدفوع: ${toNumber(inv.paidAmount)} | متبقي: ${toNumber(inv.remainingAmount)}`
        );
      });
    }

    lines.push(`----------------------------`);
    lines.push(`✅ يمكنك الرد لتأكيد السداد أو الاستفسار.`);
    lines.push(`(مرسل من نظام ${settings.storeName || "كارما ماركت"})`);

    return lines.join("\n");
  };

  // ✅ إرسال واتساب لعميل
  const sendCustomerWhatsApp = (customer) => {
    const msg = buildCustomerWhatsAppMessage(customer);
    openWhatsApp(customer.phone, msg);
  };

  // ✅ إرسال “ملخص العملاء” على واتساب (رسالة قصيرة)
  const sendCustomersSummaryWhatsApp = () => {
    // خليها مختصرة لتفادي طول الرابط
    const msg = [
      `📊 تقرير العملاء (${settings.storeName || "كارما ماركت"})`,
      `إجمالي العملاء: ${totalCustomers}`,
      `إجمالي المديونيات (عليه): ${toNumber(totalDebts)} ${settings.currencyCode}`,
      `إجمالي (له): ${toNumber(totalCredits)} ${settings.currencyCode}`,
      `✅ تم تصدير ملف Excel من النظام لإرساله عند الحاجة.`,
    ].join("\n");

    // لو عندك رقم الواتساب الخاص بالمحل حطه هنا، أو اتركه واطلب رقم
    window.alert("هنفتح واتساب لكن لازم تختار رقم المرسل إليه (مثلاً رقم صاحب المحل) من شات واتساب.");
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, "_blank", "noopener,noreferrer");
  };

  

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
      {/* إضافة عميل */}
      <Card className="xl:col-span-4">
        <SectionTitle title="إضافة عميل" subtitle="عميل عادي أو آجل" icon={Users} />

        <div className="space-y-4">
          <input
            value={customerForm.name}
            onChange={(e) => setCustomerForm((s) => ({ ...s, name: e.target.value }))}
            placeholder="اسم العميل"
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
          />

          <input
            value={customerForm.phone}
            onChange={(e) => setCustomerForm((s) => ({ ...s, phone: e.target.value }))}
            placeholder="رقم الهاتف (للواتساب)"
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
          />

          <input
            value={customerForm.address}
            onChange={(e) => setCustomerForm((s) => ({ ...s, address: e.target.value }))}
            placeholder="العنوان"
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
          />

          <input
            type="number"
            value={customerForm.openingBalance || ""}
            onChange={(e) => setCustomerForm((s) => ({ ...s, openingBalance: e.target.value }))}
            placeholder="مديونية سابقة على العميل"
            className="w-full rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 outline-none"
          />

          <div className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
            لو العميل عليه مبلغ قديم من قبل تشغيل السيستم، اكتبه هنا مرة واحدة.
          </div>

          <textarea
            rows={3}
            value={customerForm.notes}
            onChange={(e) => setCustomerForm((s) => ({ ...s, notes: e.target.value }))}
            placeholder="ملاحظات"
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
          />

          <button
            onClick={saveCustomer}
            disabled={savingCustomer}
            className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-bold text-white"
          >
            <Save className="h-4 w-4" />
            {savingCustomer ? "جاري الحفظ..." : "حفظ العميل"}
          </button>
        </div>
      </Card>

      {/* قائمة العملاء */}
      <Card className="xl:col-span-8">
        <SectionTitle
          title="العملاء وكشف الحساب"
          subtitle="بحث + فلترة + تصدير + إرسال واتساب"
          icon={Wallet}
          action={
            <div className="flex flex-col gap-2 md:flex-row md:items-center">
              <button
                onClick={exportCustomersCsv}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
              >
                <Download className="h-4 w-4" />
                تصدير Excel (CSV)
              </button>

              <button
                onClick={sendCustomersSummaryWhatsApp}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-100"
              >
                <MessageCircle className="h-4 w-4" />
                إرسال ملخص واتساب
              </button>
            </div>
          }
        />

        {/* إحصائيات أعلى الصفحة */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="rounded-2xl bg-slate-50 p-4">
            <p className="text-sm text-slate-500">إجمالي العملاء</p>
            <p className="mt-2 text-xl font-black text-slate-900">{numberFormat(totalCustomers)}</p>
          </div>

          <div className="rounded-2xl bg-red-50 p-4">
            <p className="text-sm text-red-600">إجمالي المديونيات (عليه)</p>
            <p className="mt-2 text-xl font-black text-red-700">
              {currency(totalDebts, settings.currencyCode)}
            </p>
          </div>

          <div className="rounded-2xl bg-emerald-50 p-4">
            <p className="text-sm text-emerald-700">إجمالي (له)</p>
            <p className="mt-2 text-xl font-black text-emerald-700">
              {currency(totalCredits, settings.currencyCode)}
            </p>
          </div>
        </div>

        {/* بحث + فلتر */}
        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="relative md:col-span-2">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="بحث باسم العميل / رقم الهاتف / العنوان"
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-4 outline-none"
            />
          </div>

          <select
            value={filterMode}
            onChange={(e) => setFilterMode(e.target.value)}
            className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
          >
            <option value="all">كل العملاء</option>
            <option value="debt">عليهم فلوس فقط</option>
            <option value="settled">مسددين (رصيد 0)</option>
          </select>
        </div>

        <div className="mt-4 space-y-3">
          {filteredCustomers.map((customer) => {
            const isExpanded = expandedCustomerId === customer.id;
            const balance = toNumber(customerBalances[customer.id] || 0);

            return (
              <div key={customer.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                <button
                  type="button"
                  onClick={() => handleToggleCustomer(customer.id)}
                  className="flex w-full items-center justify-between gap-3 px-4 py-4 text-right transition hover:bg-slate-50"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-slate-900">{customer.name}</p>
                    <p className="text-sm text-slate-500">{customer.phone || "بدون هاتف"}</p>

                    <div className="mt-2 flex flex-wrap gap-2 text-xs">
                      {toNumber(customer.openingBalance || 0) > 0 ? (
                        <span className="rounded-xl bg-amber-100 px-3 py-1 font-bold text-amber-800">
                          مديونية سابقة: {currency(customer.openingBalance || 0, settings.currencyCode)}
                        </span>
                      ) : null}

                      <span className="rounded-xl bg-red-50 px-3 py-1 font-bold text-red-700">
                        عليه: {currency(balance > 0 ? balance : 0, settings.currencyCode)}
                      </span>

                      <span className="rounded-xl bg-emerald-50 px-3 py-1 font-bold text-emerald-700">
                        له: {currency(balance < 0 ? Math.abs(balance) : 0, settings.currencyCode)}
                      </span>
                    </div>
                  </div>

                  <ChevronDown className={`h-5 w-5 shrink-0 text-slate-500 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`} />
                </button>

                {isExpanded ? (
                  <div className="border-t border-slate-200 bg-slate-50 px-4 py-4">
                    <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
                      {/* سداد */}
                      <div className="xl:col-span-5">
                        <div className="rounded-2xl border border-slate-200 bg-white p-4">
                          <h3 className="mb-3 font-black">إضافة سداد للعميل: {customer.name}</h3>

                          <div className="grid grid-cols-1 gap-4">
                            <input
                              type="number"
                              value={paymentAmount}
                              onChange={(e) => setPaymentAmount(e.target.value)}
                              placeholder="المبلغ"
                              className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
                            />

                            <input
                              value={paymentNotes}
                              onChange={(e) => setPaymentNotes(e.target.value)}
                              placeholder="ملاحظات"
                              className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
                            />

                            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                              <button
                                onClick={handleAddPayment}
                                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white"
                              >
                                <Wallet className="h-4 w-4" />
                                حفظ السداد
                              </button>

                              <button
                                onClick={() => window.print()}
                                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-700"
                              >
                                <Printer className="h-4 w-4" />
                                طباعة إيصال
                              </button>
                            </div>

                            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                              <button
                                onClick={() => exportCustomerLedgerCsv(customer)}
                                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-700 hover:bg-slate-100"
                              >
                                <FileText className="h-4 w-4" />
                                تصدير كشف Excel
                              </button>

                              <button
                                onClick={() => sendCustomerWhatsApp(customer)}
                                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-bold text-white hover:bg-slate-800"
                              >
                                <MessageCircle className="h-4 w-4" />
                                إرسال واتساب
                              </button>
                            </div>

                            <div className="rounded-2xl bg-slate-50 p-4 text-xs text-slate-600">
                              * واتساب سيُرسل كشف الحساب + آخر فواتير كنص.  
                              لو محتاج ملف، استخدم "تصدير كشف Excel" ثم ارفقه يدويًا في واتساب.
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* كشف الحساب */}
                      <div className="xl:col-span-7">
                        <div className="rounded-2xl border border-slate-200 bg-white p-4">
                          <h3 className="mb-3 font-black">كشف الحساب التفصيلي</h3>

                          <div className="space-y-3">
                            {ledger.map((entry, index) => (
                              <div key={`${entry.id}-${index}`} className="rounded-2xl bg-slate-50 p-4">
                                <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-2">
                                      {entry.type === "sale_invoice" ? (
                                        <Receipt className="h-4 w-4 text-slate-500" />
                                      ) : entry.type === "opening_balance" ? (
                                        <BadgePlus className="h-4 w-4 text-amber-600" />
                                      ) : (
                                        <Wallet className="h-4 w-4 text-emerald-600" />
                                      )}
                                      <p className="font-bold">{entry.label}</p>
                                    </div>

                                    <p className="mt-1 text-xs text-slate-500">
                                      {formatDate(entry.createdAt)}
                                    </p>

                                    {entry.type === "sale_invoice" ? (
                                      <div className="mt-3 space-y-2">
                                        <div className="grid grid-cols-1 gap-2 text-sm md:grid-cols-3">
                                          <p>
                                            إجمالي:{" "}
                                            <span className="font-bold">
                                              {currency(entry.totalInvoice, settings.currencyCode)}
                                            </span>
                                          </p>
                                          <p>
                                            مدفوع:{" "}
                                            <span className="font-bold text-emerald-700">
                                              {currency(entry.paidAmount, settings.currencyCode)}
                                            </span>
                                          </p>
                                          <p>
                                            متبقي:{" "}
                                            <span className="font-bold text-red-700">
                                              {currency(entry.remainingAmount, settings.currencyCode)}
                                            </span>
                                          </p>
                                        </div>

                                        {(entry.items || []).length > 0 ? (
                                          <div className="rounded-2xl bg-white p-3">
                                            <p className="mb-2 text-sm font-bold text-slate-700">الأصناف:</p>
                                            <div className="space-y-2">
                                              {entry.items.map((it, idx2) => (
                                                <div
                                                  key={`${it.productId}-${idx2}`}
                                                  className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 px-3 py-2 text-sm"
                                                >
                                                  <div className="min-w-0">
                                                    <p className="truncate font-semibold text-slate-900">{it.productName}</p>
                                                    <p className="text-xs text-slate-500">
                                                      {it.qty} × {it.unitName}
                                                    </p>
                                                  </div>
                                                  <div className="text-left font-bold text-slate-700">
                                                    {currency(it.total, settings.currencyCode)}
                                                  </div>
                                                </div>
                                              ))}
                                            </div>
                                          </div>
                                        ) : null}
                                      </div>
                                    ) : entry.type === "opening_balance" ? (
                                      <div className="mt-3 text-sm text-slate-700">
                                        مديونية سابقة:{" "}
                                        <span className="font-bold text-amber-700">
                                          {currency(entry.amount || entry.debit || 0, settings.currencyCode)}
                                        </span>
                                      </div>
                                    ) : (
                                      <div className="mt-3 text-sm text-slate-700">
                                        مبلغ السداد:{" "}
                                        <span className="font-bold text-emerald-700">
                                          {currency(entry.amount || entry.credit || 0, settings.currencyCode)}
                                        </span>
                                        {entry.receiptNumber ? (
                                          <span className="mr-2 text-xs text-slate-500">
                                            • إيصال: {entry.receiptNumber}
                                          </span>
                                        ) : null}
                                      </div>
                                    )}
                                  </div>

                                  <div className="text-sm shrink-0">
                                    <div className="rounded-xl bg-red-50 px-3 py-2 font-bold text-red-700">
                                      عليه: {currency(entry.debit || 0, settings.currencyCode)}
                                    </div>
                                    <div className="mt-2 rounded-xl bg-emerald-50 px-3 py-2 font-bold text-emerald-700">
                                      له: {currency(entry.credit || 0, settings.currencyCode)}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            ))}

                            {ledger.length === 0 ? (
                              <div className="rounded-2xl border border-dashed border-slate-300 p-6 text-center text-slate-500">
                                لا توجد حركات لهذا العميل
                              </div>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })}

          {filteredCustomers.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 p-6 text-center text-slate-500">
              لا توجد نتائج مطابقة
            </div>
          ) : null}
        </div>
      </Card>
    </div>
  );
}