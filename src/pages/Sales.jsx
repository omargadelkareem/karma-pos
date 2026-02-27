import React, { useContext, useMemo, useState } from "react";
import { Download, Receipt, Search, RotateCcw } from "lucide-react";
import { PosContext } from "../context/PosContext";
import { currency } from "../utils/format";
import Card from "../components/Card";
import SectionTitle from "../components/SectionTitle";

export default function Sales() {
  const {
    invoices,
    settings,
    exportInvoicesCsv,
    createSalesReturn,
    salesReturns,
  } = useContext(PosContext);

  const [query, setQuery] = useState("");
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [returnQtyMap, setReturnQtyMap] = useState({});

  const filteredInvoices = useMemo(() => {
    const q = String(query || "").trim().toLowerCase();
    if (!q) return invoices;

    return invoices.filter((item) => {
      const text = `${item.invoiceNumber || ""} ${item.customerName || ""} ${item.cashierName || ""}`.toLowerCase();
      return text.includes(q);
    });
  }, [invoices, query]);

  const selectedInvoiceReturns = useMemo(() => {
    if (!selectedInvoice) return [];
    return salesReturns.filter((item) => item.originalInvoiceId === selectedInvoice.id);
  }, [salesReturns, selectedInvoice]);

  const totalReturnedForInvoice = useMemo(() => {
    return selectedInvoiceReturns.reduce((sum, item) => sum + Number(item.total || 0), 0);
  }, [selectedInvoiceReturns]);

  const netInvoiceAmount = useMemo(() => {
    if (!selectedInvoice) return 0;
    return Number(selectedInvoice.total || 0) - totalReturnedForInvoice;
  }, [selectedInvoice, totalReturnedForInvoice]);

  const handleChooseInvoice = (invoice) => {
    setSelectedInvoice(invoice);
    setReturnQtyMap({});
  };

  const handleSaveReturn = async () => {
    if (!selectedInvoice) return;

    const returnItems = (selectedInvoice.items || [])
      .map((item, index) => {
        const key = `${item.productId}-${item.unitType}-${index}`;
        const qty = Number(returnQtyMap[key] || 0);

        if (!qty || qty <= 0) return null;
        if (qty > Number(item.qty || 0)) return null;

        return {
          ...item,
          qty,
          total: qty * Number(item.unitPrice || 0),
        };
      })
      .filter(Boolean);

    if (returnItems.length === 0) {
      window.alert("من فضلك أدخل كميات المرتجع");
      return;
    }

    await createSalesReturn({
      invoice: selectedInvoice,
      items: returnItems,
    });

    setReturnQtyMap({});
  };

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
      <Card className="xl:col-span-7">
        <SectionTitle
          title="فواتير البيع"
          subtitle="بحث وتفاصيل كل فاتورة"
          icon={Receipt}
          action={
            <button
              onClick={exportInvoicesCsv}
              className="inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              <Download className="h-4 w-4" />
              تصدير CSV
            </button>
          }
        />

        <div className="relative mb-4">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="ابحث برقم الفاتورة أو اسم العميل أو الكاشير"
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-4 outline-none"
          />
        </div>

        <div className="space-y-3">
          {filteredInvoices.map((item) => (
            <button
              key={item.id}
              onClick={() => handleChooseInvoice(item)}
              className="w-full rounded-2xl bg-slate-50 p-4 text-right transition hover:bg-slate-100"
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-bold">{item.invoiceNumber}</p>
                  <p className="text-sm text-slate-500">{item.customerName || "بدون عميل"}</p>
                  <p className="text-xs text-slate-500">
                    {item.createdAt ? new Date(item.createdAt).toLocaleString("ar-EG") : ""}
                  </p>
                </div>
                <div className="text-left text-sm">
                  <p>الإجمالي: {currency(item.total, settings.currencyCode)}</p>
                  <p>المدفوع: {currency(item.paidAmount, settings.currencyCode)}</p>
                  <p>المتبقي: {currency(item.remainingAmount, settings.currencyCode)}</p>
                </div>
              </div>
            </button>
          ))}

          {filteredInvoices.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 p-6 text-center text-slate-500">
              لا توجد نتائج
            </div>
          ) : null}
        </div>
      </Card>

      <Card className="xl:col-span-5">
        <SectionTitle title="تفاصيل الفاتورة ومرتجع البيع" subtitle="اعرض التفاصيل وسجل المرتجع" icon={RotateCcw} />

        {selectedInvoice ? (
          <div className="space-y-4">
            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="font-black">{selectedInvoice.invoiceNumber}</p>
              <p className="text-sm text-slate-500">
                {selectedInvoice.createdAt
                  ? new Date(selectedInvoice.createdAt).toLocaleString("ar-EG")
                  : ""}
              </p>
              <p className="mt-2 text-sm">العميل: {selectedInvoice.customerName || "بدون عميل"}</p>
              <p className="text-sm">الكاشير: {selectedInvoice.cashierName || "—"}</p>
              <p className="text-sm">طريقة الدفع: {selectedInvoice.paymentMethod || "—"}</p>
              <p className="text-sm">إجمالي الفاتورة: {currency(selectedInvoice.total, settings.currencyCode)}</p>
              <p className="text-sm text-red-600">إجمالي المرتجع: {currency(totalReturnedForInvoice, settings.currencyCode)}</p>
              <p className="text-sm font-bold text-emerald-700">صافي الفاتورة: {currency(netInvoiceAmount, settings.currencyCode)}</p>
            </div>

            <div className="space-y-3">
              {(selectedInvoice.items || []).map((item, index) => {
                const key = `${item.productId}-${item.unitType}-${index}`;

                return (
                  <div key={key} className="rounded-2xl bg-slate-50 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-bold">{item.productName}</p>
                        <p className="text-xs text-slate-500">{item.unitName}</p>
                      </div>
                      <div className="text-left text-sm">
                        <p>الكمية: {item.qty}</p>
                        <p>السعر: {currency(item.unitPrice, settings.currencyCode)}</p>
                        <p>الإجمالي: {currency(item.total, settings.currencyCode)}</p>
                      </div>
                    </div>

                    <div className="mt-3">
                      <input
                        type="number"
                        min="0"
                        max={item.qty}
                        value={returnQtyMap[key] || ""}
                        onChange={(e) =>
                          setReturnQtyMap((prev) => ({
                            ...prev,
                            [key]: e.target.value,
                          }))
                        }
                        placeholder={`كمية المرتجع (حد أقصى ${item.qty})`}
                        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none"
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            <button
              onClick={handleSaveReturn}
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-red-600 px-5 py-3 text-sm font-bold text-white hover:bg-red-700"
            >
              <RotateCcw className="h-4 w-4" />
              حفظ مرتجع البيع
            </button>

            <div className="rounded-2xl border border-slate-200 p-4">
              <h3 className="mb-3 font-black">سجل المرتجعات لهذه الفاتورة</h3>

              <div className="space-y-3">
                {selectedInvoiceReturns.map((ret) => (
                  <div key={ret.id} className="rounded-2xl bg-slate-50 p-4">
                    <p className="font-bold">
                      مرتجع بقيمة {currency(ret.total, settings.currencyCode)}
                    </p>
                    <p className="text-xs text-slate-500">
                      {ret.createdAt ? new Date(ret.createdAt).toLocaleString("ar-EG") : ""}
                    </p>
                  </div>
                ))}

                {selectedInvoiceReturns.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-300 p-6 text-center text-slate-500">
                    لا توجد مرتجعات لهذه الفاتورة
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-slate-500">
            اختر فاتورة لعرض التفاصيل
          </div>
        )}
      </Card>
    </div>
  );
}