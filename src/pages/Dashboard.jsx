import React, { useContext } from "react";
import {
  Boxes,
  CircleDollarSign,
  PackageX,
  Receipt,
  Package,
  RotateCcw,
} from "lucide-react";
import { PosContext } from "../context/PosContext";
import { currency, numberFormat } from "../utils/format";
import Card from "../components/Card";
import SectionTitle from "../components/SectionTitle";
import StatCard from "../components/StatCard";
import SalesTable from "../components/SalesTable";

export default function Dashboard() {
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
  } = useContext(PosContext);

  return (
    <div className="space-y-6">
      <header className="rounded-[28px] bg-gradient-to-r from-slate-950 to-slate-800 p-6 text-white shadow-lg">
        <h1 className="text-3xl font-black tracking-tight">
          {settings.storeName || "كرمة ماركت"}
        </h1>
        <p className="mt-2 text-sm text-slate-300">نظرة سريعة على المخزن والمبيعات</p>
      </header>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-6">
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
      </section>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <Card className="xl:col-span-7">
          <SectionTitle
            title="آخر الفواتير"
            subtitle="أحدث الفواتير المحفوظة"
            icon={Receipt}
          />
          <SalesTable invoices={invoices.slice(0, 8)} currencyCode={settings.currencyCode} />
        </Card>

        <Card className="xl:col-span-5">
          <SectionTitle
            title="المنتجات الناقصة"
            subtitle="الأصناف التي تحتاج شراء"
            icon={Package}
          />

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
        <SectionTitle
          title="ملخص اليوم"
          subtitle="أرقام سريعة تساعدك على متابعة النشاط"
          icon={CircleDollarSign}
        />

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
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
        </div>
      </Card>
    </div>
  );
}