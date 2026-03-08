import React, { useContext, useMemo, useState } from "react";
import {
  Warehouse,
  Search,
  Download,
  AlertTriangle,
  Ban,
  Package,
  CalendarClock,
  Layers,
} from "lucide-react";
import { PosContext } from "../context/PosContext";
import Card from "../components/Card";
import SectionTitle from "../components/SectionTitle";
import { currency, numberFormat } from "../utils/format";
import { downloadCsv } from "../utils/csv";

function toNumber(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function daysBetween(aTs, bTs) {
  const ms = bTs - aTs;
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

function parseExpiryDate(yyyy_mm_dd) {
  const s = String(yyyy_mm_dd || "").trim();
  if (!s) return null;
  // YYYY-MM-DD
  const d = new Date(`${s}T12:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function expiryStatus(expiryDateStr, warnDays = 30) {
  const d = parseExpiryDate(expiryDateStr);
  if (!d) return { status: "none", label: "—", daysLeft: null };

  const now = new Date();
  const daysLeft = daysBetween(now.getTime(), d.getTime());

  if (daysLeft < 0) return { status: "expired", label: "منتهي", daysLeft };
  if (daysLeft <= warnDays) return { status: "soon", label: "قريب", daysLeft };
  return { status: "ok", label: "سليم", daysLeft };
}

export default function InventoryAudit() {
  const {
    settings,
    products,
    warehouses,
    activeWarehouseId,
    setActiveWarehouseId,
  } = useContext(PosContext);

  const [query, setQuery] = useState("");
  const [stockFilter, setStockFilter] = useState("all"); // all | low | out | expSoon | expired
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [expiryWarnDays, setExpiryWarnDays] = useState(30);

  const activeWarehouse = useMemo(() => {
    return (warehouses || []).find((w) => w.id === activeWarehouseId) || null;
  }, [warehouses, activeWarehouseId]);

  // استخراج الأقسام الموجودة فعلاً
  const categories = useMemo(() => {
    const setCat = new Set();
    (products || []).forEach((p) => {
      const name = String(p.categoryName || p.category || "").trim();
      if (name) setCat.add(name);
    });
    return Array.from(setCat).sort((a, b) => a.localeCompare(b, "ar"));
  }, [products]);

  // تجهيز rows للجرد + اشتقاقات
  const rows = useMemo(() => {
    const q = String(query || "").trim().toLowerCase();

    return (products || []).map((p) => {
      const totalItems = toNumber(p.totalItems);
      const packageQty = toNumber(p.packageQty);
      const itemQty = toNumber(p.itemQty);
      const stockValue = toNumber(p.stockValue);
      const catName = String(p.categoryName || p.category || "").trim() || "بدون قسم";

      const exp = expiryStatus(p.expiryDate, toNumber(expiryWarnDays, 30));

      const out = totalItems <= 0;
      const low = !!p.isLowStock && totalItems > 0;

      // فلترة بحث/قسم/مخزون/صلاحية
      const matchesQuery = q
        ? `${p.name || ""} ${p.barcode || ""} ${catName}`.toLowerCase().includes(q)
        : true;

      const matchesCategory =
        categoryFilter === "all" ? true : catName === categoryFilter;

      const matchesStock =
        stockFilter === "all"
          ? true
          : stockFilter === "out"
          ? out
          : stockFilter === "low"
          ? low
          : stockFilter === "expired"
          ? exp.status === "expired"
          : stockFilter === "expSoon"
          ? exp.status === "soon"
          : true;

      return {
        id: p.id,
        name: p.name || "",
        barcode: p.barcode || "",
        categoryName: catName,
        packageUnitName: p.packageUnitName || p.packageName || "عبوة",
        baseUnitName: p.baseUnitName || "قطعة",
        itemsPerPackage: toNumber(p.itemsPerPackage, 1),
        packageQty,
        itemQty,
        totalItems,
        purchasePackagePrice: toNumber(p.purchasePackagePrice),
        purchaseItemPrice: toNumber(p.purchaseItemPrice),
        stockValue,
        expiryDate: p.expiryDate || "",
        expiry: exp, // {status,label,daysLeft}
        isLowStock: low,
        isOut: out,
        _show: matchesQuery && matchesCategory && matchesStock,
      };
    });
  }, [products, query, categoryFilter, stockFilter, expiryWarnDays]);

  const filteredRows = useMemo(() => rows.filter((r) => r._show), [rows]);

  // إحصائيات
  const stats = useMemo(() => {
    const totalProducts = rows.length;
    const inventoryValue = rows.reduce((s, r) => s + toNumber(r.stockValue), 0);
    const lowCount = rows.filter((r) => r.isLowStock).length;
    const outCount = rows.filter((r) => r.isOut).length;
    const expiredCount = rows.filter((r) => r.expiry.status === "expired").length;
    const expSoonCount = rows.filter((r) => r.expiry.status === "soon").length;
    const categoriesCount = new Set(rows.map((r) => r.categoryName)).size;

    return {
      totalProducts,
      inventoryValue,
      lowCount,
      outCount,
      expiredCount,
      expSoonCount,
      categoriesCount,
    };
  }, [rows]);

  const exportAuditCsv = () => {
    const headers = [
      "المخزن",
      "اسم المنتج",
      "القسم",
      "الباركود",
      "الصلاحية",
      "حالة الصلاحية",
      "عبوات",
      "قطع",
      "إجمالي قطع",
      "سعر شراء العبوة",
      "سعر شراء القطعة",
      "قيمة المخزون (شراء)",
      "الحالة",
    ];

    const whName = activeWarehouse?.name || "—";

    const data = filteredRows.map((r) => {
      const stockState = r.isOut ? "نفذ" : r.isLowStock ? "منخفض" : "جيد";
      const expLabel =
        r.expiry.status === "expired"
          ? "منتهي"
          : r.expiry.status === "soon"
          ? `قريب (${r.expiry.daysLeft} يوم)`
          : r.expiry.status === "ok"
          ? "سليم"
          : "—";

      return [
        whName,
        r.name,
        r.categoryName,
        r.barcode,
        r.expiryDate || "",
        expLabel,
        r.packageQty,
        r.itemQty,
        r.totalItems,
        r.purchasePackagePrice,
        r.purchaseItemPrice,
        r.stockValue,
        stockState,
      ];
    });

    downloadCsv(`inventory-audit-${whName}.csv`, headers, data);
  };

  const clearFilters = () => {
    setQuery("");
    setStockFilter("all");
    setCategoryFilter("all");
  };

  return (
    <div className="space-y-6">
      <Card>
        <SectionTitle
          title="جرد المخازن"
          subtitle="بحث + فلاتر + تصدير تقرير الجرد"
          icon={Warehouse}
          action={
            <div className="flex flex-col gap-2 md:flex-row md:items-center">
              <button
                onClick={exportAuditCsv}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
              >
                <Download className="h-4 w-4" />
                تصدير Excel (CSV)
              </button>
            </div>
          }
        />

        {/* اختيار المخزن + إعداد تنبيه الصلاحية */}
        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-12">
          <div className="md:col-span-6">
            <p className="mb-2 text-xs font-bold text-slate-600">المخزن</p>
            <select
              value={activeWarehouseId || ""}
              onChange={(e) => setActiveWarehouseId(e.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none"
            >
              {(warehouses || []).map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name || "مخزن"} {w.isDefault ? "• (افتراضي)" : ""}
                </option>
              ))}
            </select>
            <p className="mt-2 text-xs text-slate-500">
              المخزن الحالي: <span className="font-bold">{activeWarehouse?.name || "—"}</span>
            </p>
          </div>

          <div className="md:col-span-6">
            <p className="mb-2 text-xs font-bold text-slate-600">تنبيه الصلاحية (بالأيام)</p>
            <input
              type="number"
              min={1}
              value={expiryWarnDays}
              onChange={(e) => setExpiryWarnDays(e.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none"
              placeholder="مثال: 30"
            />
            <p className="mt-2 text-xs text-slate-500">
              سيتم اعتبار المنتج "قريب انتهاء" إذا كانت الصلاحية خلال{" "}
              <span className="font-bold">{expiryWarnDays}</span> يوم.
            </p>
          </div>
        </div>

        {/* إحصائيات */}
        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-6">
          <div className="rounded-2xl bg-slate-50 p-4">
            <div className="flex items-center gap-2 text-slate-500">
              <Package className="h-4 w-4" />
              <span className="text-sm">عدد المنتجات</span>
            </div>
            <p className="mt-2 text-2xl font-black text-slate-900">
              {numberFormat(stats.totalProducts)}
            </p>
          </div>

          <div className="rounded-2xl bg-slate-50 p-4">
            <div className="flex items-center gap-2 text-slate-500">
              <Layers className="h-4 w-4" />
              <span className="text-sm">عدد الأقسام</span>
            </div>
            <p className="mt-2 text-2xl font-black text-slate-900">
              {numberFormat(stats.categoriesCount)}
            </p>
          </div>

          <div className="rounded-2xl bg-emerald-50 p-4">
            <div className="flex items-center gap-2 text-emerald-700">
              <Package className="h-4 w-4" />
              <span className="text-sm">قيمة المخزون (شراء)</span>
            </div>
            <p className="mt-2 text-xl font-black text-emerald-700">
              {currency(stats.inventoryValue, settings.currencyCode)}
            </p>
          </div>

          <div className="rounded-2xl bg-amber-50 p-4">
            <div className="flex items-center gap-2 text-amber-700">
              <AlertTriangle className="h-4 w-4" />
              <span className="text-sm">مخزون منخفض</span>
            </div>
            <p className="mt-2 text-2xl font-black text-amber-700">
              {numberFormat(stats.lowCount)}
            </p>
          </div>

          <div className="rounded-2xl bg-red-50 p-4">
            <div className="flex items-center gap-2 text-red-700">
              <Ban className="h-4 w-4" />
              <span className="text-sm">نفذ</span>
            </div>
            <p className="mt-2 text-2xl font-black text-red-700">
              {numberFormat(stats.outCount)}
            </p>
          </div>

          <div className="rounded-2xl bg-purple-50 p-4">
            <div className="flex items-center gap-2 text-purple-700">
              <CalendarClock className="h-4 w-4" />
              <span className="text-sm">صلاحية</span>
            </div>
            <p className="mt-2 text-sm font-black text-purple-700">
              منتهي: {numberFormat(stats.expiredCount)} • قريب:{" "}
              {numberFormat(stats.expSoonCount)}
            </p>
          </div>
        </div>

        {/* بحث + فلاتر */}
        <div className="mt-6 grid grid-cols-1 gap-4 xl:grid-cols-12">
          <div className="xl:col-span-5">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="بحث (اسم/باركود/قسم)"
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-4 text-sm outline-none focus:border-slate-400"
              />
            </div>
          </div>

          <div className="xl:col-span-3">
            <select
              value={stockFilter}
              onChange={(e) => setStockFilter(e.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none"
            >
              <option value="all">كل المنتجات</option>
              <option value="low">مخزون منخفض</option>
              <option value="out">نفذ</option>
              <option value="expSoon">قريب انتهاء</option>
              <option value="expired">منتهي صلاحية</option>
            </select>
          </div>

          <div className="xl:col-span-3">
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none"
            >
              <option value="all">كل الأقسام</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div className="xl:col-span-1">
            <button
              onClick={clearFilters}
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-100"
              type="button"
            >
              مسح
            </button>
          </div>
        </div>

        {/* جدول الجرد */}
        <div className="mt-6 overflow-x-auto rounded-2xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-700">
              <tr>
                <th className="px-4 py-3 text-right">المنتج</th>
                <th className="px-4 py-3 text-right">القسم</th>
                <th className="px-4 py-3 text-right">الباركود</th>
                <th className="px-4 py-3 text-right">الصلاحية</th>
                <th className="px-4 py-3 text-right">عبوات</th>
                <th className="px-4 py-3 text-right">قطع</th>
                <th className="px-4 py-3 text-right">إجمالي قطع</th>
                <th className="px-4 py-3 text-right">قيمة المخزون</th>
                <th className="px-4 py-3 text-right">الحالة</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((r) => {
                const state = r.isOut ? "out" : r.isLowStock ? "low" : "ok";
                const stateLabel = r.isOut ? "نفذ" : r.isLowStock ? "منخفض" : "جيد";

                const exp = r.expiry;
                const expBadge =
                  exp.status === "expired"
                    ? "bg-red-100 text-red-800"
                    : exp.status === "soon"
                    ? "bg-amber-100 text-amber-800"
                    : exp.status === "ok"
                    ? "bg-emerald-100 text-emerald-800"
                    : "bg-slate-100 text-slate-600";

                const rowBg =
                  state === "out"
                    ? "bg-red-50"
                    : exp.status === "expired"
                    ? "bg-red-50"
                    : exp.status === "soon"
                    ? "bg-amber-50"
                    : state === "low"
                    ? "bg-amber-50"
                    : "bg-white";

                return (
                  <tr key={r.id} className={`border-t border-slate-100 ${rowBg}`}>
                    <td className="px-4 py-3 font-bold text-slate-900">
                      {r.name}
                      <div className="mt-1 text-xs text-slate-500">
                        {r.packageUnitName} / {r.baseUnitName}
                      </div>
                    </td>

                    <td className="px-4 py-3 text-slate-700">{r.categoryName}</td>
                    <td className="px-4 py-3 text-slate-700">{r.barcode || "—"}</td>

                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-1">
                        <span className="text-slate-700">{r.expiryDate || "—"}</span>
                        <span className={`inline-flex w-fit rounded-xl px-2.5 py-1 text-xs font-bold ${expBadge}`}>
                          {exp.status === "expired"
                            ? "منتهي"
                            : exp.status === "soon"
                            ? `قريب (${exp.daysLeft} يوم)`
                            : exp.status === "ok"
                            ? "سليم"
                            : "—"}
                        </span>
                      </div>
                    </td>

                    <td className="px-4 py-3 font-bold text-slate-900">{numberFormat(r.packageQty)}</td>
                    <td className="px-4 py-3 font-bold text-slate-900">{numberFormat(r.itemQty)}</td>
                    <td className="px-4 py-3 font-bold text-slate-900">{numberFormat(r.totalItems)}</td>

                    <td className="px-4 py-3 font-bold text-emerald-700">
                      {currency(r.stockValue, settings.currencyCode)}
                    </td>

                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-xl px-2.5 py-1 text-xs font-bold ${
                          state === "out"
                            ? "bg-red-100 text-red-800"
                            : state === "low"
                            ? "bg-amber-100 text-amber-800"
                            : "bg-emerald-100 text-emerald-800"
                        }`}
                      >
                        {stateLabel}
                      </span>
                    </td>
                  </tr>
                );
              })}

              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-10 text-center text-slate-500">
                    لا توجد نتائج مطابقة
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <p className="mt-3 text-xs text-slate-500">
          * التقرير يعتمد على المخزن المختار (المخزن النشط). يمكنك التصدير لأي فلتر تطبقه.
        </p>
      </Card>
    </div>
  );
}