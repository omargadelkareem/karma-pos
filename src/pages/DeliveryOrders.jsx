import React, { useContext, useMemo, useState } from "react";
import { PosContext } from "../context/PosContext";
import Card from "../components/Card";
import SectionTitle from "../components/SectionTitle";
import { Download, PhoneCall, MapPin, Truck, CheckCircle2, XCircle, CookingPot, Search, User } from "lucide-react";
import { currency } from "../utils/format";

const STATUS = [
  { key: "pending", label: "قيد الاستلام" },
  { key: "preparing", label: "تجهيز" },
  { key: "out_for_delivery", label: "في الطريق" },
  { key: "delivered", label: "تم التسليم" },
  { key: "canceled", label: "ملغي" },
];

function statusBadge(status) {
  const base = "inline-flex items-center rounded-xl px-3 py-1 text-xs font-bold";
  if (status === "pending") return `${base} bg-slate-100 text-slate-700`;
  if (status === "preparing") return `${base} bg-amber-100 text-amber-800`;
  if (status === "out_for_delivery") return `${base} bg-blue-100 text-blue-800`;
  if (status === "delivered") return `${base} bg-emerald-100 text-emerald-800`;
  if (status === "canceled") return `${base} bg-red-100 text-red-700`;
  return `${base} bg-slate-100 text-slate-700`;
}

function openCall(phone) {
  const p = String(phone || "").trim();
  if (!p) return window.alert("لا يوجد رقم هاتف");
  window.open(`tel:${p}`, "_self");
}

function openMaps(address) {
  const q = encodeURIComponent(String(address || "").trim());
  if (!q) return window.alert("لا يوجد عنوان");
  window.open(`https://www.google.com/maps/search/?api=1&query=${q}`, "_blank", "noopener,noreferrer");
}

