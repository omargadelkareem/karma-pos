
import React from "react";
import { ShieldCheck, FileText, AlertTriangle, Settings } from "lucide-react";
import Card from "../components/Card";
import SectionTitle from "../components/SectionTitle";
import StatCard from "../components/StatCard";
import { useCompliance } from "../pages/ComplianceContext";

export default function QualityCompliance() {
  const {
    complianceSettings,
    setComplianceSettings,
    savingComplianceSettings,
    saveComplianceSettings,
    stats,
    activityLog,
  } = useCompliance();

  const enabled = complianceSettings?.accountingStandards?.enabled || {};
  const activeStandard = complianceSettings?.accountingStandards?.activeStandard || "EAS";

  return (
    <div className="space-y-6">
      <header className="rounded-[28px] bg-gradient-to-r from-slate-950 to-slate-800 p-6 text-white shadow-lg">
        <h1 className="text-3xl font-black tracking-tight">إدارة الجودة والامتثال</h1>
        <p className="mt-2 text-sm text-slate-300">سياسات + تدقيق + CAPA + معايير محاسبية</p>
      </header>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={FileText}
          title="إجمالي السياسات"
          value={String(stats?.total || 0)}
          subtitle="Policies / SOPs"
        />
        <StatCard
          icon={ShieldCheck}
          title="سياسات نشطة"
          value={String((stats?.byStatus?.active || 0) + (stats?.byStatus?.approved || 0))}
          subtitle="Approved/Active"
        />
        <StatCard
          icon={AlertTriangle}
          title="مراجعة خلال 14 يوم"
          value={String(stats?.reviewDueSoon || 0)}
          subtitle="Review Due Soon"
        />
        <StatCard
          icon={AlertTriangle}
          title="متأخرة (Overdue)"
          value={String(stats?.overdue || 0)}
          subtitle="Review Overdue"
        />
      </section>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <Card className="xl:col-span-5">
          <SectionTitle title="إعدادات الامتثال" subtitle="اختيار المعايير والأطر" icon={Settings} />

          <div className="space-y-4">
            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-sm font-bold text-slate-700">المعيار المحاسبي النشط</p>
              <select
                value={activeStandard}
                onChange={(e) =>
                  setComplianceSettings((s) => ({
                    ...s,
                    accountingStandards: { ...s.accountingStandards, activeStandard: e.target.value },
                  }))
                }
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none"
              >
                <option value="EAS">EAS - المعايير المصرية</option>
                <option value="IFRS">IFRS</option>
                <option value="IFRS_SME">IFRS for SMEs</option>
              </select>

              <div className="mt-4 grid grid-cols-1 gap-2">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={!!enabled.EAS}
                    onChange={(e) =>
                      setComplianceSettings((s) => ({
                        ...s,
                        accountingStandards: {
                          ...s.accountingStandards,
                          enabled: { ...s.accountingStandards.enabled, EAS: e.target.checked },
                        },
                      }))
                    }
                  />
                  تفعيل EAS
                </label>

                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={!!enabled.IFRS}
                    onChange={(e) =>
                      setComplianceSettings((s) => ({
                        ...s,
                        accountingStandards: {
                          ...s.accountingStandards,
                          enabled: { ...s.accountingStandards.enabled, IFRS: e.target.checked },
                        },
                      }))
                    }
                  />
                  تفعيل IFRS
                </label>

                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={!!enabled.IFRS_SME}
                    onChange={(e) =>
                      setComplianceSettings((s) => ({
                        ...s,
                        accountingStandards: {
                          ...s.accountingStandards,
                          enabled: { ...s.accountingStandards.enabled, IFRS_SME: e.target.checked },
                        },
                      }))
                    }
                  />
                  تفعيل IFRS for SMEs
                </label>
              </div>

              <textarea
                rows={3}
                value={complianceSettings?.accountingStandards?.notes || ""}
                onChange={(e) =>
                  setComplianceSettings((s) => ({
                    ...s,
                    accountingStandards: { ...s.accountingStandards, notes: e.target.value },
                  }))
                }
                placeholder="ملاحظات عن تطبيق المعايير"
                className="mt-4 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none"
              />

              <button
                onClick={saveComplianceSettings}
                disabled={savingComplianceSettings}
                className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-bold text-white disabled:bg-slate-400"
              >
                {savingComplianceSettings ? "جاري الحفظ..." : "حفظ الإعدادات"}
              </button>
            </div>

            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-sm font-bold text-slate-700">أطر الجودة والرقابة</p>

              <div className="mt-3 space-y-2">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={!!complianceSettings?.qualityFrameworks?.ISO9001}
                    onChange={(e) =>
                      setComplianceSettings((s) => ({
                        ...s,
                        qualityFrameworks: { ...s.qualityFrameworks, ISO9001: e.target.checked },
                      }))
                    }
                  />
                  ISO 9001
                </label>

                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={!!complianceSettings?.qualityFrameworks?.COSO}
                    onChange={(e) =>
                      setComplianceSettings((s) => ({
                        ...s,
                        qualityFrameworks: { ...s.qualityFrameworks, COSO: e.target.checked },
                      }))
                    }
                  />
                  COSO (Internal Controls)
                </label>

                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={!!complianceSettings?.qualityFrameworks?.ISO27001}
                    onChange={(e) =>
                      setComplianceSettings((s) => ({
                        ...s,
                        qualityFrameworks: { ...s.qualityFrameworks, ISO27001: e.target.checked },
                      }))
                    }
                  />
                  ISO 27001 (اختياري)
                </label>
              </div>
            </div>
          </div>
        </Card>

        <Card className="xl:col-span-7">
          <SectionTitle title="آخر النشاط" subtitle="سجل التغييرات في الجودة والامتثال" icon={ShieldCheck} />

          <div className="space-y-3">
            {(activityLog || []).map((a) => (
              <div key={a.id} className="rounded-2xl bg-slate-50 p-4">
                <p className="font-bold text-slate-900">{a.message || a.action}</p>
                <p className="mt-1 text-xs text-slate-500">
                  {a.createdAt ? new Date(a.createdAt).toLocaleString("ar-EG") : ""} • {a.userName || "—"}
                </p>
              </div>
            ))}

            {(activityLog || []).length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-slate-500">
                لا يوجد نشاط بعد
              </div>
            ) : null}
          </div>
        </Card>
      </div>
    </div>
  );
}