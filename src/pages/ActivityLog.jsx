
    import React, { useContext, useMemo, useState } from "react";
import {
  Activity,
  Search,
  Download,
  Filter,
  User,
  Calendar,
  Info,
} from "lucide-react";
import { PosContext } from "../context/PosContext";
import Card from "../components/Card";
import SectionTitle from "../components/SectionTitle";
import { downloadCsv } from "../utils/csv";

function toText(v) {
  return v == null ? "" : String(v);
}

function formatDate(ts) {
  return ts ? new Date(ts).toLocaleString("ar-EG") : "";
}

function safeArray(v) {
  return Array.isArray(v) ? v : [];
}

export default function ActivityLog() {
  const { activityLogs = [], settings } = useContext(PosContext);

  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [userFilter, setUserFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // استخراج الأنواع والمستخدمين من السجل
  const types = useMemo(() => {
    const set1 = new Set();
    safeArray(activityLogs).forEach((l) => {
      const t = toText(l.type).trim();
      if (t) set1.add(t);
    });
    return Array.from(set1).sort();
  }, [activityLogs]);

  const users = useMemo(() => {
    const set1 = new Set();
    safeArray(activityLogs).forEach((l) => {
      const u = toText(l.userName).trim();
      if (u) set1.add(u);
    });
    return Array.from(set1).sort((a, b) => a.localeCompare(b, "ar"));
  }, [activityLogs]);

  const filtered = useMemo(() => {
    const q = toText(query).trim().toLowerCase();

    const fromTs = dateFrom ? new Date(`${dateFrom}T00:00:00`).getTime() : null;
    const toTs = dateTo ? new Date(`${dateTo}T23:59:59`).getTime() : null;

    return safeArray(activityLogs).filter((l) => {
      if (typeFilter !== "all" && toText(l.type) !== typeFilter) return false;
      if (userFilter !== "all" && toText(l.userName) !== userFilter) return false;

      const ts = Number(l.createdAt || 0);
      if (fromTs && ts < fromTs) return false;
      if (toTs && ts > toTs) return false;

      if (!q) return true;

      const text = `${toText(l.title)} ${toText(l.type)} ${toText(l.entityLabel)} ${toText(
        l.entityType
      )} ${toText(l.userName)} ${JSON.stringify(l.meta || {})}`.toLowerCase();

      return text.includes(q);
    });
  }, [activityLogs, query, typeFilter, userFilter, dateFrom, dateTo]);

  // إحصائيات
  const stats = useMemo(() => {
    const total = filtered.length;

    const todayKey = new Date().toISOString().slice(0, 10);
    const todayCount = filtered.filter((l) => toText(l.dateKey) === todayKey).length;

    const monthKey = todayKey.slice(0, 7);
    const monthCount = filtered.filter((l) => toText(l.monthKey) === monthKey).length;

    return { total, todayCount, monthCount };
  }, [filtered]);

  const exportCsv = () => {
    const headers = [
      "التاريخ",
      "المستخدم",
      "الصلاحية",
      "النوع",
      "العنوان",
      "الكيان",
      "اسم الكيان",
      "تفاصيل (meta)",
    ];

    const rows = filtered.map((l) => [
      formatDate(l.createdAt),
      toText(l.userName),
      toText(l.userRole),
      toText(l.type),
      toText(l.title),
      toText(l.entityType),
      toText(l.entityLabel),
      JSON.stringify(l.meta || {}),
    ]);

    downloadCsv("karma-activity-log.csv", headers, rows);
  };

  const clearFilters = () => {
    setQuery("");
    setTypeFilter("all");
    setUserFilter("all");
    setDateFrom("");
    setDateTo("");
  };

  return (
    <div className="space-y-6">
      <Card>
        <SectionTitle
          title="سجل النشاط"
          subtitle="متابعة كل العمليات: إضافة / تعديل / حذف / فواتير / مصروفات..."
          icon={Activity}
          action={
            <div className="flex flex-col gap-2 md:flex-row md:items-center">
              <button
                onClick={exportCsv}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
              >
                <Download className="h-4 w-4" />
                تصدير CSV (Excel)
              </button>

              <button
                onClick={clearFilters}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-100"
              >
                <Filter className="h-4 w-4" />
                مسح الفلاتر
              </button>
            </div>
          }
        />

        {/* Stats */}
        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="rounded-2xl bg-slate-50 p-4">
            <p className="text-sm text-slate-500">إجمالي النتائج</p>
            <p className="mt-2 text-xl font-black text-slate-900">{stats.total}</p>
          </div>
          <div className="rounded-2xl bg-emerald-50 p-4">
            <p className="text-sm text-emerald-700">نشاط اليوم</p>
            <p className="mt-2 text-xl font-black text-emerald-700">{stats.todayCount}</p>
          </div>
          <div className="rounded-2xl bg-blue-50 p-4">
            <p className="text-sm text-blue-700">نشاط الشهر</p>
            <p className="mt-2 text-xl font-black text-blue-700">{stats.monthCount}</p>
          </div>
        </div>

        {/* Filters */}
        <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-12">
          <div className="relative md:col-span-4">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="بحث (عنوان/مستخدم/كيان/تفاصيل...)"
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-4 outline-none"
            />
          </div>

          <div className="md:col-span-2">
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
            >
              <option value="all">كل الأنواع</option>
              {types.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-2">
            <select
              value={userFilter}
              onChange={(e) => setUserFilter(e.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
            >
              <option value="all">كل المستخدمين</option>
              {users.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-2">
            <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5">
              <Calendar className="h-4 w-4 text-slate-400" />
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-full bg-transparent text-sm outline-none"
              />
            </div>
          </div>

          <div className="md:col-span-2">
            <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5">
              <Calendar className="h-4 w-4 text-slate-400" />
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-full bg-transparent text-sm outline-none"
              />
            </div>
          </div>
        </div>
      </Card>

      {/* Table */}
      <Card>
        <SectionTitle title="النتائج" subtitle="اضغط على أي صف لعرض التفاصيل" icon={Info} />

        <div className="overflow-x-auto">
          <table className="w-full text-right text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-slate-600">
                <th className="py-3 pr-2">التاريخ</th>
                <th className="py-3">المستخدم</th>
                <th className="py-3">النوع</th>
                <th className="py-3">العنوان</th>
                <th className="py-3">الكيان</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((l) => (
                <tr
                  key={l.id}
                  className="border-b border-slate-100 hover:bg-slate-50 cursor-pointer"
                  onClick={() => {
                    const metaText = JSON.stringify(l.meta || {}, null, 2);
                    window.alert(
                      `📌 ${l.title}\n\n` +
                        `التاريخ: ${formatDate(l.createdAt)}\n` +
                        `المستخدم: ${toText(l.userName)} (${toText(l.userRole)})\n` +
                        `النوع: ${toText(l.type)}\n` +
                        `الكيان: ${toText(l.entityType)}\n` +
                        `اسم الكيان: ${toText(l.entityLabel)}\n\n` +
                        `تفاصيل:\n${metaText}`
                    );
                  }}
                >
                  <td className="py-3 pr-2 whitespace-nowrap">{formatDate(l.createdAt)}</td>
                  <td className="py-3 whitespace-nowrap">
                    <span className="inline-flex items-center gap-2">
                      <User className="h-4 w-4 text-slate-400" />
                      {toText(l.userName)}
                    </span>
                  </td>
                  <td className="py-3 whitespace-nowrap">{toText(l.type)}</td>
                  <td className="py-3">{toText(l.title)}</td>
                  <td className="py-3 whitespace-nowrap">
                    {toText(l.entityType)} {toText(l.entityLabel) ? `• ${toText(l.entityLabel)}` : ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {filtered.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-slate-500">
              لا توجد سجلات مطابقة
            </div>
          ) : null}
        </div>
      </Card>
    </div>
  );
}