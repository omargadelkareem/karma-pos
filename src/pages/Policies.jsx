    import React, { useMemo } from "react";
import {
  Save,
  FileText,
  Search,
  Trash2,
  Pencil,
  X,
  CheckCircle2,
  Clock3,
  ShieldCheck,
} from "lucide-react";
import Card from "../components/Card";
import SectionTitle from "../components/SectionTitle";
import { useCompliance } from "../pages/ComplianceContext";

export default function Policies() {
  const {
    policies,
    filteredPolicies,
    policyForm,
    setPolicyForm,
    savingPolicy,
    savePolicy,
    editingPolicyId,
    startEditPolicy,
    cancelEditPolicy,
    deletePolicy,
    setPolicyStatus,

    policyQuery,
    setPolicyQuery,
    policyStatusFilter,
    setPolicyStatusFilter,

    stats,
  } = useCompliance();

  const statusBadge = (s) => {
    const v = s || "draft";
    if (v === "active") return "bg-emerald-100 text-emerald-800";
    if (v === "approved") return "bg-blue-100 text-blue-800";
    if (v === "review") return "bg-amber-100 text-amber-800";
    if (v === "archived") return "bg-slate-200 text-slate-800";
    return "bg-slate-100 text-slate-800";
  };

  const statusLabel = (s) => {
    switch (s) {
      case "draft":
        return "مسودة";
      case "review":
        return "مراجعة";
      case "approved":
        return "معتمدة";
      case "active":
        return "مفعّلة";
      case "archived":
        return "مؤرشفة";
      default:
        return s || "—";
    }
  };

  const isDueSoon = (reviewDueDate) => {
    const due = String(reviewDueDate || "").trim();
    if (!due) return false;
    const dueTime = new Date(`${due}T12:00:00`).getTime();
    const diffDays = (dueTime - Date.now()) / (1000 * 60 * 60 * 24);
    return diffDays <= 14;
  };

  const isOverdue = (reviewDueDate) => {
    const due = String(reviewDueDate || "").trim();
    if (!due) return false;
    const dueTime = new Date(`${due}T12:00:00`).getTime();
    return dueTime < Date.now();
  };

  const dueCounts = useMemo(() => {
    const list = policies || [];
    const overdue = list.filter((p) => isOverdue(p.reviewDueDate)).length;
    const soon = list.filter((p) => isDueSoon(p.reviewDueDate)).length;
    return { overdue, soon };
  }, [policies]);

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
      {/* Left: Form */}
      <Card className="xl:col-span-4">
        <SectionTitle
          title={editingPolicyId ? "تعديل سياسة/إجراء" : "إضافة سياسة/إجراء"}
          subtitle="Document Control + Approvals"
          icon={FileText}
        />

        {editingPolicyId ? (
          <div className="mb-4 rounded-2xl bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
            أنت الآن في وضع تعديل
          </div>
        ) : null}

        <div className="space-y-4">
          <input
            value={policyForm.code}
            onChange={(e) => setPolicyForm((s) => ({ ...s, code: e.target.value }))}
            placeholder="كود (مثال: POL-001)"
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
          />

          <input
            value={policyForm.title}
            onChange={(e) => setPolicyForm((s) => ({ ...s, title: e.target.value }))}
            placeholder="اسم السياسة / الإجراء"
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
          />

          <input
            value={policyForm.scope}
            onChange={(e) => setPolicyForm((s) => ({ ...s, scope: e.target.value }))}
            placeholder="النطاق (مثال: sales / inventory / treasury)"
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
          />

          <input
            value={policyForm.ownerName}
            onChange={(e) => setPolicyForm((s) => ({ ...s, ownerName: e.target.value }))}
            placeholder="مالك الوثيقة (Owner)"
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
          />

          <select
            value={policyForm.status}
            onChange={(e) => setPolicyForm((s) => ({ ...s, status: e.target.value }))}
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
          >
            <option value="draft">مسودة</option>
            <option value="review">مراجعة</option>
            <option value="approved">معتمدة</option>
            <option value="active">مفعّلة</option>
            <option value="archived">مؤرشفة</option>
          </select>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <p className="mb-2 text-xs font-bold text-slate-600">تاريخ التفعيل</p>
              <input
                type="date"
                value={policyForm.effectiveDate}
                onChange={(e) => setPolicyForm((s) => ({ ...s, effectiveDate: e.target.value }))}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
              />
            </div>
            <div>
              <p className="mb-2 text-xs font-bold text-slate-600">تاريخ المراجعة</p>
              <input
                type="date"
                value={policyForm.reviewDueDate}
                onChange={(e) => setPolicyForm((s) => ({ ...s, reviewDueDate: e.target.value }))}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
              />
            </div>
          </div>

          <input
            value={policyForm.tagsText}
            onChange={(e) => setPolicyForm((s) => ({ ...s, tagsText: e.target.value }))}
            placeholder="Tags (مثال: revenue, controls, SOP)"
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
          />

          <textarea
            rows={3}
            value={policyForm.notes}
            onChange={(e) => setPolicyForm((s) => ({ ...s, notes: e.target.value }))}
            placeholder="ملاحظات"
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
          />

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <button
              onClick={savePolicy}
              disabled={savingPolicy}
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-bold text-white disabled:bg-slate-400"
            >
              <Save className="h-4 w-4" />
              {savingPolicy ? "جاري الحفظ..." : editingPolicyId ? "حفظ التعديل" : "حفظ"}
            </button>

            {editingPolicyId ? (
              <button
                onClick={cancelEditPolicy}
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

      {/* Right: List */}
      <Card className="xl:col-span-8">
        <SectionTitle
          title="السياسات والإجراءات"
          subtitle={`Overdue: ${dueCounts.overdue} • Due Soon: ${dueCounts.soon}`}
          icon={ShieldCheck}
        />

        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="relative md:col-span-2">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={policyQuery}
              onChange={(e) => setPolicyQuery(e.target.value)}
              placeholder="بحث (اسم/كود/نطاق/مالك)"
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-4 outline-none"
            />
          </div>

          <select
            value={policyStatusFilter}
            onChange={(e) => setPolicyStatusFilter(e.target.value)}
            className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
          >
            <option value="all">كل الحالات</option>
            <option value="draft">مسودة</option>
            <option value="review">مراجعة</option>
            <option value="approved">معتمدة</option>
            <option value="active">مفعّلة</option>
            <option value="archived">مؤرشفة</option>
          </select>
        </div>

        <div className="mt-5 space-y-3">
          {(filteredPolicies || []).map((p) => {
            const overdue = isOverdue(p.reviewDueDate);
            const soon = isDueSoon(p.reviewDueDate);

            return (
              <div key={p.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                <div className="flex flex-wrap items-start justify-between gap-3 px-4 py-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-black text-slate-900">{p.title}</p>
                      {p.code ? (
                        <span className="rounded-xl bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700">
                          {p.code}
                        </span>
                      ) : null}

                      <span className={`rounded-xl px-2.5 py-1 text-xs font-bold ${statusBadge(p.status)}`}>
                        {statusLabel(p.status)}
                      </span>

                      {overdue ? (
                        <span className="rounded-xl bg-red-100 px-2.5 py-1 text-xs font-bold text-red-800">
                          متأخرة
                        </span>
                      ) : soon ? (
                        <span className="rounded-xl bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-800">
                          قربت
                        </span>
                      ) : null}
                    </div>

                    <div className="mt-2 grid grid-cols-1 gap-2 text-sm text-slate-600 md:grid-cols-3">
                      <p className="truncate">النطاق: <span className="font-bold">{p.scope || "—"}</span></p>
                      <p className="truncate">المالك: <span className="font-bold">{p.ownerName || "—"}</span></p>
                      <p className="truncate">
                        مراجعة: <span className="font-bold">{p.reviewDueDate || "—"}</span>
                      </p>
                    </div>

                    {(p.tags || []).length ? (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {(p.tags || []).slice(0, 8).map((t, i) => (
                          <span key={`${p.id}-t-${i}`} className="rounded-xl bg-slate-50 px-2.5 py-1 text-xs font-bold text-slate-700">
                            {t}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => startEditPolicy(p)}
                      className="inline-flex items-center gap-2 rounded-2xl bg-blue-50 px-4 py-2 text-sm font-bold text-blue-700 hover:bg-blue-100"
                    >
                      <Pencil className="h-4 w-4" />
                      تعديل
                    </button>

                    <button
                      onClick={() => deletePolicy(p.id)}
                      className="inline-flex items-center gap-2 rounded-2xl bg-red-50 px-4 py-2 text-sm font-bold text-red-700 hover:bg-red-100"
                    >
                      <Trash2 className="h-4 w-4" />
                      حذف
                    </button>
                  </div>
                </div>

                {/* quick status actions */}
                <div className="border-t border-slate-200 bg-slate-50 px-4 py-3">
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => setPolicyStatus(p.id, "review")}
                      className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-100"
                    >
                      <Clock3 className="h-4 w-4" /> مراجعة
                    </button>
                    <button
                      onClick={() => setPolicyStatus(p.id, "approved")}
                      className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-100"
                    >
                      <CheckCircle2 className="h-4 w-4" /> اعتماد
                    </button>
                    <button
                      onClick={() => setPolicyStatus(p.id, "active")}
                      className="inline-flex items-center gap-2 rounded-2xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-700"
                    >
                      <ShieldCheck className="h-4 w-4" /> تفعيل
                    </button>
                    <button
                      onClick={() => setPolicyStatus(p.id, "archived")}
                      className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-100"
                    >
                      أرشفة
                    </button>
                  </div>
                </div>
              </div>
            );
          })}

          {(filteredPolicies || []).length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-slate-500">
              لا توجد سياسات
            </div>
          ) : null}
        </div>
      </Card>
    </div>
  );
}