import React, { useMemo, useState, useEffect } from "react";
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Receipt,
  Settings,
  Store,
  LogOut,
  UserCircle2,
  Users,
  Truck,
  FilePlus2,
  BarChart3,
  Wallet,
  SmartphoneCharging,
  HandCoins,
  Users2,
  BadgePercent,
  ChevronDown,
  CalendarDays,
  Vault,
} from "lucide-react";
import { Barcode as BarcodeIcon } from "lucide-react";

const allNavItems = [
  { key: "dashboard", label: "الرئيسية", icon: LayoutDashboard },

  { key: "products", label: "المخزن", icon: Package },
  { key: "barcodePrint", label: "طباعة باركود", icon: BarcodeIcon },

  { key: "pos", label: "البيع", icon: ShoppingCart },
  { key: "sales", label: "فواتير البيع", icon: Receipt },
  { key: "treasury", label: "الخزينة", icon: Vault },

  { key: "customers", label: "العملاء", icon: Users },
  { key: "suppliers", label: "الموردين", icon: Truck },

  { key: "purchaseInvoices", label: "فواتير الشراء", icon: FilePlus2 },
  {key:"cashDrawer", label: "درج النقديه" , icon:Wallet},
  { key: "expiryReports", label: "تقرير الصلاحية", icon: CalendarDays },

  { key: "walletTransfers", label: "تحويلات المحافظ", icon: Wallet },
  { key: "charging", label: "الشحن والخدمات", icon: SmartphoneCharging },
  { key: "expenses", label: "المصروفات", icon: HandCoins },
  { key: "shipping", label: "إدارة الشحن", icon: Truck },

  { key: "employees", label: "إدارة الموظفين", icon: Users2 },
  { key: "taxes", label: "إدارة الضرائب", icon: BadgePercent },

  { key: "reports", label: "التقارير", icon: BarChart3 },
  { key: "settings", label: "الإعدادات", icon: Settings },
];

function getAllowedPages(role) {
  switch (role) {
    case "owner":
      return allNavItems.map((item) => item.key);

    case "cashier":
      return ["pos", "sales", "charging", "expenses"];

    case "storekeeper":
      return ["dashboard", "products", "barcodePrint", "suppliers", "purchaseInvoices"];

    case "accountant":
      return ["dashboard", "sales", "customers", "walletTransfers", "charging", "expenses", "reports", "taxes", "employees"];

    default:
      return ["pos", "charging"];
  }
}

// مجموعات القوائم (Dropdown)
const navGroups = [
  {
    id: "home",
    title: "الرئيسية",
    items: ["dashboard", "reports" , 'expiryReports' ,  "cashDrawer"],
  },
  {
    id: "inventory",
    title: "المخزن",
    items: ["products", "barcodePrint" , "shipping"],
  },
  {
    id: "sales",
    title: "المبيعات",
    items: ["pos", "sales", "customers" , "treasury"],
  },
  {
    id: "purchases",
    title: "المشتريات",
    items: ["suppliers", "purchaseInvoices"],
  },
  {
    id: "finance",
    title: "الحسابات",
    items: ["walletTransfers", "charging", "expenses"],
  },
  {
    id: "hr",
    title: "الموظفين والرواتب",
    items: ["employees"],
  },
  {
    id: "tax",
    title: "الضرائب",
    items: ["taxes"],
  },
  {
    id: "settings",
    title: "الإعدادات",
    items: ["settings"],
  },
];

function roleLabel(role) {
  if (role === "owner") return "المالك";
  if (role === "cashier") return "كاشير";
  if (role === "storekeeper") return "مسؤول مخزن";
  if (role === "accountant") return "حسابات";
  return role || "مستخدم";
}

export default function Sidebar({ active, onChange, userLabel, userRole, onLogout }) {
  const allowedPages = useMemo(() => getAllowedPages(userRole), [userRole]);

  const allowedItemsMap = useMemo(() => {
    const map = {};
    allNavItems.forEach((it) => {
      if (allowedPages.includes(it.key)) map[it.key] = it;
    });
    return map;
  }, [allowedPages]);

  // المجموعات بعد تطبيق الصلاحيات
  const groups = useMemo(() => {
    return navGroups
      .map((g) => {
        const items = g.items
          .map((key) => allowedItemsMap[key])
          .filter(Boolean);
        return { ...g, items };
      })
      .filter((g) => g.items.length > 0);
  }, [allowedItemsMap]);

  // فتح المجموعة اللي تحتوي الصفحة الحالية تلقائي
  const groupIdByActive = useMemo(() => {
    const found = navGroups.find((g) => g.items.includes(active));
    return found?.id || null;
  }, [active]);

  const [openGroups, setOpenGroups] = useState(() => {
    if (groupIdByActive) return { [groupIdByActive]: true };
    return { home: true };
  });

  useEffect(() => {
    if (!groupIdByActive) return;
    setOpenGroups((prev) => ({ ...prev, [groupIdByActive]: true }));
  }, [groupIdByActive]);

  const toggleGroup = (id) => {
    setOpenGroups((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <aside className="rounded-[28px] bg-slate-950 p-4 text-white xl:sticky xl:top-4 xl:h-[calc(100vh-2rem)]">
      {/* Header */}
      <div className="mb-4 flex items-center gap-3 rounded-3xl bg-white/10 p-4">
        <div className="rounded-2xl bg-white/10 p-3">
          <Store className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-xl font-black">كارما ماركت</h1>
          <p className="text-xs text-slate-300">نظام إدارة المخزن والبيع</p>
        </div>
      </div>

      {/* Nav (Scrollable) */}
      <div className="max-h-[calc(100vh-320px)] overflow-auto pr-1">
        <nav className="space-y-3">
          {groups.map((group) => {
            const isOpen = !!openGroups[group.id];

            return (
              <div key={group.id} className="rounded-3xl bg-white/5 p-2">
                <button
                  type="button"
                  onClick={() => toggleGroup(group.id)}
                  className="flex w-full items-center justify-between gap-3 rounded-2xl px-3 py-3 text-right text-sm font-bold text-white/90 transition hover:bg-white/10"
                >
                  <span>{group.title}</span>
                  <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                </button>

                {isOpen ? (
                  <div className="mt-2 space-y-1">
                    {group.items.map(({ key, label, icon: Icon }) => (
                      <button
                        key={key}
                        onClick={() => onChange(key)}
                        className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-right text-sm font-medium transition ${
                          active === key ? "bg-white text-slate-900" : "text-slate-200 hover:bg-white/10"
                        }`}
                      >
                        <Icon className="h-4 w-4" />
                        <span className="truncate">{label}</span>
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            );
          })}
        </nav>
      </div>

      {/* User + Logout */}
      <div className="mt-4 rounded-3xl bg-white/10 p-4">
        <div className="flex items-center gap-3">
          <UserCircle2 className="h-9 w-9" />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{userLabel || "مستخدم"}</p>
            <p className="text-xs text-slate-300">الصلاحية: {roleLabel(userRole)}</p>
          </div>
        </div>

        <button
          onClick={onLogout}
          className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-bold text-slate-900 transition hover:bg-slate-200"
        >
          <LogOut className="h-4 w-4" />
          تسجيل الخروج
        </button>
      </div>
    </aside>
  );
}