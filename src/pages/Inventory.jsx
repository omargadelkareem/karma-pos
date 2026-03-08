import React, { useContext, useMemo, useState } from "react";
import { ArrowLeftRight, Boxes, Download, Pencil, RefreshCw, Search, Warehouse } from "lucide-react";
import { push, ref, set, update } from "firebase/database";
import { db } from "../firebase/db";
import { PosContext } from "../context/PosContext";
import Card from "../components/Card";
import SectionTitle from "../components/SectionTitle";
import { downloadCsv } from "../utils/csv";
import { currency } from "../utils/format";

function toNumber(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export default function Inventory() {
  const {
    settings,
    warehouses = [],
    activeWarehouseId,
    setActiveWarehouseId,
    inventoryMap = {},
    products = [],
  } = useContext(PosContext);

  const [q, setQ] = useState("");
  const [expandedId, setExpandedId] = useState(null);

  // forms
  const [adjBase, setAdjBase] = useState("");
  const [adjPack, setAdjPack] = useState("");

  const [toWarehouseId, setToWarehouseId] = useState("");
  const [transferUnitType, setTransferUnitType] = useState("item"); // item | package
  const [transferQty, setTransferQty] = useState("");
  const [transferNotes, setTransferNotes] = useState("");

  const whId = activeWarehouseId || (warehouses[0]?.id || "");
  const invForWh = invForWhSafe(inventoryMap, whId);

  function invForWhSafe(map, id) {
    return (map && id && map[id]) ? map[id] : {};
  }

  const filtered = useMemo(() => {
    const s = String(q || "").trim().toLowerCase();
    if (!s) return products;

    return products.filter((p) => {
      const txt = `${p.name || ""} ${p.barcode || ""} ${p.categoryName || ""}`.toLowerCase();
      return txt.includes(s);
    });
  }, [products, q]);

  const stats = useMemo(() => {
    const totalProducts = products.length;
    const inventoryValue = products.reduce((sum, p) => sum + toNumber(p.stockValue), 0);
    const lowStock = products.filter((p) => p.isLowStock).length;
    const out = products.filter((p) => toNumber(p.totalItems) <= 0).length;
    return { totalProducts, inventoryValue, lowStock, out };
  }, [products]);

  const exportCsv = () => {
    const headers = ["المخزن", "المنتج", "الباركود", "الفئة", "قطع", "عبوات", "إجمالي قطع", "الصلاحية"];
    const rows = filtered.map((p) => [
      warehouses.find((w) => w.id === whId)?.name || "",
      p.name || "",
      p.barcode || "",
      p.categoryName || "",
      p.itemQty || 0,
      p.packageQty || 0,
      p.totalItems || 0,
      p.expiryDate || "",
    ]);
    downloadCsv("karma-inventory.csv", headers, rows);
  };

  const openAdjust = (p) => {
    setExpandedId(p.id);
    setAdjBase(String(p.itemQty ?? ""));
    setAdjPack(String(p.packageQty ?? ""));
    setToWarehouseId("");
    setTransferQty("");
    setTransferNotes("");
    setTransferUnitType("item");
  };

  const saveAdjustment = async (product) => {
    if (!whId) return window.alert("اختر مخزن");
    const baseQty = Math.max(0, toNumber(adjBase));
    const packageQty = Math.max(0, toNumber(adjPack));

    try {
      // write inventory
      await set(ref(db, `inventory/${whId}/${product.id}`), {
        baseQty,
        packageQty,
        updatedAt: Date.now(),
        updatedBy: "system",
      });

      // movement log
      const mvRef = push(ref(db, "stockMovements"));
      await set(mvRef, {
        type: "adjustment",
        warehouseId: whId,
        productId: product.id,
        productName: product.name || "",
        notes: "تسوية مخزون من إدارة المخزون",
        createdAt: Date.now(),
        createdBy: "system",
      });

      window.alert("تم حفظ التسوية ✅");
    } catch (e) {
      window.alert(e?.message || "خطأ أثناء حفظ التسوية");
    }
  };

  const doTransfer = async (product) => {
    if (!whId) return window.alert("اختر مخزن مصدر");
    if (!toWarehouseId) return window.alert("اختر مخزن وجهة");
    if (toWarehouseId === whId) return window.alert("لا يمكن التحويل لنفس المخزن");
    const qty = Math.max(1, toNumber(transferQty, 0));
    if (qty <= 0) return window.alert("أدخل كمية صحيحة");

    const fromInv = invForWh?.[product.id] || { baseQty: toNumber(product.itemQty), packageQty: toNumber(product.packageQty) };
    const toInv = invForWhSafe(inventoryMap, toWarehouseId)?.[product.id] || { baseQty: 0, packageQty: 0 };

    const fromBase = toNumber(fromInv.baseQty);
    const fromPack = toNumber(fromInv.packageQty);
    const toBase = toNumber(toInv.baseQty);
    const toPack = toNumber(toInv.packageQty);

    if (transferUnitType === "item") {
      if (qty > fromBase) return window.alert("الكمية غير كافية من القطع");
    } else {
      if (qty > fromPack) return window.alert("الكمية غير كافية من العبوات");
    }

    try {
      const updates = {};
      if (transferUnitType === "item") {
        updates[`inventory/${whId}/${product.id}/baseQty`] = fromBase - qty;
        updates[`inventory/${toWarehouseId}/${product.id}/baseQty`] = toBase + qty;
        updates[`inventory/${whId}/${product.id}/packageQty`] = fromPack;
        updates[`inventory/${toWarehouseId}/${product.id}/packageQty`] = toPack;
      } else {
        updates[`inventory/${whId}/${product.id}/packageQty`] = fromPack - qty;
        updates[`inventory/${toWarehouseId}/${product.id}/packageQty`] = toPack + qty;
        updates[`inventory/${whId}/${product.id}/baseQty`] = fromBase;
        updates[`inventory/${toWarehouseId}/${product.id}/baseQty`] = toBase;
      }

      const ts = Date.now();
      updates[`inventory/${whId}/${product.id}/updatedAt`] = ts;
      updates[`inventory/${toWarehouseId}/${product.id}/updatedAt`] = ts;

      await update(ref(db), updates);

      const mvRef = push(ref(db, "stockMovements"));
      await set(mvRef, {
        type: "transfer",
        fromWarehouseId: whId,
        toWarehouseId,
        warehouseId: whId,
        productId: product.id,
        productName: product.name || "",
        unitType: transferUnitType,
        qty,
        notes: String(transferNotes || "").trim(),
        createdAt: ts,
        createdBy: "system",
      });

      window.alert("تم التحويل ✅");
      setTransferQty("");
      setTransferNotes("");
    } catch (e) {
      window.alert(e?.message || "خطأ أثناء التحويل");
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <SectionTitle
          title="إدارة المخزون"
          subtitle="تسوية/تحويل بين المخازن + بحث + تصدير"
          icon={Warehouse}
          action={
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={whId}
                onChange={(e) => setActiveWarehouseId(e.target.value)}
                className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none"
              >
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>

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

        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl bg-slate-50 p-4">
            <p className="text-sm text-slate-500">عدد المنتجات</p>
            <p className="mt-2 text-2xl font-black">{stats.totalProducts}</p>
          </div>

          <div className="rounded-2xl bg-emerald-50 p-4">
            <p className="text-sm text-emerald-700">قيمة المخزون</p>
            <p className="mt-2 text-xl font-black text-emerald-700">
              {currency(stats.inventoryValue, settings.currencyCode)}
            </p>
          </div>

          <div className="rounded-2xl bg-amber-50 p-4">
            <p className="text-sm text-amber-700">مخزون منخفض</p>
            <p className="mt-2 text-2xl font-black text-amber-700">{stats.lowStock}</p>
          </div>

          <div className="rounded-2xl bg-red-50 p-4">
            <p className="text-sm text-red-700">نفذ</p>
            <p className="mt-2 text-2xl font-black text-red-700">{stats.out}</p>
          </div>
        </div>

        <div className="mt-5 relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="بحث (اسم/باركود/فئة)"
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-4 text-sm outline-none"
          />
        </div>
      </Card>

      <Card>
        <SectionTitle title="قائمة المخزون" subtitle="اضغط على المنتج للتسوية/التحويل" icon={Boxes} />

        <div className="space-y-3">
          {filtered.map((p) => {
            const isExpanded = expandedId === p.id;
            const total = toNumber(p.totalItems);

            return (
              <div key={p.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                <button
                  type="button"
                  onClick={() => (isExpanded ? setExpandedId(null) : openAdjust(p))}
                  className="flex w-full items-center justify-between gap-3 px-4 py-4 text-right hover:bg-slate-50"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-black text-slate-900">{p.name}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {p.categoryName || "بدون فئة"} | باركود: {p.barcode || "—"} | صلاحية: {p.expiryDate || "—"}
                    </p>
                    <p className="mt-2 text-sm text-slate-700">
                      قطع: <span className="font-bold">{p.itemQty}</span> | عبوات:{" "}
                      <span className="font-bold">{p.packageQty}</span> | إجمالي قطع:{" "}
                      <span className="font-bold">{total}</span>
                    </p>
                  </div>

                  <span className="rounded-2xl bg-slate-100 px-3 py-2 text-xs font-bold text-slate-700">
                    <Pencil className="inline h-4 w-4" /> إدارة
                  </span>
                </button>

                {isExpanded ? (
                  <div className="border-t border-slate-200 bg-slate-50 p-4">
                    <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
                      {/* Adjustment */}
                      <div className="xl:col-span-6">
                        <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
                          <p className="mb-3 font-black">تسوية المخزون (لهذا المخزن)</p>

                          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                            <input
                              type="number"
                              value={adjBase}
                              onChange={(e) => setAdjBase(e.target.value)}
                              placeholder="عدد القطع"
                              className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
                            />
                            <input
                              type="number"
                              value={adjPack}
                              onChange={(e) => setAdjPack(e.target.value)}
                              placeholder="عدد العبوات"
                              className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
                            />
                          </div>

                          <button
                            onClick={() => saveAdjustment(p)}
                            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-bold text-white"
                          >
                            <RefreshCw className="h-4 w-4" />
                            حفظ التسوية
                          </button>
                        </div>
                      </div>

                      {/* Transfer */}
                      <div className="xl:col-span-6">
                        <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
                          <p className="mb-3 font-black">تحويل لمخزن آخر</p>

                          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                            <select
                              value={toWarehouseId}
                              onChange={(e) => setToWarehouseId(e.target.value)}
                              className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
                            >
                              <option value="">اختر مخزن الوجهة</option>
                              {warehouses
                                .filter((w) => w.id !== whId)
                                .map((w) => (
                                  <option key={w.id} value={w.id}>
                                    {w.name}
                                  </option>
                                ))}
                            </select>

                            <select
                              value={transferUnitType}
                              onChange={(e) => setTransferUnitType(e.target.value)}
                              className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
                            >
                              <option value="item">قطع</option>
                              <option value="package">عبوات</option>
                            </select>

                            <input
                              type="number"
                              value={transferQty}
                              onChange={(e) => setTransferQty(e.target.value)}
                              placeholder="الكمية"
                              className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
                            />

                            <input
                              value={transferNotes}
                              onChange={(e) => setTransferNotes(e.target.value)}
                              placeholder="ملاحظات (اختياري)"
                              className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
                            />
                          </div>

                          <button
                            onClick={() => doTransfer(p)}
                            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 py-3 text-sm font-bold text-white hover:bg-blue-700"
                          >
                            <ArrowLeftRight className="h-4 w-4" />
                            تنفيذ التحويل
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })}

          {filtered.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-slate-500">
              لا توجد منتجات
            </div>
          ) : null}
        </div>
      </Card>
    </div>
  );
}