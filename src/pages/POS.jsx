import React, { useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  Minus,
  Plus,
  Printer,
  RefreshCw,
  Search,
  ShoppingCart,
  Trash2,
  Save,
  Package,
  ScanBarcode,
} from "lucide-react";
import { PosContext } from "../context/PosContext";
import { currency } from "../utils/format";
import Card from "../components/Card";
import SectionTitle from "../components/SectionTitle";

export default function POS() {
  const {
    settings,
    customers,
    products,
    search,
    setSearch,
    filteredProducts,
    cart,
    cartTotal,
    checkoutLoading,
    receiptData,
    invoiceResetTick,
    addToCart,
    increaseCartItem,
    decreaseCartItem,
    removeCartItem,
    clearCart,
    checkout,
    selectedCustomerId,
    setSelectedCustomerId,
    paymentMethod,
    setPaymentMethod,
    paidAmount,
    setPaidAmount,
    salePaidAmount,
    saleRemainingAmount,
  } = useContext(PosContext);

  const searchInputRef = useRef(null);
  const dropdownRef = useRef(null);

  const [showResults, setShowResults] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [barcodeHint, setBarcodeHint] = useState("");

  useEffect(() => {
    searchInputRef.current?.focus();
  }, []);

  useEffect(() => {
    searchInputRef.current?.focus();
  }, [invoiceResetTick]);

  const normalizedSearch = useMemo(() => String(search || "").trim(), [search]);

  const exactBarcodeProduct = useMemo(() => {
    if (!normalizedSearch) return null;

    return (
      products.find(
        (item) =>
          String(item.barcode || "").trim() &&
          String(item.barcode || "").trim() === normalizedSearch
      ) || null
    );
  }, [products, normalizedSearch]);

  const visibleResults = useMemo(() => {
    if (!normalizedSearch) return [];
    return filteredProducts.slice(0, 8);
  }, [filteredProducts, normalizedSearch]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [search]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!dropdownRef.current) return;
      if (!dropdownRef.current.contains(event.target)) {
        setShowResults(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  useEffect(() => {
    if (!normalizedSearch) {
      setBarcodeHint("");
      return;
    }

    if (exactBarcodeProduct) {
      setBarcodeHint(`تم التعرف على الباركود: ${exactBarcodeProduct.name}`);
      return;
    }

    const looksLikeBarcode = /^[0-9A-Za-z\-_]+$/.test(normalizedSearch) && normalizedSearch.length >= 4;

    if (looksLikeBarcode && visibleResults.length === 0) {
      setBarcodeHint("الباركود غير موجود");
      return;
    }

    setBarcodeHint("");
  }, [normalizedSearch, exactBarcodeProduct, visibleResults.length]);

  const resetSearchState = () => {
    setSearch("");
    setShowResults(false);
    setSelectedIndex(0);
    setBarcodeHint("");
    searchInputRef.current?.focus();
  };

  const handleSelectItem = (product) => {
    addToCart(product, "item");
    resetSearchState();
  };

  const handleSelectPackage = (product, e) => {
    e.stopPropagation();
    addToCart(product, "package");
    resetSearchState();
  };

  const tryAddByExactBarcode = () => {
    if (!exactBarcodeProduct) return false;
    addToCart(exactBarcodeProduct, "item");
    resetSearchState();
    return true;
  };

  const handleChangeSearch = (value) => {
    setSearch(value);

    if (!value.trim()) {
      setShowResults(false);
      return;
    }

    setShowResults(true);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();

      // أول أولوية: الباركود الكامل
      if (tryAddByExactBarcode()) {
        return;
      }

      // ثاني أولوية: العنصر المحدد من النتائج
      const selectedProduct = visibleResults[selectedIndex];
      if (selectedProduct) {
        handleSelectItem(selectedProduct);
      } else if (normalizedSearch) {
        window.alert("هذا الباركود / المنتج غير موجود");
      }

      return;
    }

    if (!visibleResults.length) {
      if (e.key === "Escape") {
        setShowResults(false);
      }
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setShowResults(true);
      setSelectedIndex((prev) => (prev + 1) % visibleResults.length);
      return;
    }

    if (e.key === "ArrowUp") {
      e.preventDefault();
      setShowResults(true);
      setSelectedIndex((prev) =>
        prev === 0 ? visibleResults.length - 1 : prev - 1
      );
      return;
    }

    if (e.key === "Escape") {
      setShowResults(false);
    }
  };

  return (
    <div className="grid grid-cols-1 gap-6 2xl:grid-cols-12">
      <div className="space-y-6 2xl:col-span-7">
        <Card>
          <SectionTitle
            title="شاشة البيع"
            subtitle="اكتب اسم المنتج أو امسح الباركود مباشرة"
            icon={Search}
          />

          <div className="relative" ref={dropdownRef}>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />

            <input
              ref={searchInputRef}
              value={search}
              onChange={(e) => handleChangeSearch(e.target.value)}
              onFocus={() => {
                if (visibleResults.length > 0) {
                  setShowResults(true);
                }
              }}
              onKeyDown={handleKeyDown}
              placeholder="ابحث باسم المنتج أو امسح الباركود"
              autoComplete="off"
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-4 pl-12 pr-4 text-lg outline-none transition focus:border-slate-400"
            />

            {showResults && normalizedSearch && (
              <div className="absolute z-50 mt-2 max-h-[420px] w-full overflow-auto rounded-2xl border border-slate-200 bg-white shadow-xl">
                {visibleResults.length > 0 ? (
                  visibleResults.map((item, index) => (
                    <div
                      key={item.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => handleSelectItem(item)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          handleSelectItem(item);
                        }
                      }}
                      className={`flex cursor-pointer items-center justify-between gap-3 border-b border-slate-100 px-4 py-4 text-right transition last:border-b-0 ${
                        selectedIndex === index ? "bg-slate-100" : "bg-white hover:bg-slate-50"
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <Package className="h-4 w-4 text-slate-400" />
                          <p className="truncate text-base font-bold text-slate-900">{item.name}</p>
                        </div>

                        <p className="mt-1 text-sm text-slate-500">
                          {item.category || "بدون قسم"}
                          {item.barcode ? ` • ${item.barcode}` : ""}
                        </p>

                        <p className="mt-1 text-xs text-slate-600">
                          المتاح: {item.packageQty} {item.packageName} + {item.itemQty} قطعة
                        </p>
                      </div>

                      <div className="flex shrink-0 flex-col gap-2">
                        <div className="rounded-xl bg-slate-900 px-3 py-2 text-xs font-bold text-white">
                          قطعة - {currency(item.saleItemPrice, settings.currencyCode)}
                        </div>

                        <button
                          type="button"
                          onClick={(e) => handleSelectPackage(item, e)}
                          className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-700"
                        >
                          {item.packageName} - {currency(item.salePackagePrice, settings.currencyCode)}
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="px-4 py-6 text-center text-sm text-slate-500">
                    لا توجد نتائج
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="mt-4 space-y-3">
            <div className="flex items-start gap-3 rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
              <ScanBarcode className="mt-0.5 h-5 w-5 shrink-0 text-slate-500" />
              <div>
                <div>- امسح الباركود بالجهاز وسيُضاف المنتج مباشرة عند التطابق الكامل.</div>
                <div>- لو كتبت اسم المنتج تظهر النتائج وتختار منها.</div>
                <div>- Enter يضيف الباركود المطابق أو أول نتيجة محددة.</div>
              </div>
            </div>

            {barcodeHint ? (
              <div
                className={`rounded-2xl px-4 py-3 text-sm font-medium ${
                  exactBarcodeProduct
                    ? "bg-emerald-50 text-emerald-700"
                    : "bg-red-50 text-red-700"
                }`}
              >
                {barcodeHint}
              </div>
            ) : null}
          </div>
        </Card>
      </div>

      <div className="space-y-6 2xl:col-span-5">
        <Card>
          <SectionTitle
            title="الفاتورة الحالية"
            subtitle="احفظ الفاتورة ثم ابدأ التالية فورًا"
            icon={ShoppingCart}
            action={
              <button
                onClick={clearCart}
                className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
              >
                مسح الفاتورة
              </button>
            }
          />

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <select
              value={selectedCustomerId}
              onChange={(e) => setSelectedCustomerId(e.target.value)}
              className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
            >
              <option value="">بدون عميل</option>
              {customers.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>

            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
            >
              <option value="cash">نقدي</option>
              <option value="wallet">محفظة</option>
              <option value="card">بطاقة</option>
              <option value="credit">آجل</option>
              <option value="partial">جزئي</option>
            </select>
          </div>

          {paymentMethod !== "credit" ? (
            <input
              type="number"
              value={paidAmount}
              onChange={(e) => setPaidAmount(e.target.value)}
              placeholder="المبلغ المدفوع"
              className="mt-4 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
            />
          ) : null}

          <div className="mt-4 space-y-3">
            {cart.map((item) => (
              <div key={item.key} className="rounded-2xl bg-slate-50 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h4 className="font-bold text-slate-900">{item.productName}</h4>
                    <p className="text-xs text-slate-500">
                      {item.unitName} × {currency(item.unitPrice, settings.currencyCode)}
                    </p>
                  </div>

                  <button
                    onClick={() => removeCartItem(item.key)}
                    className="rounded-xl p-2 text-slate-400 transition hover:bg-red-50 hover:text-red-600"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                <div className="mt-3 flex items-center gap-2">
                  <button
                    onClick={() => decreaseCartItem(item.key)}
                    className="rounded-xl border border-slate-200 p-2 hover:bg-white"
                  >
                    <Minus className="h-4 w-4" />
                  </button>

                  <div className="min-w-12 rounded-xl bg-white px-4 py-2 text-center text-sm font-semibold shadow-sm">
                    {item.qty}
                  </div>

                  <button
                    onClick={() => increaseCartItem(item.key)}
                    className="rounded-xl border border-slate-200 p-2 hover:bg-white"
                  >
                    <Plus className="h-4 w-4" />
                  </button>

                  <div className="mr-auto font-bold">
                    {currency(item.total, settings.currencyCode)}
                  </div>
                </div>
              </div>
            ))}

            {cart.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-slate-500">
                لا يوجد أصناف في الفاتورة
              </div>
            ) : null}
          </div>

          <div className="mt-5 rounded-3xl bg-slate-950 p-5 text-white">
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span>إجمالي الفاتورة</span>
                <span>{currency(cartTotal, settings.currencyCode)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>المدفوع</span>
                <span>{currency(salePaidAmount, settings.currencyCode)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>المتبقي</span>
                <span>{currency(saleRemainingAmount, settings.currencyCode)}</span>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2">
              <button
                onClick={checkout}
                disabled={checkoutLoading || cart.length === 0}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-bold text-slate-900 transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                {checkoutLoading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                حفظ الفاتورة
              </button>

              <button
                onClick={() => window.print()}
                disabled={!receiptData}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/10 px-5 py-3 text-sm font-bold text-white transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Printer className="h-4 w-4" />
                طباعة آخر فاتورة
              </button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}