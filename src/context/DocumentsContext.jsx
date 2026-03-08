import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { onValue, push, ref, remove, set, update } from "firebase/database";
import { db } from "../firebase/db";
import { AuthContext } from "./AuthContext";
import { downloadCsv } from "../utils/csv";

export const DocumentsContext = createContext(null);

const initialDocumentForm = {
  title: "",
  docNumber: "",         // رقم مستند داخلي/خارجي
  category: "general",   // general | contracts | invoices | taxes | hr | quality | legal | suppliers | customers | assets | projects
  type: "file",          // file | link
  fileUrl: "",           // رابط Google Drive/Dropbox/موقع/… (مطلوب)
  issuer: "",            // جهة إصدار
  relatedModule: "none", // none | customer | supplier | project | asset | invoice | purchaseInvoice | policy | audit | ...
  relatedId: "",         // id المرجع لو موجود
  tagsText: "",          // comma separated
  issueDate: "",         // YYYY-MM-DD
  expiryDate: "",        // YYYY-MM-DD (اختياري)
  status: "active",      // active | archived
  notes: "",
};

function safeArr(v) {
  return Array.isArray(v) ? v : [];
}
function safeObj(v) {
  return v && typeof v === "object" ? v : {};
}
function toText(v) {
  return String(v || "").trim();
}
function normalizeTags(tagsText) {
  return Array.from(
    new Set(
      String(tagsText || "")
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean)
    )
  );
}

