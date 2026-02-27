import React, { useContext } from "react";
import { FilePlus2, Minus, Plus, Save, Trash2 } from "lucide-react";
import { PosContext } from "../context/PosContext";
import { currency } from "../utils/format";
import Card from "../components/Card";
import SectionTitle from "../components/SectionTitle";

export default function PurchaseInvoices() {
  const {
    settings,
    suppliers,
    products,
    purchaseInvoiceForm,
    setPurchaseInvoiceForm,
    purchaseCart,
    purchaseSubtotal,
    purchasePaidAmount,
    purchaseRemainingAmount,
    addPurchaseItem,
    increasePurchaseItem,
    decreasePurchaseItem,
    updatePurchaseItemPrice,
    removePurchaseItem,
    clearPurchaseCart,
    savePurchaseInvoice,
    savingPurchaseInvoice,
    purchaseInvoices,
  } = useContext(PosContext);

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
      <Card className="xl:col-span-5">
        <SectionTitle title="فاتورة شراء" subtitle="أضف المنتجات وزوّد المخزن" icon={FilePlus2} />

        <div className="space-y-4">
          <select
            value={purchaseInvoiceForm.supplierId}
            onChange={(e) => setPurchaseInvoiceForm((s) => ({ ...s, supplierId: e.target.value }))}
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
          >
            <option value="">اختر المورد</option>
            {suppliers.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>

          <select
            onChange={(e) => {
              if (e.target.value) addPurchaseItem(e.target.value);
              e.target.value = "";
            }}
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
          >
            <option value="">اختر منتجًا لإضافته</option>
            {products.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>

          <textarea
            rows={3}
            value={purchaseInvoiceForm.notes}
            onChange={(e) => setPurchaseInvoiceForm((s) => ({ ...s, notes: e.target.value }))}
            placeholder="ملاحظات"
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
          />

          <input
            type="number"
            value={purchaseInvoiceForm.paidAmount}
            onChange={(e) => setPurchaseInvoiceForm((s) => ({ ...s, paidAmount: e.target.value }))}
            placeholder="المبلغ المدفوع"
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
          />
        </div>

        <div className="mt-5 space-y-3">
          {purchaseCart.map((item) => (
            <div key={item.productId} className="rounded-2xl bg-slate-50 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h4 className="font-bold">{item.productName}</h4>
                  <p className="text-xs text-slate-500">{item.packageName}</p>
                </div>
                <button
                  onClick={() => removePurchaseItem(item.productId)}
                  className="rounded-xl p-2 text-red-600 hover:bg-red-50"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>

              <div className="mt-3 flex items-center gap-2">
                <button
                  onClick={() => decreasePurchaseItem(item.productId)}
                  className="rounded-xl border border-slate-200 p-2"
                >
                  <Minus className="h-4 w-4" />
                </button>

                <div className="min-w-12 rounded-xl bg-white px-4 py-2 text-center text-sm font-semibold shadow-sm">
                  {item.packageQty}
                </div>

                <button
                  onClick={() => increasePurchaseItem(item.productId)}
                  className="rounded-xl border border-slate-200 p-2"
                >
                  <Plus className="h-4 w-4" />
                </button>

                <input
                  type="number"
                  value={item.purchasePackagePrice}
                  onChange={(e) => updatePurchaseItemPrice(item.productId, e.target.value)}
                  className="mr-auto w-36 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none"
                />
              </div>

              <div className="mt-2 text-sm font-bold">
                الإجمالي: {currency(item.total, settings.currencyCode)}
              </div>
            </div>
          ))}

          {purchaseCart.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 p-6 text-center text-slate-500">
              لا توجد أصناف في فاتورة الشراء
            </div>
          ) : null}
        </div>

        <div className="mt-5 rounded-3xl bg-slate-950 p-5 text-white">
          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span>إجمالي الفاتورة</span>
              <span>{currency(purchaseSubtotal, settings.currencyCode)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>المدفوع</span>
              <span>{currency(purchasePaidAmount, settings.currencyCode)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>المتبقي</span>
              <span>{currency(purchaseRemainingAmount, settings.currencyCode)}</span>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2">
            <button
              onClick={savePurchaseInvoice}
              disabled={savingPurchaseInvoice}
              className="rounded-2xl bg-white px-5 py-3 text-sm font-bold text-slate-900"
            >
              {savingPurchaseInvoice ? "جاري الحفظ..." : "حفظ فاتورة الشراء"}
            </button>

            <button
              onClick={clearPurchaseCart}
              className="rounded-2xl border border-white/20 bg-white/10 px-5 py-3 text-sm font-bold text-white"
            >
              مسح الفاتورة
            </button>
          </div>
        </div>
      </Card>

      <Card className="xl:col-span-7">
        <SectionTitle title="آخر فواتير الشراء" subtitle="تفاصيل أحدث الفواتير" icon={FilePlus2} />

        <div className="space-y-3">
          {purchaseInvoices.map((item) => (
            <div key={item.id} className="rounded-2xl bg-slate-50 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-bold">{item.invoiceNumber}</p>
                  <p className="text-sm text-slate-500">{item.supplierName}</p>
                  <p className="text-xs text-slate-500">
                    {item.createdAt ? new Date(item.createdAt).toLocaleString("ar-EG") : ""}
                  </p>
                </div>
                <div className="text-left text-sm">
                  <p>الإجمالي: {currency(item.subtotal, settings.currencyCode)}</p>
                  <p>المدفوع: {currency(item.paidAmount, settings.currencyCode)}</p>
                  <p>المتبقي: {currency(item.remainingAmount, settings.currencyCode)}</p>
                </div>
              </div>
            </div>
          ))}

          {purchaseInvoices.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 p-6 text-center text-slate-500">
              لا توجد فواتير شراء بعد
            </div>
          ) : null}
        </div>
      </Card>
    </div>
  );
}