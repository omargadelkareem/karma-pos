import React, { useContext, useMemo, useState } from "react";
import { Save, Truck, Wallet, ChevronDown } from "lucide-react";
import { PosContext } from "../context/PosContext";
import { currency } from "../utils/format";
import Card from "../components/Card";
import SectionTitle from "../components/SectionTitle";

export default function Suppliers() {
  const {
    settings,
    suppliers,
    supplierForm,
    setSupplierForm,
    savingSupplier,
    saveSupplier,
    addSupplierPayment,
    supplierBalances,
    getSupplierLedger,
  } = useContext(PosContext);

  const [expandedSupplierId, setExpandedSupplierId] = useState(null);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentNotes, setPaymentNotes] = useState("");

  const selectedSupplier = useMemo(
    () => suppliers.find((item) => item.id === expandedSupplierId) || null,
    [suppliers, expandedSupplierId]
  );

  const ledger = useMemo(
    () => (expandedSupplierId ? getSupplierLedger(expandedSupplierId) : []),
    [expandedSupplierId, getSupplierLedger]
  );

  const handleToggleSupplier = (supplierId) => {
    setExpandedSupplierId((prev) => (prev === supplierId ? null : supplierId));
    setPaymentAmount("");
    setPaymentNotes("");
  };

  const handleAddPayment = async () => {
    if (!selectedSupplier) return;

    await addSupplierPayment({
      supplierId: selectedSupplier.id,
      supplierName: selectedSupplier.name,
      amount: paymentAmount,
      notes: paymentNotes,
    });

    setPaymentAmount("");
    setPaymentNotes("");
  };

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
      <Card className="xl:col-span-4">
        <SectionTitle title="إضافة مورد" subtitle="بيانات المورد" icon={Truck} />

        <div className="space-y-4">
          <input
            value={supplierForm.name}
            onChange={(e) => setSupplierForm((s) => ({ ...s, name: e.target.value }))}
            placeholder="اسم المورد"
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
          />

          <input
            value={supplierForm.phone}
            onChange={(e) => setSupplierForm((s) => ({ ...s, phone: e.target.value }))}
            placeholder="رقم الهاتف"
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
          />

          <input
            value={supplierForm.address}
            onChange={(e) => setSupplierForm((s) => ({ ...s, address: e.target.value }))}
            placeholder="العنوان"
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
          />

          <textarea
            rows={3}
            value={supplierForm.notes}
            onChange={(e) => setSupplierForm((s) => ({ ...s, notes: e.target.value }))}
            placeholder="ملاحظات"
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
          />

          <button
            onClick={saveSupplier}
            disabled={savingSupplier}
            className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-bold text-white"
          >
            <Save className="h-4 w-4" />
            {savingSupplier ? "جاري الحفظ..." : "حفظ المورد"}
          </button>
        </div>
      </Card>

      <Card className="xl:col-span-8">
        <SectionTitle
          title="الموردين وكشف الحساب"
          subtitle="اضغط على المورد لعرض حسابه"
          icon={Wallet}
        />

        <div className="space-y-3">
          {suppliers.map((item) => {
            const isExpanded = expandedSupplierId === item.id;
            const balance = supplierBalances[item.id] || 0;

            return (
              <div
                key={item.id}
                className="overflow-hidden rounded-2xl border border-slate-200 bg-white"
              >
                <button
                  type="button"
                  onClick={() => handleToggleSupplier(item.id)}
                  className="flex w-full items-center justify-between gap-3 px-4 py-4 text-right transition hover:bg-slate-50"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-slate-900">{item.name}</p>
                    <p className="text-sm text-slate-500">{item.phone || "بدون هاتف"}</p>

                    <div className="mt-2 flex flex-wrap gap-2 text-xs">
                      <span className="rounded-xl bg-amber-50 px-3 py-1 font-bold text-amber-800">
                        له: {currency(balance > 0 ? balance : 0, settings.currencyCode)}
                      </span>

                      <span className="rounded-xl bg-blue-50 px-3 py-1 font-bold text-blue-700">
                        عليه: {currency(balance < 0 ? Math.abs(balance) : 0, settings.currencyCode)}
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
                    <div className="rounded-2xl border border-slate-200 bg-white p-4">
                      <h3 className="mb-3 font-black">إضافة سداد للمورد: {item.name}</h3>

                      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
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
                      </div>

                      <button
                        onClick={handleAddPayment}
                        className="mt-4 rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white"
                      >
                        حفظ السداد
                      </button>
                    </div>

                    <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
                      <h3 className="mb-3 font-black">كشف الحساب</h3>

                      <div className="space-y-3">
                        {ledger.map((ledgerItem, index) => (
                          <div
                            key={`${ledgerItem.id}-${index}`}
                            className="rounded-2xl bg-slate-50 p-4"
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div>
                                <p className="font-bold">{ledgerItem.label}</p>
                                <p className="text-xs text-slate-500">
                                  {ledgerItem.createdAt
                                    ? new Date(ledgerItem.createdAt).toLocaleString("ar-EG")
                                    : ""}
                                </p>
                              </div>

                              <div className="text-sm">
                                <span className="ml-4">
                                  له: {currency(ledgerItem.debit || 0, settings.currencyCode)}
                                </span>
                                <span>
                                  عليه: {currency(ledgerItem.credit || 0, settings.currencyCode)}
                                </span>
                              </div>
                            </div>
                          </div>
                        ))}

                        {ledger.length === 0 ? (
                          <div className="rounded-2xl border border-dashed border-slate-300 p-6 text-center text-slate-500">
                            لا توجد حركات لهذا المورد
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })}

          {suppliers.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 p-6 text-center text-slate-500">
              لا يوجد موردون بعد
            </div>
          ) : null}
        </div>
      </Card>
    </div>
  );
}