export function DocumentsProvider({ children }) {
  const auth = useContext(AuthContext);
  const user = auth?.user || null;

  const [documents, setDocuments] = useState([]); // always []
  const [documentForm, setDocumentForm] = useState(initialDocumentForm);
  const [savingDocument, setSavingDocument] = useState(false);
  const [editingDocumentId, setEditingDocumentId] = useState(null);

  // filters
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all"); // all | active | archived
  const [typeFilter, setTypeFilter] = useState("all");     // all | file | link

  useEffect(() => {
    if (!user) return;

    const unsubDocs = onValue(ref(db, "documents"), (snap) => {
      const data = snap.val() || {};
      const parsed = Object.entries(data)
        .map(([id, v]) => ({ id, ...(v || {}) }))
        .sort((a, b) => (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0));
      setDocuments(parsed);
    });

    return () => unsubDocs();
  }, [user]);

  const filteredDocuments = useMemo(() => {
    const q = toText(query).toLowerCase();

    return safeArr(documents).filter((d) => {
      const statusOk = statusFilter === "all" ? true : (d.status || "active") === statusFilter;
      if (!statusOk) return false;

      const catOk = categoryFilter === "all" ? true : (d.category || "general") === categoryFilter;
      if (!catOk) return false;

      const typeOk = typeFilter === "all" ? true : (d.type || "file") === typeFilter;
      if (!typeOk) return false;

      if (!q) return true;
      const txt = `${d.title || ""} ${d.docNumber || ""} ${d.issuer || ""} ${(d.tags || []).join(" ")} ${d.category || ""}`.toLowerCase();
      return txt.includes(q);
    });
  }, [documents, query, categoryFilter, statusFilter, typeFilter]);

  const stats = useMemo(() => {
    const list = safeArr(documents);
    const total = list.length;
    const active = list.filter((d) => (d.status || "active") === "active").length;
    const archived = list.filter((d) => (d.status || "active") === "archived").length;

    const expiringSoon = list.filter((d) => {
      const ex = toText(d.expiryDate);
      if (!ex) return false;
      const exTime = new Date(`${ex}T12:00:00`).getTime();
      const diffDays = (exTime - Date.now()) / (1000 * 60 * 60 * 24);
      return diffDays >= 0 && diffDays <= 30;
    }).length;

    const expired = list.filter((d) => {
      const ex = toText(d.expiryDate);
      if (!ex) return false;
      const exTime = new Date(`${ex}T12:00:00`).getTime();
      return exTime < Date.now();
    }).length;

    return { total, active, archived, expiringSoon, expired };
  }, [documents]);

  const addActivity = async ({ action, refId, message }) => {
    try {
      const newRef = push(ref(db, "activityLog"));
      await set(newRef, {
        module: "documents",
        action: action || "",
        refType: "document",
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

  const saveDocument = async () => {
    const title = toText(documentForm.title);
    const url = toText(documentForm.fileUrl);

    if (!title) return window.alert("من فضلك أدخل اسم المستند");
    if (!url) return window.alert("من فضلك أدخل رابط المستند (URL)");

    // docNumber unique if provided
    const docNumber = toText(documentForm.docNumber);
    if (docNumber) {
      const dup = safeArr(documents).find(
        (d) => d.id !== editingDocumentId && String(d.docNumber || "").trim() === docNumber
      );
      if (dup) return window.alert("رقم المستند مستخدم بالفعل");
    }

    setSavingDocument(true);
    try {
      const now = Date.now();

      const payload = {
        title,
        docNumber,
        category: documentForm.category || "general",
        type: documentForm.type || "file",
        fileUrl: url,
        issuer: toText(documentForm.issuer),
        relatedModule: documentForm.relatedModule || "none",
        relatedId: toText(documentForm.relatedId),
        tags: normalizeTags(documentForm.tagsText),
        issueDate: documentForm.issueDate || "",
        expiryDate: documentForm.expiryDate || "",
        status: documentForm.status || "active",
        notes: toText(documentForm.notes),
        updatedAt: now,
        updatedBy: user?.name || user?.phone || "",
      };

      if (editingDocumentId) {
        await update(ref(db, `documents/${editingDocumentId}`), payload);
        await addActivity({ action: "update", refId: editingDocumentId, message: `تم تعديل مستند: ${title}` });
        window.alert("تم تعديل المستند ✅");
      } else {
        const newRef = push(ref(db, "documents"));
        await set(newRef, {
          ...payload,
          createdAt: now,
          createdBy: user?.name || user?.phone || "",
        });
        await addActivity({ action: "create", refId: newRef.key, message: `تم إضافة مستند: ${title}` });
        window.alert("تم حفظ المستند ✅");
      }

      setDocumentForm(initialDocumentForm);
      setEditingDocumentId(null);
    } catch (e) {
      window.alert(e?.message || "حدث خطأ أثناء حفظ المستند");
    } finally {
      setSavingDocument(false);
    }
  };

  const startEditDocument = (doc) => {
    if (!doc) return;
    setEditingDocumentId(doc.id);
    setDocumentForm({
      title: doc.title || "",
      docNumber: doc.docNumber || "",
      category: doc.category || "general",
      type: doc.type || "file",
      fileUrl: doc.fileUrl || "",
      issuer: doc.issuer || "",
      relatedModule: doc.relatedModule || "none",
      relatedId: doc.relatedId || "",
      tagsText: Array.isArray(doc.tags) ? doc.tags.join(", ") : "",
      issueDate: doc.issueDate || "",
      expiryDate: doc.expiryDate || "",
      status: doc.status || "active",
      notes: doc.notes || "",
    });
  };

  const cancelEditDocument = () => {
    setEditingDocumentId(null);
    setDocumentForm(initialDocumentForm);
  };

  const deleteDocument = async (id) => {
    const ok = window.confirm("هل تريد حذف هذا المستند؟");
    if (!ok) return;

    try {
      const d = safeArr(documents).find((x) => x.id === id);
      await remove(ref(db, `documents/${id}`));
      await addActivity({ action: "delete", refId: id, message: `تم حذف مستند: ${d?.title || ""}` });
    } catch (e) {
      window.alert(e?.message || "حدث خطأ أثناء حذف المستند");
    }
  };

  const setDocumentStatus = async (id, status) => {
    if (!id) return;
    try {
      await update(ref(db, `documents/${id}`), {
        status,
        updatedAt: Date.now(),
        updatedBy: user?.name || user?.phone || "",
      });
      await addActivity({ action: "status", refId: id, message: `تم تغيير حالة المستند إلى: ${status}` });
    } catch (e) {
      window.alert(e?.message || "خطأ أثناء تغيير الحالة");
    }
  };

  const exportDocumentsCsv = (rows = filteredDocuments) => {
    const headers = [
      "الاسم",
      "رقم المستند",
      "التصنيف",
      "النوع",
      "الرابط",
      "جهة الإصدار",
      "تاريخ الإصدار",
      "تاريخ الانتهاء",
      "الحالة",
      "Tags",
    ];

    const data = safeArr(rows).map((d) => [
      d.title || "",
      d.docNumber || "",
      d.category || "",
      d.type || "",
      d.fileUrl || "",
      d.issuer || "",
      d.issueDate || "",
      d.expiryDate || "",
      d.status || "",
      Array.isArray(d.tags) ? d.tags.join(", ") : "",
    ]);

    downloadCsv("karma-documents.csv", headers, data);
  };

  const value = {
    documents,
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
  };

  return <DocumentsContext.Provider value={value}>{children}</DocumentsContext.Provider>;
}

export function useDocuments() {
  return useContext(DocumentsContext);
}