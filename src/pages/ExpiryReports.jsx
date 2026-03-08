import React, { useContext, useMemo, useState } from "react";
import { AlertTriangle, CalendarDays, Download, Search } from "lucide-react";
import { PosContext } from "../context/PosContext";
import Card from "../components/Card";
import SectionTitle from "../components/SectionTitle";
import { downloadCsv } from "../utils/csv";

function daysBetween(fromDate, toDate) {
  const ms = toDate.getTime() - fromDate.getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

function getExpiryStatus(expiryDateStr, thresholdDays = 30) {
  if (!expiryDateStr) return { type: "none", label: "بدون صلاحية", daysLeft: null };

  const exp = new Date(`${expiryDateStr}T12:00:00`);
  if (Number.isNaN(exp.getTime())) return { type: "none", label: "بدون صلاحية", daysLeft: null };

  const today = new Date();
  today.setHours(12, 0, 0, 0);

  const diff = daysBetween(today, exp);

  if (diff < 0) return { type: "expired", label: "منتهي", daysLeft: diff };
  if (diff <= thresholdDays) return { type: "soon", label: `قارب الانتهاء (${diff} يوم)`, daysLeft: diff };
  return { type: "ok", label: `صالح (${diff} يوم)`, daysLeft: diff };
}

export default function ExpiryReports() {
  const { products } = useContext(PosContext);

  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all"); // all | expired | soon | ok
  const [thresholdDays, setThresholdDays] = useState(30);

  const filtered = useMemo(() => {
    const q = String(query || "").trim().toLowerCase();

    return products
      .map((p) => ({
        ...p,
        expiryInfo: getExpiryStatus(p.expiryDate, thresholdDays),
      }))
      .filter((p) => {
        const matchesQuery = q
          ? `${p.name || ""} ${p.category || ""} ${p.barcode || ""}`.toLowerCase().includes(q)
          : true;

        const matchesFilter =
          filter === "all" ? true : p.expiryInfo.type === filter;

        return matchesQuery && matchesFilter && p.expiryInfo.type !== "none";
      })
      .sort((a, b) => {
        // ترتيب: المنتهي أولاً ثم الأقرب
        const aType = a.expiryInfo.type;
        const bType = b.expiryInfo.type;

        if (aType === "expired" && bType !== "expired") return -1;
        if (bType === "expired" && aType !== "expired") return 1;

        const ad = a.expiryInfo.daysLeft ?? 999999;
        const bd = b.expiryInfo.daysLeft ?? 999999;
        return ad - bd;
      });
  }, [products, query, filter, thresholdDays]);

  const expiredCount = useMemo(
    () => products.filter((p) => getExpiryStatus(p.expiryDate, thresholdDays).type === "expired").length,
    [products, thresholdDays]
  );

  const soonCount = useMemo(
    () => products.filter((p) => getExpiryStatus(p.expiryDate, thresholdDays).type === "soon").length,
    [products, thresholdDays]
  );

  const exportCsv = () => {
    const headers = ["اسم المنتج", "القسم", "الباركود", "تاريخ الانتهاء", "الحالة", "متبقي (يوم)", "المخزون (قطع)"];

    const rows = filtered.map((p) => [
      p.name || "",
      p.category || "",
      p.barcode || "",
      p.expiryDate || "",
      p.expiryInfo.label || "",
      p.expiryInfo.daysLeft ?? "",
      p.totalItems ?? "",
    ]);

    downloadCsv("karma-expiry-report.csv", headers, rows);
  };

  return (
    <div className="space-y-6">
      <Card>
        <SectionTitle
          title="تقارير انتهاء الصلاحية"
          subtitle="تابع المنتجات المنتهية والقريبة من الانتهاء"
          icon={CalendarDays}
          action={
            <button
              onClick={exportCsv}
              className="inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
            >
              <Download className="h-4 w-4" />
              تصدير CSV
            </button>
          }
        />

        {/* Summary */}
        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="rounded-2xl bg-red-50 p-4">
            <p className="text-sm text-red-700">منتهي</p>
            <p className="mt-2 text-2xl font-black text-red-800">{expiredCount}</p>
          </div>

          <div className="rounded-2xl bg-amber-50 p-4">
            <p className="text-sm text-amber-700">قارب الانتهاء (≤ {thresholdDays} يوم)</p>
            <p className="mt-2 text-2xl font-black text-amber-800">{soonCount}</p>
          </div>

          <div className="rounded-2xl bg-slate-50 p-4">
            <p className="text-sm text-slate-600">عدد المنتجات المعروضة</p>
            <p className="mt-2 text-2xl font-black text-slate-900">{filtered.length}</p>
          </div>
        </div>

        {/* Filters */}
        <div className="mt-5 grid grid-cols-1 gap-4 xl:grid-cols-12">
          <div className="xl:col-span-5">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="بحث (اسم/باركود/قسم)"
                autoComplete="off"
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-4 text-sm outline-none focus:border-slate-400"
              />
            </div>
          </div>

          <div className="xl:col-span-3">
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none"
            >
              <option value="all">الكل</option>
              <option value="expired">منتهي</option>
              <option value="soon">قارب الانتهاء</option>
              <option value="ok">صالح</option>
            </select>
          </div>

          <div className="xl:col-span-4">
            <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <span className="text-sm font-bold text-slate-700">حد التنبيه:</span>
              <input
                type="number"
                min="1"
                value={thresholdDays}
                onChange={(e) => setThresholdDays(Number(e.target.value || 30))}
                className="w-24 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none"
              />
              <span className="text-sm text-slate-600">يوم</span>
            </div>
          </div>
        </div>
      </Card>

      {/* List */}
      <Card>
        <SectionTitle
          title="قائمة المنتجات"
          subtitle="مرتبة حسب الأهم (منتهي ثم الأقرب)"
          icon={AlertTriangle}
        />

        <div className="mt-4 space-y-3">
          {filtered.map((p) => {
            const t = p.expiryInfo.type;

            const badgeClass =
              t === "expired"
                ? "bg-red-100 text-red-800"
                : t === "soon"
                ? "bg-amber-100 text-amber-800"
                : "bg-emerald-100 text-emerald-800";

            const cardClass =
              t === "expired"
                ? "border-red-200 bg-red-50"
                : t === "soon"
                ? "border-amber-200 bg-amber-50"
                : "border-slate-200 bg-white";

            return (
              <div key={p.id} className={`rounded-2xl border p-4 ${cardClass}`}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-base font-black text-slate-900">{p.name}</p>
                    <p className="mt-1 text-sm text-slate-600">
                      {p.category || "بدون قسم"} {p.barcode ? `• ${p.barcode}` : ""}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className={`rounded-xl px-3 py-1 text-xs font-bold ${badgeClass}`}>
                      {p.expiryInfo.label}
                    </span>
                    <span className="rounded-xl bg-white px-3 py-1 text-xs font-bold text-slate-700 ring-1 ring-slate-200">
                      المخزون: {p.totalItems ?? 0} قطعة
                    </span>
                  </div>
                </div>

                <div className="mt-3 text-sm text-slate-700">
                  تاريخ الانتهاء: <span className="font-bold">{p.expiryDate || "—"}</span>
                </div>
              </div>
            );
          })}

          {filtered.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-slate-500">
              لا توجد منتجات مطابقة (أو منتجات بدون تاريخ صلاحية)
            </div>
          ) : null}
        </div>
      </Card>
    </div>
  );
}