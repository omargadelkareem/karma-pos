
    import React, { useEffect, useMemo, useState } from "react";
import {
  FolderKanban,
  Plus,
  Save,
  Search,
  Download,
  AlertTriangle,
  CalendarClock,
  Users,
  Receipt,
  Trash2,
  Pencil,
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

function todayKey() {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

function parseDate(yyyy_mm_dd) {
  const s = String(yyyy_mm_dd || "").trim();
  if (!s) return null;
  const d = new Date(`${s}T12:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function isOverdue(dueDate, status) {
  if (!dueDate) return false;
  if (status === "done" || status === "cancelled") return false;
  const d = parseDate(dueDate);
  if (!d) return false;
  return d.getTime() < new Date().getTime();
}

/** =========================
 *  Data model (Firebase paths)
 *  - projects/{id}
 *  - projectCosts/{id}  (each row has projectId)
 *  - projectResources/{id}
 *  - projectTasks/{id}
 *  ========================= */

const initialProjectForm = {
  name: "",
  clientName: "",
  status: "active", // active | on_hold | done | cancelled
  priority: "normal", // low | normal | high | urgent
  startDate: "",
  dueDate: "",
  budget: "",
  expectedRevenue: "",
  needsFollowUp: true,
  notes: "",
};

const initialCostForm = {
  title: "",
  category: "",
  amount: "",
  date: "",
  notes: "",
};

const initialResourceForm = {
  name: "",
  role: "",
  ratePerHour: "",
  hoursPlanned: "",
  notes: "",
};

const initialTaskForm = {
  title: "",
  assignedTo: "",
  date: "",
  status: "todo", // todo | doing | done
  notes: "",
};

export default function Projects() {
  const [projects, setProjects] = useState([]);
  const [costs, setCosts] = useState([]);
  const [resources, setResources] = useState([]);
  const [tasks, setTasks] = useState([]);

  const [query, setQuery] = useState("");
  const [filterMode, setFilterMode] = useState("all"); // all | followup | overdue | active | done

  const [expandedId, setExpandedId] = useState(null);

  // Project form
  const [projectForm, setProjectForm] = useState(initialProjectForm);
  const [savingProject, setSavingProject] = useState(false);
  const [editingProjectId, setEditingProjectId] = useState(null);

  // Sub forms inside expanded project
  const [costForm, setCostForm] = useState(initialCostForm);
  const [savingCost, setSavingCost] = useState(false);

  const [resourceForm, setResourceForm] = useState(initialResourceForm);
  const [savingResource, setSavingResource] = useState(false);

  const [taskForm, setTaskForm] = useState(initialTaskForm);
  const [savingTask, setSavingTask] = useState(false);

  // Settings (currency)
  const [currencyCode, setCurrencyCode] = useState("EGP");
  const [storeName, setStoreName] = useState("كرمة ماركت");

  useEffect(() => {
    const unsubSettings = onValue(ref(db, "settings/general"), (snap) => {
      const data = snap.val() || {};
      if (data.currencyCode) setCurrencyCode(data.currencyCode);
      if (data.storeName) setStoreName(data.storeName);
    });

    const unsubProjects = onValue(ref(db, "projects"), (snap) => {
      const data = snap.val() || {};
      const parsed = Object.entries(data)
        .map(([id, v]) => ({ id, ...v }))
        .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      setProjects(parsed);
    });

    const unsubCosts = onValue(ref(db, "projectCosts"), (snap) => {
      const data = snap.val() || {};
      const parsed = Object.entries(data)
        .map(([id, v]) => ({ id, ...v }))
        .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      setCosts(parsed);
    });

    const unsubResources = onValue(ref(db, "projectResources"), (snap) => {
      const data = snap.val() || {};
      const parsed = Object.entries(data)
        .map(([id, v]) => ({ id, ...v }))
        .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      setResources(parsed);
    });

    const unsubTasks = onValue(ref(db, "projectTasks"), (snap) => {
      const data = snap.val() || {};
      const parsed = Object.entries(data)
        .map(([id, v]) => ({ id, ...v }))
        .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      setTasks(parsed);
    });

    return () => {
      unsubSettings();
      unsubProjects();
      unsubCosts();
      unsubResources();
      unsubTasks();
    };
  }, []);

  const projectsById = useMemo(() => {
    const map = {};
    projects.forEach((p) => (map[p.id] = p));
    return map;
  }, [projects]);

  const costByProject = useMemo(() => {
    const map = {};
    (costs || []).forEach((c) => {
      const pid = c.projectId || "";
      if (!pid) return;
      if (!map[pid]) map[pid] = [];
      map[pid].push(c);
    });
    return map;
  }, [costs]);

  const resByProject = useMemo(() => {
    const map = {};
    (resources || []).forEach((r) => {
      const pid = r.projectId || "";
      if (!pid) return;
      if (!map[pid]) map[pid] = [];
      map[pid].push(r);
    });
    return map;
  }, [resources]);

  const tasksByProject = useMemo(() => {
    const map = {};
    (tasks || []).forEach((t) => {
      const pid = t.projectId || "";
      if (!pid) return;
      if (!map[pid]) map[pid] = [];
      map[pid].push(t);
    });
    return map;
  }, [tasks]);

  const computeProjectTotals = (projectId) => {
    const list = costByProject[projectId] || [];
    const totalCosts = list.reduce((s, x) => s + toNumber(x.amount), 0);

    const resList = resByProject[projectId] || [];
    const totalPlannedHours = resList.reduce((s, r) => s + toNumber(r.hoursPlanned), 0);
    const totalResourceCost = resList.reduce(
      (s, r) => s + toNumber(r.hoursPlanned) * toNumber(r.ratePerHour),
      0
    );

    return { totalCosts, totalPlannedHours, totalResourceCost };
  };

  const stats = useMemo(() => {
    const totalProjects = projects.length;
    const totalExpectedRevenue = projects.reduce((s, p) => s + toNumber(p.expectedRevenue), 0);

    const totalCosts = costs.reduce((s, c) => s + toNumber(c.amount), 0);

    const followUpCount = projects.filter((p) => !!p.needsFollowUp && p.status !== "done").length;

    const overdueCount = projects.filter((p) => isOverdue(p.dueDate, p.status)).length;

    return {
      totalProjects,
      totalCosts,
      totalExpectedRevenue,
      followUpCount,
      overdueCount,
    };
  }, [projects, costs]);

  const filteredProjects = useMemo(() => {
    const q = String(query || "").trim().toLowerCase();

    return projects.filter((p) => {
      const matchesQuery = q
        ? `${p.name || ""} ${p.clientName || ""}`.toLowerCase().includes(q)
        : true;

      const overdue = isOverdue(p.dueDate, p.status);

      const matchesFilter =
        filterMode === "all"
          ? true
          : filterMode === "followup"
          ? !!p.needsFollowUp && p.status !== "done"
          : filterMode === "overdue"
          ? overdue
          : filterMode === "active"
          ? p.status === "active"
          : filterMode === "done"
          ? p.status === "done"
          : true;

      return matchesQuery && matchesFilter;
    });
  }, [projects, query, filterMode]);

  const toggleExpand = (id) => setExpandedId((prev) => (prev === id ? null : id));

  /* =========================
     Projects CRUD
  ========================= */
  const saveProject = async () => {
    const name = String(projectForm.name || "").trim();
    if (!name) return window.alert("من فضلك أدخل اسم المشروع");

    setSavingProject(true);
    try {
      const now = Date.now();

      const payload = {
        name,
        clientName: String(projectForm.clientName || "").trim(),
        status: projectForm.status || "active",
        priority: projectForm.priority || "normal",
        startDate: projectForm.startDate || "",
        dueDate: projectForm.dueDate || "",
        budget: toNumber(projectForm.budget),
        expectedRevenue: toNumber(projectForm.expectedRevenue),
        needsFollowUp: !!projectForm.needsFollowUp,
        notes: String(projectForm.notes || "").trim(),
        updatedAt: now,
      };

      if (editingProjectId) {
        await update(ref(db, `projects/${editingProjectId}`), payload);
        window.alert("تم تعديل المشروع ✅");
      } else {
        const newRef = push(ref(db, "projects"));
        await set(newRef, {
          ...payload,
          createdAt: now,
        });
        window.alert("تم حفظ المشروع ✅");
      }

      setProjectForm(initialProjectForm);
      setEditingProjectId(null);
    } catch (e) {
      window.alert(e?.message || "حدث خطأ أثناء حفظ المشروع");
    } finally {
      setSavingProject(false);
    }
  };

  const startEditProject = (p) => {
    setEditingProjectId(p.id);
    setExpandedId(p.id);
    setProjectForm({
      name: p.name || "",
      clientName: p.clientName || "",
      status: p.status || "active",
      priority: p.priority || "normal",
      startDate: p.startDate || "",
      dueDate: p.dueDate || "",
      budget: String(p.budget ?? ""),
      expectedRevenue: String(p.expectedRevenue ?? ""),
      needsFollowUp: !!p.needsFollowUp,
      notes: p.notes || "",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const cancelEditProject = () => {
    setEditingProjectId(null);
    setProjectForm(initialProjectForm);
  };

  const deleteProject = async (projectId) => {
    const ok = window.confirm("هل تريد حذف هذا المشروع؟ سيتم حذف كل القيود المرتبطة به.");
    if (!ok) return;

    // حذف المشروع
    await remove(ref(db, `projects/${projectId}`));

    // حذف القيود التابعة (تكاليف/موارد/مهام)
    const updates = {};

    (costByProject[projectId] || []).forEach((c) => (updates[`projectCosts/${c.id}`] = null));
    (resByProject[projectId] || []).forEach((r) => (updates[`projectResources/${r.id}`] = null));
    (tasksByProject[projectId] || []).forEach((t) => (updates[`projectTasks/${t.id}`] = null));

    if (Object.keys(updates).length) {
      await update(ref(db), updates);
    }

    if (expandedId === projectId) setExpandedId(null);
    if (editingProjectId === projectId) cancelEditProject();
  };

  /* =========================
     Costs / Resources / Tasks CRUD
  ========================= */
  const addCost = async (projectId) => {
    if (!projectId) return;
    const amount = toNumber(costForm.amount);
    if (!String(costForm.title || "").trim()) return window.alert("أدخل عنوان التكلفة");
    if (amount <= 0) return window.alert("أدخل مبلغ صحيح");

    setSavingCost(true);
    try {
      const createdAt = costForm.date
        ? new Date(`${costForm.date}T12:00:00`).getTime()
        : Date.now();

      const newRef = push(ref(db, "projectCosts"));
      await set(newRef, {
        projectId,
        title: String(costForm.title || "").trim(),
        category: String(costForm.category || "").trim(),
        amount,
        date: costForm.date || "",
        notes: String(costForm.notes || "").trim(),
        createdAt,
      });

      setCostForm(initialCostForm);
    } catch (e) {
      window.alert(e?.message || "خطأ أثناء إضافة التكلفة");
    } finally {
      setSavingCost(false);
    }
  };

  const deleteCost = async (id) => {
    const ok = window.confirm("حذف قيد التكلفة؟");
    if (!ok) return;
    await remove(ref(db, `projectCosts/${id}`));
  };

  const addResource = async (projectId) => {
    if (!projectId) return;
    if (!String(resourceForm.name || "").trim()) return window.alert("أدخل اسم المورد/الشخص");
    const rate = toNumber(resourceForm.ratePerHour);
    const hrs = toNumber(resourceForm.hoursPlanned);
    if (rate < 0) return window.alert("سعر الساعة غير صحيح");
    if (hrs < 0) return window.alert("الساعات غير صحيحة");

    setSavingResource(true);
    try {
      const newRef = push(ref(db, "projectResources"));
      await set(newRef, {
        projectId,
        name: String(resourceForm.name || "").trim(),
        role: String(resourceForm.role || "").trim(),
        ratePerHour: rate,
        hoursPlanned: hrs,
        notes: String(resourceForm.notes || "").trim(),
        createdAt: Date.now(),
      });
      setResourceForm(initialResourceForm);
    } catch (e) {
      window.alert(e?.message || "خطأ أثناء إضافة مورد");
    } finally {
      setSavingResource(false);
    }
  };

  const deleteResource = async (id) => {
    const ok = window.confirm("حذف المورد؟");
    if (!ok) return;
    await remove(ref(db, `projectResources/${id}`));
  };

  const addTask = async (projectId) => {
    if (!projectId) return;
    if (!String(taskForm.title || "").trim()) return window.alert("أدخل عنوان المهمة");

    setSavingTask(true);
    try {
      const newRef = push(ref(db, "projectTasks"));
      await set(newRef, {
        projectId,
        title: String(taskForm.title || "").trim(),
        assignedTo: String(taskForm.assignedTo || "").trim(),
        date: taskForm.date || "",
        status: taskForm.status || "todo",
        notes: String(taskForm.notes || "").trim(),
        createdAt: Date.now(),
      });
      setTaskForm(initialTaskForm);
    } catch (e) {
      window.alert(e?.message || "خطأ أثناء إضافة مهمة");
    } finally {
      setSavingTask(false);
    }
  };

  const updateTaskStatus = async (taskId, status) => {
    await update(ref(db, `projectTasks/${taskId}`), {
      status,
      updatedAt: Date.now(),
    });
  };

  const deleteTask = async (id) => {
    const ok = window.confirm("حذف المهمة؟");
    if (!ok) return;
    await remove(ref(db, `projectTasks/${id}`));
  };

  /* =========================
     Export
  ========================= */
  const exportProjectsCsv = () => {
    const headers = [
      "اسم المشروع",
      "العميل",
      "الحالة",
      "الأولوية",
      "تاريخ البداية",
      "تاريخ التسليم",
      "الميزانية",
      "التكاليف",
      "إيراد متوقع",
      "فرق الميزانية",
      "محتاج متابعة",
    ];

    const rows = filteredProjects.map((p) => {
      const totals = computeProjectTotals(p.id);
      const budget = toNumber(p.budget);
      const diff = budget - totals.totalCosts;

      return [
        p.name || "",
        p.clientName || "",
        p.status || "",
        p.priority || "",
        p.startDate || "",
        p.dueDate || "",
        budget,
        totals.totalCosts,
        toNumber(p.expectedRevenue),
        diff,
        p.needsFollowUp ? "نعم" : "لا",
      ];
    });

    downloadCsv("projects.csv", headers, rows);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <SectionTitle
          title="إدارة المشاريع"
          subtitle="مشاريع + تكاليف + موارد + جدولة"
          icon={FolderKanban}
          action={
            <button
              onClick={exportProjectsCsv}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
            >
              <Download className="h-4 w-4" />
              تصدير Excel (CSV)
            </button>
          }
        />

        {/* Stats */}
        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
          <div className="rounded-2xl bg-slate-50 p-4">
            <p className="text-sm text-slate-500">إجمالي المشاريع</p>
            <p className="mt-2 text-2xl font-black text-slate-900">{numberFormat(stats.totalProjects)}</p>
          </div>

          <div className="rounded-2xl bg-red-50 p-4">
            <p className="text-sm text-red-600">إجمالي التكاليف</p>
            <p className="mt-2 text-xl font-black text-red-700">
              {currency(stats.totalCosts, currencyCode)}
            </p>
          </div>

          <div className="rounded-2xl bg-emerald-50 p-4">
            <p className="text-sm text-emerald-700">إيرادات متوقعة</p>
            <p className="mt-2 text-xl font-black text-emerald-700">
              {currency(stats.totalExpectedRevenue, currencyCode)}
            </p>
          </div>

          <div className="rounded-2xl bg-amber-50 p-4">
            <p className="text-sm text-amber-700">مشاريع تحتاج متابعة</p>
            <p className="mt-2 text-2xl font-black text-amber-700">{numberFormat(stats.followUpCount)}</p>
          </div>

          <div className="rounded-2xl bg-purple-50 p-4">
            <p className="text-sm text-purple-700">مشاريع متأخرة</p>
            <p className="mt-2 text-2xl font-black text-purple-700">{numberFormat(stats.overdueCount)}</p>
          </div>
        </div>
      </Card>

      {/* Form + List */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        {/* Add/Edit Project */}
        <Card className="xl:col-span-4">
          <SectionTitle
            title={editingProjectId ? "تعديل مشروع" : "إضافة مشروع"}
            subtitle="حدد الميزانية والإيراد المتوقع والمتابعة"
            icon={editingProjectId ? Pencil : Plus}
          />

          <div className="space-y-3">
            <input
              value={projectForm.name}
              onChange={(e) => setProjectForm((s) => ({ ...s, name: e.target.value }))}
              placeholder="اسم المشروع"
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
            />

            <input
              value={projectForm.clientName}
              onChange={(e) => setProjectForm((s) => ({ ...s, clientName: e.target.value }))}
              placeholder="اسم العميل (اختياري)"
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
            />

            <div className="grid grid-cols-2 gap-3">
              <select
                value={projectForm.status}
                onChange={(e) => setProjectForm((s) => ({ ...s, status: e.target.value }))}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
              >
                <option value="active">نشط</option>
                <option value="on_hold">موقوف</option>
                <option value="done">منتهي</option>
                <option value="cancelled">ملغي</option>
              </select>

              <select
                value={projectForm.priority}
                onChange={(e) => setProjectForm((s) => ({ ...s, priority: e.target.value }))}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
              >
                <option value="low">منخفض</option>
                <option value="normal">طبيعي</option>
                <option value="high">عالي</option>
                <option value="urgent">عاجل</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="mb-1 text-xs font-bold text-slate-600">بداية</p>
                <input
                  type="date"
                  value={projectForm.startDate}
                  onChange={(e) => setProjectForm((s) => ({ ...s, startDate: e.target.value }))}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
                />
              </div>

              <div>
                <p className="mb-1 text-xs font-bold text-slate-600">تسليم</p>
                <input
                  type="date"
                  value={projectForm.dueDate}
                  onChange={(e) => setProjectForm((s) => ({ ...s, dueDate: e.target.value }))}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <input
                type="number"
                value={projectForm.budget}
                onChange={(e) => setProjectForm((s) => ({ ...s, budget: e.target.value }))}
                placeholder="ميزانية المشروع"
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
              />

              <input
                type="number"
                value={projectForm.expectedRevenue}
                onChange={(e) => setProjectForm((s) => ({ ...s, expectedRevenue: e.target.value }))}
                placeholder="إيراد متوقع"
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
              />
            </div>

            <label className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm">
              <input
                type="checkbox"
                checked={!!projectForm.needsFollowUp}
                onChange={(e) => setProjectForm((s) => ({ ...s, needsFollowUp: e.target.checked }))}
              />
              <span className="font-bold text-slate-700">هذا المشروع يحتاج متابعة</span>
            </label>

            <textarea
              rows={3}
              value={projectForm.notes}
              onChange={(e) => setProjectForm((s) => ({ ...s, notes: e.target.value }))}
              placeholder="ملاحظات"
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
            />

            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              <button
                onClick={saveProject}
                disabled={savingProject}
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-bold text-white hover:bg-slate-800 disabled:bg-slate-400"
              >
                <Save className="h-4 w-4" />
                {savingProject ? "جاري الحفظ..." : editingProjectId ? "حفظ التعديل" : "حفظ المشروع"}
              </button>

              {editingProjectId ? (
                <button
                  onClick={cancelEditProject}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-700 hover:bg-slate-100"
                >
                  <XCircle className="h-4 w-4" />
                  إلغاء
                </button>
              ) : null}
            </div>
          </div>
        </Card>

        {/* Projects List */}
        <Card className="xl:col-span-8">
          <SectionTitle
            title={`قائمة المشاريع (${storeName})`}
            subtitle="افتح أي مشروع لإضافة تكاليف/موارد/جدولة"
            icon={FolderKanban}
            action={
              <div className="flex flex-col gap-2 md:flex-row md:items-center">
                <div className="relative w-full md:w-80">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="بحث باسم المشروع أو العميل"
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-4 text-sm outline-none"
                  />
                </div>

                <select
                  value={filterMode}
                  onChange={(e) => setFilterMode(e.target.value)}
                  className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none"
                >
                  <option value="all">كل المشاريع</option>
                  <option value="followup">تحتاج متابعة</option>
                  <option value="overdue">متأخرة</option>
                  <option value="active">نشطة</option>
                  <option value="done">منتهية</option>
                </select>
              </div>
            }
          />

          <div className="mt-4 space-y-3">
            {filteredProjects.map((p) => {
              const expanded = expandedId === p.id;
              const totals = computeProjectTotals(p.id);
              const budget = toNumber(p.budget);
              const diff = budget - totals.totalCosts;
              const over = diff < 0;

              const overdue = isOverdue(p.dueDate, p.status);

              return (
                <div key={p.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                  <button
                    type="button"
                    onClick={() => toggleExpand(p.id)}
                    className="flex w-full items-start justify-between gap-3 px-4 py-4 text-right hover:bg-slate-50"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-base font-black text-slate-900">{p.name}</h3>

                        {p.needsFollowUp && p.status !== "done" ? (
                          <span className="rounded-xl bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-800">
                            يحتاج متابعة
                          </span>
                        ) : null}

                        {over ? (
                          <span className="rounded-xl bg-red-100 px-2.5 py-1 text-xs font-bold text-red-800">
                            تجاوز الميزانية
                          </span>
                        ) : null}

                        {overdue ? (
                          <span className="rounded-xl bg-purple-100 px-2.5 py-1 text-xs font-bold text-purple-800">
                            متأخر
                          </span>
                        ) : null}
                      </div>

                      <p className="mt-1 text-sm text-slate-500">
                        العميل: <span className="font-bold">{p.clientName || "—"}</span>
                      </p>

                      <div className="mt-3 grid grid-cols-1 gap-2 text-sm text-slate-700 md:grid-cols-4">
                        <p>
                          الميزانية:{" "}
                          <span className="font-bold">{currency(budget, currencyCode)}</span>
                        </p>
                        <p>
                          التكاليف:{" "}
                          <span className={`font-bold ${over ? "text-red-700" : "text-slate-900"}`}>
                            {currency(totals.totalCosts, currencyCode)}
                          </span>
                        </p>
                        <p>
                          إيراد متوقع:{" "}
                          <span className="font-bold text-emerald-700">
                            {currency(toNumber(p.expectedRevenue), currencyCode)}
                          </span>
                        </p>
                        <p>
                          الفرق:{" "}
                          <span className={`font-bold ${over ? "text-red-700" : "text-emerald-700"}`}>
                            {currency(diff, currencyCode)}
                          </span>
                        </p>
                      </div>
                    </div>

                    <div className="flex shrink-0 flex-col items-end gap-2">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          startEditProject(p);
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
                          deleteProject(p.id);
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
                      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
                        {/* Costs */}
                        <div className="xl:col-span-4">
                          <div className="rounded-2xl border border-slate-200 bg-white p-4">
                            <div className="mb-3 flex items-center gap-2">
                              <Receipt className="h-4 w-4 text-slate-500" />
                              <h4 className="font-black text-slate-900">تكاليف المشروع</h4>
                            </div>

                            <div className="space-y-2">
                              <input
                                value={costForm.title}
                                onChange={(e) => setCostForm((s) => ({ ...s, title: e.target.value }))}
                                placeholder="عنوان التكلفة"
                                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm outline-none"
                              />
                              <div className="grid grid-cols-2 gap-2">
                                <input
                                  value={costForm.category}
                                  onChange={(e) => setCostForm((s) => ({ ...s, category: e.target.value }))}
                                  placeholder="الفئة"
                                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm outline-none"
                                />
                                <input
                                  type="number"
                                  value={costForm.amount}
                                  onChange={(e) => setCostForm((s) => ({ ...s, amount: e.target.value }))}
                                  placeholder="المبلغ"
                                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm outline-none"
                                />
                              </div>

                              <input
                                type="date"
                                value={costForm.date}
                                onChange={(e) => setCostForm((s) => ({ ...s, date: e.target.value }))}
                                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm outline-none"
                              />

                              <button
                                onClick={() => addCost(p.id)}
                                disabled={savingCost}
                                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 py-2.5 text-sm font-bold text-white hover:bg-slate-800 disabled:bg-slate-400"
                              >
                                <Plus className="h-4 w-4" />
                                {savingCost ? "جاري..." : "إضافة تكلفة"}
                              </button>
                            </div>

                            <div className="mt-4 space-y-2">
                              {(costByProject[p.id] || []).slice(0, 8).map((c) => (
                                <div key={c.id} className="rounded-2xl bg-slate-50 p-3">
                                  <div className="flex items-start justify-between gap-2">
                                    <div className="min-w-0">
                                      <p className="truncate font-bold text-slate-900">{c.title}</p>
                                      <p className="text-xs text-slate-500">
                                        {c.category || "—"} • {c.date || "—"}
                                      </p>
                                    </div>
                                    <div className="text-left">
                                      <p className="font-black text-red-700">
                                        {currency(toNumber(c.amount), currencyCode)}
                                      </p>
                                      <button
                                        onClick={() => deleteCost(c.id)}
                                        className="mt-1 text-xs font-bold text-red-700 hover:underline"
                                      >
                                        حذف
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              ))}

                              {(costByProject[p.id] || []).length === 0 ? (
                                <div className="rounded-2xl border border-dashed border-slate-300 p-4 text-center text-sm text-slate-500">
                                  لا توجد تكاليف بعد
                                </div>
                              ) : null}
                            </div>
                          </div>
                        </div>

                        {/* Resources */}
                        <div className="xl:col-span-4">
                          <div className="rounded-2xl border border-slate-200 bg-white p-4">
                            <div className="mb-3 flex items-center gap-2">
                              <Users className="h-4 w-4 text-slate-500" />
                              <h4 className="font-black text-slate-900">الموارد</h4>
                            </div>

                            <div className="space-y-2">
                              <input
                                value={resourceForm.name}
                                onChange={(e) => setResourceForm((s) => ({ ...s, name: e.target.value }))}
                                placeholder="اسم المورد/الشخص"
                                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm outline-none"
                              />
                              <input
                                value={resourceForm.role}
                                onChange={(e) => setResourceForm((s) => ({ ...s, role: e.target.value }))}
                                placeholder="الدور/المسمى"
                                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm outline-none"
                              />
                              <div className="grid grid-cols-2 gap-2">
                                <input
                                  type="number"
                                  value={resourceForm.ratePerHour}
                                  onChange={(e) => setResourceForm((s) => ({ ...s, ratePerHour: e.target.value }))}
                                  placeholder="تكلفة/ساعة"
                                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm outline-none"
                                />
                                <input
                                  type="number"
                                  value={resourceForm.hoursPlanned}
                                  onChange={(e) => setResourceForm((s) => ({ ...s, hoursPlanned: e.target.value }))}
                                  placeholder="ساعات مخططة"
                                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm outline-none"
                                />
                              </div>

                              <button
                                onClick={() => addResource(p.id)}
                                disabled={savingResource}
                                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 py-2.5 text-sm font-bold text-white hover:bg-slate-800 disabled:bg-slate-400"
                              >
                                <Plus className="h-4 w-4" />
                                {savingResource ? "جاري..." : "إضافة مورد"}
                              </button>
                            </div>

                            <div className="mt-4 space-y-2">
                              {(resByProject[p.id] || []).slice(0, 8).map((r) => {
                                const cost = toNumber(r.hoursPlanned) * toNumber(r.ratePerHour);
                                return (
                                  <div key={r.id} className="rounded-2xl bg-slate-50 p-3">
                                    <div className="flex items-start justify-between gap-2">
                                      <div className="min-w-0">
                                        <p className="truncate font-bold text-slate-900">{r.name}</p>
                                        <p className="text-xs text-slate-500">
                                          {r.role || "—"} • {toNumber(r.hoursPlanned)} ساعة
                                        </p>
                                      </div>
                                      <div className="text-left">
                                        <p className="font-black text-slate-900">
                                          {currency(cost, currencyCode)}
                                        </p>
                                        <button
                                          onClick={() => deleteResource(r.id)}
                                          className="mt-1 text-xs font-bold text-red-700 hover:underline"
                                        >
                                          حذف
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}

                              {(resByProject[p.id] || []).length === 0 ? (
                                <div className="rounded-2xl border border-dashed border-slate-300 p-4 text-center text-sm text-slate-500">
                                  لا توجد موارد بعد
                                </div>
                              ) : null}
                            </div>
                          </div>
                        </div>

                        {/* Tasks */}
                        <div className="xl:col-span-4">
                          <div className="rounded-2xl border border-slate-200 bg-white p-4">
                            <div className="mb-3 flex items-center gap-2">
                              <CalendarClock className="h-4 w-4 text-slate-500" />
                              <h4 className="font-black text-slate-900">الجدولة / المهام</h4>
                            </div>

                            <div className="space-y-2">
                              <input
                                value={taskForm.title}
                                onChange={(e) => setTaskForm((s) => ({ ...s, title: e.target.value }))}
                                placeholder="عنوان المهمة"
                                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm outline-none"
                              />
                              <div className="grid grid-cols-2 gap-2">
                                <input
                                  value={taskForm.assignedTo}
                                  onChange={(e) => setTaskForm((s) => ({ ...s, assignedTo: e.target.value }))}
                                  placeholder="مسؤول"
                                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm outline-none"
                                />
                                <select
                                  value={taskForm.status}
                                  onChange={(e) => setTaskForm((s) => ({ ...s, status: e.target.value }))}
                                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm outline-none"
                                >
                                  <option value="todo">قيد البدء</option>
                                  <option value="doing">قيد التنفيذ</option>
                                  <option value="done">تم</option>
                                </select>
                              </div>
                              <input
                                type="date"
                                value={taskForm.date}
                                onChange={(e) => setTaskForm((s) => ({ ...s, date: e.target.value }))}
                                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm outline-none"
                              />

                              <button
                                onClick={() => addTask(p.id)}
                                disabled={savingTask}
                                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 py-2.5 text-sm font-bold text-white hover:bg-slate-800 disabled:bg-slate-400"
                              >
                                <Plus className="h-4 w-4" />
                                {savingTask ? "جاري..." : "إضافة مهمة"}
                              </button>
                            </div>

                            <div className="mt-4 space-y-2">
                              {(tasksByProject[p.id] || []).slice(0, 10).map((t) => (
                                <div key={t.id} className="rounded-2xl bg-slate-50 p-3">
                                  <div className="flex items-start justify-between gap-2">
                                    <div className="min-w-0">
                                      <p className="truncate font-bold text-slate-900">{t.title}</p>
                                      <p className="text-xs text-slate-500">
                                        {t.assignedTo || "—"} • {t.date || "—"}
                                      </p>
                                    </div>

                                    <div className="flex items-center gap-2">
                                      <select
                                        value={t.status || "todo"}
                                        onChange={(e) => updateTaskStatus(t.id, e.target.value)}
                                        className="rounded-xl border border-slate-200 bg-white px-2 py-1 text-xs font-bold"
                                      >
                                        <option value="todo">قيد البدء</option>
                                        <option value="doing">قيد التنفيذ</option>
                                        <option value="done">تم</option>
                                      </select>

                                      <button
                                        onClick={() => deleteTask(t.id)}
                                        className="rounded-xl bg-red-50 px-2 py-1 text-xs font-bold text-red-700 hover:bg-red-100"
                                      >
                                        حذف
                                      </button>
                                    </div>
                                  </div>

                                  <div className="mt-2">
                                    {t.status === "done" ? (
                                      <span className="inline-flex items-center gap-1 rounded-xl bg-emerald-100 px-2 py-1 text-xs font-bold text-emerald-800">
                                        <CheckCircle2 className="h-3 w-3" />
                                        تم
                                      </span>
                                    ) : t.status === "doing" ? (
                                      <span className="inline-flex items-center gap-1 rounded-xl bg-amber-100 px-2 py-1 text-xs font-bold text-amber-800">
                                        <AlertTriangle className="h-3 w-3" />
                                        قيد التنفيذ
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center gap-1 rounded-xl bg-slate-200 px-2 py-1 text-xs font-bold text-slate-700">
                                        قيد البدء
                                      </span>
                                    )}
                                  </div>
                                </div>
                              ))}

                              {(tasksByProject[p.id] || []).length === 0 ? (
                                <div className="rounded-2xl border border-dashed border-slate-300 p-4 text-center text-sm text-slate-500">
                                  لا توجد مهام بعد
                                </div>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Budget warning */}
                      {over ? (
                        <div className="mt-4 rounded-2xl bg-red-50 p-4 text-sm font-bold text-red-700">
                          ⚠️ التكاليف تجاوزت الميزانية بمقدار {currency(Math.abs(diff), currencyCode)}
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              );
            })}

            {filteredProjects.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-slate-500">
                لا توجد مشاريع مطابقة
              </div>
            ) : null}
          </div>
        </Card>
      </div>
    </div>
  );
}