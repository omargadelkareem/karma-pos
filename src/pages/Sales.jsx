import React, { useContext, useMemo, useState } from "react";
import {
  Download,
  Receipt,
  Search,
  RotateCcw,
  CalendarDays,
  CircleDollarSign,
  Wallet,
  FileText,
  Printer,
  UserRound,
  CreditCard,
  Package,
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

function getPaymentMethodLabel(method) {
  switch (method) {
    case "cash":
      return "نقدي";
    case "wallet":
      return "محفظة";
    case "card":
      return "بطاقة";
    case "credit":
      return "آجل";
    case "partial":
      return "جزئي";
    default:
      return method || "غير محدد";
  }
}

export default function Sales() {
  const {
    invoices,
    settings,
    exportInvoicesCsv,
    createSalesReturn,
    salesReturns,
  } = useContext(PosContext);

  const [query, setQuery] = useState("");
  const [fromDate, setFromDate] = useState(todayInputValue());
  const [toDate, setToDate] = useState(todayInputValue());
  const [cashierFilter, setCashierFilter] = useState("");
  const [paymentMethodFilter, setPaymentMethodFilter] = useState("");
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [returnQtyMap, setReturnQtyMap] = useState({});

  const cashierOptions = useMemo(() => {
    const unique = Array.from(
      new Set(
        invoices
          .map((item) => String(item.cashierName || "").trim())
          .filter(Boolean)
      )
    );
    return unique.sort((a, b) => a.localeCompare(b, "ar"));
  }, [invoices]);

  const invoiceMatchesDateRange = (item) => {
    const itemDate = getLocalDateInputValue(item.createdAt);
    if (fromDate && itemDate < fromDate) return false;
    if (toDate && itemDate > toDate) return false;
    return true;
  };

  const filteredInvoices = useMemo(() => {
    const q = String(query || "").trim().toLowerCase();

    return invoices.filter((item) => {
      const matchesDate = invoiceMatchesDateRange(item);

      const matchesQuery = q
        ? `${item.invoiceNumber || ""} ${item.customerName || ""} ${item.cashierName || ""}`.toLowerCase().includes(q)
        : true;

      const matchesCashier = cashierFilter
        ? String(item.cashierName || "").trim() === cashierFilter
        : true;

      const matchesPaymentMethod = paymentMethodFilter
        ? String(item.paymentMethod || "") === paymentMethodFilter
        : true;

      return matchesDate && matchesQuery && matchesCashier && matchesPaymentMethod;
    });
  }, [invoices, query, fromDate, toDate, cashierFilter, paymentMethodFilter]);

  const filteredReturnsByDate = useMemo(() => {
    return salesReturns.filter((item) => {
      const itemDate = getLocalDateInputValue(item.createdAt);
      if (fromDate && itemDate < fromDate) return false;
      if (toDate && itemDate > toDate) return false;
      return true;
    });
  }, [salesReturns, fromDate, toDate]);

  const filteredInvoicesTotal = useMemo(() => {
    return filteredInvoices.reduce((sum, item) => sum + Number(item.total || 0), 0);
  }, [filteredInvoices]);

  const filteredInvoicesPaid = useMemo(() => {
    return filteredInvoices.reduce((sum, item) => sum + Number(item.paidAmount || 0), 0);
  }, [filteredInvoices]);

  const filteredInvoicesRemaining = useMemo(() => {
    return filteredInvoices.reduce((sum, item) => sum + Number(item.remainingAmount || 0), 0);
  }, [filteredInvoices]);

  const filteredReturnsTotal = useMemo(() => {
    return filteredReturnsByDate.reduce((sum, item) => sum + Number(item.total || 0), 0);
  }, [filteredReturnsByDate]);

  const filteredNetSales = useMemo(() => {
    return filteredInvoicesTotal - filteredReturnsTotal;
  }, [filteredInvoicesTotal, filteredReturnsTotal]);

  const filteredSoldItemsCount = useMemo(() => {
    return filteredInvoices.reduce((sum, invoice) => {
      return (
        sum +
        (invoice.items || []).reduce((itemsSum, item) => itemsSum + Number(item.qty || 0), 0)
      );
    }, 0);
  }, [filteredInvoices]);

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

  const resetFilters = () => {
    const today = todayInputValue();
    setQuery("");
    setFromDate(today);
    setToDate(today);
    setCashierFilter("");
    setPaymentMethodFilter("");
    setSelectedInvoice(null);
    setReturnQtyMap({});
  };

  const handlePrintSummary = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      <div className="print:hidden">
        <Card>
          <SectionTitle
            title="فلترة ومجاميع فواتير البيع"
            subtitle="حدد الفترة والكاشير وطريقة الدفع لمعرفة الإجماليات"
            icon={CalendarDays}
          />

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
            <div className="xl:col-span-3">
              <label className="mb-2 block text-sm font-medium text-slate-700">من تاريخ</label>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => {
                  setFromDate(e.target.value);
                  setSelectedInvoice(null);
                  setReturnQtyMap({});
                }}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
              />
            </div>

            <div className="xl:col-span-3">
              <label className="mb-2 block text-sm font-medium text-slate-700">إلى تاريخ</label>
              <input
                type="date"
                value={toDate}
                onChange={(e) => {
                  setToDate(e.target.value);
                  setSelectedInvoice(null);
                  setReturnQtyMap({});
                }}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
              />
            </div>

            <div className="xl:col-span-3">
              <label className="mb-2 block text-sm font-medium text-slate-700">الكاشير</label>
              <select
                value={cashierFilter}
                onChange={(e) => {
                  setCashierFilter(e.target.value);
                  setSelectedInvoice(null);
                  setReturnQtyMap({});
                }}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
              >
                <option value="">كل الكاشير</option>
                {cashierOptions.map((cashier) => (
                  <option key={cashier} value={cashier}>
                    {cashier}
                  </option>
                ))}
              </select>
            </div>

            <div className="xl:col-span-3">
              <label className="mb-2 block text-sm font-medium text-slate-700">طريقة الدفع</label>
              <select
                value={paymentMethodFilter}
                onChange={(e) => {
                  setPaymentMethodFilter(e.target.value);
                  setSelectedInvoice(null);
                  setReturnQtyMap({});
                }}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
              >
                <option value="">كل طرق الدفع</option>
                <option value="cash">نقدي</option>
                <option value="wallet">محفظة</option>
                <option value="card">بطاقة</option>
                <option value="credit">آجل</option>
                <option value="partial">جزئي</option>
              </select>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-12">
            <div className="xl:col-span-8">
              <label className="mb-2 block text-sm font-medium text-slate-700">بحث داخل الفواتير</label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="ابحث برقم الفاتورة أو اسم العميل أو الكاشير"
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-4 outline-none"
                />
              </div>
            </div>

            <div className="xl:col-span-4">
              <label className="mb-2 block text-sm font-medium text-slate-700">أوامر سريعة</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={resetFilters}
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-100"
                >
                  إعادة ضبط
                </button>

                <button
                  onClick={handlePrintSummary}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-bold text-white transition hover:bg-slate-800"
                >
                  <Printer className="h-4 w-4" />
                  طباعة التقرير
                </button>
              </div>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-6">
            <div className="rounded-2xl bg-slate-50 p-4">
              <div className="flex items-center gap-2 text-slate-500">
                <FileText className="h-4 w-4" />
                <span className="text-sm">عدد الفواتير</span>
              </div>
              <p className="mt-2 text-2xl font-black text-slate-900">{filteredInvoices.length}</p>
            </div>

            <div className="rounded-2xl bg-slate-50 p-4">
              <div className="flex items-center gap-2 text-slate-500">
                <CircleDollarSign className="h-4 w-4" />
                <span className="text-sm">إجمالي الفواتير</span>
              </div>
              <p className="mt-2 text-xl font-black text-slate-900">
                {currency(filteredInvoicesTotal, settings.currencyCode)}
              </p>
            </div>

            <div className="rounded-2xl bg-emerald-50 p-4">
              <div className="flex items-center gap-2 text-emerald-700">
                <Wallet className="h-4 w-4" />
                <span className="text-sm">إجمالي المدفوع</span>
              </div>
              <p className="mt-2 text-xl font-black text-emerald-700">
                {currency(filteredInvoicesPaid, settings.currencyCode)}
              </p>
            </div>

            <div className="rounded-2xl bg-amber-50 p-4">
              <div className="flex items-center gap-2 text-amber-700">
                <Wallet className="h-4 w-4" />
                <span className="text-sm">إجمالي المتبقي</span>
              </div>
              <p className="mt-2 text-xl font-black text-amber-700">
                {currency(filteredInvoicesRemaining, settings.currencyCode)}
              </p>
            </div>

            <div className="rounded-2xl bg-red-50 p-4">
              <div className="flex items-center gap-2 text-red-700">
                <RotateCcw className="h-4 w-4" />
                <span className="text-sm">إجمالي المرتجعات</span>
              </div>
              <p className="mt-2 text-xl font-black text-red-700">
                {currency(filteredReturnsTotal, settings.currencyCode)}
              </p>
            </div>

            <div className="rounded-2xl bg-blue-50 p-4">
              <div className="flex items-center gap-2 text-blue-700">
                <Package className="h-4 w-4" />
                <span className="text-sm">عدد الأصناف المباعة</span>
              </div>
              <p className="mt-2 text-2xl font-black text-blue-700">
                {filteredSoldItemsCount}
              </p>
            </div>
          </div>

          <div className="mt-4 rounded-2xl bg-slate-950 p-5 text-white">
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm text-slate-300">صافي المبيعات خلال الفترة المحددة</p>
                <p className="mt-1 text-3xl font-black">
                  {currency(filteredNetSales, settings.currencyCode)}
                </p>
              </div>

              <button
                onClick={exportInvoicesCsv}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-bold text-slate-900 transition hover:bg-slate-200"
              >
                <Download className="h-4 w-4" />
                تصدير CSV
              </button>
            </div>
          </div>
        </Card>
      </div>

      <div className="hidden print:block">
        <div className="rounded-2xl bg-white p-6 text-black">
          <h2 className="text-2xl font-black">{settings.storeName || "كرمة ماركت"}</h2>
          <p className="mt-2 text-sm">تقرير فواتير البيع</p>
          <p className="text-sm">
            الفترة: {fromDate || "—"} إلى {toDate || "—"}
          </p>
          <p className="text-sm">
            الكاشير: {cashierFilter || "الكل"} | طريقة الدفع: {getPaymentMethodLabel(paymentMethodFilter) || "الكل"}
          </p>

          <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div>عدد الفواتير: {filteredInvoices.length}</div>
            <div>إجمالي الفواتير: {currency(filteredInvoicesTotal, settings.currencyCode)}</div>
            <div>إجمالي المدفوع: {currency(filteredInvoicesPaid, settings.currencyCode)}</div>
            <div>إجمالي المتبقي: {currency(filteredInvoicesRemaining, settings.currencyCode)}</div>
            <div>إجمالي المرتجعات: {currency(filteredReturnsTotal, settings.currencyCode)}</div>
            <div>صافي المبيعات: {currency(filteredNetSales, settings.currencyCode)}</div>
            <div>عدد الأصناف المباعة: {filteredSoldItemsCount}</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12 print:hidden">
        <Card className="xl:col-span-7">
          <SectionTitle
            title="فواتير البيع"
            subtitle="الفواتير الناتجة من الفلاتر المحددة"
            icon={Receipt}
          />

          <div className="space-y-3">
            {filteredInvoices.map((item) => (
              <button
                key={item.id}
                onClick={() => handleChooseInvoice(item)}
                className={`w-full rounded-2xl p-4 text-right transition ${
                  selectedInvoice?.id === item.id
                    ? "bg-slate-200"
                    : "bg-slate-50 hover:bg-slate-100"
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-bold">{item.invoiceNumber}</p>
                    <p className="text-sm text-slate-500">{item.customerName || "بدون عميل"}</p>
                    <p className="text-xs text-slate-500">
                      {item.createdAt ? new Date(item.createdAt).toLocaleString("ar-EG") : ""}
                    </p>

                    <div className="mt-2 flex flex-wrap gap-2 text-xs">
                      <span className="rounded-xl bg-slate-200 px-2.5 py-1 text-slate-700">
                        {getPaymentMethodLabel(item.paymentMethod)}
                      </span>
                      <span className="rounded-xl bg-blue-50 px-2.5 py-1 text-blue-700">
                        {item.cashierName || "بدون كاشير"}
                      </span>
                    </div>
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
                لا توجد فواتير في هذه الفترة
              </div>
            ) : null}
          </div>
        </Card>

        <Card className="xl:col-span-5">
          <SectionTitle
            title="تفاصيل الفاتورة ومرتجع البيع"
            subtitle="اعرض التفاصيل وسجل المرتجع"
            icon={RotateCcw}
          />

          {selectedInvoice ? (
            <div className="space-y-4">
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="font-black">{selectedInvoice.invoiceNumber}</p>
                <p className="text-sm text-slate-500">
                  {selectedInvoice.createdAt
                    ? new Date(selectedInvoice.createdAt).toLocaleString("ar-EG")
                    : ""}
                </p>

                <div className="mt-3 space-y-1 text-sm">
                  <p>العميل: {selectedInvoice.customerName || "بدون عميل"}</p>
                  <p>الكاشير: {selectedInvoice.cashierName || "—"}</p>
                  <p>طريقة الدفع: {getPaymentMethodLabel(selectedInvoice.paymentMethod)}</p>
                  <p>إجمالي الفاتورة: {currency(selectedInvoice.total, settings.currencyCode)}</p>
                  <p>إجمالي المرتجع: {currency(totalReturnedForInvoice, settings.currencyCode)}</p>
                  <p className="font-bold text-emerald-700">
                    صافي الفاتورة: {currency(netInvoiceAmount, settings.currencyCode)}
                  </p>
                </div>
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
    </div>
  );
}