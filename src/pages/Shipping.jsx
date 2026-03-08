import React, { useContext, useMemo, useState } from "react";
import { Truck, Save, Search, Download } from "lucide-react";
import { PosContext } from "../context/PosContext";
import Card from "../components/Card";
import SectionTitle from "../components/SectionTitle";
import { currency } from "../utils/format";

function companyLabel(v) {
  switch (v) {
    case "egypt_post":
      return "البريد المصري";
    case "aramex":
      return "Aramex";
    case "bosta":
      return "Bosta";
    case "dhl":
      return "DHL";
    case "fedex":
      return "FedEx";
    default:
      return v || "شركة";
  }
}

function statusLabel(v) {
  switch (v) {
    case "pending":
      return "قيد الإدخال";
    case "shipped":
      return "تم الشحن";
    case "delivered":
      return "تم التسليم";
    case "returned":
      return "مرتجع";
    case "cancelled":
      return "ملغي";
    default:
      return v || "حالة";
  }
}

export default function Shipping() {
  const {
    settings,
    products,
    shipments,
    shipmentForm,
    setShipmentForm,
    savingShipment,
    saveShipment,
    updateShipmentStatus,
    exportShipmentsCsv,
  } = useContext(PosContext);

  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const productPreview = useMemo(() => {
    const productId = String(shipmentForm.productId || "").trim();
    if (!productId) return null;
    const p = products.find((x) => x.id === productId);
    if (!p) return null;

    const unitType = shipmentForm.unitType === "package" ? "package" : "item";
    const qty = Math.max(1, Number(shipmentForm.qty || 1));
    const unitPrice = unitType === "package" ? Number(p.salePackagePrice || 0) : Number(p.saleItemPrice || 0);
    const total = qty * unitPrice;

    return { name: p.name, unitType, qty, unitPrice, total };
  }, [shipmentForm.productId, shipmentForm.unitType, shipmentForm.qty, products]);

  const filtered = useMemo(() => {
    const q = String(query || "").trim().toLowerCase();
    return shipments.filter((s) => {
      if (statusFilter !== "all" && (s.status || "") !== statusFilter) return false;
      if (!q) return true;
      const text = `${s.customerName || ""} ${s.phone || ""} ${s.trackingNumber || ""} ${s.governorate || ""} ${s.productName || ""}`.toLowerCase();
      return text.includes(q);
    });
  }, [shipments, query, statusFilter]);

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
      {/* إضافة شحنة */}
      <Card className="xl:col-span-4">
        <SectionTitle
          title="إضافة شحنة"
          subtitle="بيانات العميل + بيانات الشحن + اختيار منتج اختياري"
          icon={Truck}
        />

        <div className="space-y-4">
          <input
            value={shipmentForm.customerName}
            onChange={(e) => setShipmentForm((s) => ({ ...s, customerName: e.target.value }))}
            placeholder="اسم العميل"
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
          />

          <input
            value={shipmentForm.phone}
            onChange={(e) => setShipmentForm((s) => ({ ...s, phone: e.target.value }))}
            placeholder="رقم الهاتف"
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
          />

          <input
            value={shipmentForm.governorate}
            onChange={(e) => setShipmentForm((s) => ({ ...s, governorate: e.target.value }))}
            placeholder="المحافظة"
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
          />

          <input
            value={shipmentForm.postOffice}
            onChange={(e) => setShipmentForm((s) => ({ ...s, postOffice: e.target.value }))}
            placeholder="مكتب البريد (اختياري)"
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
          />

          <div className="grid grid-cols-2 gap-3">
            <input
              value={shipmentForm.trackingNumber}
              onChange={(e) => setShipmentForm((s) => ({ ...s, trackingNumber: e.target.value }))}
              placeholder="رقم التتبع"
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
            />

            <input
              type="date"
              value={shipmentForm.entryDate}
              onChange={(e) => setShipmentForm((s) => ({ ...s, entryDate: e.target.value }))}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <select
              value={shipmentForm.shippingCompany}
              onChange={(e) => setShipmentForm((s) => ({ ...s, shippingCompany: e.target.value }))}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
            >
              <option value="egypt_post">البريد المصري</option>
              <option value="bosta">Bosta</option>
              <option value="aramex">Aramex</option>
              <option value="dhl">DHL</option>
              <option value="fedex">FedEx</option>
              <option value="other">أخرى</option>
            </select>

            <select
              value={shipmentForm.status}
              onChange={(e) => setShipmentForm((s) => ({ ...s, status: e.target.value }))}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
            >
              <option value="pending">قيد الإدخال</option>
              <option value="shipped">تم الشحن</option>
              <option value="delivered">تم التسليم</option>
              <option value="returned">مرتجع</option>
              <option value="cancelled">ملغي</option>
            </select>
          </div>

          <textarea
            rows={3}
            value={shipmentForm.notes}
            onChange={(e) => setShipmentForm((s) => ({ ...s, notes: e.target.value }))}
            placeholder="ملاحظات (اختياري)"
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
          />

          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="mb-3 font-black text-slate-900">اختيار منتج للشحنة (اختياري)</p>

            <select
              value={shipmentForm.productId}
              onChange={(e) => setShipmentForm((s) => ({ ...s, productId: e.target.value }))}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
            >
              <option value="">بدون منتج</option>
              {products.slice(0, 400).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} {p.barcode ? `(${p.barcode})` : ""}
                </option>
              ))}
            </select>

            {shipmentForm.productId ? (
              <div className="mt-3 grid grid-cols-2 gap-3">
                <select
                  value={shipmentForm.unitType}
                  onChange={(e) => setShipmentForm((s) => ({ ...s, unitType: e.target.value }))}
                  className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
                >
                  <option value="item">قطعة</option>
                  <option value="package">عبوة</option>
                </select>

                <input
                  type="number"
                  min="1"
                  value={shipmentForm.qty}
                  onChange={(e) => setShipmentForm((s) => ({ ...s, qty: e.target.value }))}
                  placeholder="الكمية"
                  className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
                />
              </div>
            ) : null}

            {productPreview ? (
              <div className="mt-3 rounded-2xl bg-slate-50 p-3 text-sm text-slate-700">
                <p className="font-bold">{productPreview.name}</p>
                <p className="mt-1">
                  {productPreview.qty} × {productPreview.unitType === "package" ? "عبوة" : "قطعة"} ×{" "}
                  {currency(productPreview.unitPrice, settings.currencyCode)}
                </p>
                <p className="mt-1 font-black">
                  الإجمالي: {currency(productPreview.total, settings.currencyCode)}
                </p>
              </div>
            ) : null}
          </div>

          <button
            onClick={saveShipment}
            disabled={savingShipment}
            className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-bold text-white hover:bg-slate-800 disabled:bg-slate-400"
          >
            <Save className="h-4 w-4" />
            {savingShipment ? "جاري الحفظ..." : "حفظ الشحنة"}
          </button>
        </div>
      </Card>

      {/* قائمة الشحنات */}
      <Card className="xl:col-span-8">
        <SectionTitle
          title="إدارة الشحنات"
          subtitle="بحث + فلتر + تغيير الحالة"
          icon={Truck}
          action={
            <button
              onClick={() => exportShipmentsCsv(filtered)}
              className="inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
            >
              <Download className="h-4 w-4" />
              تصدير Excel (CSV)
            </button>
          }
        />

        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="relative md:col-span-2">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="بحث بالاسم / الهاتف / التتبع / المحافظة / المنتج"
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-4 outline-none"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
          >
            <option value="all">كل الحالات</option>
            <option value="pending">قيد الإدخال</option>
            <option value="shipped">تم الشحن</option>
            <option value="delivered">تم التسليم</option>
            <option value="returned">مرتجع</option>
            <option value="cancelled">ملغي</option>
          </select>
        </div>

        <div className="mt-4 space-y-3">
          {filtered.map((s) => (
            <div key={s.id} className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div className="min-w-0">
                  <p className="font-black text-slate-900">{s.customerName}</p>
                  <p className="text-sm text-slate-600">
                    {s.phone} • {s.governorate}
                    {s.postOffice ? ` • ${s.postOffice}` : ""}
                  </p>

                  <p className="mt-1 text-xs text-slate-500">
                    تاريخ الإدخال: {s.entryDate || "—"} • شركة: {companyLabel(s.shippingCompany)}
                  </p>

                  <p className="mt-1 text-xs text-slate-500">
                    رقم التتبع: <span className="font-bold">{s.trackingNumber || "—"}</span>
                  </p>

                  {s.productName ? (
                    <div className="mt-3 rounded-2xl bg-slate-50 p-3 text-sm text-slate-700">
                      <p className="font-bold">منتج الشحنة: {s.productName}</p>
                      <p className="mt-1">
                        {s.qty} × {s.unitType === "package" ? "عبوة" : "قطعة"} ×{" "}
                        {currency(s.unitPrice || 0, settings.currencyCode)}
                      </p>
                      <p className="mt-1 font-black">
                        إجمالي المنتج: {currency(s.total || 0, settings.currencyCode)}
                      </p>
                    </div>
                  ) : null}

                  {s.notes ? <p className="mt-2 text-sm text-slate-600">ملاحظات: {s.notes}</p> : null}
                </div>

                <div className="grid gap-2">
                  <div className="rounded-2xl bg-slate-50 px-4 py-2 text-sm font-bold text-slate-700">
                    الحالة: {statusLabel(s.status)}
                  </div>

                  <select
                    value={s.status || "pending"}
                    onChange={(e) => updateShipmentStatus(s.id, e.target.value)}
                    className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none"
                  >
                    <option value="pending">قيد الإدخال</option>
                    <option value="shipped">تم الشحن</option>
                    <option value="delivered">تم التسليم</option>
                    <option value="returned">مرتجع</option>
                    <option value="cancelled">ملغي</option>
                  </select>
                </div>
              </div>
            </div>
          ))}

          {filtered.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-slate-500">
              لا توجد شحنات مطابقة
            </div>
          ) : null}
        </div>
      </Card>
    </div>
  );
}