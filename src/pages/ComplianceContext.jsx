

        import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { onValue, push, ref, remove, set, update } from "firebase/database";
import { db } from "../firebase/db";
import { AuthContext } from "../context/AuthContext";

export const ComplianceContext = createContext(null);

const initialComplianceSettings = {
  accountingStandards: {
    activeStandard: "EAS", // EAS | IFRS | IFRS_SME
    enabled: {
      EAS: true,
      IFRS: false,
      IFRS_SME: false,
    },
    notes: "",
  },
  qualityFrameworks: {
    ISO9001: true,
    COSO: true,
    ISO27001: false,
  },
};

const initialPolicyForm = {
  code: "",
  title: "",
  scope: "", // sales | purchases | inventory | treasury | ...
  ownerName: "",
  status: "draft", // draft | review | approved | active | archived
  effectiveDate: "", // YYYY-MM-DD
  reviewDueDate: "", // YYYY-MM-DD
  notes: "",
  tagsText: "", // comma separated
  isActive: true,
};

function toText(v) {
  return String(v || "").trim();
}

function normalizeTags(tagsText) {
  const raw = String(tagsText || "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
  // remove duplicates
  return Array.from(new Set(raw));
}

function safeObj(v) {
  return v && typeof v === "object" ? v : {};
}

export function ComplianceProvider({ children }) {
  const auth = useContext(AuthContext);
  const user = auth?.user || null;

  // Settings
  const [complianceSettings, setComplianceSettings] = useState(initialComplianceSettings);
  const [savingComplianceSettings, setSavingComplianceSettings] = useState(false);

  // Lists
  const [standards, setStandards] = useState([]);
  const [policies, setPolicies] = useState([]);
  const [policyVersions, setPolicyVersions] = useState({}); // optional later
  const [audits, setAudits] = useState([]); // optional later
  const [capa, setCapa] = useState([]); // optional later
  const [activityLog, setActivityLog] = useState([]);

  // Forms
  const [policyForm, setPolicyForm] = useState(initialPolicyForm);
  const [savingPolicy, setSavingPolicy] = useState(false);
  const [editingPolicyId, setEditingPolicyId] = useState(null);

  // Filters
  const [policyQuery, setPolicyQuery] = useState("");
  const [policyStatusFilter, setPolicyStatusFilter] = useState("all"); // all | draft | review | approved | active | archived

  /* =========================
     Realtime listeners
  ========================= */
  useEffect(() => {
    if (!user) return;

    const unsubSettings = onValue(ref(db, "settings/compliance"), (snap) => {
      const data = snap.val();
      if (!data) {
        setComplianceSettings(initialComplianceSettings);
        return;
      }

      const d = safeObj(data);
      setComplianceSettings({
        accountingStandards: {
          activeStandard: d?.accountingStandards?.activeStandard || "EAS",
          enabled: {
            EAS: !!d?.accountingStandards?.enabled?.EAS,
            IFRS: !!d?.accountingStandards?.enabled?.IFRS,
            IFRS_SME: !!d?.accountingStandards?.enabled?.IFRS_SME,
          },
          notes: d?.accountingStandards?.notes || "",
        },
        qualityFrameworks: {
          ISO9001: !!d?.qualityFrameworks?.ISO9001,
          COSO: !!d?.qualityFrameworks?.COSO,
          ISO27001: !!d?.qualityFrameworks?.ISO27001,
        },
      });
    });

    const unsubStandards = onValue(ref(db, "complianceStandards"), (snap) => {
      const data = snap.val() || {};
      const parsed = Object.entries(data)
        .map(([id, v]) => ({ id, ...(v || {}) }))
        .sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), "ar"));
      setStandards(parsed);
    });

    const unsubPolicies = onValue(ref(db, "policies"), (snap) => {
      const data = snap.val() || {};
      const parsed = Object.entries(data)
        .map(([id, v]) => ({ id, ...(v || {}) }))
        .sort((a, b) => (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0));
      setPolicies(parsed);
    });

    const unsubActivity = onValue(ref(db, "activityLog"), (snap) => {
      const data = snap.val() || {};
      const parsed = Object.entries(data)
        .map(([id, v]) => ({ id, ...(v || {}) }))
        .filter((x) => x.module === "compliance")
        .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
        .slice(0, 50);
      setActivityLog(parsed);
    });

    return () => {
      unsubSettings();
      unsubStandards();
      unsubPolicies();
      unsubActivity();
    };
  }, [user]);

  /* =========================
     Helpers
  ========================= */
  const addActivity = async ({ action, refType, refId, message }) => {
    try {
      const newRef = push(ref(db, "activityLog"));
      await set(newRef, {
        module: "compliance",
        action: action || "",
        refType: refType || "",
        refId: refId || "",
        message: message || "",
        userId: user?.id || user?.uid || "",
        userName: user?.name || user?.phone || "",
        createdAt: Date.now(),
      });
    } catch {
      // ignore
    }
  };

  /* =========================
     Settings Actions
  ========================= */
  const saveComplianceSettings = async () => {
    setSavingComplianceSettings(true);
    try {
      await set(ref(db, "settings/compliance"), complianceSettings);
      await addActivity({
        action: "update_settings",
        refType: "settings",
        refId: "settings/compliance",
        message: "تم تحديث إعدادات الامتثال",
      });
      window.alert("تم حفظ إعدادات الامتثال ✅");
    } catch (e) {
      window.alert(e?.message || "حدث خطأ أثناء حفظ الإعدادات");
    } finally {
      setSavingComplianceSettings(false);
    }
  };

  /* =========================
     Policies CRUD
  ========================= */
  const savePolicy = async () => {
    const title = toText(policyForm.title);
    if (!title) return window.alert("من فضلك أدخل اسم السياسة/الإجراء");

    const code = toText(policyForm.code).toUpperCase();
    const scope = toText(policyForm.scope);
    const ownerName = toText(policyForm.ownerName);
    const status = policyForm.status || "draft";

    // code unique if exists
    if (code) {
      const dup = policies.find(
        (p) => p.id !== editingPolicyId && String(p.code || "").toUpperCase() === code
      );
      if (dup) return window.alert("كود السياسة مستخدم بالفعل");
    }

    setSavingPolicy(true);
    try {
      const now = Date.now();
      const payload = {
        code,
        title,
        scope,
        ownerName,
        status,
        effectiveDate: policyForm.effectiveDate || "",
        reviewDueDate: policyForm.reviewDueDate || "",
        notes: toText(policyForm.notes),
        tags: normalizeTags(policyForm.tagsText),
        isActive: !!policyForm.isActive,
        updatedAt: now,
        updatedBy: user?.name || user?.phone || "",
      };

      if (editingPolicyId) {
        await update(ref(db, `policies/${editingPolicyId}`), payload);

        // optional versioning later
        await addActivity({
          action: "update_policy",
          refType: "policy",
          refId: editingPolicyId,
          message: `تم تعديل السياسة: ${title}`,
        });

        window.alert("تم تعديل السياسة ✅");
      } else {
        const newRef = push(ref(db, "policies"));
        await set(newRef, {
          ...payload,
          version: 1,
          createdAt: now,
          createdBy: user?.name || user?.phone || "",
        });

        await addActivity({
          action: "create_policy",
          refType: "policy",
          refId: newRef.key,
          message: `تم إنشاء سياسة: ${title}`,
        });

        window.alert("تم حفظ السياسة ✅");
      }

      setPolicyForm(initialPolicyForm);
      setEditingPolicyId(null);
    } catch (e) {
      window.alert(e?.message || "حدث خطأ أثناء حفظ السياسة");
    } finally {
      setSavingPolicy(false);
    }
  };

  const startEditPolicy = (policy) => {
    if (!policy) return;
    setEditingPolicyId(policy.id);
    setPolicyForm({
      code: policy.code || "",
      title: policy.title || "",
      scope: policy.scope || "",
      ownerName: policy.ownerName || "",
      status: policy.status || "draft",
      effectiveDate: policy.effectiveDate || "",
      reviewDueDate: policy.reviewDueDate || "",
      notes: policy.notes || "",
      tagsText: Array.isArray(policy.tags) ? policy.tags.join(", ") : "",
      isActive: !!policy.isActive,
    });
  };

  const cancelEditPolicy = () => {
    setEditingPolicyId(null);
    setPolicyForm(initialPolicyForm);
  };

  const deletePolicy = async (policyId) => {
    const ok = window.confirm("هل تريد حذف هذه السياسة؟");
    if (!ok) return;

    try {
      const p = policies.find((x) => x.id === policyId);
      await remove(ref(db, `policies/${policyId}`));
      await addActivity({
        action: "delete_policy",
        refType: "policy",
        refId: policyId,
        message: `تم حذف السياسة: ${p?.title || ""}`,
      });
    } catch (e) {
      window.alert(e?.message || "حدث خطأ أثناء الحذف");
    }
  };

  const setPolicyStatus = async (policyId, status) => {
    if (!policyId) return;
    try {
      await update(ref(db, `policies/${policyId}`), {
        status,
        updatedAt: Date.now(),
        updatedBy: user?.name || user?.phone || "",
      });
      await addActivity({
        action: "change_policy_status",
        refType: "policy",
        refId: policyId,
        message: `تم تغيير حالة السياسة إلى: ${status}`,
      });
    } catch (e) {
      window.alert(e?.message || "حدث خطأ أثناء تغيير الحالة");
    }
  };

  /* =========================
     Derived
  ========================= */
  const filteredPolicies = useMemo(() => {
    const q = String(policyQuery || "").trim().toLowerCase();
    return (policies || []).filter((p) => {
      const statusOk = policyStatusFilter === "all" ? true : (p.status || "") === policyStatusFilter;
      if (!statusOk) return false;
      if (!q) return true;

      const txt = `${p.title || ""} ${p.code || ""} ${p.scope || ""} ${p.ownerName || ""}`.toLowerCase();
      return txt.includes(q);
    });
  }, [policies, policyQuery, policyStatusFilter]);

  const stats = useMemo(() => {
    const list = policies || [];
    const total = list.length;

    const byStatus = list.reduce((acc, p) => {
      const s = p.status || "draft";
      acc[s] = (acc[s] || 0) + 1;
      return acc;
    }, {});

    const today = new Date();
    const todayKey = today.toISOString().slice(0, 10);

    const reviewDueSoon = list.filter((p) => {
      const due = String(p.reviewDueDate || "").trim();
      if (!due) return false;
      // due <= today OR within 14 days
      const dueTime = new Date(`${due}T12:00:00`).getTime();
      const now = Date.now();
      const diffDays = (dueTime - now) / (1000 * 60 * 60 * 24);
      return diffDays <= 14;
    }).length;

    const overdue = list.filter((p) => {
      const due = String(p.reviewDueDate || "").trim();
      if (!due) return false;
      const dueTime = new Date(`${due}T12:00:00`).getTime();
      return dueTime < Date.now();
    }).length;

    return {
      total,
      byStatus,
      reviewDueSoon,
      overdue,
      todayKey,
    };
  }, [policies]);

  const value = {
    // settings
    complianceSettings,
    setComplianceSettings,
    savingComplianceSettings,
    saveComplianceSettings,

    // standards
    standards,

    // policies
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

    // other
    activityLog,
    stats,
  };

  return <ComplianceContext.Provider value={value}>{children}</ComplianceContext.Provider>;
}

export function useCompliance() {
  return useContext(ComplianceContext);
}