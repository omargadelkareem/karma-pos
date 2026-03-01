import React, { useContext, useMemo, useState } from "react";
import {
  Save,
  Users,
  Wallet,
  ChevronDown,
  Printer,
  Receipt,
  BadgePlus,
} from "lucide-react";
import { PosContext } from "../context/PosContext";
import { currency } from "../utils/format";
import Card from "../components/Card";
import SectionTitle from "../components/SectionTitle";

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
  } = useContext(PosContext);

  const [expandedCustomerId, setExpandedCustomerId] = useState(null);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentNotes, setPaymentNotes] = useState("");

  const selectedCustomer = useMemo(
    () => customers.find((item) => item.id === expandedCustomerId) || null,
    [customers, expandedCustomerId]
  );

  const ledger = useMemo(
    () => (expandedCustomerId ? getCustomerLedger(expandedCustomerId) : []),
    [expandedCustomerId, getCustomerLedger]
  );

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

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
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
            placeholder="رقم الهاتف"
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
            onChange={(e) =>
              setCustomerForm((s) => ({ ...s, openingBalance: e.target.value }))
            }
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

      <Card className="xl:col-span-8">
        <SectionTitle
          title="العملاء وكشف الحساب"
          subtitle="اضغط على العميل لعرض حسابه بالتفصيل"
          icon={Wallet}
        />

        <div className="space-y-3">
          {customers.map((customer) => {
            const isExpanded = expandedCustomerId === customer.id;
            const balance = customerBalances[customer.id] || 0;

            return (
              <div
                key={customer.id}
                className="overflow-hidden rounded-2xl border border-slate-200 bg-white"
              >
                <button
                  type="button"
                  onClick={() => handleToggleCustomer(customer.id)}
                  className="flex w-full items-center justify-between gap-3 px-4 py-4 text-right transition hover:bg-slate-50"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-slate-900">{customer.name}</p>
                    <p className="text-sm text-slate-500">{customer.phone || "بدون هاتف"}</p>

                    <div className="mt-2 flex flex-wrap gap-2 text-xs">
                      {Number(customer.openingBalance || 0) > 0 ? (
                        <span className="rounded-xl bg-amber-100 px-3 py-1 font-bold text-amber-800">
                          مديونية سابقة:{" "}
                          {currency(customer.openingBalance || 0, settings.currencyCode)}
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

                  <ChevronDown
                    className={`h-5 w-5 shrink-0 text-slate-500 transition-transform duration-200 ${
                      isExpanded ? "rotate-180" : ""
                    }`}
                  />
                </button>

                {isExpanded ? (
                  <div className="border-t border-slate-200 bg-slate-50 px-4 py-4">
                    <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
                      <div className="xl:col-span-5">
                        <div className="rounded-2xl border border-slate-200 bg-white p-4">
                          <h3 className="mb-3 font-black">
                            إضافة سداد للعميل: {customer.name}
                          </h3>

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
                          </div>
                        </div>
                      </div>

                      <div className="xl:col-span-7">
                        <div className="rounded-2xl border border-slate-200 bg-white p-4">
                          <h3 className="mb-3 font-black">كشف الحساب التفصيلي</h3>

                          <div className="space-y-3">
                            {ledger.map((entry, index) => (
                              <div
                                key={`${entry.id}-${index}`}
                                className="rounded-2xl bg-slate-50 p-4"
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div>
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
                                      {entry.createdAt
                                        ? new Date(entry.createdAt).toLocaleString("ar-EG")
                                        : ""}
                                    </p>

                                    {entry.type === "sale_invoice" ? (
                                      <div className="mt-3 space-y-2">
                                        <div className="grid grid-cols-1 gap-2 text-sm md:grid-cols-3">
                                          <p>
                                            إجمالي الفاتورة:{" "}
                                            <span className="font-bold">
                                              {currency(entry.totalInvoice, settings.currencyCode)}
                                            </span>
                                          </p>
                                          <p>
                                            المدفوع:{" "}
                                            <span className="font-bold text-emerald-700">
                                              {currency(entry.paidAmount, settings.currencyCode)}
                                            </span>
                                          </p>
                                          <p>
                                            المتبقي:{" "}
                                            <span className="font-bold text-red-700">
                                              {currency(entry.remainingAmount, settings.currencyCode)}
                                            </span>
                                          </p>
                                        </div>

                                        <p className="text-sm text-slate-600">
                                          طريقة الدفع:{" "}
                                          <span className="font-bold">
                                            {entry.paymentMethod || "—"}
                                          </span>
                                        </p>

                                        {(entry.items || []).length > 0 ? (
                                          <div className="rounded-2xl bg-white p-3">
                                            <p className="mb-2 text-sm font-bold text-slate-700">
                                              الأصناف التي اشتراها:
                                            </p>
                                            <div className="space-y-2">
                                              {entry.items.map((item, itemIndex) => (
                                                <div
                                                  key={`${item.productId}-${itemIndex}`}
                                                  className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 px-3 py-2 text-sm"
                                                >
                                                  <div>
                                                    <p className="font-semibold text-slate-900">
                                                      {item.productName}
                                                    </p>
                                                    <p className="text-xs text-slate-500">
                                                      {item.qty} × {item.unitName}
                                                    </p>
                                                  </div>

                                                  <div className="text-left font-bold text-slate-700">
                                                    {currency(item.total, settings.currencyCode)}
                                                  </div>
                                                </div>
                                              ))}
                                            </div>
                                          </div>
                                        ) : null}
                                      </div>
                                    ) : entry.type === "opening_balance" ? (
                                      <div className="mt-3 space-y-2 text-sm">
                                        <p>
                                          المديونية السابقة:{" "}
                                          <span className="font-bold text-amber-700">
                                            {currency(entry.amount || entry.debit || 0, settings.currencyCode)}
                                          </span>
                                        </p>
                                        <p className="text-slate-600">
                                          هذا المبلغ تم إدخاله كرصيد قديم قبل تشغيل السيستم.
                                        </p>
                                      </div>
                                    ) : (
                                      <div className="mt-3 space-y-2 text-sm">
                                        <p>
                                          مبلغ السداد:{" "}
                                          <span className="font-bold text-emerald-700">
                                            {currency(entry.amount || entry.credit || 0, settings.currencyCode)}
                                          </span>
                                        </p>

                                        {entry.receiptNumber ? (
                                          <p>
                                            رقم الإيصال:{" "}
                                            <span className="font-bold">{entry.receiptNumber}</span>
                                          </p>
                                        ) : null}

                                        {entry.notes ? (
                                          <p>
                                            ملاحظات:{" "}
                                            <span className="font-bold">{entry.notes}</span>
                                          </p>
                                        ) : null}
                                      </div>
                                    )}
                                  </div>

                                  <div className="text-sm">
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

          {customers.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 p-6 text-center text-slate-500">
              لا يوجد عملاء بعد
            </div>
          ) : null}
        </div>
      </Card>
    </div>
  );
}