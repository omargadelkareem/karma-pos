

import React, { useMemo } from "react";
import {
  FileText,
  Save,
  Search,
  Download,
  Link as LinkIcon,
  Pencil,
  Trash2,
  X,
  Archive,
  FolderOpen,
  AlertTriangle,
} from "lucide-react";
import Card from "../components/Card";
import SectionTitle from "../components/SectionTitle";
import StatCard from "../components/StatCard";
import { useDocuments } from "../context/DocumentsContext";

const CATEGORY_LABELS = {
  general: "عام",
  contracts: "عقود",
  invoices: "فواتير",
  taxes: "ضرائب",
  hr: "شؤون موظفين",
  quality: "جودة وامتثال",
  legal: "قانوني",
  suppliers: "موردين",
  customers: "عملاء",
  assets: "أصول ثابتة",
  projects: "مشاريع",
};

function isExpired(expiryDate) {
  const ex = String(expiryDate || "").trim();
  if (!ex) return false;
  const t = new Date(`${ex}T12:00:00`).getTime();
  return t < Date.now();
}

function isExpiringSoon(expiryDate) {
  const ex = String(expiryDate || "").trim();
  if (!ex) return false;
  const t = new Date(`${ex}T12:00:00`).getTime();
  const diffDays = (t - Date.now()) / (1000 * 60 * 60 * 24);
  return diffDays >= 0 && diffDays <= 30;
}