export default function DeliveryOrders() {
  const {
    settings,
    employees,
    deliveryOrders,
    deliveryOrderForm,
    setDeliveryOrderForm,
    savingDeliveryOrder,
    saveDeliveryOrder,
    updateDeliveryOrderStatus,
    assignDeliveryDriver,
    exportDeliveryOrdersCsv,
  } = useContext(PosContext);

  const [query, setQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [expandedId, setExpandedId] = useState(null);

  const drivers = useMemo(() => {
    // لو عندك Roles استخدم roleTitle === "delivery" أو أي شرط
    return (employees || []).filter((e) => e.isActive);
  }, [employees]);

  const filtered = useMemo(() => {
    const q = String(query || "").trim().toLowerCase();
    return (deliveryOrders || []).filter((o) => {
      if (filterStatus !== "all" && o.status !== filterStatus) return false;
      if (!q) return true;
      const txt = `${o.customerName || ""} ${o.phone || ""} ${o.address || ""} ${o.area || ""} ${o.driverName || ""}`.toLowerCase();
      return txt.includes(q);
    });
  }, [deliveryOrders, query, filterStatus]);

  const stats = useMemo(() => {
    const all = deliveryOrders || [];
    const total = all.length;
    const pending = all.filter((x) => x.status === "pending" || x.status === "preparing" || x.status === "out_for_delivery").length;
    const delivered = all.filter((x) => x.status === "delivered").length;
    const canceled = all.filter((x) => x.status === "canceled").length;
    const revenueDelivered = all
      .filter((x) => x.status === "delivered")
      .reduce((s, x) => s + Number(x.grandTotal || 0), 0);

    return { total, pending, delivered, canceled, revenueDelivered };
  }, [deliveryOrders]);

  const toggle = (id) => setExpandedId((p) => (p === id ? null : id));

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
      {/* إنشاء طلب */}
      <Card className="xl:col-span-4">
        <SectionTitle title="طلب دليفري" subtitle="إنشاء طلب توصيل بسرعة" icon={Truck} />

        <div className="space-y-4">
          <input
            value={deliveryOrderForm.customerName}
            onChange={(e) => setDeliveryOrderForm((s) => ({ ...s, customerName: e.target.value }))}
            placeholder="اسم العميل"
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
          />

          <input
            value={deliveryOrderForm.phone}
            onChange={(e) => setDeliveryOrderForm((s) => ({ ...s, phone: e.target.value }))}
            placeholder="رقم الهاتف"
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
          />

          <input
            value={deliveryOrderForm.address}
            onChange={(e) => setDeliveryOrderForm((s) => ({ ...s, address: e.target.value }))}
            placeholder="العنوان بالتفصيل"
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
          />

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <input
              value={deliveryOrderForm.area}
              onChange={(e) => setDeliveryOrderForm((s) => ({ ...s, area: e.target.value }))}
              placeholder="المنطقة"
              className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
            />

            <select
              value={deliveryOrderForm.paymentMethod}
              onChange={(e) => setDeliveryOrderForm((s) => ({ ...s, paymentMethod: e.target.value }))}
              className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
            >
              <option value="cash">كاش</option>
              <option value="card">بطاقة</option>
              <option value="wallet">محفظة</option>
              <option value="transfer">تحويل</option>
            </select>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <input
              type="number"
              value={deliveryOrderForm.itemsTotal}
              onChange={(e) => setDeliveryOrderForm((s) => ({ ...s, itemsTotal: e.target.value }))}
              placeholder="إجمالي الأصناف"
              className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
            />
            <input
              type="number"
              value={deliveryOrderForm.deliveryFee}
              onChange={(e) => setDeliveryOrderForm((s) => ({ ...s, deliveryFee: e.target.value }))}
              placeholder="رسوم التوصيل"
              className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
            />
            <input
              type="number"
              value={deliveryOrderForm.grandTotal}
              onChange={(e) => setDeliveryOrderForm((s) => ({ ...s, grandTotal: e.target.value }))}
              placeholder="الإجمالي النهائي (اختياري)"
              className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
            />
          </div>

          <select
            value={deliveryOrderForm.driverId}
            onChange={(e) => {
              const id = e.target.value;
              const dr = drivers.find((d) => d.id === id);
              setDeliveryOrderForm((s) => ({ ...s, driverId: id, driverName: dr?.name || "" }));
            }}
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
          >
            <option value="">بدون مندوب الآن</option>
            {drivers.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>

          <input
            type="datetime-local"
            value={deliveryOrderForm.expectedAt}
            onChange={(e) => setDeliveryOrderForm((s) => ({ ...s, expectedAt: e.target.value }))}
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
          />

          <textarea
            rows={3}
            value={deliveryOrderForm.notes}
            onChange={(e) => setDeliveryOrderForm((s) => ({ ...s, notes: e.target.value }))}
            placeholder="ملاحظات (اختياري)"
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
          />

          <button
            onClick={saveDeliveryOrder}
            disabled={savingDeliveryOrder}
            className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-bold text-white"
          >
            <Truck className="h-4 w-4" />
            {savingDeliveryOrder ? "جاري الحفظ..." : "حفظ طلب الدليفري"}
          </button>
        </div>
      </Card>

      {/* القائمة + إدارة */}
      <Card className="xl:col-span-8">
        <SectionTitle
          title="طلبات الدليفري"
          subtitle="بحث + حالات + تعيين مندوب + تصدير"
          icon={Truck}
          action={
            <button
              onClick={() => exportDeliveryOrdersCsv(filtered)}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
            >
              <Download className="h-4 w-4" />
              تصدير CSV
            </button>
          }
        />

        {/* Stats */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <div className="rounded-2xl bg-slate-50 p-4">
            <p className="text-sm text-slate-500">إجمالي الطلبات</p>
            <p className="mt-2 text-xl font-black text-slate-900">{stats.total}</p>
          </div>
          <div className="rounded-2xl bg-blue-50 p-4">
            <p className="text-sm text-blue-700">تحتاج متابعة</p>
            <p className="mt-2 text-xl font-black text-blue-800">{stats.pending}</p>
          </div>
          <div className="rounded-2xl bg-emerald-50 p-4">
            <p className="text-sm text-emerald-700">تم التسليم</p>
            <p className="mt-2 text-xl font-black text-emerald-800">{stats.delivered}</p>
          </div>
          <div className="rounded-2xl bg-slate-50 p-4">
            <p className="text-sm text-slate-500">إيراد المسلّم</p>
            <p className="mt-2 text-xl font-black text-slate-900">
              {currency(stats.revenueDelivered, settings.currencyCode)}
            </p>
          </div>
        </div>

        {/* Search + filter */}
        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="relative md:col-span-2">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="بحث باسم/هاتف/عنوان/مندوب"
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-4 outline-none"
            />
          </div>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
          >
            <option value="all">كل الحالات</option>
            {STATUS.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </select>
        </div>

        {/* Orders */}
        <div className="mt-4 space-y-3">
          {filtered.map((o) => {
            const expanded = expandedId === o.id;
            return (
              <div key={o.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                <button
                  type="button"
                  onClick={() => toggle(o.id)}
                  className="flex w-full items-start justify-between gap-3 px-4 py-4 text-right hover:bg-slate-50"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-black text-slate-900">{o.customerName || "عميل"}</p>
                      <span className={statusBadge(o.status)}>{STATUS.find((x) => x.key === o.status)?.label || o.status}</span>
                    </div>

                    <p className="mt-1 text-sm text-slate-600">{o.phone || ""}</p>
                    <p className="mt-1 text-sm text-slate-500 line-clamp-1">{o.address || ""}</p>

                    <div className="mt-2 flex flex-wrap gap-2 text-xs">
                      <span className="rounded-xl bg-slate-100 px-3 py-1 font-bold text-slate-700">
                        الإجمالي: {currency(o.grandTotal || 0, settings.currencyCode)}
                      </span>
                      {o.driverName ? (
                        <span className="rounded-xl bg-blue-50 px-3 py-1 font-bold text-blue-700">
                          مندوب: {o.driverName}
                        </span>
                      ) : (
                        <span className="rounded-xl bg-amber-50 px-3 py-1 font-bold text-amber-800">
                          بدون مندوب
                        </span>
                      )}
                    </div>
                  </div>
                </button>

                {expanded ? (
                  <div className="border-t border-slate-200 bg-slate-50 px-4 py-4">
                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
                      <div className="lg:col-span-7">
                        <div className="rounded-2xl border border-slate-200 bg-white p-4">
                          <p className="font-black text-slate-900">تفاصيل الطلب</p>

                          <div className="mt-3 space-y-2 text-sm">
                            <div className="flex items-center gap-2">
                              <User className="h-4 w-4 text-slate-400" />
                              <span className="font-bold">{o.customerName}</span>
                            </div>

                            <div className="flex items-center gap-2">
                              <PhoneCall className="h-4 w-4 text-slate-400" />
                              <span>{o.phone}</span>
                            </div>

                            <div className="flex items-center gap-2">
                              <MapPin className="h-4 w-4 text-slate-400" />
                              <span className="truncate">{o.address}</span>
                            </div>

                            {o.notes ? <div className="rounded-2xl bg-slate-50 p-3 text-xs text-slate-600">{o.notes}</div> : null}

                            <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
                              <div className="rounded-2xl bg-slate-50 p-3">
                                <p className="text-xs text-slate-500">أصناف</p>
                                <p className="font-black">{currency(o.itemsTotal || 0, settings.currencyCode)}</p>
                              </div>
                              <div className="rounded-2xl bg-slate-50 p-3">
                                <p className="text-xs text-slate-500">توصيل</p>
                                <p className="font-black">{currency(o.deliveryFee || 0, settings.currencyCode)}</p>
                              </div>
                              <div className="rounded-2xl bg-slate-50 p-3">
                                <p className="text-xs text-slate-500">الإجمالي</p>
                                <p className="font-black">{currency(o.grandTotal || 0, settings.currencyCode)}</p>
                              </div>
                            </div>

                            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                              <button
                                onClick={() => openCall(o.phone)}
                                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-800"
                              >
                                <PhoneCall className="h-4 w-4" />
                                اتصال
                              </button>

                              <button
                                onClick={() => openMaps(o.address)}
                                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 py-2.5 text-sm font-bold text-white"
                              >
                                <MapPin className="h-4 w-4" />
                                فتح خرائط
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="lg:col-span-5">
                        <div className="rounded-2xl border border-slate-200 bg-white p-4">
                          <p className="font-black text-slate-900">إدارة الحالة والمندوب</p>

                          <div className="mt-3 space-y-3">
                            <select
                              value={o.status || "pending"}
                              onChange={(e) => updateDeliveryOrderStatus(o.id, e.target.value)}
                              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
                            >
                              {STATUS.map((s) => (
                                <option key={s.key} value={s.key}>
                                  {s.label}
                                </option>
                              ))}
                            </select>

                            <select
                              value={o.driverId || ""}
                              onChange={(e) => {
                                const id = e.target.value;
                                const dr = drivers.find((d) => d.id === id);
                                assignDeliveryDriver(o.id, id, dr?.name || "");
                              }}
                              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
                            >
                              <option value="">بدون مندوب</option>
                              {drivers.map((d) => (
                                <option key={d.id} value={d.id}>
                                  {d.name}
                                </option>
                              ))}
                            </select>

                            <div className="grid grid-cols-1 gap-2">
                              <button
                                onClick={() => updateDeliveryOrderStatus(o.id, "preparing")}
                                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-amber-600 px-4 py-2.5 text-sm font-bold text-white"
                              >
                                <CookingPot className="h-4 w-4" />
                                تجهيز
                              </button>
                              <button
                                onClick={() => updateDeliveryOrderStatus(o.id, "out_for_delivery")}
                                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white"
                              >
                                <Truck className="h-4 w-4" />
                                في الطريق
                              </button>
                              <button
                                onClick={() => updateDeliveryOrderStatus(o.id, "delivered")}
                                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white"
                              >
                                <CheckCircle2 className="h-4 w-4" />
                                تم التسليم
                              </button>
                              <button
                                onClick={() => updateDeliveryOrderStatus(o.id, "canceled")}
                                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-bold text-red-700"
                              >
                                <XCircle className="h-4 w-4" />
                                إلغاء
                              </button>
                            </div>

                            {o.expectedAt ? (
                              <div className="rounded-2xl bg-slate-50 p-3 text-xs text-slate-600">
                                موعد متوقع: {String(o.expectedAt)}
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

          {filtered.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 p-6 text-center text-slate-500">
              لا توجد طلبات
            </div>
          ) : null}
        </div>
      </Card>
    </div>
  );
}