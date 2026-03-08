
    import React, { useContext, useMemo, useState } from "react";
import {
  BadgePercent,
  Save,
  RefreshCw,
  Search,
  Pencil,
  Trash2,
  X,
  Download,
  CalendarDays,
  Layers,
  Package,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { PosContext } from "../context/PosContext";
import Card from "../components/Card";
import SectionTitle from "../components/SectionTitle";
import { currency } from "../utils/format";

function typeLabel(type) {
  switch (type) {
    case "percent":
      return "خصم نسبة %";
    case "fixed":
      return "خصم مبلغ ثابت";
    case "buy_x_get_y":
      return "اشتري X وخد Y";
    default:
      return type || "عرض";
  }
}

function scopeLabel(scope) {
  switch (scope) {
    case "all":
      return "كل المنتجات";
    case "category":
      return "قسم محدد";
    case "product":
      return "منتج محدد";
    default:
      return scope || "نطاق";
  }
}

export default function Offers() {
  const {
    settings,
    products,
    offers,
    offerForm,
    setOfferForm,
    savingOffer,
    saveOffer,
    editingOfferId,
    startEditOffer,
    cancelEditOffer,
    deleteOffer,
    exportOffersCsv,
  } = useContext(PosContext);

  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all"); // all | active | inactive | expired
  const [typeFilter, setTypeFilter] = useState("all"); // all | percent | fixed | buy_x_get_y

  const nowTs = Date.now();
  const todayStr = new Date().toISOString().slice(0, 10);

  const categories = useMemo(() => {
    const setCat = new Set();
    (products || []).forEach((p) => {
      const c = String(p.category || "").trim();
      if (c) setCat.add(c);
    });
    return Array.from(setCat).sort((a, b) => a.localeCompare(b, "ar"));
  }, [products]);

  const filteredOffers = useMemo(() => {
    const q = String(query || "").trim().toLowerCase();

    return (offers || []).filter((o) => {
      const matchesQuery = q
        ? `${o.title || ""} ${o.code || ""} ${o.scope || ""} ${o.categoryName || ""} ${o.productName || ""}`
            .toLowerCase()
            .includes(q)
        : true;

      const isExpired = o.endDate ? o.endDate < todayStr : false;
      const isActive = !!o.isActive && !isExpired;

      const matchesStatus =
        statusFilter === "all"
          ? true
          : statusFilter === "active"
          ? isActive
          : statusFilter === "inactive"
          ? !o.isActive && !isExpired
          : statusFilter === "expired"
          ? isExpired
          : true;

      const matchesType = typeFilter === "all" ? true : o.type === typeFilter;

      return matchesQuery && matchesStatus && matchesType;
    });
  }, [offers, query, statusFilter, typeFilter, todayStr]);

  const stats = useMemo(() => {
    const list = offers || [];
    const total = list.length;

    const expired = list.filter((o) => (o.endDate ? o.endDate < todayStr : false)).length;
    const active = list.filter((o) => !!o.isActive && !(o.endDate ? o.endDate < todayStr : false)).length;
    const inactive = total - active - expired;

    return { total, active, inactive, expired };
  }, [offers, todayStr]);

  const preview = useMemo(() => {
    // معاينة بسيطة للعرض حسب النوع
    const t = offerForm.type;
    if (t === "percent") {
      const p = Number(offerForm.percent || 0);
      return p > 0 ? `خصم ${p}%` : "خصم نسبة";
    }
    if (t === "fixed") {
      const a = Number(offerForm.fixedAmount || 0);
      return a > 0 ? `خصم ${currency(a, settings.currencyCode)}` : "خصم مبلغ";
    }
    if (t === "buy_x_get_y") {
      const bx = Number(offerForm.buyQty || 0);
      const gy = Number(offerForm.getQty || 0);
      return bx > 0 && gy > 0 ? `اشتري ${bx} وخد ${gy} مجانًا` : "اشتري X وخد Y";
    }
    return "عرض";
  }, [offerForm, settings.currencyCode]);

  const handleSave = async () => {
    await saveOffer();
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const canChooseCategory = offerForm.scope === "category";
  const canChooseProduct = offerForm.scope === "product";

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
      {/* إضافة/تعديل عرض */}
      <Card className="xl:col-span-4">
        <SectionTitle
          title={editingOfferId ? "تعديل عرض" : "إضافة عرض"}
          subtitle="اعمل عروض بسيطة للخصومات أو الباقات"
          icon={BadgePercent}
        />

        {editingOfferId ? (
          <div className="mb-4 rounded-2xl bg-amber-50 px-4 py-3 text-sm font-bold text-amber-800">
            أنت الآن في وضع تعديل عرض
          </div>
        ) : null}

        <div className="space-y-4">
          <input
            value={offerForm.title}
            onChange={(e) => setOfferForm((s) => ({ ...s, title: e.target.value }))}
            placeholder="اسم العرض (مثال: خصم رمضان)"
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:border-slate-400"
          />

          <div className="grid grid-cols-2 gap-3">
            <input
              value={offerForm.code}
              onChange={(e) => setOfferForm((s) => ({ ...s, code: e.target.value.toUpperCase() }))}
              placeholder="كود العرض (اختياري)"
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:border-slate-400"
            />

            <select
              value={offerForm.type}
              onChange={(e) => setOfferForm((s) => ({ ...s, type: e.target.value }))}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
            >
              <option value="percent">خصم نسبة %</option>
              <option value="fixed">خصم مبلغ ثابت</option>
              <option value="buy_x_get_y">اشتري X وخد Y</option>
            </select>
          </div>

          {/* إعدادات حسب نوع العرض */}
          {offerForm.type === "percent" ? (
            <input
              type="number"
              value={offerForm.percent}
              onChange={(e) => setOfferForm((s) => ({ ...s, percent: e.target.value }))}
              placeholder="نسبة الخصم % (مثال: 10)"
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
            />
          ) : null}

          {offerForm.type === "fixed" ? (
            <input
              type="number"
              value={offerForm.fixedAmount}
              onChange={(e) => setOfferForm((s) => ({ ...s, fixedAmount: e.target.value }))}
              placeholder="قيمة الخصم (مثال: 20)"
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
            />
          ) : null}

          {offerForm.type === "buy_x_get_y" ? (
            <div className="grid grid-cols-2 gap-3">
              <input
                type="number"
                value={offerForm.buyQty}
                onChange={(e) => setOfferForm((s) => ({ ...s, buyQty: e.target.value }))}
                placeholder="X (يشتري)"
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
              />
              <input
                type="number"
                value={offerForm.getQty}
                onChange={(e) => setOfferForm((s) => ({ ...s, getQty: e.target.value }))}
                placeholder="Y (مجانًا)"
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
              />
            </div>
          ) : null}

          <div className="grid grid-cols-2 gap-3">
            <select
              value={offerForm.scope}
              onChange={(e) =>
                setOfferForm((s) => ({
                  ...s,
                  scope: e.target.value,
                  categoryId: "",
                  productId: "",
                }))
              }
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
            >
              <option value="all">كل المنتجات</option>
              <option value="category">قسم محدد</option>
              <option value="product">منتج محدد</option>
            </select>

            <select
              value={offerForm.applyOn}
              onChange={(e) => setOfferForm((s) => ({ ...s, applyOn: e.target.value }))}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
            >
              <option value="items_only">على القطعة فقط</option>
              <option value="packages_only">على العبوة فقط</option>
              <option value="both">على الاثنين</option>
            </select>
          </div>

          {canChooseCategory ? (
            <select
              value={offerForm.categoryId}
              onChange={(e) => setOfferForm((s) => ({ ...s, categoryId: e.target.value }))}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
            >
              <option value="">اختر القسم</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          ) : null}

          {canChooseProduct ? (
            <select
              value={offerForm.productId}
              onChange={(e) => setOfferForm((s) => ({ ...s, productId: e.target.value }))}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
            >
              <option value="">اختر المنتج</option>
              {(products || []).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} {p.barcode ? `- ${p.barcode}` : ""}
                </option>
              ))}
            </select>
          ) : null}

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <label className="mb-2 block text-xs font-bold text-slate-600">
                <CalendarDays className="inline h-4 w-4 ml-1" />
                تاريخ البداية
              </label>
              <input
                type="date"
                value={offerForm.startDate}
                onChange={(e) => setOfferForm((s) => ({ ...s, startDate: e.target.value }))}
                className="w-full bg-transparent outline-none"
              />
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <label className="mb-2 block text-xs font-bold text-slate-600">
                <CalendarDays className="inline h-4 w-4 ml-1" />
                تاريخ النهاية
              </label>
              <input
                type="date"
                value={offerForm.endDate}
                onChange={(e) => setOfferForm((s) => ({ ...s, endDate: e.target.value }))}
                className="w-full bg-transparent outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <input
              type="number"
              value={offerForm.minCartTotal}
              onChange={(e) => setOfferForm((s) => ({ ...s, minCartTotal: e.target.value }))}
              placeholder="حد أدنى للفاتورة (اختياري)"
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
            />

            <input
              type="number"
              value={offerForm.maxDiscount}
              onChange={(e) => setOfferForm((s) => ({ ...s, maxDiscount: e.target.value }))}
              placeholder="حد أقصى للخصم (اختياري)"
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
            />
          </div>

          <textarea
            rows={3}
            value={offerForm.notes}
            onChange={(e) => setOfferForm((s) => ({ ...s, notes: e.target.value }))}
            placeholder="ملاحظات (اختياري)"
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
          />

          <label className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3">
            <span className="text-sm font-bold text-slate-700">
              {offerForm.isActive ? (
                <span className="inline-flex items-center gap-2 text-emerald-700">
                  <CheckCircle2 className="h-4 w-4" />
                  العرض مفعل
                </span>
              ) : (
                <span className="inline-flex items-center gap-2 text-red-700">
                  <XCircle className="h-4 w-4" />
                  العرض غير مفعل
                </span>
              )}
            </span>
            <input
              type="checkbox"
              checked={!!offerForm.isActive}
              onChange={(e) => setOfferForm((s) => ({ ...s, isActive: e.target.checked }))}
            />
          </label>

          <div className="rounded-2xl bg-slate-950 p-4 text-white">
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-300">معاينة العرض</span>
              <span className="rounded-xl bg-white/10 px-3 py-1 text-xs font-bold">
                {scopeLabel(offerForm.scope)}
              </span>
            </div>
            <p className="mt-2 text-xl font-black">{offerForm.title || "اسم العرض"}</p>
            <p className="mt-1 text-sm text-slate-300">{preview}</p>
            <p className="mt-2 text-xs text-slate-300">
              النوع: {typeLabel(offerForm.type)} • التطبيق:{" "}
              {offerForm.applyOn === "items_only"
                ? "قطعة"
                : offerForm.applyOn === "packages_only"
                ? "عبوة"
                : "الاثنين"}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <button
              onClick={handleSave}
              disabled={savingOffer}
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-bold text-white hover:bg-slate-800 disabled:bg-slate-400"
            >
              {savingOffer ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {editingOfferId ? "حفظ التعديل" : "حفظ العرض"}
            </button>

            {editingOfferId ? (
              <button
                type="button"
                onClick={cancelEditOffer}
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-700 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
                إلغاء
              </button>
            ) : null}
          </div>
        </div>
      </Card>

      {/* قائمة العروض */}
      <Card className="xl:col-span-8">
        <SectionTitle
          title="إدارة العروض"
          subtitle="بحث + فلترة + تعديل + تصدير"
          icon={BadgePercent}
          action={
            <button
              onClick={() => exportOffersCsv(filteredOffers)}
              className="inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
            >
              <Download className="h-4 w-4" />
              تصدير CSV
            </button>
          }
        />

        {/* إحصائيات */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <div className="rounded-2xl bg-slate-50 p-4">
            <p className="text-sm text-slate-500">إجمالي العروض</p>
            <p className="mt-2 text-2xl font-black text-slate-900">{stats.total}</p>
          </div>
          <div className="rounded-2xl bg-emerald-50 p-4">
            <p className="text-sm text-emerald-700">عروض فعّالة</p>
            <p className="mt-2 text-2xl font-black text-emerald-700">{stats.active}</p>
          </div>
          <div className="rounded-2xl bg-slate-100 p-4">
            <p className="text-sm text-slate-600">غير فعالة</p>
            <p className="mt-2 text-2xl font-black text-slate-900">{stats.inactive}</p>
          </div>
          <div className="rounded-2xl bg-red-50 p-4">
            <p className="text-sm text-red-700">منتهية</p>
            <p className="mt-2 text-2xl font-black text-red-700">{stats.expired}</p>
          </div>
        </div>

        {/* بحث + فلترة */}
        <div className="mt-5 grid grid-cols-1 gap-4 xl:grid-cols-12">
          <div className="xl:col-span-6">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="بحث بالاسم / الكود / القسم / المنتج"
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-4 text-sm outline-none"
              />
            </div>
          </div>

          <div className="xl:col-span-3">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none"
            >
              <option value="all">كل الحالات</option>
              <option value="active">فعّالة</option>
              <option value="inactive">غير فعّالة</option>
              <option value="expired">منتهية</option>
            </select>
          </div>

          <div className="xl:col-span-3">
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none"
            >
              <option value="all">كل الأنواع</option>
              <option value="percent">خصم %</option>
              <option value="fixed">خصم مبلغ</option>
              <option value="buy_x_get_y">اشتري X وخد Y</option>
            </select>
          </div>
        </div>

        {/* جدول/قائمة */}
        <div className="mt-5 space-y-3">
          {filteredOffers.map((o) => {
            const expired = o.endDate ? o.endDate < todayStr : false;
            const active = !!o.isActive && !expired;

            return (
              <div key={o.id} className="rounded-3xl border border-slate-200 bg-white p-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-lg font-black text-slate-900">{o.title}</p>

                      {active ? (
                        <span className="rounded-xl bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-800">
                          فعّال
                        </span>
                      ) : expired ? (
                        <span className="rounded-xl bg-red-100 px-2.5 py-1 text-xs font-bold text-red-800">
                          منتهي
                        </span>
                      ) : (
                        <span className="rounded-xl bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700">
                          غير فعّال
                        </span>
                      )}

                      {o.code ? (
                        <span className="rounded-xl bg-slate-950 px-2.5 py-1 text-xs font-bold text-white">
                          {o.code}
                        </span>
                      ) : null}
                    </div>

                    <div className="mt-2 grid grid-cols-1 gap-2 text-sm text-slate-600 md:grid-cols-3">
                      <p className="inline-flex items-center gap-2">
                        <BadgePercent className="h-4 w-4" />
                        {typeLabel(o.type)} • {o.previewText || ""}
                      </p>
                      <p className="inline-flex items-center gap-2">
                        {o.scope === "category" ? <Layers className="h-4 w-4" /> : <Package className="h-4 w-4" />}
                        {scopeLabel(o.scope)}{" "}
                        {o.scope === "category" ? `• ${o.categoryName || ""}` : o.scope === "product" ? `• ${o.productName || ""}` : ""}
                      </p>
                      <p className="inline-flex items-center gap-2">
                        <CalendarDays className="h-4 w-4" />
                        {o.startDate || "—"} → {o.endDate || "—"}
                      </p>
                    </div>

                    {Number(o.minCartTotal || 0) > 0 ? (
                      <p className="mt-2 text-xs text-slate-500">
                        حد أدنى للفاتورة: <span className="font-bold">{currency(o.minCartTotal, settings.currencyCode)}</span>
                        {Number(o.maxDiscount || 0) > 0 ? (
                          <>
                            {" "}• حد أقصى للخصم:{" "}
                            <span className="font-bold">{currency(o.maxDiscount, settings.currencyCode)}</span>
                          </>
                        ) : null}
                      </p>
                    ) : null}

                    {o.notes ? <p className="mt-2 text-xs text-slate-500">ملاحظات: {o.notes}</p> : null}
                  </div>

                  <div className="flex shrink-0 flex-wrap gap-2">
                    <button
                      onClick={() => startEditOffer(o)}
                      className="inline-flex items-center gap-2 rounded-2xl bg-blue-50 px-4 py-2 text-sm font-bold text-blue-700 hover:bg-blue-100"
                    >
                      <Pencil className="h-4 w-4" />
                      تعديل
                    </button>

                    <button
                      onClick={() => deleteOffer(o.id)}
                      className="inline-flex items-center gap-2 rounded-2xl bg-red-50 px-4 py-2 text-sm font-bold text-red-700 hover:bg-red-100"
                    >
                      <Trash2 className="h-4 w-4" />
                      حذف
                    </button>
                  </div>
                </div>
              </div>
            );
          })}

          {filteredOffers.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-slate-500">
              لا توجد عروض مطابقة
            </div>
          ) : null}
        </div>
      </Card>
    </div>
  );
}