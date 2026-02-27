import React, { useContext, useEffect, useState } from "react";
import { Save, Settings as SettingsIcon, UserPlus } from "lucide-react";
import { PosContext } from "../context/PosContext";
import { AuthContext } from "../context/AuthContext";
import { db } from "../firebase/db";
import { onValue, push, ref, set } from "firebase/database";
import Card from "../components/Card";
import SectionTitle from "../components/SectionTitle";

const initialUserForm = {
  name: "",
  phone: "",
  role: "cashier",
  isActive: true,
};

export default function Settings() {
  const { settings, setSettings } = useContext(PosContext);
  const { user } = useContext(AuthContext);

  const [saving, setSaving] = useState(false);
  const [users, setUsers] = useState([]);
  const [userForm, setUserForm] = useState(initialUserForm);
  const [savingUser, setSavingUser] = useState(false);

  useEffect(() => {
    const unsub = onValue(ref(db, "users"), (snapshot) => {
      const data = snapshot.val() || {};
      const parsed = Object.entries(data).map(([id, value]) => ({
        id,
        ...value,
      }));
      setUsers(parsed);
    });

    return () => unsub();
  }, []);

  const onSave = async () => {
    setSaving(true);
    try {
      await set(ref(db, "settings/general"), {
        storeName: settings.storeName || "كرمة ماركت",
        currencyCode: settings.currencyCode || "EGP",
      });
      window.alert("تم حفظ الإعدادات");
    } catch (error) {
      window.alert(error?.message || "حدث خطأ أثناء الحفظ");
    } finally {
      setSaving(false);
    }
  };

  const saveUser = async () => {
    if (!userForm.name.trim()) {
      window.alert("من فضلك أدخل اسم المستخدم");
      return;
    }

    if (!userForm.phone.trim()) {
      window.alert("من فضلك أدخل رقم الهاتف");
      return;
    }

    setSavingUser(true);
    try {
      const newRef = push(ref(db, "users"));
      await set(newRef, {
        name: userForm.name.trim(),
        phone: userForm.phone.trim(),
        role: userForm.role,
        isActive: !!userForm.isActive,
        createdAt: Date.now(),
      });

      setUserForm(initialUserForm);
      window.alert("تم حفظ المستخدم");
    } catch (error) {
      window.alert(error?.message || "حدث خطأ أثناء حفظ المستخدم");
    } finally {
      setSavingUser(false);
    }
  };

  const isOwner = (user?.role || "cashier") === "owner";

  if (!isOwner) {
    return (
      <div className="grid grid-cols-1 gap-6">
        <Card>
          <SectionTitle
            title="الإعدادات"
            subtitle="غير مسموح لك بالدخول هنا"
            icon={SettingsIcon}
          />
          <div className="rounded-2xl bg-red-50 p-4 text-red-700">
            هذه الصفحة متاحة فقط لصاحب المحل أو المدير الرئيسي.
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
      <Card className="xl:col-span-6">
        <SectionTitle
          title="الإعدادات العامة"
          subtitle="إعدادات النظام الأساسية"
          icon={SettingsIcon}
        />

        <div className="space-y-4">
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">اسم المحل</label>
            <input
              value={settings.storeName || ""}
              onChange={(e) => setSettings((s) => ({ ...s, storeName: e.target.value }))}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:border-slate-400"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">العملة</label>
            <input
              value={settings.currencyCode || "EGP"}
              onChange={(e) =>
                setSettings((s) => ({ ...s, currencyCode: e.target.value.toUpperCase() }))
              }
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:border-slate-400"
            />
          </div>

          <button
            onClick={onSave}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-bold text-white transition hover:bg-slate-800 disabled:bg-slate-400"
          >
            <Save className="h-4 w-4" />
            {saving ? "جاري الحفظ..." : "حفظ الإعدادات"}
          </button>
        </div>
      </Card>

      <Card className="xl:col-span-6">
        <SectionTitle
          title="إضافة مستخدم"
          subtitle="مثال: كاشير يبيع فقط"
          icon={UserPlus}
        />

        <div className="space-y-4">
          <input
            value={userForm.name}
            onChange={(e) => setUserForm((s) => ({ ...s, name: e.target.value }))}
            placeholder="اسم المستخدم"
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
          />

          <input
            value={userForm.phone}
            onChange={(e) => setUserForm((s) => ({ ...s, phone: e.target.value }))}
            placeholder="رقم الهاتف"
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
          />

          <select
            value={userForm.role}
            onChange={(e) => setUserForm((s) => ({ ...s, role: e.target.value }))}
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
          >
            <option value="owner">مالك</option>
            <option value="cashier">كاشير</option>
            <option value="storekeeper">مسؤول مخزن</option>
            <option value="accountant">حسابات</option>
          </select>

          <select
            value={String(userForm.isActive)}
            onChange={(e) => setUserForm((s) => ({ ...s, isActive: e.target.value === "true" }))}
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
          >
            <option value="true">مفعل</option>
            <option value="false">غير مفعل</option>
          </select>

          <button
            onClick={saveUser}
            disabled={savingUser}
            className="inline-flex items-center gap-2 rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white"
          >
            <UserPlus className="h-4 w-4" />
            {savingUser ? "جاري الحفظ..." : "حفظ المستخدم"}
          </button>
        </div>

        <div className="mt-6 space-y-3">
          {users.map((item) => (
            <div key={item.id} className="rounded-2xl bg-slate-50 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-bold">{item.name}</p>
                  <p className="text-sm text-slate-500">{item.phone}</p>
                </div>

                <div className="text-left text-sm">
                  <p>
                    الصلاحية:{" "}
                    {item.role === "owner"
                      ? "مالك"
                      : item.role === "cashier"
                      ? "كاشير"
                      : item.role === "storekeeper"
                      ? "مسؤول مخزن"
                      : item.role === "accountant"
                      ? "حسابات"
                      : item.role}
                  </p>
                  <p>{item.isActive ? "مفعل" : "غير مفعل"}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}