export default function Documents() {
  const {
    filteredDocuments,
    stats,

    documentForm,
    setDocumentForm,
    savingDocument,
    saveDocument,
    editingDocumentId,
    startEditDocument,
    cancelEditDocument,
    deleteDocument,
    setDocumentStatus,

    query,
    setQuery,
    categoryFilter,
    setCategoryFilter,
    statusFilter,
    setStatusFilter,
    typeFilter,
    setTypeFilter,

    exportDocumentsCsv,
  } = useDocuments();

  const categoriesList = useMemo(() => Object.keys(CATEGORY_LABELS), []);

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
      {/* left form */}
      <Card className="xl:col-span-4">
        <SectionTitle
          title={editingDocumentId ? "تعديل مستند" : "إضافة مستند"}
          subtitle="تسجيل/أرشفة المستندات وروابطها"
          icon={FileText}
        />

        {editingDocumentId ? (
          <div className="mb-4 rounded-2xl bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
            أنت الآن في وضع تعديل
          </div>
        ) : null}

        <div className="space-y-4">
          <input
            value={documentForm.title}
            onChange={(e) => setDocumentForm((s) => ({ ...s, title: e.target.value }))}
            placeholder="اسم المستند"
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
          />

          <input
            value={documentForm.docNumber}
            onChange={(e) => setDocumentForm((s) => ({ ...s, docNumber: e.target.value }))}
            placeholder="رقم المستند (اختياري)"
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
          />

          <select
            value={documentForm.category}
            onChange={(e) => setDocumentForm((s) => ({ ...s, category: e.target.value }))}
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
          >
            {categoriesList.map((k) => (
              <option key={k} value={k}>
                {CATEGORY_LABELS[k] || k}
              </option>
            ))}
          </select>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <select
              value={documentForm.type}
              onChange={(e) => setDocumentForm((s) => ({ ...s, type: e.target.value }))}
              className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
            >
              <option value="file">ملف (رابط)</option>
              <option value="link">لينك</option>
            </select>

            <select
              value={documentForm.status}
              onChange={(e) => setDocumentForm((s) => ({ ...s, status: e.target.value }))}
              className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
            >
              <option value="active">نشط</option>
              <option value="archived">مؤرشف</option>
            </select>
          </div>

          <div className="space-y-2 rounded-2xl border border-slate-200 bg-slate-50 p-3">
            <div className="flex items-center gap-2 text-slate-600">
              <LinkIcon className="h-4 w-4" />
              <p className="text-sm font-bold">رابط المستند</p>
            </div>

            <input
              value={documentForm.fileUrl}
              onChange={(e) => setDocumentForm((s) => ({ ...s, fileUrl: e.target.value }))}
              placeholder="ضع رابط Google Drive / Dropbox / رابط مباشر"
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none"
            />

            <p className="text-xs text-slate-500">
              * لو عندك Firebase Storage بعدين نضيف رفع ملفات مباشر.
            </p>
          </div>

          <input
            value={documentForm.issuer}
            onChange={(e) => setDocumentForm((s) => ({ ...s, issuer: e.target.value }))}
            placeholder="جهة الإصدار (اختياري)"
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
          />

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div>
              <p className="mb-2 text-xs font-bold text-slate-600">تاريخ الإصدار</p>
              <input
                type="date"
                value={documentForm.issueDate}
                onChange={(e) => setDocumentForm((s) => ({ ...s, issueDate: e.target.value }))}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
              />
            </div>

            <div>
              <p className="mb-2 text-xs font-bold text-slate-600">تاريخ الانتهاء</p>
              <input
                type="date"
                value={documentForm.expiryDate}
                onChange={(e) => setDocumentForm((s) => ({ ...s, expiryDate: e.target.value }))}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
              />
            </div>
          </div>

          <input
            value={documentForm.tagsText}
            onChange={(e) => setDocumentForm((s) => ({ ...s, tagsText: e.target.value }))}
            placeholder="Tags (مثال: tax, contract, iso) — افصل بفاصلة"
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
          />

          <textarea
            rows={3}
            value={documentForm.notes}
            onChange={(e) => setDocumentForm((s) => ({ ...s, notes: e.target.value }))}
            placeholder="ملاحظات"
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
          />

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <button
              onClick={saveDocument}
              disabled={savingDocument}
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-bold text-white disabled:bg-slate-400"
            >
              <Save className="h-4 w-4" />
              {savingDocument ? "جاري الحفظ..." : editingDocumentId ? "حفظ التعديل" : "حفظ المستند"}
            </button>

            {editingDocumentId ? (
              <button
                onClick={cancelEditDocument}
                type="button"
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-700 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
                إلغاء
              </button>
            ) : null}
          </div>
        </div>
      </Card>

      {/* right list */}
      <Card className="xl:col-span-8">
        <SectionTitle
          title="المستندات"
          subtitle="بحث + فلترة + تقارير + تصدير"
          icon={FolderOpen}
          action={
            <button
              onClick={() => exportDocumentsCsv()}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
            >
              <Download className="h-4 w-4" />
              تصدير CSV
            </button>
          }
        />

        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard icon={FileText} title="إجمالي المستندات" value={String(stats.total)} subtitle="Total" />
          <StatCard icon={FolderOpen} title="نشطة" value={String(stats.active)} subtitle="Active" />
          <StatCard icon={Archive} title="مؤرشفة" value={String(stats.archived)} subtitle="Archived" />
          <StatCard icon={AlertTriangle} title="تنتهي خلال 30 يوم" value={String(stats.expiringSoon)} subtitle="Expiring Soon" />
        </div>

        {/* filters */}
        <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-4">
          <div className="relative md:col-span-2">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="بحث (اسم/رقم/جهة إصدار/Tags)"
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-4 outline-none"
            />
          </div>

          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
          >
            <option value="all">كل التصنيفات</option>
            {categoriesList.map((k) => (
              <option key={k} value={k}>
                {CATEGORY_LABELS[k] || k}
              </option>
            ))}
          </select>

          <div className="grid grid-cols-2 gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
            >
              <option value="all">الكل</option>
              <option value="active">نشط</option>
              <option value="archived">مؤرشف</option>
            </select>

            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
            >
              <option value="all">النوع</option>
              <option value="file">ملف</option>
              <option value="link">لينك</option>
            </select>
          </div>
        </div>

        {/* list */}
        <div className="mt-5 space-y-3">
          {filteredDocuments.map((d) => {
            const expired = isExpired(d.expiryDate);
            const soon = isExpiringSoon(d.expiryDate);

            return (
              <div key={d.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                <div className="flex flex-wrap items-start justify-between gap-3 px-4 py-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-black text-slate-900">{d.title}</p>

                      {d.docNumber ? (
                        <span className="rounded-xl bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700">
                          {d.docNumber}
                        </span>
                      ) : null}

                      <span className="rounded-xl bg-slate-50 px-2.5 py-1 text-xs font-bold text-slate-700">
                        {CATEGORY_LABELS[d.category] || d.category || "عام"}
                      </span>

                      {d.status === "archived" ? (
                        <span className="rounded-xl bg-slate-200 px-2.5 py-1 text-xs font-bold text-slate-800">
                          مؤرشف
                        </span>
                      ) : (
                        <span className="rounded-xl bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-800">
                          نشط
                        </span>
                      )}

                      {expired ? (
                        <span className="rounded-xl bg-red-100 px-2.5 py-1 text-xs font-bold text-red-800">
                          منتهي
                        </span>
                      ) : soon ? (
                        <span className="rounded-xl bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-800">
                          قرب ينتهي
                        </span>
                      ) : null}
                    </div>

                    <div className="mt-2 grid grid-cols-1 gap-2 text-sm text-slate-600 md:grid-cols-3">
                      <p className="truncate">جهة الإصدار: <span className="font-bold">{d.issuer || "—"}</span></p>
                      <p className="truncate">إصدار: <span className="font-bold">{d.issueDate || "—"}</span></p>
                      <p className="truncate">انتهاء: <span className="font-bold">{d.expiryDate || "—"}</span></p>
                    </div>

                    {Array.isArray(d.tags) && d.tags.length ? (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {d.tags.slice(0, 10).map((t, i) => (
                          <span key={`${d.id}-t-${i}`} className="rounded-xl bg-slate-50 px-2.5 py-1 text-xs font-bold text-slate-700">
                            {t}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <a
                      href={d.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-4 py-2 text-sm font-bold text-white hover:bg-slate-800"
                    >
                      <LinkIcon className="h-4 w-4" />
                      فتح
                    </a>

                    <button
                      onClick={() => startEditDocument(d)}
                      className="inline-flex items-center gap-2 rounded-2xl bg-blue-50 px-4 py-2 text-sm font-bold text-blue-700 hover:bg-blue-100"
                    >
                      <Pencil className="h-4 w-4" />
                      تعديل
                    </button>

                    <button
                      onClick={() => deleteDocument(d.id)}
                      className="inline-flex items-center gap-2 rounded-2xl bg-red-50 px-4 py-2 text-sm font-bold text-red-700 hover:bg-red-100"
                    >
                      <Trash2 className="h-4 w-4" />
                      حذف
                    </button>
                  </div>
                </div>

                <div className="border-t border-slate-200 bg-slate-50 px-4 py-3">
                  <div className="flex flex-wrap gap-2">
                    {d.status !== "archived" ? (
                      <button
                        onClick={() => setDocumentStatus(d.id, "archived")}
                        className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-100"
                      >
                        <Archive className="h-4 w-4" />
                        أرشفة
                      </button>
                    ) : (
                      <button
                        onClick={() => setDocumentStatus(d.id, "active")}
                        className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-100"
                      >
                        رجوع نشط
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {filteredDocuments.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-slate-500">
              لا توجد مستندات مطابقة
            </div>
          ) : null}
        </div>
      </Card>
    </div>
  );
}