import React, { useMemo, useState, useEffect, useRef } from "react";
import {
  LayoutDashboard,
  ShoppingCart,
  Receipt,
  SmartphoneCharging,
  BadgePercent,
  Package,
  Layers,
  Boxes,
  AlertTriangle,
  Users,
  Truck,
  HandCoins,
  Vault,
  FilePlus2,
  RotateCcw,
  BarChart3,
  ScanBarcode,
  Users2,
  Settings,
  Shield,
  FileText,
  ClipboardList,
  LogOut,
  UserCircle2,
  ChevronDown,
  Filter,
  ShieldCheck,
} from "lucide-react";

function roleLabel(role) {
  switch (role) {
    case "owner":
      return "المالك";
    case "cashier":
      return "كاشير";
    case "storekeeper":
      return "مسؤول مخزن";
    case "accountant":
      return "حسابات";
    default:
      return role || "مستخدم";
  }
}

/**
 * خريطة المجموعات والقوائم (حسب طلبك)
 * key: هي نفس activePage في App
 */
const NAV_GROUPS = [
  {
    groupKey: "home",
    title: "الرئيسية",
    icon: LayoutDashboard,
    items: [{ key: "dashboard", label: "الرئيسية", icon: LayoutDashboard }],
  },

  {
    groupKey: "sales",
    title: "المبيعات",
    icon: ShoppingCart,
    items: [
      { key: "pos", label: "البيع", icon: ShoppingCart },
      { key: "sales", label: "فواتير البيع", icon: Receipt },
      { key: "charging", label: "الشحن والخدمات", icon: SmartphoneCharging },
      // لاحقاً:
      { key: "offers", label: "العروض ", icon: Receipt, },
      { key: "creditSales", label: "البيع الآجل ", icon: Receipt },
    ],
  },

  {
    groupKey: "products",
    title: "المنتجات",
    icon: Package,
    items: [
      { key: "products", label: "إدارة المنتجات", icon: Package },
      { key: "productCategories", label: "فئات المنتجات ", icon: Layers, },
      { key: "uom", label: "وحدات القياس ", icon: Layers,  },
      { key: "inventory", label: "إدارة المخزون ", icon: Boxes, },
      { key: "threatenedStock", label: "مخازن متعدده ", icon: AlertTriangle, },
    ],
  },

  {
    groupKey: "customers",
    title: "العملاء",
    icon: Users,
    items: [{ key: "customers", label: "إدارة العملاء", icon: Users }],
  },

  {
    groupKey: "suppliers",
    title: "الموردين",
    icon: Truck,
    items: [{ key: "suppliers", label: "إدارة الموردين", icon: Truck }],
  },

  {
    groupKey: "transactions",
    title: "المعاملات",
    icon: Vault,
    items: [
      { key: "expenses", label: "المصروفات", icon: HandCoins },
      { key: "treasury", label: "الخزينة", icon: Vault },
      { key: "purchaseInvoices", label: "المشتريات", icon: FilePlus2 },
      { key: "returns", label: "المرتجعات ", icon: RotateCcw,  },
    ],
  },

  {
    groupKey: "reports",
    title: "التقارير المتطورة",
    icon: BarChart3,
    items: [
      { key: "reports", label: "التقارير", icon: BarChart3 },
      { key: "expiryReports", label: "تقارير الصلاحية ", icon: AlertTriangle,  },
      { key: "stockAudit", label: "جرد المخازن ", icon: ClipboardList, },
      { key: "barcodePrint", label: "طباعة الباركود", icon: ScanBarcode },
    ],
  },

  {
    groupKey: "advanced",
    title: "أنظمة متقدمة",
    icon: Users2,
    items: [
      { key: "employees", label: "إدارة الموظفين", icon: Users2 },
      { key: "projects", label: "إدارة المشاريع ", icon: ClipboardList,  },
      { key: "fixedAssets", label: "الأصول الثابتة ", icon: ClipboardList, },
      { key: "crm", label: "CRM ", icon: Users,  },
    ],
  },

  {
    groupKey: "addons",
    title: "أنظمة إضافية",
    icon: BadgePercent,
    items: [
      { key: "taxes", label: "الضرائب", icon: BadgePercent },
      { key: "quality", label: "الجودة ", icon: Shield,  },
      { key: "quality", label: "الجودة والامتثال", icon: ShieldCheck },
{ key: "policies", label: "السياسات والإجراءات", icon: FileText },
      { key: "docs", label: "إدارة المستندات ", icon: FileText, },
    ],
  },

  {
    groupKey: "admin",
    title: "الإدارة",
    icon: Settings,
    items: [

      { key: "settings", label: "الإعدادات", icon: Settings },
      { key: "activityLog", label: "سجل النشاط ", icon: ClipboardList,  },
    ],
  },
];

/**
 * صلاحيات بسيطة حسب الدور
 * كل key = activePage
 */
function getAllowedPages(role) {
  switch (role) {
    case "owner":
      return "ALL";

    case "cashier":
      return ["dashboard", "pos", "sales", "charging", "expenses", "treasury"];

    case "storekeeper":
      return ["dashboard", "products", "purchaseInvoices", "suppliers", "barcodePrint"];

    case "accountant":
      return ["dashboard", "sales", "customers", "suppliers", "purchaseInvoices", "expenses", "treasury", "taxes", "reports"];

    default:
      return ["dashboard", "pos"];
  }
}

