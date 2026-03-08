import React, { useContext, useMemo, useState } from "react";
import { Warehouse, Save, Trash2, Star, CheckCircle2, Search } from "lucide-react";
import { PosContext } from "../context/PosContext";
import Card from "../components/Card";
import SectionTitle from "../components/SectionTitle";

export default function Warehouses() {
  const {
    warehouses = [],
    warehouseForm,
    setWarehouseForm,
    savingWarehouse,
    saveWarehouse,
    deleteWarehouse,
    setDefaultWarehouse,
    activeWarehouseId,
    setActiveWarehouseId,
    inventoryMap = {},
  } = useContext(PosContext);

  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const s = String(q || "").trim().toLowerCase();
    if (!s) return warehouses;
    return warehouses.filter((w) => `${w.name || ""} ${w.location || ""}`.toLowerCase().includes(s));
  }, [warehouses, q]);

  const getWarehouseStockCount = (whId) => {
    const inv = inventoryMap?.[whId] || {};
    return Object.keys(inv).length;
  };

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
      <Card className="xl:col-span-4">
        <SectionTitle title="المخازن" subtitle="إضافة/إدارة مخازن متعددة" icon={Warehouse} />

        <div className="space-y-4">
          <input
            value={warehouseForm?.name || ""}
            onChange={(e) => setWarehouseForm((s) => ({ ...s, name: e.target.value }))}
            placeholder="اسم المخزن"
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
          />

          <input
            value={warehouseForm?.location || ""}
            onChange={(e) => setWarehouseForm((s) => ({ ...s, location: e.target.value }))}
            placeholder="الموقع (اختياري)"
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
          />

          <label className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm">
            <input
              type="checkbox"
              checked={!!warehouseForm?.isDefault}
              onChange={(e) => setWarehouseForm((s) => ({ ...s, isDefault: e.target.checked }))}
            />
            <span className="font-semibold text-slate-700">مخزن افتراضي</span>
          </label>

          <label className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm">
            <input
              type="checkbox"
              checked={!!warehouseForm?.isActive}
              onChange={(e) => setWarehouseForm((s) => ({ ...s, isActive: e.target.checked }))}
            />
            <span className="font-semibold text-slate-700">مخزن مفعّل</span>
          </label>

          <button
            onClick={saveWarehouse}
            disabled={savingWarehouse}
            className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-bold text-white disabled:bg-slate-400"
          >
            <Save className="h-4 w-4" />
            {savingWarehouse ? "جاري الحفظ..." : "حفظ المخزن"}
          </button>
        </div>
      </Card>

      <Card className="xl:col-span-8">
        <SectionTitle
          title="قائمة المخازن"
          subtitle="اختر المخزن النشط الذي يتم البيع/الشراء عليه"
          icon={Warehouse}
          action={
            <div className="relative w-full max-w-sm">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="بحث"
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-4 text-sm outline-none"
              />
            </div>
          }
        />

        <div className="space-y-3">
          {filtered.map((w) => {
            const isActive = activeWarehouseId === w.id;

            return (
              <div key={w.id} className="rounded-2xl bg-slate-50 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-black text-slate-900">{w.name}</p>
                    <p className="text-xs text-slate-500">
                      {w.location || "—"} | منتجات مسجلة بالمخزن: {getWarehouseStockCount(w.id)}
                    </p>

                    <div className="mt-2 flex flex-wrap gap-2 text-xs">
                      {w.isDefault ? (
                        <span className="rounded-xl bg-amber-100 px-3 py-1 font-bold text-amber-800">
                          افتراضي
                        </span>
                      ) : null}

                      <span className={`rounded-xl px-3 py-1 font-bold ${w.isActive ? "bg-emerald-100 text-emerald-800" : "bg-slate-200 text-slate-700"}`}>
                        {w.isActive ? "مفعّل" : "غير مفعّل"}
                      </span>

                      {isActive ? (
                        <span className="rounded-xl bg-blue-100 px-3 py-1 font-bold text-blue-800">
                          مخزن نشط
                        </span>
                      ) : null}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => setActiveWarehouseId(w.id)}
                      className={`inline-flex items-center gap-2 rounded-2xl px-4 py-2 text-sm font-bold ${
                        isActive ? "bg-blue-600 text-white" : "bg-white text-slate-800 ring-1 ring-slate-200 hover:bg-slate-100"
                      }`}
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      {isActive ? "نشط" : "تعيين كنشط"}
                    </button>

                    <button
                      onClick={() => setDefaultWarehouse?.(w.id)}
                      className="inline-flex items-center gap-2 rounded-2xl bg-amber-50 px-4 py-2 text-sm font-bold text-amber-800 hover:bg-amber-100"
                    >
                      <Star className="h-4 w-4" />
                      افتراضي
                    </button>

                    <button
                      onClick={() => deleteWarehouse?.(w.id)}
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

          {filtered.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-slate-500">
              لا توجد مخازن
            </div>
          ) : null}
        </div>
      </Card>
    </div>
  );
}