import React, { useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  Package,
  Plus,
  RefreshCw,
  Save,
  Trash2,
  ChevronDown,
  Search,
  ScanBarcode,
  Pencil,
  X,
} from "lucide-react";
import { PosContext } from "../context/PosContext";
import { currency } from "../utils/format";
import Card from "../components/Card";
import SectionTitle from "../components/SectionTitle";

export default function Products() {
  const {
    settings,
    products,
    productForm,
    setProductForm,
    savingProduct,
    saveProduct,
    deleteProduct,
    editingProductId,
    startEditProduct,
    cancelEditProduct,
  } = useContext(PosContext);

  const [expandedId, setExpandedId] = useState(null);
  const [query, setQuery] = useState("");
  const [barcodeHint, setBarcodeHint] = useState("");

  const nameInputRef = useRef(null);
  const barcodeInputRef = useRef(null);
  const categoryInputRef = useRef(null);

  const itemsPerPackage = Number(productForm.itemsPerPackage || 0);
  const purchasePackagePrice = Number(productForm.purchasePackagePrice || 0);
  const purchaseItemPrice =
    itemsPerPackage > 0 ? purchasePackagePrice / itemsPerPackage : 0;

  useEffect(() => {
    nameInputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (editingProductId) {
      nameInputRef.current?.focus();
    }
  }, [editingProductId]);

  const normalizedBarcode = useMemo(
    () => String(productForm.barcode || "").trim(),
    [productForm.barcode]
  );

  const existingBarcodeProduct = useMemo(() => {
    if (!normalizedBarcode) return null;

    return (
      products.find(
        (item) =>
          item.id !== editingProductId &&
          String(item.barcode || "").trim() &&
          String(item.barcode || "").trim() === normalizedBarcode
      ) || null
    );
  }, [products, normalizedBarcode, editingProductId]);

  useEffect(() => {
    if (!normalizedBarcode) {
      setBarcodeHint("");
      return;
    }

    if (existingBarcodeProduct) {
      setBarcodeHint(`هذا الباركود مسجل بالفعل للمنتج: ${existingBarcodeProduct.name}`);
      return;
    }

    setBarcodeHint("تم التقاط الباركود");
  }, [normalizedBarcode, existingBarcodeProduct]);

  const filteredProducts = useMemo(() => {
    const q = String(query || "").trim().toLowerCase();
    if (!q) return products;

    return products.filter((item) => {
      const text = `${item.name || ""} ${item.category || ""} ${item.barcode || ""}`.toLowerCase();
      return text.includes(q);
    });
  }, [products, query]);

  const toggleExpand = (id) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  const handleBarcodeKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();

      if (existingBarcodeProduct) {
        window.alert(`هذا الباركود مستخدم بالفعل للمنتج: ${existingBarcodeProduct.name}`);
        return;
      }

      categoryInputRef.current?.focus();
    }
  };

  const handleSaveProduct = async () => {
    if (existingBarcodeProduct) {
      window.alert(`هذا الباركود مستخدم بالفعل للمنتج: ${existingBarcodeProduct.name}`);
      barcodeInputRef.current?.focus();
      return;
    }

    await saveProduct();

    setTimeout(() => {
      nameInputRef.current?.focus();
    }, 100);
  };

  const handleStartEdit = (product) => {
    startEditProduct(product);
    setExpandedId(product.id);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleCancelEdit = () => {
    cancelEditProduct();
    setTimeout(() => {
      nameInputRef.current?.focus();
    }, 100);
  };

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
      <Card className="xl:col-span-4">
        <SectionTitle
          title={editingProductId ? "تعديل المنتج" : "إضافة منتج للمخزن"}
          subtitle={
            editingProductId
              ? "يمكن تعديل السعر أو الكمية أو أي بيانات خاصة بالمنتج"
              : "يمكن كتابة أو مسح الباركود بالقارئ مباشرة"
          }
          icon={editingProductId ? Pencil : Plus}
        />

        {editingProductId ? (
          <div className="mb-4 rounded-2xl bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
            أنت الآن في وضع تعديل المنتج
          </div>
        ) : null}

        <div className="space-y-4">
          <input
            ref={nameInputRef}
            value={productForm.name}
            onChange={(e) => setProductForm((s) => ({ ...s, name: e.target.value }))}
            placeholder="اسم المنتج"
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:border-slate-400"
          />

          <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <ScanBarcode className="h-4 w-4 text-slate-500" />
                <span className="text-sm font-bold text-slate-700">الباركود</span>
              </div>

              <button
                type="button"
                onClick={() => barcodeInputRef.current?.focus()}
                className="rounded-xl bg-white px-3 py-2 text-xs font-bold text-slate-700 ring-1 ring-slate-200 hover:bg-slate-100"
              >
                تركيز على الباركود
              </button>
            </div>

            <input
              ref={barcodeInputRef}
              value={productForm.barcode}
              onChange={(e) => setProductForm((s) => ({ ...s, barcode: e.target.value }))}
              onKeyDown={handleBarcodeKeyDown}
              placeholder="امسح الباركود هنا بالقارئ"
              autoComplete="off"
              className={`w-full rounded-2xl border px-4 py-3 outline-none ${
                existingBarcodeProduct
                  ? "border-red-300 bg-red-50 focus:border-red-400"
                  : "border-slate-200 bg-white focus:border-slate-400"
              }`}
            />

            {barcodeHint ? (
              <div
                className={`rounded-2xl px-4 py-3 text-sm font-medium ${
                  existingBarcodeProduct
                    ? "bg-red-50 text-red-700"
                    : "bg-emerald-50 text-emerald-700"
                }`}
              >
                {barcodeHint}
              </div>
            ) : (
              <div className="rounded-2xl bg-white px-4 py-3 text-xs text-slate-500 ring-1 ring-slate-200">
                قارئ الباركود سيكتب هنا مباشرة مثل الكيبورد.
              </div>
            )}
          </div>

          <input
            ref={categoryInputRef}
            value={productForm.category}
            onChange={(e) => setProductForm((s) => ({ ...s, category: e.target.value }))}
            placeholder="القسم"
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:border-slate-400"
          />

          <div className="grid grid-cols-2 gap-4">
            <input
              value={productForm.packageName}
              onChange={(e) => setProductForm((s) => ({ ...s, packageName: e.target.value }))}
              placeholder="اسم العبوة"
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:border-slate-400"
            />

            <input
              type="number"
              value={productForm.itemsPerPackage}
              onChange={(e) => setProductForm((s) => ({ ...s, itemsPerPackage: e.target.value }))}
              placeholder="عدد القطع داخل العبوة"
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:border-slate-400"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <input
              type="number"
              value={productForm.purchasePackagePrice}
              onChange={(e) =>
                setProductForm((s) => ({ ...s, purchasePackagePrice: e.target.value }))
              }
              placeholder="سعر شراء العبوة"
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:border-slate-400"
            />

            <input
              value={purchaseItemPrice ? purchaseItemPrice.toFixed(2) : ""}
              readOnly
              placeholder="سعر شراء القطعة"
              className="w-full rounded-2xl border border-slate-200 bg-slate-100 px-4 py-3 outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <input
              type="number"
              value={productForm.saleItemPrice}
              onChange={(e) => setProductForm((s) => ({ ...s, saleItemPrice: e.target.value }))}
              placeholder="سعر بيع القطعة"
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:border-slate-400"
            />

            <input
              type="number"
              value={productForm.salePackagePrice}
              onChange={(e) => setProductForm((s) => ({ ...s, salePackagePrice: e.target.value }))}
              placeholder="سعر بيع العبوة"
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:border-slate-400"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <input
              type="number"
              value={productForm.packageQty}
              onChange={(e) => setProductForm((s) => ({ ...s, packageQty: e.target.value }))}
              placeholder="عدد العبوات الموجودة"
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:border-slate-400"
            />

            <input
              type="number"
              value={productForm.itemQty}
              onChange={(e) => setProductForm((s) => ({ ...s, itemQty: e.target.value }))}
              placeholder="عدد القطع المفردة"
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:border-slate-400"
            />
          </div>

          <input
            type="number"
            value={productForm.minPackageQty}
            onChange={(e) => setProductForm((s) => ({ ...s, minPackageQty: e.target.value }))}
            placeholder="حد النقص بالعبوات"
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:border-slate-400"
          />

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <button
              onClick={handleSaveProduct}
              disabled={savingProduct}
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-bold text-white transition hover:bg-slate-800 disabled:bg-slate-400"
            >
              {savingProduct ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              {editingProductId ? "حفظ التعديلات" : "حفظ المنتج"}
            </button>

            {editingProductId ? (
              <button
                onClick={handleCancelEdit}
                type="button"
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
                إلغاء التعديل
              </button>
            ) : null}
          </div>
        </div>
      </Card>

      <Card className="xl:col-span-8">
        <SectionTitle
          title="المخزن"
          subtitle="اضغط على المنتج لعرض التفاصيل أو تعديله"
          icon={Package}
          action={
            <div className="relative w-full max-w-sm">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="ابحث باسم المنتج أو الباركود"
                autoComplete="off"
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-4 text-sm outline-none focus:border-slate-400"
              />
            </div>
          }
        />

        <div className="space-y-3">
          {filteredProducts.map((item) => {
            const isExpanded = expandedId === item.id;

            return (
              <div
                key={item.id}
                className={`overflow-hidden rounded-2xl border transition ${
                  item.isLowStock
                    ? "border-amber-300 bg-amber-50"
                    : "border-slate-200 bg-white"
                }`}
              >
                <button
                  type="button"
                  onClick={() => toggleExpand(item.id)}
                  className="flex w-full items-center justify-between gap-3 px-4 py-4 text-right hover:bg-slate-50/70"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-black text-slate-900">
                        {item.name}
                      </h3>

                      {item.isLowStock ? (
                        <span className="rounded-xl bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-800">
                          ناقص
                        </span>
                      ) : (
                        <span className="rounded-xl bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-800">
                          جيد
                        </span>
                      )}
                    </div>

                    <div className="mt-2 grid grid-cols-1 gap-2 text-sm text-slate-600 md:grid-cols-4">
                      <p className="truncate">
                        القسم: <span className="font-bold">{item.category || "بدون قسم"}</span>
                      </p>
                      <p className="truncate">
                        الموجود:{" "}
                        <span className="font-bold">
                          {item.packageQty} {item.packageName}
                        </span>{" "}
                        + <span className="font-bold">{item.itemQty} قطعة</span>
                      </p>
                      <p className="truncate">
                        إجمالي القطع: <span className="font-bold">{item.totalItems}</span>
                      </p>
                      <p className="truncate">
                        القيمة:{" "}
                        <span className="font-bold text-emerald-700">
                          {currency(item.stockValue, settings.currencyCode)}
                        </span>
                      </p>
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
                    <div className="grid grid-cols-1 gap-3 text-sm text-slate-700 md:grid-cols-2">
                      <p>
                        الباركود: <span className="font-bold">{item.barcode || "—"}</span>
                      </p>
                      <p>
                        اسم العبوة: <span className="font-bold">{item.packageName}</span>
                      </p>
                      <p>
                        عدد القطع داخل العبوة:{" "}
                        <span className="font-bold">{item.itemsPerPackage}</span>
                      </p>
                      <p>
                        حد النقص:{" "}
                        <span className="font-bold">
                          {item.minPackageQty} {item.packageName}
                        </span>
                      </p>
                      <p>
                        سعر شراء العبوة:{" "}
                        <span className="font-bold">
                          {currency(item.purchasePackagePrice, settings.currencyCode)}
                        </span>
                      </p>
                      <p>
                        سعر شراء القطعة:{" "}
                        <span className="font-bold">
                          {currency(item.purchaseItemPrice, settings.currencyCode)}
                        </span>
                      </p>
                      <p>
                        سعر بيع القطعة:{" "}
                        <span className="font-bold text-emerald-700">
                          {currency(item.saleItemPrice, settings.currencyCode)}
                        </span>
                      </p>
                      <p>
                        سعر بيع العبوة:{" "}
                        <span className="font-bold text-emerald-700">
                          {currency(item.salePackagePrice, settings.currencyCode)}
                        </span>
                      </p>
                    </div>

                    <div className="mt-4 flex flex-wrap justify-end gap-3">
                      <button
                        onClick={() => handleStartEdit(item)}
                        className="inline-flex items-center gap-2 rounded-2xl bg-blue-50 px-4 py-2 text-sm font-bold text-blue-700 transition hover:bg-blue-100"
                      >
                        <Pencil className="h-4 w-4" />
                        تعديل المنتج
                      </button>

                      <button
                        onClick={() => deleteProduct(item.id)}
                        className="inline-flex items-center gap-2 rounded-2xl bg-red-50 px-4 py-2 text-sm font-bold text-red-700 transition hover:bg-red-100"
                      >
                        <Trash2 className="h-4 w-4" />
                        حذف المنتج
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })}

          {filteredProducts.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-slate-500">
              لا توجد منتجات مطابقة
            </div>
          ) : null}
        </div>
      </Card>
    </div>
  );
}