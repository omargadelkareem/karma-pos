

    import React, { useContext, useMemo, useState } from "react";
import { Ruler, Save, Trash2, Search, Download } from "lucide-react";
import { PosContext } from "../context/PosContext";
import Card from "../components/Card";
import SectionTitle from "../components/SectionTitle";
import { downloadCsv } from "../utils/csv";

export default function Units() {
  const { units = [], unitForm, setUnitForm, savingUnit, saveUnit, deleteUnit } =
    useContext(PosContext);

  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const s = String(q || "").trim().toLowerCase();
    if (!s) return units;
    return units.filter((u) => `${u.name || ""} ${u.short || ""} ${u.type || ""}`.toLowerCase().includes(s));
  }, [units, q]);

  const exportCsv = () => {
    const headers = ["الاسم", "الاختصار", "النوع", "مفعل"];
    const rows = filtered.map((u) => [u.name || "", u.short || "", u.type || "", u.isActive ? "نعم" : "لا"]);
    downloadCsv("karma-units.csv", headers, rows);
  };

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
      <Card className="xl:col-span-4">
        <SectionTitle title="وحدات القياس" subtitle="مثلاً: قطعة / عبوة / كجم" icon={Ruler} />

        <div className="space-y-4">
          <input
            value={unitForm?.name || ""}
            onChange={(e) => setUnitForm((s) => ({ ...s, name: e.target.value }))}
            placeholder="اسم الوحدة (قطعة)"
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
          />

          <input
            value={unitForm?.short || ""}
            onChange={(e) => setUnitForm((s) => ({ ...s, short: e.target.value }))}
            placeholder="اختصار (pcs)"
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
          />

          <select
            value={unitForm?.type || "count"}
            onChange={(e) => setUnitForm((s) => ({ ...s, type: e.target.value }))}
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
          >
            <option value="count">عدد</option>
            <option value="weight">وزن</option>
            <option value="volume">حجم</option>
            <option value="length">طول</option>
          </select>

          <label className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm">
            <input
              type="checkbox"
              checked={!!unitForm?.isActive}
              onChange={(e) => setUnitForm((s) => ({ ...s, isActive: e.target.checked }))}
            />
            <span className="font-semibold text-slate-700">وحدة مفعّلة</span>
          </label>

          <button
            onClick={saveUnit}
            disabled={savingUnit}
            className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-bold text-white disabled:bg-slate-400"
          >
            <Save className="h-4 w-4" />
            {savingUnit ? "جاري الحفظ..." : "حفظ الوحدة"}
          </button>
        </div>
      </Card>

      <Card className="xl:col-span-8">
        <SectionTitle
          title="قائمة الوحدات"
          subtitle={`الإجمالي: ${units.length}`}
          icon={Ruler}
          action={
            <div className="flex w-full max-w-xl items-center gap-2">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="بحث"
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-4 text-sm outline-none"
                />
              </div>
              <button
                onClick={exportCsv}
                className="inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white"
              >
                <Download className="h-4 w-4" />
                CSV
              </button>
            </div>
          }
        />

        <div className="space-y-3">
          {filtered.map((u) => (
            <div key={u.id} className="flex items-center justify-between rounded-2xl bg-slate-50 p-4">
              <div>
                <p className="font-black text-slate-900">{u.name}</p>
                <p className="text-xs text-slate-500">
                  {u.short || "—"} | النوع: {u.type || "—"} | {u.isActive ? "مفعلة" : "غير مفعلة"}
                </p>
              </div>

              <button
                onClick={() => deleteUnit?.(u.id)}
                className="inline-flex items-center gap-2 rounded-2xl bg-red-50 px-4 py-2 text-sm font-bold text-red-700 hover:bg-red-100"
              >
                <Trash2 className="h-4 w-4" />
                حذف
              </button>
            </div>
          ))}

          {filtered.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-slate-500">
              لا توجد وحدات
            </div>
          ) : null}
        </div>
      </Card>
    </div>
  );
}