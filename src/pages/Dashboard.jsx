import React, { useContext, useMemo } from "react";
import {
  Boxes,
  CircleDollarSign,
  PackageX,
  Receipt,
  Package,
  RotateCcw,
  TrendingUp,
  ShoppingCart,
  Plus,
  HandCoins,
  SmartphoneCharging,
  BarChart3,
  Barcode,
} from "lucide-react";
import { PosContext } from "../context/PosContext";
import { currency, numberFormat } from "../utils/format";
import Card from "../components/Card";
import SectionTitle from "../components/SectionTitle";
import StatCard from "../components/StatCard";
import SalesTable from "../components/SalesTable";

function sameDayKey(ts) {
  if (!ts) return "";
  return new Date(ts).toISOString().slice(0, 10);
}

export default function Dashboard({ onNavigate }) {
  const {
    settings,
    products,
    lowStockProducts,
    inventoryValue,
    invoices,
    todayInvoices,
    todaySales,
    todaySalesReturns,
    netTodaySales,
    expenses,
  } = useContext(PosContext);

  // Map سريع للمنتجات للوصول لسعر الشراء
  const productMap = useMemo(() => {
    const map = {};
    products.forEach((p) => {
      map[p.id] = p;
    });
    return map;
  }, [products]);

  // تكلفة البضاعة المباعة اليوم (COGS)
  const todayCogs = useMemo(() => {
    let sum = 0;

    todayInvoices.forEach((inv) => {
      (inv.items || []).forEach((it) => {
        const p = productMap[it.productId];
        if (!p) return;

        const qty = Number(it.qty || 0);
        if (!qty) return;

        const purchasePackagePrice = Number(p.purchasePackagePrice || 0);
        const itemsPerPackage = Math.max(1, Number(p.itemsPerPackage || 1));
        const purchaseItemPrice = purchasePackagePrice / itemsPerPackage;

        if (it.unitType === "package") {
          sum += qty * purchasePackagePrice;
        } else {
          // item
          sum += qty * purchaseItemPrice;
        }
      });
    });

    return sum;
  }, [todayInvoices, productMap]);

  // مصروفات اليوم
  const todayExpenses = useMemo(() => {
    const key = sameDayKey(Date.now());
    return (expenses || [])
      .filter((e) => sameDayKey(e.createdAt) === key)
      .reduce((s, e) => s + Number(e.amount || 0), 0);
  }, [expenses]);

  // صافي الربح اليوم
  const netTodayProfit = useMemo(() => {
    // صافي الربح = صافي المبيعات - تكلفة البضاعة - مصروفات اليوم
    return Number(netTodaySales || 0) - Number(todayCogs || 0) - Number(todayExpenses || 0);
  }, [netTodaySales, todayCogs, todayExpenses]);

  const profitColor =
    netTodayProfit > 0 ? "text-emerald-700" : netTodayProfit < 0 ? "text-red-700" : "text-slate-700";

  return (
    <div className="space-y-6">
      <header className="rounded-[28px] bg-gradient-to-r from-slate-950 to-slate-800 p-6 text-white shadow-lg">
        <h1 className="text-3xl font-black tracking-tight">
          {settings.storeName || "كرمة ماركت"}
        </h1>
        <p className="mt-2 text-sm text-slate-300">نظرة سريعة على المخزن والمبيعات</p>
      </header>

      {/* إجراءات سريعة */}
      <Card>
        <SectionTitle title="إجراءات سريعة" subtitle="اختصارات لأهم الشاشات" icon={TrendingUp} />

        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          <button
            onClick={() => onNavigate?.("pos")}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-bold text-white hover:bg-slate-800"
          >
            <ShoppingCart className="h-4 w-4" />
            بيع جديد
          </button>

          <button
            onClick={() => onNavigate?.("products")}
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-100"
          >
            <Plus className="h-4 w-4" />
            إضافة منتج
          </button>

          <button
            onClick={() => onNavigate?.("expenses")}
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-100"
          >
            <HandCoins className="h-4 w-4" />
            مصروفات
          </button>

          <button
            onClick={() => onNavigate?.("charging")}
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-100"
          >
            <SmartphoneCharging className="h-4 w-4" />
            شحن وخدمات
          </button>

          <button
            onClick={() => onNavigate?.("barcodePrint")}
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-100"
          >
            <Barcode className="h-4 w-4" />
            طباعة باركود
          </button>

          <button
            onClick={() => onNavigate?.("reports")}
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-100"
          >
            <BarChart3 className="h-4 w-4" />
            التقارير
          </button>
        </div>

       
      </Card>

      {/* الإحصائيات */}
      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-7">
        <StatCard
          icon={CircleDollarSign}
          title="إجمالي قيمة المخزن"
          value={currency(inventoryValue, settings.currencyCode)}
          subtitle="قيمة المنتجات بسعر الشراء"
        />

        <StatCard
          icon={Boxes}
          title="عدد المنتجات"
          value={numberFormat(products.length)}
          subtitle="كل الأصناف المسجلة"
        />

        <StatCard
          icon={PackageX}
          title="المنتجات الناقصة"
          value={numberFormat(lowStockProducts.length)}
          subtitle="وصلت لحد النقص"
        />

        <StatCard
          icon={Receipt}
          title="فواتير اليوم"
          value={numberFormat(todayInvoices.length)}
          subtitle="عدد الفواتير اليوم"
        />

        <StatCard
          icon={RotateCcw}
          title="مرتجع اليوم"
          value={currency(todaySalesReturns, settings.currencyCode)}
          subtitle="إجمالي المرتجعات اليوم"
        />

        <StatCard
          icon={CircleDollarSign}
          title="صافي مبيعات اليوم"
          value={currency(netTodaySales, settings.currencyCode)}
          subtitle="بعد خصم المرتجعات"
        />

        <StatCard
          icon={TrendingUp}
          title="صافي الربح اليوم"
          value={currency(netTodayProfit, settings.currencyCode)}
          subtitle="صافي المبيعات - تكلفة البضاعة - مصروفات اليوم"
        />
      </section>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <Card className="xl:col-span-7">
          <SectionTitle title="آخر الفواتير" subtitle="أحدث الفواتير المحفوظة" icon={Receipt} />
          <SalesTable invoices={invoices.slice(0, 8)} currencyCode={settings.currencyCode} />
        </Card>

        <Card className="xl:col-span-5">
          <SectionTitle title="المنتجات الناقصة" subtitle="الأصناف التي تحتاج شراء" icon={Package} />

          <div className="space-y-3">
            {lowStockProducts.slice(0, 8).map((item) => (
              <div key={item.id} className="rounded-2xl bg-slate-50 p-4">
                <p className="font-bold text-slate-900">{item.name}</p>
                <p className="mt-1 text-sm text-slate-600">
                  الموجود: {item.packageQty} {item.packageName} + {item.itemQty} قطعة
                </p>
                <p className="text-xs text-amber-700">
                  الحد الأدنى: {item.minPackageQty} {item.packageName}
                </p>
              </div>
            ))}

            {lowStockProducts.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-slate-500">
                لا توجد منتجات ناقصة حاليًا
              </div>
            ) : null}
          </div>
        </Card>
      </div>

      <Card>
        <SectionTitle title="ملخص اليوم" subtitle="أرقام سريعة تساعدك على متابعة النشاط" icon={CircleDollarSign} />

        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <div className="rounded-2xl bg-slate-50 p-4">
            <p className="text-sm text-slate-500">إجمالي مبيعات اليوم</p>
            <p className="mt-2 text-xl font-black text-slate-900">
              {currency(todaySales, settings.currencyCode)}
            </p>
          </div>

          <div className="rounded-2xl bg-red-50 p-4">
            <p className="text-sm text-red-600">إجمالي المرتجع اليوم</p>
            <p className="mt-2 text-xl font-black text-red-700">
              {currency(todaySalesReturns, settings.currencyCode)}
            </p>
          </div>

          <div className="rounded-2xl bg-emerald-50 p-4">
            <p className="text-sm text-emerald-700">صافي المبيعات اليوم</p>
            <p className="mt-2 text-xl font-black text-emerald-700">
              {currency(netTodaySales, settings.currencyCode)}
            </p>
          </div>

          <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
            <p className="text-sm text-slate-500">تكلفة البضاعة + مصروفات</p>
            <p className="mt-2 text-sm text-slate-700">
              تكلفة البضاعة: <span className="font-black">{currency(todayCogs, settings.currencyCode)}</span>
            </p>
            <p className="mt-1 text-sm text-slate-700">
              مصروفات اليوم: <span className="font-black">{currency(todayExpenses, settings.currencyCode)}</span>
            </p>
            <p className={`mt-2 text-lg font-black ${profitColor}`}>
              الربح: {currency(netTodayProfit, settings.currencyCode)}
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}