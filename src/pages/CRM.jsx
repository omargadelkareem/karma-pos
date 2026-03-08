import React, { useEffect, useMemo, useState } from "react";
import {
  Users2,
  Plus,
  Save,
  Search,
  Download,
  Trash2,
  Pencil,
  MessageCircle,
  PhoneCall,
  CalendarClock,
  BadgeCheck,
  XCircle,
  CircleDollarSign,
  ClipboardList,
  Filter,
} from "lucide-react";
import { onValue, push, ref, remove, set, update } from "firebase/database";
import { db } from "../firebase/db";

import Card from "../components/Card";
import SectionTitle from "../components/SectionTitle";
import { downloadCsv } from "../utils/csv";

/* ---------------- Helpers ---------------- */
function toNumber(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function cleanPhone(phone) {
  const raw = String(phone || "").replace(/[^\d]/g, "");
  if (!raw) return "";
  if (raw.startsWith("00")) return raw.slice(2);
  if (raw.startsWith("0")) return `20${raw.slice(1)}`; // Egypt default
  return raw;
}

function openWhatsApp(phone, message) {
  const p = cleanPhone(phone);
  if (!p) return window.alert("لا يوجد رقم هاتف صالح");
  const url = `https://wa.me/${p}?text=${encodeURIComponent(message || "")}`;
  window.open(url, "_blank", "noopener,noreferrer");
}

function formatDateTime(ts) {
  return ts ? new Date(ts).toLocaleString("ar-EG") : "";
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

/* ---------------- CRM Constants ---------------- */
const STAGES = [
  { key: "new", label: "جديد" },
  { key: "contacted", label: "تم التواصل" },
  { key: "interested", label: "مهتم" },
  { key: "proposal", label: "عرض سعر/بروبوزال" },
  { key: "won", label: "مغلق (ربح)" },
  { key: "lost", label: "مغلق (خسارة)" },
];

const SOURCES = [
  "Facebook",
  "Instagram",
  "WhatsApp",
  "Walk-in",
  "Referral",
  "Website",
  "Other",
];

/* ---------------- Forms ---------------- */
const initialLeadForm = {
  name: "",
  phone: "",
  email: "",
  source: "WhatsApp",
  stage: "new",
  assignedTo: "", // اسم الموظف/المسؤول
  expectedValue: "", // قيمة متوقعة
  nextFollowUpDate: "", // YYYY-MM-DD
  notes: "",
  tags: "", // comma separated
  isActive: true,
};

const initialActivityForm = {
  type: "call", // call | whatsapp | meeting | note
  title: "",
  details: "",
  scheduledAt: "", // YYYY-MM-DD optional
};

export default function CRM() {
  const [storeName, setStoreName] = useState("كرمة ماركت");

  // Data
  const [leads, setLeads] = useState([]);
  const [activities, setActivities] = useState([]);

  // UI
  const [expandedLeadId, setExpandedLeadId] = useState(null);
  const [query, setQuery] = useState("");
  const [stageFilter, setStageFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [assignedFilter, setAssignedFilter] = useState("all");
  const [followUpFilter, setFollowUpFilter] = useState("all"); // all | today | overdue | upcoming

  // Lead form
  const [leadForm, setLeadForm] = useState(initialLeadForm);
  const [savingLead, setSavingLead] = useState(false);
  const [editingLeadId, setEditingLeadId] = useState(null);

  // Activity form
  const [activityForm, setActivityForm] = useState(initialActivityForm);
  const [savingActivity, setSavingActivity] = useState(false);

  /* ---------------- Realtime Listeners ---------------- */
  useEffect(() => {
    const unsubSettings = onValue(ref(db, "settings/general"), (snap) => {
      const data = snap.val() || {};
      if (data.storeName) setStoreName(data.storeName);
    });

    const unsubLeads = onValue(ref(db, "crm/leads"), (snap) => {
      const data = snap.val() || {};
      const parsed = Object.entries(data)
        .map(([id, v]) => ({ id, ...v }))
        .sort((a, b) => (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0));
      setLeads(parsed);
    });

    const unsubActivities = onValue(ref(db, "crm/activities"), (snap) => {
      const data = snap.val() || {};
      const parsed = Object.entries(data)
        .map(([id, v]) => ({ id, ...v }))
        .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      setActivities(parsed);
    });

    return () => {
      unsubSettings();
      unsubLeads();
      unsubActivities();
    };
  }, []);

  /* ---------------- Derived ---------------- */
  const assignedOptions = useMemo(() => {
    const s = new Set();
    (leads || []).forEach((l) => {
      const a = String(l.assignedTo || "").trim();
      if (a) s.add(a);
    });
    return Array.from(s).sort((a, b) => a.localeCompare(b, "ar"));
  }, [leads]);

  const activitiesByLead = useMemo(() => {
    const map = {};
    (activities || []).forEach((a) => {
      const leadId = a.leadId;
      if (!leadId) return;
      if (!map[leadId]) map[leadId] = [];
      map[leadId].push(a);
    });
    return map;
  }, [activities]);

  const stats = useMemo(() => {
    const total = leads.length;
    const active = leads.filter((l) => l.isActive !== false).length;

    const won = leads.filter((l) => l.stage === "won").length;
    const lost = leads.filter((l) => l.stage === "lost").length;

    const expectedTotal = leads
      .filter((l) => l.stage !== "lost")
      .reduce((s, l) => s + toNumber(l.expectedValue), 0);

    // follow-ups
    const today = todayISO();
    const overdue = leads.filter((l) => {
      const d = String(l.nextFollowUpDate || "");
      return d && d < today && l.stage !== "won" && l.stage !== "lost";
    }).length;

    const dueToday = leads.filter((l) => {
      const d = String(l.nextFollowUpDate || "");
      return d === today && l.stage !== "won" && l.stage !== "lost";
    }).length;

    return { total, active, won, lost, expectedTotal, overdue, dueToday };
  }, [leads]);

  const filteredLeads = useMemo(() => {
    const q = String(query || "").trim().toLowerCase();
    const today = todayISO();

    return (leads || []).filter((l) => {
      const text = `${l.name || ""} ${l.phone || ""} ${l.email || ""} ${l.source || ""} ${l.assignedTo || ""} ${l.notes || ""}`.toLowerCase();
      const matchesQuery = q ? text.includes(q) : true;

      const matchesStage = stageFilter === "all" ? true : l.stage === stageFilter;
      const matchesSource = sourceFilter === "all" ? true : String(l.source || "") === sourceFilter;
      const matchesAssigned = assignedFilter === "all" ? true : String(l.assignedTo || "") === assignedFilter;

      const fu = String(l.nextFollowUpDate || "");
      const isOpen = l.stage !== "won" && l.stage !== "lost";

      const matchesFollowUp =
        followUpFilter === "all"
          ? true
          : followUpFilter === "today"
          ? isOpen && fu === today
          : followUpFilter === "overdue"
          ? isOpen && fu && fu < today
          : followUpFilter === "upcoming"
          ? isOpen && fu && fu > today
          : true;

      return matchesQuery && matchesStage && matchesSource && matchesAssigned && matchesFollowUp;
    });
  }, [leads, query, stageFilter, sourceFilter, assignedFilter, followUpFilter]);

  const pipeline = useMemo(() => {
    const map = {};
    STAGES.forEach((s) => (map[s.key] = []));
    filteredLeads.forEach((l) => {
      const k = l.stage || "new";
      if (!map[k]) map[k] = [];
      map[k].push(l);
    });
    return map;
  }, [filteredLeads]);

  const selectedLead = useMemo(() => {
    return (leads || []).find((x) => x.id === expandedLeadId) || null;
  }, [leads, expandedLeadId]);

  const selectedLeadActivities = useMemo(() => {
    if (!expandedLeadId) return [];
    return activitiesByLead[expandedLeadId] || [];
  }, [activitiesByLead, expandedLeadId]);

  /* ---------------- Lead CRUD ---------------- */
  const saveLead = async () => {
    const name = String(leadForm.name || "").trim();
    if (!name) return window.alert("من فضلك أدخل اسم العميل");

    const phone = String(leadForm.phone || "").trim();
    if (!phone) return window.alert("من فضلك أدخل رقم الهاتف");

    setSavingLead(true);
    try {
      const now = Date.now();
      const payload = {
        name,
        phone,
        email: String(leadForm.email || "").trim(),
        source: String(leadForm.source || "Other"),
        stage: String(leadForm.stage || "new"),
        assignedTo: String(leadForm.assignedTo || "").trim(),
        expectedValue: toNumber(leadForm.expectedValue),
        nextFollowUpDate: String(leadForm.nextFollowUpDate || "").trim(),
        notes: String(leadForm.notes || "").trim(),
        tags: String(leadForm.tags || "").trim(),
        isActive: !!leadForm.isActive,
        updatedAt: now,
      };

      if (editingLeadId) {
        await update(ref(db, `crm/leads/${editingLeadId}`), payload);
        window.alert("تم تعديل الـ Lead ✅");
      } else {
        const newRef = push(ref(db, "crm/leads"));
        await set(newRef, { ...payload, createdAt: now });
        window.alert("تم إضافة Lead ✅");
      }

      setLeadForm(initialLeadForm);
      setEditingLeadId(null);
    } catch (e) {
      window.alert(e?.message || "حدث خطأ أثناء الحفظ");
    } finally {
      setSavingLead(false);
    }
  };

  const startEditLead = (lead) => {
    setEditingLeadId(lead.id);
    setExpandedLeadId(lead.id);
    setLeadForm({
      name: lead.name || "",
      phone: lead.phone || "",
      email: lead.email || "",
      source: lead.source || "Other",
      stage: lead.stage || "new",
      assignedTo: lead.assignedTo || "",
      expectedValue: String(lead.expectedValue ?? ""),
      nextFollowUpDate: lead.nextFollowUpDate || "",
      notes: lead.notes || "",
      tags: lead.tags || "",
      isActive: lead.isActive !== false,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const cancelEditLead = () => {
    setEditingLeadId(null);
    setLeadForm(initialLeadForm);
  };

  const deleteLead = async (leadId) => {
    const ok = window.confirm("هل تريد حذف هذا الـ Lead؟");
    if (!ok) return;

    await remove(ref(db, `crm/leads/${leadId}`));

    // optionally delete activities
    const list = activitiesByLead[leadId] || [];
    if (list.length > 0) {
      const ok2 = window.confirm("هل تريد حذف سجل التواصل الخاص به أيضًا؟");
      if (ok2) {
        const updates = {};
        list.forEach((a) => {
          updates[`crm/activities/${a.id}`] = null;
        });
        await update(ref(db), updates);
      }
    }

    if (expandedLeadId === leadId) setExpandedLeadId(null);
    if (editingLeadId === leadId) cancelEditLead();
  };

  const updateLeadStage = async (leadId, stage) => {
    await update(ref(db, `crm/leads/${leadId}`), {
      stage,
      updatedAt: Date.now(),
    });
  };

  const updateLeadFollowUp = async (leadId, nextDate) => {
    await update(ref(db, `crm/leads/${leadId}`), {
      nextFollowUpDate: String(nextDate || "").trim(),
      updatedAt: Date.now(),
    });
  };

  /* ---------------- Activities CRUD ---------------- */
  const addActivity = async () => {
    if (!selectedLead) return;

    const title = String(activityForm.title || "").trim();
    if (!title) return window.alert("اكتب عنوان التفاعل");

    setSavingActivity(true);
    try {
      const now = Date.now();
      const newRef = push(ref(db, "crm/activities"));
      await set(newRef, {
        leadId: selectedLead.id,
        leadName: selectedLead.name || "",
        type: activityForm.type || "note",
        title,
        details: String(activityForm.details || "").trim(),
        scheduledAt: String(activityForm.scheduledAt || "").trim(),
        createdAt: now,
      });

      // update lead updatedAt (touch)
      await update(ref(db, `crm/leads/${selectedLead.id}`), { updatedAt: now });

      setActivityForm(initialActivityForm);
    } catch (e) {
      window.alert(e?.message || "خطأ أثناء إضافة التفاعل");
    } finally {
      setSavingActivity(false);
    }
  };

  const deleteActivity = async (activityId) => {
    const ok = window.confirm("حذف هذا التفاعل؟");
    if (!ok) return;
    await remove(ref(db, `crm/activities/${activityId}`));
  };

  /* ---------------- WhatsApp Message ---------------- */
  const buildWhatsAppMsg = (lead) => {
    const stage = STAGES.find((s) => s.key === lead.stage)?.label || "—";
    const lines = [];
    lines.push(`مرحبًا ${lead.name} 👋`);
    lines.push(`معك ${storeName}.`);
    lines.push(`أحب أتابع مع حضرتك بخصوص طلبك/استفسارك.`);
    lines.push(`(حالة المتابعة: ${stage})`);
    if (lead.nextFollowUpDate) lines.push(`موعد المتابعة: ${lead.nextFollowUpDate}`);
    lines.push(`لو تحب تبعت تفاصيل أكثر هنا وسنرد فورًا ✅`);
    return lines.join("\n");
  };

  /* ---------------- Export ---------------- */
  const exportLeadsCsv = () => {
    const headers = [
      "الاسم",
      "الهاتف",
      "البريد",
      "المصدر",
      "المرحلة",
      "المسؤول",
      "قيمة متوقعة",
      "موعد متابعة",
      "ملاحظات",
      "Tags",
      "تاريخ الإنشاء",
      "آخر تحديث",
    ];

    const rows = filteredLeads.map((l) => [
      l.name || "",
      l.phone || "",
      l.email || "",
      l.source || "",
      STAGES.find((s) => s.key === l.stage)?.label || l.stage || "",
      l.assignedTo || "",
      toNumber(l.expectedValue),
      l.nextFollowUpDate || "",
      l.notes || "",
      l.tags || "",
      formatDateTime(l.createdAt),
      formatDateTime(l.updatedAt),
    ]);

    downloadCsv("crm-leads.csv", headers, rows);
  };

  const toggleExpandLead = (id) => setExpandedLeadId((prev) => (prev === id ? null : id));

  return (
    <div className="space-y-6">
      {/* Header + Stats */}
      <Card>
        <SectionTitle
          title="إدارة CRM"
          subtitle="Leads + مراحل متابعة + سجل تواصل + تقارير"
          icon={Users2}
          action={
            <button
              onClick={exportLeadsCsv}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
            >
              <Download className="h-4 w-4" />
              تصدير Excel (CSV)
            </button>
          }
        />

        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-6">
          <div className="rounded-2xl bg-slate-50 p-4">
            <p className="text-sm text-slate-500">إجمالي الـ Leads</p>
            <p className="mt-2 text-2xl font-black text-slate-900">{stats.total}</p>
          </div>

          <div className="rounded-2xl bg-emerald-50 p-4">
            <p className="text-sm text-emerald-700">نشطة</p>
            <p className="mt-2 text-2xl font-black text-emerald-700">{stats.active}</p>
          </div>

          <div className="rounded-2xl bg-blue-50 p-4">
            <p className="text-sm text-blue-700">مغلق (ربح)</p>
            <p className="mt-2 text-2xl font-black text-blue-700">{stats.won}</p>
          </div>

          <div className="rounded-2xl bg-red-50 p-4">
            <p className="text-sm text-red-600">مغلق (خسارة)</p>
            <p className="mt-2 text-2xl font-black text-red-700">{stats.lost}</p>
          </div>

          <div className="rounded-2xl bg-amber-50 p-4">
            <p className="text-sm text-amber-700">متأخر متابعة</p>
            <p className="mt-2 text-2xl font-black text-amber-700">{stats.overdue}</p>
          </div>

          <div className="rounded-2xl bg-purple-50 p-4">
            <p className="text-sm text-purple-700">قيمة متوقعة</p>
            <p className="mt-2 text-xl font-black text-purple-700">
              {toNumber(stats.expectedTotal)} EGP
            </p>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        {/* Left: Add/Edit Lead */}
        <Card className="xl:col-span-4">
          <SectionTitle
            title={editingLeadId ? "تعديل Lead" : "إضافة Lead"}
            subtitle="اسم + هاتف + مرحلة + متابعة"
            icon={editingLeadId ? Pencil : Plus}
          />

          <div className="space-y-3">
            <input
              value={leadForm.name}
              onChange={(e) => setLeadForm((s) => ({ ...s, name: e.target.value }))}
              placeholder="اسم العميل"
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
            />

            <input
              value={leadForm.phone}
              onChange={(e) => setLeadForm((s) => ({ ...s, phone: e.target.value }))}
              placeholder="رقم الهاتف (واتساب)"
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
            />

            <input
              value={leadForm.email}
              onChange={(e) => setLeadForm((s) => ({ ...s, email: e.target.value }))}
              placeholder="البريد (اختياري)"
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
            />

            <div className="grid grid-cols-2 gap-3">
              <select
                value={leadForm.source}
                onChange={(e) => setLeadForm((s) => ({ ...s, source: e.target.value }))}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
              >
                {SOURCES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>

              <select
                value={leadForm.stage}
                onChange={(e) => setLeadForm((s) => ({ ...s, stage: e.target.value }))}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
              >
                {STAGES.map((s) => (
                  <option key={s.key} value={s.key}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <input
                value={leadForm.assignedTo}
                onChange={(e) => setLeadForm((s) => ({ ...s, assignedTo: e.target.value }))}
                placeholder="مسؤول المتابعة"
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
              />

              <input
                type="number"
                value={leadForm.expectedValue}
                onChange={(e) => setLeadForm((s) => ({ ...s, expectedValue: e.target.value }))}
                placeholder="قيمة متوقعة (اختياري)"
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
              />
            </div>

            <div>
              <p className="mb-1 text-xs font-bold text-slate-600">موعد متابعة</p>
              <input
                type="date"
                value={leadForm.nextFollowUpDate}
                onChange={(e) => setLeadForm((s) => ({ ...s, nextFollowUpDate: e.target.value }))}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
              />
            </div>

            <input
              value={leadForm.tags}
              onChange={(e) => setLeadForm((s) => ({ ...s, tags: e.target.value }))}
              placeholder="Tags (مثال: VIP, جملة, مهتم)"
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
            />

            <textarea
              rows={3}
              value={leadForm.notes}
              onChange={(e) => setLeadForm((s) => ({ ...s, notes: e.target.value }))}
              placeholder="ملاحظات"
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
            />

            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              <button
                onClick={saveLead}
                disabled={savingLead}
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-bold text-white hover:bg-slate-800 disabled:bg-slate-400"
              >
                <Save className="h-4 w-4" />
                {savingLead ? "جاري الحفظ..." : editingLeadId ? "حفظ التعديل" : "حفظ"}
              </button>

              {editingLeadId ? (
                <button
                  onClick={cancelEditLead}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-700 hover:bg-slate-100"
                >
                  <XCircle className="h-4 w-4" />
                  إلغاء
                </button>
              ) : null}
            </div>
          </div>
        </Card>

        {/* Right: Pipeline + Filters + List */}
        <Card className="xl:col-span-8">
          <SectionTitle
            title="Pipeline المتابعة"
            subtitle="فلترة + بحث + تفاصيل + سجل تواصل"
            icon={ClipboardList}
          />

          {/* Filters */}
          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-12">
            <div className="relative xl:col-span-5">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="بحث (اسم / هاتف / مصدر / مسؤول / ملاحظات)"
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-4 text-sm outline-none"
              />
            </div>

            <div className="xl:col-span-2">
              <select
                value={stageFilter}
                onChange={(e) => setStageFilter(e.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none"
              >
                <option value="all">كل المراحل</option>
                {STAGES.map((s) => (
                  <option key={s.key} value={s.key}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="xl:col-span-2">
              <select
                value={sourceFilter}
                onChange={(e) => setSourceFilter(e.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none"
              >
                <option value="all">كل المصادر</option>
                {SOURCES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            <div className="xl:col-span-3">
              <select
                value={assignedFilter}
                onChange={(e) => setAssignedFilter(e.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none"
              >
                <option value="all">كل المسؤولين</option>
                {assignedOptions.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </div>

            <div className="xl:col-span-4">
              <select
                value={followUpFilter}
                onChange={(e) => setFollowUpFilter(e.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none"
              >
                <option value="all">كل المتابعات</option>
                <option value="today">متابعة اليوم</option>
                <option value="overdue">متأخر</option>
                <option value="upcoming">قادمة</option>
              </select>
            </div>

            <div className="xl:col-span-8 rounded-2xl bg-slate-50 p-3 text-sm text-slate-600 flex items-center gap-2">
              <Filter className="h-4 w-4" />
              إجمالي النتائج: <span className="font-black">{filteredLeads.length}</span>
            </div>
          </div>

          {/* Pipeline Columns */}
          <div className="mt-5 grid grid-cols-1 gap-4 xl:grid-cols-3">
            {STAGES.map((stage) => {
              const list = pipeline[stage.key] || [];
              return (
                <div key={stage.key} className="rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="flex items-center justify-between">
                    <p className="font-black text-slate-900">{stage.label}</p>
                    <span className="rounded-xl bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700">
                      {list.length}
                    </span>
                  </div>

                  <div className="mt-3 space-y-3">
                    {list.slice(0, 6).map((l) => {
                      const expanded = expandedLeadId === l.id;
                      const isOverdue =
                        l.nextFollowUpDate &&
                        l.nextFollowUpDate < todayISO() &&
                        l.stage !== "won" &&
                        l.stage !== "lost";

                      return (
                        <div
                          key={l.id}
                          className={`rounded-2xl border p-3 ${
                            isOverdue ? "border-red-200 bg-red-50" : "border-slate-200 bg-slate-50"
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => toggleExpandLead(l.id)}
                            className="w-full text-right"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <p className="truncate font-bold text-slate-900">{l.name}</p>
                              {l.stage === "won" ? (
                                <BadgeCheck className="h-4 w-4 text-emerald-700" />
                              ) : l.stage === "lost" ? (
                                <XCircle className="h-4 w-4 text-red-700" />
                              ) : isOverdue ? (
                                <CalendarClock className="h-4 w-4 text-red-700" />
                              ) : null}
                            </div>

                            <p className="mt-1 text-xs text-slate-600">
                              {l.phone || "—"} • {l.source || "—"}
                            </p>

                            {l.nextFollowUpDate ? (
                              <p className="mt-1 text-xs text-slate-500">
                                متابعة: <span className="font-bold">{l.nextFollowUpDate}</span>
                              </p>
                            ) : null}
                          </button>

                          {expanded ? (
                            <div className="mt-3 rounded-2xl bg-white p-3">
                              <div className="grid grid-cols-1 gap-2 text-xs text-slate-700">
                                <p>
                                  مسؤول: <span className="font-bold">{l.assignedTo || "—"}</span>
                                </p>
                                <p>
                                  قيمة متوقعة:{" "}
                                  <span className="font-bold">{toNumber(l.expectedValue)} EGP</span>
                                </p>
                              </div>

                              <div className="mt-3 flex flex-wrap gap-2">
                                <button
                                  onClick={() => openWhatsApp(l.phone, buildWhatsAppMsg(l))}
                                  className="inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-3 py-2 text-xs font-bold text-white hover:bg-slate-800"
                                >
                                  <MessageCircle className="h-4 w-4" />
                                  واتساب
                                </button>

                                <a
                                  href={`tel:${String(l.phone || "").replace(/[^\d+]/g, "")}`}
                                  className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100"
                                >
                                  <PhoneCall className="h-4 w-4" />
                                  اتصال
                                </a>

                                <button
                                  onClick={() => startEditLead(l)}
                                  className="inline-flex items-center gap-2 rounded-2xl bg-blue-50 px-3 py-2 text-xs font-bold text-blue-700 hover:bg-blue-100"
                                >
                                  <Pencil className="h-4 w-4" />
                                  تعديل
                                </button>

                                <button
                                  onClick={() => deleteLead(l.id)}
                                  className="inline-flex items-center gap-2 rounded-2xl bg-red-50 px-3 py-2 text-xs font-bold text-red-700 hover:bg-red-100"
                                >
                                  <Trash2 className="h-4 w-4" />
                                  حذف
                                </button>
                              </div>

                              <div className="mt-3 grid grid-cols-1 gap-2">
                                <select
                                  value={l.stage || "new"}
                                  onChange={(e) => updateLeadStage(l.id, e.target.value)}
                                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs outline-none"
                                >
                                  {STAGES.map((s) => (
                                    <option key={s.key} value={s.key}>
                                      {s.label}
                                    </option>
                                  ))}
                                </select>

                                <input
                                  type="date"
                                  value={l.nextFollowUpDate || ""}
                                  onChange={(e) => updateLeadFollowUp(l.id, e.target.value)}
                                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs outline-none"
                                />
                              </div>

                              {/* Activities */}
                              <div className="mt-4 rounded-2xl bg-slate-50 p-3">
                                <p className="mb-2 text-sm font-black text-slate-900">
                                  سجل التواصل
                                </p>

                                <div className="grid grid-cols-1 gap-2">
                                  <select
                                    value={activityForm.type}
                                    onChange={(e) => setActivityForm((s) => ({ ...s, type: e.target.value }))}
                                    className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs outline-none"
                                  >
                                    <option value="call">مكالمة</option>
                                    <option value="whatsapp">واتساب</option>
                                    <option value="meeting">مقابلة</option>
                                    <option value="note">ملاحظة</option>
                                  </select>

                                  <input
                                    value={activityForm.title}
                                    onChange={(e) => setActivityForm((s) => ({ ...s, title: e.target.value }))}
                                    placeholder="عنوان (مثال: تم التواصل - إرسال عرض)"
                                    className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs outline-none"
                                  />

                                  <input
                                    value={activityForm.scheduledAt}
                                    onChange={(e) => setActivityForm((s) => ({ ...s, scheduledAt: e.target.value }))}
                                    type="date"
                                    className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs outline-none"
                                  />

                                  <textarea
                                    rows={2}
                                    value={activityForm.details}
                                    onChange={(e) => setActivityForm((s) => ({ ...s, details: e.target.value }))}
                                    placeholder="تفاصيل"
                                    className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs outline-none"
                                  />

                                  <button
                                    onClick={addActivity}
                                    disabled={savingActivity}
                                    className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-500 disabled:bg-slate-400"
                                  >
                                    <Save className="h-4 w-4" />
                                    {savingActivity ? "..." : "إضافة تفاعل"}
                                  </button>
                                </div>

                                <div className="mt-3 space-y-2">
                                  {(selectedLeadActivities || []).slice(0, 6).map((a) => (
                                    <div key={a.id} className="rounded-2xl bg-white p-3">
                                      <div className="flex items-start justify-between gap-2">
                                        <div className="min-w-0">
                                          <p className="text-sm font-bold text-slate-900">{a.title}</p>
                                          <p className="mt-1 text-xs text-slate-500">
                                            {a.type} • {formatDateTime(a.createdAt)}
                                            {a.scheduledAt ? ` • موعد: ${a.scheduledAt}` : ""}
                                          </p>
                                          {a.details ? (
                                            <p className="mt-2 text-xs text-slate-700">{a.details}</p>
                                          ) : null}
                                        </div>

                                        <button
                                          onClick={() => deleteActivity(a.id)}
                                          className="rounded-xl bg-red-50 px-2 py-1 text-xs font-bold text-red-700 hover:bg-red-100"
                                        >
                                          حذف
                                        </button>
                                      </div>
                                    </div>
                                  ))}

                                  {(selectedLeadActivities || []).length === 0 ? (
                                    <div className="rounded-2xl border border-dashed border-slate-200 p-3 text-center text-xs text-slate-500">
                                      لا يوجد سجل تواصل بعد
                                    </div>
                                  ) : null}
                                </div>
                              </div>
                            </div>
                          ) : null}
                        </div>
                      );
                    })}

                    {list.length > 6 ? (
                      <div className="rounded-2xl bg-slate-50 p-3 text-center text-xs text-slate-600">
                        يوجد {list.length - 6} Leads أخرى في هذه المرحلة (استخدم البحث/الفلاتر)
                      </div>
                    ) : null}

                    {list.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">
                        لا يوجد Leads هنا
                      </div>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>
    </div>
  );
}