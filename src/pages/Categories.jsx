

    import React, { useContext, useMemo, useState } from "react";
import { Tags, Save, Trash2, Search, Download } from "lucide-react";
import { PosContext } from "../context/PosContext";
import Card from "../components/Card";
import SectionTitle from "../components/SectionTitle";
import { downloadCsv } from "../utils/csv";

export default function Categories() {
  const {
    categories = [],
    categoryForm,
    setCategoryForm,
    savingCategory,
    saveCategory,
    deleteCategory,
  } = useContext(PosContext);

  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const s = String(q || "").trim().toLowerCase();
    if (!s) return categories;
    return categories.filter((c) => `${c.name || ""} ${c.code || ""}`.toLowerCase().includes(s));
  }, [categories, q]);

  const exportCsv = () => {
    const headers = ["الاسم", "الكود", "مفعل"];
    const rows = filtered.map((c) => [
      c.name || "",
      c.code || "",
      c.isActive ? "نعم" : "لا",
    ]);
    downloadCsv("karma-categories.csv", headers, rows);
  };

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
      <Card className="xl:col-span-4">
        <SectionTitle title="فئات المنتجات" subtitle="إضافة/إدارة الفئات" icon={Tags} />

        <div className="space-y-4">
          <input
            value={categoryForm?.name || ""}
            onChange={(e) => setCategoryForm((s) => ({ ...s, name: e.target.value }))}
            placeholder="اسم الفئة (مثلاً: منظفات)"
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
          />

          <input
            value={categoryForm?.code || ""}
            onChange={(e) => setCategoryForm((s) => ({ ...s, code: e.target.value }))}
            placeholder="كود اختياري (مثلاً: CLEAN)"
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
          />

          <label className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm">
            <input
              type="checkbox"
              checked={!!categoryForm?.isActive}
              onChange={(e) => setCategoryForm((s) => ({ ...s, isActive: e.target.checked }))}
            />
            <span className="font-semibold text-slate-700">فئة مفعّلة</span>
          </label>

          <button
            onClick={saveCategory}
            disabled={savingCategory}
            className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-bold text-white disabled:bg-slate-400"
          >
            <Save className="h-4 w-4" />
            {savingCategory ? "جاري الحفظ..." : "حفظ الفئة"}
          </button>
        </div>
      </Card>

      <Card className="xl:col-span-8">
        <SectionTitle
          title="قائمة الفئات"
          subtitle={`الإجمالي: ${categories.length}`}
          icon={Tags}
          action={
            <div className="flex w-full max-w-xl items-center gap-2">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="بحث بالاسم أو الكود"
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
          {filtered.map((c) => (
            <div key={c.id} className="flex items-center justify-between rounded-2xl bg-slate-50 p-4">
              <div>
                <p className="font-black text-slate-900">{c.name}</p>
                <p className="text-xs text-slate-500">
                  الكود: {c.code || "—"} | الحالة: {c.isActive ? "مفعلة" : "غير مفعلة"}
                </p>
              </div>

              <button
                onClick={() => deleteCategory?.(c.id)}
                className="inline-flex items-center gap-2 rounded-2xl bg-red-50 px-4 py-2 text-sm font-bold text-red-700 hover:bg-red-100"
              >
                <Trash2 className="h-4 w-4" />
                حذف
              </button>
            </div>
          ))}

          {filtered.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-slate-500">
              لا توجد فئات
            </div>
          ) : null}
        </div>
      </Card>
    </div>
  );
}