import React from "react";
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
  Wallet,
  SmartphoneCharging,
} from "lucide-react";

const allNavItems = [
  { key: "dashboard", label: "الرئيسية", icon: LayoutDashboard },
  { key: "products", label: "المخزن", icon: Package },
  { key: "pos", label: "البيع", icon: ShoppingCart },
  { key: "sales", label: "فواتير البيع", icon: Receipt },
  { key: "customers", label: "العملاء", icon: Users },
  { key: "suppliers", label: "الموردين", icon: Truck },
  { key: "purchaseInvoices", label: "فواتير الشراء", icon: FilePlus2 },
  { key: "walletTransfers", label: "تحويلات المحافظ", icon: Wallet },
  { key: "charging", label: "الشحن والخدمات", icon: SmartphoneCharging },
  { key: "settings", label: "الإعدادات", icon: Settings },
];

function getAllowedPages(role) {
  switch (role) {
    case "owner":
      return allNavItems.map((item) => item.key);

    case "cashier":
      return ["pos", "sales", "charging"];

    case "storekeeper":
      return ["dashboard", "products", "suppliers", "purchaseInvoices"];

    case "accountant":
      return ["dashboard", "sales", "customers", "walletTransfers", "charging"];

    default:
      return ["pos", "charging"];
  }
}

export default function Sidebar({ active, onChange, userLabel, userRole, onLogout }) {
  const allowedPages = getAllowedPages(userRole);
  const navItems = allNavItems.filter((item) => allowedPages.includes(item.key));

  return (
    <aside className="rounded-[28px] bg-slate-950 p-4 text-white xl:sticky xl:top-4 xl:h-[calc(100vh-2rem)]">
      <div className="mb-6 flex items-center gap-3 rounded-3xl bg-white/10 p-4">
        <div className="rounded-2xl bg-white/10 p-3">
          <Store className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-xl font-black">كارما ماركت</h1>
          <p className="text-xs text-slate-300">نظام إدارة المخزن والبيع</p>
        </div>
      </div>

      <nav className="space-y-2">
        {navItems.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => onChange(key)}
            className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-right text-sm font-medium transition ${
              active === key ? "bg-white text-slate-900" : "text-slate-200 hover:bg-white/10"
            }`}
          >
            <Icon className="h-4 w-4" />
            <span>{label}</span>
          </button>
        ))}
      </nav>

      <div className="mt-8 rounded-3xl bg-white/10 p-4">
        <div className="flex items-center gap-3">
          <UserCircle2 className="h-9 w-9" />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{userLabel || "مستخدم"}</p>
            <p className="text-xs text-slate-300">
              الصلاحية: {userRole === "owner"
                ? "المالك"
                : userRole === "cashier"
                ? "كاشير"
                : userRole === "storekeeper"
                ? "مسؤول مخزن"
                : userRole === "accountant"
                ? "حسابات"
                : userRole}
            </p>
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