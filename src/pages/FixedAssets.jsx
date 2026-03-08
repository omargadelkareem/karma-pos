
    import React, { useEffect, useMemo, useState } from "react";
import {
  Landmark,
  Plus,
  Save,
  Search,
  Download,
  Trash2,
  Pencil,
  AlertTriangle,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { onValue, push, ref, remove, set, update } from "firebase/database";
import { db } from "../firebase/db";

import Card from "../components/Card";
import SectionTitle from "../components/SectionTitle";
import { currency, numberFormat } from "../utils/format";
import { downloadCsv } from "../utils/csv";

function toNumber(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function parseDate(yyyy_mm_dd) {
  const s = String(yyyy_mm_dd || "").trim();
  if (!s) return null;
  const d = new Date(`${s}T12:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function monthsBetween(a, b) {
  // difference in months between two Date objects
  if (!a || !b) return 0;
  const years = b.getFullYear() - a.getFullYear();
  const months = b.getMonth() - a.getMonth();
  return years * 12 + months;
}

function addMonths(d, m) {
  const x = new Date(d.getTime());
  x.setMonth(x.getMonth() + m);
  return x;
}

function formatDate(tsOrDate) {
  if (!tsOrDate) return "";
  const d = tsOrDate instanceof Date ? tsOrDate : new Date(tsOrDate);
  return d.toLocaleDateString("ar-EG");
}

/**
 * Depreciation model (Straight Line):
 * - annualDep = (cost - salvageValue) / usefulLifeYears
 * - monthlyDep = annualDep / 12
 * - accumulated = min(cost - salvageValue, monthlyDep * monthsSinceStart)
 * - currentValue = cost - accumulated
 */
function computeDepreciation(asset) {
  const cost = Math.max(0, toNumber(asset.cost));
  const salvage = Math.max(0, toNumber(asset.salvageValue));
  const lifeYears = Math.max(0, toNumber(asset.usefulLifeYears));
  const start = parseDate(asset.startDepreciationDate || asset.purchaseDate);

  if (!cost || !lifeYears || !start) {
    return {
      annualDep: 0,
      monthlyDep: 0,
      accumulated: 0,
      currentValue: cost,
      endDate: "",
      monthsUsed: 0,
      monthsTotal: lifeYears * 12,
    };
  }

  const base = Math.max(0, cost - salvage);
  const annualDep = base / lifeYears;
  const monthlyDep = annualDep / 12;

  const today = new Date();
  const monthsUsed = Math.max(0, monthsBetween(start, today));
  const monthsTotal = Math.max(0, Math.round(lifeYears * 12));

  const accumulatedRaw = monthlyDep * monthsUsed;
  const accumulated = Math.min(base, accumulatedRaw);
  const currentValue = Math.max(salvage, cost - accumulated);

  const endDate = formatDate(addMonths(start, monthsTotal));

  return {
    annualDep,
    monthlyDep,
    accumulated,
    currentValue,
    endDate,
    monthsUsed,
    monthsTotal,
  };
}

/** Firebase path:
 *  fixedAssets/{id}
 */
const initialAssetForm = {
  code: "",
  name: "",
  category: "", // سيارات - معدات - أجهزة - أثاث...
  location: "", // الفرع/المكان
  supplier: "",
  purchaseDate: "",
  cost: "",
  salvageValue: "0",
  usefulLifeYears: "5",
  startDepreciationDate: "", // optional
  status: "active", // active | disposed
  disposalDate: "",
  notes: "",
};

export default function FixedAssets() {
  const [assets, setAssets] = useState([]);

  const [currencyCode, setCurrencyCode] = useState("EGP");
  const [storeName, setStoreName] = useState("كرمة ماركت");

  // UI
  const [expandedId, setExpandedId] = useState(null);
  const [query, setQuery] = useState("");
  const [filterMode, setFilterMode] = useState("all"); // all | active | disposed | near_end
  const [nearEndMonths, setNearEndMonths] = useState(6);

  // form
  const [assetForm, setAssetForm] = useState(initialAssetForm);
  const [savingAsset, setSavingAsset] = useState(false);
  const [editingAssetId, setEditingAssetId] = useState(null);

  useEffect(() => {
    const unsubSettings = onValue(ref(db, "settings/general"), (snap) => {
      const data = snap.val() || {};
      if (data.currencyCode) setCurrencyCode(data.currencyCode);
      if (data.storeName) setStoreName(data.storeName);
    });

    const unsubAssets = onValue(ref(db, "fixedAssets"), (snap) => {
      const data = snap.val() || {};
      const parsed = Object.entries(data)
        .map(([id, v]) => ({ id, ...v }))
        .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      setAssets(parsed);
    });

    return () => {
      unsubSettings();
      unsubAssets();
    };
  }, []);

  const assetsWithCalc = useMemo(() => {
    return (assets || []).map((a) => {
      const dep = computeDepreciation(a);
      const fully = dep.currentValue <= Math.max(0, toNumber(a.salvageValue));
      const nearEnd =
        dep.monthsTotal > 0 && dep.monthsUsed >= Math.max(0, dep.monthsTotal - nearEndMonths);

      return {
        ...a,
        dep,
        isFullyDepreciated: fully,
        isNearEnd: nearEnd,
      };
    });
  }, [assets, nearEndMonths]);

  const stats = useMemo(() => {
    const totalAssets = assetsWithCalc.length;

    const totalCost = assetsWithCalc.reduce((s, a) => s + toNumber(a.cost), 0);
    const totalCurrentValue = assetsWithCalc.reduce((s, a) => s + toNumber(a.dep?.currentValue), 0);
    const totalAnnualDep = assetsWithCalc.reduce((s, a) => s + toNumber(a.dep?.annualDep), 0);

    const activeCount = assetsWithCalc.filter((a) => a.status !== "disposed").length;
    const disposedCount = assetsWithCalc.filter((a) => a.status === "disposed").length;
    const nearEndCount = assetsWithCalc.filter((a) => a.status !== "disposed" && a.isNearEnd).length;

    return {
      totalAssets,
      totalCost,
      totalCurrentValue,
      totalAnnualDep,
      activeCount,
      disposedCount,
      nearEndCount,
    };
  }, [assetsWithCalc]);

  const filteredAssets = useMemo(() => {
    const q = String(query || "").trim().toLowerCase();

    return assetsWithCalc.filter((a) => {
      const matchesQuery = q
        ? `${a.name || ""} ${a.code || ""} ${a.category || ""} ${a.location || ""}`.toLowerCase().includes(q)
        : true;

      const matchesFilter =
        filterMode === "all"
          ? true
          : filterMode === "active"
          ? a.status !== "disposed"
          : filterMode === "disposed"
          ? a.status === "disposed"
          : filterMode === "near_end"
          ? a.status !== "disposed" && a.isNearEnd
          : true;

      return matchesQuery && matchesFilter;
    });
  }, [assetsWithCalc, query, filterMode]);

  const toggleExpand = (id) => setExpandedId((prev) => (prev === id ? null : id));

  /* =========================
     CRUD
  ========================= */
  const saveAsset = async () => {
    const name = String(assetForm.name || "").trim();
    if (!name) return window.alert("من فضلك أدخل اسم الأصل");

    const cost = toNumber(assetForm.cost);
    if (cost <= 0) return window.alert("من فضلك أدخل تكلفة صحيحة");

    const lifeYears = toNumber(assetForm.usefulLifeYears);
    if (lifeYears <= 0) return window.alert("من فضلك أدخل عمر افتراضي صحيح");

    setSavingAsset(true);
    try {
      const now = Date.now();
      const payload = {
        code: String(assetForm.code || "").trim(),
        name,
        category: String(assetForm.category || "").trim(),
        location: String(assetForm.location || "").trim(),
        supplier: String(assetForm.supplier || "").trim(),
        purchaseDate: assetForm.purchaseDate || "",
        cost,
        salvageValue: Math.max(0, toNumber(assetForm.salvageValue)),
        usefulLifeYears: lifeYears,
        startDepreciationDate: assetForm.startDepreciationDate || "",
        status: assetForm.status || "active",
        disposalDate: assetForm.status === "disposed" ? (assetForm.disposalDate || "") : "",
        notes: String(assetForm.notes || "").trim(),
        updatedAt: now,
      };

      if (editingAssetId) {
        await update(ref(db, `fixedAssets/${editingAssetId}`), payload);
        window.alert("تم تعديل الأصل ✅");
      } else {
        const newRef = push(ref(db, "fixedAssets"));
        await set(newRef, { ...payload, createdAt: now });
        window.alert("تم حفظ الأصل ✅");
      }

      setAssetForm(initialAssetForm);
      setEditingAssetId(null);
    } catch (e) {
      window.alert(e?.message || "حدث خطأ أثناء حفظ الأصل");
    } finally {
      setSavingAsset(false);
    }
  };

  const startEditAsset = (a) => {
    setEditingAssetId(a.id);
    setExpandedId(a.id);
    setAssetForm({
      code: a.code || "",
      name: a.name || "",
      category: a.category || "",
      location: a.location || "",
      supplier: a.supplier || "",
      purchaseDate: a.purchaseDate || "",
      cost: String(a.cost ?? ""),
      salvageValue: String(a.salvageValue ?? "0"),
      usefulLifeYears: String(a.usefulLifeYears ?? "5"),
      startDepreciationDate: a.startDepreciationDate || "",
      status: a.status || "active",
      disposalDate: a.disposalDate || "",
      notes: a.notes || "",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const cancelEditAsset = () => {
    setEditingAssetId(null);
    setAssetForm(initialAssetForm);
  };

  const deleteAsset = async (id) => {
    const ok = window.confirm("هل تريد حذف هذا الأصل؟");
    if (!ok) return;
    await remove(ref(db, `fixedAssets/${id}`));
    if (expandedId === id) setExpandedId(null);
    if (editingAssetId === id) cancelEditAsset();
  };

  /* =========================
     Export / Reports
  ========================= */
  const exportAssetsCsv = () => {
    const headers = [
      "الكود",
      "اسم الأصل",
      "الفئة",
      "الموقع",
      "الحالة",
      "تاريخ الشراء",
      "تكلفة",
      "قيمة خردة",
      "عمر افتراضي (سنوات)",
      "إهلاك سنوي",
      "إهلاك متراكم",
      "القيمة الحالية",
      "تاريخ نهاية الإهلاك",
      "محتاج متابعة",
    ];

    const rows = filteredAssets.map((a) => {
      const dep = a.dep || {};
      return [
        a.code || "",
        a.name || "",
        a.category || "",
        a.location || "",
        a.status === "disposed" ? "مستبعد" : "نشط",
        a.purchaseDate || "",
        toNumber(a.cost),
        toNumber(a.salvageValue),
        toNumber(a.usefulLifeYears),
        toNumber(dep.annualDep),
        toNumber(dep.accumulated),
        toNumber(dep.currentValue),
        dep.endDate || "",
        a.isNearEnd ? "قريب" : "",
      ];
    });

    downloadCsv("fixed-assets.csv", headers, rows);
  };

  return (
    <div className="space-y-6">
      {/* Header + Stats */}
      <Card>
        <SectionTitle
          title="الأصول الثابتة"
          subtitle="تكلفة + قيمة حالية + إهلاك سنوي + تقارير"
          icon={Landmark}
          action={
            <button
              onClick={exportAssetsCsv}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
            >
              <Download className="h-4 w-4" />
              تصدير Excel (CSV)
            </button>
          }
        />

        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
          <div className="rounded-2xl bg-slate-50 p-4">
            <p className="text-sm text-slate-500">إجمالي الأصول</p>
            <p className="mt-2 text-2xl font-black text-slate-900">
              {numberFormat(stats.totalAssets)}
            </p>
          </div>

          <div className="rounded-2xl bg-amber-50 p-4">
            <p className="text-sm text-amber-700">إجمالي التكلفة</p>
            <p className="mt-2 text-xl font-black text-amber-700">
              {currency(stats.totalCost, currencyCode)}
            </p>
          </div>

          <div className="rounded-2xl bg-emerald-50 p-4">
            <p className="text-sm text-emerald-700">القيمة الحالية</p>
            <p className="mt-2 text-xl font-black text-emerald-700">
              {currency(stats.totalCurrentValue, currencyCode)}
            </p>
          </div>

          <div className="rounded-2xl bg-purple-50 p-4">
            <p className="text-sm text-purple-700">الإهلاك السنوي</p>
            <p className="mt-2 text-xl font-black text-purple-700">
              {currency(stats.totalAnnualDep, currencyCode)}
            </p>
          </div>

          <div className="rounded-2xl bg-red-50 p-4">
            <p className="text-sm text-red-600">قريبة من نهاية العمر</p>
            <p className="mt-2 text-2xl font-black text-red-700">
              {numberFormat(stats.nearEndCount)}
            </p>
          </div>
        </div>

        <div className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
          نموذج الإهلاك المستخدم: <span className="font-bold">القسط الثابت (Straight Line)</span> —
          يمكنك تغييره لاحقًا لو عايز (تناقصي/وحدات إنتاج).
        </div>
      </Card>

      {/* Form + List */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        {/* Add/Edit */}
        <Card className="xl:col-span-4">
          <SectionTitle
            title={editingAssetId ? "تعديل أصل" : "إضافة أصل"}
            subtitle="بيانات الأصل + عمر افتراضي + إهلاك"
            icon={editingAssetId ? Pencil : Plus}
          />

          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <input
                value={assetForm.code}
                onChange={(e) => setAssetForm((s) => ({ ...s, code: e.target.value }))}
                placeholder="كود الأصل (اختياري)"
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
              />

              <select
                value={assetForm.status}
                onChange={(e) => setAssetForm((s) => ({ ...s, status: e.target.value }))}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
              >
                <option value="active">نشط</option>
                <option value="disposed">مستبعد/مباع</option>
              </select>
            </div>

            <input
              value={assetForm.name}
              onChange={(e) => setAssetForm((s) => ({ ...s, name: e.target.value }))}
              placeholder="اسم الأصل"
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
            />

            <div className="grid grid-cols-2 gap-3">
              <input
                value={assetForm.category}
                onChange={(e) => setAssetForm((s) => ({ ...s, category: e.target.value }))}
                placeholder="الفئة (معدات/أجهزة/أثاث...)"
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
              />
              <input
                value={assetForm.location}
                onChange={(e) => setAssetForm((s) => ({ ...s, location: e.target.value }))}
                placeholder="الموقع/الفرع"
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
              />
            </div>

            <input
              value={assetForm.supplier}
              onChange={(e) => setAssetForm((s) => ({ ...s, supplier: e.target.value }))}
              placeholder="المورد (اختياري)"
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
            />

            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="mb-1 text-xs font-bold text-slate-600">تاريخ الشراء</p>
                <input
                  type="date"
                  value={assetForm.purchaseDate}
                  onChange={(e) => setAssetForm((s) => ({ ...s, purchaseDate: e.target.value }))}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
                />
              </div>

              <div>
                <p className="mb-1 text-xs font-bold text-slate-600">بداية الإهلاك (اختياري)</p>
                <input
                  type="date"
                  value={assetForm.startDepreciationDate}
                  onChange={(e) =>
                    setAssetForm((s) => ({ ...s, startDepreciationDate: e.target.value }))
                  }
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <input
                type="number"
                value={assetForm.cost}
                onChange={(e) => setAssetForm((s) => ({ ...s, cost: e.target.value }))}
                placeholder="تكلفة الشراء"
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
              />

              <input
                type="number"
                value={assetForm.salvageValue}
                onChange={(e) => setAssetForm((s) => ({ ...s, salvageValue: e.target.value }))}
                placeholder="قيمة خردة/متبقي"
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
              />
            </div>

            <input
              type="number"
              value={assetForm.usefulLifeYears}
              onChange={(e) => setAssetForm((s) => ({ ...s, usefulLifeYears: e.target.value }))}
              placeholder="العمر الافتراضي (سنوات)"
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
            />

            {assetForm.status === "disposed" ? (
              <div>
                <p className="mb-1 text-xs font-bold text-slate-600">تاريخ الاستبعاد/البيع</p>
                <input
                  type="date"
                  value={assetForm.disposalDate}
                  onChange={(e) => setAssetForm((s) => ({ ...s, disposalDate: e.target.value }))}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
                />
              </div>
            ) : null}

            <textarea
              rows={3}
              value={assetForm.notes}
              onChange={(e) => setAssetForm((s) => ({ ...s, notes: e.target.value }))}
              placeholder="ملاحظات"
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
            />

            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              <button
                onClick={saveAsset}
                disabled={savingAsset}
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-bold text-white hover:bg-slate-800 disabled:bg-slate-400"
              >
                <Save className="h-4 w-4" />
                {savingAsset ? "جاري الحفظ..." : editingAssetId ? "حفظ التعديل" : "حفظ الأصل"}
              </button>

              {editingAssetId ? (
                <button
                  onClick={cancelEditAsset}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-700 hover:bg-slate-100"
                >
                  <XCircle className="h-4 w-4" />
                  إلغاء
                </button>
              ) : null}
            </div>
          </div>
        </Card>

        {/* List */}
        <Card className="xl:col-span-8">
          <SectionTitle
            title={`قائمة الأصول (${storeName})`}
            subtitle="بحث + فلترة + تقارير"
            icon={Landmark}
            action={
              <div className="flex flex-col gap-2 md:flex-row md:items-center">
                <div className="relative w-full md:w-80">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="بحث (اسم/كود/فئة/موقع)"
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-4 text-sm outline-none"
                  />
                </div>

                <select
                  value={filterMode}
                  onChange={(e) => setFilterMode(e.target.value)}
                  className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none"
                >
                  <option value="all">الكل</option>
                  <option value="active">نشطة فقط</option>
                  <option value="disposed">مستبعدة/مباعة</option>
                  <option value="near_end">قريبة من نهاية العمر</option>
                </select>

                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-600">قريب خلال</span>
                  <input
                    type="number"
                    value={nearEndMonths}
                    onChange={(e) => setNearEndMonths(Math.max(1, toNumber(e.target.value, 6)))}
                    className="w-20 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none"
                  />
                  <span className="text-xs text-slate-500">شهر</span>
                </div>
              </div>
            }
          />

          <div className="mt-4 space-y-3">
            {filteredAssets.map((a) => {
              const expanded = expandedId === a.id;
              const dep = a.dep || {};
              const currentValue = toNumber(dep.currentValue);
              const annualDep = toNumber(dep.annualDep);
              const accumulated = toNumber(dep.accumulated);

              const isDisposed = a.status === "disposed";
              const isFully = a.isFullyDepreciated && !isDisposed;
              const isNearEnd = a.isNearEnd && !isDisposed;

              return (
                <div key={a.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                  <button
                    type="button"
                    onClick={() => toggleExpand(a.id)}
                    className="flex w-full items-start justify-between gap-3 px-4 py-4 text-right hover:bg-slate-50"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-base font-black text-slate-900">
                          {a.name}
                        </h3>

                        {a.code ? (
                          <span className="rounded-xl bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700">
                            {a.code}
                          </span>
                        ) : null}

                        {isDisposed ? (
                          <span className="rounded-xl bg-slate-200 px-2.5 py-1 text-xs font-bold text-slate-700">
                            مستبعد
                          </span>
                        ) : (
                          <span className="rounded-xl bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-800">
                            نشط
                          </span>
                        )}

                        {isNearEnd ? (
                          <span className="rounded-xl bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-800">
                            قريب من نهاية العمر
                          </span>
                        ) : null}

                        {isFully ? (
                          <span className="rounded-xl bg-red-100 px-2.5 py-1 text-xs font-bold text-red-800">
                            مستهلك بالكامل
                          </span>
                        ) : null}
                      </div>

                      <p className="mt-1 text-sm text-slate-500">
                        {a.category || "بدون فئة"} • {a.location || "بدون موقع"}
                      </p>

                      <div className="mt-3 grid grid-cols-1 gap-2 text-sm text-slate-700 md:grid-cols-4">
                        <p>
                          التكلفة: <span className="font-bold">{currency(toNumber(a.cost), currencyCode)}</span>
                        </p>
                        <p>
                          الإهلاك السنوي: <span className="font-bold text-purple-700">{currency(annualDep, currencyCode)}</span>
                        </p>
                        <p>
                          الإهلاك المتراكم: <span className="font-bold text-slate-900">{currency(accumulated, currencyCode)}</span>
                        </p>
                        <p>
                          القيمة الحالية:{" "}
                          <span className={`font-bold ${currentValue <= 0 ? "text-red-700" : "text-emerald-700"}`}>
                            {currency(currentValue, currencyCode)}
                          </span>
                        </p>
                      </div>
                    </div>

                    <div className="flex shrink-0 flex-col items-end gap-2">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          startEditAsset(a);
                        }}
                        className="inline-flex items-center gap-2 rounded-2xl bg-blue-50 px-3 py-2 text-xs font-bold text-blue-700 hover:bg-blue-100"
                      >
                        <Pencil className="h-4 w-4" />
                        تعديل
                      </button>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteAsset(a.id);
                        }}
                        className="inline-flex items-center gap-2 rounded-2xl bg-red-50 px-3 py-2 text-xs font-bold text-red-700 hover:bg-red-100"
                      >
                        <Trash2 className="h-4 w-4" />
                        حذف
                      </button>
                    </div>
                  </button>

                  {expanded ? (
                    <div className="border-t border-slate-200 bg-slate-50 px-4 py-4">
                      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <div className="rounded-2xl bg-white p-4">
                          <p className="font-black text-slate-900">تفاصيل الأصل</p>
                          <div className="mt-3 space-y-2 text-sm text-slate-700">
                            <p>المورد: <span className="font-bold">{a.supplier || "—"}</span></p>
                            <p>تاريخ الشراء: <span className="font-bold">{a.purchaseDate || "—"}</span></p>
                            <p>بداية الإهلاك: <span className="font-bold">{a.startDepreciationDate || a.purchaseDate || "—"}</span></p>
                            <p>نهاية الإهلاك: <span className="font-bold">{dep.endDate || "—"}</span></p>
                            <p>العمر: <span className="font-bold">{toNumber(a.usefulLifeYears)} سنة</span></p>
                            {a.status === "disposed" ? (
                              <p>تاريخ الاستبعاد: <span className="font-bold">{a.disposalDate || "—"}</span></p>
                            ) : null}
                          </div>
                        </div>

                        <div className="rounded-2xl bg-white p-4">
                          <p className="font-black text-slate-900">ملاحظات وتنبيهات</p>

                          <div className="mt-3 space-y-3">
                            {a.notes ? (
                              <div className="rounded-2xl bg-slate-50 p-3 text-sm text-slate-700">
                                {a.notes}
                              </div>
                            ) : (
                              <div className="rounded-2xl border border-dashed border-slate-200 p-3 text-sm text-slate-500">
                                لا توجد ملاحظات
                              </div>
                            )}

                            {isNearEnd ? (
                              <div className="rounded-2xl bg-amber-50 p-3 text-sm font-bold text-amber-800">
                                <AlertTriangle className="inline h-4 w-4 ml-2" />
                                الأصل قريب من نهاية عمره — راجع خطة الاستبدال/الصيانة
                              </div>
                            ) : null}

                            {isFully ? (
                              <div className="rounded-2xl bg-red-50 p-3 text-sm font-bold text-red-700">
                                <AlertTriangle className="inline h-4 w-4 ml-2" />
                                الأصل مستهلك بالكامل (القيمة الحالية وصلت للحد الأدنى)
                              </div>
                            ) : (
                              <div className="rounded-2xl bg-emerald-50 p-3 text-sm font-bold text-emerald-700">
                                <CheckCircle2 className="inline h-4 w-4 ml-2" />
                                الحالة جيدة
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            })}

            {filteredAssets.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-slate-500">
                لا توجد أصول مطابقة
              </div>
            ) : null}
          </div>
        </Card>
      </div>
    </div>
  );
}