function useOutsideClick(ref, onOutside) {
  useEffect(() => {
    const handle = (e) => {
      if (!ref.current) return;
      if (!ref.current.contains(e.target)) onOutside?.();
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [ref, onOutside]);
}

export default function TopNav({ active, onChange, userLabel, userRole, onLogout }) {
  const allowed = getAllowedPages(userRole);
  const canAccess = (pageKey) => allowed === "ALL" || (Array.isArray(allowed) && allowed.includes(pageKey));

  const groups = useMemo(() => {
    // فلترة العناصر حسب الصلاحية
    return NAV_GROUPS.map((g) => {
      const items = g.items.filter((it) => it.disabled || canAccess(it.key));
      return { ...g, items };
    }).filter((g) => g.items.length > 0);
  }, [userRole]);

  const [openGroup, setOpenGroup] = useState(null);
  const wrapRef = useRef(null);
  useOutsideClick(wrapRef, () => setOpenGroup(null));

  const activeGroupKey = useMemo(() => {
    for (const g of groups) {
      if (g.items.some((it) => it.key === active)) return g.groupKey;
    }
    return "home";
  }, [active, groups]);

  const handlePick = (item) => {
    if (item.disabled) return;
    onChange(item.key);
    setOpenGroup(null);
  };

  return (
    <header ref={wrapRef} className="sticky top-0 z-50 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="mx-auto max-w-[1800px] px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          {/* Brand */}
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-slate-950 px-3 py-2 text-white">
              <span className="text-sm font-black">Karma POS</span>
            </div>
            <div className="hidden sm:block">
              <p className="text-sm font-bold text-slate-900">كارما ماركت</p>
              <p className="text-xs text-slate-500">نظام إدارة المبيعات والمخزن</p>
            </div>
          </div>

          {/* Menus */}
          <nav className="hidden xl:flex items-center gap-2">
            {groups.map((g) => {
              const Icon = g.icon;
              const isOpen = openGroup === g.groupKey;
              const isActiveGroup = activeGroupKey === g.groupKey;

              return (
                <div key={g.groupKey} className="relative">
                  <button
                    type="button"
                    onClick={() => setOpenGroup((prev) => (prev === g.groupKey ? null : g.groupKey))}
                    className={`inline-flex items-center gap-2 rounded-2xl px-4 py-2 text-sm font-semibold transition ${
                      isActiveGroup ? "bg-slate-950 text-white" : "text-slate-700 hover:bg-slate-100"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{g.title}</span>
                    <ChevronDown className={`h-4 w-4 transition ${isOpen ? "rotate-180" : ""}`} />
                  </button>

                  {isOpen ? (
                    <div className="absolute right-0 mt-2 w-[320px] overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl">
                      <div className="p-2">
                        {g.items.map((it) => {
                          const ItIcon = it.icon || LayoutDashboard;
                          const isItemActive = it.key === active;
                          return (
                            <button
                              key={it.key}
                              type="button"
                              onClick={() => handlePick(it)}
                              className={`flex w-full items-center justify-between gap-3 rounded-2xl px-3 py-3 text-right text-sm transition ${
                                it.disabled
                                  ? "cursor-not-allowed opacity-50"
                                  : isItemActive
                                  ? "bg-slate-950 text-white"
                                  : "text-slate-700 hover:bg-slate-100"
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                <ItIcon className="h-4 w-4" />
                                <span className="font-semibold">{it.label}</span>
                              </div>

                              {it.disabled ? (
                                <span className="rounded-xl bg-slate-100 px-2 py-1 text-[11px] font-bold text-slate-600">
                                  قريباً
                                </span>
                              ) : null}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </nav>

          {/* User / Logout */}
          <div className="flex items-center gap-2">
            <div className="hidden md:flex items-center gap-2 rounded-2xl bg-slate-50 px-3 py-2">
              <UserCircle2 className="h-5 w-5 text-slate-600" />
              <div className="leading-tight">
                <p className="max-w-[180px] truncate text-xs font-bold text-slate-900">
                  {userLabel || "مستخدم"}
                </p>
                <p className="text-[11px] text-slate-500">الصلاحية: {roleLabel(userRole)}</p>
              </div>
            </div>

            <button
              type="button"
              onClick={onLogout}
              className="inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-4 py-2 text-sm font-bold text-white hover:bg-slate-800"
            >
              <LogOut className="h-4 w-4" />
              خروج
            </button>
          </div>
        </div>

        {/* Mobile: Select سريع */}
        <div className="mt-3 xl:hidden">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-2">
            <div className="flex items-center gap-2 text-slate-600">
              <Filter className="h-4 w-4" />
              <span className="text-xs font-bold">اختيار صفحة</span>
            </div>

            <select
              value={active}
              onChange={(e) => onChange(e.target.value)}
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none"
            >
              {groups.flatMap((g) =>
                g.items
                  .filter((it) => !it.disabled)
                  .map((it) => (
                    <option key={it.key} value={it.key}>
                      {g.title} - {it.label}
                    </option>
                  ))
              )}
            </select>
          </div>
        </div>
      </div>
    </header>
  );
}