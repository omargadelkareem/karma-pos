    import React, { useContext, useMemo, useState } from "react";
import { RotateCcw, Search, Receipt, Minus, Plus, Save, Trash2, AlertTriangle } from "lucide-react";
import { PosContext } from "../context/PosContext";
import Card from "../components/Card";
import SectionTitle from "../components/SectionTitle";
import { currency } from "../utils/format";

function toNumber(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export default function SalesReturns() {
  const { settings, invoices, createSalesReturn, checkoutLoading } = useContext(PosContext);

  const [query, setQuery] = useState("");
  const [selectedInvoiceId, setSelectedInvoiceId] = useState("");
  const [selectedMap, setSelectedMap] = useState({}); // { itemKey: { ...returnItem } }

  const selectedInvoice = useMemo(() => {
    if (!selectedInvoiceId) return null;
    return (invoices || []).find((i) => i.id === selectedInvoiceId) || null;
  }, [invoices, selectedInvoiceId]);

  const searchedInvoices = useMemo(() => {
    const q = String(query || "").trim().toLowerCase();
    if (!q) return (invoices || []).slice(0, 20);

    return (invoices || [])
      .filter((i) => {
        const txt = `${i.invoiceNumber || ""} ${i.customerName || ""} ${i.cashierName || ""}`.toLowerCase();
        return txt.includes(q);
      })
      .slice(0, 50);
  }, [invoices, query]);

  const invoiceItems = useMemo(() => {
    return (selectedInvoice?.items || []).map((it, idx) => {
      const key = `${selectedInvoice?.id || "inv"}-${it.productId || idx}-${it.unitType || "u"}-${idx}`;
      return { ...it, _key: key };
    });
  }, [selectedInvoice]);

  const selectedReturnItems = useMemo(() => {
    return Object.values(selectedMap || {}).filter(Boolean);
  }, [selectedMap]);

  const totalReturn = useMemo(() => {
    return selectedReturnItems.reduce((s, it) => s + toNumber(it.total), 0);
  }, [selectedReturnItems]);

  const resetSelection = () => setSelectedMap({});

  const pickInvoice = (inv) => {
    setSelectedInvoiceId(inv.id);
    setSelectedMap({});
  };

  const toggleItem = (it) => {
    setSelectedMap((prev) => {
      const exists = !!prev[it._key];
      if (exists) {
        const next = { ...prev };
        delete next[it._key];
        return next;
      }

      const qty = Math.max(1, toNumber(it.qty, 1));
      const unitPrice = toNumber(it.unitPrice);
      return {
        ...prev,
        [it._key]: {
          productId: it.productId,
          productName: it.productName,
          unitType: it.unitType,
          unitName: it.unitName,
          unitPrice,
          qty: 1,
          total: unitPrice * 1,
          _maxQty: qty, // لتحديد الحد الأقصى
        },
      };
    });
  };

  const setQty = (key, qty) => {
    setSelectedMap((prev) => {
      const cur = prev[key];
      if (!cur) return prev;

      const maxQty = toNumber(cur._maxQty, 1);
      const nextQty = Math.max(1, Math.min(toNumber(qty, 1), maxQty));
      const unitPrice = toNumber(cur.unitPrice);

      return {
        ...prev,
        [key]: {
          ...cur,
          qty: nextQty,
          total: nextQty * unitPrice,
        },
      };
    });
  };

  const inc = (key) => {
    const cur = selectedMap[key];
    if (!cur) return;
    setQty(key, toNumber(cur.qty) + 1);
  };

  const dec = (key) => {
    const cur = selectedMap[key];
    if (!cur) return;
    setQty(key, toNumber(cur.qty) - 1);
  };

  const removeSelected = (key) => {
    setSelectedMap((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const submitReturn = async () => {
    if (!selectedInvoice) return window.alert("اختر فاتورة أولاً");
    if (selectedReturnItems.length === 0) return window.alert("اختر أصناف للمرتجع");

    // تجهيز items بالشكل المطلوب داخل createSalesReturn
    const items = selectedReturnItems.map((it) => ({
      productId: it.productId,
      productName: it.productName,
      unitType: it.unitType,
      unitName: it.unitName,
      unitPrice: toNumber(it.unitPrice),
      qty: toNumber(it.qty),
      total: toNumber(it.total),
    }));

    const ok = window.confirm(`تأكيد حفظ المرتجع؟\nالإجمالي: ${currency(totalReturn, settings.currencyCode)}`);
    if (!ok) return;

    await createSalesReturn({ invoice: selectedInvoice, items });
    resetSelection();
  };

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
      {/* اختيار الفاتورة */}
      <Card className="xl:col-span-4">
        <SectionTitle title="اختيار الفاتورة" subtitle="ابحث برقم الفاتورة أو اسم العميل" icon={Receipt} />

        <div className="space-y-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="بحث في الفواتير..."
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-4 text-sm outline-none focus:border-slate-400"
            />
          </div>

          <div className="max-h-[520px] space-y-2 overflow-auto rounded-2xl border border-slate-200 bg-white p-2">
            {searchedInvoices.map((inv) => {
              const active = inv.id === selectedInvoiceId;
              return (
                <button
                  key={inv.id}
                  type="button"
                  onClick={() => pickInvoice(inv)}
                  className={`w-full rounded-2xl border px-4 py-3 text-right transition ${
                    active ? "border-slate-950 bg-slate-950 text-white" : "border-slate-200 bg-white hover:bg-slate-50"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-black">{inv.invoiceNumber || "فاتورة"}</p>
                      <p className={`mt-1 truncate text-xs ${active ? "text-white/80" : "text-slate-500"}`}>
                        {inv.customerName || "بدون عميل"} • {inv.cashierName || "—"}
                      </p>
                      <p className={`mt-1 text-xs ${active ? "text-white/80" : "text-slate-500"}`}>
                        {inv.createdAt ? new Date(inv.createdAt).toLocaleString("ar-EG") : ""}
                      </p>
                    </div>

                    <div className={`shrink-0 rounded-xl px-3 py-2 text-xs font-bold ${active ? "bg-white/15" : "bg-slate-50 text-slate-700"}`}>
                      {currency(toNumber(inv.total), settings.currencyCode)}
                    </div>
                  </div>
                </button>
              );
            })}

            {searchedInvoices.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 p-6 text-center text-slate-500">
                لا توجد فواتير مطابقة
              </div>
            ) : null}
          </div>
        </div>
      </Card>

      {/* تفاصيل المرتجع */}
      <Card className="xl:col-span-8">
        <SectionTitle
          title="إدارة المرتجعات"
          subtitle="اختر الأصناف وحدد الكمية المرتجعة ثم احفظ"
          icon={RotateCcw}
          action={
            selectedInvoice ? (
              <button
                onClick={resetSelection}
                type="button"
                className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-100"
              >
                <Trash2 className="h-4 w-4" />
                مسح الاختيار
              </button>
            ) : null
          }
        />

        {!selectedInvoice ? (
          <div className="rounded-2xl border border-dashed border-slate-300 p-10 text-center text-slate-500">
            اختر فاتورة من القائمة على اليسار لبدء المرتجع
          </div>
        ) : (
          <div className="space-y-5">
            {/* ملخص الفاتورة */}
            <div className="rounded-2xl bg-slate-50 p-4">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <div>
                  <p className="text-xs text-slate-500">رقم الفاتورة</p>
                  <p className="mt-1 font-black text-slate-900">{selectedInvoice.invoiceNumber || "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">العميل</p>
                  <p className="mt-1 font-black text-slate-900">{selectedInvoice.customerName || "بدون عميل"}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">إجمالي الفاتورة</p>
                  <p className="mt-1 font-black text-slate-900">{currency(toNumber(selectedInvoice.total), settings.currencyCode)}</p>
                </div>
              </div>

              <div className="mt-4 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="mt-0.5 h-4 w-4" />
                  <p>
                    المرتجع سيعيد الكميات للمخزن تلقائيًا (حسب الـ Context). تأكد من اختيار الكميات الصحيحة.
                  </p>
                </div>
              </div>
            </div>

            {/* أصناف الفاتورة */}
            <div className="space-y-3">
              <h3 className="text-sm font-black text-slate-900">أصناف الفاتورة</h3>

              <div className="grid grid-cols-1 gap-3">
                {invoiceItems.map((it) => {
                  const selected = !!selectedMap[it._key];
                  const maxQty = Math.max(1, toNumber(it.qty, 1));

                  return (
                    <div key={it._key} className={`rounded-2xl border p-4 ${selected ? "border-slate-950 bg-slate-950/5" : "border-slate-200 bg-white"}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate font-black text-slate-900">{it.productName}</p>
                          <p className="mt-1 text-xs text-slate-500">
                            {maxQty} × {it.unitName} • سعر: {currency(toNumber(it.unitPrice), settings.currencyCode)}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            إجمالي: {currency(toNumber(it.total), settings.currencyCode)}
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={() => toggleItem(it)}
                          className={`shrink-0 rounded-2xl px-4 py-2 text-sm font-bold transition ${
                            selected ? "bg-slate-950 text-white hover:bg-slate-800" : "bg-slate-100 text-slate-800 hover:bg-slate-200"
                          }`}
                        >
                          {selected ? "محدد" : "اختيار"}
                        </button>
                      </div>

                      {selected ? (
                        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-12">
                          <div className="md:col-span-6">
                            <p className="text-xs font-bold text-slate-600">الكمية المرتجعة</p>
                            <div className="mt-2 flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => dec(it._key)}
                                className="rounded-xl border border-slate-200 bg-white p-2 hover:bg-slate-50"
                                title="نقص"
                              >
                                <Minus className="h-4 w-4" />
                              </button>

                              <input
                                type="number"
                                min={1}
                                max={maxQty}
                                value={selectedMap[it._key]?.qty || 1}
                                onChange={(e) => setQty(it._key, e.target.value)}
                                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm outline-none"
                              />

                              <button
                                type="button"
                                onClick={() => inc(it._key)}
                                className="rounded-xl border border-slate-200 bg-white p-2 hover:bg-slate-50"
                                title="زيادة"
                              >
                                <Plus className="h-4 w-4" />
                              </button>
                            </div>
                            <p className="mt-1 text-xs text-slate-500">الحد الأقصى: {maxQty}</p>
                          </div>

                          <div className="md:col-span-4">
                            <p className="text-xs font-bold text-slate-600">إجمالي هذا البند</p>
                            <div className="mt-2 rounded-2xl bg-slate-50 px-4 py-3 text-sm font-black text-slate-900">
                              {currency(toNumber(selectedMap[it._key]?.total), settings.currencyCode)}
                            </div>
                          </div>

                          <div className="md:col-span-2 flex items-end">
                            <button
                              type="button"
                              onClick={() => removeSelected(it._key)}
                              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-red-50 px-4 py-3 text-sm font-bold text-red-700 hover:bg-red-100"
                            >
                              <Trash2 className="h-4 w-4" />
                              إزالة
                            </button>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  );
                })}

                {invoiceItems.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-slate-500">
                    لا توجد أصناف في هذه الفاتورة
                  </div>
                ) : null}
              </div>
            </div>

            {/* ملخص المرتجع + حفظ */}
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-sm text-slate-500">إجمالي المرتجع</p>
                  <p className="mt-1 text-2xl font-black text-slate-900">
                    {currency(totalReturn, settings.currencyCode)}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    عدد البنود: {selectedReturnItems.length}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={submitReturn}
                  disabled={checkoutLoading || selectedReturnItems.length === 0}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-950 px-6 py-3 text-sm font-bold text-white disabled:bg-slate-300"
                >
                  <Save className="h-4 w-4" />
                  حفظ المرتجع
                </button>
              </div>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}